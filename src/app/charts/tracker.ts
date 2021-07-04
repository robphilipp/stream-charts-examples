import {SvgSelection, TrackerSelection} from "./d3types";
import {Selection} from "d3";
import {Datum} from "./datumSeries";
import {Margin, Dimensions, containerDimensionsFrom} from "./margins";
import {AxesLabelFont} from "./axes";
import * as d3 from "d3";
import {mouseInPlotAreaFor, textWidthOf} from "./utils";

export interface TrackerStyle {
    visible: boolean;
    color: string,
    lineWidth: number,
}

export const defaultTrackerStyle: TrackerStyle = {
    visible: false,
    color: '#d2933f',
    lineWidth: 1,
};

/**
 * Creates the SVG elements for displaying a tracker line
 * @param chartId The ID of the chart
 * @param container The SVG container
 * @param svg The SVG selection
 * @param plotDimensions The dimensions of the plot
 * @param margin The margins around the plot
 * @param tracker The tracker style
 * @param axisLabelFont The font used for the axis labels
 * @param trackerLabel A function that returns the tracker label string for a given x-value
 * @return The tracker selection
 */
export function createTrackerControl(
    chartId: number,
    container: SVGSVGElement,
    svg: SvgSelection,
    plotDimensions: Dimensions,
    margin: Margin,
    tracker: TrackerStyle,
    axisLabelFont: AxesLabelFont,
    trackerLabel: (x: number) => string,
): TrackerSelection {
    const trackerLine = svg
        .append<SVGLineElement>('line')
        .attr('id', `stream-chart-tracker-line-${chartId}`)
        .attr('class', 'tracker')
        .attr('y1', margin.top)
        .attr('y2', plotDimensions.height)
        .attr('stroke', tracker.color)
        .attr('stroke-width', tracker.lineWidth)
        .attr('opacity', 0) as Selection<SVGLineElement, Datum, null, undefined>


    // create the text element holding the tracker time
    svg
        .append<SVGTextElement>('text')
        .attr('id', `stream-chart-tracker-label-${chartId}`)
        .attr('y', Math.max(0, margin.top - 3))
        .attr('fill', axisLabelFont.color)
        .attr('font-family', axisLabelFont.family)
        .attr('font-size', axisLabelFont.size)
        .attr('font-weight', axisLabelFont.weight)
        .attr('opacity', 0)
        .text(() => '')

    const containerDimensions = containerDimensionsFrom(plotDimensions, margin)
    svg.on('mousemove', () => handleShowTracker(
        chartId, container, margin, containerDimensions, trackerLabel
    ))

    return trackerLine
}

/**
 * Removes the tracker control from the chart
 * @param svg The svg selection holding the tracker contol
 */
export function removeTrackerControl(svg: SvgSelection) {
    svg.on('mousemove', () => null)
}

/**
 * Callback when the mouse tracker is to be shown
 * @param chartId The ID number of the chart
 * @param container The svg container
 * @param margin The plot margins
 * @param dimensions The container dimensions (i.e. the plot dimensions plus its margins)
 * @param trackerLabel A function that returns the tracker label string
 */
function handleShowTracker(
    chartId: number,
    container: SVGSVGElement,
    margin: Margin,
    dimensions: Dimensions,
    trackerLabel: (x: number) => string
): void {
    if (container) {
        // determine whether the mouse is in the plot area
        const [x, y] = d3.mouse(container)
        const inPlot = mouseInPlotAreaFor(x, y, margin, dimensions)

        // when the mouse is in the plot area, then set the opacity of the tracker line and label to 1,
        // which means it is fully visible. when the mouse is not in the plot area, set the opacity to 0,
        // which means the tracker line and label are invisible.
        d3.select<SVGLineElement, Datum>(`#stream-chart-tracker-line-${chartId}`)
            .attr('x1', x)
            .attr('x2', x)
            .attr('opacity', () => inPlot ? 1 : 0)

        const label = d3.select<SVGTextElement, any>(`#stream-chart-tracker-label-${chartId}`)
            .attr('opacity', () => inPlot ? 1 : 0)
            .text(() => trackerLabel(x))

        // adjust the label position when the tracker is at the right-most edges of the plot so that
        // the label remains visible (i.e. doesn't get clipped)
        const labelWidth = textWidthOf(label)
        label.attr('x', Math.min(dimensions.width - margin.right - labelWidth, x))
    }
}
