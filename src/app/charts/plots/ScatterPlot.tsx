import {useCallback, useEffect, useMemo, useRef} from 'react'
import {type NoTooltipMetadata, useChart} from "../hooks/useChart";
import * as d3 from "d3";
import {type D3ZoomEvent, ZoomTransform} from "d3";
import {type AxesAssignment, clipToArea, currentIntervalsFrom, type Series} from "./plot";
import type {Datum, TimeSeries} from "../series/timeSeries";
import {
    axesForSeriesGen,
    type BaseAxis,
    continuousAxisIntervals,
    continuousAxisRanges,
    continuousAxisZoomHandler,
    type ContinuousNumericAxis,
    defaultLineStyle,
    panHandler,
    type SeriesLineStyle
} from "../axes/axes";
import type {CanvasContext} from "../d3types";
import {seriesAt, canvasLocalPoint, type SeriesGeometry} from "./hitTesting";
import {Observable, Subscription} from "rxjs";
import {firstIndexAtOrAfter, noop} from "../utils";
import type {Dimensions, Margin} from "../styling/margins";
import {
    subscriptionTimeSeriesFor,
    subscriptionTimeSeriesWithCadenceFor,
    TimeWindowBehavior
} from "../subscriptions/subscriptions";
import {useDataObservable} from "../hooks/useDataObservable";
import type {TimeSeriesChartData} from "../series/timeSeriesChartData";
import {useInitialData} from "../hooks/useInitialData";
import type {TooltipData} from "../hooks/useTooltip";
import {Optional} from "result-fn";
import {ContinuousAxisRange} from "../axes/ContinuousAxisRange";
import {usePlotDimensions} from "../hooks/usePlotDimensions";
import type {FastShiftArray} from "fast-shift-array";

export interface Props {
    /**
     * Holds the mapping between a series and the axis it uses (is assigned). The
     * map's key holds the series name, and the value is an {@link AxesAssignment}
     * object holding the ID of the assigned x-axis and y-axis.
     */
    axisAssignments?: Map<string, AxesAssignment>
    /**
     * The line interpolation curve factory. See the d3 documentation for curves at
     * {@link https://github.com/d3/d3-shape#curves} for information on available interpolations
     */
    interpolation?: d3.CurveFactory
    /**
     * The number of milliseconds of data to hold in memory before dropping it. Defaults to
     * infinity (i.e., no data is dropped)
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
     * When set, uses a cadence with the specified refresh period (in milliseconds). For plots
     * where the updates are slow (> 100 ms) using a cadence of 10 to 25 ms smooths out the
     * updates and makes the plot updates look cleaner. When updates are around 25 ms or less,
     * then setting the cadence period too small will result in poor update performance. Generally
     * at high update speeds, the cadence is unnecessary. Finally, using cadence, sets the max time
     * to the current time.
     */
    withCadenceOf?: number
    /**
     * The time window behavior for the plot. There are two options: `SCROLL` and `SQUEEZE`.
     * <ol>
     *     <li>
     *         <b>SCROLL</b> will scroll the plot window as new data is added whose time
     *         exceeds the time window.
     *     </li>
     *     <li>
     *         <b>SQUEEZE</b> will compress the time-axes when new data is added whose time
     *         exceeds the time window.
     *     </li>
     * </ol>
     * The default behavior is to `SCROLL`.
     */
    timeWindowBehavior?: TimeWindowBehavior
    /**
     * Radius (px) of the circle marker drawn at each datum. When omitted or `undefined`,
     * no markers are rendered.
     */
    markerRadius?: number

    /**
     * Commonly used when the parent holds the subscription. A common use-case for this
     * is when the application would like to keep a chart running even when a user navigates
     * away from the page. In this use case, the subscription is stored at the application
     * level (see the {@link Chart} prop `onSubscribe`) and handed back to the page
     * containing this chart when the user navigates back.
     */
    subscription?: Subscription
}

/**
 * Renders a streaming scatter plot for the series in the initial data and those sourced by the
 * observable specified as a property in the {@link Chart}. This component uses the {@link useChart}
 * hook, and therefore must be a child of the {@link Chart} in order to be plugged in to the
 * chart ecosystem (axes, tracker, tooltip).
 *
 * Internally, this no longer creates/updates SVG `<path>`/`<circle>` elements. Instead, it
 * registers a single draw function with the chart's {@link CanvasContext} that redraws every
 * series from scratch each time the canvas repaints. Mouse hover (for the tooltip) is handled by
 * hit-testing the mouse position against the last-drawn series geometry (see `hitTesting.ts`) on a
 * `mousemove` listener attached directly to the canvas, since canvas has no per-shape events.
 *
 * @param props The properties associated with the scatter plot
 * @example
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
 */
export function ScatterPlot(props: Props): null {
    const {
        chartId,
        canvasContext,
        axes,
        color,
        seriesStyles,
        seriesFilter,
        mouse,
        hoveredSeriesName,
    } = useChart<Datum, SeriesLineStyle, NoTooltipMetadata, ContinuousAxisRange, ContinuousNumericAxis>()

    const {
        initialData
    } = useInitialData<TimeSeriesChartData, Datum>()

    const {
        xAxesState,
        yAxesState,
        setAxisIntervalFor,
        updateAxisRanges = noop,
        onUpdateAxesInterval,
        axesRanges,
    } = axes

    const {mouseOverHandlerFor, mouseLeaveHandlerFor} = mouse

    const {plotDimensions, margin} = usePlotDimensions()

    const {
        seriesObservable,
        windowingTime = 100,
        shouldSubscribe,

        onSubscribe = noop,
        onUpdateData,
    } = useDataObservable()

    const {
        axisAssignments = new Map<string, AxesAssignment>(),
        interpolation = d3.curveLinear,
        dropDataAfter = Infinity,
        panEnabled = false,
        zoomEnabled = false,
        zoomKeyModifiersRequired = true,
        withCadenceOf,
        timeWindowBehavior = TimeWindowBehavior.SCROLL,
        markerRadius,
        subscription = undefined,
    } = props

    const initialTimes = useMemo(
        () => {
            return new Map<string, number>(
                Array.from<[string, ContinuousAxisRange]>(axesRanges().entries())
                    .map(([axisId, range]) => ([axisId, range.original.start]))
            )
        },
        [axesRanges]
    )

    // why do "dataRef" and "seriesRef" both hold on to the same underlying data? for performance.
    //
    // the "dataRef" and "seriesRef" both point to the same underlying data, a collection
    // of series. The series in "dataRef" are bound to the DOM elements through d3. The "seriesRef"
    // series are the ones that are updated as new data is streamed in.
    //
    // the "dataRef" object holds on to a copy of the initial data (which is an array of
    // time-series, e.i. an array of BaseSeries<Datum> objects). The slice just creates a copy of
    // the array, but the references to the BaseSeries objects are the same and still point to the same
    // data as the "initialData" array.
    //
    // the "seriesRef" object is a reference to a map (series_name -> BaseSeries<OrdinalDatum>) which is
    // used to update the data in the series. When new data enters, it is appended to one or more series.
    //
    // the series in the "dataRef" object are the ones read by the canvas draw function, and so as
    // these are updated, the new data is picked up the next time the canvas redraws.
    const dataRef = useRef<Array<TimeSeries>>(initialData.slice() as Array<TimeSeries>)
    const seriesRef = useRef<Map<string, TimeSeries>>(new Map(initialData.map(series => [series.name, series as TimeSeries])))
    // map(axis_id -> current_time) -- maps the axis ID to the current time for that axis
    const currentTimeRef = useRef<Map<string, number>>(new Map())

    // the last-drawn geometry for each series, in canvas coordinates, used for hit-testing mouse
    // hover on `mousemove` (see the effect below that wires up the listener)
    const geometryRef = useRef<Map<string, SeriesGeometry>>(new Map())
    // the name of the series the mouse was over on the previous `mousemove`, so we know when to
    // fire a "leave" for the old series before firing an "over" for the new one
    const lastHoveredRef = useRef<string | undefined>(undefined)

    const subscriptionRef = useRef<Subscription>(subscription)
    const isSubscriptionClosed = () => subscriptionRef.current === undefined || subscriptionRef.current.closed

    const allowTooltip = useRef<boolean>(subscription === undefined || subscription.closed)

    // whether this component instance created its own subscription (as opposed to one handed
    // in, and therefore owned, by the parent). only a self-created subscription should be torn
    // down when this component unmounts -- a parent-owned subscription is expected to keep
    // running so that it can be handed back in when the user navigates back to this chart.
    const ownsSubscriptionRef = useRef<boolean>(subscription === undefined)

    useEffect(
        () => {
            currentTimeRef.current = new Map(Array.from<string>(xAxesState.axes.keys()).map(id => [id, 0]))
        },
        [xAxesState]
    )

    // calculates the distinct series IDs that cover all the series in the plot
    const axesForSeries = useMemo(
        (): Array<string> => axesForSeriesGen<Datum, ContinuousNumericAxis>(initialData, axisAssignments, xAxesState),
        [initialData, axisAssignments, xAxesState]
    )

    // updates the timing using the onUpdateTime and updatePlot references. This and the references
    // defined above allow the axes' times to be updated properly by avoid stale reference to these
    // functions.
    const updateTimingAndPlot = useCallback((ranges: Map<string, ContinuousAxisRange>): void => {
            if (canvasContext !== null) {
                onUpdateTimeRef.current(ranges)
                updatePlotRef.current(canvasContext)
                // the notification is deferred to the next animation frame (see `notifyIntervalsRef`),
                // so that this doesn't update the application state synchronously from within the
                // subscription's update
                notifyIntervalsRef.current(ranges)
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
            currentTimeRef.current = new Map(Array.from<string>(xAxesState.axes.keys()).map(id => [id, 0]))
            updateTimingAndPlot(new Map(Array.from(continuousAxisRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>).entries())
                    .map(([id, range]) => {
                        // grab the current range, then calculate the minimum time from the initial data, and
                        // set that as the start, and then add the range to it for the end time
                        const [start, end] = range.original.asTuple()
                        const minTime = initialData
                            .filter(srs => axisAssignments.get(srs.name)?.xAxis === id)
                            .reduce(
                                (tMin, series) => Math.min(
                                    tMin,
                                    !series.isEmpty() ? series.data[0].x : tMin
                                ),
                                Infinity
                            )
                        const startTime = minTime === Infinity ? 0 : minTime
                        return [id, ContinuousAxisRange.from(startTime, startTime + end - start)]
                    })
                )
            )
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
     * @param ranges A map holding the axis ID and its associated time range
     */
    const onPan = useCallback(
        (x: number,
         plotDimensions: Dimensions,
         ranges: Map<string, ContinuousAxisRange>,
        ) => panHandler(axesForSeries, margin, setAxisIntervalFor, xAxesState)(x, plotDimensions, ranges),
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
            ranges: Map<string, ContinuousAxisRange>,
        ) => continuousAxisZoomHandler(axesForSeries, margin, setAxisIntervalFor, xAxesState)(transform, x, plotDimensions, ranges),
        [axesForSeries, margin, setAxisIntervalFor, xAxesState]
    )

    const updatePlot = useCallback(
        /**
         * (Re-)registers this plot's draw function with the canvas context and requests a redraw.
         * Replaces the old version, which directly mutated SVG `<path>`/`<circle>` elements bound
         * via d3's enter/update/exit join. Canvas has no persistent elements to join against, so
         * the draw function just redraws every series from its current data/scale state each time
         * it's invoked -- there's no separate "update" case to handle.
         *
         * Pan/zoom behavior setup lives in a separate effect (see below), not here -- this
         * function runs on every data tick (each `windowingTime` interval), and recreating/
         * reattaching a `d3.drag()`/`d3.zoom()` behavior that often is pure overhead with no
         * benefit, since panEnabled/zoomEnabled/plotDimensions/margin change far less often than
         * the data does.
         * @param cc The canvas context to register the draw function with
         */
        (cc: CanvasContext) => {
            const draw = (context: CanvasContext) => {
                // const __drawStart = performance.now()
                // let __totalRetained = 0
                // let __totalProcessed = 0
                const {context2D} = context

                // create a map associating series-names with their time-series.
                //
                // performance-related confusion: wondering where the dataRef is updated? well, it isn't
                // updated directly. The dataRef holds on to an array of references to the Series. And so does the
                // seriesRef, though it uses a map(series_name -> series). The seriesRef is use to append
                // data to the underlying Series, and the dataRef is used so that we can just use
                // dataRef.current and don't have to do Array.from(seriesRef.current.values()) which
                // creates a temporary array
                const boundedSeries = new Map<string, FastShiftArray<Datum>>(dataRef.current.map(series => [
                    series.name,
                    series.data
                ]))

                context2D.save()
                clipToArea(context, plotDimensions, {x: margin.left, y: margin.top})
                context2D.translate(margin.left, margin.top)

                const newGeometry = new Map<string, SeriesGeometry>()

                boundedSeries.forEach((data, name) => {
                    // grab the x and y axes assigned to the series, and if either or both
                    // axes aren't found, then give up and return
                    const [xAxisLinear, yAxisLinear] = axesFor(
                        name,
                        axisAssignments,
                        axisId => xAxesState.axisFor(axisId).getOrUndefined(),
                        axisId => yAxesState.axisFor(axisId).getOrUndefined()
                    )
                    if (xAxisLinear === undefined || yAxisLinear === undefined) return

                    // grab the style for the series
                    const {
                        color: seriesColor,
                        lineWidth,
                        highlightColor,
                        highlightWidth
                    } = seriesStyles.get(name) || defaultLineStyle()

                    // only show the data for which the filter matches
                    const plotData = (name.match(seriesFilter)) ? data : []
                    const isHovered = hoveredSeriesName === name

                    // build the on-screen points, dropping data in the x-axis that is out of the
                    // chart bounds (mirrors the old lineGenerator's `.defined(...)`)
                    type ScreenPoint = [x: number, y: number]
                    // skip the expensive per-point work below for retained-but-off-screen data:
                    // `plotData` can hold far more history than is ever visible (dropDataAfter is
                    // independent of, and often much larger than, the axis's current scrolling
                    // window), so iterating the *full* retained array every frame does a lot of
                    // work whose result is immediately thrown away as off-screen. Binary-search
                    // for where the visible domain begins, and only process from there on --
                    // backing up by one point so a line entering from off-screen still renders
                    // correctly across the boundary.
                    const [domainStart] = xAxisLinear.scale.domain()
                    const startIndex = Math.max(0, firstIndexAtOrAfter(plotData, domainStart, (d: Datum) => d.x) - 1)
                    // __totalRetained += plotData.length
                    // __totalProcessed += Math.max(0, plotData.length - startIndex)

                    const showMarkers = markerRadius != null && markerRadius >= 0 && !shouldSubscribe
                    const markerRadiusResolved = isHovered ? markerRadius! + 2 : markerRadius!

                    const segments: Array<Array<ScreenPoint>> = []
                    let currentSegment: Array<ScreenPoint> = []
                    const screenPoints: Array<[number, number]> = []

                    context2D.fillStyle = isHovered ? highlightColor : seriesColor
                    for (let i = startIndex; i < plotData.length; i++) {
                        const d = plotData[i]
                        const x = xAxisLinear.scale(d.x)
                        const y = yAxisLinear.scale(d.y)

                        // record geometry (outer/canvas coordinate space, margin baked in) for
                        // mousemove hit-testing, regardless of on/off-screen -- a point just past
                        // the edge should still be hoverable at the boundary
                        screenPoints.push([x + margin.left, y + margin.top])

                        if (x < 0 || x > plotDimensions.width) {
                            if (currentSegment.length > 0) {
                                segments.push(currentSegment)
                                currentSegment = []
                            }
                            continue
                        }

                        currentSegment.push([x, y])

                        // point markers (one circle per datum) -- suppressed while streaming
                        // because redrawing many circles every frame is more work than a single
                        // line path
                        if (showMarkers) {
                            context2D.beginPath()
                            context2D.arc(x, y, markerRadiusResolved, 0, 2 * Math.PI)
                            context2D.fill()
                        }
                    }
                    if (currentSegment.length > 0) segments.push(currentSegment)

                    // draw the series line (interpolation is applied via a Path2D built through a
                    // d3 line generator so that custom curve factories -- e.g. curveBasis,
                    // curveStep -- keep working exactly as they did with the SVG path)
                    context2D.strokeStyle = isHovered ? highlightColor : seriesColor
                    context2D.lineWidth = isHovered ? highlightWidth : lineWidth
                    segments.forEach(segment => {
                        const path = new Path2D(
                            d3.line().curve(interpolation)(segment) ?? ""
                        )
                        context2D.stroke(path)
                    })

                    newGeometry.set(name, {
                        points: screenPoints,
                        asLine: true,
                        hitRadius: Math.max(6, (isHovered ? highlightWidth : lineWidth) + 4)
                    })
                    if (showMarkers) {
                        // markers get their own, generously-sized hit target keyed under a
                        // derived name so a marker hover can be distinguished from a line hover
                        // if the caller ever wants to (currently treated the same on mousemove)
                        newGeometry.set(`${name}-markers`, {
                            points: screenPoints,
                            hitRadius: markerRadiusResolved + 3
                        })
                    }
                })

                geometryRef.current = newGeometry
                // const __drawMs = performance.now() - __drawStart
                // if (!(window as any).__drawStats) (window as any).__drawStats = {count: 0, totalMs: 0, maxMs: 0}
                // const stats = (window as any).__drawStats
                // stats.count++
                // stats.totalMs += __drawMs
                // stats.maxMs = Math.max(stats.maxMs, __drawMs)
                // if (stats.count % 50 === 0) {
                //     console.log(
                //         `draw#${stats.count} thisFrame=${__drawMs.toFixed(2)}ms avg=${(stats.totalMs / stats.count).toFixed(2)}ms max=${stats.maxMs.toFixed(2)}ms ` +
                //         `retained=${__totalRetained} processed=${__totalProcessed}`
                //     )
                //     stats.maxMs = 0 // reset max so it reflects the last 50 frames, not the all-time peak
                // }
                context2D.restore()
            }

            cc.register(`scatter-plot-${chartId}`, draw, 10)
            cc.requestRedraw()
        },
        [
            chartId, plotDimensions, margin,
            axisAssignments,
            xAxesState, yAxesState,
            seriesStyles, seriesFilter, interpolation,
            hoveredSeriesName, markerRadius, shouldSubscribe
        ]
    )

    // sets up panning and zooming exactly once (and again only when something pan/zoom-relevant
    // actually changes -- e.g. a resize), rather than on every data tick. This used to live inside
    // `updatePlot`, which runs every `windowingTime` interval; recreating a `d3.drag()`/`d3.zoom()`
    // behavior and reattaching it to the canvas that often was pure overhead unrelated to drawing
    // the new data, and the constant allocation churn is a plausible contributor to the plot
    // getting choppier the longer a stream runs.
    useEffect(
        () => {
            if (!canvasContext) return
            const cc = canvasContext
            const canvasSelection = d3.select<HTMLCanvasElement, unknown>(cc.canvas)

            if (panEnabled) {
                const drag = d3.drag<HTMLCanvasElement, unknown>()
                    .on("start", () => {
                        canvasSelection.style("cursor", "move")
                        // during panning, we need to disable viewing the tooltip to prevent
                        // tooltips from rendering but not getting removed
                        allowTooltip.current = false;
                    })
                    .on("drag", (event) => {
                        onPan(
                            event.dx,
                            plotDimensions,
                            timeRangesRef.current,
                        )
                        updatePlotRef.current(cc)
                        // the pan updated the axes' ranges in place, so report the new intervals
                        notifyIntervalsRef.current(timeRangesRef.current)
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
                const zoom = d3.zoom<HTMLCanvasElement, unknown>()
                    .filter(event => !zoomKeyModifiersRequired || event.shiftKey || event.ctrlKey)
                    .scaleExtent([0, 10])
                    .translateExtent([[margin.left, margin.top], [plotDimensions.width, plotDimensions.height]])
                    .on("zoom", (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
                            onZoom(
                                event.transform,
                                event.sourceEvent.offsetX - margin.left,
                                plotDimensions,
                                timeRangesRef.current,
                            )
                            updatePlotRef.current(cc)
                            // the zoom updated the axes' ranges in place, so report the new intervals
                            notifyIntervalsRef.current(timeRangesRef.current)
                        }
                    )

                canvasSelection.call(zoom)
            }

            // detach the drag/zoom behaviors' listeners when this effect re-runs (e.g. on
            // resize) or unmounts, rather than relying solely on the next .call(...) to replace
            // them under the hood
            return () => {
                if (panEnabled) canvasSelection.on(".drag", null)
                if (zoomEnabled) canvasSelection.on(".zoom", null)
            }
        },
        [canvasContext, panEnabled, zoomEnabled, onPan, onZoom, plotDimensions, margin, zoomKeyModifiersRequired]
    )

    // need to keep the function references for use by the subscription, which forms a closure
    // on them. without the references, the closures become stale, and resizing during streaming
    // doesn't work properly
    const updatePlotRef = useRef<(cc: CanvasContext) => void>(noop)
    useEffect(
        () => {
            // eslint-disable-next-line react-hooks/immutability
            updatePlotRef.current = updatePlot
        },
        [updatePlot]
    )
    const onUpdateTimeRef = useRef(updateAxisRanges)
    useEffect(
        () => {
            // eslint-disable-next-line react-hooks/immutability
            onUpdateTimeRef.current = updateAxisRanges
        },
        [updateAxisRanges]
    )

    // reports the axes' intervals to the code using the chart. this is held in a reference for the
    // same reason as the functions above -- the zoom and pan handlers are created inside the memoized
    // `updatePlot` and would otherwise close over a stale callback.
    //
    // the notifications are coalesced into (at most) one per animation frame because zoom and pan
    // fire many events per gesture, and the callback generally updates the application state, which
    // in turn causes a render. note that coalescing loses nothing: the zoom and pan handlers mutate
    // the ranges map in place, so the deferred notification reads the map when the frame runs and
    // always reports the most recent intervals, rather than those of the event that scheduled it.
    const notifyIntervalsRef = useRef<(ranges: Map<string, ContinuousAxisRange>) => void>(noop)
    const notifyFrameRef = useRef<number>(0)
    useEffect(
        () => {
            // eslint-disable-next-line react-hooks/immutability
            notifyIntervalsRef.current = onUpdateAxesInterval === undefined ?
                noop :
                ranges => {
                    // a notification is already scheduled for the next frame, and it will pick up
                    // these intervals when it runs
                    if (notifyFrameRef.current !== 0) return
                    notifyFrameRef.current = requestAnimationFrame(() => {
                        notifyFrameRef.current = 0
                        onUpdateAxesInterval(currentIntervalsFrom(ranges))
                    })
                }
        },
        [onUpdateAxesInterval]
    )
    // don't leave a scheduled notification pointing at an unmounted plot
    useEffect(
        () => () => {
            if (notifyFrameRef.current !== 0) {
                cancelAnimationFrame(notifyFrameRef.current)
                notifyFrameRef.current = 0
            }
        },
        []
    )

    const timeRangesRef = useRef<Map<string, ContinuousAxisRange>>(new Map())
    useEffect(
        () => {
            if (canvasContext) {
                // so this gets a bit complicated. the time-ranges need to be updated whenever the time-ranges
                // change. for example, as data is streamed in, the times change, and then we need to update the
                // time-range. however, we want to keep the time-ranges to reflect their original scale so that
                // we can zoom properly (so the updates can't fuck with the scale). At the same time, when the
                // interpolation changes, then the update plot changes, and the time-ranges must maintain their
                // original scale as well.
                if (timeRangesRef.current.size === 0) {
                    // when no time-ranges have yet been created, then create them and populate the
                    // existing ref's map in place (rather than replacing it -- reassigning `.current`
                    // after it's already been read above isn't allowed by react-hooks/immutability)
                    continuousAxisRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)
                        .forEach((range, id) => timeRangesRef.current.set(id, range))
                } else {
                    // when the time-ranges already exist, then we want to update the time-ranges for each
                    // existing time-range in a way that maintains the original scale.
                    const intervals = continuousAxisIntervals(xAxesState.axes)
                    timeRangesRef.current
                        .forEach((range, id, rangesMap) => {
                            const [start, end] = Optional.ofNullable(intervals.get(id))
                                .map(interval => interval.asTuple())
                                .getOrThrow(() => new Error(`Unable to retrieve interval for axis; axis_id: ${id}`))
                            if (!isNaN(start) && !isNaN(end)) {
                                // update the reference map with the new (start, end) portion of the range,
                                // while keeping the original scale intact
                                rangesMap.set(id, range.update(start, end))
                            }
                        })
                }
                updatePlot(canvasContext)
            }
        },
        [chartId, color, canvasContext, plotDimensions, updatePlot, xAxesState]
    )

    // wires up a single mousemove/mouseleave listener on the shared canvas to replace the old
    // per-element SVG mouseover/mouseleave handlers. Hit-tests the mouse position against the
    // last-drawn geometry (see `geometryRef`, populated by the draw function above).
    useEffect(
        () => {
            if (!canvasContext) return

            const canvas = canvasContext.canvas

            const handleMove = (event: MouseEvent) => {
                if (!allowTooltip.current) return

                const [x, y] = canvasLocalPoint(event, canvas)
                const hit = seriesAt(x, y, geometryRef.current)
                // markers are recorded under a "<name>-markers" key; normalize back to the
                // underlying series name so callers only ever see the real series name.
                // NOTE: `hit?.name.endsWith(...)` here would be unsafe -- `?.` only protects the
                // `.name` access, not the chained `.endsWith(...)` call, so it would throw a
                // TypeError on every mousemove where `hit` is undefined (i.e. most of them).
                const hitName = hit !== undefined
                    ? (hit.name.endsWith('-markers') ? hit.name.slice(0, -'-markers'.length) : hit.name)
                    : undefined

                if (hitName === lastHoveredRef.current) return

                if (lastHoveredRef.current !== undefined) {
                    handleMouseLeaveSeries(
                        lastHoveredRef.current,
                        mouseLeaveHandlerFor(`tooltip-${chartId}`)
                    )
                }

                if (hitName !== undefined) {
                    const series = seriesRef.current.get(hitName)
                    if (series !== undefined) {
                        const xAxisLinear = axesFor(
                            hitName,
                            axisAssignments,
                            axisId => xAxesState.axisFor(axisId).getOrUndefined(),
                            axisId => yAxesState.axisFor(axisId).getOrUndefined()
                        )[0]
                        if (xAxisLinear !== undefined) {
                            handleMouseOverSeries(
                                xAxisLinear,
                                hitName,
                                series.data,
                                [x, y],
                                margin,
                                mouseOverHandlerFor(`tooltip-${chartId}`)
                            )
                        }
                    }
                }

                lastHoveredRef.current = hitName
            }

            const handleLeaveCanvas = () => {
                if (lastHoveredRef.current !== undefined) {
                    handleMouseLeaveSeries(lastHoveredRef.current, mouseLeaveHandlerFor(`tooltip-${chartId}`))
                    lastHoveredRef.current = undefined
                }
            }

            canvas.addEventListener('mousemove', handleMove)
            canvas.addEventListener('mouseleave', handleLeaveCanvas)
            return () => {
                canvas.removeEventListener('mousemove', handleMove)
                canvas.removeEventListener('mouseleave', handleLeaveCanvas)
            }
        },
        [canvasContext, chartId, margin, axisAssignments, xAxesState, yAxesState, mouseOverHandlerFor, mouseLeaveHandlerFor]
    )

    // memoized function for subscribing to the chart-data observable
    const subscribe = useCallback(
        () => {
            if (subscriptionRef.current) return subscriptionRef.current
            if (seriesObservable === undefined || canvasContext === null) return undefined
            if (withCadenceOf !== undefined) {
                return subscriptionTimeSeriesWithCadenceFor(
                    seriesObservable as Observable<TimeSeriesChartData>,
                    onSubscribe,
                    windowingTime,
                    axisAssignments, xAxesState,
                    onUpdateData,
                    dropDataAfter,
                    updateTimingAndPlot,
                    // as new data flows into the subscription, the subscription
                    // updates this map directly (for performance)
                    seriesRef.current,
                    (axisId, end) => currentTimeRef.current.set(axisId, end),
                    withCadenceOf
                )
            }
            return subscriptionTimeSeriesFor(
                seriesObservable as Observable<TimeSeriesChartData>,
                onSubscribe,
                windowingTime,
                axisAssignments, xAxesState,
                onUpdateData,
                dropDataAfter,
                updateTimingAndPlot,
                // as new data flows into the subscription, the subscription
                // updates this map directly (for performance)
                seriesRef.current,
                (axisId, end) => currentTimeRef.current.set(axisId, end),
                timeWindowBehavior,
                initialTimes,
            )
        },
        [
            axisAssignments, dropDataAfter, canvasContext,
            onSubscribe, onUpdateData,
            seriesObservable, updateTimingAndPlot, windowingTime, xAxesState,
            withCadenceOf,
            initialTimes, timeWindowBehavior
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
                allowTooltip.current = false
            } else if (!shouldSubscribe && subscriptionRef.current !== undefined) {
                subscriptionRef.current?.unsubscribe()
                subscriptionRef.current = undefined
                allowTooltip.current = true
            }
        },
        [shouldSubscribe, subscribe]
    )

    // unregister this plot's draw function on unmount, and, if this component created its
    // own subscription (i.e., one wasn't handed in via the `subscription` prop), unsubscribe
    // it so it doesn't keep running (and driving stale draws) after the component is gone
    useEffect(
        () => {
            const ownsSubscription = ownsSubscriptionRef.current
            return () => {
                if (canvasContext) {
                    canvasContext.unregister(`scatter-plot-${chartId}`)
                }
                if (ownsSubscription) {
                    subscriptionRef.current?.unsubscribe()
                    subscriptionRef.current = undefined
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
 * @param seriesName Name of the series for which to retrieve the axis
 * @param axisAssignments A map holding the series name and the associated x- and y-axes assigned
 * to that series. Note that the series in the axis-assignment map is merely a subset of the set
 * of series names.
 * @param xAxisFor The function that accepts an axis ID and returns the corresponding x-axis
 * @param yAxisFor The function that accepts an axis ID and returns the corresponding y-axis
 */
function axesFor(
    seriesName: string,
    axisAssignments: Map<string, AxesAssignment>,
    xAxisFor: (id: string) => BaseAxis | undefined,
    yAxisFor: (id: string) => BaseAxis | undefined,
): [xAxis: ContinuousNumericAxis, yAxis: ContinuousNumericAxis] {
    const axes = axisAssignments.get(seriesName)
    const xAxis = xAxisFor(axes?.xAxis || "")
    const xAxisLinear = xAxis as ContinuousNumericAxis
    const yAxis = yAxisFor(axes?.yAxis || "")
    const yAxisLinear = yAxis as ContinuousNumericAxis
    if (xAxis && !xAxisLinear) {
        throw Error("Scatter plot requires that x-axis be of type LinearAxis")
    }
    if (yAxis && !yAxisLinear) {
        throw Error("Scatter plot requires that y-axis be of type LinearAxis")
    }
    return [xAxisLinear, yAxisLinear]
}

/**
 * Reports a tooltip showing the neuron, spike time, and the spike strength when the mouse hovers over a spike.
 * Replaces the old version, which mutated the hovered SVG `<path>`'s stroke directly; highlighting is now
 * handled by the draw function reading `hoveredSeriesName` from chart state (set via `setHoveredSeriesName`
 * elsewhere) rather than by touching an element here.
 * @param xAxis The x-axis
 * @param seriesName The name of the series (i.e. the neuron ID)
 * @param series The time series
 * @param mouseCoords The `[x, y]` position of the mouse, in canvas coordinates
 * @param margin The plot margin
 * @param mouseOverHandlerFor The handler for the mouse over (registered by the <Tooltip/>)
 */
function handleMouseOverSeries(
    xAxis: ContinuousNumericAxis,
    seriesName: string,
    series: Series<Datum>,
    mouseCoords: [x: number, y: number],
    margin: Margin,
    mouseOverHandlerFor: ((seriesName: string, time: number, tooltipData: TooltipData<Datum, NoTooltipMetadata>, mouseCoords: [x: number, y: number]) => void) | undefined,
): void {
    // grab the time needed for the tooltip ID
    const [x] = mouseCoords
    const time = Math.round(xAxis.scale.invert(x - margin.left))

    if (mouseOverHandlerFor) {
        mouseOverHandlerFor(seriesName, time, {series, metadata: {}}, mouseCoords)
    }
}

/**
 * Calls the mouse-leave-series handler registered for this series. Replaces the old version, which
 * also reset the hovered SVG element's stroke color/width directly; that reset is now implicit --
 * once `hoveredSeriesName` is cleared, the next redraw simply paints the series in its normal
 * (non-highlighted) style.
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
