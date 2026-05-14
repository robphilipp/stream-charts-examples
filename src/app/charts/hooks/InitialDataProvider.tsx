import type {ChartData} from "../observables/ChartData";
import type {JSX} from "react";
import type {BaseSeries} from "../series/baseSeries";
import {InitialDataContext} from "./useInitialData";

export interface Props<CD extends ChartData, D> {
    initialData: Array<BaseSeries<D>>
    asChartData?: (seriesList: Array<BaseSeries<D>>) => CD
    children: JSX.Element | Array<JSX.Element>
}

/**
 * The React context provider for the {@link UseInitialDataValues}
 * @param props The properties
 * @return The children wrapped in this provider
 * @template CD The type of the chart data
 * @template D The type of the data object for the series
 */
export default function InitialDataProvider<CD extends ChartData, D>(props: Props<CD, D>): JSX.Element {
    const {
        initialData,
        asChartData
    } = props

    return (
        <InitialDataContext.Provider value={{initialData, asChartData}}>
            {props.children}
        </InitialDataContext.Provider>
    )
}