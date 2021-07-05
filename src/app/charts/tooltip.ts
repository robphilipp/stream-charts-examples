import {TimeSeries} from "./plot";
import * as d3 from "d3";
import {Datum} from "./datumSeries";
import {TextSelection} from "./d3types";
import {Dimensions, Margin} from "./margins";
import {Axes, AxesLineStyle, LinearAxis} from "./axes";
import {TooltipStyle} from "./TooltipStyle";
import {PlotDimensions} from "stream-charts/dist/src/app/charts/margins";

export interface TooltipDimensions {contentWidth: number, contentHeight: number}

/**
 * Renders a tooltip showing the neuron, spike time, and the spike strength when the mouse hovers over a spike.
 * @param tooltipId A unique ID for the tooltip
 * @param datum The spike datum (t ms, s mV)
 * @param seriesName The name of the series (i.e. the neuron ID)
 * @param segment The SVG line element representing the spike, over which the mouse is hovering.
 * @param container The container holding the SVG element
 * @param axes The axes for the chart
 * @param margin The margin around the plot
 * @param lineStyle The style of the axes lines used for the tooltip
 * @param chartId The ID of the chart
 * @param tooltipStyle The tooltip style information
 * @param plotDimensions The dimensions of the plot
 * @param tooltipContent Function that adds the tooltip content and then returns the width and height of
 * the content. The callback function is handed the datum, svg path element, and the series name and must
 * return a [TooltipDimension] object that holds the width and height of the content.
 */
export function createTooltipControl(
    tooltipId: string,
    datum: TimeSeries,
    seriesName: string,
    segment: SVGPathElement,
    container: SVGSVGElement,
    margin: Margin,
    tooltipStyle: TooltipStyle,
    plotDimensions: PlotDimensions,
    tooltipContent: (datum: TimeSeries, seriesName: string, segment: SVGPathElement) => TooltipDimensions
): void {

    // create the rounded rectangle for the tooltip's background
    const rect = d3.select<SVGSVGElement | null, any>(container)
        .append<SVGRectElement>('rect')
        .attr('id', tooltipId)
        .attr('class', 'tooltip')
        .attr('rx', tooltipStyle.borderRadius)
        .attr('fill', tooltipStyle.backgroundColor)
        .attr('fill-opacity', tooltipStyle.backgroundOpacity)
        .attr('stroke', tooltipStyle.borderColor)
        .attr('stroke-width', tooltipStyle.borderWidth)

    // call the callback to add the content
    const {contentWidth, contentHeight} = tooltipContent(datum, seriesName, segment)

    // set the position, width, and height of the tooltip rect based on the text height and width and the padding
    const [x, y] = d3.mouse(container)
    rect.attr('x', () => tooltipX(x, contentWidth, plotDimensions, tooltipStyle, margin))
        .attr('y', () => tooltipY(y, contentHeight, plotDimensions, tooltipStyle, margin))
        .attr('width', contentWidth + tooltipStyle.paddingLeft + tooltipStyle.paddingRight)
        .attr('height', contentHeight + tooltipStyle.paddingTop + tooltipStyle.paddingBottom)

}

/**
 * Removes the tooltip when the mouse has moved away from the spike
 */
export function removeTooltip() {
    d3.selectAll<SVGPathElement, Datum>('.tooltip').remove()
}

/**
 * Calculates the x-coordinate of the lower left-hand side of the tooltip rectangle (obviously without
 * "rounded corners"). Adjusts the x-coordinate so that tooltip is visible on the edges of the plot.
 * @param x The current x-coordinate of the mouse
 * @param textWidth The width of the tooltip text
 * @param plotDimensions The dimensions of the plot
 * @param tooltipStyle The tooltip style information
 * @param margin The plot margin
 * @return The x-coordinate of the lower left-hand side of the tooltip rectangle
 */
export function tooltipX(x: number, textWidth: number, plotDimensions: Dimensions, tooltipStyle: TooltipStyle, margin: Margin): number {
    if (x + textWidth + tooltipStyle.paddingLeft + 10 > plotDimensions.width + margin.left) {
        return x - textWidth - tooltipStyle.paddingRight - margin.right
    }
    return x + tooltipStyle.paddingLeft
}

/**
 * Calculates the y-coordinate of the lower-left-hand corner of the tooltip rectangle. Adjusts the y-coordinate
 * so that the tooltip is visible on the upper edge of the plot
 * @param y The y-coordinate of the series
 * @param textHeight The height of the header and neuron ID text
 * @param plotDimensions The dimensions of the plot
 * @param tooltipStyle The tooltip style information
 * @param margin The plot margin
 * @return The y-coordinate of the lower-left-hand corner of the tooltip rectangle
 */
export function tooltipY(y: number, textHeight: number, plotDimensions: Dimensions, tooltipStyle: TooltipStyle, margin: Margin): number {
    return y + margin.top - tooltipStyle.paddingBottom - textHeight - tooltipStyle.paddingTop
}


/**
 * Returns the index of the data point whose time is the upper boundary on the specified
 * time. If the specified time is larger than any time in the specified data, the returns
 * the length of the data array. If the specified time is smaller than all the values in
 * the specified array, then returns -1.
 * @param data The array of points from which to select the
 * boundary.
 * @param time The time for which to find the bounding points
 * @return The index of the upper boundary.
 */
function boundingPointsIndex(data: TimeSeries, time: number): number {
    const length = data.length
    if (time > data[length - 1][0]) {
        return length
    }
    if (time < data[0][0]) {
        return 0
    }
    return data.findIndex((value, index, array) => {
        const lowerIndex = Math.max(0, index - 1)
        return array[lowerIndex][0] <= time && time <= array[index][0]
    })
}


/**
 * Returns the (time, value) point that comes just before the mouse and just after the mouse
 * @param data The time-series data
 * @param time The time represented by the mouse's x-coordinate
 * @return {[[number, number], [number, number]]} the (time, value) point that comes just before
 * the mouse and just after the mouse. If the mouse is after the last point, then the "after" point
 * is `[NaN, NaN]`. If the mouse is before the first point, then the "before" point is `[NaN, NaN]`.
 */
export function boundingPoints(data: TimeSeries, time: number): [[number, number], [number, number]] {
    const upperIndex = boundingPointsIndex(data, time)
    if (upperIndex <= 0) {
        return [[NaN, NaN], data[0]]
    }
    if (upperIndex >= data.length) {
        return [data[data.length - 1], [NaN, NaN]]
    }
    return [data[upperIndex - 1], data[upperIndex]]
}
