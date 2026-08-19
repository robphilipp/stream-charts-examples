import {type AxesAssignment, clipToArea} from "./plot";
import * as d3 from "d3";
import {ZoomTransform} from "d3";
import {noop} from "../utils";
import {useChart} from "../hooks/useChart";
import {useCallback, useEffect, useMemo, useRef} from "react";
import type {CanvasContext} from "../d3types";
import {seriesAt, canvasLocalPoint, type SeriesGeometry} from "./hitTesting";
import {
    axesForSeriesGen,
    type BaseAxis,
    type ContinuousNumericAxis,
    ordinalAxisIntervals,
    ordinalAxisRanges,
    ordinalAxisZoomHandler,
    ordinalPanHandler,
    type OrdinalStringAxis
} from "../axes/axes";
import {Subscription} from "rxjs";
import type {Dimensions, Margin} from "../styling/margins";
import {subscriptionOrdinalXFor, type WindowedOrdinalStats} from "../subscriptions/subscriptions";
import {useDataObservable} from "../hooks/useDataObservable";
import {usePlotDimensions} from "../hooks/usePlotDimensions";
import {useInitialData} from "../hooks/useInitialData";
import {copyValueStatsForSeries, type OrdinalChartData} from "../observables/ordinals";
import type {BaseSeries} from "../series/baseSeries";
import {calculateOrdinalStats, type OrdinalDatum, type OrdinalSeries} from "../series/ordinalSeries";
import {applyFillStyle, applyStrokeStyle} from "../styling/canvasStyle";
import type {SvgFillStyle, SvgStrokeStyle} from "../styling/svgStyle";
import {type BarSeriesStyle, type BarStyle, defaultBarSeriesStyle} from "../styling/barPlotStyle";
import type {TooltipData} from "../hooks/useTooltip";
import {OrdinalAxisRange} from "../axes/OrdinalAxisRange";
import {AxisInterval} from "../axes/AxisInterval";
import {Optional} from "result-fn";
import {BAR_CHART_TOOLTIP_PROVIDER_IDS} from "./constants.ts";

// typescript doesn't support enums with computed string values, even though they are all constants...
export type BarChartElementId = {
    readonly currentValue: string
    readonly meanValue: string
    readonly minMax: string
    readonly windowedMeanValue: string
    readonly windowedMinMax: string
}

export interface Props {
    /**
     * Holds the mapping between a series and the axis it uses (is assigned). The
     * map's key holds the series name, and the value is an {@link AxesAssignment}
     * object holding the ID of the assigned x-axis and y-axis.
     */
    axisAssignments?: Map<string, AxesAssignment>
    showMinMaxBars?: boolean
    showWindowedMinMaxBars?: boolean
    showValueLines?: boolean
    showMeanValueLines?: boolean
    showWindowedMeanValueLines?: boolean
    /**
     * The number of milliseconds worth of data to hold in memory before dropping it. Defaults to
     * infinity (i.e. no data is dropped)
     */
    dropDataAfter?: number
    /**
     * Enables panning (default is false)
     */
    panEnabled?: boolean
    /**
     * Enables zooming (default is false)
     */
    zoomEnabled?: boolean
    /**
     * When true, requires that the shift or control key be pressed while scrolling
     * in order to activate the zoom
     */
    zoomKeyModifiersRequired?: boolean
    /**
     * The (optional, default = 2 pixels) top and bottom margin (in pixels) for the spike lines in the plot.
     * Margins on individual series can also be set through the {@link Chart.seriesStyles} property.
     */
    barMargin?: number
    /**
     * The (optional) default style for the bar series that are used if no other styles are specified
     */
    barSeriesStyle?: BarSeriesStyle
}

/**
 * Renders a streaming bar plot for the series in the initial data and those sourced by the
 * observable specified as a property in the {@link Chart}. This component uses the {@link useChart}
 * hook, and therefore must be a child of the {@link Chart} to be plugged in to the
 * chart ecosystem (axes, tracker, tooltip).
 *
 * Internally, this no longer creates/updates SVG `<rect>`/`<line>` elements. Instead, it registers
 * a single draw function with the chart's {@link CanvasContext} that redraws every series' bars
 * and lines from scratch each time the canvas repaints. Mouse hover (for the tooltip and the
 * value-line/windowed-mean-line highlight) is handled by hit-testing the mouse position against
 * the last-drawn geometry, keyed per `${seriesName}::${elementType}` so the five overlaid visual
 * elements (min-max bar, windowed min-max bar, mean line, windowed mean line, value line) can be
 * hit-tested and highlighted independently, matching the old per-element SVG mouseover behavior.
 *
 * For a relatively complete example of how to use this plot component, see the
 * <a href="https://github.com/robphilipp/stream-charts-examples">`StreamingBarChart` example</a>
 *
 * @param props The properties associated with the bar plot
 * @example
 * ```typescript
 * <BarPlot
 *     barMargin={1}
 *     dropDataAfter={5000}
 *     panEnabled={true}
 *     zoomEnabled={true}
 *     zoomKeyModifiersRequired={true}
 *     withCadenceOf={50}
 *
 *     showMinMaxBars={true}
 *     showValueLines={true}
 *     showMeanValueLines={true}
 *     showWindowedMinMaxBars={true}
 *     showWindowedMeanValueLines={true}
 * />
 * ```
 */
/**
 * Maps the short element-type keys used internally for hit-testing geometry (`minMax`,
 * `windowedMinMax`, `meanValue`, `windowedMeanValue`, `currentValue`) to the actual provider IDs
 * (`BAR_CHART_TOOLTIP_PROVIDER_IDS`) that `mouseOverHandlerFor`/`mouseLeaveHandlerFor` expect.
 */
const PROVIDER_ID_FOR_ELEMENT_TYPE: Record<string, string> = {
    minMax: BAR_CHART_TOOLTIP_PROVIDER_IDS.minMax,
    windowedMinMax: BAR_CHART_TOOLTIP_PROVIDER_IDS.windowedMinMax,
    meanValue: BAR_CHART_TOOLTIP_PROVIDER_IDS.meanValue,
    windowedMeanValue: BAR_CHART_TOOLTIP_PROVIDER_IDS.windowedMeanValue,
    currentValue: BAR_CHART_TOOLTIP_PROVIDER_IDS.currentValue,
}

export function BarPlot(props: Props): null {
    const {
        chartId,
        canvasContext,
        axes,
        seriesStyles,
        seriesFilter,
        mouse
    } = useChart<OrdinalDatum, BarSeriesStyle, WindowedOrdinalStats, OrdinalAxisRange, OrdinalStringAxis>()

    const {
        xAxesState,
        yAxesState,
        setAxisAssignments,
        setAxisIntervalFor,
        setOriginalAxisIntervalFor,
        axesRanges
    } = axes

    const {mouseOverHandlerFor, mouseLeaveHandlerFor} = mouse

    const {plotDimensions, margin} = usePlotDimensions()

    const {
        seriesObservable,
        windowingTime = 100,
        shouldSubscribe,

        onSubscribe = noop,
        onUpdateData,
        onUpdateChartTime = noop
    } = useDataObservable<OrdinalChartData, OrdinalDatum>()

    const {initialData} = useInitialData<OrdinalChartData, OrdinalDatum>()

    const {
        axisAssignments = new Map<string, AxesAssignment>(),
        dropDataAfter = Infinity,
        panEnabled = false,
        zoomEnabled = false,
        zoomKeyModifiersRequired = true,
        showMinMaxBars = true,
        showWindowedMinMaxBars = true,
        showValueLines = true,
        showMeanValueLines = true,
        showWindowedMeanValueLines = true,
        barMargin = 2,
        barSeriesStyle = defaultBarSeriesStyle()
    } = props

    // why do "dataRef" and "seriesRef" both hold on to the same underlying data? for performance.
    //
    // the "dataRef" and "seriesRef" both point to the same underlying data, a collection
    // of series. The series in "dataRef" are read by the canvas draw function. The "seriesRef" series
    // are the ones that are updated as new data is streamed in.
    //
    // the "dataRef" object holds on to a copy of the initial data (which is an array of
    // time-series, e.i. an array of BaseSeries<OrdinalDatum> objects). The slice just creates a copy of
    // the array, but the references to the BaseSeries objects are the same and still point to the same
    // data as the "initialData" array.
    //
    // the "seriesRef" object is a reference to a map (series_name -> BaseSeries<OrdinalDatum>) which is
    // used to update the data in the series. When new data enters, it is appended to one or more series.
    //
    // the series in the "dataRef" object are the ones read by the next redraw, so as these are
    // updated, the next canvas repaint picks up the new data.
    const dataRef = useRef<Array<BaseSeries<OrdinalDatum>>>(initialData.slice())
    const seriesRef = useRef<Map<string, BaseSeries<OrdinalDatum>>>(
        new Map(initialData.map(series => [series.name, series]))
    )
    // eslint-disable-next-line react-hooks/refs
    const statsRef = useRef<WindowedOrdinalStats>(initialOrdinalStats(dataRef.current))

    // map(axis_id -> current_time) -- maps the axis ID to the current time for that axis
    const currentTimeRef = useRef<number>(0)
    const subscriptionRef = useRef<Subscription>(undefined)

    const isSubscriptionClosed = () => subscriptionRef.current === undefined || subscriptionRef.current.closed

    // eslint-disable-next-line react-hooks/refs
    const allowTooltipRef = useRef<boolean>(isSubscriptionClosed())

    // the last-drawn geometry for each `${seriesName}::${elementType}`, in canvas coordinates,
    // used for hit-testing mouse hover on `mousemove` (see the effect below that wires up the
    // listener)
    const geometryRef = useRef<Map<string, SeriesGeometry>>(new Map())
    // which specific element (series + type) the mouse was over on the previous `mousemove`, so
    // we know when to fire a "leave" before firing an "over" for a different element -- unlike
    // Scatter/Raster, BarPlot doesn't use the shared `hoveredSeriesName` chart state, since here
    // hover is scoped to one of five element *types* per series, not the series as a whole
    const lastHoveredRef = useRef<{seriesName: string, elementType: string} | undefined>(undefined)

    useEffect(
        () => {
            currentTimeRef.current = 0
        },
        [xAxesState]
    )

    // set the axis assignments needed if a tooltip is being used
    useEffect(
        () => {
            setAxisAssignments(axisAssignments)
        },
        [axisAssignments, setAxisAssignments]
    )

    // calculates the distinct series IDs that cover all the series in the plot
    const axesForSeries = useMemo(
        () => axesForSeriesGen<OrdinalDatum, OrdinalStringAxis>(initialData, axisAssignments, xAxesState),
        [initialData, axisAssignments, xAxesState]
    )

    // updates the timing using the onUpdateTime and updatePlot references. This and the references
    // defined above allow the axes' times to be updated properly by avoid stale reference to these
    // functions.
    const updateTimingAndPlot = useCallback(
        (ranges: Map<string, OrdinalAxisRange>): void => {
            if (canvasContext !== null) {
                updatePlotRef.current(ranges, canvasContext)
                onUpdateChartTime(currentTimeRef.current)
                updatePlotRef.current(ranges, canvasContext)
            }
        },
        [canvasContext, onUpdateChartTime]
    )

    // todo find better way
    // when the initial data changes, then reset the plot. note that the initial data doesn't change
    // during the normal course of updates from the observable, only when the plot is restarted.
    useEffect(
        () => {
            dataRef.current = initialData.slice()
            seriesRef.current = new Map(initialData.map(series => [series.name, series]))
            currentTimeRef.current = 0
            statsRef.current = initialOrdinalStats(dataRef.current)
        },
        // ** not happy about this **
        // only want this effect to run when the initial data is changed, which mean all the
        // other dependencies are recalculated anyway.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [initialData]
    )

    /**
     * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
     * @param x The amount that the plot is dragged
     * @param plotDimensions The dimensions of the plot
     * @param series An array of series names
     * @param ranges A map holding the axis ID and its associated time range
     */
    const onPan = useCallback(
        (x: number,
         plotDimensions: Dimensions,
         series: Array<string>,
         ranges: Map<string, OrdinalAxisRange>
        ) => ordinalPanHandler(axesForSeries, margin, setAxisIntervalFor, xAxesState)(x, plotDimensions, series, ranges),
        [axesForSeries, margin, setAxisIntervalFor, xAxesState]
    )

    /**
     * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
     * at the location of the mouse when the scroll wheel or gesture was applied.
     * @param transform The d3 zoom transformation information
     * @param x The x-position of the mouse when the scroll wheel or gesture is used
     * @param plotDimensions The dimensions of the plot
     * @param ranges A map holding the axis ID and its associated time-range
     */
    const onZoom = useCallback(
        (
            transform: ZoomTransform,
            x: number,
            plotDimensions: Dimensions,
            ranges: Map<string, OrdinalAxisRange>,
        ) => ordinalAxisZoomHandler(axesForSeries, margin, setAxisIntervalFor, setOriginalAxisIntervalFor, xAxesState)(transform, x, plotDimensions, ranges),
        [axesForSeries, margin, setAxisIntervalFor, setOriginalAxisIntervalFor, xAxesState]
    )

    /**
     * (Re-)registers this plot's draw function with the canvas context and requests a redraw.
     * Replaces the old version, which directly mutated SVG `<rect>`/`<line>` elements bound via
     * d3's enter/update/exit join. Canvas has no persistent elements to join against, so the draw
     * function just redraws every element from current data/scale state each time it's invoked.
     * @param ordinalRanges The current per-axis ordinal ranges (mutated in place by pan/zoom)
     * @param cc The canvas context to register the draw function with
     */
    const updatePlot = useCallback(
        (ordinalRanges: Map<string, OrdinalAxisRange>, cc: CanvasContext) => {
            // set up panning
            if (panEnabled) {
                const canvasSelection = d3.select<HTMLCanvasElement, unknown>(cc.canvas)
                const drag = d3.drag<HTMLCanvasElement, unknown>()
                    .on("start", () => {
                        canvasSelection.style("cursor", "move")
                        allowTooltipRef.current = false
                    })
                    .on("drag", event => {
                        const names = dataRef.current.map(series => series.name)
                        onPan(event.dx, plotDimensions, names, ordinalRanges)
                        // need to update the plot with the new time-ranges
                        updatePlotRef.current(ordinalRanges, cc)
                    })
                    .on("end", () => {
                        canvasSelection.style("cursor", "auto")
                        allowTooltipRef.current = isSubscriptionClosed()
                    })

                canvasSelection.call(drag)
            }

            // set up for zooming
            if (zoomEnabled) {
                const canvasSelection = d3.select<HTMLCanvasElement, unknown>(cc.canvas)
                const zoom = d3.zoom<HTMLCanvasElement, unknown>()
                    .filter(event => !zoomKeyModifiersRequired || event.shiftKey || event.ctrlKey)
                    .scaleExtent([1, 10])
                    .translateExtent([[margin.left, margin.top], [plotDimensions.width, plotDimensions.height]])
                    .on("zoom", event => {
                            onZoom(
                                event.transform,
                                event.sourceEvent.offsetX - margin.left,
                                plotDimensions,
                                ordinalRanges,
                            )
                            updatePlotRef.current(ordinalRanges, cc)
                        }
                    )
                canvasSelection.call(zoom)
            }

            const draw = (context: CanvasContext) => {
                const {ctx} = context

                ctx.save()
                clipToArea(context, plotDimensions, {x: margin.left, y: margin.top})
                ctx.translate(margin.left, margin.top)

                const newGeometry = new Map<string, SeriesGeometry>()
                const hovered = lastHoveredRef.current

                // enter, update, delete the bar data
                dataRef.current.forEach(series => {
                    const [xAxis, yAxis] = axesFor(
                        series.name,
                        axisAssignments,
                        axisId => xAxesState.axisFor(axisId).getOrUndefined(),
                        axisId => yAxesState.axisFor(axisId).getOrUndefined()
                    )
                    if (xAxis === undefined || yAxis === undefined) return

                    // grab the series styles, or the defaults if none exist
                    const {
                        margin: categoryMargin = barMargin,
                        valueLine: valueLineStyle,
                        meanValueLine: meanValueLineStyle,
                        windowedMeanValueLine: windowedMeanLineStyle,
                        minMaxBar: minMaxBarStyle,
                        windowedMinMaxBar: windowedBarStyle
                    } = seriesStyles.get(series.name) || {
                        ...barSeriesStyle,
                        highlightColor: barSeriesStyle.color
                    }

                    // only show the data for which the regex filter matches
                    const plotData = series.name.match(seriesFilter) && series.data.length > 0 ?
                        [series.data[series.data.length - 1]] :
                        []
                    if (plotData.length === 0) return

                    // grab the functions for determining the lower and upper bounds of the category
                    const {lower, upper} = xAxisCategoryBoundsFn(xAxis.scale.bandwidth(), valueLineStyle.regular.width, categoryMargin)

                    // grab the value (index) associated with the series name (this is a category axis)
                    const x = xAxis.scale(series.name) || 0

                    //
                    // min/max bar rectangle
                    const totalBar = barDimensions(
                        minMaxBarStyle.widthFraction,
                        lower(x), upper(x),
                        statsRef.current.valueStatsForSeries.get(series.name)?.min.value || 0,
                        statsRef.current.valueStatsForSeries.get(series.name)?.max.value || 0,
                        yAxis
                    )
                    drawBar(ctx, totalBar, barStyleFor(showMinMaxBars, minMaxBarStyle))
                    newGeometry.set(`${series.name}::minMax`, {
                        points: [],
                        rects: [{x: totalBar.upperX, y: totalBar.upperY, width: totalBar.width, height: totalBar.height}],
                        hitRadius: 0
                    })

                    //
                    // windowed-mean line and windowed min/max bar, when the windowed stats are defined for the series
                    const seriesWindowedStats = statsRef.current.windowedValueStatsForSeries.get(series.name)
                    if (seriesWindowedStats !== undefined) {
                        const windowedBar = barDimensions(
                            windowedBarStyle.widthFraction,
                            lower(x), upper(x),
                            seriesWindowedStats.min.value, seriesWindowedStats.max.value,
                            yAxis
                        )
                        drawBar(ctx, windowedBar, barStyleFor(showWindowedMinMaxBars, windowedBarStyle))
                        newGeometry.set(`${series.name}::windowedMinMax`, {
                            points: [],
                            rects: [{x: windowedBar.upperX, y: windowedBar.upperY, width: windowedBar.width, height: windowedBar.height}],
                            hitRadius: 0
                        })

                        //
                        // mean line
                        if (showMeanValueLines) {
                            const meanLineY = yAxis.scale(statsRef.current.valueStatsForSeries.get(series.name)?.mean || 0)
                            drawLine(ctx, lower(x), meanLineY, upper(x), meanLineY, meanValueLineStyle.regular)
                            newGeometry.set(`${series.name}::meanValue`, {
                                points: [],
                                segments: [[[lower(x), meanLineY], [upper(x), meanLineY]]],
                                hitRadius: Math.max(4, meanValueLineStyle.regular.width ?? 1)
                            })
                        }

                        //
                        // windowed-mean line
                        if (showWindowedMeanValueLines) {
                            const windowedMeanLineY = yAxis.scale(isNaN(seriesWindowedStats.mean) ? 0 : seriesWindowedStats.mean)
                            const isHovered = hovered?.seriesName === series.name && hovered.elementType === 'windowedMeanValue'
                            const style = isHovered ? windowedMeanLineStyle.highlight : windowedMeanLineStyle.regular
                            drawLine(ctx, lower(x), windowedMeanLineY, upper(x), windowedMeanLineY, style)
                            newGeometry.set(`${series.name}::windowedMeanValue`, {
                                points: [],
                                segments: [[[lower(x), windowedMeanLineY], [upper(x), windowedMeanLineY]]],
                                hitRadius: Math.max(4, style.width ?? 1)
                            })
                        }
                    }

                    //
                    // value line
                    if (showValueLines) {
                        const datum = plotData[0]
                        const valueLineY = yAxis.scale(datum.value)
                        const isHovered = hovered?.seriesName === series.name && hovered.elementType === 'currentValue'
                        const style = isHovered ? valueLineStyle.highlight : valueLineStyle.regular
                        drawLine(ctx, lower(x), valueLineY, upper(x), valueLineY, style)
                        newGeometry.set(`${series.name}::currentValue`, {
                            points: [],
                            segments: [[[lower(x), valueLineY], [upper(x), valueLineY]]],
                            hitRadius: Math.max(4, style.width ?? 1)
                        })
                    }
                })

                geometryRef.current = newGeometry

                ctx.restore()
            }

            cc.register(`bar-plot-${chartId}`, draw, 10)
            cc.requestRedraw()
        },
        [
            chartId, canvasContext,
            panEnabled, zoomEnabled,
            onPan, onZoom,
            plotDimensions, margin, zoomKeyModifiersRequired,
            axisAssignments, xAxesState, yAxesState,
            barMargin, seriesStyles, barSeriesStyle,
            seriesFilter,
            showValueLines,
            showMinMaxBars,
            showMeanValueLines,
            showWindowedMeanValueLines,
            showWindowedMinMaxBars
        ]
    )

    // need to keep the function references for use by the subscription, which forms a closure
    // on them. without the references, the closures become stale, and resizing during streaming
    // doesn't work properly
    const updatePlotRef = useRef<(ordinalRange: Map<string, OrdinalAxisRange>, cc: CanvasContext) => void>(noop)
    useEffect(
        () => {
            // eslint-disable-next-line react-hooks/immutability
            updatePlotRef.current = updatePlot
        },
        [updatePlot]
    )

    // memoized function for subscribing to the chart-data observable
    const subscribe = useCallback(
        () => {
            if (seriesObservable === undefined || canvasContext === null) return undefined
            return subscriptionOrdinalXFor(
                seriesObservable,
                onSubscribe,
                windowingTime,
                axisAssignments,
                yAxesState,
                onUpdateData,
                dropDataAfter,
                updateTimingAndPlot,
                // as new data flows into the subscription, the subscription
                // updates this map directly (for performance)
                seriesRef.current,
                statsRef,
                (currentTime: number) => currentTimeRef.current = currentTime,
                AxisInterval.from(0, plotDimensions.width)
            )
        },
        [
            axisAssignments, dropDataAfter, canvasContext,
            onSubscribe, onUpdateData,
            seriesObservable, updateTimingAndPlot, windowingTime, yAxesState,
            plotDimensions.width
        ]
    )

    useEffect(
        () => {
            if (canvasContext) {
                const ordinalAxesRanges = axesRanges()
                // so this gets a bit complicated. the ordinal-ranges need to be updated whenever the ordinal-ranges
                // change. for example, when the window is resized, and then we need to update the
                // ordinal-range. however, we want to keep the ordinal-ranges to reflect their original scale so that
                // we can zoom properly (so the updates can't fuck with the scale).
                if (ordinalAxesRanges.size === 0) {
                    // when no time-ranges have yet been created, then create them and hold on to a mutable
                    // reference to them
                    updatePlot(ordinalAxisRanges(xAxesState.axes, AxisInterval.from(0, plotDimensions.width)), canvasContext)
                } else {
                    // when the ordinal-ranges already exist, then we want to update the ordinal-ranges for each
                    // existing ordinal-range in a way that maintains the original scale.
                    const intervals = ordinalAxisIntervals(xAxesState.axes)
                    // todo instead of updating the underlying map, this should use setter methods to make the updates
                    ordinalAxesRanges
                        .forEach((range: OrdinalAxisRange, id: string, rangesMap: Map<string, OrdinalAxisRange>) => {
                            Optional
                                .ofNullable(intervals.get(id))
                                .map(intervalInfo => intervalInfo.interval.asTuple())
                                .ifPresent(([start, end]) => {
                                    // update the reference map with the new (start, end) portion of the range,
                                    // while keeping the original scale intact
                                    rangesMap.set(id, range.update(start, end) as OrdinalAxisRange)
                                })
                        })
                    updatePlot(ordinalAxesRanges, canvasContext)
                }
            }
        },
        [axesRanges, canvasContext, plotDimensions.width, updatePlot, xAxesState.axes]
    )

    // wires up a single mousemove/mouseleave listener on the shared canvas to replace the old
    // per-element SVG mouseover/mouseleave handlers. Hit-tests the mouse position against the
    // last-drawn geometry (see `geometryRef`, populated by the draw function above), keyed per
    // `${seriesName}::${elementType}` so the five overlaid elements resolve independently.
    useEffect(
        () => {
            if (!canvasContext) return

            const canvas = canvasContext.canvas

            const handleMove = (event: MouseEvent) => {
                const [x, y] = canvasLocalPoint(event, canvas)
                const hit = seriesAt(x, y, geometryRef.current)
                // geometry keys are "${seriesName}::${elementType}"; split back apart
                const [hitSeriesName, hitElementType] = hit !== undefined ? hit.name.split('::') : [undefined, undefined]

                const previous = lastHoveredRef.current
                const sameAsBefore = previous !== undefined && hitSeriesName === previous.seriesName && hitElementType === previous.elementType

                if (!sameAsBefore) {
                    if (previous !== undefined) {
                        handleMouseLeaveSeries(
                            previous.seriesName,
                            mouseLeaveHandlerFor(`tooltip-${chartId}`, PROVIDER_ID_FOR_ELEMENT_TYPE[previous.elementType])
                        )
                    }

                    if (hitSeriesName !== undefined && hitElementType !== undefined) {
                        const series = seriesRef.current.get(hitSeriesName)
                        const yAxis = axesFor(
                            hitSeriesName,
                            axisAssignments,
                            axisId => xAxesState.axisFor(axisId).getOrUndefined(),
                            axisId => yAxesState.axisFor(axisId).getOrUndefined()
                        )[1]
                        const showingByType: Record<string, boolean> = {
                            minMax: showMinMaxBars,
                            windowedMinMax: showWindowedMinMaxBars,
                            meanValue: showMeanValueLines,
                            windowedMeanValue: showWindowedMeanValueLines,
                            currentValue: showValueLines,
                        }
                        if (series !== undefined && yAxis !== undefined && allowTooltipRef.current && showingByType[hitElementType]) {
                            handleMouseOverBar(
                                yAxis,
                                series,
                                statsRef.current,
                                [x, y],
                                margin,
                                mouseOverHandlerFor(`tooltip-${chartId}`, PROVIDER_ID_FOR_ELEMENT_TYPE[hitElementType])
                            )
                        }
                    }

                    lastHoveredRef.current = hitSeriesName !== undefined && hitElementType !== undefined ?
                        {seriesName: hitSeriesName, elementType: hitElementType} :
                        undefined

                    // the value-line and windowed-mean-line highlight depends on hover state, so
                    // request a redraw when it changes
                    canvasContext.requestRedraw()
                }
            }

            const handleLeaveCanvas = () => {
                const previous = lastHoveredRef.current
                if (previous !== undefined) {
                    handleMouseLeaveSeries(previous.seriesName, mouseLeaveHandlerFor(`tooltip-${chartId}`, PROVIDER_ID_FOR_ELEMENT_TYPE[previous.elementType]))
                    lastHoveredRef.current = undefined
                    canvasContext.requestRedraw()
                }
            }

            canvas.addEventListener('mousemove', handleMove)
            canvas.addEventListener('mouseleave', handleLeaveCanvas)
            return () => {
                canvas.removeEventListener('mousemove', handleMove)
                canvas.removeEventListener('mouseleave', handleLeaveCanvas)
            }
        },
        [
            canvasContext, chartId, margin, axisAssignments, xAxesState, yAxesState,
            mouseOverHandlerFor, mouseLeaveHandlerFor,
            showMinMaxBars, showWindowedMinMaxBars, showMeanValueLines, showWindowedMeanValueLines, showValueLines
        ]
    )

    // subscribe/unsubscribe to the observable chart data. when the `shouldSubscribe`
    // is changed to `true` and we haven't subscribed yet, then subscribe. when the
    // `shouldSubscribe` is `false` and we had subscribed, then unsubscribe. otherwise,
    // do nothing.
    useEffect(
        () => {
            if (shouldSubscribe && subscriptionRef.current === undefined) {
                subscriptionRef.current = subscribe()
                allowTooltipRef.current = false
            } else if (!shouldSubscribe && subscriptionRef.current !== undefined) {
                subscriptionRef.current?.unsubscribe()
                subscriptionRef.current = undefined
                allowTooltipRef.current = true
            }
        },
        [shouldSubscribe, subscribe]
    )

    // unregister this plot's draw function on unmount
    useEffect(
        () => {
            return () => {
                if (canvasContext) {
                    canvasContext.unregister(`bar-plot-${chartId}`)
                }
            }
        },
        [canvasContext, chartId]
    )

    return null
}

/*
    Helper functions and types
 */

type BarDimensions = {
    upperX: number
    upperY: number
    width: number
    height: number
}

function barStyleFor(isVisible: boolean, style: BarStyle): BarStyle {
    return {
        ...style,
        fill: updateOpacityFor<SvgFillStyle>(isVisible, style.fill),
        stroke: updateOpacityFor<SvgStrokeStyle>(isVisible, style.stroke)
    }
}

function updateOpacityFor<S extends SvgFillStyle | SvgStrokeStyle>(isVisible: boolean, style: S): S {
    return {
        ...style,
        opacity: isVisible ? style.opacity : 0
    }
}

/**
 * Draws a bar (rectangle) onto the canvas context. Replaces the old `barFor`, which set SVG
 * `<rect>` attributes via a d3 selection.
 * @param ctx The canvas 2D context
 * @param dimensions The bar's dimensions
 * @param style The bar style holding the fill and stroke styles
 */
function drawBar(
    ctx: CanvasRenderingContext2D,
    dimensions: BarDimensions,
    style: BarStyle
): void {
    if (dimensions.width <= 0 || dimensions.height <= 0) return

    applyFillStyle(ctx, style.fill)
    ctx.fillRect(dimensions.upperX, dimensions.upperY, dimensions.width, dimensions.height)

    if ((style.stroke.width ?? 0) > 0) {
        applyStrokeStyle(ctx, style.stroke)
        ctx.strokeRect(dimensions.upperX, dimensions.upperY, dimensions.width, dimensions.height)
    }
}

/**
 * Draws a horizontal line segment (used for the value/mean/windowed-mean lines) onto the canvas
 * context. Replaces the old `lineFor`, which set SVG `<line>` attributes via a d3 selection.
 * @param ctx The canvas 2D context
 * @param x1 The line's start x-coordinate
 * @param y1 The line's start y-coordinate
 * @param x2 The line's end x-coordinate
 * @param y2 The line's end y-coordinate
 * @param strokeStyle The stroke style
 */
function drawLine(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    strokeStyle: Partial<SvgStrokeStyle>
): void {
    applyStrokeStyle(ctx, strokeStyle)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
}

/**
 * Calculates the upper (x, y) coordinates of the bar, and the width and height of the bar
 * @param widthFraction The fraction of the category width that the bar should take
 * @param lowerX (Scaled to the axis) The lower bounds of the bar on the x-axis
 * @param upperX (Scaled to the axis) The upper bounds of the bar on the x-axis
 * @param min The minimum value for the category (NOT scaled to the axis)
 * @param max The maximum value for the category (NOT scaled to the axis)
 * @param axis The axis (needed for scaling)
 * @return The bar's upper (x, y) coordinates, the width, and height
 */
function barDimensions(widthFraction: number, lowerX: number, upperX: number, min: number, max: number, axis: ContinuousNumericAxis): BarDimensions {
    const x = lowerX + Math.max(0, 0.5 - widthFraction / 2) * (upperX - lowerX)

    const maxValue = (isNaN(max) || max === -Infinity) ? 0 : max
    const y = axis.scale(maxValue)

    const width = Math.max(0, widthFraction * (upperX - lowerX))

    const minValue = (isNaN(min) || min === -Infinity) ? 0 : min
    const height = Math.max(0, axis.scale(minValue) - axis.scale(maxValue))
    return {
        upperX: x,
        upperY: y,
        width,
        height,
    }
}

/**
 * Calculates the ordinal stats for each of the ordinal series (generally, initial data) and
 * returns a {@link WindowedOrdinalStats} object
 * @param series The array of ordinal series
 * @return A {@link WindowedOrdinalStats} object with the stats for each of the series
 */
function initialOrdinalStats(series: Array<OrdinalSeries>): WindowedOrdinalStats {
    const ordinalStats = calculateOrdinalStats(series)
    return {
        ...ordinalStats,
        windowedValueStatsForSeries: copyValueStatsForSeries(ordinalStats.valueStatsForSeries)
    }
}

/**
 * Functions that return the bounds of the category. The {@link lower} function
 * returns the lower bound of the category within which the value falls. The
 * {@link upper} function returns the upper bound of the category within which the
 * value falls
 */
type CategoryBounds = {
    lower: (value: number) => number
    upper: (value: number) => number,
}

/**
 * Attempts to locate the x- and y-axes for the specified series. If no axis is found for the
 * series name, then uses the default returned by the useChart() hook.
 * @param seriesName Name of the series for which to retrieve the axis
 * @param axisAssignments A map holding the series name and the associated x- and y-axes assigned
 * to that series. Note that the series in the axis-assignment map is merely a subset of the set
 * of series names.
 * @param xAxisFor The function that accepts an axis ID and returns the corresponding x-axis
 * @param yAxisFor The function that accepts an axis ID and returns the corresponding y-axis
 * @return A 2d tuple holding the linear x-axis as its first element and the category y-axis as
 * the second element.
 */
function axesFor(
    seriesName: string,
    axisAssignments: Map<string, AxesAssignment>,
    xAxisFor: (id: string) => BaseAxis | undefined,
    yAxisFor: (id: string) => BaseAxis | undefined,
): [xAxis: OrdinalStringAxis, yAxis: ContinuousNumericAxis] {
    const axes = axisAssignments.get(seriesName)
    const xAxis = xAxisFor(axes?.xAxis || "")
    const xAxisCategory = xAxis as OrdinalStringAxis
    if (xAxis && !xAxisCategory) {
        throw Error("Bar plot requires that x-axis be of type CategoryAxis")
    }
    const yAxis = yAxisFor(axes?.yAxis || "")
    const yAxisContinuous = yAxis as ContinuousNumericAxis
    if (yAxis && !yAxisContinuous) {
        throw Error("Bar plot requires that y-axis be of type ContinuousNumericAxis")
    }
    return [xAxisCategory, yAxisContinuous]
}

/**
 * Calculates the upper and lower coordinate for the category
 * @param categorySize The size of the category (i.e. plot_height / num_series)
 * @param lineWidth The width of the series line
 * @param margin The margin applied to the top and bottom of the spike line (vertical spacing)
 * @return An object with two functions, that when handed a y-coordinate, return the location
 * for the start (yUpper) or end (yLower) of the spikes line.
 */
function xAxisCategoryBoundsFn(categorySize: number, lineWidth: number, margin: number): CategoryBounds {
    if (categorySize <= margin) return {
        upper: value => value + lineWidth,
        lower: value => value
    }
    return {
        upper: value => value + categorySize - margin,
        lower: value => value + margin
    }
}

/**
 * Reports a tooltip showing for the bar in the bar chart (see {@link BarPlotTooltipContent}).
 * Replaces the old version, which also mutated the hovered SVG element's stroke directly for the
 * two element types that support a highlight (`currentValue`, `windowedMeanValue`); that highlight
 * is now handled by the draw function checking the hover state (see `updatePlot`'s `draw`) rather
 * than by touching an element here.
 * @param yAxis The y-axis
 * @param selectedSeries The selected series
 * @param seriesStats The statistics about the current series
 * @param mouseCoords The `[x, y]` position of the mouse, in canvas coordinates
 * @param margin The plot margin
 * @param mouseOverHandlerFor The handler for the mouse over (registered by the <Tooltip/>)
 */
function handleMouseOverBar(
    yAxis: ContinuousNumericAxis,
    selectedSeries: BaseSeries<OrdinalDatum>,
    seriesStats: WindowedOrdinalStats,
    mouseCoords: [x: number, y: number],
    margin: Margin,
    mouseOverHandlerFor: ((
        seriesName: string,
        value: number,
        tooltipData: TooltipData<OrdinalDatum, WindowedOrdinalStats>,
        mouseCoords: [x: number, y: number]
    ) => void) | undefined,
): void {
    const [, y] = mouseCoords
    const value = yAxis.scale.invert(y - margin.top)

    const {name: categoryName, data: selectedData} = selectedSeries

    if (mouseOverHandlerFor) {
        // the contract for the mouse over handler is for a series
        mouseOverHandlerFor(categoryName, value, {series: selectedData, metadata: seriesStats}, mouseCoords)
    }
}

/**
 * Calls the mouse-leave-series handler registered for this series. Replaces the old version, which
 * also reset the hovered SVG element's stroke color/width directly; that reset is now implicit --
 * once the hover state no longer matches this element, the next redraw simply paints it in its
 * normal (non-highlighted) style.
 * @param seriesName The name of the series (i.e. the neuron ID)
 * @param mouseLeaverHandlerFor Registered handler for the series when the mouse leaves
 */
function handleMouseLeaveSeries(
    seriesName: string,
    mouseLeaverHandlerFor: ((seriesName: string) => void) | undefined,
): void {
    if (mouseLeaverHandlerFor) {
        mouseLeaverHandlerFor(seriesName)
    }
}
