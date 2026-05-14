import type {ChartData} from "../observables/ChartData";
import type {UseObservableValues} from "./useDataObservable";

/**
 * No operation function for use when a default function is needed
 */
export const noop = () => {
    /* empty on purpose */
}

/**
 * Default values for the {@link UseObservableValues}
 * @return The default values
 * @template CD The type of the chart data
 * @template D The type of the data object for the series
 */
export function defaultObservableValues<CD extends ChartData, D>(): UseObservableValues<CD, D> {
    return {
        windowingTime: NaN,
        shouldSubscribe: false,

        // user callbacks
        onSubscribe: noop,
    }
}