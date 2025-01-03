import {Datum, datumOf, TimeSeries} from "../charts/series/timeSeries";
import {seriesFrom} from "../charts/series/baseSeries";
import {interval, Observable} from "rxjs";
import {initialChartData, TimeSeriesChartData} from "../charts/series/timeSeriesChartData";
import {scan} from "rxjs/operators";

export type IterateFunction = (time: number, xn: number) => Datum

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
export function tentMapFn(mu: number): IterateFunction {
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

export function logisticMapFn(r: number): IterateFunction {
    const clearR = Math.max(0, Math.min(r, 4))
    return (time: number, xn: number): Datum => datumOf(time, clearR * xn * (1 - xn))
}

export function gaussMapFn(alpha: number, beta: number): IterateFunction {
    return (time: number, xn: number): Datum => datumOf(time, Math.exp(-alpha * xn * xn) + beta)
}

export function iterateFunctionObservable(
    iterateFunction: IterateFunction,
    initialSeries: Array<TimeSeries>,
    updatePeriod: number = 25
): Observable<TimeSeriesChartData> {
    // convert the initial time-series to chart data needed by the observable
    const initialData = initialChartData(initialSeries)
    // create the function that accumulates the time-series into an iterate series
    const accumulateFn = accumulateIterateDataAt(updatePeriod)
    // observable that converts the time-series into iterates
    return interval(updatePeriod).pipe(
        scan((prev, sequence) => accumulateFn(prev, sequence + 1, iterateFunction), initialData)
    )
}

function accumulateIterateData(
    previous: TimeSeriesChartData,
    iterateNum: number,
    updatePeriod: number,
    iterateFunction: IterateFunction
): TimeSeriesChartData {
    // make a copy of the current max times, which we'll update with new points
    const maxTimes = new Map(previous.maxTimes.entries())
    previous.newPoints.forEach((datum, name) => {
        maxTimes.set(name, (datum[datum.length - 1].time + updatePeriod))
    })
    // deep copy of the previous data points, and calculate the next point
    const newPoints = new Map(Array.from(previous.newPoints.entries()).map(([name, data]) => [name, data.slice()]))
    newPoints.forEach((data, _) => {
        const lastDatum = data[data.length - 1]
        const newDatum = iterateFunction(lastDatum.time + updatePeriod, lastDatum.value)
        data.shift()
        data.push(newDatum)
    })

    return {
        seriesNames: previous.seriesNames,
        maxTime: previous.maxTime + updatePeriod,
        maxTimes,
        newPoints,
        currentTime: (iterateNum + 1) * updatePeriod
    };
}

function accumulateIterateDataAt(updatePeriod: number):
    (previous: TimeSeriesChartData, iterateNum: number, iterateFunction: IterateFunction) => TimeSeriesChartData {
    return (previous: TimeSeriesChartData, iterateNum: number, iterateFunction: IterateFunction) =>
        accumulateIterateData(previous, iterateNum, updatePeriod, iterateFunction)
}
