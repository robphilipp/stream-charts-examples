import {Dimensions, Margin} from "../styling/margins";
import {ContinuousAxisRange, continuousAxisRangeFor} from "./continuousAxisRangeFor";
import * as d3 from "d3";
import {Axis, ScaleBand, ScaleContinuousNumeric, ScaleLinear, ZoomTransform} from "d3";
import {AxisElementSelection, SvgSelection} from "../d3types";
import {AxesState} from "../hooks/AxesState";
import {AxesAssignment} from "../plots/plot";
import {BaseSeries} from "../series/baseSeries";
import {noop} from "../utils";
import {OrdinalAxisRange, ordinalAxisRangeFor} from "./ordinalAxisRangeFor";
import {BaseAxisRange} from "./BaseAxisRange";

export type AxisTickStyle = {
    font: AxesFont
    rotation: number
    useAutoRotation: boolean
}

export function defaultAxisTickStyle(): AxisTickStyle {
    return {
        font: defaultAxesFont(),
        rotation: 0,
        useAutoRotation: false
    }
}

export interface AxesFont {
    size: number
    color: string
    family: string
    weight: number
}

export function defaultAxesFont(): AxesFont {
    return {
        size: 12,
        color: '#d2933f',
        weight: 300,
        family: 'sans-serif'
    }
}

export interface SeriesStyle {
    color: string
    highlightColor: string
    margin?: number
}

export interface SeriesLineStyle extends SeriesStyle {
    lineWidth: number
    highlightWidth: number
}

export function defaultLineStyle(): SeriesLineStyle {
    return {
        color: '#008aad',
        lineWidth: 1,
        highlightColor: '#008aad',
        highlightWidth: 3,
    }
}

export interface BaseAxis {
    axisId: string
    location: AxisLocation
    selection: AxisElementSelection
}

export interface ContinuousNumericAxis extends BaseAxis {
    scale: ScaleContinuousNumeric<number, number>
    generator: Axis<number | { valueOf(): number }>
    update: (domain: [startValue: number, endValue: number], plotDimensions: Dimensions, margin: Margin) => void
}

export interface OrdinalStringAxis extends BaseAxis {
    scale: ScaleBand<string>
    generator: Axis<string>
    categorySize: number
    update: (range: [startValue: number, endValue: number], plotDimensions: Dimensions, margin: Margin) => number
}

export enum AxisLocation {
    Left,
    Right,
    Bottom,
    Top
}

/*
        category axes
 */

/**
 * Adds a category axis to the specified location. When the location is top or bottom,
 * the category axis represents the x-axis. When the location is left or right, then the
 * category axis represents the y-axis.
 * @param chartId The unique ID of the chart to which this axis belongs
 * @param axisId A unique ID for the axis
 * @param svg The SVG selection (d3)
 * @param location The location of the axis
 * @param categories An array holding the category names
 * @param axisLabel The axis label
 * @param axesLabelFont The font for the axis label
 * @param axisTickStyle Styling information for the ticks (e.g. font, rotation, etc)
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margin
 * @return A category axis
 */
export function addOrdinalStringAxis(
    chartId: number,
    axisId: string,
    svg: SvgSelection,
    location: AxisLocation,
    categories: Array<string>,
    axisLabel: string,
    axesLabelFont: AxesFont,
    axisTickStyle: AxisTickStyle,
    plotDimensions: Dimensions,
    margin: Margin,
    setAxisRangeFor: (axisId: string, range: [start: number, end: number]) => void,
): OrdinalStringAxis {
    switch (location) {
        case AxisLocation.Top:
        case AxisLocation.Bottom:
            return addOrdinalStringXAxis(chartId, axisId, svg, location, categories, axisLabel, axesLabelFont, axisTickStyle, plotDimensions, margin, setAxisRangeFor)
        case AxisLocation.Left:
        case AxisLocation.Right:
            return addOrdinalStringYAxis(chartId, axisId, svg, location, categories, axisLabel, axesLabelFont, axisTickStyle, plotDimensions, margin, setAxisRangeFor)

    }
}

/**
 * Adds a category axis representing the x-axis.
 * @param chartId The unique ID of the chart to which this axis belongs
 * @param axisId A unique ID for the axis
 * @param svg The SVG selection (d3)
 * @param location The location of the axis
 * @param categories An array holding the category names
 * @param axisLabel The axis label
 * @param axesLabelFont The font for the axis label
 * @param axisTickStyle Styling information for the ticks (e.g. font, rotation, etc)
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margin
 * @return A category axis
 */
function addOrdinalStringXAxis(
    chartId: number,
    axisId: string,
    svg: SvgSelection,
    location: AxisLocation.Bottom | AxisLocation.Top,
    categories: Array<string>,
    axisLabel: string,
    axesLabelFont: AxesFont,
    axisTickStyle: AxisTickStyle,
    plotDimensions: Dimensions,
    margin: Margin,
    setAxisRangeFor: (axisId: string, range: [start: number, end: number]) => void,
): OrdinalStringAxis {
    const categorySize = ordinalSizeFor(location, plotDimensions, margin, categories.length)
    const scale = d3.scaleBand()
        .domain(categories)
        .range([0, categorySize * categories.length]);

    // create and add the axes
    const generator = location === AxisLocation.Bottom ? d3.axisBottom(scale) : d3.axisTop(scale)

    const selection = svg
        .append<SVGGElement>('g')
        .attr('id', `x-axis-selection-${chartId}`)
        .classed('x-axis', true)
        .attr('transform', `translate(${margin.left}, ${yTranslation(location, plotDimensions, margin)})`)
        .call(generator);

    // rotate the tick-labels by the specified amount (in degrees)
    let maxTickLabelHeight = 0
    const {font, rotation} = axisTickStyle
    selection
        .selectAll("text")
        .style("text-anchor", "end")
        .each(function()  {
            const degrees = location === AxisLocation.Bottom ? -rotation : rotation
            const radians = degrees * Math.PI / 180
            const {width, height, x, y} = (this as SVGTextElement).getBBox()
            const xOrigin = x + width
            const yOrigin = location === AxisLocation.Bottom ? y + height / 2: y + height / 2

            d3.select(this)
                .attr("transform", () => `translate(${width * Math.cos(radians) / 2}, 0) rotate(${degrees}, ${xOrigin}, ${yOrigin})`)

            const newHeight = Math.abs(width * Math.sin(radians))
            if (newHeight > maxTickLabelHeight) {
                maxTickLabelHeight = newHeight
            }
        })

    svg
        .append<SVGTextElement>('text')
        .attr('id', labelIdFor(chartId, location))
        .attr('text-anchor', 'middle')
        .attr('font-size', font.size)
        .attr('fill', font.color)
        .attr('font-family', font.family)
        .attr('font-weight', font.weight)
        .text(axisLabel)

    const axis = {axisId, selection, location, scale, generator, categorySize, update: () => categorySize}

    return {
        ...axis,
        update: (range, plotDimensions, dimensions) => {
            const categorySize = updateOrdinalStringXAxis(chartId, axis, svg, location, categories, range, categories.length, axesLabelFont, plotDimensions, margin, maxTickLabelHeight)
            setAxisRangeFor(axisId, range)
            return categorySize
        }
    }
}

/**
 * Adds a category axis representing the y-axis.
 * @param chartId The unique ID of the chart to which this axis belongs
 * @param axisId A unique ID for the axis
 * @param svg The SVG selection (d3)
 * @param location The location of the axis
 * @param categories An array holding the category names
 * @param axisLabel The axis label
 * @param axesLabelFont The font for the axis label
 * @param axisTickStyle Styling information for the ticks (e.g. font, rotation, etc)
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margin
 * @return A category axis
 */
function addOrdinalStringYAxis(
    chartId: number,
    axisId: string,
    svg: SvgSelection,
    location: AxisLocation.Left | AxisLocation.Right,
    categories: Array<string>,
    axisLabel: string,
    axesLabelFont: AxesFont,
    axisTickStyle: AxisTickStyle,
    plotDimensions: Dimensions,
    margin: Margin,
    setAxisRangeFor: (axisId: string, range: [start: number, end: number]) => void,
): OrdinalStringAxis {
    const categorySize = ordinalSizeFor(location, plotDimensions, margin, categories.length)
    const scale = d3.scaleBand()
        .domain(categories)
        .range([0, categorySize * categories.length]);

    // create and add the axes
    const generator = location === AxisLocation.Left ? d3.axisLeft(scale) : d3.axisRight(scale)

    const selection = svg
        .append<SVGGElement>('g')
        .attr('id', `y-axis-selection-${chartId}`)
        .attr('class', 'y-axis')
        .attr('transform', `translate(${xTranslation(location, plotDimensions, margin)}, ${margin.top})`)
        .call(generator);

    // rotate the tick-labels by the specified amount (in degrees)
    const {font, rotation} = axisTickStyle
    selection
        .selectAll("text")
        .style("text-anchor", "end")
        .each(function()  {
            const degrees = location === AxisLocation.Left ? -rotation : rotation
            const {width, height, x, y} = (this as SVGTextElement).getBBox()
            const xTranslation = location === AxisLocation.Left ? 0: width
            const xOrigin = x + width
            const yOrigin = location === AxisLocation.Left ? y + height / 2: y + height / 2

            d3.select(this)
                .attr("transform", () => `translate(${xTranslation}, 0) rotate(${degrees}, ${xOrigin}, ${yOrigin})`)
        })

    svg
        .append<SVGTextElement>('text')
        .attr('id', labelIdFor(chartId, location))
        .attr('text-anchor', 'middle')
        .attr('font-size', font.size)
        .attr('fill', font.color)
        .attr('font-family', font.family)
        .attr('font-weight', font.weight)
        .attr('transform', `translate(${ordinalLabelXTranslation(location, plotDimensions, margin, axesLabelFont)}, ${ordinalLabelYTranslation(location, plotDimensions, margin)}) rotate(-90)`)
        .text(axisLabel)

    const axis = {axisId, selection, location, scale, generator, categorySize, update: () => categorySize}

    return {
        ...axis,
        update: (range, plotDimensions, margin) => {
            const categorySize = updateOrdinalStringYAxis(chartId, axis, svg, location, categories, range, categories.length, axesLabelFont, plotDimensions, margin)
            setAxisRangeFor(axisId, range)
            return categorySize
        }
    }
}

/**
 * Updates the category axis representing the x-axis, calculates and returns the
 * number of pixels for each category on the x-axis.
 * @param chartId The unique ID of the chart to which this axis belongs
 * @param axis The category axis to be updated
 * @param svg The SVG selection (d3)
 * @param location The location of the axis
 * @param names An array holding the category names
 * @param axesLabelFont The font for the axis label
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margin
 * @param unfilteredSize The number of categories before any filtering has been applied
 * @param axesLabelFont The font for the axis label
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margin
 * @param tickHeight The maximum height of the tick labels (which can be rotated) used to
 * adjust the axis label location when needed
 * @return The number of pixels for each category
 */
function updateOrdinalStringXAxis(
    chartId: number,
    axis: OrdinalStringAxis,
    svg: SvgSelection,
    location: AxisLocation.Bottom | AxisLocation.Top,
    names: Array<string>,   // domain
    range: [start: number, end: number], // range
    unfilteredSize: number,
    axesLabelFont: AxesFont,
    plotDimensions: Dimensions,
    margin: Margin,
    tickHeight: number
): number {
    // const axisRange = axis.scale.range()
    // const alpha = measure(axisRange) / measure(range)
    const categorySize = ordinalSizeFor(location, plotDimensions, margin, unfilteredSize) // / alpha
    // const measureRangeEqualsCatName = measure(range) === categorySize * names.length
    // const updatedRange = measureRangeEqualsCatName ? range: [0, categorySize * names.length]
    // console.log('(before) bandwidth', axis.scale.bandwidth(), 'categorySize', categorySize)
    // axis.scale.range(range)
    // console.log('(after ) bandwidth', axis.scale.bandwidth(), 'categorySize', categorySize)
    // console.log(
    //     'categories', names.length,
    //     'domains', axis.scale.domain().length,
    //     'axisRange', axisRange,
    //     'cat * names', categorySize * names.length,
    //     'range', range,
    //     'updatedRange', updatedRange,
    //     '(' + measureRangeEqualsCatName ? 'range' : '[0, categorySize * names.length]',
    //     'categorySize', categorySize,
    //     'axis.bandwidth', axis.scale.bandwidth(),
    // )
    axis.scale
        // .domain(names)
        // todo uncomment this and zoom works, but not window resizing
        .range(range)
        // todo uncomment this and window resizing works, but not zoom
        // .range([0, categorySize * names.length])
        // .range([range[0], range[0] + categorySize * names.length])
        // .range([range[0], range[0] + categorySize * names.length])
        // .range(updatedRange)
        // .range([0, plotDimensions.width])
    axis.selection
        .attr('transform', `translate(${margin.left}, ${yTranslation(location, plotDimensions, margin)})`)
        .call(axis.generator)

    svg
        .select(`#${labelIdFor(chartId, location)}`)
        .attr('transform', `translate(${ordinalLabelXTranslation(location, plotDimensions, margin, axesLabelFont)}, ${ordinalLabelYTranslation(location, plotDimensions, margin, tickHeight, axesLabelFont.size)})`)

    return categorySize
}

function measure(range: [start: number, end: number]): number {
    return Math.abs(range[1] - range[0])
}

/**
 * Updates the category axis representing the y-axis, calculates and returns the
 * number of pixels for each category on the y-axis.
 * @param chartId The unique ID of the chart to which this axis belongs
 * @param axis The category axis to be updated
 * @param svg The SVG selection (d3)
 * @param location The location of the axis
 * @param names An array holding the category names
 * @param axesLabelFont The font for the axis label
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margin
 * @param unfilteredSize The number of categories before any filtering has been applied
 * @param axesLabelFont The font for the axis label
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margin
 * @return The number of pixels for each category
 */
function updateOrdinalStringYAxis(
    chartId: number,
    axis: OrdinalStringAxis,
    svg: SvgSelection,
    location: AxisLocation.Left | AxisLocation.Right,
    names: Array<string>,       // domain
    range: [startValue: number, endValue: number], // range
    unfilteredSize: number,
    axesLabelFont: AxesFont,
    plotDimensions: Dimensions,
    margin: Margin,
): number {
    const categorySize = ordinalSizeFor(location, plotDimensions, margin, unfilteredSize)
    const updatedRange = (measure(range) === categorySize * names.length) ? range: [0, categorySize * names.length]
    axis.scale
        .domain(names)
        // todo uncomment this and zoom works, but not window resizing
        // .range(range)
        // todo uncomment this and window resizing works, but not zoom
        // .range([0, categorySize * names.length])
        .range(updatedRange)
        // .range([0, plotDimensions.height - margin.bottom])
    axis.selection
        .attr('transform', `translate(${xTranslation(location, plotDimensions, margin)}, ${margin.top})`)
        .call(axis.generator)

    svg
        .select(`#${labelIdFor(chartId, location)}`)
        .attr('transform', `translate(${ordinalLabelXTranslation(location, plotDimensions, margin, axesLabelFont)}, ${ordinalLabelYTranslation(location, plotDimensions, margin)}) rotate(-90)`)

    return categorySize
}

/**
 * Calculates the number of pixels each category occupies on the axis
 * @param location The axis location (i.e. top, bottom, left, right)
 * @param dimensions The dimensions of the plot
 * @param margin The margins for the plot
 * @param numCategories The number of categories
 * @return the number of pixels each category occupies on the axis
 */
function ordinalSizeFor(location: AxisLocation, dimensions: Dimensions, margin: Margin, numCategories: number): number {
    switch (location) {
        case AxisLocation.Left:
        case AxisLocation.Right:
            return Math.max(margin.bottom, dimensions.height - margin.bottom) / numCategories
        case AxisLocation.Top:
        case AxisLocation.Bottom:
            return Math.max(margin.right, dimensions.width) / numCategories
    }
}

/**
 * Calculates the number of pixels by which to translate the label in the x-direction for the axis.
 * The calculation uses the dimensions and margins of the plot, the location of the
 * axis, and the font for the label.
 * @param location The axis location (i.e. top, bottom, left, right)
 * @param plotDimensions The dimensions of the plot
 * @param margin The margins for the plot
 * @param axesLabelFont The font for the axis label
 * @return The number of pixels to translate the label in the x-direction
 */
function ordinalLabelXTranslation(
    location: AxisLocation,
    plotDimensions: Dimensions,
    margin: Margin,
    axesLabelFont: AxesFont,
): number {
    switch (location) {
        case AxisLocation.Left:
        case AxisLocation.Right:
            return location === AxisLocation.Left ?
                axesLabelFont.size :
                margin.left + plotDimensions.width + margin.right - axesLabelFont.size
        case AxisLocation.Top:
        case AxisLocation.Bottom:
                return (plotDimensions.width + margin.left + margin.right) / 2
    }
}

/**
 * Calculates the number of pixels by which to translate the label in the y-direction the axis.
 * The calculation uses the dimensions and margins of the plot, the location of the
 * axis, and the font for the label.
 * @param location The axis location (i.e. top, bottom, left, right)
 * @param plotDimensions The dimensions of the plot
 * @param margin The margins for the plot
 * @param [tickLabelHeight=0] The height of the tick labels (which takes rotation into account)
 * @param [axisLabelHeight=0] The axis label height for adjusting the location of the label
 * @return The number of pixels to translate the label for the y-direction
 */
function ordinalLabelYTranslation(
    location: AxisLocation,
    plotDimensions: Dimensions,
    margin: Margin,
    tickLabelHeight: number = 0,
    axisLabelHeight: number = 0
): number {
    switch (location) {
        case AxisLocation.Left:
        case AxisLocation.Right:
            return (margin.top + margin.bottom + plotDimensions.height) / 2
        case AxisLocation.Top:
            return tickLabelHeight === 0 ? margin.top / 2 : Math.max(margin.top - tickLabelHeight - axisLabelHeight - 5, axisLabelHeight)
        case AxisLocation.Bottom:
            return margin.top + plotDimensions.height + (tickLabelHeight === 0 ? margin.bottom / 2 : tickLabelHeight - axisLabelHeight)
    }
}


/*
    continuous numeric axes
 */

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
    axesLabelFont: AxesFont,
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
        .attr('transform', `translate(${margin.left + plotDimensions.width / 2}, ${continuousLabelYTranslation(location, plotDimensions, margin)})`)
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
        .attr('transform', `translate(${margin.left + plotDimensions.width / 2}, ${continuousLabelYTranslation(location, plotDimensions, margin)})`)
        .text(label)
}

/**
 * The number of pixels to translate the x-axis label to the right
 * @param location The location of the x-axis
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margins for the border of main SVG group
 * @return The number of pixels to translate the x-axis label to the right
 */
function continuousLabelYTranslation(location: AxisLocation.Bottom | AxisLocation.Top, plotDimensions: Dimensions, margin: Margin): number {
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
    axesLabelFont: AxesFont,
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
        .attr('transform', `translate(${continuousLabelXTranslation(location, plotDimensions, margin, axesLabelFont)}, ${margin.top + plotDimensions.height / 2}) rotate(-90)`)
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
    axesLabelFont: AxesFont,
    location: AxisLocation.Left | AxisLocation.Right,
): void {
    axis.scale.domain(domain).range([Math.max(margin.bottom, plotDimensions.height - margin.bottom), 0])
    axis.selection
        .attr('transform', `translate(${xTranslation(location, plotDimensions, margin)}, ${margin.top})`)
        .call(axis.generator)

    svg
        .select(`#${labelIdFor(chartId, location)}`)
        .attr('transform', `translate(${continuousLabelXTranslation(location, plotDimensions, margin, axesLabelFont)}, ${margin.top + plotDimensions.height / 2}) rotate(-90)`)
        .text(label)
}

/**
 * The number of pixels to translate the y-axis label down
 * @param location The location of the y-axis
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margins for the border of main SVG group
 * @param axesLabelFont The font for the axis label
 * @return The number of pixels to translate the y-axis label down
 */
function continuousLabelXTranslation(location: AxisLocation.Left | AxisLocation.Right, plotDimensions: Dimensions, margin: Margin, axesLabelFont: AxesFont): number {
    return location === AxisLocation.Left ?
        axesLabelFont.size :
        margin.left + plotDimensions.width + margin.right - axesLabelFont.size
}

/*
    common axis functions
 */

/**
 * Calculates the number pixels by which to translate the x-axis.
 * @param location The axis location (i.e. top, bottom, left, right)
 * @param plotDimensions The dimensions of the plot
 * @param margin The margins for the plot
 * @return The number of pixels to translate the x-axis
 */
function xTranslation(location: AxisLocation.Left | AxisLocation.Right, plotDimensions: Dimensions, margin: Margin): number {
    return location === AxisLocation.Left ? margin.left : margin.left + plotDimensions.width
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
 * Calculates a unique ID for the axis based on the location and chart ID
 * @param chartId The unique ID of the chart
 * @param location The axis location (i.e. top, bottom, left, right)
 * @return A unique ID for the axis
 */
export function labelIdFor(chartId: number, location: AxisLocation): string {
    switch (location) {
        case AxisLocation.Left:
        case AxisLocation.Right:
            return `stream-chart-y-axis-${location}-label-${chartId}`
        case AxisLocation.Top:
        case AxisLocation.Bottom:
            return `stream-chart-x-axis-${location}-label-${chartId}`
    }
}


/*
    zooming
 */

/**
 * The result of a zoom action
 */
export interface ZoomResult<AR extends BaseAxisRange> {
    range: AR
    // range: ContinuousAxisRange
    zoomFactor: number
}

/**
 * todo this can be generalized to any continuous numeric axis, replace x with value
 * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
 * at the location of the mouse when the scroll wheel or gesture was applied.
 * @param transform The d3 zoom transformation information
 * @param x The x-position of the mouse when the scroll wheel or gesture is used
 * @param axis The axis being zoomed
 * @param range The current range for the axis being zoomed
 * @return The updated range and the new zoom factor
 */
export function calculateZoomFor<AR extends BaseAxisRange>(
    transform: ZoomTransform,
    x: number,
    axis: ContinuousNumericAxis,
    range: ContinuousAxisRange,
): ZoomResult<AR> {
    const time = axis.generator.scale<ScaleLinear<number, number>>().invert(x);
    return {
        range: range.scale(transform.k, time),
        zoomFactor: transform.k
    } as ZoomResult<AR>
}

/**
 * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
 * at the location of the mouse when the scroll wheel or gesture was applied, while ensure that
 * the range (start, end) is contained within the constraint (min, max).
 * @param transform The d3 zoom transformation information
 * @param x The x-position of the mouse when the scroll wheel or gesture is used
 * @param axis The axis being zoomed
 * @param range The current range for the axis being zoomed
 * @param constraint The minimum and maximum value the scaled range can have
 * @return The updated range and the new zoom factor
 */
export function calculateConstrainedZoomFor(
    transform: ZoomTransform,
    x: number,
    axis: ContinuousNumericAxis,
    range: ContinuousAxisRange,
    constraint: [min: number, max: number],
): ZoomResult<ContinuousAxisRange> {
    const domainValue = axis.generator.scale<ScaleLinear<number, number>>().invert(x);
    return {
        range: range.constrainedScale(transform.k, domainValue, constraint),
        zoomFactor: transform.k
    } as ZoomResult<ContinuousAxisRange>
}

// todo this is not correct
export function calculateOrdinalConstrainedZoomFor(
    transform: ZoomTransform,
    x: number,
    axis: OrdinalStringAxis,
    range: OrdinalAxisRange,
    constraint: [min: number, max: number],
): ZoomResult<OrdinalAxisRange> {
    // const scale = axis.generator.scale<ScaleBand<string>>()
    // const [start, end] = axis.scale.range()
    // const index = x / axis.scale.bandwidth()
    // const domainValue = (index * axis.scale.bandwidth()) / (end - start)

    // const categoryIndex = Math.floor((x / scale.bandwidth()) | 0)
    return {
        range: range.constrainedScale(transform.k, x, constraint),
        zoomFactor: transform.k
    } as ZoomResult<OrdinalAxisRange>
}

/*
    panning
 */

/**
 * Adjusts the range and updates the plot when the plot is dragged to the left or right
 * @param delta The amount that the plot is dragged
 * @param axis The axis being zoomed
 * @param range The current range for the axis being zoomed
 * @param [constrainToOriginalRange=false] When set to `true` then the pan requires that the axis
 * range remains a subset of the origin axis range; when `false` the pan allows and range
 * @return The updated range
 */
export function calculatePanFor(
    delta: number,
    axis: ContinuousNumericAxis,
    range: ContinuousAxisRange,
    constrainToOriginalRange: boolean = false
): ContinuousAxisRange {
    const scale = axis.generator.scale<ScaleLinear<number, number>>()
    const [currentValue] = range.current
    const value = scale(currentValue)
    if (value !== undefined) {
        const deltaValue = scale.invert(value + delta) - currentValue
        const constraint: [start: number, end: number] = constrainToOriginalRange ?
            range.original :
            [-Infinity, Infinity]
        return range.translate(-deltaValue, constraint)
    }
    return range
}

export function calculateOrdinalPanFor(
    delta: number,
    axis: OrdinalStringAxis,
    range: OrdinalAxisRange,
    constrainToOriginalRange: boolean = false
): OrdinalAxisRange {
    const constraint: [start: number, end: number] = constrainToOriginalRange ?
        range.original :
        [-Infinity, Infinity]
    return range.translate(delta, constraint)
}

/*

 */

/**
 * Accepts the series, the assignment of the series to axes, and the current x-axes state, and
 * returns an array of the distinct axis IDs that cover all the series in the plot.
 *
 * @param series The array of series
 * @param axisAssignments A map association a series name with its axis assignments
 * @param axesState The current axis state
 * @return an array of the distinct axes that cover all the series in the plot
 */
export function axesForSeriesGen<D>(
    series: Array<BaseSeries<D>>,
    axisAssignments: Map<string, AxesAssignment>,
    axesState: AxesState
): Array<string> {
    return series.map(srs => srs.name)
        // grab the x-axis assigned to the series, or use the default x-axis if not
        // assignment has been made
        .map(name => axisAssignments.get(name)?.xAxis || axesState.axisDefaultId())
        // de-dup the array of axis IDs so that we don't end up applying the pan or zoom
        // transformation more than once
        .reduce((accum: Array<string>, axisId: string) => {
            if (!accum.find(id => id === axisId)) {
                accum.push(axisId)
            }
            return accum
        }, [])
}

/**
 *
 * @param delta The pan amount in the axis specified for the series
 * @param axesForSeries The names of the axes of a dimension (x or y)
 * @param axesState The state for the axes of a dimension
 * @param ranges The current ranges for the axes of a dimension
 * @param setAxisRange Function for setting the new time-range for a specific axis
 * @param plotDimensions The current plot dimensions (width, height)
 * @param margin The plot margin
 * @param [constrainToOriginalRange=true] Optional argument, that when set to `true`, constrains the
 * axis range to remain in the origin axis range; when `false` the axis range is unconstrained
 */
function panAxes(
    delta: number,
    axesForSeries: Array<string>,
    axesState: AxesState,
    ranges: Map<string, ContinuousAxisRange>,
    setAxisRange: (axisId: string, axisRange: [start: number, end: number]) => void,
    plotDimensions: Dimensions,
    margin: Margin,
    constrainToOriginalRange: boolean = true
): void {
    axesForSeries
        .forEach(axisId => {
            const axis = axesState.axisFor(axisId) as ContinuousNumericAxis
            const currentRange = ranges.get(axisId)
            if (currentRange) {
                // calculate the change in the axis-range based on the pixel change from the drag event
                const range = calculatePanFor(delta, axis, currentRange, constrainToOriginalRange)

                // update the time-range for the axis
                ranges.set(axisId, range)

                const [start, end] = range.current
                setAxisRange(axisId, [start, end])

                // update the axis' time-range
                axis.update([start, end], plotDimensions, margin)
            }
        })
}

function ordinalPanAxes(
    delta: number,
    axesForSeries: Array<string>,
    axesState: AxesState,
    ranges: Map<string, OrdinalAxisRange>,
    setAxisRange: (axisId: string, axisRange: [start: number, end: number]) => void,
    plotDimensions: Dimensions,
    margin: Margin,
    constrainToOriginalRange: boolean = true
): void {
    axesForSeries
        .forEach(axisId => {
            const axis = axesState.axisFor(axisId) as OrdinalStringAxis
            const currentRange = ranges.get(axisId)
            if (currentRange) {
                // calculate the change in the axis-range based on the pixel change from the drag event
                const range = calculateOrdinalPanFor(delta, axis, currentRange, constrainToOriginalRange)

                // update the time-range for the axis
                ranges.set(axisId, range)

                const [start, end] = range.current
                setAxisRange(axisId, [start, end])

                // update the axis' time-range
                axis.update([start, end], plotDimensions, margin)
            }
        })
}

/**
 * Higher-order function that generates a handler for pan events, given the distinct series IDs that cover all
 * the axes in the chart, the margin, axis-range update function, and the current state of the x-axes. This
 * function returns a handler function. And this handler function adjusts the time-range when the plot is dragged
 * to the left or right. After calling the handler function, the plot needs to be updated as well, and this is
 * left for the caller.
 *
 * Please note that the function generated by this function has side effects -- it updates the axes ranges.
 *
 * @param axesForSeries The distinct axes that cover all the series
 * @param margin The plot margin
 * @param setAxisRangeFor Function for setting the new axis-range for a specific axis
 * @param axesState The current state of the x-axes or y-axes
 * @param [constrainToOriginalRange=false] Optional argument, that when set to `true`, constrains the
 * axis range to remain in the origin axis range; when `false` the axis range is unconstrained * @return A handler function for pan events
 */
export function panHandler(
    axesForSeries: Array<string>,
    margin: Margin,
    setAxisRangeFor: (axisId: string, axisRange: [start: number, end: number]) => void,
    axesState: AxesState,
    constrainToOriginalRange: boolean = false
): (
    x: number,
    plotDimensions: Dimensions,
    series: Array<string>,
    ranges: Map<string, ContinuousAxisRange>,
) => void {
    /**
     * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
     * @param deltaX The amount that the plot is dragged
     * @param plotDimensions The dimensions of the plot
     * @param series An array of series names
     * @param ranges A map holding the axis ID and its associated time range
     */
    return (delta: number, plotDimensions: Dimensions, series: Array<string>, ranges: Map<string, ContinuousAxisRange>) => {
        // run through the axis IDs, adjust their domain, and update the time-range set for that axis
        panAxes(delta, axesForSeries, axesState, ranges, setAxisRangeFor, plotDimensions, margin, constrainToOriginalRange)
        // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
    }
}

export function ordinalPanHandler(
    axesForSeries: Array<string>,
    margin: Margin,
    setAxisRangeFor: (axisId: string, axisRange: [start: number, end: number]) => void,
    axesState: AxesState,
    constrainToOriginalRange: boolean = false
): (
    x: number,
    plotDimensions: Dimensions,
    series: Array<string>,
    ranges: Map<string, OrdinalAxisRange>,
) => void {
    /**
     * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
     * @param deltaX The amount that the plot is dragged
     * @param plotDimensions The dimensions of the plot
     * @param series An array of series names
     * @param ranges A map holding the axis ID and its associated time range
     */
    return (delta: number, plotDimensions: Dimensions, series: Array<string>, ranges: Map<string, OrdinalAxisRange>) => {
        // run through the axis IDs, adjust their domain, and update the time-range set for that axis
        ordinalPanAxes(delta, axesForSeries, axesState, ranges, setAxisRangeFor, plotDimensions, margin, constrainToOriginalRange)
        // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
    }
}

/**
 * Higher-order function that generates a handler for pan events, given the distinct series IDs that cover all
 * the axes in the chart, the margin, time-range update function, and the current state of the x-axes. This
 * function returns a handler function. And this handler function adjusts the time-range when the plot is dragged
 * to the left or right. After calling the handler function, the plot needs to be updated as well, and this is
 * left for the caller.
 *
 * Please note that the function generated by this function has side effects -- it updates the axes ranges.
 *
 * @param xAxesForSeries The distinct x-axes that cover all the series
 * @param yAxesForSeries The distinct y-axes that cover all the series
 * @param margin The plot margin
 * @param setAxisRange Function for setting the new time-range for a specific axis
 * @param xAxesState The current state of the x-axes
 * @param yAxesState The current state of the y-axes
 * @param [constrainToOriginalRange=true] Optional argument, that when set to `true`, constrains the
 * axis range to remain in the origin axis range; when `false` the axis range is unconstrained
 * @return A handler function for pan events
 */
export function panHandler2D(
    xAxesForSeries: Array<string>,
    yAxesForSeries: Array<string>,
    margin: Margin,
    setAxisRange: (axisId: string, axisRange: [start: number, end: number]) => void,
    xAxesState: AxesState,
    yAxesState: AxesState,
    constrainToOriginalRange: boolean = true
): (
    x: number,
    y: number,
    plotDimensions: Dimensions,
    series: Array<string>,
    xRanges: Map<string, ContinuousAxisRange>,
    yRanges: Map<string, ContinuousAxisRange>,
) => void {
    /**
     * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
     * @param deltaX The amount that the plot is dragged
     * @param plotDimensions The dimensions of the plot
     * @param series An array of series names
     * @param ranges A map holding the axis ID and its associated time range
     */
    return (deltaX, deltaY, plotDimensions, series, xRanges, yRanges) => {
        // run through the x- and y-axes and update them by delta, within the original bounds
        panAxes(deltaX, xAxesForSeries, xAxesState, xRanges, setAxisRange, plotDimensions, margin, constrainToOriginalRange)
        panAxes(deltaY, yAxesForSeries, yAxesState, yRanges, setAxisRange, plotDimensions, margin, constrainToOriginalRange)
        // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
    }
}

/**
 * Calculates the zoom for the specified axis and updates the axis and the axis ranges
 * @param value The x- or y-coordinate of the mouse
 * @param axisId
 * @param margin The plot margin
 * @param setRangeFor Function for setting the new time-range for a specific axis * @param scaleExtent The smallest and largest scale factors allowed
 * @param axesState
 * @param ranges A map associating axis IDs with axis ranges
 * @param scaleExtent The smallest and largest scale factors allowed
 * @param transform The d3 zoom transformation information
 * @param plotDimensions The dimensions of the plot
 */
function calcZoomAndUpdate(
    value: number,
    axisId: string,
    margin: Margin,
    setRangeFor: (axisId: string, range: [start: number, end: number]) => void,
    axesState: AxesState,
    ranges: Map<string, ContinuousAxisRange>,
    scaleExtent: [min: number, max: number],
    transform: ZoomTransform,
    plotDimensions: Dimensions,
): void {
    const [, zoomMax] = scaleExtent

    const range = ranges.get(axisId)
    if (range) {
        const axis = axesState.axisFor(axisId) as ContinuousNumericAxis

        // calculate the constraint for the zoom
        const [originalStart, originalEnd] = range.original
        const constraint: [number, number] = isFinite(zoomMax) ?
            [originalStart * zoomMax, originalEnd * zoomMax] :
            [0, Infinity]

        const zoom = calculateConstrainedZoomFor(transform, value, axis, range, constraint)

        // update the axis range
        ranges.set(axisId, zoom.range)

        setRangeFor(axisId, zoom.range.current)

        // update the axis' range
        axis.update(zoom.range.current, plotDimensions, margin)
    }
}

function calcOrdinalZoomAndUpdate(
    value: number,
    axisId: string,
    margin: Margin,
    setRangeFor: (axisId: string, range: [start: number, end: number]) => void,
    axesState: AxesState,
    ranges: Map<string, OrdinalAxisRange>,
    scaleExtent: [min: number, max: number],
    transform: ZoomTransform,
    plotDimensions: Dimensions,
): void {
    const [, zoomMax] = scaleExtent

    const range = ranges.get(axisId)
    if (range) {
        const axis = axesState.axisFor(axisId) as OrdinalStringAxis

        // const scale = axis.generator.scale<ScaleBand<string>>()

        // calculate the constraint for the zoom
        // const [originalStart, originalEnd] = scale.range()
        // const constraint: [number, number] = isFinite(zoomMax) ?
        //     [originalStart * zoomMax, originalEnd * zoomMax] :
        //     [0, Infinity]
        const [originalStart, originalEnd] = range.original
        const constraint: [number, number] = isFinite(zoomMax) ?
            [originalStart * zoomMax, originalEnd * zoomMax] :
            [-Infinity, Infinity]

        const zoom = calculateOrdinalConstrainedZoomFor(transform, value, axis, range, constraint)

        // update the axis range
        ranges.set(axisId, zoom.range)

        setRangeFor(axisId, zoom.range.current)

        // update the axis' range
        // axis.update(scale.range() as [start: number, end: number], plotDimensions, margin)
        axis.update(zoom.range.current, plotDimensions, margin)
        // const categories = scale.domain()
        // axis.update(categories, categories.length, plotDimensions, margin)
    }
}

/**
 * Higher-order function that generates a handler for zoom events, given the distinct series IDs that cover all
 * the axes in the chart, the margin, range update function, and the current state of the x- or y-axes. This
 * function returns a handler function. And this handler function adjusts the range when the plot is zoomed.
 * After calling the handler function, the plot needs to be updated as well, and this is left for the caller.
 *
 * Please note that the function generated by this function has side effects -- it updates the axes ranges.
 *
 * @param axesForSeries The distinct axes that cover all the series
 * @param margin The plot margin
 * @param setRangeFor Function for setting the new time-range for a specific axis
 * @param axesState The current state of the x- or y-axes
 * @param scaleExtent The minimum and maximum allowed scale factors
 * @return A handler function for pan events
 */
export function axisZoomHandler(
    axesForSeries: Array<string>,
    margin: Margin,
    setRangeFor: (axisId: string, range: [start: number, end: number]) => void,
    axesState: AxesState,
    scaleExtent: [min: number, max: number] = [0, Infinity],
): (
    transform: ZoomTransform,
    x: number,
    plotDimensions: Dimensions,
    ranges: Map<string, ContinuousAxisRange>,
) => void {

    /**
     * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
     * at the location of the mouse when the scroll wheel or gesture was applied.
     * @param transform The d3 zoom transformation information
     * @param x The x-position of the mouse when the scroll wheel or gesture is used
     * @param plotDimensions The dimensions of the plot
     * @param ranges A map holding the axis ID and its associated time-range
     */
    return (transform, x, plotDimensions, ranges) => {
        // run through the axis IDs, adjust their domain, and update the time-range set for that axis
        axesForSeries.forEach(axisId =>
            calcZoomAndUpdate(x, axisId, margin, setRangeFor, axesState, ranges, scaleExtent, transform, plotDimensions)
        )
        // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
    }
}

export function ordinalAxisZoomHandler(
    axesForSeries: Array<string>,
    margin: Margin,
    setRangeFor: (axisId: string, range: [start: number, end: number]) => void,
    axesState: AxesState,
    scaleExtent: [min: number, max: number] = [0, Infinity],
): (
    transform: ZoomTransform,
    x: number,
    plotDimensions: Dimensions,
    ranges: Map<string, OrdinalAxisRange>,
) => void {

    /**
     * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
     * at the location of the mouse when the scroll wheel or gesture was applied.
     * @param transform The d3 zoom transformation information
     * @param x The x-position of the mouse when the scroll wheel or gesture is used
     * @param plotDimensions The dimensions of the plot
     * @param ranges A map holding the axis ID and its associated time-range
     */
    return (transform, x, plotDimensions, ranges) => {
        // run through the axis IDs, adjust their domain, and update the time-range set for that axis
        axesForSeries.forEach(axisId =>
            calcOrdinalZoomAndUpdate(x, axisId, margin, setRangeFor, axesState, ranges, scaleExtent, transform, plotDimensions)
        )
        // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
    }
}

// export function ordinalAxisZoomHandler(
//     axesForSeries: Array<string>,
//     margin: Margin,
//     setRangeFor: (axisId: string, range: [start: number, end: number]) => void,
//     axesState: AxesState,
//     scaleExtent: [min: number, max: number] = [0, Infinity],
// ): (
//     transform: ZoomTransform,
//     x: number,
//     plotDimensions: Dimensions,
//     ranges: Map<string, OrdinalAxisRange>,
// ) => void {
//
//     /**
//      * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
//      * at the location of the mouse when the scroll wheel or gesture was applied.
//      * @param transform The d3 zoom transformation information
//      * @param x The x-position of the mouse when the scroll wheel or gesture is used
//      * @param plotDimensions The dimensions of the plot
//      * @param ranges A map holding the axis ID and its associated time-range
//      */
//     return (transform, x, plotDimensions, ranges) => {
//         // run through the axis IDs, adjust their domain, and update the time-range set for that axis
//         axesForSeries.forEach(axisId =>
//             calcZoomAndUpdate(x, axisId, margin, setRangeFor, axesState, ranges, scaleExtent, transform, plotDimensions)
//         )
//         // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
//     }
// }

/**
 * Higher-order function that generates a handler for zoom events, given the distinct series IDs that cover all
 * the axes in the chart, the margin, range update function, and the current state of the x- or y-axes. This
 * function returns a handler function. And this handler function adjusts the time-range when the plot is zoomed.
 * After calling the handler function, the plot needs to be updated as well, and this is left for the caller.
 *
 * Please note that the function generated by this function has side effects -- it updates the axes ranges.
 *
 * @param xAxesForSeries The distinct x-axes that cover all the series
 * @param yAxesForSeries The distinct y-axes that cover all the series
 * @param margin The plot margin
 * @param setRangeFor Function for setting the new time-range for a specific axis
 * @param xAxesState The current state of the x-axes
 * @param yAxesState The current state of the y-axes
 * @param scaleExtent The smallest and largest scale factors allowed
 * @return A handler function for pan events
 */
export function axesZoomHandler(
    xAxesForSeries: Array<string>,
    yAxesForSeries: Array<string>,
    margin: Margin,
    setRangeFor: (axisId: string, range: [start: number, end: number]) => void,
    xAxesState: AxesState,
    yAxesState: AxesState,
    scaleExtent: [min: number, max: number],
): (
    transform: ZoomTransform,
    mousePosition: [x: number, y: number],
    plotDimensions: Dimensions,
    xRanges: Map<string, ContinuousAxisRange>,
    yRanges: Map<string, ContinuousAxisRange>,
) => void {

    /**
     * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
     * at the location of the mouse when the scroll wheel or gesture was applied.
     * @param transform The d3 zoom transformation information
     * @param mousePosistion The position of the mouse when the scroll wheel or gesture is used
     * @param plotDimensions The dimensions of the plot
     * @param ranges A map holding the axis ID and its associated time-range
     */
    return (transform, mousePosition, plotDimensions, xRanges, yRanges) => {
        // run through the axis IDs, adjust their domain, and update the time-range set for that axis
        const [x, y] = mousePosition
        xAxesForSeries.forEach(id =>
            calcZoomAndUpdate(x, id, margin, setRangeFor, xAxesState, xRanges, scaleExtent, transform, plotDimensions)
        )
        yAxesForSeries.forEach(id =>
            calcZoomAndUpdate(y, id, margin, setRangeFor, yAxesState, yRanges, scaleExtent, transform, plotDimensions)
        )
        // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
    }
}

/**
 * Calculates the axis-ranges for each of the continuous numeric axes in the map
 * @param axes The map containing the axes and their associated IDs
 * @return a map associating the axis IDs to their continuous axis-range
 */
export function continuousAxisRanges(axes: Map<string, ContinuousNumericAxis>): Map<string, ContinuousAxisRange> {
    return continuousRange(axes)
}

export function ordinalAxisRanges(axes: Map<string, OrdinalStringAxis>): Map<string, OrdinalAxisRange> {
    return ordinalRange(axes)
}

/**
 * Calculates the axis interval (start, end) for each of the axis
 * @param axes The axes representing the time
 * @return A map associating each axis with a (start, end) interval
 */
export function continuousAxisIntervals(axes: Map<string, ContinuousNumericAxis>): Map<string, [start: number, end: number]> {
    return new Map(Array.from(axes.entries())
        .map(([id, axis]) => [id, axis.scale.domain()] as [string, [number, number]]))
}

export function ordinalAxisIntervals(axes: Map<string, OrdinalStringAxis>): Map<string, [interval: [start: number, end: number], categories: Array<string>]> {
    return new Map(Array.from(axes.entries())
        .map(([id, axis]) => [id, [axis.scale.range(), axis.scale.domain()]] as [string, [[number, number], Array<string>]]))
}

/**
 * Returns the bounds on the specified continuous numeric axes
 * @param axes A map associating an axis ID with a {@link ContinuousNumericAxis}
 * @return A map associating each specified axis ID with the interval covered (bounds) by the axis
 */
export function continuousRange(axes: Map<string, ContinuousNumericAxis>): Map<string, ContinuousAxisRange> {
    return new Map(Array.from(axes.entries())
        .map(([id, axis]) => {
            const [start, end] = axis.scale.domain()
            return [id, continuousAxisRangeFor(start, end)]
        }))
}

export function ordinalRange(axes: Map<string, OrdinalStringAxis>): Map<string, OrdinalAxisRange> {
    return new Map(Array.from(axes.entries())
        .map(([id, axis]) => {
            const [start, end] = axis.scale.range()
            // const categories = axis.scale.domain()
            return [id, ordinalAxisRangeFor(start, end)]
        }))
}

// export function continuousRangeForDefaultAxis(axis: ContinuousNumericAxis): ContinuousAxisRange {
//     const [start, end] = axis.scale.domain()
//     return continuousAxisRangeFor(start, end)
// }