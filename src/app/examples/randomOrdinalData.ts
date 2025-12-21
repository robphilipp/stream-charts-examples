/*
 * for the StreamingBarChart
 */

import {BaseSeries, seriesFrom} from "../charts/series/baseSeries";
import {Datum, datumOf} from "../charts/series/timeSeries";
import {TimeSeriesChartData} from "../charts/series/timeSeriesChartData";
import {concat, from, interval, Observable} from "rxjs";
import {map, scan} from "rxjs/operators";
import {OrdinalDatum} from "../charts/series/ordinalSeries";

export function sinFn(x: number, period: number): number {
    return Math.sin(2 * Math.PI * x / period)
}

/**
 * Creates the initial data for the sine function
 * @param seriesNames The names of the series
 * @param timeInterval The time between points (the x-values)
 * cycle of the sin function
 * @param numPoints The number of points to create
 * @return An array holding the series for each of the specified series names
 */
export function initialSineFnData(
    seriesNames: Array<string>,
    timeInterval: number,
    numPoints: number
): Array<BaseSeries<Datum>> {
    const intercept = 0.1
    const slope = 0.3 / seriesNames.length
    return seriesNames.map((name, index) => {
        const data: Array<Datum> = []
        for (let x = 0; x < numPoints; x++) {
            const sequenceTime = x * timeInterval
            data.push(datumOf(
                    sequenceTime,
                    Math.cos((6 * index) * Math.PI / seriesNames.length) * // envelope for x
                    Math.min(1, (1.2 + Math.sin(sequenceTime * Math.PI / 1513)) / 2) * // time-evolving envelope
                    Math.sin((sequenceTime / 27 + x) * Math.PI / seriesNames.length / 2) + // series values
                    slope * index - intercept
                )
            )
        }
        return seriesFrom<Datum>(name, data)
    })
}

/**
 * Creates a time-series chart data object based on the values from the time-series
 * @param seriesList The list of series names (identifiers) to update
 * @param [currentTime=0] The current time
 * @return An empty chart data object
 */
export function initialOrdinalChartData(seriesList: Array<BaseSeries<OrdinalDatum>>, currentTime: number = 0): TimeSeriesChartData {
    const maxTime = seriesList.reduce(
        (tMax, series) => Math.max(tMax, series.last().map(datum => datum.time).getOrElse(-Infinity)),
        -Infinity
    )
    return {
        seriesNames: new Set(seriesList.map(series => series.name)),
        maxTime,
        maxTimes: new Map(seriesList.map(series => [series.name, series.last().map(datum => datum.time).getOrElse(0)])),
        newPoints: new Map<string, Array<Datum>>(seriesList.map(series => [
            series.name,
            series.data.map(datum => ({time: datum.time, value: datum.value})),
        ])),
        currentTime: currentTime
    }
}

/**
 * Creates random set of time-series data, designed to make the bar chart dance
 * @param series The number of time-series for which to generate data (i.e. one for each neuron)
 * @param [updatePeriod=25] The time-interval between the generation of subsequent data points
 * @param [min=-1] The minimum allowed value
 * @param [max=1] The maximum allowed value
 * @return An observable that produces data.
 */
export function barDanceDataObservable(
    series: Array<BaseSeries<OrdinalDatum>>,
    // series: Array<TimeSeries>,
    updatePeriod: number = 25,
    min: number = -1,
    max: number = 1
): Observable<TimeSeriesChartData> {
    const seriesNames = series.map(series => series.name)
    const initialData = initialOrdinalChartData(series)
    // prepend the initial data to the observable created using the update period
    return concat(
        // create an observable from the initial data
        from([initialData]),
        // create and observable that issues data at each update period
        interval(updatePeriod).pipe(
            // convert the number sequence to a time
            map(sequence => (sequence + 1) * updatePeriod + initialData.maxTime + updatePeriod),

            // create a new (time, value) for each series
            map(time => barDanceData(time, seriesNames, initialData.maxTimes)),
        )
    ).pipe(
        // create an observable for the ordinal chart data
        scan((accumulated, chartData) => ({
            seriesNames: new Set(accumulated.seriesNames),
            maxTime: chartData.maxTime,
            maxTimes: chartData.maxTimes,
            newPoints: mergeOrdinalSeries(accumulated.newPoints, chartData.newPoints, min, max)
        }))
    )
}

/**
 * *Side effect*
 * Updates the specified `accum` parameter.
 * @param accum The "position" in the random walk
 * @param incoming The changes in position
 * @param min The minimum allowed value
 * @param max The maximum allowed value
 * @return The merged map holding the new random walk segments
 */
function mergeOrdinalSeries(
    accum: Map<string, Array<Datum>>,
    incoming: Map<string, Array<Datum>>,
    min: number,
    max: number
): Map<string, Array<Datum>> {
    incoming.forEach((data, name) => {
        const newData = data.map((datum, index) => ({
            time: datum.time,
            value: index === 0 ? Math.max(min, Math.min(max, datum.value)) : data[index - 1].value + datum.value
        }))
        accum.set(name, newData);
    })
    return accum;
}

/**
 * Some complicated function to make the bars dance
 * @param sequenceTime The current time
 * @param seriesNames An array holding the names of the series
 * @param seriesMaxTimes A map holding the maximum time for each series (map(series_name -> max_time))
 * @return A time-series chart data
 */
function barDanceData(
    sequenceTime: number,
    seriesNames: Array<string>,
    seriesMaxTimes: Map<string, number>,
): TimeSeriesChartData {
    const maxTimes = new Map(Array.from(
        seriesMaxTimes.entries()).map(([name, maxTime]) => [name, maxTime + sequenceTime])
    )
    const intercept = 0.1
    const slope = 0.3 / seriesNames.length
    return {
        seriesNames: new Set(seriesNames),
        maxTime: sequenceTime,
        maxTimes,
        newPoints: new Map(seriesNames.map((name, index) => {
            return [
                name,
                [{
                    time: sequenceTime,
                    value: Math.cos((6 * index) * Math.PI / seriesNames.length) * // envelope for index
                        Math.min(1, (1.2 + Math.sin(sequenceTime * Math.PI / 1513)) / 2) * // time-evolving envelope
                        Math.sin((sequenceTime / 27 + index) * Math.PI / seriesNames.length / 2) + // series values
                        slope * index - intercept,
                }]
            ]
        }))
    };
}