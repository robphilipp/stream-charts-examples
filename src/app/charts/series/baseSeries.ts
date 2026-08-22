import {failureResult, type Result, successResult} from "result-fn";
import {FastShiftArray} from "fast-shift-array";

/**
 * A spike series holding an array of spike (time, value) datum, the name and supplemental information
 * needed by the `RasterChart`
 */
export interface BaseSeries<D> {
    readonly name: string;
    data: FastShiftArray<D>;
    // data: Array<D>;
    readonly last: () => Result<D, string>;
    readonly length: () => number;
    readonly isEmpty: () => boolean;
}

/**
 * Default number of shifts a series' backing `FastShiftArray` accumulates before it's compacted,
 * used whenever a caller doesn't specify one explicitly. This is deliberately much lower than
 * `FastShiftArray`'s own default of 100,000: compaction is a single, blocking O(n) operation (it
 * splices out all the accumulated dead slots in one call), so with the default threshold, a
 * long-running streaming chart hits one large, very perceptible stutter once cumulative shifts
 * cross 100,000 -- visible as a sudden jump/lag rather than a gradual slowdown. Compacting more
 * often, on a much smaller batch each time, trades that one large pause for many much smaller
 * (and much less noticeable) ones spread across the session.
 *
 * If a particular use case genuinely prefers fewer, larger pauses (e.g. a non-interactive/batch
 * context where per-call overhead matters more than pause smoothness), pass a larger
 * `compactingSize` explicitly to `seriesFrom`/`emptySeries`/`emptySeriesFor`.
 */
export const DEFAULT_COMPACTING_SIZE = 10_000

/**
 * Creates a series from the name and the optional array of `Datum`.
 * @param name The name of the series (i.e. neuron)
 * @param data The array of datum, which could be `(t, f(t))`, or `(f[n](x), f[n+1](x))`
 * @param compactingSize The number of shifts the series' backing array accumulates before it's
 * compacted (see {@link DEFAULT_COMPACTING_SIZE}). Only applies when `data` is a plain array (and
 * so a new `FastShiftArray` is created for it) -- ignored when `data` is already a `FastShiftArray`,
 * since compaction size is fixed at that instance's own construction time.
 * @return A {@link BaseSeries} for object that can be used by in {@link Chart}s
 * @see seriesFromTuples
 * @see emptySeries
 */
export function seriesFrom<D>(
    name: string,
    data: Array<D> | FastShiftArray<D> = [],
    compactingSize: number = DEFAULT_COMPACTING_SIZE
): BaseSeries<D> {
    return {
        name: name,
        data: data instanceof Array ? FastShiftArray.fromArray<D>(data, true, compactingSize) : data,
        last: () => data ? (data.length > 0 ? successResult<D, string>(data[data.length - 1]) : failureResult<D, string>("Data is empty")) : failureResult<D, string>("Data is not defined"),
        length: () => data ? data.length : 0,
        isEmpty: () => data ? data.length === 0 : true
    }
}

/**
 * Returns an empty series with the specified name
 * @param name The name of the series
 * @param compactingSize The number of shifts the series' backing array accumulates before it's
 * compacted (see {@link DEFAULT_COMPACTING_SIZE})
 * @return The empty series
 * @see seriesFrom
 * @see seriesFromTuples
 */
export const emptySeries = <D>(name: string, compactingSize: number = DEFAULT_COMPACTING_SIZE): BaseSeries<D> =>
    seriesFrom(name, [], compactingSize);

/**
 * Creates an array of empty series, one for each specified name
 * @param names The names for each of the empty series
 * @param compactingSize The number of shifts each series' backing array accumulates before it's
 * compacted (see {@link DEFAULT_COMPACTING_SIZE})
 * @return An array of empty series with the specified names
 * @see emptySeries
 * @see seriesFrom
 * @see seriesFromTuples
 */
export const emptySeriesFor = <D>(names: Array<string>, compactingSize: number = DEFAULT_COMPACTING_SIZE): Array<BaseSeries<D>> =>
    names.map(name => seriesFrom(name, [], compactingSize))