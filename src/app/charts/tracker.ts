import {SvgSelection, TrackerSelection} from "./d3types";
import {Selection} from "d3";
import {Datum} from "./datumSeries";
import {Margin, noMargins, PlotDimensions} from "./margins";
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
 * @return {TrackerSelection | undefined} The tracker selection if visible; otherwise undefined
 */
export function createTrackerControl(
    chartId: number,
    container: SVGSVGElement,
    svg: SvgSelection,
    plotDimensions: PlotDimensions,
    margin: Margin,
    tracker: TrackerStyle,
    axisLabelFont: AxesLabelFont,
    trackerLabel: (x: number) => string,
): TrackerSelection | undefined {
    const trackerLine = svg
        .append<SVGLineElement>('line')
        .attr('class', 'tracker')
        .attr('y1', margin.top)
        .attr('y2', plotDimensions.height)
        .attr('stroke', tracker.color)
        .attr('stroke-width', tracker.lineWidth)
        .attr('opacity', 0) as Selection<SVGLineElement, Datum, null, undefined>


    // create the text element holding the tracker time
    svg
        .append<SVGTextElement>('text')
        .attr('id', `stream-chart-tracker-time-${chartId}`)
        .attr('y', Math.max(0, margin.top - 3))
        .attr('fill', axisLabelFont.color)
        .attr('font-family', axisLabelFont.family)
        .attr('font-size', axisLabelFont.size)
        .attr('font-weight', axisLabelFont.weight)
        .attr('opacity', 0)
        .text(() => '')

    const containerDimensions = {
        width: plotDimensions.width + margin.left + margin.right,
        height: plotDimensions.height + margin.top + margin.bottom
    }
    svg.on('mousemove', () => handleShowTracker(
        chartId, container, trackerLine, margin, containerDimensions, trackerLabel
    ))

    return trackerLine
}



/**
 * Callback when the mouse tracker is to be shown
 * @param chartId The ID number of the chart
 * @param container The svg container
 * @param trackerLine The SVG line element selection representing the tracker line on the plot
 * @param margin The plot margins
 * @param dimensions The container dimensions (i.e. the plot dimensions plus its margins)
 * @param trackerLabel A function that returns the tracker label string
 */
function handleShowTracker(
    chartId: number,
    container: SVGSVGElement,
    trackerLine: TrackerSelection,
    margin: Margin,
    dimensions: PlotDimensions,
    trackerLabel: (x: number) => string
): void {
    if (container && trackerLine) {
        const [x, y] = d3.mouse(container)
        trackerLine
            .attr('x1', x)
            .attr('x2', x)
            .attr('opacity', () => mouseInPlotAreaFor(x, y, margin, dimensions) ? 1 : 0)


        const label = d3.select<SVGTextElement, any>(`#stream-chart-tracker-time-${chartId}`)
            .attr('opacity', () => mouseInPlotAreaFor(x, y, margin, dimensions) ? 1 : 0)
            .text(() => trackerLabel(x))


        const labelWidth = textWidthOf(label)
        label.attr('x', Math.min(dimensions.width - margin.right - labelWidth, x))
    }
}

