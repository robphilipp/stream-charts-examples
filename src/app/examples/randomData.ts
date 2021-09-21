import {interval, Observable} from "rxjs";
import {map, scan} from "rxjs/operators";
import {Datum, Series} from "../charts/datumSeries";
import {ChartData, initialChartData} from "../charts/chartData";

const UPDATE_PERIOD_MS = 25;

/**
 * Creates a random spike for each series and within (time - update_period, time)
 * @param sequenceTime The current time
 * @param series The list of series (identifiers) to update
 * @param seriesMaxTimes A map holding the series name and its associated max time
 * @param updatePeriod The update period (ms)
 * @return A random chart data
 */
function randomSpikeData(
    sequenceTime: number,
    series: Array<string>,
    seriesMaxTimes: Map<string, number>,
    updatePeriod: number
): ChartData {
    const maxTime = Math.max(...Array.from(seriesMaxTimes.values()))
    const maxTimes = new Map(
        Array.from(seriesMaxTimes.entries()).map(([name, maxTime]) => [name, maxTime + sequenceTime])
    )
    return {
        maxTime: sequenceTime,
        maxTimes,
        newPoints: new Map(series
            .filter(_ => Math.random() > 0.5)
            .map(name => {
                // const maxTime = seriesMaxTimes.get(name) || 0
                return [
                name,
                [{
                    time: sequenceTime + maxTime,// - Math.ceil(Math.random() * updatePeriod),
                    value: Math.random()
                }]
            ]}))
    };
    // const maxTimes = new Map(
    //     Array.from(seriesMaxTimes.entries()).map(([name, maxTime]) => [name, maxTime + sequenceTime])
    // )
    // return {
    //     maxTime: sequenceTime,
    //     maxTimes,
    //     newPoints: new Map(series
    //         .filter(_ => Math.random() > 0.5)
    //         .map(name => {
    //             const maxTime = seriesMaxTimes.get(name) || 0
    //             return [
    //             name,
    //             [{
    //                 time: sequenceTime + maxTime,// - Math.ceil(Math.random() * updatePeriod),
    //                 value: Math.random()
    //             }]
    //         ]}))
    // };
}

/**
 * Creates random set of time-series data
 * @param {Array<string>} series The list of series names (identifiers) to update
 * @param {number} [updatePeriod=25] The time-interval between the generation of subsequent data points
 * @return {Observable<SpikesChartData>} An observable that produces data.
 */
export function randomSpikeDataObservable(series: Array<Series>, updatePeriod: number = UPDATE_PERIOD_MS): Observable<ChartData> {
    const seriesNames = series.map(series => series.name)
    const initialData = initialChartData(series)
    return interval(updatePeriod).pipe(
        // convert the number sequence to a time
        map(sequence => (sequence + 1) * updatePeriod),
        // create a random spike for each series
        map((time) => randomSpikeData(time, seriesNames, initialData.maxTimes, updatePeriod))
    );
}

/**
 * Creates random weight data
 * @param sequenceTime The current time
 * @param series The list of series names (identifiers) to update
 * @param seriesMaxTimes The maximum time for each series
 * @param updatePeriod The update period (ms)
 * @param delta The largest change in weight
 * @return The random chart data
 */
function randomWeightData(
    sequenceTime: number,
    series: Array<string>,
    seriesMaxTimes: Map<string, number>,
    updatePeriod: number,
    delta: number,
): ChartData {
    const maxTimes = new Map(Array.from(
        seriesMaxTimes.entries()).map(([name, maxTime]) => [name, maxTime + sequenceTime])
    )
    return {
        maxTime: sequenceTime,
        maxTimes,
        newPoints: new Map(series.map(name => {
            const maxTime = seriesMaxTimes.get(name) || 0
            return [
                name,
                [{
                    time: sequenceTime + maxTime - Math.ceil(Math.random() * updatePeriod),
                    value: (Math.random() - 0.5) * 2 * delta
                }]
            ]
        }))
    };
}


/**
 * Adds the accumulated chart data to the current random one
 * @param accum The accumulated chart data
 * @param currentData The random chart data
 * @param min The minimum allowed value
 * @param max The maximum allowed value
 * @return The accumulated chart data
 */
function accumulateChartData(accum: ChartData, currentData: ChartData, min: number, max: number): ChartData {
    return {
        maxTime: currentData.maxTime,
        maxTimes: currentData.maxTimes,
        newPoints: mergeSeries(accum.newPoints, currentData.newPoints, min, max)
    }
}

/**
 * Calculates the successive differences in the values to create a random walk for simulating neuron weights
 * @param accum The "position" in the random walk
 * @param incoming The changes in position
 * @param min The minimum allowed value
 * @param max The maximum allowed value
 * @return The merged map holding the new random walk segments
 */
function mergeSeries(
    accum: Map<string, Array<Datum>>,
    incoming: Map<string, Array<Datum>>,
    min: number,
    max: number
): Map<string, Array<Datum>> {
    incoming.forEach((data, name) => {
        const accData = accum.get(name) || [];
        const lastAccum = accData.length > 0 ? accData[accData.length - 1].value : 0;
        const newData = data.map((datum, index, array) => ({
            time: datum.time,
            value: index === 0 ? Math.max(min, Math.min(max, lastAccum + datum.value)) : data[index - 1].value + datum.value
        }))
        accum.set(name, newData);
    })
    return accum;
}


/**
 * Creates random set of time-series data, essentially creating a random walk for each series
 * @param series The number of time-series for which to generate data (i.e. one for each neuron)
 * @param delta The max change in weight
 * @param [updatePeriod=25] The time-interval between the generation of subsequent data points
 * @param min The minimum allowed value
 * @param max The maximum allowed value
 * @return An observable that produces data.
 */
export function randomWeightDataObservable(
    series: Array<Series>,
    delta: number,
    updatePeriod: number = 25,
    min: number = -1,
    max: number = 1
): Observable<ChartData> {
    const seriesNames = series.map(series => series.name)
    const initialData = initialChartData(series)
    return interval(updatePeriod).pipe(
        // convert the number sequence to a time
        map(sequence => (sequence + 1) * updatePeriod),
        // map(sequence => (sequence + 1) * updatePeriod + initialData.maxTime),

        // create a new (time, value) for each series
        // map((time, index) => randomWeightData(time + initialData.maxTime, seriesNames, updatePeriod, delta)),
        map((time, index) => randomWeightData(time, seriesNames, initialData.maxTimes, updatePeriod, delta)),

        // add the random value to the previous random value in succession to create a random walk for each series
        scan((acc, value) => accumulateChartData(acc, value, min, max), initialData)
        // scan((acc, value) => accumulateChartData(acc, value), emptyChartData(seriesNames))
    );
}
