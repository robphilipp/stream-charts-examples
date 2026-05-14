import {type JSX, useEffect, useRef, useState} from "react";
import {type Dimensions, dimensionsNotEqual, type Margin, plotDimensionsFrom} from "../styling/margins";
import {defaultPlotDimensions} from "./defaultPlotDimensions";
import {type PlotDimensionChangeHandler, PlotDimensionsContext} from "./usePlotDimensions";

export type Props = {
    containerDimensions: Dimensions
    margin: Margin
    children: JSX.Element | Array<JSX.Element>
}

/**
 * Providers for the plot's dimensions and margins.
 * @param props The properties
 * @return The children wrapped in this provider
 */
export default function PlotDimensionsProvider(props: Props): JSX.Element {
    const {
        containerDimensions,
        margin,
        children
    } = props

    const [dimensions, setDimensions] = useState<Dimensions>(defaultPlotDimensions().plotDimensions)
    const plotDimensionChangeHandersRef = useRef<Map<string, PlotDimensionChangeHandler>>(new Map())

    // update the plot dimensions when the container size or margin change
    useEffect(
        () => {
            const newDimensions = plotDimensionsFrom(containerDimensions.width, containerDimensions.height, margin)
            setDimensions(prevDimensions => {
                if (dimensionsNotEqual(prevDimensions, newDimensions)) {
                    for (const handler of plotDimensionChangeHandersRef.current.values()) {
                        handler(prevDimensions, newDimensions)
                    }
                    return newDimensions
                }
                return prevDimensions
            })
        },
        [containerDimensions, margin]
    )

    function updateDimensions(newDimensions: Dimensions) {
        setDimensions(prevState => {
            for (const handler of plotDimensionChangeHandersRef.current.values()) {
                handler(prevState, newDimensions)
            }
            return newDimensions
        })
    }

    function registerPlotDimensionChangeHandler(handler: PlotDimensionChangeHandler) {
        const handlerId = crypto.randomUUID()
        plotDimensionChangeHandersRef.current.set(handlerId, handler)
        return handlerId
    }

    function unregisterPlotDimensionChangeHandler(handlerId: string): boolean {
        return plotDimensionChangeHandersRef.current.delete(handlerId)
    }

    return <PlotDimensionsContext.Provider
        value={{
            plotDimensions: dimensions,
            margin,
            updateDimensions,
            registerPlotDimensionChangeHandler,
            unregisterPlotDimensionChangeHandler
        }}
    >
        {children}
    </PlotDimensionsContext.Provider>
}