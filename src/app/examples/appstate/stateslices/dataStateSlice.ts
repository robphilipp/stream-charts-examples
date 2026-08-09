import {Observable, type Subscription} from "rxjs";
import type {StateCreator} from "zustand";
import type {ChartData} from "../../../charts/observables/ChartData.ts";
import type {Datum} from "../../../charts/series/timeSeries.ts";
import type {BaseSeries} from "../../../charts/series/baseSeries.ts";

export type DataStateSlice<O extends ChartData, D extends Datum, S extends BaseSeries<D>> = {
    /**
     * The initial data for the slice. This is an array of data {@link BaseSeries}
     */
    initialData: Array<S>
    /**
     * The observable for managing data changes.
     */
    observable: Observable<O>
    /**
     * The subscription for on the observable.
     */
    subscription: Subscription | undefined
}

export type DataActionSlice<D extends Datum, S extends BaseSeries<D>> = {
    setInitialData: (initialData: Array<S>) => void
    setSubscription: (subscription: Subscription) => void
}

export type DataSlice<O extends ChartData, D extends Datum, S extends BaseSeries<D>> = DataStateSlice<O, D, S> & DataActionSlice<D, S>

/**
 * A higher-order function that creates a generator function for producing a data slice {@link StateCreator}.
 * @param initialDataSlice - The initial state slice containing data and properties for the slice.
 * @param observableGen - A function that takes an array of initial data and returns an observable for managing data changes.
 * @return A function that produces a state creator for the data slice,
 *         allowing state updates and encapsulating subscription management.
 */
export function dataSliceStateCreator<O extends ChartData, D extends Datum, S extends BaseSeries<D>>(
    initialDataSlice: DataStateSlice<O, D, S>,
    observableGen: (initialData: Array<S>) => Observable<O>
): StateCreator<DataSlice<O, D, S>, [], [], DataSlice<O, D, S>> {
    return (set) => ({
        ...initialDataSlice,
        setInitialData: (initialData: Array<S>) => set({
            initialData,
            observable: observableGen(initialData)
        }),
        setSubscription: (subscription: Subscription) => set({subscription}),
    })
}
