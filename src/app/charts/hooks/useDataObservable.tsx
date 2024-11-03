import {createContext, JSX, useContext} from "react";
import {Observable, Subscription} from "rxjs";
// import {noop} from "../utils";

/**
 * No operation function for use when a default function is needed
 */
const noop = () => {
    /* empty on purpose */
}

// type SeriesObservable = Observable<TimeSeriesChartData> | Observable<IterateChartData>
// type Data = Array<Datum> | Array<IterateDatum>

/**
 * The values exposed through the {@link useDataObservable} react hook
 */
interface UseObservableValues<CD, D> {
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
     * For example if chart-data events occur every 1 ms, and the windowing time is set to 10 ms,
     * then events will be aggregated for 10 ms, and then the chart will be updated. In this example,
     * the chart would be updated only once per 10 ms.
     */
    windowingTime?: number

    /*
     | USER CALLBACK FUNCTIONS
     */
    /**
     * Callback function that is called when the chart subscribes to the observable
     * @param subscription The subscription resulting form the subscribe action
     */
    onSubscribe: (subscription: Subscription) => void
    /**
     * Callback function that is called when new data arrives to the chart.
     * @param seriesName The name of the series for which new data arrived
     * @param data The new data that arrived in the windowing tine
     * @see UseChartValues.windowingTime
     */
    onUpdateData?: (seriesName: string, data: Array<D>) => void
    // onUpdateData?: (seriesName: string, data: Data) => void

}

const defaultObservableValues: UseObservableValues<any, any> = {
    windowingTime: NaN,
    shouldSubscribe: false,

    // user callbacks
    onSubscribe: noop,
}

const DataObservableContext = createContext<UseObservableValues<any, any>>(defaultObservableValues)

interface Props<CD, D> {
    // live data
    seriesObservable?: Observable<CD>
    windowingTime?: number
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

    children: JSX.Element | Array<JSX.Element>
}

/**
 * The react context provider for the {@link UseObservableValues}
 * @param props The properties
 * @return The children wrapped in this provider
 * @constructor
 */
export default function DataObservableProvider<CD, D>(props: Props<CD, D>): JSX.Element {
    const {
        seriesObservable,
        windowingTime = defaultObservableValues.windowingTime || 100,
        shouldSubscribe,

        onSubscribe = noop,
        onUpdateData = noop,
    } = props

    return <DataObservableContext.Provider
        value={{
            seriesObservable,
            windowingTime,
            shouldSubscribe,

            onSubscribe,
            onUpdateData,
        }}
    >
        {props.children}
    </DataObservableContext.Provider>
}

/**
 * React hook that sets up the React context for the chart values.
 * @return The {@link UseObservableValues} held in the React context.
 */
export function useDataObservable<CD, D>(): UseObservableValues<CD, D> {
    const context = useContext<UseObservableValues<CD, D>>(DataObservableContext)
    const {onSubscribe} = context
    if (onSubscribe === undefined) {
        throw new Error("useDataObservable can only be used when the parent is a <DataObservableProvider/>")
    }
    return context
}