import type {Datum} from "./timeSeries";
import {type BaseSeries, seriesFrom} from "./baseSeries";

export type OutlierSeries<M extends readonly number[]> = BaseSeries<OutlierDatum<M>>

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

/**
 * A datum with and upper and lower bounds B(L, U) associate with each measure. The idea is the
 * following. We have a datum (x, y) value. The bounds determine whether the datum is
 * within the range assocated with the measure. For example, the measure could be the
 * 0.95 probability that the datum falls within that bound. And if the (x, y) value falls
 * outside the bounds B(L, U), the datum could be considered an "outlier".
 *
 * Often we would like to have a set of measures that mean different things. For example, if
 * the datum falls outside the bounds B1(L, U) representing the range in which we expect
 * the datum to fall with a 0.95 probability, then we could consider the datum an "outlier". We
 * may also want to consider the datum an "outlier" if it falls outside the bounds B2(L, U)
 * representing the range in which we expect the datum to fall with a 0.75 probability. If the
 * datum falls outside B2(L, U), then we could consider the datum a "possible outlier" and
 * treat it differently from an "outlier".
 *
 * Note that there are constraints.
 * 1. The cardinatilty of the measures and the bounds must be the same.
 * 2. The i-th bound is associated with the i-th measure.
 *
 * @param M The type of the measures that is expressed as a tuple of numbers.
 * @see OutlierBounds
 * @see outlierBoundsFor
 * @see outlierDatumFor
 * @see outlierSeriesFor
 *
 * @example
 * // possible-outlier = 0.75, outlier = 0.95
 * const Measures = [0.75, 0.95] as const;
 * const value: Datum = datumOf(1, 10);
 * const bounds = [
 *     outlierBoundsFor(21, 121),
 *     outlierBoundsFor(2, 52)
 * ] as const;
 * const datum = outlierDatumFor<typeof Measures>(value, Measures, bounds);
 */
export interface OutlierDatum<M extends readonly number[]> {
    /**
     * The datum with the x and y values
     */
    readonly datum: Datum
    /**
     * The measures of the datum. For example, this could be a series of probabilities of
     * the point being an outlier.
     */
    readonly measures: M
    /**
     * The bounds of the measures. For example, if the measures are probabilities, then
     * the bounds are a series that hold the lower and upper bounds for each probability
     * in the measures.
     */
    readonly bounds: {readonly [K in keyof M]: OutlierBounds}
}

/**
 * Convenience function to create an outlier bounds object.
 * @param lower The lower bound of the measure
 * @param upper The upper bound of the measure
 * @return An outlier bounds object
 */
export function outlierBoundsFor(lower: number, upper: number): OutlierBounds {
    return {lower, upper}
}

export function outlierDatumFor<M extends readonly number[]>(
    datum: Datum,
    measures: readonly [...M],
    bounds: {readonly [K in keyof M]: OutlierBounds},
): OutlierDatum<M> {
    return {datum, bounds, measures: measures as M}
}

/**
 * Creates an outlier series from the name and the array of (x, y, bounds) tuples (tuples)
 * @param name The name of the series
 * @param measures The measures that are associated with the series
 * @param datum The array of (x, y, bounds) tuples that define the series
 */
export function outlierSeriesFor<M extends readonly number[]>(
    name: string,
    measures: readonly [...M],
    datum: Array<[time: number, value: number, bounds: { readonly [K in keyof M]: OutlierBounds}]>
): OutlierSeries<M> {
    const outlierData = datum.map(
        ([time, value, bounds]) =>
            outlierDatumFor({x: time, y: value}, measures, bounds)
    )
    return seriesFrom(name, outlierData)
}

