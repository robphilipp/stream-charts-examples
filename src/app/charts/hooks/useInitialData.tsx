import {createContext, useContext} from "react";
import type {BaseSeries} from "../series/baseSeries";
import type {ChartData} from "../observables/ChartData";
import {defaultInitialDataValues} from "./defaultInitialDataValues";

/**
 * The values exposed through the {@link useInitialData} react hook
 * @template CD The type of the chart data
 * @template D The type of the data object for the series
 */
export type UseInitialDataValues<CD extends ChartData, D> = {
    /**
     * An array of series representing the initial data for the chart (i.e. static data
     * before streaming starts) where D is a datum, whose type must be the same as that
     * used for the Observable on the chart data
     */
    initialData: Array<BaseSeries<D>>

    /**
     * Function that takes an array of series (which has elements of type D) and converts
     * it into a chart data type, CD
     * @param seriesList
     */
    asChartData?: (seriesList: Array<BaseSeries<D>>) => CD
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const InitialDataContext = createContext<UseInitialDataValues<any, any>>(defaultInitialDataValues())

/**
 * React hook that sets up the React context for the initial data values.
 * @return The {@link UseInitialDataValues} held in the React context.
 * @template CD The type of the chart data
 * @template D The type of the data object for the series
 */
export function useInitialData<CD extends ChartData, D>(): UseInitialDataValues<CD, D> {
    const context = useContext<UseInitialDataValues<CD, D>>(InitialDataContext)
    const {initialData} = context
    if (initialData === undefined) {
        throw new Error("useInitialData can only be used when the parent is a <InitialDataProvider/>")
    }
    return context
}