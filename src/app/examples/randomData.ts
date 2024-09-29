import {interval, Observable} from "rxjs";
import {map, scan} from "rxjs/operators";
import {Datum, TimeSeries} from "../charts/timeSeries";
import {TimeSeriesChartData, initialChartData} from "../charts/timeSeriesChartData";
import {BaseSeries, seriesFrom} from "../charts/baseSeries";
// import {ChartData, Datum, initialChartData, Series, seriesFrom} from "stream-charts";

const UPDATE_PERIOD_MS = 25;

/**
 * Creates a random spike for each series and within (time - update_period, time)
 * @param sequenceTime The current time
 * @param series The list of series (identifiers) to update
 * @param seriesMaxTimes A map holding the series name and its associated max time
 * @param spikeProbability The probability threshold for a spike in the tine interval
 * @return A random chart data
 */
function randomSpikeData(
    sequenceTime: number,
    series: Array<string>,
    seriesMaxTimes: Map<string, number>,
    spikeProbability: number = 0.5,
): TimeSeriesChartData {
    const maxTime = Math.max(...Array.from(seriesMaxTimes.values()))
    const maxTimes = new Map(
        Array.from(seriesMaxTimes.entries()).map(([name, maxTime]) => [name, maxTime + sequenceTime])
    )
    return {
        maxTime: sequenceTime,
        maxTimes,
        newPoints: new Map(series
            .filter(_ => Math.random() < spikeProbability)
            .map(name => {
                return [
                name,
                [{
                    time: sequenceTime + maxTime,
                    value: Math.random()
                }]
            ]}))
    };
}

/**
 * Creates random set of time-series data
 * @param series The list of series names (identifiers) to update
 * @param [updatePeriod=25] The time-interval between the generation of subsequent data points
 * @param spikeProbability The probability that a spike occurs in a given time step.
 * @return An observable that produces data.
 */
export function randomSpikeDataObservable(
    series: Array<TimeSeries>,
    updatePeriod: number = UPDATE_PERIOD_MS,
    spikeProbability: number = 0.1
): Observable<TimeSeriesChartData> {
    const seriesNames = series.map(series => series.name)
    const initialData = initialChartData(series)
    return interval(updatePeriod).pipe(
        // convert the number sequence to a time
        map(sequence => (sequence + 1) * updatePeriod),
        // create a random spike for each series
        map((time) => randomSpikeData(time, seriesNames, initialData.maxTimes, spikeProbability))
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
): TimeSeriesChartData {
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
function accumulateChartData(accum: TimeSeriesChartData, currentData: TimeSeriesChartData, min: number, max: number): TimeSeriesChartData {
    return {
        maxTime: currentData.maxTime,
        maxTimes: currentData.maxTimes,
        newPoints: mergeSeries(accum.newPoints, currentData.newPoints, min, max)
    }
}

/**
 * *Side effect*
 * Calculates the successive differences in the values to create a random walk for simulating neuron weights.
 * Updates the specified `accum` parameter.
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
        const newData = data.map((datum, index) => ({
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
    series: Array<TimeSeries>,
    delta: number,
    updatePeriod: number = 25,
    min: number = -1,
    max: number = 1
): Observable<TimeSeriesChartData> {
    const seriesNames = series.map(series => series.name)
    const initialData = initialChartData(series)
    return interval(updatePeriod).pipe(
        // convert the number sequence to a time
        map(sequence => (sequence + 1) * updatePeriod),

        // create a new (time, value) for each series
        map(time => randomWeightData(time, seriesNames, initialData.maxTimes, updatePeriod, delta)),

        // add the random value to the previous random value in succession to create a random walk for each series
        scan((acc, value) => accumulateChartData(acc, value, min, max), initialData)
    );
}

export function initialRandomWeightData(
    seriesNames: Array<string>,
    initialTime: number,
    initialValue: number,
    updatePeriod: number,
    delta: number,
    numTimes: number
): Array<BaseSeries<Datum>> {
    return seriesNames.map(name => {
        const data: Array<Datum> = []
        // let prevTime = Math.max(0, initialTime - Math.ceil(Math.random() * updatePeriod))
        let prevValue = initialValue + (Math.random() - 0.5) * 2 * delta
        for(let i = 0; i < numTimes; ++i) {
            const time = initialTime + i * updatePeriod + Math.ceil(Math.random() * updatePeriod)
            const value = prevValue + (Math.random() - 0.5) * 2 * delta
            data.push({time: time, value})
            // prevTime = time
            prevValue = value
        }
        return seriesFrom<Datum>(name, data)
    })
}

