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
    // holds the latest committed dimensions so the change handlers can be fired from the effect body
    const dimensionsRef = useRef<Dimensions>(dimensions)
    const plotDimensionChangeHandlersRef = useRef<Map<string, PlotDimensionChangeHandler>>(new Map())

    // update the plot dimensions when the container size or margin change
    useEffect(
        () => {
            const newDimensions = plotDimensionsFrom(containerDimensions.width, containerDimensions.height, margin)
            if (dimensionsNotEqual(dimensionsRef.current, newDimensions)) {
                for (const handler of plotDimensionChangeHandlersRef.current.values()) {
                    handler(dimensionsRef.current, newDimensions)
                }
                dimensionsRef.current = newDimensions
                setDimensions(newDimensions)
            }
        },
        [containerDimensions, margin]
    )

    /**
     * Updates the plot dimensions and fires any registered change handlers.
     * @param newDimensions The new plot dimensions.
     */
    function updateDimensions(newDimensions: Dimensions) {
        if (dimensionsNotEqual(dimensionsRef.current, newDimensions)) {
            for (const handler of plotDimensionChangeHandlersRef.current.values()) {
                handler(dimensionsRef.current, newDimensions)
            }
            dimensionsRef.current = newDimensions
            setDimensions(newDimensions)
        }
    }

    /**
     * Registers a plot dimension change handler.
     * @param handler The handler to register.
     * @returns The handler ID.
     */
    function registerPlotDimensionChangeHandler(handler: PlotDimensionChangeHandler) {
        const handlerId = crypto.randomUUID()
        plotDimensionChangeHandlersRef.current.set(handlerId, handler)
        return handlerId
    }

    /**
     * Unregisters a plot dimension change handler.
     * @param handlerId The handler ID.
     * @returns True if the handler was unregistered, false if it was not found.
     */
    function unregisterPlotDimensionChangeHandler(handlerId: string): boolean {
        return plotDimensionChangeHandlersRef.current.delete(handlerId)
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