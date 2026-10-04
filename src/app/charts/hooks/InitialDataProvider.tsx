import type {JSX} from "react";
import type {BaseSeries} from "../series/baseSeries";
import {InitialDataContext} from "./useInitialData";

export interface Props<D> {
    initialData: Array<BaseSeries<D>>
    children: JSX.Element | Array<JSX.Element>
}

/**
 * The react context provider for the {@link UseInitialDataValues}
 * @param props The properties
 * @return The children wrapped in this provider
 * @template D The type of the datum held in each series
 */
export default function InitialDataProvider<D>(props: Props<D>): JSX.Element {
    return (
        <InitialDataContext.Provider value={{initialData: props.initialData}}>
            {props.children}
        </InitialDataContext.Provider>
    )
}
