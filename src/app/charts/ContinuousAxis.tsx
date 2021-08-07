import {AxesLabelFont, AxisLocation, defaultAxesLabelFont, LinearAxis} from "./axes";
import {useChart} from "./useChart";
import {useEffect, useRef} from "react";
import * as d3 from "d3";
import {SvgSelection} from "./d3types";
import {Dimensions, Margin} from "./margins";
import {noop} from "./utils";
import {PlotDimensions} from "stream-charts/dist/src/app/charts/margins";

interface Props {
    location: AxisLocation,
    domain: [min: number, max: number],
    font?: Partial<AxesLabelFont>,
    label: string
}

export function ContinuousAxis(props: Props): null {
    const {
        chartId,
        container,
        plotDimensions,
        margin,
    } = useChart()

    const {
        location,
        domain,
        label
    } = props

    const axisRef = useRef<LinearAxis>()

    useEffect(
        () => {
            if (container) {
                const svg = d3.select<SVGSVGElement, any>(container)
                const font: AxesLabelFont = {...defaultAxesLabelFont, ...props.font}

                if (axisRef.current === undefined) {
                    switch (location) {
                        case AxisLocation.Bottom:
                        case AxisLocation.Top:
                            axisRef.current = addLinearXAxis(
                                chartId,
                                svg,
                                plotDimensions,
                                location,
                                domain,
                                font,
                                margin,
                                label,
                            )
                            break

                        case AxisLocation.Left:
                        case AxisLocation.Right:
                            axisRef.current = addLinearYAxis(
                                chartId,
                                svg,
                                plotDimensions,
                                location,
                                domain,
                                font,
                                margin,
                                label,
                            )
                    }
                } else {
                    axisRef.current.update(domain, plotDimensions, margin)
                }
            }
        },
        [chartId, container, domain, label, location, margin, plotDimensions, props.font]
    )

    return null
}


export function addLinearXAxis(
    chartId: number,
    svg: SvgSelection,
    plotDimensions: Dimensions,
    location: AxisLocation.Bottom | AxisLocation.Top,
    domain: [minValue: number, maxValue: number],
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
): LinearAxis {
    const scale = d3.scaleLinear().domain(domain).range([0, plotDimensions.width])

    const selection = svg
        .append<SVGGElement>('g')
        .attr('transform', `translate(${margin.left}, ${yTranslation(location, plotDimensions, margin)})`)

    svg
        .append<SVGTextElement>('text')
        .attr('id', `stream-chart-x-axis-${location}-label-${chartId}`)
        .attr('text-anchor', 'middle')
        .attr('font-size', axesLabelFont.size)
        .attr('fill', axesLabelFont.color)
        .attr('font-family', axesLabelFont.family)
        .attr('font-weight', axesLabelFont.weight)
        .attr('transform', `translate(${margin.left + plotDimensions.width / 2}, ${labelYTranslation(location, plotDimensions, margin)})`)
        .text(axisLabel)

    const axis: LinearAxis = {
        scale,
        selection,
        generator: location === AxisLocation.Bottom ? d3.axisBottom(scale) : d3.axisTop(scale),
        update: noop
    }
    return {
        ...axis,
        update: (domain, plotDimensions, margin) => updateLinearXAxis(
            chartId, svg, axis, domain, plotDimensions, margin, location
        )
    }
}

function yTranslation(location: AxisLocation.Bottom | AxisLocation.Top, plotDimensions: PlotDimensions, margin: Margin): number {
    return location === AxisLocation.Bottom ?
        plotDimensions.height + margin.top - margin.bottom :
        margin.top
}

function labelYTranslation(location: AxisLocation.Bottom | AxisLocation.Top, plotDimensions: PlotDimensions, margin: Margin): number {
    return location === AxisLocation.Bottom ?
        plotDimensions.height + margin.top + (margin.bottom / 3) :
        margin.top / 3
}

function updateLinearXAxis(
    chartId: number,
    svg: SvgSelection,
    axis: LinearAxis,
    domain: [startValue: number, endValue: number],
    plotDimensions: Dimensions,
    margin: Margin,
    location: AxisLocation.Bottom | AxisLocation.Top,
): void {
    axis.scale.domain(domain).range([0, plotDimensions.width])

    axis.selection
        .attr('transform', `translate(${margin.left}, ${yTranslation(location, plotDimensions, margin)})`)
        .call(axis.generator)
    svg
        .select(`#stream-chart-x-axis-${location}-label-${chartId}`)
        .attr('transform', `translate(${margin.left + plotDimensions.width / 2}, ${labelYTranslation(location, plotDimensions, margin)})`)
}


export function addLinearYAxis(
    chartId: number,
    svg: SvgSelection,
    plotDimensions: Dimensions,
    location: AxisLocation.Left | AxisLocation.Right,
    domain: [minValue: number, maxValue: number],
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
): LinearAxis {
    const scale = d3.scaleLinear()
        .domain(domain)
        .range([plotDimensions.height - margin.bottom, 0])

    const generator = location === AxisLocation.Left ? d3.axisLeft(scale) : d3.axisRight(scale)
    const selection = svg
        .append<SVGGElement>('g')
        .attr('class', 'y-axis')
        .attr('transform', `translate(${xTranslation(location, plotDimensions, margin)}, ${margin.top})`)

    svg
        .append<SVGTextElement>('text')
        .attr('id', `stream-chart-y-axis-${location}-label-${chartId}`)
        .attr('text-anchor', 'start')
        .attr('font-size', axesLabelFont.size)
        .attr('fill', axesLabelFont.color)
        .attr('font-family', axesLabelFont.family)
        .attr('font-weight', axesLabelFont.weight)
        .attr('transform', `translate(${labelXTranslation(location, plotDimensions, margin, axesLabelFont)}, ${margin.top + plotDimensions.height / 2}) rotate(-90)`)
        .text(axisLabel)

    // return {scale, selection, generator}
    const axis = {scale, selection, generator, update: noop}
    return {
        ...axis,
        update: (domain, plotDimensions, margin) => updateLinearYAxis(
            chartId, svg, axis, domain, plotDimensions, margin, axesLabelFont, location
        )
    }
}

function xTranslation(location: AxisLocation.Left | AxisLocation.Right, plotDimensions: PlotDimensions, margin: Margin): number {
    return location === AxisLocation.Left ?
        margin.left :
        margin.left + plotDimensions.width
}

function labelXTranslation(location: AxisLocation.Left | AxisLocation.Right, plotDimensions: PlotDimensions, margin: Margin, axesLabelFont: AxesLabelFont): number {
    return location === AxisLocation.Left ?
        axesLabelFont.size :
        margin.left + plotDimensions.width + margin.right - axesLabelFont.size
}

function updateLinearYAxis(
    chartId: number,
    svg: SvgSelection,
    axis: LinearAxis,
    domain: [startValue: number, endValue: number],
    plotDimensions: Dimensions,
    margin: Margin,
    axesLabelFont: AxesLabelFont,
    location: AxisLocation.Left | AxisLocation.Right,
): void {
    axis.scale.domain(domain).range([plotDimensions.height - margin.bottom, 0])
    axis.selection
        .attr('transform', `translate(${xTranslation(location, plotDimensions, margin)}, ${margin.top})`)
        .call(axis.generator)

    svg
        .select(`#stream-chart-y-axis-${location}-label-${chartId}`)
        .attr('transform', `translate(${labelXTranslation(location, plotDimensions, margin, axesLabelFont)}, ${margin.top + plotDimensions.height / 2}) rotate(-90)`)
}
