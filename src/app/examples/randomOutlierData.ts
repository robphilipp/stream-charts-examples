// import {interval, Observable} from "rxjs";
// import {TimeSeriesChartData} from "../charts/series/timeSeriesChartData";
// import {OutlierDatum, OutlierSeries} from "../charts/series/outlierSeries";
// import {map} from "rxjs/operators";
//
// const Measures = [0.75, 0.95] as const

import {interval, type Observable} from "rxjs";
import type {OutlierChartData} from "../charts/observables/outliers.ts";
import {
    type OutlierBounds,
    outlierBoundsFor,
    type OutlierDatum,
    outlierDatumFor
} from "../charts/series/outlierSeries.ts";
import {map} from "rxjs/operators";
import {datumOf} from "../charts/series/timeSeries.ts";

export function randomOutlierDataObservable<M extends readonly number[]>(
    seriesName: string,
    baseFunction: (x: number, sigma: number, measures: M) => OutlierDatum<M>,
    measures: M,
    sigmaNoise: number = 1,
    updatePeriod: number = 25,
): Observable<OutlierChartData<M>> {
    return interval(updatePeriod).pipe(
        // convert the number sequence to a time
        map(sequence => (sequence + 1) * updatePeriod),

        // calculate the outlier datum
        // map(time => baseFunction(time, sigmaNoise, measures))
        map(time => ({newPoints: new Map([[seriesName, [baseFunction(time, sigmaNoise, measures)]]])} as OutlierChartData<M>))
    )
}

export function periodicWithSeveralBandsFn<M extends readonly number[]>(
    periods: Array<[period: number, offset: number]>,
    magnitude: number
): (time: number, sigma: number, measures: M) => OutlierDatum<M> {
    return (time: number, sigma: number, measures: M) => {
        // calculate the values for the "model" without noise. from these we add noise
        // to get the value. We also used these values to calculate the bounds for each
        // point
        const periodValues = periods.map(
            ([period, offset]) => magnitude * Math.sin(time / period + offset)
        )

        // add noise to simulate the data
        const baseValue = periodValues.reduce(
            (acc, value) => acc + value,
            0
        )

        // add noise to simulate the data
        const value = baseValue + magnitude * sigma * (2 * Math.random() - 1)

        // calculate the bounds based on the measures and the base value (without noise)
        const bounds = measures
            .map(measure => {
                const bandWidth = magnitude * sigma * measure
                return outlierBoundsFor(baseValue - bandWidth, baseValue + bandWidth)
            })

        // this should never fail for this function, so we'll just throw an error if it does.. :)
        return outlierDatumFor<M>(datumOf(time, value), measures, toTuple(...bounds))
            .getOrThrow(failure => new Error(failure))
    }
}

function toTuple<T extends readonly OutlierBounds[], M extends readonly number[]>(...args: T): { readonly [K in keyof M]: OutlierBounds} {
    return args as { readonly [K in keyof M]: OutlierBounds}
}