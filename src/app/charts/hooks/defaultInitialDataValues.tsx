import type {ChartData} from "../observables/ChartData";
import type {BaseSeries} from "../series/baseSeries";
import type {UseInitialDataValues} from "./useInitialData";

/**
 * The default values for the {@link UseInitialDataValues}
 * @return The default values for the {@link UseInitialDataValues}
 * @template CD The type of the chart data
 * @template D The type of the data object for the series
 */
export function defaultInitialDataValues<CD extends ChartData, D>(): UseInitialDataValues<CD, D> {
    return {
        initialData: new Array<BaseSeries<D>>()
    }
}