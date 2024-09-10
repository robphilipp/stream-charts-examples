/**
 * Iterates
 * 1. Convert series to chart data observable in the usual way
 * 2. Plot accepts that chart-data observable and converts that observable to an iterates observable
 */
import {Observable} from "rxjs";
import {ChartData} from "./chartData";
import {map, scan} from "rxjs/operators";
import {Datum, emptyDatum} from "./datumSeries";

export interface IterateDatum {
    readonly time: number;
    readonly iterateN: number;
    readonly iterateN_1: number
}

const emptyIterateDatum = (): IterateDatum => ({time: NaN, iterateN: NaN, iterateN_1: NaN})
const iterateDatumFrom = (time: number, iterateN: number, iterateN_1: number): IterateDatum => ({
    time,
    iterateN,
    iterateN_1
})
const nonEmptyIterateDatum = (datum: IterateDatum): boolean => !isNaN(datum.time) && !isNaN(datum.iterateN) && !isNaN(datum.iterateN_1)

export interface IterateChartData {
    /**
     * The min values for (time, iterate n, and iterate n+1) for the data in the newPoints map
     */
    minIterate: IterateDatum

    /**
     * The max values for (time, iterate n, and iterate n+1) for the data in the newPoints map
     */
    maxIterate: IterateDatum

    /**
     * Holds the association of the series name to the current max time for that series
     */
    minIterates: Map<string, IterateDatum>

    /**
     * Holds the association of the series name to the current max time for that series
     */
    maxIterates: Map<string, IterateDatum>

    /**
     * Map holding the name of the series (the time-series identifier) and the associated
     * data points for that time-series (`map(series_name -> array(datum))`)
     */
    newPoints: Map<string, Array<IterateDatum>>
}

const emptyIterateData = (): IterateChartData => ({
    minIterate: emptyIterateDatum(),
    maxIterate: emptyIterateDatum(),
    minIterates: new Map<string, IterateDatum>(),
    maxIterates: new Map<string, IterateDatum>(),
    newPoints: new Map<string, Array<IterateDatum>>()
})

type Accumulator = {
    n: number
    previous: Map<string, Array<Datum>>
    accumulated: IterateChartData
}

const initialAccumulate = (n: number): Accumulator => ({n, previous: new Map(), accumulated: emptyIterateData()})

export function iteratesObservable(dataObservable: Observable<ChartData>, n: number = 1): Observable<IterateChartData> {
    return dataObservable
        .pipe(
            // calculate the iterates for each series in the chart data
            scan(({n, previous, accumulated}: Accumulator, current: ChartData) => {
                // for each series, add the new points to the accumulated data
                Array.from(current.newPoints.entries())
                    .forEach(([name, series]) => {
                        // grab the points from the previous incoming data and add the new
                        // data to its end (when the updated data didn't yet exist, add it
                        // to the map holding the previous series)
                        const updated = (previous.get(name) || [])
                        if (updated.length === 0) {
                            previous.set(name, updated)
                        }
                        updated.push(...series)

                        // we may have multiple new data points for this series, so we may need to
                        // calculate multiple iterates
                        while (updated.length >= n) {
                            // grab the start and end of the n-iterate interval
                            const last = updated[n]
                            const first = updated.shift() || emptyDatum()

                            previous.set(name, updated)

                            // create the new iterate
                            const iterate: IterateDatum = iterateDatumFrom(first.time, first.value, last.value);

                            // update the min, max values for all the series
                            accumulated.minIterate = minIterateFor(iterate, accumulated.minIterate)
                            accumulated.maxIterate = maxIterateFor(iterate, accumulated.maxIterate)

                            // update the min, max values for the current series
                            accumulated.minIterates.set(name, minIterateFor(iterate, accumulated.minIterates.get(name)))
                            accumulated.maxIterates.set(name, maxIterateFor(iterate, accumulated.maxIterates.get(name)))

                            // add the newly calculated iterate, and then trim from the
                            // head of the array to a size n. For the iterates, we only need
                            // to keep enough to create points (x(j), x(j+n))
                            const updatedPoints = accumulated.newPoints.get(name) || []
                            if (updatedPoints.length === 0) {
                                accumulated.newPoints.set(name, updatedPoints)
                            }
                            updatedPoints.push(iterate)
                            while (updatedPoints.length > n) {
                                updatedPoints.shift()
                            }
                        }
                    })
                return {n, previous, accumulated}
            }, initialAccumulate(n)),
            // remove new points from the map that are empty
            map(accum => removeEmptyNewPoints(accum)),
            map(accum => accum.accumulated === undefined ? emptyIterateData() : accum.accumulated)
        )
}

function minIterateFor(iterate: IterateDatum, minIterateAccumulated?: IterateDatum): IterateDatum {
    const minIterate = minIterateAccumulated || emptyIterateDatum()
    return {
        time: isNaN(minIterate.time) ? iterate.time : Math.min(iterate.time, minIterate.time),
        iterateN: isNaN(minIterate.iterateN) ? iterate.iterateN : Math.min(iterate.iterateN, minIterate.iterateN),
        iterateN_1: isNaN(minIterate.iterateN_1) ? iterate.iterateN_1 : Math.min(iterate.iterateN_1, minIterate.iterateN_1)
    }
}

function maxIterateFor(iterate: IterateDatum, maxIterateAccumulated?: IterateDatum): IterateDatum {
    const maxIterate = maxIterateAccumulated || emptyIterateDatum()
    return {
        time: isNaN(maxIterate.time) ? iterate.time : Math.max(iterate.time, maxIterate.time),
        iterateN: isNaN(maxIterate.iterateN) ? iterate.iterateN : Math.max(iterate.iterateN, maxIterate.iterateN),
        iterateN_1: isNaN(maxIterate.iterateN_1) ? iterate.iterateN_1 : Math.max(iterate.iterateN_1, maxIterate.iterateN_1)
    }
}

function removeEmptyNewPoints(accum: Accumulator): Accumulator {
    const newPoints = new Map(
        Array
            .from(accum.accumulated.newPoints.entries())
            .map(([name, points]) => [name, points.filter(point => nonEmptyIterateDatum(point))])
    )
    return {
        n: accum.n,
        previous: accum.previous,
        accumulated: {
            ...accum.accumulated,
            newPoints
        }
    }
}