import type {UseObservableValues} from "./useDataObservable";

/**
 * Default values for the {@link UseObservableValues}
 * @return The default values
 */
export function defaultObservableValues(): UseObservableValues {
    return {
        windowingTime: NaN,
    }
}
