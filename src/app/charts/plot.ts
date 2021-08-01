import {Dimensions, Margin} from "./margins";
import * as d3 from "d3";
import {GSelection, SvgSelection} from "./d3types";
import {PlotDimensions} from "stream-charts/dist/src/app/charts/margins";

export type Range = [min: number, max: number]
export type TimeSeries = Array<[number, number]>

export function createPlotContainer(chartId: number, container: SVGSVGElement, dimensions: Dimensions, color: string): GSelection {
    const {width, height} = dimensions
    return d3.select<SVGSVGElement, any>(container)
        .attr('width', width)
        .attr('height', height)
        .attr('color', color)
        .append<SVGGElement>('g')
        .attr('id', `main-container-${chartId}`)
}

export function setClipPath(chartId: number, svg: SvgSelection, plotDimensions: PlotDimensions, margin: Margin): string {
    const clipPathId = `chart-clip-path-${chartId}`

    // remove the old clipping region and add a new one with the updated plot dimensions
    svg.select('defs').remove();
    svg
        .append('defs')
        .append("clipPath")
        .attr("id", clipPathId)
        .append("rect")
        .attr("width", plotDimensions.width)
        .attr("height", plotDimensions.height - margin.top)

    return clipPathId
}
