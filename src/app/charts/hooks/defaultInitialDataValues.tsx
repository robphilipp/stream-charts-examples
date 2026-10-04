import type {BaseSeries} from "../series/baseSeries";
import type {UseInitialDataValues} from "./useInitialData";

/**
 * The default values for the {@link UseInitialDataValues}
 * @return The default values for the {@link UseInitialDataValues}
 * @template D The type of the data object for the series
 */
export function defaultInitialDataValues<D>(): UseInitialDataValues<D> {
    return {
        initialData: new Array<BaseSeries<D>>()
    }
}
