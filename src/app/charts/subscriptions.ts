import {bufferTime, map, mergeAll, mergeWith} from "rxjs/operators";
import {ContinuousNumericAxis, continuousRange, timeRanges} from "./axes";
import {Datum, TimeSeries} from "./timeSeries";
import {ContinuousAxisRange, continuousAxisRangeFor} from "./continuousAxisRangeFor";
import {interval, Observable, Subscription} from "rxjs";
import {ChartData} from "./chartData";
import {AxesAssignment} from "./plot";
import {AxesState} from "./hooks/AxesState";
import {emptySeries} from "./baseSeries";
import {IterateChartData} from "./iterates";
import {emptyIterateDatum, IterateDatum, IterateSeries} from "./iterateSeries";

/**
 * Creates a subscription to the series observable with the data stream. The common code is
 * shared by the plots.
 * @param seriesObservable The series observable holding the stream of chart data
 * @param onSubscribe Callback for when the observable is subscribed to
 * @param windowingTime Basically the update time when data is collected and then rendered
 * @param axisAssignments The assignment of the series to their x- and y-axes
 * @param xAxesState The current state of the x-axis
 * @param onUpdateData Callback for when data is updated
 * @param dropDataAfter Limits the amount of data stored. Any data older than this value (ms) will
 * be dropped on the next update
 * @param updateTimingAndPlot The callback function to update the plot and timing
 * @param seriesMap The series-name and the associated series
 * @param setCurrentTime Callback to update the current time based on the streamed data
 * @return A subscription to the observable (for cancelling and the likes)
 */
export function subscriptionFor(
    seriesObservable: Observable<ChartData>,
    onSubscribe: (subscription: Subscription) => void,
    windowingTime: number,
    axisAssignments: Map<string, AxesAssignment>,
    xAxesState: AxesState,
    onUpdateData: ((seriesName: string, data: Array<Datum>) => void) | undefined,
    dropDataAfter: number,
    updateTimingAndPlot: (ranges: Map<string, ContinuousAxisRange>) => void,
    seriesMap: Map<string, TimeSeries>,
    setCurrentTime: (axisId: string, end: number) => void
): Subscription {
    const subscription = seriesObservable
        .pipe(bufferTime(windowingTime))
        .subscribe(dataList => {
            dataList.forEach(data => {
                // grab the time-windows for the x-axes
                const timesWindows = timeRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>);

                //
                // calculate the max times for each x-axis, which is the max time over all the
                // series assigned to an x-axis

                // get the series associated with each axis (Map<axis_id, [series_names]>)
                const axesSeries = determineAssociatedSeries(data, axisAssignments, xAxesState)

                // add each new point to it's corresponding series, the new points
                // is a map(series_name -> new_point[])
                data.newPoints.forEach((newData, name) => {
                    // grab the current series associated with the new data
                    const series = seriesMap.get(name) || emptySeries(name)

                    // update the handler with the new data point
                    if (onUpdateData) onUpdateData(name, newData)

                    // add the new data to the series
                    series.data.push(...newData)

                    // calculate the current time for the series' assigned x-axis (which may end up
                    // just being the default) based on the max time for the series, and the overall
                    // max time
                    const axisId = axisAssignments.get(name)?.xAxis || xAxesState.axisDefaultName();
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

                        // update the time range for the x-axis, and if the time range
                        // needs to be updated, then recalculate the time range for the
                        // axis, update the time windows, and call the setCurrentTime
                        // callback to update the current time for the caller
                        const range = timesWindows.get(axisId)
                        if (range !== undefined && range.end < currentAxisTime) {
                            const timeWindow = range.end - range.start
                            const timeRange = continuousAxisRangeFor(
                                Math.max(0, currentAxisTime - timeWindow),
                                Math.max(currentAxisTime, timeWindow)
                            )
                            timesWindows.set(axisId, timeRange)
                            setCurrentTime(axisId, timeRange.end) // callback
                        }
                    }
                })

                // update the data
                updateTimingAndPlot(timesWindows)  // callback
            })
        })

    // provide the subscription to the caller
    onSubscribe(subscription)   // callback

    return subscription
}

/**
 * **Function has side effects on the Series (for performance).**
 *
 * Creates a subscription to the series observable with the data stream. The common code is
 * shared by the plots.
 * @param seriesObservable The series observable holding the stream of chart data
 * @param onSubscribe Callback for when the observable is subscribed to
 * @param windowingTime Basically the update time when data is collected and then rendered
 * @param axisAssignments The assignment of the series to their x- and y-axes
 * @param xAxesState The current state of the x-axis
 * @param onUpdateData Callback for when data is updated
 * @param dropDataAfter Limits the amount of data stored. Any data older than this value (ms) will
 * be dropped on the next update
 * @param updateTimingAndPlot The callback function to update the plot and timing
 * @param seriesMap The series-name and the associated series
 * @param setCurrentTime Callback to update the current time based on the streamed data
 * @param cadencePeriod The number of milliseconds between time updates
 * @return A subscription to the observable (for cancelling and the likes)
 */
export function subscriptionWithCadenceFor(
    seriesObservable: Observable<ChartData>,
    onSubscribe: (subscription: Subscription) => void,
    windowingTime: number,
    axisAssignments: Map<string, AxesAssignment>,
    xAxesState: AxesState,
    onUpdateData: ((seriesName: string, data: Array<Datum>) => void) | undefined,
    dropDataAfter: number,
    updateTimingAndPlot: (ranges: Map<string, ContinuousAxisRange>) => void,
    seriesMap: Map<string, TimeSeries>,
    setCurrentTime: (axisId: string, end: number) => void,
    cadencePeriod: number
): Subscription {
    const maxTime = Array.from(seriesMap.entries())
        .reduce(
            (tMax, [, series]) => Math.max(tMax, series.last().map(datum => datum.time).getOrElse(tMax)),
            -Infinity
        )
    const cadence = interval(cadencePeriod)
        .pipe(
            map(value => ({
                currentTime: value * cadencePeriod,
                    maxTime: value * cadencePeriod,
                    maxTimes: new Map(),
                    newPoints: new Map()
                } as ChartData)
            )
        )

    const subscription = seriesObservable
        .pipe(
            mergeWith(cadence),
            bufferTime(windowingTime),
            mergeAll(),
        )
        .subscribe(data => {
            // grab the time-windows for the x-axes
            const timesWindows = timeRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)

            if (data.currentTime !== undefined) {
                xAxesState.axisIds().forEach(axisId => {
                    const range = timesWindows.get(axisId)
                    if (range !== undefined && data.currentTime !== undefined) {
                        const timeWindow = (range.end - range.start)
                        const timeRange = continuousAxisRangeFor(
                            Math.max(0, Math.max(range.end, data.currentTime + maxTime) - timeWindow),
                            Math.max(Math.max(range.end, data.currentTime + maxTime), timeWindow)
                        )
                        timesWindows.set(axisId, timeRange)
                        setCurrentTime(axisId, data.currentTime + maxTime)
                    }
                })
            }

            if (data.newPoints.size === 0) {
                updateTimingAndPlot(timesWindows)
                return
            }

            // determine which series belong to each x-axis
            const axesSeries = determineAssociatedSeries(data, axisAssignments, xAxesState)

            // add each new point to it's corresponding series, the new points
            // is a map(series_name -> new_point[])
            data.newPoints.forEach((newData, name) => {
                // grab the current series associated with the new data
                const series = seriesMap.get(name) || emptySeries(name);

                // update the handler with the new data point
                if (onUpdateData) onUpdateData(name, newData);

                // add the new data to the series
                series.data.push(...newData);

                // drop data when specified
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
                }
            })

            // update the data
            updateTimingAndPlot(timesWindows)
        })

    // provide the subscription to the caller
    onSubscribe(subscription)

    return subscription
}

/**
 * Creates a subscription to the series observable with the data stream. The common code is
 * shared by the plots.
 * @param seriesObservable The series observable holding the stream of chart data
 * @param onSubscribe Callback for when the observable is subscribed to
 * @param windowingTime Basically the update time when data is collected and then rendered
 * @param axisAssignments The assignment of the series to their x- and y-axes
 * @param xAxesState The current state of the x-axis
 * @param yAxesState The current state of the y-axis
 * @param onUpdateData Callback for when data is updated
 * @param dropDataAfter Limits the amount of data stored. Any data older than this value (ms) will
 * be dropped on the next update
 * @param updateRangesAndPlot The callback function to update the plot and timing
 * @param seriesMap The series-name and the associated series
 * @param updateCurrentTime Callback to update the current time based on the streamed data
 * @return A subscription to the observable (for cancelling and the likes)
 */
export function subscriptionIteratesFor(
    seriesObservable: Observable<IterateChartData>,
    onSubscribe: (subscription: Subscription) => void,
    windowingTime: number,
    axisAssignments: Map<string, AxesAssignment>,
    xAxesState: AxesState,
    yAxesState: AxesState,
    onUpdateData: ((seriesName: string, data: Array<IterateDatum>) => void) | undefined,
    dropDataAfter: number,
    updateRangesAndPlot: (xRanges: Map<string, ContinuousAxisRange>, yRanges: Map<string, ContinuousAxisRange>) => void,
    seriesMap: Map<string, IterateSeries>,
    updateCurrentTime: (time: number) => void
): Subscription {
    const subscription = seriesObservable
        .pipe(bufferTime(windowingTime))
        .subscribe(dataList => {
            dataList.forEach(data => {
                // calculate the bounds for each of the x- and y-axes
                const xAxesRanges = continuousRange(xAxesState.axes as Map<string, ContinuousNumericAxis>)
                const yAxesRanges = continuousRange(yAxesState.axes as Map<string, ContinuousNumericAxis>)

                // create the functions to retrieve the x- and y-axes IDs from a given series name
                const xAxisIdFn = xAxisIdFrom(xAxesState, axisAssignments)  // f[n](x)
                const yAxisIdFn = yAxisIdFrom(yAxesState, axisAssignments)  // f[n+1](x)

                // for each (of the possible 4) axes, calculate the which series are assigned to them.
                // for example, series A could be assigned to the bottom x-axis, and the right y-axis, and
                // series B could be assigned to the top x-axis and the left y-axis, etc.
                const xAxesSeries = iterateSeriesToAxesMapping(data, seriesName => xAxisIdFn(seriesName))
                const yAxesSeries = iterateSeriesToAxesMapping(data, seriesName => yAxisIdFn(seriesName))

                // add each new point to its corresponding series, the newPoints object
                // is a map(series_name -> new_point[])
                data.newPoints.forEach((newData, seriesName) => {
                    // grab the current series associated with the new data
                    const series = seriesMap.get(seriesName) || emptySeries(seriesName)

                    // update the handler with the new data points
                    if (onUpdateData) onUpdateData(seriesName, newData)

                    // add the new data to the series
                    series.data.push(...newData)

                    const xAxisId = xAxisIdFn(seriesName)
                    const yAxisId = yAxisIdFn(seriesName)

                    function calculateBounds(
                        range: ContinuousAxisRange,
                        minIterate: IterateDatum,
                        maxIterate: IterateDatum,
                        iterateFn: (iterate: IterateDatum) => number
                    ): ContinuousAxisRange {
                        return continuousAxisRangeFor(
                            Math.min(iterateFn(minIterate), range.start),
                            Math.max(iterateFn(maxIterate), range.end)
                        )
                    }

                    // calculate and set the new bounds on the x- and y-axes, which may or may not have changed
                    const minIterate = data.minIterates.get(seriesName)
                    const maxIterate = data.maxIterates.get(seriesName)

                    if (minIterate !== undefined && maxIterate !== undefined) {
                        const xRange = xAxesRanges.get(xAxisId)
                        if (xRange !== undefined) {
                            xAxesRanges.set(seriesName, calculateBounds(xRange, minIterate, maxIterate, iterate => iterate.iterateN))
                        }
                        const yRange = yAxesRanges.get(yAxisId)
                        if (yRange !== undefined) {
                            yAxesRanges.set(seriesName, calculateBounds(yRange, minIterate, maxIterate, iterate => iterate.iterateN_1))
                        }
                    }

                    // calculate and update the current time, which will be that max time of the
                    // f[n+1](x) values (y-axis)
                    const lastMaxUpdateTime = data.maxIterate.time
                    const currentTime = yAxesSeries.get(xAxisId)
                        ?.reduce(
                            (tMax, name) => {
                                const iterateData = data.newPoints.get(name)
                                if (iterateData !== undefined) {
                                    return Math.max(iterateData[iterateData.length - 1].time || lastMaxUpdateTime, tMax)
                                }
                                return tMax
                            },
                            -Infinity
                        ) || lastMaxUpdateTime

                    updateCurrentTime(currentTime)
                })

                // update the data
                updateRangesAndPlot(xAxesRanges, yAxesRanges)
            })
        })

    // provide the subscription to the caller
    onSubscribe(subscription)

    return subscription
}

/**
 * Determines which series are assigned to which x-axes, and returns a map holding the
 * x-axis names and their associated list of series
 * @param data The chart data
 * @param axisAssignments A map holding the  series names and its associated x-axis and y-axis names
 * @param xAxesState Holds information about the axis and how it is displayed
 * @return A map holding the x-axis names the names of the series associated with the axis.
 */
function determineAssociatedSeries(data: ChartData, axisAssignments: Map<string, AxesAssignment>, xAxesState: AxesState): Map<string, Array<string>> {
    return Array
        .from(data.maxTimes.entries())
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
}

/**
 * Higher-order function that returns a function which maps a series name to its x-axis
 * ID by forming a closure over the x-axis state and the axis assignments
 * @param axesState The x-axis state
 * @param axisAssignments The axis assignments
 * @return a function that accepts a series name and returns the corresponding axis ID
 */
function xAxisIdFrom(
    axesState: AxesState,
    axisAssignments: Map<string, AxesAssignment>
): (seriesName: string) => string {
    return seriesName => axisAssignments.get(seriesName)?.xAxis || axesState.axisDefaultName()
}

/**
 * Higher-order function that returns a function which maps a series name to its y-axis
 * ID by forming a closure over the y-axis state and the axis assignments
 * @param axesState The y-axis state
 * @param axisAssignments The axis assignments
 * @return a function that accepts a series name and returns the corresponding axis ID
 */
function yAxisIdFrom(
    axesState: AxesState,
    axisAssignments: Map<string, AxesAssignment>
): (seriesName: string) => string {
    return seriesName => axisAssignments.get(seriesName)?.yAxis || axesState.axisDefaultName()
}

/**
 * Generates a map that associates an axis-id with an array of iterate-series names that are
 * assigned to that axis
 * @param data The iterate chart data
 * @param axisIdFromSeriesNameFn Function that accepts a series name and returns that ID of the axis to
 * which the series is assigned.
 * @return A map that associates an axis-id with an array of iterate-series names that are
 * assigned to that axis
 */
function iterateSeriesToAxesMapping(
    data: IterateChartData,
    axisIdFromSeriesNameFn: (seriesName: string) => string
): Map<string, Array<string>> {
    return Array
        .from(data.maxIterates.entries())
        .reduce(
            (assignedSeries, [seriesName,]) => {
                const id = axisIdFromSeriesNameFn(seriesName)
                const as = assignedSeries.get(id) || []
                as.push(seriesName)
                assignedSeries.set(id, as)
                return assignedSeries
            },
            new Map<string, Array<string>>()
        )
}
