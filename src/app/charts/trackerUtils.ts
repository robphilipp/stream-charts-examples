import {SvgSelection, TrackerSelection} from "./d3types";
import * as d3 from "d3";
import {Selection} from "d3";
import {Datum} from "./datumSeries";
import {containerDimensionsFrom, Dimensions, Margin} from "./margins";
import {mouseInPlotAreaFor, textWidthOf} from "./utils";
import {AxisLocation, ContinuousNumericAxis} from "./axes";
import {TrackerAxisInfo, TrackerAxisUpdate} from "./Tracker";

export interface TrackerLabelFont {
    size: number
    color: string
    family: string
    weight: number
}

export const defaultTrackerLabelFont: TrackerLabelFont = {
    size: 12,
    color: '#d2933f',
    weight: 300,
    family: 'sans-serif'
}


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
 * Creates or returns the existing SVG elements for displaying a tracker line
 * @param chartId The ID of the chart
 * @param container The SVG container
 * @param svg The SVG selection
 * @param plotDimensions The dimensions of the plot
 * @param margin The margins around the plot
 * @param tracker The tracker style
 * @param trackerLabelFont The font used for the axis labels
 * @param trackerLabel A function that returns the tracker label string for a given x-value
 * @param onTrackerUpdate A callback function the accepts the current tracker's axis information
 * @return The tracker selection
 */
export function trackerControlInstance(
    chartId: number,
    container: SVGSVGElement,
    svg: SvgSelection,
    plotDimensions: Dimensions,
    margin: Margin,
    tracker: TrackerStyle,
    trackerLabelFont: TrackerLabelFont,
    trackerLabel: Map<ContinuousNumericAxis, (x: number) => string>,
    onTrackerUpdate: (update: TrackerAxisUpdate) => void
): TrackerSelection {
    const line = svg.select(`#stream-chart-tracker-line-${chartId}`) as Selection<SVGLineElement, Datum, null, undefined>
    if (!line.empty()) {
        return line
    }
    const trackerLine = svg
        .append<SVGLineElement>('line')
        .attr('id', `stream-chart-tracker-line-${chartId}`)
        .attr('class', 'tracker')
        .attr('y1', margin.top)
        .attr('y2', plotDimensions.height + margin.top - margin.bottom)
        .attr('stroke', tracker.color)
        .attr('stroke-width', tracker.lineWidth)
        .attr('opacity', 0) as Selection<SVGLineElement, Datum, null, undefined>


    trackerLabel.forEach((labelFn, axis) => {
        // create the text element holding the tracker time
        const label = axis.location === AxisLocation.Top ?
            // Math.max(0, margin.top - 3) :
            Math.max(0, margin.top - 20) :
            Math.max(0, plotDimensions.height + margin.top - 3)
        svg
            .append<SVGTextElement>('text')
            .attr('id', `stream-chart-tracker-label-${chartId}-${axis.location}`)
            .attr('y', label)
            .attr('fill', trackerLabelFont.color)
            .attr('font-family', trackerLabelFont.family)
            .attr('font-size', trackerLabelFont.size)
            .attr('font-weight', trackerLabelFont.weight)
            .attr('opacity', 0)
            .text(() => '')
    })

    const containerDimensions = containerDimensionsFrom(plotDimensions, margin)
    svg.on(
        'mousemove',
        () => handleShowTracker(chartId, container, margin, containerDimensions, trackerLabel, onTrackerUpdate)
    )

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
 * @param onTrackerUpdate A callback function the accepts the current tracker's axis information
 */
function handleShowTracker(
    chartId: number,
    container: SVGSVGElement,
    margin: Margin,
    dimensions: Dimensions,
    trackerLabel: Map<ContinuousNumericAxis, (x: number) => string>,
    onTrackerUpdate: (update: TrackerAxisUpdate) => void
): void {
    if (container) {
        // determine whether the mouse is in the plot area
        const [x, y] = d3.mouse(container)
        const inPlot = mouseInPlotAreaFor(x, y, margin, dimensions)

        // trackerLabel.forEach((trackerLabel, axis) => {
        const updateInfo: Array<[string, TrackerAxisInfo]> = Array.from(trackerLabel.entries()).map(([axis, trackerLabel]) => {
            // when the mouse is in the plot area, then set the opacity of the tracker line and label to 1,
            // which means it is fully visible. when the mouse is not in the plot area, set the opacity to 0,
            // which means the tracker line and label are invisible.
            d3.select<SVGLineElement, Datum>(`#stream-chart-tracker-line-${chartId}`)
                .attr('x1', x)
                .attr('x2', x)
                .attr('opacity', () => inPlot ? 1 : 0)

            const label = d3.select<SVGTextElement, any>(`#stream-chart-tracker-label-${chartId}-${axis.location}`)
                .attr('opacity', () => inPlot ? 1 : 0)
                .text(() => trackerLabel(x))

            // adjust the label position when the tracker is at the right-most edges of the plot so that
            // the label remains visible (i.e. doesn't get clipped)
            const labelWidth = textWidthOf(label)
            label.attr('x', Math.min(dimensions.width - margin.right - labelWidth, x))

            const trackerInfo: TrackerAxisInfo = {
                x: axis.scale.invert(x - margin.left),
                axisLocation: axis.location
            }
            return [axis.axisId, trackerInfo]
        })

        if (inPlot) {
            Array.from(trackerLabel.keys()).map(axis => ({location: axis.location}))
            onTrackerUpdate(new Map(updateInfo))
        }
    }
}

