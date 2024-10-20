import {interval, Observable} from "rxjs";
import {map, scan} from "rxjs/operators";
import {Datum, datumOf, TimeSeries} from "../charts/timeSeries";
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
 * Higher-order function that forms a closure on the tent map's mu and returns
 * a function that calculates the tent map iterates. The tent map is defined as
 * <p>`x[n+1] = f[mu, n](x[n]) = mu * min(x[n], 1 - x[n])`</p>
 * where the `x[n]` must be on the unit interval `[0, 1]`.
 * @param mu The slope of the tent map must be in the interval `[0, 2]`. When
 * the specified {@link mu} is not in this interval, it will be clamped to be
 * in the interval.
 * @return A function that accepts a data collection time and the previous iterate.
 * The `time` does not factor into the evaluation of the next tent-map iterate,
 * but rather is just cargo used for displaying time, if needed. This function returns
 * a {@link Datum} whose y-values are the iterates of the tent-map, and whose
 * x-values are the collection/calculation time.
 */
function tentMapFn(mu: number): (time: number, xn: number) => Datum {
    const cleanMu = Math.max(0, Math.min(mu, 2))

    // the time is just the data collection time and does not factor int
    // the tent map calculation.
    return (time: number, xn: number): Datum => {
        const xn1 = cleanMu * Math.min(xn, 1 - xn)
        return datumOf(time, xn1)
    }
}

export function initialTentMapData(updatePeriod: number, series: Map<string, number>): Array<TimeSeries> {
    return Array.from(series.entries())
        .map(([name, initialTime]) => seriesFrom(name, [datumOf(initialTime + Math.ceil(Math.random() * updatePeriod), Math.random())])
    )
}
// export function initialTentMapData(updatePeriod: number, series: Map<string, number>): Map<string, Datum> {
//     return new Map<string, Datum>(Array.from(series.entries())
//         .map(([name, initialTime]) => [
//             name,
//             {
//                 time: initialTime + Math.ceil(Math.random() * updatePeriod),
//                 value: Math.random()
//             }]
//         )
//     )
// }
// function initialTentMapData(
//     initialTime: number,
//     updatePeriod: number,
//     series: Array<string>
// ): Map<string, Datum> {
//     return new Map<string, Datum>(series
//         .map(name => [
//             name,
//             {
//                 time: initialTime + Math.ceil(Math.random() * updatePeriod),
//                 value: Math.random()
//             }]
//         )
//     )
// }

function tentMapData(
    iterateTime: number,
    series: Array<string>,
    seriesPreviousIterates: Map<string, Datum>,
    tentMap: (time: number, xn: number) => Datum,
    updatePeriod: number
): TimeSeriesChartData {
    const maxTimes = new Map(Array.from(seriesPreviousIterates.entries())
        .map(([name, datum]) => [name, datum.time + iterateTime])
    )
    return {
        maxTime: iterateTime,
        maxTimes,
        newPoints: new Map(series.map(name => {
            const maxTime = maxTimes.get(name) || 0
            const nextIterateTime = iterateTime + maxTime - Math.ceil(Math.random() * updatePeriod)
            const {time, value} = tentMap(nextIterateTime, seriesPreviousIterates.get(name)?.value || 0)
            return [name, [{time, value}]]
        }))
    }
}

export function tentMapObservable(
    mu: number,
    series: Array<TimeSeries>,
    updatePeriod: number = 25
): Observable<TimeSeriesChartData> {
    const initialData = initialChartData(series)
    const tentMap = tentMapFn(mu)
    const accumulateFn = accumulateTentDataAt(updatePeriod);
    return interval(updatePeriod).pipe(
        // convert the number sequence to a time
        // map(sequence => (sequence + 1) * updatePeriod),

        // map(time => tentMapData(time, seriesNames, ))
        scan((prev, sequence) => accumulateFn(prev, sequence + 1, tentMap), initialData)
    )
}

function accumulateTentData(
    previous: TimeSeriesChartData,
    iterateNum: number,
    updatePeriod: number,
    tentMap: (time: number, xn: number) => Datum
): TimeSeriesChartData {
    // make a copy of the current max times, which we'll update with new points
    const maxTimes = new Map(previous.maxTimes.entries())
    previous.newPoints.forEach((datum, name) => {
        maxTimes.set(name, (datum[datum.length-1].time + updatePeriod))
    })
    // deep copy of the previous data points, and calculate the next point
    const newPoints = new Map(Array.from(previous.newPoints.entries()).map(([name, data]) => [name, data.slice()]))
    newPoints.forEach((data, name) => {
        const lastDatum = data[data.length-1]
        const newDatum = tentMap(lastDatum.time + updatePeriod, lastDatum.value)
        data.shift()
        data.push(newDatum)
    })

    return {
        maxTime: previous.maxTime + updatePeriod,
        maxTimes,
        newPoints,
        currentTime: (iterateNum + 1) * updatePeriod
    };
}

function accumulateTentDataAt(updatePeriod: number):
    (previous: TimeSeriesChartData, iterateNum: number, tentMap: (time: number, xn: number) => Datum) => TimeSeriesChartData
{
    return (previous: TimeSeriesChartData, iterateNum: number, tentMap: (time: number, xn: number) => Datum) =>
        accumulateTentData(previous, iterateNum, updatePeriod, tentMap)
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
 * @param [min=-1] The minimum allowed value
 * @param [max=1] The maximum allowed value
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
    )
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
