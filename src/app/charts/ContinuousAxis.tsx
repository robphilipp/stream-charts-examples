import {AxesLabelFont, AxisLocation, ContinuousNumericAxis, defaultAxesLabelFont} from "./axes";
import {useChart} from "./hooks/useChart";
import {useEffect, useRef} from "react";
import * as d3 from "d3";
import {ScaleContinuousNumeric} from "d3";
import {SvgSelection} from "./d3types";
import {Dimensions, Margin} from "./margins";
import {noop} from "./utils";
import {ContinuousAxisRange} from "./continuousAxisRangeFor";
import {usePlotDimensions} from "./hooks/usePlotDimensions";

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
    // the scatter and raster time-series charts start "scrolling" the time axis when the
    // current time hits the upper end of the axis range, and when that happens, the updates
    // to the axis range are driven by the data. in this case, we want to defer the axis-range
    // updates to the subscription by setting this value to `true` (its default value),
    // because it knows about the data and how to calculate the new axis range to simulate
    // scrolling of the time axis.
    //
    // on the other hand, the iterates chart generally has fixed axis ranges, that may be
    // controlled by the implementation of the chart. for example, when switching an iterate
    // function that has a different range, we want to be able to use the new "domain" value
    // to update the axis. in this case we set this value to `false` and let this the
    // "ContinuousAxis" manage the axis range.
    deferAxisRangeUpdates?: boolean
}

export function ContinuousAxis(props: Props): null {
    const {
        chartId,
        container,
        axes,
        color
    } = useChart()

    const {
        xAxesState,
        yAxesState,
        addXAxis,
        addYAxis,
        setAxisBoundsFor,
        axisBoundsFor,
        addAxesBoundsUpdateHandler,
    } = axes

    const {
        plotDimensions,
        margin
    } = usePlotDimensions()

    const {
        axisId,
        location,
        scale = d3.scaleLinear(),
        domain,
        label,
        deferAxisRangeUpdates = true
    } = props

    const axisRef = useRef<ContinuousNumericAxis>()
    const rangeUpdateHandlerIdRef = useRef<string>()

    const axisIdRef = useRef<string>(axisId)
    const marginRef = useRef<Margin>(margin)
    useEffect(
        () => {
            axisIdRef.current = axisId
            marginRef.current = margin
        },
        [axisId, plotDimensions, margin]
    )

    useEffect(
        () => {
            if (container) {
                const svg = d3.select<SVGSVGElement, any>(container)
                const font: AxesLabelFont = {...defaultAxesLabelFont, color, ...props.font}

                const handleRangeUpdates = (updates: Map<string, ContinuousAxisRange>, plotDim: Dimensions): void => {
                    if (rangeUpdateHandlerIdRef.current && axisRef.current) {
                        const range = updates.get(axisId)
                        if (range) {
                            axisRef.current.update([range.start, range.end], plotDim, marginRef.current)
                        }
                    }
                }

                if (axisRef.current === undefined) {
                    switch (location) {
                        case AxisLocation.Bottom:
                        case AxisLocation.Top:
                            axisRef.current = addContinuousNumericXAxis(
                                chartId, axisId, svg, plotDimensions, location, scale, domain,
                                font, margin, label, setAxisBoundsFor
                            )
                            // add the x-axis to the chart context
                            addXAxis(axisRef.current, axisId, domain)

                            // add an update handler
                            rangeUpdateHandlerIdRef.current = `x-axis-${chartId}-${location.valueOf()}`
                            addAxesBoundsUpdateHandler(rangeUpdateHandlerIdRef.current, handleRangeUpdates)

                            break

                        case AxisLocation.Left:
                        case AxisLocation.Right:
                            axisRef.current = addContinuousNumericYAxis(
                                chartId, axisId, svg, plotDimensions, location, scale, domain,
                                font, margin, label, setAxisBoundsFor
                            )
                            // add the y-axis to the chart context
                            addYAxis(axisRef.current, axisId, domain)

                            // add an update handler
                            rangeUpdateHandlerIdRef.current = `y-axis-${chartId}-${location.valueOf()}`
                            addAxesBoundsUpdateHandler(rangeUpdateHandlerIdRef.current, handleRangeUpdates)
                    }
                } else {
                    switch (location) {
                        case AxisLocation.Bottom:
                        case AxisLocation.Top: {
                            const range = axisBoundsFor(axisId)
                            if (range) {
                                axisRef.current.update(range, plotDimensions, margin)
                            }
                            if (rangeUpdateHandlerIdRef.current !== undefined) {
                                addAxesBoundsUpdateHandler(rangeUpdateHandlerIdRef.current, handleRangeUpdates)
                            }
                            if (!deferAxisRangeUpdates) {
                                updateLinearXAxis(domain, label, chartId, svg, axisRef.current, plotDimensions, margin, location)
                            }
                            break
                        }
                        case AxisLocation.Left:
                        case AxisLocation.Right: {
                            const range = axisBoundsFor(axisId)
                            if (range) {
                                axisRef.current.update(range, plotDimensions, margin)
                            }
                            if (rangeUpdateHandlerIdRef.current !== undefined) {
                                addAxesBoundsUpdateHandler(rangeUpdateHandlerIdRef.current, handleRangeUpdates)
                            }
                            if (!deferAxisRangeUpdates) {
                                updateLinearYAxis(domain, label, chartId, svg, axisRef.current, plotDimensions, margin, font, location)
                            }
                        }
                    }
                    svg.select(`#${labelIdFor(chartId, location)}`).attr('fill', color)
                }
            }
        },
        [
            chartId, axisId, label, location, props.font, xAxesState, yAxesState, addXAxis, addYAxis,
            domain, scale, container, margin, plotDimensions, setAxisBoundsFor, axisBoundsFor,
            addAxesBoundsUpdateHandler, color, deferAxisRangeUpdates
        ]
    )

    return null
}

/**
 * Calculates the CSS ID for the axis, based on the chart ID and the location
 * of the axis (e.g. y-axis: left, right; x-axis: top, bottom)
 * @param chartId The ID of the chart
 * @param location The location of the axis
 * @return The CSS ID for the axis
 */
function labelIdFor(chartId: number, location: AxisLocation): string {
    switch (location) {
        case AxisLocation.Bottom:
        case AxisLocation.Top:
            return `stream-chart-x-axis-${location}-label-${chartId}`
        case AxisLocation.Left:
        case AxisLocation.Right:
            return `stream-chart-y-axis-${location}-label-${chartId}`
    }
}

/**
 * Adds a new x-axis to the SVG element at the specified location
 * @param chartId The ID of the chart
 * @param axisId The ID of the axis
 * @param svg The SVG selection to which to add the axis
 * @param plotDimensions The dimensions of the plot
 * @param location The location of the axis
 * @param scaleGenerator The higher-order function that returns the axis d3 "scale" function
 * @param domain The axis range (start, end)
 * @param axesLabelFont The font for the axis labels
 * @param margin The plot margins for the border of main SVG group
 * @param axisLabel The label for the axis
 * @param setAxisRangeFor A callback used to set the axis range
 * @return A {@link ContinuousNumericAxis} based on the arguments to this function
 */
export function addContinuousNumericXAxis(
    chartId: number,
    axisId: string,
    svg: SvgSelection,
    plotDimensions: Dimensions,
    location: AxisLocation.Bottom | AxisLocation.Top,
    scaleGenerator: ScaleContinuousNumeric<number, number>,
    domain: [minValue: number, maxValue: number],
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
    setAxisRangeFor: (axisId: string, timeRange: [start: number, end: number]) => void,
): ContinuousNumericAxis {
    const scale = scaleGenerator.domain(domain).range([0, plotDimensions.width])

    const selection = svg
        .append<SVGGElement>('g')
        .attr('transform', `translate(${margin.left}, ${yTranslation(location, plotDimensions, margin)})`)

    svg
        .append<SVGTextElement>('text')
        .attr('id', labelIdFor(chartId, location))
        .attr('text-anchor', 'middle')
        .attr('font-size', axesLabelFont.size)
        .attr('fill', axesLabelFont.color)
        .attr('font-family', axesLabelFont.family)
        .attr('font-weight', axesLabelFont.weight)
        .attr('transform', `translate(${margin.left + plotDimensions.width / 2}, ${labelYTranslation(location, plotDimensions, margin)})`)
        .text(axisLabel)

    const axis: ContinuousNumericAxis = {
        axisId,
        location,
        selection,
        scale,
        generator: location === AxisLocation.Bottom ? d3.axisBottom(scale) : d3.axisTop(scale),
        update: noop
    }
    return {
        ...axis,
        update: (domain: [start: number, end: number], plotDimensions: Dimensions, margin: Margin) => {
            updateLinearXAxis(domain, axisLabel, chartId, svg, axis, plotDimensions, margin, location)
            setAxisRangeFor(axisId, domain)
        }
    }
}

/**
 * Updates the x-axis with the new domain and axis label
 * @param domain The new (start, end) range of the axis
 * @param label The new label for the axis
 * @param chartId The ID of the chart
 * @param svg The SVG selection of which the axis is a child node
 * @param axis The x-axis
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margins for the border of main SVG group
 * @param location The location of the axis (i.e. top, bottom, left, right)
 */
function updateLinearXAxis(
    domain: [startValue: number, endValue: number],
    label: string,
    chartId: number,
    svg: SvgSelection,
    axis: ContinuousNumericAxis,
    plotDimensions: Dimensions,
    margin: Margin,
    location: AxisLocation.Bottom | AxisLocation.Top,
): void {
    axis.scale.domain(domain).range([0, plotDimensions.width])

    axis.selection
        .attr('transform', `translate(${margin.left}, ${yTranslation(location, plotDimensions, margin)})`)
        .call(axis.generator)
    svg
        .select(`#${labelIdFor(chartId, location)}`)
        .attr('transform', `translate(${margin.left + plotDimensions.width / 2}, ${labelYTranslation(location, plotDimensions, margin)})`)
        .text(label)
}

/**
 * The number of pixels to translate the x-axis to the right
 * @param location The location of the x-axis
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margins for the border of main SVG group
 * @return The number of pixels to translate the x-axis to the right
 */
function yTranslation(location: AxisLocation.Bottom | AxisLocation.Top, plotDimensions: Dimensions, margin: Margin): number {
    return location === AxisLocation.Bottom ?
        Math.max(margin.bottom + margin.top, plotDimensions.height + margin.top - margin.bottom) :
        margin.top
}

/**
 * The number of pixels to translate the x-axis label to the right
 * @param location The location of the x-axis
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margins for the border of main SVG group
 * @return The number of pixels to translate the x-axis label to the right
 */
function labelYTranslation(location: AxisLocation.Bottom | AxisLocation.Top, plotDimensions: Dimensions, margin: Margin): number {
    return location === AxisLocation.Bottom ?
        plotDimensions.height + margin.top + margin.bottom / 3 :
        margin.top / 3
}

/**
 * Adds a new y-axis to the SVG element at the specified location
 * @param chartId The ID of the chart
 * @param axisId The ID of the axis
 * @param svg The SVG selection to which to add the axis
 * @param plotDimensions The dimensions of the plot
 * @param location The location of the axis
 * @param scaleGenerator The higher-order function that returns the axis d3 "scale" function
 * @param domain The axis range (start, end)
 * @param axesLabelFont The font for the axis labels
 * @param margin The plot margins for the border of main SVG group
 * @param axisLabel The label for the axis
 * @param setAxisRangeFor A callback used to set the axis range
 * @return A {@link ContinuousNumericAxis} based on the arguments to this function
 */
export function addContinuousNumericYAxis(
    chartId: number,
    axisId: string,
    svg: SvgSelection,
    plotDimensions: Dimensions,
    location: AxisLocation.Left | AxisLocation.Right,
    scaleGenerator: ScaleContinuousNumeric<number, number>,
    domain: [minValue: number, maxValue: number],
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
    setAxisRangeFor: (axisId: string, range: [start: number, end: number]) => void,
): ContinuousNumericAxis {
    const scale = scaleGenerator
        .domain(domain)
        .range([Math.max(margin.bottom, plotDimensions.height - margin.bottom), 0])

    const selection = svg
        .append<SVGGElement>('g')
        .attr('class', 'y-axis')
        .attr('transform', `translate(${xTranslation(location, plotDimensions, margin)}, ${margin.top})`)

    svg
        .append<SVGTextElement>('text')
        .attr('id', labelIdFor(chartId, location))
        .attr('text-anchor', 'start')
        .attr('font-size', axesLabelFont.size)
        .attr('fill', axesLabelFont.color)
        .attr('font-family', axesLabelFont.family)
        .attr('font-weight', axesLabelFont.weight)
        .attr('transform', `translate(${labelXTranslation(location, plotDimensions, margin, axesLabelFont)}, ${margin.top + plotDimensions.height / 2}) rotate(-90)`)
        .text(axisLabel)

    const axis: ContinuousNumericAxis = {
        axisId,
        location,
        selection,
        scale,
        generator: location === AxisLocation.Left ? d3.axisLeft(scale) : d3.axisRight(scale),
        update: noop
    }
    return {
        ...axis,
        update: (domain: [start: number, end: number], plotDimensions: Dimensions, margin: Margin) => {
            updateLinearYAxis(domain, axisLabel, chartId, svg, axis, plotDimensions, margin, axesLabelFont, location)
            setAxisRangeFor(axisId, domain)
        }
    }
}

/**
 * Updates the y-axis with the new domain and axis label
 * @param domain The new (start, end) range of the axis
 * @param label The new label for the axis
 * @param chartId The ID of the chart
 * @param svg The SVG selection of which the axis is a child node
 * @param axis The y-axis
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margins for the border of main SVG group
 * @param axesLabelFont The font for the axis label
 * @param location The location of the axis (i.e. top, bottom, left, right)
 */
function updateLinearYAxis(
    domain: [startValue: number, endValue: number],
    label: string,
    chartId: number,
    svg: SvgSelection,
    axis: ContinuousNumericAxis,
    plotDimensions: Dimensions,
    margin: Margin,
    axesLabelFont: AxesLabelFont,
    location: AxisLocation.Left | AxisLocation.Right,
): void {
    axis.scale.domain(domain).range([Math.max(margin.bottom, plotDimensions.height - margin.bottom), 0])
    axis.selection
        .attr('transform', `translate(${xTranslation(location, plotDimensions, margin)}, ${margin.top})`)
        .call(axis.generator)

    svg
        .select(`#${labelIdFor(chartId, location)}`)
        .attr('transform', `translate(${labelXTranslation(location, plotDimensions, margin, axesLabelFont)}, ${margin.top + plotDimensions.height / 2}) rotate(-90)`)
        .text(label)
}

/**
 * The number of pixels to translate the y-axis down
 * @param location The location of the y-axis
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margins for the border of main SVG group
 * @return The number of pixels to translate the y-axis down
 */
function xTranslation(location: AxisLocation.Left | AxisLocation.Right, plotDimensions: Dimensions, margin: Margin): number {
    return location === AxisLocation.Left ?
        margin.left :
        margin.left + plotDimensions.width
}

/**
 * The number of pixels to translate the y-axis label down
 * @param location The location of the y-axis
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margins for the border of main SVG group
 * @param axesLabelFont The font for the axis label
 * @return The number of pixels to translate the y-axis label down
 */
function labelXTranslation(location: AxisLocation.Left | AxisLocation.Right, plotDimensions: Dimensions, margin: Margin, axesLabelFont: AxesLabelFont): number {
    return location === AxisLocation.Left ?
        axesLabelFont.size :
        margin.left + plotDimensions.width + margin.right - axesLabelFont.size
}
