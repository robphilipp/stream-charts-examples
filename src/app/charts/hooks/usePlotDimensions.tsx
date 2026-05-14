import {type Dimensions, type Margin} from "../styling/margins";
import {createContext, useContext} from "react";
import {defaultPlotDimensions} from "./defaultPlotDimensions";

export type PlotDimensionChangeHandler = (previousDimensions: Dimensions, newDimensions: Dimensions) => void

export type UsePlotDimensionsValues = {
    /**
     * The width and height (in pixels) of this chart
     */
    plotDimensions: Dimensions
    /**
     * The plot margins for the border of main G
     */
    margin: Margin
    /**
     * Update the plot dimensions (for example, on a window resize)
     * @param dimensions the new dimensions of the plot
     */
    updateDimensions: (dimensions: Dimensions) => void
    registerPlotDimensionChangeHandler: (handler: PlotDimensionChangeHandler) => string
    unregisterPlotDimensionChangeHandler: (handlerId: string) => void
}

export const PlotDimensionsContext = createContext<UsePlotDimensionsValues>(defaultPlotDimensions())

/**
 * React hook that sets up the React context for the plot-dimension values.
 * @return The {@link UsePlotDimensionsValues} held in the React context.
 */
export function usePlotDimensions(): UsePlotDimensionsValues {
    const context = useContext<UsePlotDimensionsValues>(PlotDimensionsContext)
    const {plotDimensions} = context
    if (plotDimensions === undefined || plotDimensions === null) {
        throw new Error("usePlotDimensions can only be used when the parent is a <PlotDimensionsProvider/>")
    }
    return context
}
