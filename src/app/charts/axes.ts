import {Dimensions, Margin} from "./margins";
import {ContinuousAxisRange} from "./continuousAxisRangeFor";
import * as d3 from "d3";
import {Axis, ScaleBand, ScaleContinuousNumeric, ScaleLinear, ZoomTransform} from "d3";
import {AxisElementSelection, SvgSelection} from "./d3types";
import {addContinuousNumericXAxis, addContinuousNumericYAxis} from "./ContinuousAxis";
import {noop} from "./utils";

export interface AxesLabelFont {
    size: number
    color: string
    family: string
    weight: number
}

export const defaultAxesLabelFont: AxesLabelFont = {
    size: 12,
    color: '#d2933f',
    weight: 300,
    family: 'sans-serif'
}

export interface SeriesLineStyle {
    color: string
    lineWidth: number
    highlightColor: string
    highlightWidth: number
}

export const defaultLineStyle: SeriesLineStyle = {
    color: '#008aad',
    lineWidth: 1,
    highlightColor: '#d2933f',
    highlightWidth: 3
}

export interface Axes<X extends BaseAxis, Y extends BaseAxis> {
    xAxis: X
    yAxis: Y
}

export interface BaseAxis {
    selection: AxisElementSelection
}

export interface ContinuousNumericAxis extends BaseAxis {
    scale: ScaleContinuousNumeric<number, number>
    generator: Axis<number | { valueOf(): number }>
    update: (domain: [startValue: number, endValue: number], plotDimensions: Dimensions, margin: Margin) => void
}

export interface CategoryAxis extends BaseAxis {
    scale: ScaleBand<string>
    generator: Axis<string>
    categorySize: number
    update: (categoryNames: Array<string>, unfilteredSize: number, plotDimensions: Dimensions, margin: Margin) => number
}

export enum AxisLocation {
    Left ,
    Right,
    Bottom,
    Top
}

export function addLinearAxis(
    chartId: number,
    svg: SvgSelection,
    location: AxisLocation,
    plotDimensions: Dimensions,
    domain: [minValue: number, maxValue: number],
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
): ContinuousNumericAxis {
    switch (location) {
        // y-axis
        case AxisLocation.Left:
        case AxisLocation.Right:
            return addContinuousNumericYAxis(
                chartId,
                svg,
                plotDimensions,
                location,
                d3.scaleLinear(),
                domain,
                axesLabelFont,
                margin,
                axisLabel
            )

        // x-axis
        case AxisLocation.Bottom:
        case AxisLocation.Top:
            return addContinuousNumericXAxis(
                chartId,
                svg,
                plotDimensions,
                location,
                d3.scaleLinear(),
                domain,
                axesLabelFont,
                margin,
                axisLabel,
                "",
                noop
            )
    }
}

export function addCategoryAxis(
    chartId: number,
    svg: SvgSelection,
    location: AxisLocation,
    plotDimensions: Dimensions,
    categories: Array<string>,
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
): CategoryAxis {
    switch (location) {
        case AxisLocation.Left:
        case AxisLocation.Right:
            return addCategoryYAxis(chartId, svg, plotDimensions, categories, axesLabelFont, margin, axisLabel)

        case AxisLocation.Bottom:
        case AxisLocation.Top:
            //todo should be the x axis
            return addCategoryYAxis(chartId, svg, plotDimensions, categories, axesLabelFont, margin, axisLabel)
    }
}

function addCategoryYAxis(
    chartId: number,
    svg: SvgSelection,
    plotDimensions: Dimensions,
    categories: Array<string>,
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
): CategoryAxis {
    const categorySize = (plotDimensions.height - margin.top) / categories.length;
    const scale = d3.scaleBand()
        .domain(categories)
        .range([0, categorySize * categories.length]);

    // create and add the axes
    const generator = d3.axisLeft(scale);

    const selection = svg
        .append<SVGGElement>('g')
        .attr('id', `y-axis-selection-${chartId}`)
        .attr('class', 'y-axis')
        .attr('transform', `translate(${margin.left}, ${margin.top})`)
        .call(generator);

    svg
        .append<SVGTextElement>('text')
        .attr('id', `stream-chart-y-axis-label-${chartId}`)
        .attr('text-anchor', 'middle')
        .attr('font-size', axesLabelFont.size)
        .attr('fill', axesLabelFont.color)
        .attr('font-family', axesLabelFont.family)
        .attr('font-weight', axesLabelFont.weight)
        .attr('transform', `translate(${axesLabelFont.size}, ${margin.top + (plotDimensions.height - margin.top - margin.bottom)/2}) rotate(-90)`)
        .text(axisLabel)

    const axis = {scale, selection, generator, categorySize, update: () => categorySize}

    return {
        ...axis,
        update: (categoryNames, unfilteredSize, plotDimensions) => updateCategoryYAxis(chartId, svg, axis, plotDimensions, unfilteredSize, categoryNames, axesLabelFont, margin)
    }
}

function updateCategoryYAxis(
    chartId: number,
    svg: SvgSelection,
    axis: CategoryAxis,
    plotDimensions: Dimensions,
    unfilteredSize: number,
    names: Array<string>,
    axesLabelFont: AxesLabelFont,
    margin: Margin,
): number {
    const categorySize = (plotDimensions.height - margin.top) / unfilteredSize
    axis.scale
        .domain(names)
        .range([0, categorySize * names.length])
    axis.selection.call(axis.generator)

    svg
        .select(`#stream-chart-y-axis-label-${chartId}`)
        .attr('transform', `translate(${axesLabelFont.size}, ${margin.top + (plotDimensions.height - margin.top - margin.bottom)/2}) rotate(-90)`)

    return categorySize
}

export function addClipArea(
    chartId: number,
    svg: SvgSelection,
    plotDimensions: Dimensions,
    margin: Margin
) {
    // create the clipping region so that the lines are clipped at the y-axis
    svg
        .append("defs")
        .append("clipPath")
        .attr("id", `clip-series-${chartId}`)
        .append("rect")
        .attr("width", plotDimensions.width)
        .attr("height", plotDimensions.height - margin.top)
}



export interface ZoomResult {
    range: ContinuousAxisRange
    zoomFactor: number
}
/**
 * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
 * at the location of the mouse when the scroll wheel or gesture was applied.
 * @param transform The d3 zoom transformation information
 * @param x The x-position of the mouse when the scroll wheel or gesture is used
 * @param plotDimensions The current dimensions of the plot
 * @param axis The axis being zoomed
 * @param range The current range for the axis being zoomed
 * @return The updated range and the new zoom factor
 */
export function calculateZoomFor(
    transform: ZoomTransform,
    x: number,
    plotDimensions: Dimensions,
    axis: ContinuousNumericAxis,
    range: ContinuousAxisRange,
): ZoomResult {
    const time = axis.generator.scale<ScaleLinear<number, number>>().invert(x);
    return {
        range: range.scale(transform.k, time),
        zoomFactor: transform.k
    } ;
}

/**
 * Adjusts the range and updates the plot when the plot is dragged to the left or right
 * @param deltaX The amount that the plot is dragged
 * @param plotDimensions The dimensions of the plot
 * @param axis The axis being zoomed
 * @param range The current range for the axis being zoomed
 * @return The updated range
 */
export function calculatePanFor(
    deltaX: number,
    plotDimensions: Dimensions,
    axis: ContinuousNumericAxis,
    range: ContinuousAxisRange,
): ContinuousAxisRange {
    const scale = axis.generator.scale<ScaleLinear<number, number>>()
    const currentTime = range.start
    const x = scale(currentTime)
    const deltaTime = scale.invert(x + deltaX) - currentTime
    return range.translate(-deltaTime)
}

