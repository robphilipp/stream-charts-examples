import {TimeSeries} from "./plot";
import {Dimensions, Margin} from "./margins";
import {boundingPoints, defaultTooltipStyle, TooltipDimensions, TooltipStyle, tooltipX, tooltipY} from "./tooltipUtils";
import * as d3 from "d3";
import {formatTime, formatTimeChange, formatValue, formatValueChange} from "./utils";
import {TextSelection} from "./d3types";
import {useEffect} from "react";
import {useChart} from "./useChart";

interface LegendOptions {
    labels: {x: string, y: string}
    formatters: {
        x: {value: (value: number) => string, change: (value1: number, value2: number) => string},
        y: {value: (value: number) => string, change: (value1: number, value2: number) => string},
    }
}

interface Props {
    xLabel: string
    yLabel: string
    xValueFormatter?: (value: number) => string
    yValueFormatter?: (value: number) => string
    xChangeFormatter?: (value1: number, value2: number) => string,
    yChangeFormatter?: (value1: number, value2: number) => string,
}

export function ScatterPlotTooltipContent(props: Props): null {
    const {
        chartId,
        container,
        margin,
        plotDimensions,
        registerTooltipContentProvider
    } = useChart()
    const {
        xLabel,
        yLabel,
        xValueFormatter = formatTime,
        yValueFormatter = formatValue,
        xChangeFormatter = formatTimeChange,
        yChangeFormatter = formatValueChange
    } = props

    const labels = {x: xLabel, y: yLabel}
    const formatters = {
        x: {value: xValueFormatter, change: xChangeFormatter},
        y: {value: yValueFormatter, change: yChangeFormatter},
    }
    const options = {formatters, labels}

    // register the tooltip content provider, which when called on mouse-enter-series events
    // will render the tooltip container and then the tooltip content. recall that that the
    // tooltip content is generated in this plot (because this is the plot that holds all the
    // information needed to render it), and the container for the content is rendered by
    // the <Tooltip>, which this know nothing about.
    //
    // the 'tooltipContentProvider' returns a function of the form (seriesName, time, series) => TooltipDimensions.
    // and that function has a closure on the parameters passed to 'tooltipContentProvider' in
    // this effect.
    useEffect(
        () => {
            if (container) {
                // register the tooltip content provider function with the chart hook (useChart) so that
                // it is visible to all children of the Chart (i.e. the <Tooltip>).
                registerTooltipContentProvider(
                    tooltipContentProvider(
                        chartId, container, margin, defaultTooltipStyle, plotDimensions,
                        options
                    )
                )
            }
        },
        [chartId, container, margin, plotDimensions, registerTooltipContentProvider]
    )

    return null
}

/**
 * Higher-order function that returns a function called when a mouse-over event occurs on a series.
 * The returned function accepts the series name, plot time, and time-series, renders the tooltip,
 * and returns the tooltip dimensions. Additionally, the returned function has a closure over the
 * parameters passed to this higher-order function.
 * @param chartId The ID of this chart
 * @param container The plot container (SVGSVGElement)
 * @param margin The plot margins
 * @param tooltipStyle The style properties for the tooltip
 * @param plotDimensions The dimensions of the plot
 * @return A function of the form `(seriesName, time, series) => TooltipDimensions`, where the
 * {@link TooltipDimensions} hold the width and height required to fit the content. The returned
 * function is the function called by the mouse-over handler.
 */
function tooltipContentProvider(
    chartId: number,
    container: SVGSVGElement,
    margin: Margin,
    tooltipStyle: TooltipStyle,
    plotDimensions: Dimensions,
    options: LegendOptions
): (seriesName: string, time: number, series: TimeSeries, mouseCoords: [x: number, y: number]) => TooltipDimensions {
    return (seriesName: string, time: number, series: TimeSeries, mouseCoords: [x: number, y: number]) =>
        addTooltipContent(
            seriesName, time, series, mouseCoords,
            chartId, container, margin, plotDimensions, tooltipStyle,
            options
        )
}

/**
 * Callback function that adds tooltip content and returns the tooltip width and text height
 * @param seriesName The name of the series (i.e. the neuron ID)
 * @param time
 * @param series The spike datum (t ms, s mV)
 * @param mouseCoords The coordinates of the mouse when the event was fired (relative to the plot container)
 * @param chartId The ID of the chart
 * @param container
 * @param margin
 * @param plotDimensions
 * @param tooltipStyle
 * @return The width and text height of the tooltip content
 */
function addTooltipContent(
    seriesName: string,
    time: number,
    series: TimeSeries,
    mouseCoords: [x: number, y: number],
    chartId: number,
    container: SVGSVGElement,
    margin: Margin,
    plotDimensions: Dimensions,
    tooltipStyle: TooltipStyle,
    options: LegendOptions
): TooltipDimensions {
    const {labels, formatters} = options
    const [x, y] = mouseCoords
    const [lower, upper] = boundingPoints(series, time)

    // todo...finally, these can be exposed as a callback for the user of the <ScatterChart/>
    // display the neuron ID in the tooltip
    const header = d3.select<SVGSVGElement | null, any>(container)
        .append<SVGTextElement>("text")
        .attr('id', `tn${time}-${seriesName}-${chartId}`)
        .attr('class', 'tooltip')
        .attr('fill', tooltipStyle.fontColor)
        .attr('font-family', 'sans-serif')
        .attr('font-size', tooltipStyle.fontSize)
        .attr('font-weight', tooltipStyle.fontWeight)
        .text(() => seriesName)


    // create the table that shows the points that come before and after the mouse time, and the
    // changes in the time and value
    const table = d3.select<SVGSVGElement | null, any>(container)
        .append("g")
        .attr('id', `t${time}-${seriesName}-header-${chartId}`)
        .attr('class', 'tooltip')
        .attr('fill', tooltipStyle.fontColor)
        .attr('font-family', 'sans-serif')
        .attr('font-size', tooltipStyle.fontSize + 2)
        .attr('font-weight', tooltipStyle.fontWeight + 150)


    const headerRow = table.append('g').attr('font-weight', tooltipStyle.fontWeight + 550)
    const hrLower = headerRow.append<SVGTextElement>("text").text(() => 'before')
    const hrUpper = headerRow.append<SVGTextElement>("text").text(() => 'after')
    const hrDelta = headerRow.append<SVGTextElement>("text").text(() => '∆')

    const trHeader = table.append<SVGTextElement>("text").text(() => labels.x)
    const trLower = table.append<SVGTextElement>("text").text(() => formatters.x.value(lower[0]))
    const trUpper = table.append<SVGTextElement>("text").text(() => formatters.x.value(upper[0]))
    const trDelta = table.append<SVGTextElement>("text").text(() => formatters.x.change(lower[0], upper[0]))

    const vrHeader = table.append<SVGTextElement>("text").text(() => labels.y)
    const vrLower = table.append<SVGTextElement>("text").text(() => formatters.y.value(lower[1]))
    const vrUpper = table.append<SVGTextElement>("text").text(() => formatters.y.value(upper[1]))
    const vrDelta = table.append<SVGTextElement>("text").text(() => formatters.y.change(lower[1], upper[1]))

    const textWidthOf = (elem: TextSelection) => elem.node()?.getBBox()?.width || 0
    const textHeightOf = (elem: TextSelection) => elem.node()?.getBBox()?.height || 0
    const spacesWidthFor = (spaces: number) => spaces * textWidthOf(hrLower) / 5

    // calculate the max width and height of the text
    const tooltipWidth = Math.max(textWidthOf(header), spacesWidthFor(33))
    const headerTextHeight = textHeightOf(header)
    const headerRowHeight = textHeightOf(hrLower)
    const timeRowHeight = textHeightOf(trHeader)
    const valueRowHeight = textHeightOf(vrHeader)
    const textHeight = headerTextHeight + headerRowHeight + timeRowHeight + valueRowHeight

    // set the header text location
    const xTooltip = tooltipX(x, tooltipWidth, plotDimensions, tooltipStyle, margin) + tooltipStyle.paddingLeft
    const yTooltip = tooltipY(y, textHeight, plotDimensions, tooltipStyle, margin) + tooltipStyle.paddingTop
    header
        .attr('x', () => xTooltip)
        .attr('y', () => yTooltip - (headerRowHeight + timeRowHeight + valueRowHeight) + textHeight)


    const hrRowY = yTooltip + headerTextHeight + headerRowHeight
    const hrLowerX = spacesWidthFor(14)
    const hrUpperX = spacesWidthFor(24)
    const hrDeltaX = spacesWidthFor(32)
    hrLower.attr('x', () => xTooltip + hrLowerX - textWidthOf(hrLower)).attr('y', () => hrRowY)
    hrUpper.attr('x', () => xTooltip + hrUpperX - textWidthOf(hrUpper)).attr('y', () => hrRowY)
    hrDelta.attr('x', () => xTooltip + hrDeltaX - textWidthOf(hrDelta)).attr('y', () => hrRowY)

    const trRowY = hrRowY + timeRowHeight
    trHeader.attr('x', () => xTooltip).attr('y', () => trRowY)
    trLower.attr('x', () => xTooltip + hrLowerX - textWidthOf(trLower)).attr('y', () => trRowY)
    trUpper.attr('x', () => xTooltip + hrUpperX - textWidthOf(trUpper)).attr('y', () => trRowY)
    trDelta.attr('x', () => xTooltip + hrDeltaX - textWidthOf(trDelta)).attr('y', () => trRowY)

    const vrRowY = trRowY + valueRowHeight
    vrHeader.attr('x', () => xTooltip).attr('y', () => vrRowY)
    vrLower.attr('x', () => xTooltip + hrLowerX - textWidthOf(vrLower)).attr('y', () => vrRowY)
    vrUpper.attr('x', () => xTooltip + hrUpperX - textWidthOf(vrUpper)).attr('y', () => vrRowY)
    vrDelta.attr('x', () => xTooltip + hrDeltaX - textWidthOf(vrDelta)).attr('y', () => vrRowY)

    return {contentWidth: tooltipWidth, contentHeight: textHeight}
}
