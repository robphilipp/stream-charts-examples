import * as axes from "./axes"
import {addCategoryAxis, AxesLabelFont, AxisLocation, defaultAxesLabelFont, labelIdFor} from "./axes"
import * as d3 from "d3";
import {ScaleBand} from "d3";
import {useChart} from "../hooks/useChart";
import {useEffect, useRef} from "react";
import {Margin} from "../styling/margins";
import {usePlotDimensions} from "../hooks/usePlotDimensions";

interface Props {
    // the unique ID of the axis
    axisId: string
    // the location of the axis. for y-axes, this mut be either left or right,
    // for x-axis, must be either top or bottom.
    location: AxisLocation
    // category axes
    scale?: ScaleBand<string>
    // the min and max values for the axis
    categories: Array<string>
    // the font for drawing the axis ticks and labels
    font?: Partial<AxesLabelFont>
    // the axis label
    label: string
}

/**
 * Category axis that represents the x-axis when its location is either on the bottom or the top.
 * When the axis location is left or right, then the category axis represents the y-axis. The category
 * axis requires a set of categories that will form the axis. Generally, these categories should
 * be the name of the series used to represent each category.
 * @param props The properties for the component
 * @return null
 * @constructor
 */
export function OrdinalAxis(props: Props): null {
    const {
        chartId,
        container,
        axes,
        color,
    } = useChart()

    const {addXAxis, addYAxis} = axes

    const {
        plotDimensions,
        margin
    } = usePlotDimensions()

    const {
        axisId,
        location,
        categories,
        label,
    } = props

    const axisRef = useRef<axes.CategoryAxis>()

    const axisIdRef = useRef<string>(axisId)
    const marginRef = useRef<Margin>(margin)
    useEffect(
        () => {
            axisIdRef.current = axisId
            marginRef.current = margin
        },
        [axisId, margin]
    )

    useEffect(
        () => {
            if (container) {
                const svg = d3.select<SVGSVGElement, any>(container)
                const font: AxesLabelFont = {...defaultAxesLabelFont, color, ...props.font}

                if (axisRef.current === undefined) {
                    axisRef.current = addCategoryAxis(chartId, axisId, svg, location, categories, label, font, plotDimensions, margin)

                    // add the x-axis or y-axis to the chart context depending on its
                    // location
                    switch (location) {
                        case AxisLocation.Left:
                        case AxisLocation.Right:
                            addYAxis(axisRef.current, axisId)
                            break
                        case AxisLocation.Top:
                        case AxisLocation.Bottom:
                            addXAxis(axisRef.current, axisId)
                    }
                } else {
                    // update the category size in case the plot dimensions changed
                    axisRef.current.categorySize = axisRef.current.update(categories, categories.length, plotDimensions, margin)
                    svg.select(`#${labelIdFor(chartId, location)}`).attr('fill', color)
                }
            }
        },
        [addXAxis, addYAxis, axisId, categories, chartId, color, container, label, location, margin, plotDimensions, props.font]
    )

    return null
}

// function labelIdFor(chartId: number, location: AxisLocation): string {
//     switch (location) {
//         case AxisLocation.Left:
//         case AxisLocation.Right:
//             return `stream-chart-y-axis-${location}-label-${chartId}`
//         case AxisLocation.Top:
//         case AxisLocation.Bottom:
//             return `stream-chart-x-axis-${location}-label-${chartId}`
//     }
// }

// function categorySizeFor(dimensions: Dimensions, margin: Margin, numCategories: number): number {
//     return Math.max(margin.bottom, dimensions.height - margin.bottom) / numCategories
// }

// function addCategoryAxis(
//     chartId: number,
//     axisId: string,
//     svg: SvgSelection,
//     plotDimensions: Dimensions,
//     categories: Array<string>,
//     axesLabelFont: AxesLabelFont,
//     margin: Margin,
//     axisLabel: string,
//     location: AxisLocation
// ): axes.CategoryAxis {
//     switch (location) {
//         case AxisLocation.Left:
//         case AxisLocation.Right:
//             return addCategoryYAxis(chartId, axisId, svg, plotDimensions, categories, axesLabelFont, margin, axisLabel, location)
//         case AxisLocation.Top:
//         case AxisLocation.Bottom:
//             return addCategoryXAxis(chartId, axisId, svg, plotDimensions, categories, axesLabelFont, margin, axisLabel, location)
//
//     }
// }

// function addCategoryYAxis(
//     chartId: number,
//     axisId: string,
//     svg: SvgSelection,
//     plotDimensions: Dimensions,
//     categories: Array<string>,
//     axesLabelFont: AxesLabelFont,
//     margin: Margin,
//     axisLabel: string,
//     location: AxisLocation.Left | AxisLocation.Right,
// ): axes.CategoryAxis {
//     const categorySize = categorySizeFor(plotDimensions, margin, categories.length)
//     const scale = d3.scaleBand()
//         .domain(categories)
//         .range([0, categorySize * categories.length]);
//
//     // create and add the axes
//     const generator = location === AxisLocation.Left ? d3.axisLeft(scale) : d3.axisRight(scale)
//
//     const selection = svg
//         .append<SVGGElement>('g')
//         .attr('id', `y-axis-selection-${chartId}`)
//         .attr('class', 'y-axis')
//         .attr('transform', `translate(${xTranslation(location, plotDimensions, margin)}, ${margin.top})`)
//         .call(generator);
//
//     svg
//         .append<SVGTextElement>('text')
//         .attr('id', labelIdFor(chartId, location))
//         .attr('text-anchor', 'middle')
//         .attr('font-size', axesLabelFont.size)
//         .attr('fill', axesLabelFont.color)
//         .attr('font-family', axesLabelFont.family)
//         .attr('font-weight', axesLabelFont.weight)
//         .attr('transform', `translate(${labelXTranslation(location, plotDimensions, margin, axesLabelFont)}, ${labelYTranslation(plotDimensions, margin)}) rotate(-90)`)
//         .text(axisLabel)
//
//     const axis = {axisId, selection, location, scale, generator, categorySize, update: () => categorySize}
//
//     return {
//         ...axis,
//         update: (categoryNames, unfilteredSize, dimensions) =>
//             updateCategoryYAxis(chartId, svg, axis, dimensions, unfilteredSize, categoryNames, axesLabelFont, margin, location)
//     }
// }

// function updateCategoryYAxis(
//     chartId: number,
//     svg: SvgSelection,
//     axis: axes.CategoryAxis,
//     plotDimensions: Dimensions,
//     unfilteredSize: number,
//     names: Array<string>,
//     axesLabelFont: AxesLabelFont,
//     margin: Margin,
//     location: AxisLocation.Left | AxisLocation.Right,
// ): number {
//     const categorySize = categorySizeFor(plotDimensions, margin, unfilteredSize)
//     axis.scale
//         .domain(names)
//         .range([0, categorySize * names.length])
//     axis.selection
//         .attr('transform', `translate(${xTranslation(location, plotDimensions, margin)}, ${margin.top})`)
//         .call(axis.generator)
//
//     svg
//         .select(`#${labelIdFor(chartId, location)}`)
//         .attr('transform', `translate(${labelXTranslation(location, plotDimensions, margin, axesLabelFont)}, ${labelYTranslation(plotDimensions, margin)}) rotate(-90)`)
//
//     return categorySize
// }

// function xTranslation(location: AxisLocation.Left | AxisLocation.Right, plotDimensions: Dimensions, margin: Margin): number {
//     return location === AxisLocation.Left ?
//         margin.left :
//         margin.left + plotDimensions.width
// }
//
// function labelXTranslation(
//     location: AxisLocation,
//     plotDimensions: Dimensions,
//     margin: Margin,
//     axesLabelFont: AxesLabelFont,
// ): number {
//     switch (location) {
//         case AxisLocation.Left:
//         case AxisLocation.Right:
//             return location === AxisLocation.Left ?
//                 axesLabelFont.size :
//                 margin.left + plotDimensions.width + margin.right - axesLabelFont.size
//         case AxisLocation.Top:
//         case AxisLocation.Bottom:
//             return location === AxisLocation.Bottom ?
//                 plotDimensions.height + margin.top + margin.bottom / 3 :
//                 margin.top / 3
//     }
//
// }
//
// function labelYTranslation(plotDimensions: Dimensions, margin: Margin): number {
//     return (margin.top + margin.bottom + plotDimensions.height) / 2
// }

// function addCategoryXAxis(
//     chartId: number,
//     axisId: string,
//     svg: SvgSelection,
//     plotDimensions: Dimensions,
//     categories: Array<string>,
//     axesLabelFont: AxesLabelFont,
//     margin: Margin,
//     axisLabel: string,
//     location: AxisLocation.Bottom | AxisLocation.Top,
// ): axes.CategoryAxis {
//     const categorySize = categorySizeFor(plotDimensions, margin, categories.length)
//     const scale = d3.scaleBand()
//         .domain(categories)
//         .range([0, categorySize * categories.length]);
//
//     // create and add the axes
//     const generator = location === AxisLocation.Bottom ? d3.axisBottom(scale) : d3.axisTop(scale)
//
//     const selection = svg
//         .append<SVGGElement>('g')
//         .attr('id', `y-axis-selection-${chartId}`)
//         .attr('class', 'y-axis')
//         .attr('transform', `translate(${yTranslation(location, plotDimensions, margin)}, ${margin.top})`)
//         .call(generator);
//
//     svg
//         .append<SVGTextElement>('text')
//         .attr('id', labelIdFor(chartId, location))
//         .attr('text-anchor', 'middle')
//         .attr('font-size', axesLabelFont.size)
//         .attr('fill', axesLabelFont.color)
//         .attr('font-family', axesLabelFont.family)
//         .attr('font-weight', axesLabelFont.weight)
//         .attr('transform', `translate(${labelXTranslation(location, plotDimensions, margin, axesLabelFont)}, ${labelYTranslation(plotDimensions, margin)}) rotate(-90)`)
//         .text(axisLabel)
//
//     const axis = {axisId, selection, location, scale, generator, categorySize, update: () => categorySize}
//
//     return {
//         ...axis,
//         update: (categoryNames, unfilteredSize, dimensions) =>
//             updateCategoryXAxis(chartId, svg, axis, dimensions, unfilteredSize, categoryNames, axesLabelFont, margin, location)
//     }
// }

// function updateCategoryXAxis(
//     chartId: number,
//     svg: SvgSelection,
//     axis: axes.CategoryAxis,
//     plotDimensions: Dimensions,
//     unfilteredSize: number,
//     names: Array<string>,
//     axesLabelFont: AxesLabelFont,
//     margin: Margin,
//     location: AxisLocation.Bottom | AxisLocation.Top,
// ): number {
//     const categorySize = categorySizeFor(plotDimensions, margin, unfilteredSize)
//     axis.scale
//         .domain(names)
//         .range([0, categorySize * names.length])
//     axis.selection
//         .attr('transform', `translate(${margin.top}, ${yTranslation(location, plotDimensions, margin)})`)
//         .call(axis.generator)
//
//     svg
//         .select(`#${labelIdFor(chartId, location)}`)
//         .attr('transform', `translate(${labelXTranslation(location, plotDimensions, margin, axesLabelFont)}, ${labelYTranslation(plotDimensions, margin)}) rotate(-90)`)
//
//     return categorySize
// }

// function yTranslation(location: AxisLocation.Bottom | AxisLocation.Top, plotDimensions: Dimensions, margin: Margin): number {
//     return location === AxisLocation.Bottom ? margin.bottom + plotDimensions.width : margin.top
// }


