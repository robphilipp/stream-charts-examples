import type {ChartData} from "../observables/ChartData";
import {concat, from, Observable, Subscription} from "rxjs";
import type {BaseSeries} from "../series/baseSeries";
import type {JSX} from "react";
import {useInitialData} from "./useInitialData";
import {defaultObservableValues} from "./defaultObservableValues.tsx";
import {noop} from "stream-charts";
import { DataObservableContext } from "./useDataObservable";

/**
 * The properties for the {@link DataObservableProvider}
 * @template CD The type of the chart data
 * @template D The type of the data object for the series
 */
export interface Props<CD extends ChartData, D> {
    /**
     * The (RxJs) observable source for chart data
     */
    seriesObservable?: Observable<CD>
    /**
     * The time (in milliseconds) for collecting events befpre rendering them to the
     * plot
     */
    windowingTime?: number
    /**
     * Should subscribe to the observable. When `true` the chart will subscribe to the
     * observable, or if already subscribed, will remain subscribed. When `false` the
     * chart will unsubscribe to the observable if subscribed, or will remain unsubscribed
     * if not already subscribed.
     */
    shouldSubscribe?: boolean

    /*
     | USER CALLBACK FUNCTIONS
     */
    /**
     * Callback function that is called when the chart subscribes to the observable
     * @param subscription The subscription resulting form the subscribe action
     */
    onSubscribe?: (subscription: Subscription) => void
    /**
     * Callback function that is called when new data arrives to the chart.
     * @param seriesName The name of the series for which new data arrived
     * @param data The new data that arrived in the windowing tine
     * @see UseChartValues.windowingTime
     */
    onUpdateData?: (seriesName: string, data: Array<D>) => void
    /**
     * Callback function that is called when the chart time is updated
     * @param time The new chart time
     */
    onUpdateChartTime?: (time: number) => void

    children: JSX.Element | Array<JSX.Element>
}

/**
 * The react context provider for the {@link UseObservableValues}
 * @param props The properties
 * @return The children wrapped in this provider
 * @template CD The type of the chart data
 * @template D The type of the data object for the series
 */
export default function DataObservableProvider<CD extends ChartData, D>(props: Props<CD, D>): JSX.Element {

    const {
        seriesObservable,
        windowingTime = defaultObservableValues().windowingTime || 100,
        shouldSubscribe,

        onSubscribe = noop,
        onUpdateData = noop,
        onUpdateChartTime = noop,
    } = props

    // when initial data is provided, and importantly, when a function is provided that converts
    // the initial data into an object of type ChartData, and when there is a defined series
    // observable, then the initial data is prepended to the data observable.
    const {initialData, asChartData} = useInitialData<CD, D>()
    const observable = dataObservable<CD, D>(seriesObservable, initialData, asChartData)

    return <DataObservableContext.Provider
        value={{
            seriesObservable: observable,
            windowingTime,
            shouldSubscribe,

            onSubscribe,
            onUpdateData,
            onUpdateChartTime,
        }}
    >
        {props.children}
    </DataObservableContext.Provider>
}

/**
 * When initial data is provided, and importantly, when a function is provided that converts
 * the initial data into an object of type ChartData, and when there is a defined series
 * observable, then the initial data is prepended to the data observable. When only initial data
 * is provided and a conversion function, then a creates an observable from the initial data.
 * And, when only a defined series observable is specified, then that is used (this is the default,
 * and backward compatible behavior).
 * @param seriesObservable An optional series observable
 * @param initialData An array of initial data series
 * @param asChartData A function that converts the initial data series into chart data
 * @return An {@link Observable} of {@link ChartData}, or an `undefined`
 * @template CD The type of the chart data
 * @template D The type of the data object for the series
 */
function dataObservable<CD extends ChartData, D>(
    seriesObservable?: Observable<CD>,
    initialData?: Array<BaseSeries<D>>,
    asChartData?: (seriesList: Array<BaseSeries<D>>) => CD
): Observable<CD> | undefined {
    if (seriesObservable !== undefined && initialData !== undefined && initialData.length > 0 && asChartData !== undefined) {
        return concat(from([asChartData(initialData)]), seriesObservable)
    } else if (initialData !== undefined && initialData.length > 0 && asChartData !== undefined) {
        return from([asChartData(initialData)])
    } else {
        return seriesObservable
    }
}