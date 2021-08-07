import {useEffect} from 'react'
import {useChart} from "./useChart";
import {ContinuousAxisRange, continuousAxisRangeFor} from "./continuousAxisRangeFor";
import * as d3 from "d3";
import {createPlotContainer, setClipPath, TimeSeries} from "./plot";
import {Datum, Series} from "./datumSeries";
import {defaultLineStyle, LinearAxis} from "./axes";
import {GSelection} from "./d3types";

export interface AxesAssignment {
    xAxis: string
    yAxis: string
}

export function axesAssigned(xAxis: string, yAxis: string): AxesAssignment {
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
        setMainGSelection,
        xAxisFor,
        yAxisFor,
        plotDimensions,
        margin,
        color,
        seriesStyles,
        initialData,
    } = useChart()

    const {
        axisAssignments = new Map()
    } = props

    useEffect(
        () => {
            if (container) {
                if (mainG === undefined) {
                    const mainGElem = createPlotContainer(chartId, container, plotDimensions, color)
                    setMainGSelection(mainGElem)
                    updatePlot(continuousAxisRangeFor(0, 100), mainGElem)
                } else {
                    updatePlot(continuousAxisRangeFor(0, 100), mainG)
                }
            }
        },
        [chartId, color, container, mainG, plotDimensions, setMainGSelection]
    )

    /**
     * Attempts to locate the x- and y-axes for the specified series. If no axis is found for the
     * series name, then uses the default returned by the useChart() hook
     * @param seriesName
     */
    function axesFor(seriesName: string): [xAxis: LinearAxis, yAxis: LinearAxis] {
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

    /**
     * Updates the plot data for the specified time-range, which may have changed due to zoom or pan
     * @param timeRange The current time range
     * @param mainGElem The main <g> element selection for that holds the plot
     */
    function updatePlot(timeRange: ContinuousAxisRange, mainGElem: GSelection): void {
        if (container) {// && xAxisLinear && yAxisLinear) {
            // select the svg element bind the data to them
            const svg = d3.select<SVGSVGElement, any>(container)

            // create the tensor of data (time, value)
            const boundedSeries: Map<string, Array<[number, number]>> = new Map()
            initialData
                .forEach((series, name) => boundedSeries.set(name, selectInTimeRange(series, timeRange)))
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
            // const drag = d3.drag<SVGSVGElement, Datum>()
            //     .on("start", () => {
            //         // during a pan, we want to hide the tooltip
            //         tooltipRef.current.visible = false
            //         handleRemoveTooltip()
            //         d3.select(containerRef.current).style("cursor", "move")
            //     })
            //     .on("drag", () => onPan(d3.event.dx, plotDimensions))
            //     .on("end", () => {
            //         // if the tooltip was originally visible, then allow it to be seen again
            //         tooltipRef.current.visible = tooltipStyle.visible
            //         d3.select(containerRef.current).style("cursor", "auto")
            //     })
            //
            // svg.call(drag)
            //
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
                const [xAxisLinear, yAxisLinear] = axesFor(name)
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
    }

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

