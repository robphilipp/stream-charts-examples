/**
 * Converts an observable of {@link TimeSeriesChartData} into an observable of {@link OrdinalChartData} for
 * plotting categorical data.
 * 1. Convert series to chart data observable in the usual way
 * 2. Accepts that chart-data observable and converts that observable to an ordinal-chart-data observable
 */
import {Observable} from "rxjs";
import {TimeSeriesChartData} from "../series/timeSeriesChartData";
import {map, scan} from "rxjs/operators";
import {Datum} from "../series/timeSeries";
import {nonEmptyOrdinalDatum, OrdinalDatum, ordinalDatumOf} from "../series/ordinalSeries";

export type OrdinalDatumExtremum = {
    // holds the ordinal datum with the minimum or maximum time
    time: OrdinalDatum
    // holds the ordinal datum with the minimum or maximum value
    value: OrdinalDatum
}

const initialMinOrdinalDatum = (): OrdinalDatumExtremum => ({
    time: {time: Infinity, ordinal: "", value: NaN},
    value: {time: NaN, ordinal: "", value: Infinity}
})

const initialMaxOrdinalDatum = (): OrdinalDatumExtremum => ({
    time: {time: -Infinity, ordinal: "", value: NaN},
    value: {time: NaN, ordinal: "", value: -Infinity}
})

export interface OrdinalChartData {
    /**
     * The min values for (time, value) for the data in the newPoints map
     */
    minDatum: OrdinalDatumExtremum

    /**
     * The max values for (time, iterate n, and iterate n+1) for the data in the newPoints map
     */
    maxDatum: OrdinalDatumExtremum

    /**
     * Holds the association of the series name to the current min time and value for that category
     */
    minCategory: Map<string, OrdinalDatumExtremum>

    /**
     * Holds the association of the series name to the current max time and value for that category
     */
    maxCategory: Map<string, OrdinalDatumExtremum>

    /**
     * Map holding the name of the series (the time-series identifier) and the associated
     * data points for that time-series (`map(series_name -> array(datum))`)
     */
    newPoints: Map<string, Array<OrdinalDatum>>
}

const emptyOrdinalData = (): OrdinalChartData => ({
    minDatum: initialMinOrdinalDatum(),
    maxDatum: initialMaxOrdinalDatum(),
    minCategory: new Map<string, OrdinalDatumExtremum>(),
    maxCategory: new Map<string, OrdinalDatumExtremum>(),
    newPoints: new Map<string, Array<OrdinalDatum>>()
})

/**
 * Makes a deep copy of the ordinal chart data
 * @param data The ordinal chart data to copy
 */
export const copyOrdinalDataFrom = (data: OrdinalChartData): OrdinalChartData => ({
    minDatum: data.minDatum,
    maxDatum: data.maxDatum,
    minCategory: new Map<string, OrdinalDatumExtremum>(data.minCategory),
    maxCategory: new Map<string, OrdinalDatumExtremum>(data.maxCategory),
    newPoints: new Map<string, Array<OrdinalDatum>>(Array.from(data.newPoints.entries()).map(([name, points]) => [name, points.slice()])),
})

type Accumulator = {
    previous: Map<string, Array<Datum>>
    accumulated: OrdinalChartData
}

const initialAccumulate = (): Accumulator => ({previous: new Map(), accumulated: emptyOrdinalData()})

/**
 * Accepts a {@link TimeSeriesChartData} observable and converts it to an observable of {@link OrdinalChartData}.
 * @param dataObservable The observable over {@link TimeSeriesChartData}
 * @return An observable of {@link OrdinalChartData} holding the series for the incoming chart data
 */
export function ordinalsObservable(dataObservable: Observable<TimeSeriesChartData>): Observable<OrdinalChartData> {
    return dataObservable
        .pipe(
            // calculate the iterates for each series in the chart data
            scan(({previous, accumulated}: Accumulator, current: TimeSeriesChartData) => {
                // make a deep copy of the accumulated data (because the accumulated data object
                // holds references to maps)
                const accum = copyOrdinalDataFrom(accumulated)

                // for each series, add the new points to the accumulated data
                Array
                    .from(current.newPoints.entries())
                    .forEach(([name, series]) => {

                        // grab the points from the previous incoming data and add the new
                        // data to its end (when the updated data didn't yet exist, add it
                        // to the map holding the previous series)
                        const updated = (previous.get(name) || [])
                        if (updated.length === 0) {
                            previous.set(name, updated)
                        }
                        updated.push(...series)

                        // calculate the max-time, min-time, max-value, and min-value for
                        // all the data series
                        series.forEach(({time, value}: Datum, ) => {
                            // calculate the min and max times over all series
                            if (time < accumulated.minDatum.time.time) {
                                accum.minDatum.time = ordinalDatumOf(time, name, value)
                            }
                            if (time > accumulated.maxDatum.time.time) {
                                accum.maxDatum.time = ordinalDatumOf(time, name, value)
                            }
                            // calculate the min and max values over all series
                            if (value < accumulated.minDatum.value.value) {
                                accum.minDatum.value = ordinalDatumOf(time, name, value)
                            }
                            if (value > accumulated.maxDatum.value.value) {
                                accum.maxDatum.value = ordinalDatumOf(time, name, value)
                            }

                            // calculate the min, max of the time and value for each series
                            let minCategory = accumulated.minCategory.get(name) || initialMinOrdinalDatum()
                            if (time < minCategory.time.time) {
                                minCategory = {...minCategory, time: ordinalDatumOf(time, name, value)}
                                accum.minCategory.set(name, minCategory)
                            }
                            if (value < minCategory.value.value) {
                                minCategory = {...minCategory, value: ordinalDatumOf(time, name, value)}
                                accum.minCategory.set(name, minCategory)
                            }

                            let maxCategory = accumulated.maxCategory.get(name) || initialMaxOrdinalDatum()
                            if (time > maxCategory.time.time) {
                                maxCategory = {...maxCategory, time: ordinalDatumOf(time, name, value)}
                                accum.maxCategory.set(name, maxCategory)
                            }
                            if (value > maxCategory.value.value) {
                                maxCategory = {...maxCategory, value: ordinalDatumOf(time, name, value)}
                                accum.maxCategory.set(name, maxCategory)
                            }

                            // convert the new points to ordinal datum
                            accum.newPoints.set(name, series.map(({time, value}: Datum) => ordinalDatumOf(time, name, value)))
                        })
                    })
                return {previous, accumulated: accum}
            }, initialAccumulate()),

            // remove new points from the map that are empty
            map(accum => removeEmptyNewPoints(accum)),
            map(accum => accum.accumulated === undefined ? emptyOrdinalData() : accum.accumulated)
        )
}

function removeEmptyNewPoints(accum: Accumulator): Accumulator {
    const newPoints = new Map(
        Array
            .from(accum.accumulated.newPoints.entries())
            .map(([name, points]) => [name, points.filter(point => nonEmptyOrdinalDatum(point))])
    )
    return {
        previous: accum.previous,
        accumulated: {
            ...accum.accumulated,
            newPoints
        }
    }
}