import {createContext, useContext} from "react";
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
