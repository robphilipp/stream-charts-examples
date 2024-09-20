import {Option} from "prelude-ts";


/**
 * A spike series holding an array of spike (time, value) datum, the name and supplemental information
 * needed by the `RasterChart`
 */
export interface BaseSeries<D> {
    readonly name: string;
    data: Array<D>;
    readonly last: () => Option<D>;
    readonly length: () => number;
    readonly isEmpty: () => boolean;
}

/**
 * Creates a series from the name and the optional array of `Datum`.
 * @param name The name of the series (i.e. neuron)
 * @param data The array of datum, which could be `(t, f(t))`, or `(f[n](x), f[n+1](x))`
 * @return A {@link BaseSeries} for object that can be used by in {@link Chart}s
 * @see seriesFromTuples
 * @see emptySeries
 */
export function seriesFrom<D>(name: string, data: Array<D> = []): BaseSeries<D> {
    return {
        name: name,
        data: data,
        last: () => data ? (data.length > 0 ? Option.of(data[data.length - 1]) : Option.none()) : Option.none(),
        length: () => data ? data.length : 0,
        isEmpty: () => data ? data.length === 0 : true
    }
}

/**
 * Returns an empty series with the specified name
 * @param name The name of the series
 * @return The empty series
 * @see seriesFrom
 * @see seriesFromTuples
 */
export const emptySeries = <D>(name: string): BaseSeries<D> => seriesFrom(name);

/**
 * Creates an array of empty series, one for each specified name
 * @param names The names for each of the empty series
 * @return An array of empty series with the specified names
 * @see emptySeries
 * @see seriesFrom
 * @see seriesFromTuples
 */
export const emptySeriesFor = <D>(names: Array<string>): Array<BaseSeries<D>> => names.map(name => seriesFrom(name))


