import {createContext, useCallback, useContext, useSyncExternalStore} from "react";
import type {ChartData} from "../observables/ChartData";
import type {BaseSeries} from "../series/baseSeries";
import type {StreamingDataSource} from "../datasources/StreamingDataSource";

// the context is generic over the same type parameters as `StreamingDataSource`, but a context
// object can't itself carry unbound generics -- `useDataSource` below casts it back to the
// caller's concrete types, which is safe because `<Chart/>` is what actually supplies the value
export const DataSourceContext = createContext<unknown>(undefined)

/**
 * @return The {@link StreamingDataSource} handed to the enclosing {@link Chart} through its
 * `dataSource` prop, or `undefined` when the chart is using the legacy `seriesObservable` props
 * @template CD The type of the chart data
 * @template D The type of datum held in each series
 * @template S The type of series
 */
export function useDataSource<CD extends ChartData, D, S extends BaseSeries<D> = BaseSeries<D>>(): StreamingDataSource<CD, D, S> | undefined {
    return useContext(DataSourceContext) as StreamingDataSource<CD, D, S> | undefined
}

/**
 * Subscribes the calling component to the data source's running state, so it re-renders when the
 * source starts or stops (e.g. to switch the zoom pivot, or hide markers while running).
 * @param dataSource The data source, or `undefined` (in which case this is always `false`)
 * @return Whether the data source is currently running
 */
export function useDataSourceRunning<CD extends ChartData, D>(dataSource: StreamingDataSource<CD, D> | undefined): boolean {
    const subscribe = useCallback(
        (onChange: () => void): (() => void) => {
            if (dataSource === undefined) return () => {
            }
            const subscription = dataSource.running$.subscribe(() => onChange())
            return () => subscription.unsubscribe()
        },
        [dataSource]
    )
    return useSyncExternalStore(subscribe, () => dataSource?.running ?? false)
}
