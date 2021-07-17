import {Dimensions, Margin} from "./margins"
import * as d3 from "d3";
import {Selection, ZoomTransform} from "d3";
import {calculateZoomFor, LinearAxis} from "./axes";
import {TimeRangeType} from "stream-charts/dist/src/app/charts/timeRange";

/**
 * Calculates whether the mouse is in the plot-area
 * @param x The x-coordinate of the mouse's position
 * @param y The y-coordinate of the mouse's position
 * @param margin The plot margins
 * @param dimensions The the overall dimensions (plot dimensions plus margin)
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

// export function configureZoom(
//     svg: SvgSelection,
//     margin: Margin,
//     plotDimensions: PlotDimensions,
//     width: number,
//     height: number
// ) {
//     const zoom = d3.zoom<SVGSVGElement, Datum>()
//         .scaleExtent([0, 10])
//         .translateExtent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
//         .on("zoom", () => {
//             onZoom(d3.event.transform, d3.event.sourceEvent.offsetX - margin.left, plotDimensions)
//         })
//
//
//     svg.call(zoom)
// }
//
// /**
//  * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
//  * at the location of the mouse when the scroll wheel or gesture was applied.
//  * @param transform The d3 zoom transformation information
//  * @param x The x-position of the mouse when the scroll wheel or gesture is used
//  * @param plotDimensions The dimensions of the plot
//  */
// function onZoom(
//     transform: ZoomTransform,
//     x: number,
//     plotDimensions: Dimensions,
//     xAxis: LinearAxis,
//     timeRange: ContinuousAxisRange
// ): void {
//     // if (axesRef.current !== undefined) {
//         const zoom = handleZoom(transform, x, plotDimensions, width, margin, xAxis, timeRange)
//         if (zoom) {
//             timeRangeRef.current = zoom.timeRange
//             zoomFactorRef.current = zoom.zoomFactor
//             updatePlot(timeRange, plotDimensions)
//         }
//     // }
// }

export function formatNumber(value: number, format: string): string {
    return isNaN(value) ? '---' : d3.format(format)(value)
}

export function formatTime(value: number): string {
    return formatNumber(value, " ,.0f")
}

export function formatValue(value: number): string {
    return formatNumber(value, " ,.3f")
}

export function formatChange(v1: number, v2: number, format: string): string {
    return isNaN(v1) || isNaN(v2) ? '---' : d3.format(format)(v2 - v1)
}

export function formatTimeChange(v1: number, v2: number): string {
    return formatChange(v1, v2, " ,.0f")
}

export function formatValueChange(v1: number, v2: number): string {
    return formatChange(v1, v2, " ,.3f")
}
