import {useCallback, useEffect} from 'react'
import {useChart} from "./useChart";
import {ContinuousAxisRange, continuousAxisRangeFor} from "./continuousAxisRangeFor";
import * as d3 from "d3";
import {setClipPath, TimeSeries} from "./plot";
import {Datum, Series} from "./datumSeries";
import {BaseAxis, calculatePanFor, defaultLineStyle, LinearAxis} from "./axes";
import {GSelection} from "./d3types";
import {PlotDimensions} from "stream-charts/dist/src/app/charts/margins";

export interface AxesAssignment {
    xAxis: string
    yAxis: string
}

export function assignedAxes(xAxis: string, yAxis: string): AxesAssignment {
    return {xAxis, yAxis}
}

interface Props {
    axisAssignments?: Map<string, AxesAssignment>
    colors?: Map<string, string>
}

export function ScatterPlot(props: Props): null {
    const {
        chartId,
        container,
        mainG,
        // setMainGSelection,
        xAxisFor,
        xAxes,
        xAxisDefaultName,
        yAxisFor,
        // yAxisIds,
        plotDimensions,
        margin,
        color,
        seriesStyles,
        initialData,
    } = useChart()

    const {
        axisAssignments = new Map<string, AxesAssignment>()
    } = props

    const updatePlot = useCallback(
        /**
         * Updates the plot data for the specified time-range, which may have changed due to zoom or pan
         * @param timeRanges The current time range
         * @param mainGElem The main <g> element selection for that holds the plot
         */
        (timeRanges: Map<string, ContinuousAxisRange>, mainGElem: GSelection) => {
            /**
             * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
             * @param deltaX The amount that the plot is dragged
             * @param plotDimensions The dimensions of the plot
             * @param series An array of series names
             * @param timeRanges A map holding the axis ID and its associated axis
             * @param mainG The main <g> element holding the plot
             */
            function onPan(
                deltaX: number,
                plotDimensions: PlotDimensions,
                series: Array<string>,
                timeRanges: Map<string, ContinuousAxisRange>,
                mainG: GSelection
            ): void {
                series.forEach(name => {
                    // grab the axis name from the assignments. note that the user may not have specified
                    // an assignment when using the default axis, and so, in that case, use an empty string
                    // for the assignment, which the "xAxisFor(...)" function will treat as a request to
                    // return the default axis
                    const axisName = axisAssignments.get(name)?.xAxis || xAxisDefaultName()
                    const xAxis = xAxisFor(axisName) as LinearAxis

                    // calculate the change in the time-range based on the pixel change from the drag event
                    const {start, end} = calculatePanFor(deltaX, plotDimensions, xAxis, timeRangeFor(name, timeRanges, axisAssignments))

                    timeRanges.set(axisName, continuousAxisRangeFor(start, end))

                    // update the axis' time-range
                    xAxis.update([start, end], plotDimensions, margin)
                })

                // and now that all the axes are updated, update the plot
                updatePlot(timeRanges, mainG)
            }

            if (container) {
                // select the svg element bind the data to them
                const svg = d3.select<SVGSVGElement, any>(container)

                // todo for the set of series assigned to each axis, calculate the bounding values

                // create the tensor of data (time, value)
                const boundedSeries: Map<string, Array<[number, number]>> = new Map()
                initialData
                    .forEach((series, name) =>
                        boundedSeries.set(
                            name,
                            selectInTimeRange(series, timeRangeFor(name, timeRanges, axisAssignments))
                        ))
                // liveDataRef.current
                //     .forEach((series, name) => boundedSeries.set(name, selectInTimeRange(series)))
                //
                // // calculate and update the min and max values for updating the y-axis. only updates when
                // // the min is less than the historical min, and the max is larger than the historical max.
                // minMaxValueRef.current = minMaxYFor(Array.from(boundedSeries.values()), minMaxValueRef.current)
                //
                // // update the x and y axes
                // const [minValue, maxValue] = minMaxValueRef.current
                // axesRef.current.xAxis.update([timeRangeRef.current.start, timeRangeRef.current.end], plotDimensions, margin)
                // axesRef.current.yAxis.update([Math.max(minY, minValue), Math.min(maxY, maxValue)], plotDimensions, margin)
                //
                // // create/update the magnifier lens if needed
                // magnifierRef.current = magnifierLens(svg, magnifierStyle.visible)
                //
                // // create/update the tracker line if needed
                // trackerRef.current = trackerControl(svg, trackerStyle.visible)

                // set up panning
                const drag = d3.drag<SVGSVGElement, Datum>()
                    .on("start", () => {
                        // during a pan, we want to hide the tooltip
                        // tooltipRef.current.visible = false
                        // handleRemoveTooltip()
                        d3.select(container).style("cursor", "move")
                    })
                    .on("drag", () => onPan(d3.event.dx, plotDimensions, Array.from(boundedSeries.keys()), timeRanges, mainGElem))
                    .on("end", () => {
                        // if the tooltip was originally visible, then allow it to be seen again
                        // tooltipRef.current.visible = tooltipStyle.visible
                        d3.select(container).style("cursor", "auto")
                    })

                svg.call(drag)

                // // set up for zooming
                // const zoom = d3.zoom<SVGSVGElement, Datum>()
                //     .scaleExtent([0, 10])
                //     .translateExtent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
                //     .on("zoom", () => {
                //         onZoom(d3.event.transform, d3.event.sourceEvent.offsetX - margin.left, plotDimensions)
                //     })
                //
                // svg.call(zoom)

                // define the clip-path so that the series lines don't go beyond the plot area
                const clipPathId = setClipPath(chartId, svg, plotDimensions, margin)

                boundedSeries.forEach((data, name) => {

                    if (data.length === 0) return
                    const [xAxisLinear, yAxisLinear] = axesFor(name, axisAssignments, xAxisFor, yAxisFor)
                    if (xAxisLinear === undefined || yAxisLinear === undefined) return
                    const {color, lineWidth} = seriesStyles.get(name) || defaultLineStyle

                    // only show the data for which the filter matches
                    // const plotData = (series.name.match(seriesFilterRef.current)) ? data : []
                    // const plotData = (name.match(seriesFilterRef.current)) ? data : []
                    const plotData = data

                    // create the time-series paths
                    mainGElem
                        .selectAll(`#${name}`)
                        .data([[], plotData], () => `${name}`)
                        .join(
                            enter => enter
                                .append("path")
                                .attr("class", 'time-series-lines')
                                .attr("id", `${name}`)
                                // .attr("id", `${series.name}`)
                                .attr("d", d3.line()
                                    .x((d: [number, number]) => xAxisLinear.scale(d[0]))
                                    .y((d: [number, number]) => yAxisLinear.scale(d[1]))
                                )
                                .attr("fill", "none")
                                .attr("stroke", color)
                                .attr("stroke-width", lineWidth)
                                // .attr("stroke", colorsRef.current.get(name) || lineStyle.color)
                                // .attr("stroke-width", lineStyle.lineWidth)
                                .attr('transform', `translate(${margin.left}, ${margin.top})`)
                                .attr("clip-path", `url(#${clipPathId})`),
                            // .attr("clip-path", `url(#clip-series-${chartId.current})`)
                            // .on(
                            //     "mouseover",
                            //     (datumArray, i, group) =>
                            //         tooltipRef.current.visible ? handleShowTooltip(datumArray, name, group[i]) : null
                            // )
                            // .on(
                            //     "mouseleave",
                            //     (datumArray, i, group) =>
                            //         tooltipRef.current.visible ?
                            //             handleRemoveTooltip(name, group[i]) :
                            //             null
                            // ),
                            update => update,
                            exit => exit.remove()
                        )
                })
            }
        },
        [axisAssignments, chartId, container, initialData, margin, plotDimensions, seriesStyles, xAxisFor, yAxisFor]
    )

    useEffect(
        () => {
            if (container && mainG) {
                updatePlot(timeRanges(xAxes()), mainG)
            }
        },
        [chartId, color, container, mainG, plotDimensions, updatePlot, xAxes]
    )

    return null
}

/**
 * Determines whether the line segment is in the time-range
 * @param datum The current datum
 * @param index The index of the current datum
 * @param array The array of datum
 * @return `true` if the line segment is in the time-range, or if the line-segment
 * that ends after the time-range end or that starts before the time-range start is
 * in the time-range (i.e. intersects the time-range boundary). In other words, return
 * `true` if the line segment is in the time-range or intersects the time-range boundary.
 * Returns `false` otherwise.
 */
function inTimeRange(datum: Datum, index: number, array: Datum[], timeRange: ContinuousAxisRange): boolean {
    // also want to include the point whose previous or next value are in the time range
    const prevDatum = array[Math.max(0, index - 1)]
    const nextDatum = array[Math.min(index + 1, array.length - 1)]
    return (datum.time >= timeRange.start && datum.time <= timeRange.end) ||
        (datum.time < timeRange.start && nextDatum.time >= timeRange.start) ||
        (prevDatum.time <= timeRange.end && datum.time > timeRange.end)
}

/**
 * Returns the data in the time-range and the datum that comes just before the start of the time range.
 * The point before the time range is so that the line draws up to the y-axis, where it is clipped.
 * @param series The series
 * @return An array of (time, value) points that fit within the time range,
 * and the point just before the time range.
 */
function selectInTimeRange(series: Series, timeRange: ContinuousAxisRange): TimeSeries {
    return series.data
        .filter((datum: Datum, index: number, array: Datum[]) => inTimeRange(datum, index, array, timeRange))
        .map(datum => [datum.time, datum.value])
}

function timeRanges(xAxes: Map<string, BaseAxis>): Map<string, ContinuousAxisRange> {
    return new Map(Array.from(xAxes.entries())
        .map(([id, axis]) => {
            const [start, end] = (axis as LinearAxis).scale.domain()
            return [id, continuousAxisRangeFor(start, end)]
        }))
}

function timeRangeFor(
    seriesName: string,
    timeRanges: Map<string, ContinuousAxisRange>,
    axisAssignments: Map<string, AxesAssignment>
): ContinuousAxisRange {
    const axisName = axisAssignments.get(seriesName)?.xAxis
    if (axisName && axisName.length > 0) {
        const timeRange = timeRanges.get(axisName)
        if (timeRange) {
            return timeRange
        }
        return continuousAxisRangeFor(-100, 100)
    }
    return Array.from(timeRanges.values())[0]
}

/**
 * Attempts to locate the x- and y-axes for the specified series. If no axis is found for the
 * series name, then uses the default returned by the useChart() hook
 * @param seriesName Name of the series for which to retrieve the axis
 * @param axisAssignments A map holding the series name and the associated x- and y-axes assigned
 * to that series. Note that the series in the axis-assignment map is merely a subset of the set
 * of series names.
 * @param xAxisFor The function that accepts an axis ID and returns the corresponding x-axis
 * @param yAxisFor The function that accepts an axis ID and returns the corresponding y-axis
 */
function axesFor(
    seriesName: string,
    axisAssignments: Map<string, AxesAssignment>,
    xAxisFor: (id: string) => BaseAxis | undefined,
    yAxisFor: (id: string) => BaseAxis | undefined,
): [xAxis: LinearAxis, yAxis: LinearAxis] {
    const axes = axisAssignments.get(seriesName)
    const xAxis = xAxisFor(axes?.xAxis || "")
    const xAxisLinear = xAxis as LinearAxis
    const yAxis = yAxisFor(axes?.yAxis || "")
    const yAxisLinear = yAxis as LinearAxis
    if (xAxis && !xAxisLinear) {
        throw Error("Scatter plot requires that x-axis be of type LinearAxis")
    }
    if (yAxis && !yAxisLinear) {
        throw Error("Scatter plot requires that y-axis be of type LinearAxis")
    }
    return [xAxisLinear, yAxisLinear]
}

