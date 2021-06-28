import {SvgSelection, TrackerSelection} from "./d3types";
import {Selection} from "d3";
import {Datum} from "./datumSeries";
import {Margin, PlotDimensions} from "./margins";
import {AxesLabelFont} from "./axes";

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
 * @param svg The SVG selection
 * @param plotDimensions The dimensions of the plot
 * @param margin The margins around the plot
 * @param tracker The tracker style
 * @param axisLabelFont The font used for the axis labels
 * @return {TrackerSelection | undefined} The tracker selection if visible; otherwise undefined
 */
export function createTrackerControl(
    chartId: number,
    svg: SvgSelection,
    plotDimensions: PlotDimensions,
    margin: Margin,
    tracker: TrackerStyle,
    axisLabelFont: AxesLabelFont,
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

    return trackerLine
}
