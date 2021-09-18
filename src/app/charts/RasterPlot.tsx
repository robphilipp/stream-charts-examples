import {AxesAssignment, setClipPath} from "./plot";
import * as d3 from "d3";
import {ZoomTransform} from "d3";
import {noop} from "./utils";
import {useChart} from "./hooks/useChart";
import {useCallback, useEffect, useMemo, useRef} from "react";
import {Datum, emptySeries, PixelDatum, Series} from "./datumSeries";
import {ContinuousAxisRange, continuousAxisRangeFor} from "./continuousAxisRangeFor";
import {GSelection} from "./d3types";
import {
    axesForSeriesGen,
    BaseAxis,
    CategoryAxis,
    ContinuousNumericAxis,
    defaultLineStyle,
    panHandler,
    zoomHandler
} from "./axes";
import {Subscription} from "rxjs";
import {windowTime} from "rxjs/operators";
import {Dimensions} from "./margins";

interface Props {
    /**
     * Holds the mapping between a series and the axis it uses (is assigned). The
     * map's key holds the series name, and the value is an {@link AxesAssignment}
     * object holding the ID of the assigned x-axis and y-axis.
     */
    axisAssignments?: Map<string, AxesAssignment>
    /**
     * The number of milliseconds of data to hold in memory before dropping it. Defaults to
     * infinity (i.e. no data is dropped)
     */
    dropDataAfter?: number
    /**
     * Enables panning (default is false)
     */
    panEnabled?: boolean
    /**
     * Enables zooming (default is false)
     */
    zoomEnabled?: boolean
    /**
     * When true, requires that the shift or control key be pressed while scrolling
     * in order to activate the zoom
     */
    zoomKeyModifiersRequired?: boolean
}

export function RasterPlot(props: Props): null {
    const {
        chartId,
        container,
        mainG,
        xAxesState,
        yAxesState,
        setTimeRangeFor,
        plotDimensions,
        margin,
        color,
        seriesStyles,
        initialData,
        seriesFilter,

        seriesObservable,
        windowingTime = 100,
        shouldSubscribe,

        onSubscribe = noop,
        onUpdateData = noop,
        onUpdateTime = noop,

        mouseOverHandlerFor,
        mouseLeaveHandlerFor,
    } = useChart()

    const {
        axisAssignments = new Map<string, AxesAssignment>(),
        dropDataAfter = Infinity,
        panEnabled = false,
        zoomEnabled = false,
        zoomKeyModifiersRequired = true
    } = props

    // const liveDataRef = useRef<Map<string, Series>>(new Map(initialData.map(series => [series.name, series])))
    const dataRef = useRef<Array<Series>>(initialData.slice())
    const seriesRef = useRef<Map<string, Series>>(new Map(initialData.map(series => [series.name, series])))
    // map(axis_id -> current_time) -- maps the axis ID to the current time for that axis
    const currentTimeRef = useRef<Map<string, number>>(new Map())

    useEffect(
        () => {
            currentTimeRef.current = new Map(Array.from(xAxesState.axes.keys()).map(id => [id, 0]))
        },
        [xAxesState]
    )

    // calculates the distinct series IDs that cover all the series in the plot
    const axesForSeries = useMemo(
        (): Array<string> => axesForSeriesGen(initialData, axisAssignments, xAxesState)(),
        [initialData, axisAssignments, xAxesState]
    )

    /**
     * Calculates the upper and lower y-coordinate for the spike line
     * @param categorySize The size of the category (i.e. plot_height / num_series)
     * @param lineWidth The width of the series line
     * @param margin The margin applied to the top and bottom of the spike line (vertical spacing)
     * @return An object with two functions, that when handed a y-coordinate, return the location
     * for the start (yUpper) or end (yLower) of the spikes line.
     */
    function yCoordsFn(categorySize: number, lineWidth: number, margin: number):
        { yUpper: (y: number) => number, yLower: (y: number) => number } {
        if (categorySize <= margin) return {
            yUpper: y => y,
            yLower: y => y + lineWidth
        }
        return {
            yUpper: y => y + margin,
            yLower: y => y + categorySize - margin
        }
    }

    /**
     * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
     * @param deltaX The amount that the plot is dragged
     * @param plotDimensions The dimensions of the plot
     * @param series An array of series names
     * @param ranges A map holding the axis ID and its associated time range
     */
    const onPan = useCallback(
        (x: number,
         plotDimensions: Dimensions,
         series: Array<string>,
         ranges: Map<string, ContinuousAxisRange>
        ) => panHandler(axesForSeries, margin, setTimeRangeFor, xAxesState)(x, plotDimensions, series, ranges),
        [axesForSeries, margin, setTimeRangeFor, xAxesState]
    )

    /**
     * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
     * at the location of the mouse when the scroll wheel or gesture was applied.
     * @param transform The d3 zoom transformation information
     * @param x The x-position of the mouse when the scroll wheel or gesture is used
     * @param plotDimensions The dimensions of the plot
     * @param series An array of series names
     * @param ranges A map holding the axis ID and its associated time-range
     */
    const onZoom = useCallback(
        (
            transform: ZoomTransform,
            x: number,
            plotDimensions: Dimensions,
            series: Array<string>,
            ranges: Map<string, ContinuousAxisRange>,
        ) => zoomHandler(axesForSeries, margin, setTimeRangeFor, xAxesState)(transform, x, plotDimensions, series, ranges),
        [axesForSeries, margin, setTimeRangeFor, xAxesState]
    )

    /**
     * @param timeRanges
     * @param mainGElem
     */
    const updatePlot = useCallback(
        (timeRanges: Map<string, ContinuousAxisRange>, mainGElem: GSelection) => {
            if (container) {
                // select the svg element bind the data to them
                const svg = d3.select<SVGSVGElement, any>(container)

                // create a map associating series-names to their time-series
                const boundedSeries = dataRef.current.filter(series => series.name.match(seriesFilter))

                mainGElem
                    .selectAll<SVGGElement, Series>('g')
                    .data<Series>(boundedSeries)
                    .enter()
                    .append('g')
                    .attr('class', 'spikes-series')
                    .attr('id', series => `${series.name}-${chartId}-raster`)
                    .attr('transform', `translate(${margin.left}, ${margin.top})`);

                // set up panning
                if (panEnabled) {
                    const drag = d3.drag<SVGSVGElement, Datum>()
                        // .filter(event => event.shiftKey)
                        .on("start", () => {
                            // todo during a pan, we want to hide the tooltip
                            d3.select(container).style("cursor", "move")
                        })
                        .on("drag", event => {
                            const names = boundedSeries.map(series => series.name)
                            onPan(event.dx, plotDimensions, names, timeRanges)
                            // need to update the plot with the new time-ranges
                            updatePlotRef.current(timeRanges, mainGElem)
                        })
                        .on("end", () => {
                            // todo if the tooltip was originally visible, then allow it to be seen again
                            d3.select(container).style("cursor", "auto")
                        })

                    svg.call(drag)
                }

                // set up for zooming
                if (zoomEnabled) {
                    const zoom = d3.zoom<SVGSVGElement, Datum>()
                        .filter(event => !zoomKeyModifiersRequired || event.shiftKey || event.ctrlKey)
                        .scaleExtent([0, 10])
                        .translateExtent([[margin.left, margin.top], [plotDimensions.width, plotDimensions.height]])
                        .on("zoom", event => {
                                onZoom(
                                    event.transform,
                                    event.sourceEvent.offsetX - margin.left,
                                    plotDimensions,
                                    boundedSeries.map(series => series.name),
                                    timeRanges,
                                )
                                updatePlotRef.current(timeRanges, mainGElem)
                            }
                        )

                    svg.call(zoom)
                }

                // define the clip-path so that the series lines don't go beyond the plot area
                const clipPathId = setClipPath(chartId, svg, plotDimensions, margin)

                boundedSeries.forEach(series => {
                    const [xAxis, yAxis] = axesFor(series.name, axisAssignments, xAxesState.axisFor, yAxesState.axisFor)

                    // grab the series styles, or the defaults if none exist
                    const {color, lineWidth, margin = 5} = seriesStyles.get(series.name) || {
                        ...defaultLineStyle,
                        highlightColor: defaultLineStyle.color
                    }

                    // only show the data for which the filter matches
                    const plotData = (series.name.match(seriesFilter)) ? series.data : []

                    // const seriesContainer = mainGElem
                    const seriesContainer = svg
                        .select<SVGGElement>(`#${series.name}-${chartId}-raster`)
                        .selectAll<SVGLineElement, PixelDatum>('line')
                        // .data(plotData as PixelDatum[])
                        .data(plotData.filter(datum => {
                            const range = timeRanges.get(xAxis.axisId)
                            return range === undefined ? true : datum.time >= range.start && datum.time <= range.end
                        }) as PixelDatum[])
                    // .data(series.data.filter(datum => datum.time >= timeRangeRef.current.start && datum.time <= timeRangeRef.current.end) as PixelDatum[])

                    //
                    // enter new elements
                    const {yUpper, yLower} = yCoordsFn(yAxis.categorySize, lineWidth, margin)

                    // grab the value (index) associated with the series name (this is a category axis)
                    const y = yAxis.scale(series.name) || 0
                    // enter
                    seriesContainer
                        .enter()
                        .append<SVGLineElement>('line')
                        .each(datum => {
                            datum.x = xAxis.scale(datum.time)
                        })
                        .attr('class', 'spikes-lines')
                        .attr('x1', datum => datum.x)
                        .attr('x2', datum => datum.x)
                        .attr('y1', _ => yUpper(y))
                        .attr('y2', _ => yLower(y))
                        .attr('stroke', color)
                        .attr('stroke-width', lineWidth)
                        .attr('stroke-linecap', "round")
                        .attr("clip-path", `url(#${clipPathId})`)
                    // even though the tooltip may not be set to show up on the mouseover, we want to attach the handler
                    // so that when the use enables tooltips the handlers will show the the tooltip
                    // .on("mouseover", (datum, i, group) => handleShowTooltip(datum, series.name, group[i]))
                    // .on("mouseleave", (datum, i, group) => handleHideTooltip(datum, series.name, group[i]))

                    // update
                    seriesContainer
                        // .filter(datum => datum.time >= timeRangeRef.current.start)
                        .each(datum => {
                            datum.x = xAxis.scale(datum.time)
                        })
                        .attr('x1', datum => datum.x)
                        .attr('x2', datum => datum.x)
                        .attr('y1', _ => yUpper(y))
                        .attr('y2', _ => yLower(y))
                        .attr('stroke', color)
                    // // .on("mouseover", (datum, i, group) => handleShowTooltip(datum, series.name, group[i]))
                    // // .on("mouseleave", (datum, i, group) => handleHideTooltip(datum, series.name, group[i]))


                    // exit old elements
                    seriesContainer.exit().remove()
                })
            }
        },
        [axisAssignments, chartId, container, margin, plotDimensions, seriesFilter, seriesStyles, xAxesState.axisFor, yAxesState.axisFor]
    )

    // need to keep the function references for use by the subscription, which forms a closure
    // on them. without the references, the closures become stale, and resizing during streaming
    // doesn't work properly
    const updatePlotRef = useRef(updatePlot)
    useEffect(
        () => {
            updatePlotRef.current = updatePlot
        },
        [updatePlot]
    )
    const onUpdateTimeRef = useRef(onUpdateTime)
    useEffect(
        () => {
            onUpdateTimeRef.current = onUpdateTime
        },
        [onUpdateTime]
    )

    // updates the timing using the onUpdateTime and updatePlot references. This and the references
    // defined above allow the axes' times to be update properly by avoid stale reference to these
    // functions.
    const updateTimingAndPlot = useCallback(
        /**
         * Updates the time and plot with the new time-ranges
         * @param ranges The new time-ranges
         */
        (ranges: Map<string, ContinuousAxisRange>): void => {
            if (mainG !== null) {
                onUpdateTimeRef.current(ranges)
                updatePlotRef.current(ranges, mainG)
            }
        },
        [mainG]
    )

    const subscribe = useCallback(
        () => {
            if (seriesObservable === undefined || mainG === null) return undefined

            const subscription = seriesObservable
                .pipe(windowTime(windowingTime))
                .subscribe(async dataList => {
                    await dataList.forEach(data => {
                        // grab the time-winds for the x-axes
                        const timesWindows = timeRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)

                        // calculate the max times for each x-axis, which is the max time over all the
                        // series assigned to an x-axis
                        const axesSeries = Array.from(data.maxTimes.entries())
                            .reduce(
                                (assignedSeries, [seriesName,]) => {
                                    const id = axisAssignments.get(seriesName)?.xAxis || xAxesState.axisDefaultName()
                                    const as = assignedSeries.get(id) || []
                                    as.push(seriesName)
                                    assignedSeries.set(id, as)
                                    return assignedSeries
                                },
                                new Map<string, Array<string>>()
                            )

                        // add each new point to it's corresponding series, the new points
                        // is a map(series_name -> new_point[])
                        data.newPoints.forEach((newData, name) => {
                            // grab the current series associated with the new data
                            const series = seriesRef.current.get(name) || emptySeries(name);

                            // update the handler with the new data point
                            onUpdateData(name, newData);

                            // add the new data to the series
                            series.data.push(...newData);

                            const axisId = axisAssignments.get(name)?.xAxis || xAxesState.axisDefaultName()
                            const currentAxisTime = axesSeries.get(axisId)
                                ?.reduce(
                                    (tMax, seriesName) => Math.max(data.maxTimes.get(seriesName) || data.maxTime, tMax),
                                    -Infinity
                                ) || data.maxTime
                            if (currentAxisTime !== undefined) {
                                // drop data that is older than the max time-window
                                while (currentAxisTime - series.data[0].time > dropDataAfter) {
                                    series.data.shift()
                                }

                                const range = timesWindows.get(axisId)
                                if (range !== undefined && range.end < currentAxisTime) {
                                    const timeWindow = range.end - range.start
                                    const timeRange = continuousAxisRangeFor(
                                        Math.max(0, currentAxisTime - timeWindow),
                                        Math.max(currentAxisTime, timeWindow)
                                    )
                                    timesWindows.set(axisId, timeRange)
                                    currentTimeRef.current.set(axisId, timeRange.end)
                                }
                            }
                        })

                        // update the data
                        updateTimingAndPlot(timesWindows)
                    })
                })

            // provide the subscription to the caller
            onSubscribe(subscription)

            return subscription
        },
        [
            axisAssignments, dropDataAfter, mainG,
            onSubscribe, onUpdateData,
            seriesObservable, updateTimingAndPlot, windowingTime, xAxesState
        ]
    )

    const timeRangesRef = useRef<Map<string, ContinuousAxisRange>>(new Map())
    useEffect(
        () => {
            if (container && mainG) {
                // so this gets a bit complicated. the time-ranges need to be updated whenever the time-ranges
                // change. for example, as data is streamed in, the times change, and then we need to update the
                // time-range. however, we want to keep the time-ranges to reflect their original scale so that
                // we can zoom properly (so the updates can't fuck with the scale). At the same time, when the
                // interpolation changes, then the update plot changes, and the time-ranges must maintain their
                // original scale as well.
                // const ranges = timeRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)
                if (timeRangesRef.current.size === 0) {
                    // when no time-ranges have yet been created, then create them and hold on to a mutable
                    // reference to them
                    timeRangesRef.current = timeRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)
                } else {
                    // when the time-ranges already exist, then we want to update the time-ranges for each
                    // existing time-range in a way that maintains the original scale.
                    const intervals = timeIntervals(xAxesState.axes as Map<string, ContinuousNumericAxis>)
                    timeRangesRef.current
                        .forEach((range, id, rangesMap) => {
                            const [start, end] = intervals.get(id) || [NaN, NaN]
                            if (!isNaN(start) && !isNaN(end)) {
                                // update the reference map with the new (start, end) portion of the range,
                                // while keeping the original scale intact
                                rangesMap.set(id, range.update(start, end))
                            }
                        })
                }
                updatePlot(timeRangesRef.current, mainG)
            }
        },
        [chartId, color, container, mainG, plotDimensions, updatePlot, xAxesState]
    )

    // subscribe/unsubscribe to the observable chart data. when the `shouldSubscribe`
    // is changed to `true` and we haven't subscribed yet, then subscribe. when the
    // `shouldSubscribe` is `false` and we had subscribed, then unsubscribe. otherwise,
    // do nothing.
    const subscriptionRef = useRef<Subscription>()
    useEffect(
        () => {
            if (shouldSubscribe && subscriptionRef.current === undefined) {
                subscriptionRef.current = subscribe()
            } else if (!shouldSubscribe && subscriptionRef.current !== undefined) {
                subscriptionRef.current?.unsubscribe()
                subscriptionRef.current = undefined
            }
        },
        [shouldSubscribe, subscribe]
    )

    return null
}

/**
 * Calculates the time-ranges for each of the axes in the map
 * @param xAxes The map containing the axes and their associated IDs
 * @return a map associating the axis IDs to their time-range
 */
function timeRanges(xAxes: Map<string, ContinuousNumericAxis>): Map<string, ContinuousAxisRange> {
    return new Map(Array.from(xAxes.entries())
        .map(([id, axis]) => {
            const [start, end] = axis.scale.domain()
            return [id, continuousAxisRangeFor(start, end)]
        }))
}

/**
 * Calculates the time-intervals (start, end) for each of the x-axis
 * @param xAxes The x-axes representing the time
 * @return A map associating each x-axis with a (start, end) interval
 */
function timeIntervals(xAxes: Map<string, ContinuousNumericAxis>): Map<string, [start: number, end: number]> {
    return new Map(Array.from(xAxes.entries())
        .map(([id, axis]) => [id, axis.scale.domain()] as [string, [number, number]]))
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
): [xAxis: ContinuousNumericAxis, yAxis: CategoryAxis] {
    const axes = axisAssignments.get(seriesName)
    const xAxis = xAxisFor(axes?.xAxis || "")
    const xAxisLinear = xAxis as ContinuousNumericAxis
    const yAxis = yAxisFor(axes?.yAxis || "")
    const yAxisCategory = yAxis as CategoryAxis
    if (xAxis && !xAxisLinear) {
        throw Error("Scatter plot requires that x-axis be of type LinearAxis")
    }
    if (yAxis && !yAxisCategory) {
        throw Error("Scatter plot requires that y-axis be of type LinearAxis")
    }
    return [xAxisLinear, yAxisCategory]
}
