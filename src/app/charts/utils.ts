import {Margin, Dimensions} from "./margins"
import {Selection} from "d3";

/**
 * Calculates whether the mouse is in the plot-area
 * @param x The x-coordinate of the mouse's position
 * @param y The y-coordinate of the mouse's position
 * @param margin The plot margins
 * @param dimensions The plot dimensions
 * @return `true` if the mouse is in the plot area; `false` if the mouse is not in the plot area
 */
export function mouseInPlotAreaFor(x: number, y: number, margin: Margin, dimensions: Dimensions): boolean {
    return x > margin.left && x < dimensions.width - margin.right && y > margin.top && y < dimensions.height - margin.bottom
}

export const textWidthOf = (elem: Selection<SVGTextElement, any, HTMLElement, any>) => elem.node()?.getBBox()?.width || 0
