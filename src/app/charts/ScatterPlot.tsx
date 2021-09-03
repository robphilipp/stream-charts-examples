import React, {useCallback, useEffect, useMemo, useRef} from 'react'
import {useChart} from "./useChart";
import {ContinuousAxisRange, continuousAxisRangeFor} from "./continuousAxisRangeFor";
import * as d3 from "d3";
import {ZoomTransform} from "d3";
import {setClipPath, TimeSeries} from "./plot";
import {Datum, emptySeries, Series} from "./datumSeries";
import {
    BaseAxis,
    calculatePanFor,
    calculateZoomFor,
    ContinuousNumericAxis,
    defaultLineStyle,
    SeriesLineStyle
} from "./axes";
import {GSelection, TextSelection} from "./d3types";
import {Subscription} from "rxjs";
import {windowTime} from "rxjs/operators";
import {formatTime, formatTimeChange, formatValue, formatValueChange, noop} from "./utils";
import {Dimensions, Margin} from "./margins";
import {boundingPoints, defaultTooltipStyle, TooltipDimensions, TooltipStyle, tooltipX, tooltipY} from "./tooltipUtils";

export interface AxesAssignment {
    xAxis: string
    yAxis: string
}

export const assignAxes = (xAxis: string, yAxis: string): AxesAssignment => ({xAxis, yAxis})

interface Props {
    axisAssignments?: Map<string, AxesAssignment>
    colors?: Map<string, string>
}

export function ScatterPlot(props: Props): null {
    const {
        chartId,
        container,
        mainG,
        xAxisFor,
        xAxes,
        xAxisDefaultName,
        yAxisFor,
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

        registerTooltipContentProvider,
        mouseOverHandlerFor,
        mouseLeaveHandlerFor,
    } = useChart()

    const {
        axisAssignments = new Map<string, AxesAssignment>(),
    } = props

    const liveDataRef = useRef<Map<string, Series>>(new Map(initialData.map(series => [series.name, series])))
    const seriesRef = useRef<Map<string, Series>>(new Map(initialData.map(series => [series.name, series])))
    // map(axis_id -> current_time) -- maps the axis ID to the current time for that axis
    const currentTimeRef = useRef<Map<string, number>>(new Map())

    useEffect(
        () => {
            currentTimeRef.current = new Map(Array.from(xAxes().keys()).map(id => [id, 0]))
        },
        [xAxes]
    )

    // calculates the distinct series IDs that cover all the series in the plot
    const axesForSeries = useMemo(
        (): Array<string> => {
            return initialData.map(series => series.name)
                // grab the x-axis assigned to the series, or use a the default x-axis if not
                // assignment has been made
                .map(name => axisAssignments.get(name)?.xAxis || xAxisDefaultName())
                // de-dup the array of axis IDs so that we don't end up applying the pan or zoom
                // transformation more than once
                .reduce((accum: Array<string>, axisId: string) => {
                    if (!accum.find(id => id === axisId)) {
                        accum.push(axisId)
                    }
                    return accum
                }, [])
        },
        [initialData, axisAssignments, xAxisDefaultName]
    )

    const onPan = useCallback(
        /**
         * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
         * @param deltaX The amount that the plot is dragged
         * @param plotDimensions The dimensions of the plot
         * @param series An array of series names
         * @param ranges A map holding the axis ID and its associated time range
         * @param mainG The main <g> element holding the plot
         */
        (
            deltaX: number,
            plotDimensions: Dimensions,
            series: Array<string>,
            ranges: Map<string, ContinuousAxisRange>,
            mainG: GSelection
        ): void => {
            // run through the axis IDs, adjust their domain, and update the time-range set for that axis
            axesForSeries
                .forEach(axisId => {
                    const xAxis = xAxisFor(axisId) as ContinuousNumericAxis
                    const timeRange = ranges.get(axisId)
                    if (timeRange) {
                        // calculate the change in the time-range based on the pixel change from the drag event
                        const range = calculatePanFor(deltaX, plotDimensions, xAxis, timeRange)
                        if (Math.abs(range.start - timeRange.start) < 2) return

                        // update the time-range for the axis
                        ranges.set(axisId, range)

                        const {start, end} = range
                        setTimeRangeFor(axisId, [start, end])

                        // update the axis' time-range
                        xAxis.update([start, end], plotDimensions, margin)
                    }
                })

            // need to update the plot with the new time-ranges
            updatePlotRef.current(ranges, mainG)
        },
        [axesForSeries, margin, setTimeRangeFor, xAxisFor]
    )

    const onZoom = useCallback(
        /**
         * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
         * at the location of the mouse when the scroll wheel or gesture was applied.
         * @param transform The d3 zoom transformation information
         * @param x The x-position of the mouse when the scroll wheel or gesture is used
         * @param plotDimensions The dimensions of the plot
         * @param series An array of series names
         * @param ranges A map holding the axis ID and its associated time-range
         * @param mainG The main <g> element holding the plot
         */
        (
            transform: ZoomTransform,
            x: number,
            plotDimensions: Dimensions,
            series: Array<string>,
            ranges: Map<string, ContinuousAxisRange>,
            mainG: GSelection
        ): void => {
            // run through the axis IDs, adjust their domain, and update the time-range set for that axis
            axesForSeries
                .forEach(axisId => {
                    const xAxis = xAxisFor(axisId) as ContinuousNumericAxis
                    const timeRange = ranges.get(axisId)
                    if (timeRange) {
                        const zoom = calculateZoomFor(transform, x, plotDimensions, xAxis, timeRange)

                        // update the axis range
                        ranges.set(axisId, zoom.range)

                        setTimeRangeFor(axisId, [zoom.range.start, zoom.range.end])

                        // update the axis' time-range
                        xAxis.update([zoom.range.start, zoom.range.end], plotDimensions, margin)
                    }
                })
            updatePlotRef.current(ranges, mainG)
        },
        [axesForSeries, margin, setTimeRangeFor, xAxisFor]
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

                // create a map associating series-names to their time-series
                const boundedSeries = new Map(initialData.map(series => [
                    series.name,
                    selectInTimeRange(series, timeRangeFor(series.name, timeRanges, axisAssignments))
                ]))

                // // create/update the magnifier lens if needed
                // magnifierRef.current = magnifierLens(svg, magnifierStyle.visible)

                // set up panning
                const drag = d3.drag<SVGSVGElement, Datum>()
                    .on("start", () => {
                        // todo during a pan, we want to hide the tooltip
                        d3.select(container).style("cursor", "move")
                    })
                    .on("drag", (event) => onPan(
                        event.dx,
                        plotDimensions,
                        Array.from(boundedSeries.keys()),
                        timeRanges,
                        mainGElem
                    ))
                    .on("end", () => {
                        // todo if the tooltip was originally visible, then allow it to be seen again
                        d3.select(container).style("cursor", "auto")
                    })

                svg.call(drag)

                // set up for zooming
                const zoom = d3.zoom<SVGSVGElement, Datum>()
                    .scaleExtent([0, 10])
                    .translateExtent([[margin.left, margin.top], [plotDimensions.width, plotDimensions.height]])
                    .on("zoom", (event) => onZoom(
                            event.transform,
                            event.sourceEvent.offsetX - margin.left,
                            plotDimensions,
                            Array.from(boundedSeries.keys()),
                            timeRanges,
                            mainGElem
                        )
                    )

                svg.call(zoom)

                // define the clip-path so that the series lines don't go beyond the plot area
                const clipPathId = setClipPath(chartId, svg, plotDimensions, margin)

                boundedSeries.forEach((data, name) => {
                    // grab the x and y axes assigned to the series, and if either or both
                    // axes aren't found, then give up and return
                    const [xAxisLinear, yAxisLinear] = axesFor(name, axisAssignments, xAxisFor, yAxisFor)
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
                        .selectAll(`#${name}`)
                        .data([[], plotData], () => `${name}`)
                        .join(
                            enter => enter
                                .append("path")
                                .attr("class", 'time-series-lines')
                                .attr("id", `${name}`)
                                .attr("d", d3.line()
                                    .x((d: [number, number]) => xAxisLinear.scale(d[0]) || 0)
                                    .y((d: [number, number]) => yAxisLinear.scale(d[1]) || 0)
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
                                    event =>
                                        handleMouseLeaveSeries(name, event.currentTarget, seriesStyles, mouseLeaveHandlerFor(`tooltip-${chartId}`))
                                ),
                            update => update,
                            exit => exit.remove()
                        )
                })
            }
        },
        [
            container, initialData,
            margin, plotDimensions,
            chartId, axisAssignments,
            onPan, onZoom,
            xAxisFor, yAxisFor,
            seriesStyles,
            seriesFilter,
            mouseOverHandlerFor,
            mouseLeaveHandlerFor
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

    /**
     * Updates the timing using the onUpdateTime and updatePlot references. This and the references
     * defined above allow the axes' times to be update properly by avoid stale reference to these
     * functions.
     */
    const updateTimingAndPlot = useCallback(
        (ranges: Map<string, ContinuousAxisRange>) => {
            if (mainG !== null) {
                // const ranges = timeRanges(xAxes() as Map<string, ContinuousNumericAxis>)
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
                .subscribe(dataList => {
                    dataList.forEach(data => {
                        // grab the time-windows for the x-axes
                        const timesWindows = timeRanges(xAxes() as Map<string, ContinuousNumericAxis>)

                        // calculate the max times for each x-axis, which is the max time over all the
                        // series assigned to an x-axis
                        const axesSeries = Array.from(data.maxTimes.entries())
                            .reduce(
                                (assignedSeries, [seriesName,]) => {
                                    const id = axisAssignments.get(seriesName)?.xAxis || xAxisDefaultName()
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

                            const axisId = axisAssignments.get(name)?.xAxis || xAxisDefaultName()
                            const currentAxisTime = axesSeries.get(axisId)
                                ?.reduce(
                                    (tMax, seriesName) => Math.max(data.maxTimes.get(seriesName) || data.maxTime),
                                    -Infinity
                                ) || data.maxTime
                            if (currentAxisTime !== undefined) {
                                // drop data that is older than the max time-window
                                // todo replace the infinity
                                while (currentAxisTime - series.data[0].time > Infinity) {
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
                        liveDataRef.current = seriesRef.current
                        updateTimingAndPlot(timesWindows)
                    })
                })

            // provide the subscription to the caller
            onSubscribe(subscription)

            return subscription
        },
        [
            seriesObservable, mainG, windowingTime, onSubscribe,
            xAxes, axisAssignments, xAxisDefaultName, onUpdateData, updateTimingAndPlot
        ]
    )

    useEffect(
        () => {
            if (container && mainG) {
                const xAxesLinear = new Map<string, ContinuousNumericAxis>(
                    Array.from(xAxes().entries()).map(([id, axis]) => [id, axis as ContinuousNumericAxis])
                )
                updatePlot(timeRanges(xAxesLinear), mainG)
            }
        },
        [chartId, color, container, mainG, plotDimensions, updatePlot, xAxes]
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
 * Determines whether the line segment is in the time-range
 * @param datum The current datum
 * @param index The index of the current datum
 * @param array The array of datum
 * @param timeRange The time-range against which to check the line segment
 * @return `true` if the line segment is in the time-range, or if the line-segment
 * that ends after the time-range end or that starts before the time-range start is
 * in the time-range (i.e. intersects the time-range boundary). In other words, return
 * `true` if the line segment is in the time-range or intersects the time-range boundary.
 * Returns `false` otherwise.
 */
function inTimeRange(datum: Datum, index: number, array: Datum[], timeRange: ContinuousAxisRange): boolean {
    // also want to include the point whose previous or next value are in the time range
    const prevDatum = array[Math.max(0, index - 1)]
    const nextDatum = array[Math.min(index + 1, array.length - 1)]
    return (datum.time >= timeRange.start && datum.time <= timeRange.end) ||
        (datum.time < timeRange.start && nextDatum.time >= timeRange.start) ||
        (prevDatum.time <= timeRange.end && datum.time > timeRange.end)
}

/**
 * Returns the data in the time-range and the datum that comes just before the start of the time range.
 * The point before the time range is so that the line draws up to the y-axis, where it is clipped.
 * @param series The series
 * @param timeRange The time-range against which to check the line segment
 * @return An array of (time, value) points that fit within the time range,
 * and the point just before the time range.
 */
function selectInTimeRange(series: Series, timeRange: ContinuousAxisRange): TimeSeries {
    return series.data
        .filter((datum: Datum, index: number, array: Datum[]) => inTimeRange(datum, index, array, timeRange))
        .map(datum => [datum.time, datum.value])
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

function timeRangeFor(
    seriesName: string,
    timeRanges: Map<string, ContinuousAxisRange>,
    axisAssignments: Map<string, AxesAssignment>
): ContinuousAxisRange {
    const axisName = axisAssignments.get(seriesName)?.xAxis
    if (axisName && axisName.length > 0) {
        return timeRanges.get(axisName) || continuousAxisRangeFor(-100, 100)
    }
    return Array.from(timeRanges.values())[0]
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
