import {Datum} from "./timeSeries";
import {BaseSeries, seriesFrom} from "./baseSeries";

/**
 * The bounds of a datum.
 */
export interface OutlierBounds {
    /**
     * The lower bound of the datum
     */
    readonly lower: number
    /**
     * The upper bound of the datum
     */
    readonly upper: number
}

export interface OutlierDatum<M extends readonly number[]> {
    readonly datum: Datum
    readonly measures: M
    readonly bounds: {readonly [K in keyof M]: OutlierBounds}
}

export function outlierBoundsFor(lower: number, upper: number): OutlierBounds {
    return {lower, upper}
}

export type OutlierSeries<M extends readonly number[]> = BaseSeries<OutlierDatum<M>>

export function outlierSeriesFor<M extends readonly number[]>(
    name: string,
    measures: readonly [...M],
    datum: Array<[time: number, value: number, bounds: { readonly [K in keyof M]: OutlierBounds}]>
): OutlierSeries<M> {
    return seriesFrom(name, datum.map(([time, value, bounds]) => outlierDatumFor({time, value}, measures, bounds)))
}

export function outlierDatumFor<M extends readonly number[]>(
    datum: Datum,
    measures: readonly [...M],
    bounds: {readonly [K in keyof M]: OutlierBounds},
): OutlierDatum<M> {
    return {datum, bounds, measures: measures as M}
}
