import {useCallback, useEffect, useMemo, useRef} from 'react'
import * as d3 from "d3"
import {ZoomTransform} from "d3"
import {Observable, Subscription} from "rxjs"
import {Optional} from "result-fn"

import {useChart} from "../hooks/useChart"
import {useDataObservable} from "../hooks/useDataObservable"
import {useInitialData} from "../hooks/useInitialData"
import {usePlotDimensions} from "../hooks/usePlotDimensions"
import {type AxesAssignment, clipToArea, currentIntervalsFrom} from "./plot"
import type {CanvasContext} from "../d3types"
import {seriesAt, canvasLocalPoint, type SeriesGeometry} from "./hitTesting"
import {noop} from "../utils"
import type {Dimensions} from "../styling/margins"
import {ContinuousAxisRange} from "../axes/ContinuousAxisRange"
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
} from "../axes/axes"
import {subscriptionOutlierFor, subscriptionOutlierWithCadenceFor, TimeWindowBehavior} from "../subscriptions/subscriptions"
import type {OutlierChartData} from "../observables/outliers"
import type {OutlierDatum, OutlierSeries} from "../series/outlierSeries"
import {FastShiftArray} from "fast-shift-array";

type OutlierDatumColor<M extends readonly number[]> = { datum: OutlierDatum<M>, color: string }

export interface Props {
    /**
     * Holds the mapping between a series and the axis it uses (is assigned). The
     * map's key holds the series name, and the value is an {@link AxesAssignment}
     * object holding the ID of the assigned x-axis and y-axis.
     */
    axisAssignments?: Map<string, AxesAssignment>
    /**
     * The line interpolation curve factory. See the d3 documentation for curves at
     * {@link https://github.com/d3/d3-shape#curves} for information on available interpolations.
     */
    interpolation?: d3.CurveFactory
    /**
     * Number of milliseconds of data to hold in memory before dropping it. Defaults to infinity.
     */
    dropDataAfter?: number
    /**
     * Whether to enable panning and zooming. Defaults to false.
     */
    panEnabled?: boolean
    /**
     * Whether to enable zooming. Defaults to false.
     */
    zoomEnabled?: boolean
    /**
     * Whether to require the shift or ctrl key to be held down when zooming. Defaults to true.
     */
    zoomKeyModifiersRequired?: boolean
    /**
     * Behavior for time windowing. Defaults to TimeWindowBehavior.FIXED.
     */
    timeWindowBehavior?: TimeWindowBehavior
    /**
     * When set, uses a cadence with the specified refresh period (in milliseconds). For plots
     * where the updates are slow (> 100 ms) using a cadence of 10 to 25 ms smooths out the
     * updates and makes the plot updates look cleaner. When updates are around 25 ms or less,
     * then setting the cadence period too small will result in poor update performance. Generally
     * at high update speeds, the cadence is unnecessary. Finally, using cadence, sets the max time
     * to the current time -- this is what causes the x-axis to keep scrolling once the data
     * reaches the right-hand edge, even if new data hasn't arrived yet.
     */
    withCadenceOf?: number
    /**
     * Base fill-opacity for the outermost (widest) outlier band. Inner (narrower / more
     * confident) bands are rendered with progressively higher opacity, capped at 1.
     */
    bandOpacity?: number
    /**
     * Optional per-band opacity step added for each more-confident (lower-index) band.
     */
    bandOpacityStep?: number
    /**
     * Radius (px) of the circle marker drawn at each datum on the central line. Defaults to 4.
     */
    markerRadius?: number
    /**
     * Colors for the outlier marker drawn on any point that falls outside one or more bounds.
     * The array is indexed by bound (i.e. by measure), so `outlierMarkerColors[i]` is used when
     * the point is outside `bounds[i]`. When a point is outside multiple bounds, the color
     * associated with the largest exceeded bound wins. When omitted, outlier markers fall back
     * to red.
     */
    outlierMarkerColors?: ReadonlyArray<string>
}

/**
 * Metadata carried through the tooltip system when the user hovers over an outlier band.
 */
export interface OutlierBandTooltipMetadata<M extends readonly number[] = readonly number[]> {
    /**
     * The outlier datum
     */
    datum?: OutlierDatum<M>
    /**
     * The measure (confidence level) associated with the hovered band.
     */
    upperMeasure?: number
    /**
     * The measure (confidence level) associated with the band below the hovered band.
     */
    lowerMeasure?: number
    /**
     * The index of the hovered band (0 = tightest / most confident).
     */
    bandIndex: number
    /**
     * Number of visible points whose y-value falls within the band bounds.
     */
    pointsInBand: number
}

/**
 * A band's fill region, captured at draw time for `isPointInPath`-based hover hit-testing.
 * Canvas has no per-shape events, and a filled, possibly-curved area isn't well modeled by
 * `hitTesting.ts`'s line/segment/rect primitives, so bands use `ctx.isPointInPath` directly
 * instead -- this is what canvas is built for.
 */
interface BandHitRegion<M extends readonly number[]> {
    path: Path2D
    seriesName: string
    bandIndex: number
    upperMeasure: number | undefined
    lowerMeasure: number | undefined
    plotData: FastShiftArray<OutlierDatum<M>>
}

/**
 * Renders a streaming outlier plot. Each series consists of {@link OutlierDatum} points, where every
 * datum carries an (x, y) value plus a set of (lower, upper) bounds — one per measure. The plot
 * draws the central y-line for the series and a translucent band per measure, filled between
 * the corresponding lower and upper bounds. The x-axis scrolls as new points arrive past the
 * end of the visible window, in the same fashion as {@link ScatterPlot}.
 *
 * Internally, this no longer creates/updates SVG `<path>`/`<circle>` elements. Instead, it
 * registers a single draw function with the chart's {@link CanvasContext} that redraws every
 * series' bands, line, and markers from scratch each time the canvas repaints. Band hover uses
 * `ctx.isPointInPath` against the band's actual filled path (captured each draw); outlier-marker
 * hover uses the shared point-hit-testing in `hitTesting.ts`, same as {@link ScatterPlot}'s markers.
 */
export function OutlierPlot<M extends readonly number[] = readonly number[]>(props: Props): null {
    const {
        chartId,
        canvasContext,
        axes,
        seriesStyles,
        seriesFilter,
        hoveredSeriesName,
        mouse,
    } = useChart<OutlierDatum<M>, SeriesLineStyle, OutlierBandTooltipMetadata<M>, ContinuousAxisRange, ContinuousNumericAxis>()

    const {mouseOverHandlerFor, mouseLeaveHandlerFor} = mouse

    const {initialData} = useInitialData<OutlierChartData<M>, OutlierDatum<M>>()

    const {
        xAxesState,
        yAxesState,
        setAxisIntervalFor,
        updateAxisRanges = noop,
        onUpdateAxesInterval,
        axesRanges,
    } = axes

    const {plotDimensions, margin} = usePlotDimensions()

    const {
        seriesObservable,
        windowingTime = 100,
        shouldSubscribe,
        onSubscribe = noop,
        onUpdateData,
    } = useDataObservable<OutlierChartData<M>, OutlierDatum<M>>()

    const {
        axisAssignments = new Map<string, AxesAssignment>(),
        interpolation = d3.curveLinear,
        dropDataAfter = Infinity,
        panEnabled = false,
        zoomEnabled = false,
        zoomKeyModifiersRequired = true,
        timeWindowBehavior = TimeWindowBehavior.SCROLL,
        withCadenceOf,
        bandOpacity = 0.15,
        bandOpacityStep = 0.12,
        markerRadius,
        outlierMarkerColors,
    } = props

    const initialTimes = useMemo(
        () => new Map<string, number>(
            Array.from<[string, ContinuousAxisRange]>(axesRanges().entries())
                .map(([axisId, range]) => ([axisId, range.original.start]))
        ),
        [axesRanges]
    )

    // seriesRef is the single source of truth for what to render. It starts from the initial
    // data and grows as the subscription emits new series. the draw function iterates this
    // directly (rather than a parallel dataRef array) so dynamically-arriving series get rendered.
    const seriesRef = useRef<Map<string, OutlierSeries<M>>>(
        new Map(initialData.map(series => [series.name, series as OutlierSeries<M>]))
    )
    const currentTimeRef = useRef<Map<string, number>>(new Map())

    const subscriptionRef = useRef<Subscription>(undefined)

    // captured band fill-regions and outlier-marker geometry, in canvas coordinates, used for
    // hit-testing mouse hover on `mousemove` (see the effect below that wires up the listener)
    const bandsRef = useRef<Array<BandHitRegion<M>>>([])
    const outlierGeometryRef = useRef<Map<string, SeriesGeometry>>(new Map())
    const outlierDatumsRef = useRef<Map<string, Array<OutlierDatumColor<M>>>>(new Map())
    // what's currently hovered: a band (series + band index) or an outlier point (series + point
    // index) -- mutually exclusive, so we know when to fire a "leave" before an "over"
    const lastHoveredRef = useRef<{kind: 'band', seriesName: string, bandIndex: number} | {kind: 'outlier', seriesName: string, index: number} | undefined>(undefined)

    /**
     * (Re-)registers this plot's draw function with the canvas context and requests a redraw.
     * Replaces the old version, which directly mutated SVG `<path>`/`<circle>` elements bound via
     * d3's enter/update/exit join. Canvas has no persistent elements to join against, so the draw
     * function just redraws every band/line/marker from current data/scale state each time it's
     * invoked.
     *
     * Pan/zoom behavior setup lives in a separate effect (see below), not here -- this function
     * runs on every data tick (each `windowingTime` interval), and recreating/reattaching a
     * `d3.drag()`/`d3.zoom()` behavior that often is pure overhead unrelated to drawing the new
     * data.
     */
    const updatePlot = useCallback(
        (cc: CanvasContext) => {
            const draw = (context: CanvasContext) => {
                const {context2D} = context

                context2D.save()
                clipToArea(context, plotDimensions, {x: margin.left, y: margin.top})
                context2D.translate(margin.left, margin.top)

                const newBands: Array<BandHitRegion<M>> = []
                const newOutlierGeometry = new Map<string, SeriesGeometry>()
                const newOutlierDatums = new Map<string, Array<OutlierDatumColor<M>>>()

                seriesRef.current.forEach(series => {
                    const [xAxis, yAxis] = axesFor(
                        series.name,
                        axisAssignments,
                        id => xAxesState.axisFor(id).getOrUndefined(),
                        id => yAxesState.axisFor(id).getOrUndefined()
                    )
                    if (xAxis === undefined || yAxis === undefined) return

                    const style = seriesStyles.get(series.name) ?? defaultLineStyle()
                    const plotData = series.name.match(seriesFilter) ? series.data : FastShiftArray.empty<OutlierDatum<M>>()
                    const numBands = plotData.length > 0 ? plotData[0].bounds.length : 0

                    // render the widest (highest-index) band first so the narrower, more-confident
                    // bands stack on top with darker opacity
                    for (let bandIndex = numBands - 1; bandIndex >= 0; bandIndex--) {
                        const opacity = Math.min(1, bandOpacity + (numBands - 1 - bandIndex) * bandOpacityStep)
                        const areaGen = d3.area<OutlierDatum<M>>()
                            .x(d => xAxis.scale(d.datum.x) || 0)
                            .y0(d => yAxis.scale(d.bounds[bandIndex].lower) || 0)
                            .y1(d => yAxis.scale(d.bounds[bandIndex].upper) || 0)
                            .curve(interpolation)
                        const upperMeasure = series.measures[bandIndex]
                        const lowerMeasure = bandIndex > 0 ? series.measures[bandIndex - 1] : undefined

                        const path = new Path2D(areaGen(Array.from(plotData)) ?? "")
                        context2D.fillStyle = style.color
                        context2D.globalAlpha = opacity
                        context2D.fill(path)
                        context2D.globalAlpha = 1

                        // pushed in draw order (widest first, narrowest/topmost last); hit-testing
                        // iterates this backwards so the topmost band wins, matching visual stacking
                        newBands.push({path, seriesName: series.name, bandIndex, upperMeasure, lowerMeasure, plotData})
                    }

                    // central line for the series y-value
                    const isHovered = hoveredSeriesName === series.name
                    const stroke = isHovered ? style.highlightColor : style.color
                    const strokeWidth = isHovered ? style.highlightWidth : style.lineWidth
                    const lineGen = d3.line<OutlierDatum<M>>()
                        .x(d => xAxis.scale(d.datum.x) || 0)
                        .y(d => yAxis.scale(d.datum.y) || 0)
                        .curve(interpolation)

                    context2D.strokeStyle = stroke
                    context2D.lineWidth = strokeWidth
                    context2D.stroke(new Path2D(lineGen(Array.from(plotData)) ?? ""))

                    // for the markers, we split the data into two categories: regular and outlier
                    const {regular, outlier} = categorizePoints(plotData, outlierMarkerColors)

                    // point markers (one circle per datum) -- decorative only, no hover/tooltip
                    if (markerRadius != null && markerRadius >= 0 && !shouldSubscribe) {
                        context2D.fillStyle = stroke
                        regular.forEach(d => {
                            const x = xAxis.scale(d.datum.x) || 0
                            const y = yAxis.scale(d.datum.y) || 0
                            context2D.beginPath()
                            context2D.arc(x, y, markerRadius, 0, 2 * Math.PI)
                            context2D.fill()
                        })
                    }

                    // outlier markers -- these DO get hover/tooltip, so we record their screen
                    // positions (and the underlying datum, for the tooltip) for hit-testing
                    const outlierPoints: Array<[number, number]> = []
                    outlier.forEach(o => {
                        const x = xAxis.scale(o.datum.datum.x) || 0
                        const y = yAxis.scale(o.datum.datum.y) || 0
                        context2D.fillStyle = o.color
                        context2D.beginPath()
                        context2D.arc(x, y, 4, 0, 2 * Math.PI)
                        context2D.fill()
                        outlierPoints.push([x + margin.left, y + margin.top])
                    })
                    newOutlierGeometry.set(`${series.name}::outlier`, {
                        points: outlierPoints,
                        hitRadius: 6
                    })
                    newOutlierDatums.set(series.name, outlier)
                })

                bandsRef.current = newBands
                outlierGeometryRef.current = newOutlierGeometry
                outlierDatumsRef.current = newOutlierDatums

                context2D.restore()
            }

            cc.register(`outlier-plot-${chartId}`, draw, 10)
            cc.requestRedraw()
        },
        [
            chartId, plotDimensions, margin,
            axisAssignments,
            xAxesState, yAxesState,
            seriesStyles, seriesFilter, interpolation,
            bandOpacity, bandOpacityStep, markerRadius, outlierMarkerColors, hoveredSeriesName,
            shouldSubscribe
        ]
    )

    const updatePlotRef = useRef<(cc: CanvasContext) => void>(updatePlot)
    useEffect(() => {
        updatePlotRef.current = updatePlot
    }, [updatePlot])

    const onUpdateTimeRef = useRef(updateAxisRanges)
    useEffect(() => {
        onUpdateTimeRef.current = updateAxisRanges
    }, [updateAxisRanges])

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
    useEffect(() => {
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
    }, [onUpdateAxesInterval])

    // don't leave a scheduled notification pointing at an unmounted plot
    useEffect(() => () => {
        if (notifyFrameRef.current !== 0) {
            cancelAnimationFrame(notifyFrameRef.current)
            notifyFrameRef.current = 0
        }
    }, [])

    useEffect(
        () => {
            currentTimeRef.current = new Map(Array.from<string>(xAxesState.axes.keys()).map(id => [id, 0]))
        },
        [xAxesState]
    )

    const axesForSeries = useMemo(
        (): Array<string> => axesForSeriesGen<OutlierDatum<M>, ContinuousNumericAxis>(
            initialData, axisAssignments, xAxesState
        ),
        [initialData, axisAssignments, xAxesState]
    )

    const updateTimingAndPlot = useCallback((ranges: Map<string, ContinuousAxisRange>): void => {
        if (canvasContext !== null) {
            onUpdateTimeRef.current(ranges)
            // keep the single canonical ranges ref in sync, so the pan/zoom handlers (now set up
            // once, in a separate effect, rather than inside updatePlot itself) always read the
            // current ranges without updatePlot needing to be recreated whenever ranges change
            timeRangesRef.current = ranges
            updatePlotRef.current(canvasContext)
            // the notification is deferred to the next animation frame (see `notifyIntervalsRef`),
            // so that this doesn't update the application state synchronously from within the
            // subscription's update
            notifyIntervalsRef.current(ranges)
        }
    }, [canvasContext])

    useEffect(
        () => {
            seriesRef.current = new Map(initialData.map(series => [series.name, series as OutlierSeries<M>]))
            currentTimeRef.current = new Map(Array.from<string>(xAxesState.axes.keys()).map(id => [id, 0]))
            updateTimingAndPlot(
                new Map(
                    Array.from(continuousAxisRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>).entries())
                        .map(([id, range]) => {
                            const [start, end] = range.original.asTuple()
                            const minTime = (initialData as Array<OutlierSeries<M>>)
                                .filter(srs => axisAssignments.get(srs.name)?.xAxis === id)
                                .reduce(
                                    (tMin, series) =>
                                        Math.min(tMin, !series.isEmpty() ? series.data[0].datum.x : tMin),
                                    Infinity
                                )
                            const startTime = minTime === Infinity ? 0 : minTime
                            return [id, ContinuousAxisRange.from(startTime, startTime + end - start)]
                        })
                )
            )
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [initialData]
    )

    const onPan = useCallback(
        (x: number, dim: Dimensions, ranges: Map<string, ContinuousAxisRange>) =>
            panHandler(axesForSeries, margin, setAxisIntervalFor, xAxesState)(x, dim, ranges),
        [axesForSeries, margin, setAxisIntervalFor, xAxesState]
    )

    const onZoom = useCallback(
        (transform: ZoomTransform, x: number, dim: Dimensions, ranges: Map<string, ContinuousAxisRange>) =>
            continuousAxisZoomHandler(axesForSeries, margin, setAxisIntervalFor, xAxesState)(transform, x, dim, ranges),
        [axesForSeries, margin, setAxisIntervalFor, xAxesState]
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
                    .on("start", () => canvasSelection.style("cursor", "move"))
                    .on("drag", event => {
                        onPan(event.dx, plotDimensions, timeRangesRef.current)
                        updatePlotRef.current(cc)
                        notifyIntervalsRef.current(timeRangesRef.current)
                    })
                    .on("end", () => canvasSelection.style("cursor", "auto"))
                canvasSelection.call(drag)
            }

            if (zoomEnabled) {
                const zoom = d3.zoom<HTMLCanvasElement, unknown>()
                    .filter(event => !zoomKeyModifiersRequired || event.shiftKey || event.ctrlKey)
                    .scaleExtent([0, 10])
                    .translateExtent([[margin.left, margin.top], [plotDimensions.width, plotDimensions.height]])
                    .on("zoom", event => {
                        onZoom(
                            event.transform,
                            event.sourceEvent.offsetX - margin.left,
                            plotDimensions,
                            timeRangesRef.current,
                        )
                        updatePlotRef.current(cc)
                        notifyIntervalsRef.current(timeRangesRef.current)
                    })
                canvasSelection.call(zoom)
            }

            return () => {
                if (panEnabled) canvasSelection.on(".drag", null)
                if (zoomEnabled) canvasSelection.on(".zoom", null)
            }
        },
        [canvasContext, panEnabled, zoomEnabled, onPan, onZoom, plotDimensions, margin, zoomKeyModifiersRequired]
    )

    // the single source of truth for the axes' ranges. the zoom and pan handlers, the subscription,
    // and the effect below all read and update this same map (in place), so that each range's
    // original (un-zoomed) interval survives the window scrolling as data streams in
    const timeRangesRef = useRef<Map<string, ContinuousAxisRange>>(new Map())

    const subscribe = useCallback(() => {
        if (seriesObservable === undefined || canvasContext === null) return undefined
        if (withCadenceOf !== undefined) {
            return subscriptionOutlierWithCadenceFor<M>(
                seriesObservable as Observable<OutlierChartData<M>>,
                onSubscribe,
                windowingTime,
                xAxesState,
                onUpdateData,
                dropDataAfter,
                updateTimingAndPlot,
                seriesRef.current,
                (axisId: string, end: number) => currentTimeRef.current.set(axisId, end),
                withCadenceOf,
            )
        }
        return subscriptionOutlierFor<M>(
            seriesObservable as Observable<OutlierChartData<M>>,
            onSubscribe,
            windowingTime,
            axisAssignments, xAxesState,
            onUpdateData,
            dropDataAfter,
            updateTimingAndPlot,
            seriesRef.current,
            (axisId: string, end: number) => currentTimeRef.current.set(axisId, end),
            timeWindowBehavior,
            initialTimes,
        )
    }, [
        axisAssignments, dropDataAfter, canvasContext,
        onSubscribe, onUpdateData,
        seriesObservable, updateTimingAndPlot, windowingTime, xAxesState,
        initialTimes, timeWindowBehavior, withCadenceOf
    ])

    useEffect(() => {
        if (canvasContext) {
            if (timeRangesRef.current.size === 0) {
                // populate the map in place -- replacing it would orphan the copy already held by
                // the subscription and by the zoom and pan handlers
                continuousAxisRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)
                    .forEach((range, id) => timeRangesRef.current.set(id, range))
            } else {
                const intervals = continuousAxisIntervals(xAxesState.axes)
                timeRangesRef.current.forEach((range, id, m) => {
                    const [start, end] = Optional.ofNullable(intervals.get(id))
                        .map(interval => interval.asTuple())
                        .getOrThrow(() => new Error(`Unable to retrieve interval for axis; axis_id: ${id}`))
                    if (!isNaN(start) && !isNaN(end)) {
                        m.set(id, range.update(start, end))
                    }
                })
            }
            updatePlot(canvasContext)
        }
    }, [chartId, canvasContext, plotDimensions, updatePlot, xAxesState])

    // wires up a single mousemove/mouseleave listener on the shared canvas to replace the old
    // per-element SVG mouseover/mouseleave handlers on the band paths and outlier-marker circles.
    // Bands are hit-tested via `ctx.isPointInPath` against their captured fill path (checked
    // topmost/narrowest-first, matching visual stacking); outlier markers use the shared
    // point-hit-testing in `hitTesting.ts`. Outlier markers are checked first since they're drawn
    // on top of the bands.
    useEffect(
        () => {
            if (!canvasContext) return

            const canvas = canvasContext.canvas
            const {context2D} = canvasContext

            const handleMove = (event: MouseEvent) => {
                const [x, y] = canvasLocalPoint(event, canvas)
                // hit-test coordinates need to be in the same (margin-translated) space the
                // geometry/paths were captured in
                const localX = x - margin.left
                const localY = y - margin.top

                // check outlier markers first (drawn on top of the bands)
                const outlierHit = seriesAt(x, y, outlierGeometryRef.current)
                const current = outlierHit !== undefined ?
                    {kind: 'outlier' as const, seriesName: outlierHit.name.replace(/::outlier$/, ''), index: outlierHit.index} :
                    findHoveredBand(bandsRef.current, context2D, localX, localY)

                const previous = lastHoveredRef.current
                const sameAsBefore = previous !== undefined && current !== undefined &&
                    previous.kind === current.kind && previous.seriesName === current.seriesName &&
                    ((previous.kind === 'band' && current.kind === 'band' && previous.bandIndex === current.bandIndex) ||
                        (previous.kind === 'outlier' && current.kind === 'outlier' && previous.index === current.index))

                if (sameAsBefore) return

                if (previous !== undefined) {
                    mouseLeaveHandlerFor(`tooltip-${chartId}`)?.(previous.seriesName)
                }

                if (current !== undefined) {
                    if (current.kind === 'band') {
                        const band = bandsRef.current.find(b => b.seriesName === current.seriesName && b.bandIndex === current.bandIndex)
                        if (band !== undefined && band.upperMeasure != null) {
                            const pointsInBand = calcPointsInBand(band.plotData, band.bandIndex)
                            mouseOverHandlerFor(`tooltip-${chartId}`)?.(
                                current.seriesName,
                                current.bandIndex,
                                {
                                    series: band.plotData,
                                    metadata: {
                                        upperMeasure: band.upperMeasure,
                                        lowerMeasure: band.lowerMeasure,
                                        bandIndex: current.bandIndex,
                                        pointsInBand,
                                    }
                                },
                                [x, y]
                            )
                        }
                    } else {
                        const series = seriesRef.current.get(current.seriesName)
                        const outlierDatum = outlierDatumsRef.current.get(current.seriesName)?.[current.index]
                        if (series !== undefined && outlierDatum !== undefined) {
                            const plotData = series.name.match(seriesFilter) ? series.data : FastShiftArray.empty<OutlierDatum<M>>()
                            const datum = outlierDatum.datum
                            const bandIndex = largestExceededBoundIndex(datum) + 1
                            const upperMeasure = bandIndex < series.measures.length ? series.measures[bandIndex] : undefined
                            const lowerMeasure = bandIndex > 0 ? series.measures[bandIndex - 1] : undefined
                            const pointsInBand = calcPointsInBand(plotData, bandIndex)
                            mouseOverHandlerFor(`tooltip-${chartId}`)?.(
                                current.seriesName,
                                datum.datum.x,
                                {
                                    series: series.data,
                                    metadata: {datum, upperMeasure, lowerMeasure, bandIndex, pointsInBand}
                                },
                                [x, y]
                            )
                        }
                    }
                }

                lastHoveredRef.current = current
            }

            const handleLeaveCanvas = () => {
                const previous = lastHoveredRef.current
                if (previous !== undefined) {
                    mouseLeaveHandlerFor(`tooltip-${chartId}`)?.(previous.seriesName)
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
        [canvasContext, chartId, margin, seriesFilter, mouseOverHandlerFor, mouseLeaveHandlerFor]
    )

    useEffect(() => {
        if (shouldSubscribe && subscriptionRef.current === undefined) {
            subscriptionRef.current = subscribe()
        } else if (!shouldSubscribe && subscriptionRef.current !== undefined) {
            subscriptionRef.current?.unsubscribe()
            subscriptionRef.current = undefined
        }
    }, [shouldSubscribe, subscribe])

    // unregister this plot's draw function on unmount
    useEffect(
        () => {
            return () => {
                if (canvasContext) {
                    canvasContext.unregister(`outlier-plot-${chartId}`)
                }
            }
        },
        [canvasContext, chartId]
    )

    return null
}

/**
 * Finds the topmost (narrowest, most-confident) band whose fill path contains `(localX, localY)`.
 * `bands` is in draw order (widest first, narrowest/topmost last), so this iterates backwards to
 * check the topmost band first, matching visual stacking.
 */
function findHoveredBand<M extends readonly number[]>(
    bands: Array<BandHitRegion<M>>,
    context: CanvasRenderingContext2D,
    localX: number,
    localY: number
): {kind: 'band', seriesName: string, bandIndex: number} | undefined {
    for (let i = bands.length - 1; i >= 0; i--) {
        const band = bands[i]
        if (context.isPointInPath(band.path, localX, localY)) {
            return {kind: 'band', seriesName: band.seriesName, bandIndex: band.bandIndex}
        }
    }
    return undefined
}

/**
 * Returns the index of the largest bound the datum's y-value is outside of, or -1 if the value
 * is inside every bound. Bounds are expected to be ordered from tightest (index 0) to widest
 * (highest index), so the highest-index match identifies the most severe outlier tier.
 */
function largestExceededBoundIndex<M extends readonly number[]>(datum: OutlierDatum<M>): number {
    for (let i = datum.bounds.length - 1; i >= 0; i--) {
        const {lower, upper} = datum.bounds[i]
        if (datum.datum.y < lower || datum.datum.y > upper) return i
    }

    return -1
}

function axesFor(
    seriesName: string,
    axisAssignments: Map<string, AxesAssignment>,
    xAxisFor: (id: string) => BaseAxis | undefined,
    yAxisFor: (id: string) => BaseAxis | undefined,
): [xAxis: ContinuousNumericAxis | undefined, yAxis: ContinuousNumericAxis | undefined] {
    const assigned = axisAssignments.get(seriesName)
    const xAxis = xAxisFor(assigned?.xAxis || "") as ContinuousNumericAxis | undefined
    const yAxis = yAxisFor(assigned?.yAxis || "") as ContinuousNumericAxis | undefined
    if (xAxisFor(assigned?.xAxis || "") && !xAxis) {
        throw Error("Outlier plot requires that x-axis be of type ContinuousNumericAxis")
    }
    if (yAxisFor(assigned?.yAxis || "") && !yAxis) {
        throw Error("Outlier plot requires that y-axis be of type ContinuousNumericAxis")
    }
    return [xAxis, yAxis]
}

/**
 * Calculate the number of points within a specific outlier band.
 * @param plotData The array of outlier data points.
 * @param bandIndex The index of the outlier band to calculate points for.
 * @param [subtractLowerBandCount=true] Whether to subtract the count of points in the lower band. Defaults to true.
 * @returns The number of points within the specified outlier band.
 */
function calcPointsInBand<M extends readonly number[]>(
    plotData: Array<OutlierDatum<M>> | FastShiftArray<OutlierDatum<M>>,
    bandIndex: number,
    subtractLowerBandCount: boolean = true
): number {
    // function to count the points in a specific outlier band
    const countPointsInBand = (bandIndex: number) =>
        plotData
            .filter(datum => {
                    if (bandIndex < datum.bounds.length) {
                        return datum.datum.y >= datum.bounds[bandIndex].lower && datum.datum.y <= datum.bounds[bandIndex].upper
                    }
                    return true
                }
            ).length

    const pointsInBand = countPointsInBand(bandIndex)
    // we need to subtract the points in the lower band. recall that each band has ALL the points
    // in the band's range, not what we may think of visually
    if (bandIndex > 0 && subtractLowerBandCount) {
        return pointsInBand - countPointsInBand(bandIndex - 1)
    }
    return pointsInBand
}

type CategorizedData<M extends readonly number[]> = {
    regular: Array<OutlierDatum<M>>,
    outlier: Array<OutlierDatumColor<M>>
}

/**
 * Categorizes outlier data into regular and outlier points based on provided marker colors.
 * @param data Array of outlier data to categorize
 * @param outlierMarkerColors Array of colors to use for outlier markers
 * @returns Object with regular and outlier data arrays
 * @template M Type of the measure
 */
function categorizePoints<M extends readonly number[]>(
    data: FastShiftArray<OutlierDatum<M>>,
    outlierMarkerColors: ReadonlyArray<string> = []
): CategorizedData<M> {
    return data.reduce<CategorizedData<M>>(
        (accum, datum) => {
            const bandIndex = largestExceededBoundIndex(datum)
            if (bandIndex < 0) {
                accum.regular.push(datum)
            } else {
                accum.outlier.push({datum, color: outlierMarkerColors[bandIndex] ?? "red"})
            }
            return accum
        },
        {regular: [], outlier: []} as CategorizedData<M>
    )
}
