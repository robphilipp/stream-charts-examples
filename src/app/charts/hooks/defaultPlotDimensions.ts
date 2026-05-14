import type {Margin} from "../styling/margins";
import type {UsePlotDimensionsValues} from "./usePlotDimensions";

/**
 * No operation function for use when a default function is needed
 */
const noop = () => {
    /* empty on purpose */
}

export const defaultPlotDimensions = (): UsePlotDimensionsValues => ({
    plotDimensions: {width: 0, height: 0},
    margin: defaultMargin,
    updateDimensions: noop,
    registerPlotDimensionChangeHandler: () => "",
    unregisterPlotDimensionChangeHandler: noop
})

export const defaultMargin: Margin = {top: 30, right: 20, bottom: 30, left: 50}
