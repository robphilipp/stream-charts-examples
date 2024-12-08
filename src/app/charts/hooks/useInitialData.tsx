import {createContext, JSX, useContext} from "react";
import {BaseSeries} from "../series/baseSeries";


/**
 * The values exposed through the {@link useInitialData} react hook
 */
type UseInitialDataValues<D> = {
    /**
     * An array of series representing the initial data for the chart (i.e. static data
     * before streaming starts) where D is a datum, whose type must be the same as that
     * used for the Observable on the chart data
     */
    initialData: Array<BaseSeries<D>>
}

const defaultInitialDataValues: UseInitialDataValues<any> = {
    initialData: new Array<BaseSeries<any>>()
}

const InitialDataContext = createContext<UseInitialDataValues<any>>(defaultInitialDataValues)

interface Props<D> {
    initialData: Array<BaseSeries<D>>

    children: JSX.Element | Array<JSX.Element>
}

/**
 * The React context provider for the {@link UseInitialDataValues}
 * @param props The properties
 * @return The children wrapped in this provider
 * @constructor
 */
export default function InitialDataProvider<D>(props: Props<D>): JSX.Element {
    const {
        initialData
    } = props

    return <InitialDataContext.Provider value={{initialData}}>
        {props.children}
    </InitialDataContext.Provider>
}

/**
 * React hook that sets up the React context for the initial data values.
 * @return The {@link UseInitialDataValues} held in the React context.
 */
export function useInitialData<D>(): UseInitialDataValues<D> {
    const context = useContext<UseInitialDataValues<D>>(InitialDataContext)
    const {initialData} = context
    if (initialData === undefined) {
        throw new Error("useInitialData can only be used when the parent is a <InitialDataProvider/>")
    }
    return context
}