import {createContext, useContext} from "react";
import {Observable, Subscription} from "rxjs";
import type {ChartData} from "../observables/ChartData";
import {defaultObservableValues} from "./defaultObservableValues";

/**
 * The values exposed through the {@link useDataObservable} react hook
 * @template CD The type of the chart data
 * @template D The type of the data object for the series
 */
export interface UseObservableValues<CD extends ChartData, D> {
    /**
     * An observable source for chart data
     */
    // seriesObservable?: SeriesObservable
    seriesObservable?: Observable<CD>
    /**
     * When `true` the chart will subscribe to the observable, or if already subscribed, will remain
     * subscribed. When `false` the chart will unsubscribe to the observable if subscribed, or will
     * remain unsubscribed if not already subscribed.
     */
    shouldSubscribe?: boolean
    /**
     * The windowing time for aggregating chart-data events. Defines the update rate of the chart.
     * For example, if chart-data events occur every 1 ms, and the windowing time is set to 10 ms,
     * then events will be aggregated for 10 ms, and then the chart will be updated. In this example,
     * the chart would be updated only once per 10 ms.
     */
    windowingTime?: number

    /*
     | USER CALLBACK FUNCTIONS
     */
    /**
     * Callback function that is called when the chart subscribes to the observable
     * @param subscription The subscription resulting from the subscribe action
     */
    onSubscribe: (subscription: Subscription) => void
    /**
     * Callback function that is called when new data arrives to the chart.
     * @param seriesName The name of the series for which new data arrived
     * @param data The new data that arrived in the windowing tine
     * @see UseChartValues.windowingTime
     */
    onUpdateData?: (seriesName: string, data: Array<D>) => void
    /**
     * todo
     * @param time
     */
    onUpdateChartTime?: (time: number) => void
}

// the context is generic over the same type parameters as `UseObservableValues`, but a context
// object can't itself carry unbound generics -- `useDataObservable` below casts it back to the
// caller's concrete types, which is safe because `<DataObservableProvider/>` is what actually
// supplies the value
export const DataObservableContext = createContext<unknown>(defaultObservableValues())

/**
 * React hook that sets up the React context for the chart values.
 * @return The {@link UseObservableValues} held in the React context.
 * @template CD The type of the chart data
 * @template D The type of the data object for the series
 */
export function useDataObservable<CD extends ChartData, D>(): UseObservableValues<CD, D> {
    const context = useContext(DataObservableContext) as UseObservableValues<CD, D>
    const {onSubscribe} = context
    if (onSubscribe === undefined) {
        throw new Error("useDataObservable can only be used when the parent is a <DataObservableProvider/>")
    }
    return context
}