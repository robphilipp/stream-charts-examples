import {createContext, useContext} from "react";
import type {BaseSeries} from "../series/baseSeries";

/**
 * The series the chart was handed (by its data source), for components that need the set of
 * series up front (e.g. the legend, or a plot resetting itself for new data)
 * @template D The type of the datum held in each series
 */
export type UseInitialDataValues<D> = {
    initialData: Array<BaseSeries<D>>
}

// the context is generic over the same type parameter as `UseInitialDataValues`, but a context
// object can't itself carry unbound generics -- `useInitialData` below casts it back to the
// caller's concrete type, which is safe because `<InitialDataProvider/>` is what actually
// supplies the value
export const InitialDataContext = createContext<unknown>(undefined)

/**
 * @return The {@link UseInitialDataValues} held in the React context
 * @throws Error when this hook is used outside of its provider
 * @template D The type of the datum held in each series
 */
export function useInitialData<D>(): UseInitialDataValues<D> {
    const context = useContext(InitialDataContext)
    if (context === undefined) {
        throw new Error("useInitialData can only be used when the parent is a <InitialDataProvider/>")
    }
    return context as UseInitialDataValues<D>
}
