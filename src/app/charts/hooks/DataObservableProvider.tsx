import type {JSX} from "react";
import {defaultObservableValues} from "./defaultObservableValues";
import {noop} from "../utils";
import {DataObservableContext} from "./useDataObservable";

/**
 * The properties for the {@link DataObservableProvider}
 */
export interface Props {
    /**
     * The time (in milliseconds) over which incoming data is batched before the plot redraws
     */
    windowingTime?: number
    /**
     * The period (ms) at which the data source's generator emits new data, when known. See
     * {@link UseObservableValues.dataUpdatePeriod}.
     */
    dataUpdatePeriod?: number
    /**
     * Callback function that is called when the chart time is updated
     * @param time The new chart time
     */
    onUpdateChartTime?: (time: number) => void

    children: JSX.Element | Array<JSX.Element>
}

/**
 * The react context provider for the {@link UseObservableValues} (the chart's streaming settings
 * and callbacks)
 * @param props The properties
 * @return The children wrapped in this provider
 */
export default function DataObservableProvider(props: Props): JSX.Element {
    const {
        windowingTime = defaultObservableValues().windowingTime || 100,
        dataUpdatePeriod,
        onUpdateChartTime = noop,
    } = props

    return <DataObservableContext.Provider value={{windowingTime, dataUpdatePeriod, onUpdateChartTime}}>
        {props.children}
    </DataObservableContext.Provider>
}
