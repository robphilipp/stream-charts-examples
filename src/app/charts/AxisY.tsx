import {useEffect, useRef} from 'react'
import * as d3 from "d3";
import {AxesLabelFont, AxisLocation, defaultAxesLabelFont, LinearAxis} from "./axes";
import {useChart} from "./useChart";
import {SvgSelection} from "./d3types";
import {Dimensions, Margin} from "./margins";
import {noop} from "./utils";
import {PlotDimensions} from "stream-charts/dist/src/app/charts/margins";

interface Props {
    location: AxisLocation.Left | AxisLocation.Right,
    domain: [min: number, max: number],
    font?: Partial<AxesLabelFont>,
    label: string
}

export function AxisY(props: Props) {
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
                } else {
                    axisRef.current.update(domain, plotDimensions, margin)
                }
            }
        },
        [chartId, container, domain, label, location, margin, plotDimensions, props.font]
    )

    return null
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

    // todo update the label location based on the location
    svg
        .append<SVGTextElement>('text')
        .attr('id', `stream-chart-y-axis-${location}-label-${chartId}`)
        .attr('text-anchor', 'start')
        .attr('font-size', axesLabelFont.size)
        .attr('fill', axesLabelFont.color)
        .attr('font-family', axesLabelFont.family)
        .attr('font-weight', axesLabelFont.weight)
        .attr('transform', `translate(${labelXTranslation(location, plotDimensions, margin, axesLabelFont)}, ${labelYTranslation(plotDimensions, margin)}) rotate(-90)`)
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

function labelYTranslation(plotDimensions: PlotDimensions, margin: Margin): number {
    return margin.top + plotDimensions.height / 2
    // return margin.top + (plotDimensions.height - margin.top - margin.bottom)/2
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
        .attr('transform', `translate(${labelXTranslation(location, plotDimensions, margin, axesLabelFont)}, ${labelYTranslation(plotDimensions, margin)}) rotate(-90)`)
}
