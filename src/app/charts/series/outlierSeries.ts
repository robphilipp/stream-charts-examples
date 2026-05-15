import type {Datum} from "./timeSeries";
import {type BaseSeries, seriesFrom} from "./baseSeries";
import {failureResult, type Result, successResult} from "result-fn";

export type OutlierSeries<M extends readonly number[]> = BaseSeries<OutlierDatum<M>> & {
    /**
     * The descriptions of the measures. For example, this could be a series of descriptions
     * of the probabilities of the point being an outlier.
     */
    readonly measureDescriptions?: {readonly [K in keyof M]: string}
}

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

/**
 * Creates an outlier datum from the (x, y) value and the bounds associated with each measure. Because
 * the length of the bounds-array must be the same as the length of the measures-array, this returns
 * a {@link Result} object with the outcome of the operation.
 * @param datum The (x, y) value
 * @param measures The measures array where each measure is associated with a bound of the same index
 * @param bounds The bounds array where each bound is associated with a measure of the same index
 * @return A {@link Result} object with the outcome of the operation. If the operation is successful,
 * then the result is an {@link OutlierDatum} object. If the operation is not successful, then
 * the result is a {@link string} with the error message.
 */
export function outlierDatumFor<M extends readonly number[]>(
    datum: Datum,
    measures: readonly [...M],
    bounds: {readonly [K in keyof M]: OutlierBounds},
): Result<OutlierDatum<M>, string> {
    if (measures.length !== bounds.length) {
        return failureResult(
            `The number of measures and bounds must be the same; ` +
            `datum: (${datum.x}, ${datum.y}); ` +
            `measures_length: ${measures.length}; ` +
            `bounds_length: ${bounds.length}; ` +
            `measures: [${measures.join(", ")}]; ` +
            `bounds: [${Object.values(bounds).map(b => `(${b.lower}, ${b.upper})`).join(", ")}]`
        )
    }
    return successResult({datum, bounds, measures: measures as M})
}

/**
 * Creates an outlier series from the name and the array of (x, y, bounds) tuples (tuples). If any of the
 * datum have bounds that do not have the same length as the measures, then this function will fail and
 * return a failure result. Otherwise, it will return a success result with the outlier series.
 * @param name The name of the series
 * @param measures The measures that are associated with the series
 * @param data The array of (x, y, bounds) tuples that define the series
 * @return A {@link Result} object with the outcome of the operation. If the operation is successful,
 * then the result is an {@link OutlierSeries} object. If the operation is not successful, then
 * the result is an array of error messages.
 * @template M The type of the measures that is expressed as a tuple of numbers.
 */
export function outlierSeriesFor<M extends readonly number[]>(
    name: string,
    measures: readonly [...M],
    data: Array<[time: number, value: number, bounds: { readonly [K in keyof M]: OutlierBounds}]>
): Result<OutlierSeries<M>, Array<string>> {
    // enrich each datum in the data array with the measures
    const outlierData = data.map(
        ([time, value, bounds]) => outlierDatumFor({x: time, y: value}, measures, bounds)
    )

    // if all data has bounds-dimensions that match the measures-dimensions, then we can safely
    // create the outlier series, otherwise we must report the error and return an empty series
    if (outlierData.filter(datum => datum.succeeded).length === data.length) {
        return successResult(
            seriesFrom(
                name,
                outlierData.map(datum => datum.getOrThrow(() => new Error("Outlier datum bounds and measure mismatch")))
            )
        )
    }
    // collect all the errors for datum whose bounds and measures dimensions did not
    // match and report each error
    return failureResult(outlierData
        .filter(result => result.failed)
        .map(result => result.error!)
    )
}

