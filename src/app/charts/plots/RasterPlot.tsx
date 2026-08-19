import {type AxesAssignment, clipToArea, currentIntervalsFrom} from "./plot";
import * as d3 from "d3";
import {type D3DragEvent, type D3ZoomEvent, ZoomTransform} from "d3";
import {noop} from "../utils";
import {type NoTooltipMetadata, useChart} from "../hooks/useChart";
import {useCallback, useEffect, useMemo, useRef} from "react";
import type {Datum, TimeSeries} from "../series/timeSeries";
import {
    axesForSeriesGen,
    type BaseAxis,
    continuousAxisIntervals,
    continuousAxisRanges,
    continuousAxisZoomHandler,
    type ContinuousNumericAxis,
    defaultLineStyle,
    type OrdinalStringAxis,
    panHandler,
    type SeriesLineStyle
} from "../axes/axes";
import type {CanvasContext} from "../d3types";
import {seriesAt, canvasLocalPoint, type SeriesGeometry} from "./hitTesting";
import {Observable, Subscription} from "rxjs";
import type {Dimensions, Margin} from "../styling/margins";
import {subscriptionTimeSeriesFor, subscriptionTimeSeriesWithCadenceFor} from "../subscriptions/subscriptions";
import {useDataObservable} from "../hooks/useDataObservable";
import type {TimeSeriesChartData} from "../series/timeSeriesChartData";
import {usePlotDimensions} from "../hooks/usePlotDimensions";
import {useInitialData} from "../hooks/useInitialData";
import type {TooltipData} from "../hooks/useTooltip";
import {Optional} from "result-fn";
import {ContinuousAxisRange} from "../axes/ContinuousAxisRange";
import {FastShiftArray} from "fast-shift-array";

export interface Props {
    /**
     * Holds the mapping between a series and the axis it uses (is assigned). The
     * map's key holds the series name, and the value is an {@link AxesAssignment}
     * object holding the ID of the assigned x-axis and y-axis.
     */
    axisAssignments?: Map<string, AxesAssignment>
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
     * to activate the zoom
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
     * The (optional, default = 2 pixels) top and bottom margin (in pixels) for the spike lines in the plot.
     * Margins on individual series can also be set through the {@link Chart.seriesStyles} property.
     */
    spikeMargin?: number
}

/**
 * Renders a streaming neuron raster plot for the series in the initial data and those sourced by the
 * observable specified as a property in the {@link Chart}. This component uses the {@link useChart}
 * hook, and therefore must be a child of the {@link Chart} in order to be plugged in to the
 * chart ecosystem (axes, tracker, tooltip).
 *
 * Internally, this no longer creates/updates SVG `<line>` elements. Instead, it registers a single
 * draw function with the chart's {@link CanvasContext} that redraws every series' spikes from
 * scratch each time the canvas repaints. Mouse hover (for the tooltip) is handled by hit-testing
 * the mouse position against the last-drawn spike geometry -- as *disjoint* segments, since unlike
 * a scatter series, consecutive spikes are not connected by a line (see `hitTesting.ts`).
 *
 * @param props The properties associated with the raster plot
 * @example
 <RasterPlot
     axisAssignments={new Map([
        ['neuron1', assignAxes("x-axis-2", "y-axis-2")],
        ['neuron2', assignAxes("x-axis-2", "y-axis-2")],
     ])}
     spikeMargin={1}
     dropDataAfter={5000}
     panEnabled={true}
     zoomEnabled={true}
     zoomKeyModifiersRequired={true}
 />
 */
export function RasterPlot(props: Props): null {
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
        xAxesState,
        yAxesState,
        setAxisAssignments,
        setAxisIntervalFor,
        updateAxisRanges = noop,
        onUpdateAxesInterval,
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

    const {initialData} = useInitialData<TimeSeriesChartData, Datum>()

    const {
        axisAssignments = new Map<string, AxesAssignment>(),
        dropDataAfter = Infinity,
        panEnabled = false,
        zoomEnabled = false,
        zoomKeyModifiersRequired = true,
        withCadenceOf,
        spikeMargin = 2,
    } = props

    // why do "dataRef" and "seriesRef" both hold on to the same underlying data? for performance.
    //
    // the "dataRef" and "seriesRef" both point to the same underlying data, a collection
    // of series. The series in "dataRef" are read by the canvas draw function. The "seriesRef"
    // series are the ones that are updated as new data is streamed in.
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
    const dataRef = useRef<Array<TimeSeries>>(initialData.slice())
    const seriesRef = useRef<Map<string, TimeSeries>>(
        new Map(initialData.map(
            series => [series.name, series]
            )
        )
    )
    // map(axis_id -> current_time) -- maps the axis ID to the current time for that axis
    const currentTimeRef = useRef<Map<string, number>>(new Map())

    // the last-drawn geometry for each series' spikes, in canvas coordinates, used for
    // hit-testing mouse hover on `mousemove` (see the effect below that wires up the listener)
    const geometryRef = useRef<Map<string, SeriesGeometry>>(new Map())
    // the name of the series the mouse was over on the previous `mousemove`, so we know when to
    // fire a "leave" for the old series before firing an "over" for the new one
    const lastHoveredRef = useRef<string | undefined>(undefined)

    const subscriptionRef = useRef<Subscription>(undefined)

    const isSubscriptionClosed = () => subscriptionRef.current === undefined || subscriptionRef.current.closed

    // eslint-disable-next-line react-hooks/refs
    const allowTooltipRef = useRef<boolean>(isSubscriptionClosed())

    useEffect(
        () => {
            currentTimeRef.current = new Map(Array.from<string>(xAxesState.axes.keys()).map(id => [id, 0]))
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
        () => axesForSeriesGen<Datum, ContinuousNumericAxis>(initialData, axisAssignments, xAxesState),
        [initialData, axisAssignments, xAxesState]
    )

    // updates the timing using the onUpdateTime and updatePlot references. This and the references
    // defined above allow the axes' times to be update properly by avoid stale reference to these
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
                                (tMin: number, series: TimeSeries) => Math.min(
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
     * Calculates the upper and lower y-coordinate for the spike line
     * @param categorySize The size of the category (i.e. plot_height / num_series)
     * @param lineWidth The width of the series line
     * @param margin The margin applied to the top and bottom of the spike line (vertical spacing)
     * @return An object with two functions, that when handed a y-coordinate, return the location
     * for the start (yUpper) or end (yLower) of the spikes line.
     */
    function yCoordsFn(categorySize: number, lineWidth: number, margin: number):
        { yUpper: (y: number) => number, yLower: (y: number) => number } {
        if (categorySize <= margin) return {
            yUpper: y => y,
            yLower: y => y + lineWidth
        }
        return {
            yUpper: y => y + margin,
            yLower: y => y + categorySize - margin
        }
    }

    /**
     * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
     * @param x The amount that the plot is dragged
     * @param plotDimensions The dimensions of the plot
     * @param ranges A map holding the axis ID and its associated time range
     */
    const onPan = useCallback(
        (x: number,
         plotDimensions: Dimensions,
         ranges: Map<string, ContinuousAxisRange>
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

    /**
     * (Re-)registers this plot's draw function with the canvas context and requests a redraw.
     * Replaces the old version, which directly mutated SVG `<line>` elements bound via d3's
     * enter/update/exit join. Canvas has no persistent elements to join against, so the draw
     * function just redraws every spike from current data/scale state each time it's invoked.
     * @param cc The canvas context to register the draw function with
     */
    const updatePlot = useCallback(
        (cc: CanvasContext) => {
            // set up panning
            if (panEnabled) {
                const canvasSelection = d3.select<HTMLCanvasElement, unknown>(cc.canvas)
                const drag = d3.drag<HTMLCanvasElement, unknown>()
                    .on("start", () => {
                        canvasSelection.style("cursor", "move")
                        allowTooltipRef.current = false
                    })
                    .on("drag", (event: D3DragEvent<HTMLCanvasElement, unknown, ContinuousNumericAxis>) => {
                        onPan(event.dx, plotDimensions, timeRangesRef.current)
                        // need to update the plot with the new time-ranges
                        updatePlotRef.current(cc)
                        // the pan updated the axes' ranges in place, so report the new intervals
                        notifyIntervalsRef.current(timeRangesRef.current)
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
                    .filter((event: KeyboardEvent) => !zoomKeyModifiersRequired || event.shiftKey || event.ctrlKey)
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

            const draw = (context: CanvasContext) => {
                const {ctx} = context

                ctx.save()
                clipToArea(context, plotDimensions, {x: margin.left, y: margin.top})
                ctx.translate(margin.left, margin.top)

                const newGeometry = new Map<string, SeriesGeometry>()

                // enter, update, delete the raster data
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
                        color: seriesColor,
                        lineWidth,
                        highlightColor,
                        highlightWidth,
                        margin: spikeLineMargin = spikeMargin
                    } = seriesStyles.get(series.name) || {
                        ...defaultLineStyle(),
                        highlightColor: defaultLineStyle().color
                    }

                    const isHovered = hoveredSeriesName === series.name
                    const strokeColor = isHovered ? highlightColor : seriesColor
                    const strokeWidth = isHovered ? (highlightWidth || lineWidth) : lineWidth

                    // only show the data for which the regex filter matches
                    const plotData: FastShiftArray<Datum> = (series.name.match(seriesFilter)) ? series.data : FastShiftArray.empty<Datum>()

                    // grab the functions that are used to determine the lower and upper coordinates of
                    // the raster line (y1, y2) and then calculate the values (y1, y2) using those functions
                    const {yUpper, yLower} = yCoordsFn(yAxis.scale.bandwidth(), lineWidth, spikeLineMargin)
                    const y = yAxis.scale(series.name) || 0
                    const y1 = yUpper(y)
                    const y2 = yLower(y)

                    ctx.strokeStyle = strokeColor
                    ctx.lineWidth = strokeWidth

                    const segments: Array<[[number, number], [number, number]]> = []
                    for (let i = 0; i < plotData.length; i++) {
                        const x = xAxis.scale(plotData[i].x)
                        ctx.beginPath()
                        ctx.moveTo(x, y1)
                        ctx.lineTo(x, y2)
                        ctx.stroke()
                        segments.push([[x + margin.left, y1 + margin.top], [x + margin.left, y2 + margin.top]])
                    }

                    newGeometry.set(series.name, {
                        points: [],
                        segments,
                        hitRadius: Math.max(4, strokeWidth)
                    })
                })

                geometryRef.current = newGeometry

                ctx.restore()
            }

            cc.register(`raster-plot-${chartId}`, draw, 10)
            cc.requestRedraw()
        },
        [
            axisAssignments, chartId, canvasContext, margin,
            onPan, onZoom,
            panEnabled,
            plotDimensions,
            seriesFilter, seriesStyles,
            xAxesState, yAxesState,
            zoomEnabled, zoomKeyModifiersRequired,
            spikeMargin,
            hoveredSeriesName,
        ]
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

    // grab a reference to the function used to update the time ranges and update that reference
    // if the function changes (solve for stale closures)
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

    // memoized function for subscribing to the chart-data observable
    const subscribe = useCallback(
        () => {
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
                (axisId, end) => currentTimeRef.current.set(axisId, end)
            )
        },
        [
            axisAssignments, dropDataAfter, canvasContext,
            onSubscribe, onUpdateData,
            seriesObservable, updateTimingAndPlot, windowingTime, xAxesState,
            withCadenceOf
        ]
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
                    // when no time-ranges have yet been created, then create them and hold on to a mutable
                    // reference to them
                    timeRangesRef.current = continuousAxisRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)
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
    // last-drawn spike geometry (see `geometryRef`, populated by the draw function above).
    useEffect(
        () => {
            if (!canvasContext) return

            const canvas = canvasContext.canvas

            const handleMove = (event: MouseEvent) => {
                if (!allowTooltipRef.current) return

                const [x, y] = canvasLocalPoint(event, canvas)
                const hit = seriesAt(x, y, geometryRef.current)

                if (hit?.name === lastHoveredRef.current && hit !== undefined) {
                    // still hovering the same series -- no enter/leave to fire, but the specific
                    // spike may have changed, so fall through and re-report below
                } else if (lastHoveredRef.current !== undefined) {
                    handleMouseLeaveSeries(lastHoveredRef.current, mouseLeaveHandlerFor(`tooltip-${chartId}`))
                }

                if (hit !== undefined) {
                    const series = seriesRef.current.get(hit.name)
                    const selectedDatum = series?.data[hit.index]
                    const xAxis = axesFor(
                        hit.name,
                        axisAssignments,
                        axisId => xAxesState.axisFor(axisId).getOrUndefined(),
                        axisId => yAxesState.axisFor(axisId).getOrUndefined()
                    )[0]
                    if (selectedDatum !== undefined && xAxis !== undefined) {
                        handleMouseOverSeries(
                            xAxis,
                            hit.name,
                            selectedDatum,
                            [x, y],
                            margin,
                            mouseOverHandlerFor(`tooltip-${chartId}`)
                        )
                    }
                }

                lastHoveredRef.current = hit?.name
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
                    canvasContext.unregister(`raster-plot-${chartId}`)
                }
            }
        },
        [canvasContext, chartId]
    )

    return null
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
): [xAxis: ContinuousNumericAxis, yAxis: OrdinalStringAxis] {
    const axes = axisAssignments.get(seriesName)
    const xAxis = xAxisFor(axes?.xAxis || "")
    const xAxisLinear = xAxis as ContinuousNumericAxis
    if (xAxis && !xAxisLinear) {
        throw Error("Raster plot requires that x-axis be of type LinearAxis")
    }
    const yAxis = yAxisFor(axes?.yAxis || "")
    const yAxisCategory = yAxis as OrdinalStringAxis
    if (yAxis && !yAxisCategory) {
        throw Error("Raster plot requires that y-axis be of type CategoryAxis")
    }
    return [xAxisLinear, yAxisCategory]
}

/**
 * Reports a tooltip showing the neuron, spike time, and the spike strength when the mouse hovers over a spike.
 * Replaces the old version, which mutated the hovered SVG `<line>`'s stroke directly; highlighting is now
 * handled by the draw function reading `hoveredSeriesName` from chart state rather than by touching an
 * element here.
 * @param xAxis The x-axis
 * @param seriesName The name of the series (i.e. the neuron ID)
 * @param selectedDatum The selected datum
 * @param mouseCoords The `[x, y]` position of the mouse, in canvas coordinates
 * @param margin The plot margin
 * @param mouseOverHandlerFor The handler for the mouse over (registered by the <Tooltip/>)
 */
function handleMouseOverSeries(
    xAxis: ContinuousNumericAxis,
    seriesName: string,
    selectedDatum: Datum,
    mouseCoords: [x: number, y: number],
    margin: Margin,
    mouseOverHandlerFor: ((seriesName: string, time: number, tooltipData: TooltipData<Datum, NoTooltipMetadata>, mouseCoords: [x: number, y: number]) => void) | undefined,
): void {
    // grab the time needed for the tooltip ID
    const [x] = mouseCoords
    const time = Math.round(xAxis.scale.invert(x - margin.left))

    if (mouseOverHandlerFor) {
        // the contract for the mouse over handler is for a time-series, but here we only
        // need one point, the selected datum, and so we convert it into an array of point
        // (i.e. a time-series). The category tooltip is (and custom ones, must) be
        // written to expect only the selected point
        mouseOverHandlerFor(seriesName, time, {series: [selectedDatum], metadata: {}}, mouseCoords)
    }
}

/**
 * Calls the mouse-leave-series handler registered for this series. Replaces the old version, which
 * also reset the hovered SVG element's stroke color/width directly; that reset is now implicit --
 * once `hoveredSeriesName` is cleared, the next redraw simply paints the spikes in their normal
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
