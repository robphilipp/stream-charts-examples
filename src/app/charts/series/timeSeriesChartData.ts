import type {Datum, TimeSeries} from "./timeSeries";
import {type ChartData, defaultChartData} from "../observables/ChartData";
import {FastShiftArray} from "./FastShiftArray.ts";

/**
 * The spike-chart data produced by the rxjs observable that is pushed to a streaming chart
 */
export interface TimeSeriesChartData extends ChartData {
    /**
     * The max (latest) time for the data in the newPoints map
     */
    maxTime: number

    /**
     * Holds the association of the series name to the current max time for that series
     */
    maxTimes: Map<string, number>

    /**
     * Map holding the name of the series (the time-series identifier) and the associated
     * data points for that time-series (`map(series_name -> array(datum))`)
     */
    newPoints: Map<string, Array<Datum>>

    /**
     * The current time (for example, when used with cadence)
     */
    currentTime?: number
}

/**
 * Creates an empty chart data object with all the values set to 0
 * @param {Array<string>} series The list of series names (identifiers) to update
 * @return {TimeSeriesChartData} An empty chart data object
 */
export function emptyTimeSeriesChartData(series: Array<string>): TimeSeriesChartData {
    return {
        ...defaultChartData(),
        maxTime: 0,
        maxTimes: new Map(series.map(name => [name, 0])),
        newPoints: new Map<string, Array<Datum>>(series.map(name => [name, [{x: 0, y: 0}]]))
    }
}

/**
 * Creates an empty chart data object with all the values set to 0
 * @param seriesList The list of series names (identifiers) to update
 * @param [currentTime=0] The current time
 * @return An empty chart data object
 */
export function initialTimeSeriesChartData(seriesList: Array<TimeSeries>, currentTime: number = 0): TimeSeriesChartData {
    const maxTime = seriesList.reduce(
        (tMax, series) => Math.max(tMax, series.last().map(datum => datum.x).getOrElse(-Infinity)),
        -Infinity
    )
    return {
        seriesNames: new Set(seriesList.map(series => series.name)),
        maxTime,
        maxTimes: new Map(seriesList.map(series => [series.name, series.last().map(datum => datum.x).getOrElse(0)])),
        newPoints: new Map<string, Array<Datum>>(seriesList.map(series => [
            series.name,
            FastShiftArray.fromArray([{
                x: series.last().map(datum => datum.x).getOrElse(0),
                y: series.last().map(datum => datum.y).getOrElse(0)
            }])
        ])),
        currentTime: currentTime
    }
}
