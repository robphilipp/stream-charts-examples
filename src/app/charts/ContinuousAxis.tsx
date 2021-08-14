import {AxesLabelFont, AxisLocation, ContinuousNumericAxis, defaultAxesLabelFont} from "./axes";
import {useChart} from "./useChart";
import {useCallback, useEffect, useRef} from "react";
import * as d3 from "d3";
import {ScaleContinuousNumeric} from "d3";
import {SvgSelection} from "./d3types";
import {Dimensions, Margin} from "./margins";
import {noop} from "./utils";
import {PlotDimensions} from "stream-charts/dist/src/app/charts/margins";
import {ContinuousAxisRange} from "./continuousAxisRangeFor";

interface Props {
    // the unique ID of the axis
    axisId: string
    // the location of the axis. for x-axes, this must be either top or bottom. for
    // y-axes, this mut be either left or right
    location: AxisLocation
    // linear, log, or power scale that defaults to linear scale when not specified
    scale?: ScaleContinuousNumeric<number, number>
    // the min and max values for the axis
    domain: [min: number, max: number]
    // the font for drawing the axis ticks and labels
    font?: Partial<AxesLabelFont>
    // the axis label
    label: string
}

export function ContinuousAxis(props: Props): null {
    const {
        chartId,
        container,
        plotDimensions,
        margin,
        addXAxis,
        addYAxis,
        setTimeRangeFor,
        timeRangeFor,
        // setWindowingTimeFor,
        addTimeUpdateHandler,
        removeTimeUpdateHandler
    } = useChart()

    const {
        axisId,
        location,
        scale = d3.scaleLinear(),
        domain,
        label
    } = props

    const axisRef = useRef<ContinuousNumericAxis>()
    const timeUpdateHandlerIdRef = useRef<string>()

    // useEffect(
    //     () => {
    //         const [start, end] = domain
    //         setWindowingTimeFor(axisId, Math.abs(end - start))
    //     },
    //     [axisId, domain, setWindowingTimeFor]
    // )
    const handleTimeUpdates = useCallback(
        (updates: Map<string, ContinuousAxisRange>): void => {
            if (timeUpdateHandlerIdRef.current && axisRef.current) {
                const range = updates.get(axisId)
                if (range) {
                    axisRef.current.update([range.start, range.end], plotDimensions, margin)
                }
            }
        },
        [axisId, margin, plotDimensions]
    )

    useEffect(
        () => {
            if (container) {
                const svg = d3.select<SVGSVGElement, any>(container)
                const font: AxesLabelFont = {...defaultAxesLabelFont, ...props.font}

                if (axisRef.current === undefined) {
                    switch (location) {
                        case AxisLocation.Bottom:
                        case AxisLocation.Top:
                            axisRef.current = addContinuousNumericXAxis(
                                chartId,
                                svg,
                                plotDimensions,
                                location,
                                scale,
                                domain,
                                font,
                                margin,
                                label,
                                axisId,
                                setTimeRangeFor,
                            )
                            // add the x-axis to the chart context
                            addXAxis(axisRef.current, axisId)

                            // set the time-range for the time-axis
                            setTimeRangeFor(axisId, domain)

                            // add an update handler
                            timeUpdateHandlerIdRef.current = `x-axis-${chartId}-${location}`
                            addTimeUpdateHandler(timeUpdateHandlerIdRef.current, handleTimeUpdates)

                            break

                        case AxisLocation.Left:
                        case AxisLocation.Right:
                            axisRef.current = addContinuousNumericYAxis(
                                chartId,
                                svg,
                                plotDimensions,
                                location,
                                scale,
                                domain,
                                font,
                                margin,
                                label,
                            )
                            // add the x-axis to the chart context
                            addYAxis(axisRef.current, axisId)
                    }
                } else {
                    switch (location) {
                        case AxisLocation.Bottom:
                        case AxisLocation.Top:
                            const timeRange = timeRangeFor(axisId)
                            if (timeRange) {
                                axisRef.current.update(timeRange, plotDimensions, margin)
                            }
                            break
                        case AxisLocation.Left:
                        case AxisLocation.Right:
                            // todo will need to use and update the domain for the y-axis when using
                            //      zoom...do something similar to what I did for the time-range
                            axisRef.current.update(domain, plotDimensions, margin)
                    }
                }
            }
        },
        [
            chartId, axisId, label, location, props.font, addXAxis, addYAxis,
            domain, scale, container, margin, plotDimensions, setTimeRangeFor, timeRangeFor, addTimeUpdateHandler,
            handleTimeUpdates
        ]
    )

    return null
}


export function addContinuousNumericXAxis(
    chartId: number,
    svg: SvgSelection,
    plotDimensions: Dimensions,
    location: AxisLocation.Bottom | AxisLocation.Top,
    scaleGenerator: ScaleContinuousNumeric<number, number>,
    domain: [minValue: number, maxValue: number],
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
    axisId: string,
    setTimeRangeFor: (axisId: string, timeRange: [start: number, end: number]) => void
): ContinuousNumericAxis {
    const scale = scaleGenerator.domain(domain).range([0, plotDimensions.width])

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

    const axis: ContinuousNumericAxis = {
        scale,
        selection,
        generator: location === AxisLocation.Bottom ? d3.axisBottom(scale) : d3.axisTop(scale),
        update: noop
    }
    return {
        ...axis,
        update: (domain: [start: number, end: number], plotDimensions: PlotDimensions, margin: Margin) => {
            updateLinearXAxis(
                chartId, svg, axis, domain, plotDimensions, margin, location
            )
            setTimeRangeFor(axisId, domain)
        }
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
    axis: ContinuousNumericAxis,
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


export function addContinuousNumericYAxis(
    chartId: number,
    svg: SvgSelection,
    plotDimensions: Dimensions,
    location: AxisLocation.Left | AxisLocation.Right,
    scaleGenerator: ScaleContinuousNumeric<number, number>,
    domain: [minValue: number, maxValue: number],
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
): ContinuousNumericAxis {
    // const scale = d3.scaleLinear()
    const scale = scaleGenerator
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
    axis: ContinuousNumericAxis,
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
