import {Dimensions, Margin} from "./margins";
import * as d3 from "d3";
import {GSelection, SvgSelection} from "./d3types";
import {PlotDimensions} from "stream-charts/dist/src/app/charts/margins";

export type Range = [min: number, max: number]
export type TimeSeries = Array<[number, number]>

export function createPlotContainer(chartId: number, container: SVGSVGElement, dimensions: Dimensions, color: string): GSelection {
    const {width, height} = dimensions
    return d3.select<SVGSVGElement, any>(container)
        .attr('width', width)
        .attr('height', height)
        .attr('color', color)
        .append<SVGGElement>('g')
        .attr('id', `main-container-${chartId}`)
}

export function setClipPath(chartId: number, svg: SvgSelection, plotDimensions: PlotDimensions, margin: Margin): string {
    const clipPathId = `chart-clip-path-${chartId}`

    // remove the old clipping region and add a new one with the updated plot dimensions
    svg.select('defs').remove();
    svg
        .append('defs')
        .append("clipPath")
        .attr("id", clipPathId)
        .append("rect")
        .attr("width", plotDimensions.width)
        .attr("height", plotDimensions.height - margin.top)

    return clipPathId
}

// export interface Plot {
//     mainG: GSelection
//     timeRange: ContinuousAxisRange
//     yRange: Range
//     magnifier: RadialMagnifierSelection | undefined
//     tracker: TrackerSelection | undefined
// }
//
// /**
//  * Updates the plot data for the specified time-range, which may have changed due to zoom or pan
//  * @param timeRange The current time range
//  * @param plotDimensions The dimensions of the plot
//  */
// export function updatePlot(
//     chartId: number,
//     timeRange: ContinuousAxisRange,
//     plotDimensions: Dimensions,
//     margin: Margin,
//     container: SVGSVGElement,
//     axes: Axes<LinearAxis, LinearAxis>,
//     currentYRange: Range,
//     validYRange: Range,
//     liveData: Map<string, Series>,
//     trackerStyle: TrackerStyle,
//     tooltipStyle: TooltipStyle,
//     axisStyle: Partial<CSSProperties>,
//     axisLabelFont: AxesLabelFont,
//     mainG: GSelection | undefined,
//     seriesFilter: RegExp,
//     colors: Map<string, string>,
//     lineStyle: AxesLineStyle,
// ): Plot {
//     // select the svg element bind the data to them
//     const svg = d3.select<SVGSVGElement, any>(container)
//
//     // create the tensor of data (time, value)
//     const data: Array<Array<[number, number]>> = Array
//         .from(liveData.values())
//         .map(series => selectInTimeRange(series, timeRange))
//
//     // calculate and update the min and max values for updating the y-axis. only updates when
//     // the min is less than the historical min, and the max is larger than the historical max.
//     const [minValue, maxValue] = calcMinMaxValues(data, currentYRange)
//
//     // update the x and y axes
//     const [minY, maxY] = validYRange
//     axes.xAxis.update([timeRange.start, timeRange.end], plotDimensions, margin)
//     axes.yAxis.update([Math.max(minY, minValue), Math.min(maxY, maxValue)], plotDimensions, margin)
//
//     // create/update the magnifier lens if needed
//     const magnifier =  magnifierLens(svg, magnifierStyle.visible)
//
//     // create/update the tracker line if needed
//     const tracker = trackerControl(svg, chartId, timeRange, plotDimensions, margin, container, axes, trackerStyle, tooltipStyle, axisLabelFont)
//
//     const {width, height} = containerDimensionsFrom(plotDimensions, margin)
//
//     // set up the main <g> container for svg and translate it based on the margins, but do it only
//     // once
//     let mainGContainer: GSelection
//     if (mainG === undefined) {
//         mainGContainer = svg
//             .attr('width', width)
//             .attr('height', height)
//             .attr('color', axisStyle.color || "grey")
//             .append<SVGGElement>('g')
//     } else {
//         mainGContainer = mainG
//     }
//
//     // set up panning
//     const drag = d3.drag<SVGSVGElement, Datum>()
//         .on("start", () => {
//             // during a pan, we want to hide the tooltip
//             tooltipStyle.visible = false
//             handleHideTooltip()
//             d3.select(container).style("cursor", "move")
//         })
//         .on("drag", () => onPan(d3.event.dx, plotDimensions))
//         .on("end", () => {
//             // if the tooltip was originally visible, then allow it to be seen again
//             tooltipStyle.visible = tooltipStyle.visible
//             d3.select(container).style("cursor", "auto")
//         })
//
//
//     svg.call(drag)
//
//     // set up for zooming
//     const zoom = d3.zoom<SVGSVGElement, Datum>()
//         .scaleExtent([0, 10])
//         .translateExtent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
//         .on("zoom", () => {
//             onZoom(d3.event.transform, d3.event.sourceEvent.offsetX - margin.left, plotDimensions)
//         })
//
//
//     svg.call(zoom)
//
//     // remove the old clipping region and add a new one with the updated plot dimensions
//     svg.select('defs').remove()
//     svg
//         .append('defs')
//         .append("clipPath")
//         .attr("id", `stream-chart-clip-series-${chartId}`)
//         .append("rect")
//         .attr("width", plotDimensions.width)
//         .attr("height", plotDimensions.height - margin.top)
//
//
//     liveData.forEach((series, name) => {
//         const data = selectInTimeRange(series, timeRange)
//
//         if (data.length === 0) return
//
//         // only show the data for which the filter matches
//         // const plotData = (series.name.match(seriesFilterRef.current)) ? data : []
//         const plotData = (name.match(seriesFilter)) ? data : []
//
//         // create the time-series paths
//         mainGContainer
//             .selectAll(`#${series.name}`)
//             .data([[], plotData], () => `${series.name}`)
//             .join(
//                 enter => enter
//                     .append("path")
//                     .attr("class", 'time-series-lines')
//                     .attr("id", `${series.name}`)
//                     .attr("d", d3.line()
//                         .x((d: [number, number]) => axes.xAxis.scale(d[0]))
//                         .y((d: [number, number]) => axes.yAxis.scale(d[1]))
//                     )
//                     .attr("fill", "none")
//                     // .attr("stroke", lineStyle.color)
//                     .attr("stroke", colors.get(series.name) || lineStyle.color)
//                     .attr("stroke-width", lineStyle.lineWidth)
//                     .attr('transform', `translate(${margin.left}, ${margin.top})`)
//                     .attr("clip-path", `url(#clip-series-${chartId})`)
//                     .on(
//                         "mouseover",
//                         (datumArray, i, group) =>
//                             tooltipRef.current.visible ? handleShowTooltip(datumArray, series.name, group[i]) : null
//                     )
//                     .on(
//                         "mouseleave",
//                         (datumArray, i, group) =>
//                             tooltipRef.current.visible ? handleHideTooltip(group[i], series.name) : null
//                     ),
//                 update => update,
//                 exit => exit.remove()
//             )
//     })
//     // }
//
//     return {
//         mainG: mainGContainer,
//         timeRange,
//         yRange: [minValue, maxValue],
//         magnifier,
//         tracker
//     }
// }

// /**
//  * Returns the data in the time-range and the datum that comes just before the start of the time range.
//  * The point before the time range is so that the line draws up to the y-axis, where it is clipped.
//  * @param series The series
//  * @return An array of (time, value) points that fit within the time range,
//  * and the point just before the time range.
//  */
// function selectInTimeRange(series: Series, timeRange: ContinuousAxisRange): TimeSeries {
//     return series.data
//         .filter((datum: Datum, index: number, array: Datum[]) => inTimeRange(datum, index, array, timeRange))
//         .map(datum => [datum.time, datum.value])
// }

// function inTimeRange(datum: Datum, index: number, array: Datum[], timeRange: ContinuousAxisRange): boolean {
//     // also want to include the point whose next value is in the time range
//     const nextDatum = array[Math.min(index + 1, array.length - 1)]
//     return nextDatum.time >= timeRange.start && datum.time <= timeRange.end
// }


// /**
//  * Calculates the min and max values for the specified array of time-series
//  * @param data The array of time-series
//  * @return A pair with the min value as the first element and the max value as the second element.
//  */
// function calcMinMaxValues(data: Array<TimeSeries>, currentRange: Range): Range {
//     const minValue = d3.min(data, series => d3.min(series, datum => datum[1])) || 0
//     const maxValue = d3.max(data, series => d3.max(series, datum => datum[1])) || 1
//     const [currentMin, currentMax] = currentRange
//     return [
//         Math.min(minValue, currentMin),
//         Math.max(maxValue, currentMax)
//     ]
// }

// /**
//  * Creates the SVG elements for displaying a tracker line
//  * @param svg The SVG selection
//  * @param visible `true` if the tracker is visible; `false` otherwise
//  * @return The tracker selection if visible; otherwise undefined
//  */
// function trackerControl(
//     svg: SvgSelection,
//     // visible: boolean,
//     chartId: number,
//     timeRange: ContinuousAxisRange,
//     plotDimensions: Dimensions,
//     margin: Margin,
//     container: SVGSVGElement | undefined,
//     axes: Axes<LinearAxis, LinearAxis>,
//     trackerStyle: TrackerStyle,
//     tooltip: TooltipStyle,
//     axisLabelFont: AxesLabelFont
// ): TrackerSelection | undefined {
//     if (trackerStyle.visible && container) {
//         return createTrackerControl(
//             chartId,
//             container,
//             svg,
//             plotDimensions,
//             margin,
//             trackerStyle,
//             axisLabelFont,
//             x => `${d3.format(",.0f")(axes.xAxis.scale.invert(x - margin.left))} ms`
//         )
//     }
//     // if the magnifier was defined, and is now no longer defined (i.e. props changed, then remove the magnifier)
//     else if (!trackerStyle.visible || tooltip.visible) {
//         removeTrackerControl(svg)
//         return undefined
//     }
// }
