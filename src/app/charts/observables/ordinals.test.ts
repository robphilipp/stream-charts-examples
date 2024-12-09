import {TimeSeriesChartData} from "../series/timeSeriesChartData";
import {Datum, datumOf, TimeSeries} from "../series/timeSeries";
import {seriesFrom} from "../series/baseSeries";
import {Observable, range} from "rxjs";
import {map, scan} from "rxjs/operators";
import {OrdinalChartData, ordinalsObservable} from "./ordinals";


/**
 * Creates random data
 * @param sequenceTime The current time
 * @param series The list of series names (identifiers) to update
 * @param seriesMaxTimes The maximum time for each series
 * @param updatePeriod The update period (ms)
 * @param delta The largest change in weight
 * @return The random chart data
 */
function randomData(
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
        newPoints: new Map(series.map((name, index) => {
            // const maxTime = seriesMaxTimes.get(name) || 0
            return [
                name,
                [{
                    // time: sequenceTime + maxTime - Math.ceil(Math.random() * updatePeriod),
                    time: sequenceTime + index + 1,
                    value: (Math.random() - 0.5) * 2 * delta
                }]
            ]
        }))
    };
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
 * Creates an empty chart data object with all the values set to 0
 * @param seriesList The list of series names (identifiers) to update
 * @param currentTime=0] The current time
 * @return An empty chart data object
 */
export function initialChartData(seriesList: Array<TimeSeries>, currentTime: number = 0): TimeSeriesChartData {
    const maxTime = seriesList.reduce(
        (tMax, series) => Math.max(tMax, series.last().map(datum => datum.time).getOrElse(-Infinity)),
        -Infinity
    )
    return {
        maxTime,
        maxTimes: new Map(seriesList.map(series => [series.name, series.last().map(datum => datum.time).getOrElse(0)])),
        newPoints: new Map<string, Array<Datum>>(seriesList.map(series => [
            series.name,
            [{
                time: series.last().map(datum => datum.time).getOrElse(0),
                value: series.last().map(datum => datum.value).getOrElse(0)
            }]
        ])),
        currentTime: currentTime
    }
}

/**
 * Creates random set of time-series data, essentially creating a random walk for each series
 * @param series The number of time-series for which to generate data (i.e. one for each neuron)
 * @param delta The max change in weight
 * @param numPoints The number of points to generate
 * @param [updatePeriod=25] The time-interval between the generation of subsequent data points
 * @param [min=-1] The minimum allowed value
 * @param [max=1] The maximum allowed value
 * @return An observable that produces data.
 */
export function randomDataObservable(
    series: Array<TimeSeries>,
    delta: number,
    numPoints: number = 10,
    updatePeriod: number = 25,
    min: number = -1,
    max: number = 1
): Observable<TimeSeriesChartData> {
    const seriesNames = series.map(series => series.name)
    const initialData = initialChartData(series)
    return range(0, numPoints).pipe(
        // convert the number sequence to a time
        map(sequence => sequence * updatePeriod),

        // create a new (time, value) for each series
        map(time => randomData(time, seriesNames, initialData.maxTimes, updatePeriod, delta)),

        // add the random value to the previous random value in succession to create a random walk for each series
        scan((acc, value) => accumulateChartData(acc, value, min, max), initialData)
    )
}

describe('ordinals', () => {
    const seriesData: Array<[string, number]> = [["test1", 0.66], ["test2", 0.36], ["test3", 0.96]]

    const initialData: Array<TimeSeries> = seriesData
        .map(([name, value], index) => seriesFrom(name, [datumOf(index, value)]))

    test('should be able to generate ordinals', done => {
        const numPoints = 10
        const updatePeriod = 25
        let results: Array<OrdinalChartData> = []
        ordinalsObservable(
            randomDataObservable(initialData, 0.05, numPoints, updatePeriod)
        ).subscribe(chartData => results.push(chartData))

        // blocks until done is called
        done()

        expect(results).toHaveLength(numPoints)

        results.forEach((result, timeIndex) => {
            Array.from(result.newPoints.entries()).forEach(([seriesName, ordinalDatum], index) => {
                expect(seriesName).toEqual(seriesData[index][0])

                // check the time for the datum (only one new-point datum)
                expect(ordinalDatum).toBeDefined()
                expect(ordinalDatum.length).toBe(1)
                expect(ordinalDatum[0].time).toEqual(index + 1 + timeIndex * updatePeriod)

                // should be bounded (data is bounded)
                expect(ordinalDatum[0].value).toBeLessThanOrEqual(1)
                expect(ordinalDatum[0].value).toBeGreaterThanOrEqual(-1)
            })

            // the min time should be 1 and the max time should be (3 + timeIndex + updatePeriod)
            expect(result.minDatum.time.time).toBe(1)
            expect(result.maxDatum.time.time).toBe(3 + timeIndex * updatePeriod)
        })

    })

})
