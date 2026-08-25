import {useCallback, useEffect, useMemo, useRef} from 'react'
import {type NoTooltipMetadata, useChart} from "../hooks/useChart";
import * as d3 from "d3";
import {ZoomTransform} from "d3";
import {clipToArea} from "./plot";
import {type Datum} from "../series/timeSeries";
import {
    axesZoomHandler,
    type BaseAxis,
    type ContinuousNumericAxis,
    defaultLineStyle,
    panHandler2D,
    type SeriesLineStyle
} from "../axes/axes";
import type {CanvasContext} from "../d3types";
import {seriesAt, canvasLocalPoint, type SeriesGeometry} from "./hitTesting";
import {Observable, Subscription} from "rxjs";
import {formatTime, fontStringFor, noop, textDimensions} from "../utils";
import type {Dimensions} from "../styling/margins";
import {subscriptionIteratesFor} from "../subscriptions/subscriptions";
import {useDataObservable} from "../hooks/useDataObservable";
import type {IterateChartData} from "../observables/iterates";
import type {IterateDatum, IterateSeries} from "../series/iterateSeries";
import {usePlotDimensions} from "../hooks/usePlotDimensions";
import {useInitialData} from "../hooks/useInitialData";
import {type TooltipData, useTooltip} from "../hooks/useTooltip";
import type {TimeSeriesChartData} from "../series/timeSeriesChartData";
import {ContinuousAxisRange} from "../axes/ContinuousAxisRange";
import {FastShiftArray} from "fast-shift-array";

type IteratePoint = { n: number, n_1: number, time: number, index: number }
type IteratePointSeries = FastShiftArray<IteratePoint>

function generateAxisRangeMap(axes: Map<string, BaseAxis>): Map<string, ContinuousAxisRange> {
    return new Map(
        Array.from(axes.entries()).map(([id, axis]) => {
            const [start, end] = (axis as ContinuousNumericAxis).scale.domain()
            return [id, ContinuousAxisRange.from(start, end)]
        })
    )
}

export interface Props {
    /**
     * The line interpolation curve factory. See the d3 documentation for curves at
     * {@link https://github.com/d3/d3-shape#curves} for information on available interpolations
     */
    interpolation?: d3.CurveFactory
    /**
     * When set to `true` plots the data points as well as the line.
     */
    showPoints?: boolean
    /**
     * The number of milliseconds of data to hold in memory before dropping it. Defaults to
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
     * The smallest scale factor allowed for zooming (in). For example, a setting of 0.5 means
     * that the largest zoom amount is 2 times the current size, or put another way, an interval
     * of length 1 unit covers twice as may pixels after the zoom. Effectively, the smaller this
     * factor, the more the user can "zoom in". Default value is 0.0.
     */
    zoomMinScaleFactor?: number
    /**
     * The largest scale factor allowed for zooming (out). For example, a setting of 2.0 means
     * that at this value, the length of 1 unit covers 1/2 the number of pixels. Effectively,
     * the larger this factor, the more the user can "zoom out". Default value is 1.0.
     */
    zoomMaxScaleFactor?: number
    /**
     * When set, uses a cadence with the specified refresh period (in milliseconds). For plots
     * where the updates are slow (> 100 ms) using a cadence of 10 to 25 ms smooths out the
     * updates and makes the plot updates look cleaner. When updates are around 25 ms or less,
     * then setting the cadence period too small will result in poor update performance. Generally
     * at high update speeds, the cadence is unnecessary. Finally, using cadence, sets the max time
     * to the current time.
     */
    withCadenceOf?: number
}

/**
 * Renders a streaming Poincare (iterates) plot for the series in the initial data and those sourced by the
 * observable specified as a property in the {@link Chart}. This component uses the {@link useChart}
 * hook, and therefore must be a child of the {@link Chart} in order to be plugged in to the
 * chart ecosystem (axes, tracker, tooltip).
 *
 * Internally, this no longer creates/updates SVG `<path>`/`<circle>`/`<text>` elements. Instead, it
 * registers a single draw function with the chart's {@link CanvasContext} that redraws every
 * series' line and points from scratch each time the canvas repaints. The old version's
 * hover-a-point-and-annotate-its-neighbors behavior used direct `d3.select('#specific-id')` lookups
 * into already-rendered SVG elements from a separate pass after the main render; since canvas has
 * no persistent elements to reach back into, this is restructured so the single draw pass checks
 * "is this point hovered, or a neighbor of the hovered point" and renders the highlight/label
 * inline, driven by a `hoveredPointRef` updated on `mousemove`.
 *
 * @param props The properties associated with the scatter plot
 * @example
 * ```typescript
 *  <ScatterPlot
 *      interpolation={interpolation}
 *      axisAssignments={new Map([
 *          ['test2', assignAxes("x-axis-2", "y-axis-2")],
 *      ])}
 *      dropDataAfter={10000}
 *      panEnabled={true}
 *      zoomEnabled={true}
 *      zoomKeyModifiersRequired={true}
 *  />
 * ```
 */
export function PoincarePlot(props: Props): null {
    const {
        chartId,
        canvasContext,
        axes,
        backgroundColor,
        seriesStyles,
        seriesFilter,

        mouse
    } = useChart<IterateDatum, SeriesLineStyle, NoTooltipMetadata, ContinuousAxisRange, ContinuousNumericAxis>()

    const {
        xAxesState,
        yAxesState,
        setAxisIntervalFor,
        updateAxisRanges = noop,
        axisRangeFor,
        addAxesRangesUpdateHandler,
        removeAxesRangesUpdateHandler,
    } = axes

    const {
        mouseOverHandlerFor,
        mouseLeaveHandlerFor
    } = mouse

    const {
        plotDimensions,
        margin,
    } = usePlotDimensions()

    const {
        seriesObservable,
        windowingTime = 100,
        shouldSubscribe,

        onSubscribe = noop,
        onUpdateData,
        onUpdateChartTime = noop,
    } = useDataObservable<IterateChartData, IterateDatum>()

    const {initialData} = useInitialData<TimeSeriesChartData, IterateDatum>()

    const {visibilityState: tooltipVisible} = useTooltip()

    const {
        interpolation,
        showPoints = true,
        dropDataAfter = 1000,
        panEnabled = false,
        zoomEnabled = false,
        zoomKeyModifiersRequired = true,
        zoomMinScaleFactor = 0,
        zoomMaxScaleFactor = 1,
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
    const dataRef = useRef<Array<IterateSeries>>(initialData.slice() as Array<IterateSeries>)
    const seriesRef = useRef<Map<string, IterateSeries>>(new Map(initialData.map(series => [series.name, series as IterateSeries])))
    // map(axis_id -> current_time) -- maps the axis ID to the current time for that axis
    const currentTimeRef = useRef<number>(0)
    const xAxisRangesRef = useRef<Map<string, ContinuousAxisRange>>(new Map());
    const yAxisRangesRef = useRef<Map<string, ContinuousAxisRange>>(new Map());

    const subscriptionRef = useRef<Subscription>(undefined)
    const isSubscriptionClosed = () => subscriptionRef.current === undefined || subscriptionRef.current.closed

    // eslint-disable-next-line react-hooks/refs
    const allowTooltip = useRef<boolean>(isSubscriptionClosed())

    // so that we can reset the zoom when the axes-bounds change, we hold on to the zoom-behaviour
    // and the zoom-selection so that we can reset the transform to the identity
    const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, Datum>>(undefined)
    const zoomSelectionRef = useRef<d3.Selection<HTMLCanvasElement, Datum, null, undefined>>(undefined)

    // the last-drawn geometry for each series' points, in canvas coordinates, used for
    // hit-testing mouse hover on `mousemove` (see the effect below that wires up the listener).
    // Also keeps the corresponding `IteratePointSeries` so the hovered/neighbor points' data can
    // be looked up by index.
    const geometryRef = useRef<Map<string, SeriesGeometry>>(new Map())
    const plotDataRef = useRef<Map<string, IteratePointSeries>>(new Map())
    // which point (series + index) is currently hovered, so the draw pass can highlight it and
    // its neighbors, and so we know when to fire a "leave"
    const hoveredPointRef = useRef<{seriesName: string, index: number} | undefined>(undefined)

    const updatePlot = useCallback(
        /**
         * (Re-)registers this plot's draw function with the canvas context and requests a redraw.
         *
         * Pan/zoom behavior setup lives in a separate effect (see below), not here -- this
         * function runs on every data tick, and recreating/reattaching a `d3.drag()`/`d3.zoom()`
         * behavior that often is pure overhead unrelated to drawing the new data.
         * @param cc The canvas context to register the draw function with
         */
        (cc: CanvasContext) => {
            onUpdateChartTime(currentTimeRef.current)

            const draw = (context: CanvasContext) => {
                const {context2D} = context

                // create a map associating series-names to their time-series.
                const boundedSeries = new Map<string, IteratePointSeries>(dataRef.current.map(series => {
                    return [
                        series.name,
                        series.data
                            .filter(datum => !isNaN(datum.iterateN))
                            .map((datum, index) => ({
                                    n: datum.iterateN,
                                    n_1: datum.iterateN_1,
                                    time: datum.time,
                                    index: index
                                })
                            ) as IteratePointSeries
                    ]
                }))

                context2D.save()
                clipToArea(context, plotDimensions, {x: margin.left, y: margin.top})
                context2D.translate(margin.left, margin.top)

                // ---
                // todo only want to do this once, on the first plot, and then leave it,
                //     unless the axes are updated, also needs to be removed/added when the
                //     plot size changes
                const xAxis = xAxesState.defaultAxis().getOrThrow(() => new Error('No default axis found')) as ContinuousNumericAxis
                const yAxis = yAxesState.defaultAxis().getOrThrow(() => new Error('No default axis found')) as ContinuousNumericAxis
                // ---

                const [xStart, xEnd] = xAxesState.axisDefaultId()
                    .map(id => xAxisRangesRef.current.get(id)?.original.asTuple() || [0, 0])
                    .getOrElse([0, 0])
                const [yStart, yEnd] = yAxesState.axisDefaultId()
                    .map(id => yAxisRangesRef.current.get(id)?.original.asTuple() || [0, 0])
                    .getOrElse([0, 0])

                // the fn = fn+1 diagonal reference line (no hover behavior, matching the old
                // version's explicitly no-op mouseenter/mouseleave handlers)
                context2D.strokeStyle = "grey"
                context2D.lineWidth = 1
                context2D.beginPath()
                context2D.moveTo(xAxis.scale(xStart), yAxis.scale(yStart))
                context2D.lineTo(xAxis.scale(xEnd), yAxis.scale(yEnd))
                context2D.stroke()

                const newGeometry = new Map<string, SeriesGeometry>()
                const newPlotDataBySeries = new Map<string, IteratePointSeries>()
                const hovered = hoveredPointRef.current

                boundedSeries.forEach((data, name) => {
                    // grab the x and y axes assigned to the series, and if either or both
                    // axes aren't found, then give up and return
                    const [xAxisLinear, yAxisLinear] = axesFor(
                        axisId => xAxesState.axisFor(axisId).getOrUndefined(),
                        axisId => yAxesState.axisFor(axisId).getOrUndefined(),
                    )
                    if (xAxisLinear === undefined || yAxisLinear === undefined) return

                    // grab the style for the series
                    const seriesLineStyle: SeriesLineStyle = seriesStyles.get(name) || {
                        ...defaultLineStyle(),
                        highlightColor: defaultLineStyle().color
                    }

                    // only show the data for which the filter matches
                    const plotData = (name.match(seriesFilter)) ? data : FastShiftArray.empty<IteratePoint>()
                    newPlotDataBySeries.set(name, plotData)

                    // create the time-series path (when no interpolation is given, don't draw a
                    // connecting line at all -- matches the old version's `mainGElem.selectAll(...).remove()`)
                    if (interpolation !== undefined) {
                        const pathGenerator = d3.line<IteratePoint>()
                            .x(d => xAxis.scale(d.n || 0))
                            .y(d => yAxis.scale(d.n_1 || 0))
                            .curve(interpolation)

                        context2D.strokeStyle = seriesLineStyle.color
                        context2D.lineWidth = seriesLineStyle.lineWidth
                        context2D.stroke(new Path2D(pathGenerator(Array.from(plotData)) ?? ""))
                    }

                    // when specified, show a circle for the actual data point
                    const points: Array<[number, number]> = []
                    if (showPoints) {
                        const isThisSeriesHovered = hovered?.seriesName === name

                        plotData.forEach((d: IteratePoint) => {
                            const x = xAxisLinear.scale(d.n) || 0
                            const y = yAxisLinear.scale(d.n_1) || 0
                            points.push([x + margin.left, y + margin.top])

                            const isHoveredPoint = isThisSeriesHovered && hovered!.index === d.index
                            const isNeighborOfHovered = isThisSeriesHovered &&
                                (hovered!.index === d.index - 1 || hovered!.index === d.index + 1)

                            if (isHoveredPoint) {
                                // the hovered point itself: enlarged, highlight-colored, no label
                                // (matches the old version, which only labeled the *neighbors*)
                                context2D.fillStyle = seriesLineStyle.highlightColor
                                context2D.beginPath()
                                context2D.arc(x, y, 5, 0, 2 * Math.PI)
                                context2D.fill()
                            } else if (isNeighborOfHovered) {
                                // a neighbor of the hovered point: enlarged, brighter fill, stroked,
                                // with a floating "n = i; t = X ms" label above it
                                const brighterColor = d3.rgb(seriesLineStyle.highlightColor).brighter(0.7).toString()
                                context2D.fillStyle = brighterColor
                                context2D.strokeStyle = seriesLineStyle.color
                                context2D.lineWidth = seriesLineStyle.lineWidth
                                context2D.beginPath()
                                context2D.arc(x, y, 5, 0, 2 * Math.PI)
                                context2D.fill()
                                context2D.stroke()

                                const label = `n = ${d.index}; t = ${formatTime(d.time)} ms`
                                context2D.font = fontStringFor(11, 'sans-serif', 700)
                                const {width, height} = textDimensions(context2D, label)
                                const padding = 4
                                const circleRadius = 5
                                const circleStroke = seriesLineStyle.lineWidth

                                context2D.fillStyle = backgroundColor
                                context2D.fillRect(
                                    x - padding / 2 - 8,
                                    y - padding / 2 - circleRadius - circleStroke - height,
                                    width + padding,
                                    height + padding / 2
                                )

                                context2D.fillStyle = seriesLineStyle.highlightColor
                                context2D.textAlign = 'left'
                                context2D.textBaseline = 'alphabetic'
                                context2D.fillText(label, x - 8, y - circleRadius - circleStroke - padding)
                            } else {
                                // normal, unhovered point
                                context2D.fillStyle = seriesLineStyle.color
                                context2D.beginPath()
                                context2D.arc(x, y, 2, 0, 2 * Math.PI)
                                context2D.fill()
                            }
                        })
                    }
                    newGeometry.set(`${name}::points`, {points, hitRadius: 6})
                })

                geometryRef.current = newGeometry
                plotDataRef.current = newPlotDataBySeries

                context2D.restore()
            }

            cc.register(`poincare-plot-${chartId}`, draw, 10)
            cc.requestRedraw()
        },
        [
            chartId, onUpdateChartTime, plotDimensions, margin,
            xAxesState, yAxesState,
            seriesStyles, seriesFilter, showPoints,
            interpolation, backgroundColor,
        ]
    )

    // need to keep the function references for use by the subscription, which forms a closure
    // on them. without the references, the closures become stale, and resizing during streaming
    // doesn't work properly
    const updatePlotRef = useRef<(cc: CanvasContext) => void>(updatePlot)
    useEffect(
        () => {
            updatePlotRef.current = updatePlot
        },
        [updatePlot]
    )

    // calculates the distinct axis IDs that cover all the series in the plot
    const xAxesForSeries = useMemo(
        (): Array<string> => xAxesState.axisIds(),
        [xAxesState]
    )
    const yAxesForSeries = useMemo(
        (): Array<string> => yAxesState.axisIds(),
        [yAxesState]
    )

    // when the axes are available, then set the reference, but only once
    useEffect(() => {
        if (xAxesState.axes.size > 0 && xAxisRangesRef.current.size === 0) {
            xAxisRangesRef.current = generateAxisRangeMap(xAxesState.axes)
        }
        if (yAxesState.axes.size > 0 && yAxisRangesRef.current.size === 0) {
            yAxisRangesRef.current = generateAxisRangeMap(yAxesState.axes)
        }
    }, [xAxesState, yAxesState]);

    // update the plot with the new axes bounds
    const updateRangesAndPlot = useCallback(
        (): void => {
            if (canvasContext !== null) {
                updatePlotRef.current(canvasContext)
            }
        },
        [canvasContext]
    )

    // todo find better way
    // when the initial data changes, then reset the plot. note that the initial data doesn't change
    // during the normal course of updates from the observable, only when the plot is restarted.
    useEffect(
        () => {
            dataRef.current = initialData.slice()
            seriesRef.current = new Map(initialData.map(series => [series.name, series]))
            currentTimeRef.current = 0

            updateRangesAndPlot()
        },
        [initialData, updateRangesAndPlot]
    )

    /**
     * When the axes bounds have changed, we need to reset the range references so that
     * the new axis ranges are used
     * @param updates The updates to the axes
     */
    const updatedBoundsHandler = useCallback(
        (updates: Map<string, ContinuousAxisRange>): void => {
            updates.forEach((update, axisId) => {
                if (xAxisRangesRef.current.has(axisId)) {
                    xAxisRangesRef.current.set(axisId, update)
                }
                if (yAxisRangesRef.current.has(axisId)) {
                    yAxisRangesRef.current.set(axisId, update)
                }
            })
            if (zoomEnabled && zoomSelectionRef.current !== undefined && zoomRef.current !== undefined) {
                zoomSelectionRef.current.call(zoomRef.current.transform, d3.zoomIdentity)
            }
        },
        [zoomEnabled]
    )

    // strange construct so that we only add the update handler when the chart ID
    // changes, and not when the addAxesBoundsUpdateHandler or removeAxesBoundsUpdateHandler
    // which they do, and that breaks the updates...someone, please teach me react
    //
    // the update handler is needed so that when the axis bounds are changed (say to accommodate a
    // different iterate function's domain/range), then the handler needs to update the x and y
    // axes range refs
    const addAxesBoundsUpdateHandlerRef = useRef(addAxesRangesUpdateHandler)
    const removeAxesBoundsUpdateHandlerRef = useRef(removeAxesRangesUpdateHandler)
    useEffect(
        () => {
            addAxesBoundsUpdateHandlerRef.current(`handler-${chartId}`, updatedBoundsHandler)
            const removeHandler = removeAxesBoundsUpdateHandlerRef.current
            return () => {
                // closure on the function to remove the handler from this chart
                removeHandler(`handler-${chartId}`)
            }
        },
        [chartId, updatedBoundsHandler]
    );

    /**
     * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
     * @param x The amount that the plot is dragged
     * @param y The amount that the plot is dragged in y
     * @param plotDimensions The dimensions of the plot
     * @param series An array of series names
     * @param xRanges A map holding the axis ID and its associated time range
     * @param yRanges A map holding the axis ID and its associated time range
     */
    const onPan = useCallback(
        (
            x: number,
            y: number,
            plotDimensions: Dimensions,
            series: Array<string>,
            xRanges: Map<string, ContinuousAxisRange>,
            yRanges: Map<string, ContinuousAxisRange>,
        ) => panHandler2D(
            xAxesForSeries, yAxesForSeries,
            margin,
            setAxisIntervalFor,
            xAxesState, yAxesState
        )(x, y, plotDimensions, series, xRanges, yRanges),
        [xAxesForSeries, yAxesForSeries, margin, setAxisIntervalFor, xAxesState, yAxesState]
    )

    /**
     * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
     * at the location of the mouse when the scroll wheel or gesture was applied. Unlike time-series
     * plots, the iterates plot zooms the x- and y-axis at the same rate.
     * @param transform The d3 zoom transformation information
     * @param x The x-position of the mouse when the scroll wheel or gesture is used
     * @param y The y-position of the mouse when the scroll wheel or gesture is used
     * @param plotDimensions The dimensions of the plot
     * @param xRanges A map holding the axis ID and its associated time-range
     * @param yRanges A map holding the axis ID and its associated time-range
     */
    const onZoom = useCallback(
        (
            transform: ZoomTransform,
            x: number,
            y: number,
            plotDimensions: Dimensions,
            xRanges: Map<string, ContinuousAxisRange>,
            yRanges: Map<string, ContinuousAxisRange>
        ) => axesZoomHandler(
            xAxesForSeries, yAxesForSeries, margin, setAxisIntervalFor, xAxesState, yAxesState, [zoomMinScaleFactor, zoomMaxScaleFactor]
        )(transform, [x, y], plotDimensions, xRanges, yRanges),
        [xAxesForSeries, yAxesForSeries, margin, setAxisIntervalFor, xAxesState, yAxesState, zoomMinScaleFactor, zoomMaxScaleFactor]
    )

    // sets up panning and zooming exactly once (and again only when something pan/zoom-relevant
    // actually changes -- e.g. a resize), rather than on every data tick. This used to live inside
    // `updatePlot`, which runs on every data tick; recreating a `d3.drag()`/`d3.zoom()` behavior
    // and reattaching it to the canvas that often was pure overhead unrelated to drawing the new
    // data, and the constant allocation churn is a plausible contributor to the plot getting
    // choppier the longer a stream runs.
    useEffect(
        () => {
            if (!canvasContext) return
            const cc = canvasContext
            const canvasSelection = d3.select<HTMLCanvasElement, Datum>(cc.canvas)

            if (panEnabled) {
                const drag = d3.drag<HTMLCanvasElement, Datum>()
                    .on("start", () => {
                        canvasSelection.style("cursor", "move")
                        // during panning, we need to disable viewing the tooltip to prevent
                        // tooltips from rendering but not getting removed
                        allowTooltip.current = false;
                    })
                    .on("drag", event => {
                        onPan(
                            event.dx,
                            event.dy,
                            plotDimensions,
                            dataRef.current.map(series => series.name),
                            xAxisRangesRef.current,
                            yAxisRangesRef.current
                        )
                        updatePlotRef.current(cc)
                    })
                    .on("end", () => {
                        canvasSelection.style("cursor", "auto")
                        // during panning, we disabled viewing the tooltip to prevent
                        // tooltips from rendering but not getting removed, now that panning
                        // is over, allow tooltips to render again
                        allowTooltip.current = isSubscriptionClosed();
                    })

                canvasSelection.call(drag)
            }

            if (zoomEnabled) {
                zoomRef.current = d3.zoom<HTMLCanvasElement, Datum>()
                    .filter(event => !zoomKeyModifiersRequired || event.shiftKey || event.ctrlKey)
                    .scaleExtent([zoomMinScaleFactor, zoomMaxScaleFactor])
                    .translateExtent([[margin.left, margin.top], [plotDimensions.width, plotDimensions.height]])
                    .on("zoom", event => {
                            allowTooltip.current = false
                            if (event.sourceEvent !== null) {
                                onZoom(
                                    event.transform,
                                    event.sourceEvent.offsetX - margin.left,
                                    event.sourceEvent.offsetY - margin.top,
                                    plotDimensions,
                                    xAxisRangesRef.current,
                                    yAxisRangesRef.current
                                )
                                updatePlotRef.current(cc)
                            }
                            allowTooltip.current = true
                        }
                    )

                zoomSelectionRef.current = canvasSelection.call(zoomRef.current)
            }

            return () => {
                if (panEnabled) canvasSelection.on(".drag", null)
                if (zoomEnabled) {
                    canvasSelection.on(".zoom", null)
                    zoomRef.current = undefined
                    zoomSelectionRef.current = undefined
                }
            }
        },
        [
            canvasContext, panEnabled, zoomEnabled, onPan, onZoom, plotDimensions, margin,
            zoomKeyModifiersRequired, zoomMinScaleFactor, zoomMaxScaleFactor
        ]
    )

    const onUpdateAxesBoundsRef = useRef(updateAxisRanges)
    useEffect(
        () => {
            onUpdateAxesBoundsRef.current = updateAxisRanges
        },
        [updateAxisRanges]
    )

    // memoized function for subscribing to the chart-data observable
    const subscribe = useCallback(
        () => {
            if (seriesObservable === undefined || canvasContext === null) return undefined
            return subscriptionIteratesFor(
                seriesObservable as Observable<IterateChartData>,
                onSubscribe,
                windowingTime,
                xAxesState,
                yAxesState,
                onUpdateData,
                dropDataAfter,
                updateRangesAndPlot,
                // as new data flows into the subscription, the subscription
                // updates this map directly (for performance)
                seriesRef.current,
                end => currentTimeRef.current = end
            )
        },
        [
            dropDataAfter, canvasContext,
            onSubscribe, onUpdateData,
            seriesObservable, updateRangesAndPlot, windowingTime,
            xAxesState, yAxesState,
        ]
    )

    // updates the plot when the interpolation and filter change, because the updatePlot
    // callback has changed.
    useEffect(
        () => {
            if (canvasContext) {
                updatePlot(canvasContext)
            }
        },
        [axisRangeFor, canvasContext, updatePlot]
    )

    // wires up a single mousemove/mouseleave listener on the shared canvas to replace the old
    // per-element SVG mouseenter/mouseleave handlers on the point circles. Hit-tests the mouse
    // position against the last-drawn point geometry (see `geometryRef`, populated by the draw
    // function above).
    useEffect(
        () => {
            if (!canvasContext) return

            const canvas = canvasContext.canvas

            const handleMove = (event: MouseEvent) => {
                if (!allowTooltip.current || !tooltipVisible) return

                const [x, y] = canvasLocalPoint(event, canvas)
                const hit = seriesAt(x, y, geometryRef.current)
                const hitSeriesName = hit?.name.replace(/::points$/, '')

                const previous = hoveredPointRef.current
                const sameAsBefore = previous !== undefined && hit !== undefined &&
                    previous.seriesName === hitSeriesName && previous.index === hit.index

                if (sameAsBefore) return

                if (previous !== undefined) {
                    handleMouseLeavePoint(previous.seriesName, mouseLeaveHandlerFor(`tooltip-${chartId}`))
                }

                if (hit !== undefined && hitSeriesName !== undefined) {
                    const plotData = plotDataRef.current.get(hitSeriesName)
                    if (plotData !== undefined) {
                        handleMouseEnterPoint(
                            hitSeriesName,
                            plotData[hit.index],
                            plotData,
                            [x, y],
                            mouseOverHandlerFor(`tooltip-${chartId}`)
                        )
                    }
                }

                hoveredPointRef.current = hit !== undefined && hitSeriesName !== undefined ?
                    {seriesName: hitSeriesName, index: hit.index} :
                    undefined

                // hover state affects the highlight/label drawing, so request a redraw
                canvasContext.requestRedraw()
            }

            const handleLeaveCanvas = () => {
                const previous = hoveredPointRef.current
                if (previous !== undefined) {
                    handleMouseLeavePoint(previous.seriesName, mouseLeaveHandlerFor(`tooltip-${chartId}`))
                    hoveredPointRef.current = undefined
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
        [canvasContext, chartId, mouseOverHandlerFor, mouseLeaveHandlerFor, tooltipVisible]
    )

    // subscribe/unsubscribe to the observable chart data. when the `shouldSubscribe`
    // is changed to `true` and we haven't subscribed yet, then subscribe. when the
    // `shouldSubscribe` is `false` and we had subscribed, then unsubscribe. otherwise,
    // do nothing.
    useEffect(
        () => {
            if (shouldSubscribe && subscriptionRef.current === undefined) {
                subscriptionRef.current = subscribe()
                allowTooltip.current = false
            } else if (!shouldSubscribe && subscriptionRef.current !== undefined) {
                subscriptionRef.current?.unsubscribe()
                subscriptionRef.current = undefined
                allowTooltip.current = true
            }
        },
        [shouldSubscribe, subscribe]
    )

    // unregister this plot's draw function on unmount
    useEffect(
        () => {
            return () => {
                if (canvasContext) {
                    canvasContext.unregister(`poincare-plot-${chartId}`)
                }
            }
        },
        [canvasContext, chartId]
    )

    return null
}

/**
 * Attempts to locate the x- and y-axes for the specified series. If no axis is found for the
 * series name, then uses the default returned by the useChart() hook
 * @param xAxisFor The function that accepts an axis ID and returns the corresponding x-axis
 * @param yAxisFor The function that accepts an axis ID and returns the corresponding y-axis
 */
function axesFor(
    xAxisFor: (id: string) => BaseAxis | undefined,
    yAxisFor: (id: string) => BaseAxis | undefined,
): [xAxis: ContinuousNumericAxis, yAxis: ContinuousNumericAxis] {
    const xAxis = xAxisFor("")
    const xAxisLinear = xAxis as ContinuousNumericAxis
    const yAxis = yAxisFor("")
    const yAxisLinear = yAxis as ContinuousNumericAxis
    if (xAxis && !xAxisLinear) {
        throw Error("Poincare plot requires that x-axis be of type LinearAxis")
    }
    if (yAxis && !yAxisLinear) {
        throw Error("Poincare plot requires that y-axis be of type LinearAxis")
    }
    return [xAxisLinear, yAxisLinear]
}

/**
 * Reports the tooltip for the hovered point. Replaces the old version, which also directly
 * mutated the hovered SVG `<circle>`'s radius/fill (and its neighbors') as a side effect; that
 * highlighting is now handled entirely by the draw function reading `hoveredPointRef` (see
 * `updatePlot`'s `draw`) rather than by touching elements here.
 * @param seriesName The name of the series (i.e. the neuron ID)
 * @param datum The hovered point, or `undefined` if the index doesn't resolve to a point
 * @param plotData The iterates series
 * @param mouseCoords The `[x, y]` position of the mouse, in canvas coordinates
 * @param mouseOverHandlerFor The handler for the mouse-over (registered by the <Tooltip/>)
 */
function handleMouseEnterPoint(
    seriesName: string,
    datum: IteratePoint | undefined,
    plotData: IteratePointSeries,
    mouseCoords: [x: number, y: number],
    mouseOverHandlerFor: ((seriesName: string, time: number, tooltipData: TooltipData<IterateDatum, NoTooltipMetadata>, mouseCoords: [x: number, y: number]) => void) | undefined,
): void {
    if (datum === undefined) return

    if (mouseOverHandlerFor) {
        mouseOverHandlerFor(
            seriesName,
            datum.time,
            {series: plotData.map(ip => ({iterateN: ip.n, iterateN_1: ip.n_1, time: ip.time})), metadata: {}},
            mouseCoords
        )
    }
}

function handleMouseLeavePoint(
    seriesName: string,
    mouseLeaverHandlerFor: ((seriesName: string) => void) | undefined,
): void {
    if (mouseLeaverHandlerFor) {
        mouseLeaverHandlerFor(seriesName)
    }
}
