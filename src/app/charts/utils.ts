import {Margin, Dimensions} from "./margins"
import {Selection, ZoomTransform} from "d3";
import {Axes, calculateZoomFor, LinearAxis} from "./axes";
import {TimeRangeType} from "stream-charts/dist/src/app/charts/timeRange";

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

/**
 * The object returned by the zoom
 */
export interface Zoom {
    zoomFactor: number,
    timeRange: TimeRangeType,
}

/**
 * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
 * at the location of the mouse when the scroll wheel or gesture was applied.
 * @param transform The d3 zoom transformation information
 * @param x The x-position of the mouse when the scroll wheel or gesture is used
 * @param plotDimensions The current dimensions of the plot
 * @param containerWidth The container width
 * @param margin The plot margins
 * @param xAxis The linear x-axis
 * @param timeRange The time-range of the current x-axis
 * @return The zoom factor and updated time-range
 */
export function handleZoom(
    transform: ZoomTransform,
    x: number,
    plotDimensions: Dimensions,
    containerWidth: number,
    margin: Margin,
    xAxis: LinearAxis,
    timeRange: TimeRangeType,
): Zoom | undefined {
    if (x > 0 && x < containerWidth - margin.right) {
        const {range, zoomFactor} = calculateZoomFor(transform, x, plotDimensions, xAxis, timeRange)
        return {zoomFactor, timeRange: range}
    }
}
