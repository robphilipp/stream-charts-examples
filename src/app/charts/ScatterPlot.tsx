import {useCallback, useEffect, useRef} from 'react'
import {useChart} from "./useChart";
import {ContinuousAxisRange, continuousAxisRangeFor} from "./continuousAxisRangeFor";
import * as d3 from "d3";
import {setClipPath, TimeSeries} from "./plot";
import {Datum, emptySeries, Series} from "./datumSeries";
import {BaseAxis, calculatePanFor, defaultLineStyle, ContinuousNumericAxis} from "./axes";
import {GSelection} from "./d3types";
import {PlotDimensions} from "stream-charts/dist/src/app/charts/margins";
import {Observable, Subscription} from "rxjs";
import {windowTime} from "rxjs/operators";
import {ChartData} from "./chartData";
import {noop} from "./utils";

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
        // windowingTimes,

        onSubscribe = noop,
        onUpdateData = noop,
        onUpdateTime = noop,
    } = useChart()

    const {
        axisAssignments = new Map<string, AxesAssignment>(),
    } = props

    const liveDataRef = useRef<Map<string, Series>>(new Map(initialData.map(series => [series.name, series])))
    const seriesRef = useRef<Map<string, Series>>(new Map(initialData.map(series => [series.name, series])))
    // const currentTimeRef = useRef<number>(0)
    // map(axis_id -> current_time) -- maps the axis ID to the current time for that axis
    // const currentTimeRef = useRef<Map<string, number>>(new Map(initialData.map(series => [series.name, 0])))
    const currentTimeRef = useRef<Map<string, number>>(new Map())
    // const xAxesLinearRef = useRef<Map<string, ContinuousNumericAxis>>()
    const timeRangesRef = useRef<Map<string, ContinuousAxisRange>>()

    useEffect(
        () => {
            currentTimeRef.current = new Map(Array.from(xAxes().keys()).map(id => [id, 0]))
        },
        [xAxes]
    )

    const updatePlot = useCallback(
        /**
         * Updates the plot data for the specified time-range, which may have changed due to zoom or pan
         * @param timeRanges The current time range
         * @param mainGElem The main <g> element selection for that holds the plot
         */
        (timeRanges: Map<string, ContinuousAxisRange>, mainGElem: GSelection) => {
            /**
             * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
             * @param deltaX The amount that the plot is dragged
             * @param plotDimensions The dimensions of the plot
             * @param series An array of series names
             * @param timeRanges A map holding the axis ID and its associated axis
             * @param mainG The main <g> element holding the plot
             */
            function onPan(
                deltaX: number,
                plotDimensions: PlotDimensions,
                series: Array<string>,
                timeRanges: Map<string, ContinuousAxisRange>,
                mainG: GSelection
            ): void {
                series
                    // grab the x-axis assigned to the series, or use a the default x-axis if not
                    // assignment has been made
                    .map(name => axisAssignments.get(name)?.xAxis || xAxisDefaultName())
                    // de-dup the array of axis IDs so that we don't end up applying the pan transformation
                    // more than once
                    .reduce((accum: Array<string>, axisId: string) => {
                        if (!accum.find(id => id === axisId)) {
                            accum.push(axisId)
                        }
                        return accum
                    }, [])
                    // run through the axis IDs, adjust their domain, and update the time-range set for that
                    // axis
                    .forEach(axisId => {
                        const xAxis = xAxisFor(axisId) as ContinuousNumericAxis
                        const timeRange = timeRanges.get(axisId)
                        if (timeRange) {
                            // calculate the change in the time-range based on the pixel change from the drag event
                            const {start, end} = calculatePanFor(deltaX, plotDimensions, xAxis, timeRange)

                            // update the time-range for the axis
                            timeRanges.set(axisId, continuousAxisRangeFor(start, end))

                            setTimeRangeFor(axisId, [start, end])

                            // update the axis' time-range
                            xAxis.update([start, end], plotDimensions, margin)
                        }
                    })

                // need to update the plot with the new time-ranges
                updatePlot(timeRanges, mainG)
            }

            if (container) {
                // select the svg element bind the data to them
                const svg = d3.select<SVGSVGElement, any>(container)

                // create a map associating series-names to their time-series, which are represented
                // as an array of (time, value)-pairs
                const boundedSeries: Map<string, Array<[number, number]>> = new Map()
                initialData.forEach(series =>
                    boundedSeries.set(
                        series.name,
                        selectInTimeRange(series, timeRangeFor(series.name, timeRanges, axisAssignments))
                    )
                )
                // initialData
                //     .forEach((series, name) =>
                //         boundedSeries.set(
                //             name,
                //             selectInTimeRange(series, timeRangeFor(name, timeRanges, axisAssignments))
                //         ))
                // liveDataRef.current
                //     .forEach((series, name) => boundedSeries.set(name, selectInTimeRange(series)))
                //
                // // calculate and update the min and max values for updating the y-axis. only updates when
                // // the min is less than the historical min, and the max is larger than the historical max.
                // minMaxValueRef.current = minMaxYFor(Array.from(boundedSeries.values()), minMaxValueRef.current)
                //
                // // update the x and y axes
                // const [minValue, maxValue] = minMaxValueRef.current
                // axesRef.current.xAxis.update([timeRangeRef.current.start, timeRangeRef.current.end], plotDimensions, margin)
                // axesRef.current.yAxis.update([Math.max(minY, minValue), Math.min(maxY, maxValue)], plotDimensions, margin)
                //
                // // create/update the magnifier lens if needed
                // magnifierRef.current = magnifierLens(svg, magnifierStyle.visible)
                //
                // // create/update the tracker line if needed
                // trackerRef.current = trackerControl(svg, trackerStyle.visible)

                // set up panning
                const drag = d3.drag<SVGSVGElement, Datum>()
                    .on("start", () => {
                        // during a pan, we want to hide the tooltip
                        // tooltipRef.current.visible = false
                        // handleRemoveTooltip()
                        d3.select(container).style("cursor", "move")
                    })
                    .on("drag", () => onPan(d3.event.dx, plotDimensions, Array.from(boundedSeries.keys()), timeRanges, mainGElem))
                    .on("end", () => {
                        // if the tooltip was originally visible, then allow it to be seen again
                        // tooltipRef.current.visible = tooltipStyle.visible
                        d3.select(container).style("cursor", "auto")
                    })

                svg.call(drag)

                // // set up for zooming
                // const zoom = d3.zoom<SVGSVGElement, Datum>()
                //     .scaleExtent([0, 10])
                //     .translateExtent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
                //     .on("zoom", () => {
                //         onZoom(d3.event.transform, d3.event.sourceEvent.offsetX - margin.left, plotDimensions)
                //     })
                //
                // svg.call(zoom)

                // define the clip-path so that the series lines don't go beyond the plot area
                const clipPathId = setClipPath(chartId, svg, plotDimensions, margin)

                boundedSeries.forEach((data, name) => {

                    if (data.length === 0) return
                    const [xAxisLinear, yAxisLinear] = axesFor(name, axisAssignments, xAxisFor, yAxisFor)
                    if (xAxisLinear === undefined || yAxisLinear === undefined) return
                    const {color, lineWidth} = seriesStyles.get(name) || defaultLineStyle

                    // only show the data for which the filter matches
                    // const plotData = (series.name.match(seriesFilterRef.current)) ? data : []
                    const plotData = (name.match(seriesFilter)) ? data : []
                    // const plotData = data

                    // create the time-series paths
                    mainGElem
                        .selectAll(`#${name}`)
                        .data([[], plotData], () => `${name}`)
                        .join(
                            enter => enter
                                .append("path")
                                .attr("class", 'time-series-lines')
                                .attr("id", `${name}`)
                                // .attr("id", `${series.name}`)
                                .attr("d", d3.line()
                                    .x((d: [number, number]) => xAxisLinear.scale(d[0]))
                                    .y((d: [number, number]) => yAxisLinear.scale(d[1]))
                                )
                                .attr("fill", "none")
                                .attr("stroke", color)
                                .attr("stroke-width", lineWidth)
                                // .attr("stroke", colorsRef.current.get(name) || lineStyle.color)
                                // .attr("stroke-width", lineStyle.lineWidth)
                                .attr('transform', `translate(${margin.left}, ${margin.top})`)
                                .attr("clip-path", `url(#${clipPathId})`),
                            // .attr("clip-path", `url(#clip-series-${chartId.current})`)
                            // .on(
                            //     "mouseover",
                            //     (datumArray, i, group) =>
                            //         tooltipRef.current.visible ? handleShowTooltip(datumArray, name, group[i]) : null
                            // )
                            // .on(
                            //     "mouseleave",
                            //     (datumArray, i, group) =>
                            //         tooltipRef.current.visible ?
                            //             handleRemoveTooltip(name, group[i]) :
                            //             null
                            // ),
                            update => update,
                            exit => exit.remove()
                        )
                })
            }
        },
        [
            chartId,
            container, margin, plotDimensions,
            setTimeRangeFor,
            initialData, seriesFilter, seriesStyles, axisAssignments,
            xAxisDefaultName, xAxisFor, yAxisFor
        ]
    )

    const subscribe = useCallback(
        () => {
            if (seriesObservable === undefined || mainG === null) return undefined

            const subscription = seriesObservable
                .pipe(windowTime(windowingTime))
                .subscribe(dataList => {
                    dataList.forEach(data => {
                        // // updated the current time to be the max of the new data
                        // currentTimeRef.current = data.maxTime

                        const timesWindows = timeRanges(xAxes() as Map<string, ContinuousNumericAxis>)

                        // calculate the max times for each x-axis, which is the max time over all the
                        // series assigned to an x-axis
                        const axesSeries = Array.from(data.maxTimes.entries())
                            .reduce(
                                (assignedSeries, [seriesName, maxTime]) => {
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
                            // const currentAxisTime = currentTimeRef.current.get(axisId)
                            if (currentAxisTime !== undefined) {
                                // drop data that is older than the max time-window
                                // todo replace the infinity
                                // while (currentAxisTime - series.data[0].time > dropDataAfter) {
                                while (currentAxisTime - series.data[0].time > Infinity) {
                                    series.data.shift()
                                }

                                // const timesWindows = timeRanges(xAxes() as Map<string, ContinuousNumericAxis>)
                                const range = timesWindows.get(axisId)
                                if (range !== undefined && range.end < currentAxisTime) {
                                    // onUpdateTime(currentAxisTime)
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
                        timeRangesRef.current = timesWindows
                    }).then(() => {
                        if (timeRangesRef.current !== undefined) {
                            onUpdateTime(timeRangesRef.current)
                            // update the x-axes with the new time-range
                            // timeRangesRef.current.forEach((range, id) => {
                            //         (xAxisFor(id) as ContinuousNumericAxis)
                            //             .update([range.start, range.end], plotDimensions, margin)
                            //     }
                            // )
                            updatePlot(timeRangesRef.current, mainG)
                        }
                    })
                })

            // provide the subscription to the caller
            onSubscribe(subscription)

            return subscription
        },
        [axisAssignments, mainG, onSubscribe, onUpdateData, onUpdateTime, seriesObservable, updatePlot, windowingTime, xAxes, xAxisDefaultName]
    )

    // useEffect(
    //     () => {
    //         timeRangesRef.current?.forEach((range, id) =>
    //             (xAxisFor(id) as ContinuousNumericAxis)
    //                 .update([range.start, range.end], plotDimensions, margin)
    //         )
    //     },
    //     [margin, plotDimensions, xAxisFor]
    // )

    useEffect(
        () => {
            if (container && mainG) {
                const xAxesLinear = new Map<string, ContinuousNumericAxis>(
                    Array.from(xAxes().entries()).map(([id, axis]) => [id, axis as ContinuousNumericAxis])
                )
                updatePlot(timeRanges(xAxesLinear), mainG)
                // updatePlot(timeRanges(xAxesLinearRef.current), mainG)
            }
        },
        [chartId, color, container, mainG, plotDimensions, updatePlot, xAxes]
    )

    const subscriptionRef = useRef<Subscription>()
    // called on mount, dismount and when shouldSubscribe changes
    useEffect(
        () => {
            if (shouldSubscribe && subscriptionRef.current === undefined) {
                subscriptionRef.current = subscribe()
                // const subscription = subscribe()

                // stop the stream on dismount
                // return () => subscription?.unsubscribe()
            } else if (!shouldSubscribe) {
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
// function timeRanges(xAxes: Map<string, BaseAxis>): Map<string, ContinuousAxisRange> {
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
        const timeRange = timeRanges.get(axisName)
        if (timeRange) {
            return timeRange
        }
        return continuousAxisRangeFor(-100, 100)
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

