import {Datum} from "./timeSeries";

/**
 * The bounds of a datum.
 */
export interface OutlierBounds {
    /**
     * The lower bound of the datum
     */
    lower: number
    /**
     * The upper bound of the datum
     */
    upper: number
    /**
     * The measure of the datum. For example, the probability that the datum is within
     * the bounds.
     */
    measure: number
}

export interface OutlierDatum {
    datum: Datum
    bounds: Array<OutlierBounds>
}

export function outlierBoundsFor(lower: number, upper: number, measure: number): OutlierBounds {
    return {lower, upper, measure}
}

export function outlierDatumFor(datum: Datum, ...bounds: Array<OutlierBounds>): OutlierDatum {
    return {datum, bounds}
}