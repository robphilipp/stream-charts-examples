import React, {useCallback, useEffect, useMemo, useRef} from 'react'
import {useChart} from "./hooks/useChart";
import {ContinuousAxisRange, continuousAxisRangeFor} from "./continuousAxisRangeFor";
import * as d3 from "d3";
import {ZoomTransform} from "d3";
import {AxesAssignment, setClipPath, TimeSeries} from "./plot";
import {Datum, emptySeries, Series} from "./datumSeries";
import {
    axesForSeriesGen,
    BaseAxis,
    calculatePanFor,
    calculateZoomFor,
    ContinuousNumericAxis,
    defaultLineStyle, panHandler,
    SeriesLineStyle, zoomHandler
} from "./axes";
import {GSelection} from "./d3types";
import {Subscription} from "rxjs";
import {windowTime} from "rxjs/operators";
import {noop} from "./utils";
import {Dimensions, Margin} from "./margins";
import {defaultTooltipStyle, TooltipStyle} from "./tooltipUtils";

interface Props {
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
}

/**
 * Renders a streaming scatter plot for the series in the initial data and those streamed in
 * by the observable.
 * @param props
 * @constructor
 */
export function ScatterPlot(props: Props): null {
    const {
        chartId,
        container,
        mainG,
        xAxesState,
        yAxesState,
        setTimeRangeFor,
        plotDimensions,
        margin,
        color,
        seriesStyles,
        initialData,
        seriesFilter,

        seriesObservable,
        windowingTime = 100,
        shouldSubscribe,

        onSubscribe = noop,
        onUpdateData = noop,
        onUpdateTime = noop,

        mouseOverHandlerFor,
        mouseLeaveHandlerFor,
    } = useChart()

    const {
        axisAssignments = new Map<string, AxesAssignment>(),
        interpolation = d3.curveLinear,
        dropDataAfter = Infinity,
        panEnabled = false,
        zoomEnabled = false,
        zoomKeyModifiersRequired = true
    } = props

    // some 'splainin: the dataRef holds on to a copy of the initial data, but, the Series in the array
    // are by reference, so the seriesRef, also holds on to the same Series. When the Series in seriesRef
    // get appended with new data, it's updating the underlying series, and so the dataRef sees those
    // changes as well. The dataRef is used for performance, so that in the updatePlot function we don't
    // need to create a temporary array to holds the series data, rather, we can just use the one held in
    // the dataRef.
    const dataRef = useRef<Array<Series>>(initialData.slice())
    const seriesRef = useRef<Map<string, Series>>(new Map(initialData.map(series => [series.name, series])))
    // map(axis_id -> current_time) -- maps the axis ID to the current time for that axis
    const currentTimeRef = useRef<Map<string, number>>(new Map())

    useEffect(
        () => {
            currentTimeRef.current = new Map(Array.from(xAxesState.axes.keys()).map(id => [id, 0]))
        },
        [xAxesState]
    )

    // calculates the distinct series IDs that cover all the series in the plot
    const axesForSeries = useMemo(
        (): Array<string> => axesForSeriesGen(initialData, axisAssignments, xAxesState)(),
        [initialData, axisAssignments, xAxesState]
    )

    /**
     * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
     * @param deltaX The amount that the plot is dragged
     * @param plotDimensions The dimensions of the plot
     * @param series An array of series names
     * @param ranges A map holding the axis ID and its associated time range
     */
    const onPan = useCallback(
        (x: number,
         plotDimensions: Dimensions,
         series: Array<string>,
         ranges: Map<string, ContinuousAxisRange>,
        ) => panHandler(axesForSeries, margin, setTimeRangeFor, xAxesState)(x, plotDimensions, series, ranges),
        [axesForSeries, margin, setTimeRangeFor, xAxesState]
    )

    /**
     * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
     * at the location of the mouse when the scroll wheel or gesture was applied.
     * @param transform The d3 zoom transformation information
     * @param x The x-position of the mouse when the scroll wheel or gesture is used
     * @param plotDimensions The dimensions of the plot
     * @param series An array of series names
     * @param ranges A map holding the axis ID and its associated time-range
     */
    const onZoom = useCallback(
        (
            transform: ZoomTransform,
            x: number,
            plotDimensions: Dimensions,
            series: Array<string>,
            ranges: Map<string, ContinuousAxisRange>,
        ) => zoomHandler(axesForSeries, margin, setTimeRangeFor, xAxesState)(transform, x, plotDimensions, series, ranges),
        [axesForSeries, margin, setTimeRangeFor, xAxesState]
    )

    const updatePlot = useCallback(
        /**
         * Updates the plot data for the specified time-range, which may have changed due to zoom or pan
         * @param timeRanges The current time range
         * @param mainGElem The main <g> element selection for that holds the plot
         */
        (timeRanges: Map<string, ContinuousAxisRange>, mainGElem: GSelection) => {
            if (container) {
                // select the svg element bind the data to them
                const svg = d3.select<SVGSVGElement, any>(container)

                // create a map associating series-names to their time-series.
                //
                // performance-related confusion: wondering where the dataRef is updated? well it isn't
                // directly. The dataRef holds on to an array of references to the Series. And so does the
                // seriesRef, though is uses a map(series_name -> series). The seriesRef is use to append
                // data to the underlying Series, and the dataRef is used so that we can just use
                // dataRef.current and don't have to do Array.from(seriesRef.current.values()) which
                // creates a temporary array
                const boundedSeries = new Map(dataRef.current.map(series => [
                    series.name,
                    series.data.map(datum => [datum.time, datum.value]) as TimeSeries
                ]))

                // // create/update the magnifier lens if needed
                // magnifierRef.current = magnifierLens(svg, magnifierStyle.visible)

                // set up panning
                if (panEnabled) {
                    const drag = d3.drag<SVGSVGElement, Datum>()
                        .on("start", () => {
                            // todo during a pan, we want to hide the tooltip
                            d3.select(container).style("cursor", "move")
                        })
                        .on("drag", (event) => {
                            onPan(
                                event.dx,
                                plotDimensions,
                                Array.from(boundedSeries.keys()),
                                timeRanges,
                            )
                            updatePlotRef.current(timeRanges, mainGElem)
                        })
                        .on("end", () => {
                            // todo if the tooltip was originally visible, then allow it to be seen again
                            d3.select(container).style("cursor", "auto")
                        })

                    svg.call(drag)
                }

                // set up for zooming
                if (zoomEnabled) {
                    const zoom = d3.zoom<SVGSVGElement, Datum>()
                        .filter(event => !zoomKeyModifiersRequired || event.shiftKey || event.ctrlKey)
                        .scaleExtent([0, 10])
                        .translateExtent([[margin.left, margin.top], [plotDimensions.width, plotDimensions.height]])
                        .on("zoom", event => {
                                onZoom(
                                    event.transform,
                                    event.sourceEvent.offsetX - margin.left,
                                    plotDimensions,
                                    Array.from(boundedSeries.keys()),
                                    timeRanges,
                                )
                                updatePlotRef.current(timeRanges, mainGElem)
                            }
                        )

                    svg.call(zoom)
                }

                // define the clip-path so that the series lines don't go beyond the plot area
                const clipPathId = setClipPath(chartId, svg, plotDimensions, margin)

                boundedSeries.forEach((data, name) => {
                    // grab the x and y axes assigned to the series, and if either or both
                    // axes aren't found, then give up and return
                    const [xAxisLinear, yAxisLinear] = axesFor(name, axisAssignments, xAxesState.axisFor, yAxesState.axisFor)
                    if (xAxisLinear === undefined || yAxisLinear === undefined) return

                    // grab the style for the series
                    const {color, lineWidth} = seriesStyles.get(name) || {
                        ...defaultLineStyle,
                        highlightColor: defaultLineStyle.color
                    }

                    // only show the data for which the filter matches
                    const plotData = (name.match(seriesFilter)) ? data : []

                    // create the time-series paths
                    mainGElem
                        .selectAll(`#${name}-${chartId}-scatter`)
                        .data([[], plotData], () => `${name}`)
                        .join(
                            enter => enter
                                .append("path")
                                .attr("class", 'time-series-lines')
                                .attr("id", `${name}-${chartId}-scatter`)
                                .attr(
                                    "d",
                                    d3.line()
                                        .x((d: [number, number]) => xAxisLinear.scale(d[0]) || 0)
                                        .y((d: [number, number]) => yAxisLinear.scale(d[1]) || 0)
                                        .curve(interpolation)
                                )
                                .attr("fill", "none")
                                .attr("stroke", color)
                                .attr("stroke-width", lineWidth)
                                .attr('transform', `translate(${margin.left}, ${margin.top})`)
                                .attr("clip-path", `url(#${clipPathId})`)
                                .on(
                                    "mouseover",
                                    (event, datumArray) =>
                                        // recall that this handler is passed down via the "useChart" hook
                                        handleMouseOverSeries(
                                            chartId,
                                            container,
                                            xAxisLinear,
                                            name,
                                            datumArray,
                                            event,
                                            margin,
                                            defaultTooltipStyle,
                                            seriesStyles,
                                            plotDimensions,
                                            mouseOverHandlerFor(`tooltip-${chartId}`)
                                        )
                                )
                                .on(
                                    "mouseleave",
                                    event => handleMouseLeaveSeries(
                                        name,
                                        event.currentTarget,
                                        seriesStyles,
                                        mouseLeaveHandlerFor(`tooltip-${chartId}`)
                                    )
                                ),
                            update => update,
                            exit => exit.remove()
                        )
                })
            }
        },
        [
            container, dataRef,
            margin, plotDimensions,
            chartId, axisAssignments,
            onPan, onZoom,
            xAxesState, yAxesState,
            seriesStyles,
            seriesFilter,
            mouseOverHandlerFor,
            mouseLeaveHandlerFor,
            interpolation
        ]
    )

    // need to keep the function references for use by the subscription, which forms a closure
    // on them. without the references, the closures become stale, and resizing during streaming
    // doesn't work properly
    const updatePlotRef = useRef(updatePlot)
    useEffect(
        () => {
            updatePlotRef.current = updatePlot
        },
        [updatePlot]
    )
    const onUpdateTimeRef = useRef(onUpdateTime)
    useEffect(
        () => {
            onUpdateTimeRef.current = onUpdateTime
        },
        [onUpdateTime]
    )

    // updates the timing using the onUpdateTime and updatePlot references. This and the references
    // defined above allow the axes' times to be update properly by avoid stale reference to these
    // functions.
    const updateTimingAndPlot = useCallback(
        /**
         * Updates the time and plot with the new time-ranges
         * @param ranges The new time-ranges
         */
        (ranges: Map<string, ContinuousAxisRange>): void => {
            if (mainG !== null) {
                onUpdateTimeRef.current(ranges)
                updatePlotRef.current(ranges, mainG)
            }
        },
        [mainG]
    )

    const subscribe = useCallback(
        () => {
            if (seriesObservable === undefined || mainG === null) return undefined

            const subscription = seriesObservable
                .pipe(windowTime(windowingTime))
                .subscribe(async dataList => {
                    await dataList.forEach(data => {
                        // grab the time-windows for the x-axes
                        const timesWindows = timeRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)

                        // calculate the max times for each x-axis, which is the max time over all the
                        // series assigned to an x-axis
                        const axesSeries = Array.from(data.maxTimes.entries())
                            .reduce(
                                (assignedSeries, [seriesName,]) => {
                                    const id = axisAssignments.get(seriesName)?.xAxis || xAxesState.axisDefaultName()
                                    const as = assignedSeries.get(id) || []
                                    as.push(seriesName)
                                    assignedSeries.set(id, as)
                                    return assignedSeries
                                },
                                new Map<string, Array<string>>()
                            )

                        // add each new point to it's corresponding series
                        data.newPoints.forEach((newData, name) => {
                            // grab the current series associated with the new data
                            const series = seriesRef.current.get(name) || emptySeries(name)

                            // update the handler with the new data point
                            onUpdateData(name, newData)

                            // add the new data to the series
                            series.data.push(...newData)

                            const axisId = axisAssignments.get(name)?.xAxis || xAxesState.axisDefaultName()
                            const currentAxisTime = axesSeries.get(axisId)
                                ?.reduce(
                                    (tMax, seriesName) => Math.max(data.maxTimes.get(seriesName) || data.maxTime, tMax),
                                    -Infinity
                                ) || data.maxTime
                            if (currentAxisTime !== undefined) {
                                // drop data that is older than the max time-window
                                while (currentAxisTime - series.data[0].time > dropDataAfter) {
                                    series.data.shift()
                                }

                                const range = timesWindows.get(axisId)
                                if (range !== undefined && range.end < currentAxisTime) {
                                    const timeWindow = range.end - range.start
                                    const timeRange = continuousAxisRangeFor(
                                        Math.max(0, currentAxisTime - timeWindow),
                                        Math.max(currentAxisTime, timeWindow)
                                    )
                                    timesWindows.set(axisId, timeRange)
                                    currentTimeRef.current.set(axisId, timeRange.end)
                                }
                            }
                        })

                        // update the data
                        updateTimingAndPlot(timesWindows)
                    })
                })

            // provide the subscription to the caller
            onSubscribe(subscription)

            return subscription
        },
        [
            seriesObservable, mainG, windowingTime, onSubscribe, xAxesState, updateTimingAndPlot,
            axisAssignments, onUpdateData, dropDataAfter
        ]
    )

    const timeRangesRef = useRef<Map<string, ContinuousAxisRange>>(new Map())
    useEffect(
        () => {
            if (container && mainG) {
                // so this gets a bit complicated. the time-ranges need to be updated whenever the time-ranges
                // change. for example, as data is streamed in, the times change, and then we need to update the
                // time-range. however, we want to keep the time-ranges to reflect their original scale so that
                // we can zoom properly (so the updates can't fuck with the scale). At the same time, when the
                // interpolation changes, then the update plot changes, and the time-ranges must maintain their
                // original scale as well.
                // const ranges = timeRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)
                if (timeRangesRef.current.size === 0) {
                    // when no time-ranges have yet been created, then create them and hold on to a mutable
                    // reference to them
                    timeRangesRef.current = timeRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)
                } else {
                    // when the time-ranges already exist, then we want to update the time-ranges for each
                    // existing time-range in a way that maintains the original scale.
                    const intervals = timeIntervals(xAxesState.axes as Map<string, ContinuousNumericAxis>)
                    timeRangesRef.current
                        .forEach((range, id, rangesMap) => {
                            const [start, end] = intervals.get(id) || [NaN, NaN]
                            if (!isNaN(start) && !isNaN(end)) {
                                // update the reference map with the new (start, end) portion of the range,
                                // while keeping the original scale intact
                                rangesMap.set(id, range.update(start, end))
                            }
                        })
                }
                updatePlot(timeRangesRef.current, mainG)
            }
        },
        [chartId, color, container, mainG, plotDimensions, updatePlot, xAxesState]
    )

    // subscribe/unsubscribe to the observable chart data. when the `shouldSubscribe`
    // is changed to `true` and we haven't subscribed yet, then subscribe. when the
    // `shouldSubscribe` is `false` and we had subscribed, then unsubscribe. otherwise,
    // do nothing.
    const subscriptionRef = useRef<Subscription>()
    useEffect(
        () => {
            if (shouldSubscribe && subscriptionRef.current === undefined) {
                subscriptionRef.current = subscribe()
            } else if (!shouldSubscribe && subscriptionRef.current !== undefined) {
                subscriptionRef.current?.unsubscribe()
                subscriptionRef.current = undefined
            }
        },
        [shouldSubscribe, subscribe]
    )

    return null
}

/**
 * Calculates the time-ranges for each of the axes in the map
 * @param xAxes The map containing the axes and their associated IDs
 * @return a map associating the axis IDs to their time-range
 */
function timeRanges(xAxes: Map<string, ContinuousNumericAxis>): Map<string, ContinuousAxisRange> {
    return new Map(Array.from(xAxes.entries())
        .map(([id, axis]) => {
            const [start, end] = axis.scale.domain()
            return [id, continuousAxisRangeFor(start, end)]
        }))
}

/**
 * Calculates the time-intervals (start, end) for each of the x-axis
 * @param xAxes The x-axes representing the time
 * @return A map associating each x-axis with a (start, end) interval
 */
function timeIntervals(xAxes: Map<string, ContinuousNumericAxis>): Map<string, [start: number, end: number]> {
    return new Map(Array.from(xAxes.entries())
        .map(([id, axis]) => [id, axis.scale.domain()] as [string, [number, number]]))
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
 * Renders a tooltip showing the neuron, spike time, and the spike strength when the mouse hovers over a spike.
 * @param chartId The ID of the chart
 * @param container The chart container
 * @param xAxis The x-axis
 * @param seriesName The name of the series (i.e. the neuron ID)
 * @param series The time series
 // * @param segment The SVG line element representing the spike, over which the mouse is hovering.
 * @param event The mouse-over series event
 * @param margin The plot margin
 * @param tooltipStyle The tooltip style information
 * @param seriesStyles The series style information (needed for (un)highlighting)
 * @param plotDimensions The dimensions of the plot
 * @param mouseOverHandlerFor The handler for the mouse over (registered by the <Tooltip/>)
 */
function handleMouseOverSeries(
    chartId: number,
    container: SVGSVGElement,
    xAxis: ContinuousNumericAxis,
    seriesName: string,
    series: TimeSeries,
    event: React.MouseEvent<SVGPathElement>,
    margin: Margin,
    tooltipStyle: TooltipStyle,
    seriesStyles: Map<string, SeriesLineStyle>,
    plotDimensions: Dimensions,
    mouseOverHandlerFor: ((seriesName: string, time: number, series: TimeSeries, mouseCoords: [x: number, y: number]) => void) | undefined,
): void {
    // grab the time needed for the tooltip ID
    const [x, y] = d3.pointer(event, container)
    const time = Math.round(xAxis.scale.invert(x - margin.left))

    const {highlightColor, highlightWidth} = seriesStyles.get(seriesName) || defaultLineStyle

    // Use d3 to select element, change color and size
    d3.select<SVGPathElement, Datum>(event.currentTarget)
        .attr('stroke', highlightColor)
        .attr('stroke-width', highlightWidth)

    if (mouseOverHandlerFor) {
        mouseOverHandlerFor(seriesName, time, series, [x, y])
    }
}

/**
 * Unselects the time series and calls the mouse-leave-series handler registered for this series.
 * @param seriesName The name of the series (i.e. the neuron ID)
 * @param segment The SVG line element representing the spike, over which the mouse is hovering.
 * @param seriesStyles The styles for the series (for (un)highlighting)
 * @param mouseLeaverHandlerFor Registered handler for the series when the mouse leaves
 */
function handleMouseLeaveSeries(
    seriesName: string,
    segment: SVGPathElement,
    seriesStyles: Map<string, SeriesLineStyle>,
    mouseLeaverHandlerFor: ((seriesName: string) => void) | undefined,
): void {
    const {color, lineWidth} = seriesStyles.get(seriesName) || defaultLineStyle
    d3.select<SVGPathElement, Datum>(segment)
        .attr('stroke', color)
        .attr('stroke-width', lineWidth)

    if (mouseLeaverHandlerFor) {
        mouseLeaverHandlerFor(seriesName)
    }
}
