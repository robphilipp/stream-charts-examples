import {interval, type Observable} from "rxjs";
import type {OutlierChartData} from "../charts/observables/outliers.ts";
import {
    type OutlierBounds,
    outlierBoundsFor,
    type OutlierDatum,
    outlierDatumFor,
    type OutlierSeries
} from "../charts/series/outlierSeries.ts";
import {map} from "rxjs/operators";
import {datumOf} from "../charts/series/timeSeries.ts";
import {seriesFrom} from "../charts/series/baseSeries.ts";

export function randomOutlierDataObservable<M extends readonly number[]>(
    seriesName: string,
    baseFunction: (x: number, sigma: number, measures: M) => OutlierDatum<M>,
    measures: M,
    sigmaNoise: number = 1,
    updatePeriod: number = 25,
    startTime: number = 0,
): Observable<OutlierChartData<M>> {
    const seriesNames = new Set<string>([seriesName])
    return interval(updatePeriod).pipe(
        map(sequence => startTime + (sequence + 1) * updatePeriod),
        map(time => ({
            seriesNames,
            newPoints: new Map([[seriesName, [baseFunction(time, sigmaNoise, measures)]]])
        } as OutlierChartData<M>))
    )
}

/**
 * Generates a static initial outlier series by evaluating {@link baseFunction} at successive
 * time-steps. Useful for pre-populating a chart so users see data before any streaming starts.
 * The generated points line up with what {@link randomOutlierDataObservable} would emit, so a
 * streaming run starting at `numPoints * updatePeriod` continues the series seamlessly.
 */
export function initialOutlierData<M extends readonly number[]>(
    seriesName: string,
    baseFunction: (x: number, sigma: number, measures: M) => OutlierDatum<M>,
    measures: M,
    sigmaNoise: number,
    updatePeriod: number,
    numPoints: number,
): Array<OutlierSeries<M>> {
    const data: Array<OutlierDatum<M>> = []
    for (let i = 0; i < numPoints; ++i) {
        const time = (i + 1) * updatePeriod
        data.push(baseFunction(time, sigmaNoise, measures))
    }
    return [seriesFrom<OutlierDatum<M>>(seriesName, data)]
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
            ([period, offset]) => magnitude * Math.cos(time / period + offset) + 32
        )

        // add noise to simulate the data
        const baseValue = periodValues.reduce(
            (acc, value) => acc + value,
            0
        )

        // add noise to simulate the data
        const value = baseValue + magnitude * sigma * (2 * Math.random() - 1) * (Math.random() > 0.99 ? 3 * (1 + Math.random()) : 0.7)

        // calculate the bounds based on the measures and the base value (without noise)
        const bounds = measures
            .map((measure, index) => {
                const bandWidth = magnitude * sigma * measure * (index+1)
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