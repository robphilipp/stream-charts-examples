import {BaseSeries, seriesFrom} from "./baseSeries";

/**
 * An immutable datum object for series with a category and value.
 * This could be a series of (ordinal, value) where the category runs
 * along the x-axis. Or, it could be a series of (value, ordinal) where
 * the categories run along the y-axis.
 */
export interface OrdinalDatum {
    readonly time: number
    readonly ordinal: string
    readonly value: number
}

/**
 * Creates an empty ordinal datum
 */
export const emptyOrdinalDatum: OrdinalDatum = {time: NaN, ordinal: "", value: NaN}

/**
 * Creates an iterate datum
 * @param time The datum time, which is mostly informational
 * @param ordinal The category name or identifier
 * @param value The value
 * @return An iterate datum
 */
export const ordinalDatumOf = (time: number, ordinal: string, value: number): OrdinalDatum => ({
    time,
    ordinal,
    value
})

/**
 * Returns whether the ordinal datum is empty. An ordinal datum is considered empty
 * when the time is NaN, the ordinal is blank (empty or only whitespace), and the value
 * is NaN.
 * @param datum The iterate datum to test
 * @return `true` if the iterate datum is empty; `false` otherwise
 */
export const nonEmptyOrdinalDatum = (datum: OrdinalDatum): boolean =>
    !isNaN(datum.time) && datum.ordinal.replace(/\s/g, "").length > 0 && !isNaN(datum.value)

/**
 * A series of ordinal datum
 */
export type OrdinalSeries = BaseSeries<OrdinalDatum>

/**
 * Creates a series from the name and the optional array of (time, ordinal, value) tuples
 * @param name The name of the series
 * @param data The optional array of (time, ordinal, value) tuples
 * @return An {@link OrdinalSeries} for charts where one axis is the category, and the other a value
 * @see seriesFrom
 * @see emptySeries
 */
export function seriesFromTuples(
    name: string,
    data: Array<[time: number, ordinal: string, value: number]> = []
): OrdinalSeries {
    return seriesFrom(
        name,
        data.map(([t, ordinal, value]) => ordinalDatumOf(t, ordinal, value))
    )
}


