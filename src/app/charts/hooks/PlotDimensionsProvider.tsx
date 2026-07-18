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
    // holds the latest committed dimensions so the change handlers can be fired from the effect
    // body (a pure location) rather than from inside the setDimensions updater. Firing them from
    // the updater is unsafe: StrictMode double-invokes state updater functions, which would run
    // the handlers twice per change (e.g. applying the resize zoom-rescale twice).
    const dimensionsRef = useRef<Dimensions>(dimensions)
    const plotDimensionChangeHandersRef = useRef<Map<string, PlotDimensionChangeHandler>>(new Map())

    // update the plot dimensions when the container size or margin change
    useEffect(
        () => {
            const newDimensions = plotDimensionsFrom(containerDimensions.width, containerDimensions.height, margin)
            if (dimensionsNotEqual(dimensionsRef.current, newDimensions)) {
                for (const handler of plotDimensionChangeHandersRef.current.values()) {
                    handler(dimensionsRef.current, newDimensions)
                }
                dimensionsRef.current = newDimensions
                setDimensions(newDimensions)
            }
        },
        [containerDimensions, margin]
    )

    function updateDimensions(newDimensions: Dimensions) {
        if (dimensionsNotEqual(dimensionsRef.current, newDimensions)) {
            for (const handler of plotDimensionChangeHandersRef.current.values()) {
                handler(dimensionsRef.current, newDimensions)
            }
            dimensionsRef.current = newDimensions
            setDimensions(newDimensions)
        }
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