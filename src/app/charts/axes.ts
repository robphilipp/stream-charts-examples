import {Margin, PlotDimensions} from "./margins";
import {TimeRangeType} from "./timeRange";
import * as d3 from "d3";
import {AxisElementSelection, SvgSelection} from "./d3types";
import {Axis, ScaleBand, ScaleLinear} from "d3";
import { Series } from "./datumSeries";

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

export interface AxesLineStyle {
    color: string
    lineWidth: number
    highlightColor: string
    highlightWidth: number
}

export const defaultLineStyle: AxesLineStyle = {
    color: '#008aad',
    lineWidth: 1,
    highlightColor: '#d2933f',
    highlightWidth: 3
}

export interface LinearAxis {
    scale: ScaleLinear<number, number>
    selection: AxisElementSelection
    generator: Axis<number | { valueOf(): number }>
}

export interface CategoryAxis {
    scale: ScaleBand<string>
    selection: AxisElementSelection
    generator: Axis<string>
    categorySize: number
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
    plotDimensions: PlotDimensions,
    domain: [minValue: number, maxValue: number],
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
): LinearAxis {
    switch (location) {
        case AxisLocation.Left:
        case AxisLocation.Right:
            return addLinearYAxis(chartId, svg, plotDimensions, location, domain, axesLabelFont, margin, axisLabel)

        case AxisLocation.Bottom:
        case AxisLocation.Top:
            return addLinearXAxis(chartId, svg, plotDimensions, location, domain, axesLabelFont, margin, axisLabel)
    }
}

function addLinearXAxis(
    chartId: number,
    svg: SvgSelection,
    plotDimensions: PlotDimensions,
    location: AxisLocation.Bottom | AxisLocation.Top,
    domain: [minValue: number, maxValue: number],
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
): LinearAxis {
    const scale = d3.scaleLinear()
        .domain(domain)
        .range([0, plotDimensions.width])

    const generator = d3.axisBottom(scale)
    const selection = svg
        .append<SVGGElement>('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(${margin.left}, ${plotDimensions.height})`)

    svg
        .append<SVGTextElement>('text')
        .attr('id', `stream-chart-x-axis-label-${chartId}`)
        .attr('text-anchor', 'middle')
        .attr('font-size', axesLabelFont.size)
        .attr('fill', axesLabelFont.color)
        .attr('font-family', axesLabelFont.family)
        .attr('font-weight', axesLabelFont.weight)
        .attr('transform', `translate(${margin.left + plotDimensions.width / 2}, ${plotDimensions.height + margin.top + (margin.bottom / 3)})`)
        .text(axisLabel)

    return {scale, selection, generator}
}

function addLinearYAxis(
    chartId: number,
    svg: SvgSelection,
    plotDimensions: PlotDimensions,
    location: AxisLocation.Left | AxisLocation.Right,
    domain: [minValue: number, maxValue: number],
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
): LinearAxis {
    const scale = d3.scaleLinear()
        .domain(domain)
        .range([plotDimensions.height - margin.bottom, 0])

    const generator = d3.axisLeft(scale)
    const selection = svg
        .append<SVGGElement>('g')
        .attr('class', 'y-axis')
        .attr('transform', `translate(${margin.left}, ${margin.top})`)

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

    return {scale, selection, generator}
}

export function addCategoryAxis(
    chartId: number,
    svg: SvgSelection,
    location: AxisLocation,
    plotDimensions: PlotDimensions,
    categories: Map<string, Series>,
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
    plotDimensions: PlotDimensions,
    categories: Map<string, Series>,
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
): CategoryAxis {
    const lineHeight = (plotDimensions.height - margin.top) / categories.size;
    const scale = d3.scaleBand()
        .domain(Array.from(categories.keys()))
        .range([0, lineHeight * categories.size]);

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

    return {scale, selection, generator, categorySize: lineHeight}
}

export function addClipArea(
    chartId: number,
    svg: SvgSelection,
    plotDimensions: PlotDimensions,
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