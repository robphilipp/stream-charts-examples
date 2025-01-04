import {AxesAssignment, Series, setClipPath} from "./plot";
import * as d3 from "d3";
import {noop} from "../utils";
import {useChart} from "../hooks/useChart";
import React, {useCallback, useEffect, useRef} from "react";
import {Datum, TimeSeries} from "../series/timeSeries";
import {GSelection} from "../d3types";
import {BaseAxis, CategoryAxis, ContinuousNumericAxis, defaultLineStyle, SeriesLineStyle} from "../axes/axes";
import {Subscription} from "rxjs";
import {Margin} from "../styling/margins";
import {subscriptionOrdinalXFor, WindowedOrdinalStats} from "../subscriptions/subscriptions";
import {useDataObservable} from "../hooks/useDataObservable";
import {usePlotDimensions} from "../hooks/usePlotDimensions";
import {useInitialData} from "../hooks/useInitialData";
import {copyValueStatsForSeries, OrdinalChartData, OrdinalStats} from "../observables/ordinals";
import {BaseSeries} from "../series/baseSeries";
import {calculateOrdinalStats, OrdinalDatum, OrdinalSeries} from "../series/ordinalSeries";
import {applyFillStylesTo, applyStrokeStylesTo, SvgFillStyle, SvgStrokeStyle} from "../styling/svgStyle";

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
    /**
     * When set, uses a cadence with the specified refresh period (in milliseconds). For plots
     * where the updates are slow (> 100 ms) using a cadence of 10 to 25 ms smooths out the
     * updates and makes the plot updates look cleaner. When updates are around 25 ms or less,
     * then setting the cadence period too small will result in poor update performance. Generally
     * at high update speeds, the cadence is unnecessary. Finally, using cadence, sets the max time
     * to the current time.
     */
    withCadenceOf?: number
    /**
     * The (optional, default = 2 pixels) top and bottom margin (in pixels) for the spike lines in the plot.
     * Margins on individual series can also be set through the {@link Chart.seriesStyles} property.
     */
    barMargin?: number
    /**
     * The (optional, default = 'green') color of the mean line.
     */
    meanLineColor?: string
    /**
     * The (optional, default = 0.5) opacity of the mean line.
     */
    meanLineOpacity?: number
    /**
     * The (optional, default = 1) width of the mean line.
     */
    meanLineWidth?: number
}

export interface BarPlotStyles {

}

/**
 * Renders a streaming neuron bar plot for the series in the initial data and those sourced by the
 * observable specified as a property in the {@link Chart}. This component uses the {@link useChart}
 * hook, and therefore must be a child of the {@link Chart} in order to be plugged in to the
 * chart ecosystem (axes, tracker, tooltip).
 *
 * @param props The properties associated with the bar plot
 * @constructor
 * @example
 <BarPlot
 axisAssignments={new Map([
 ['neuron1', assignAxes("x-axis-2", "y-axis-2")],
 ['neuron2', assignAxes("x-axis-2", "y-axis-2")],
 ])}
 spikeMargin={1}
 dropDataAfter={5000}
 panEnabled={true}
 zoomEnabled={true}
 zoomKeyModifiersRequired={true}
 />
 */
export function BarPlot(props: Props): null {
    const {
        chartId,
        container,
        mainG,
        axes,
        color,
        seriesStyles,
        seriesFilter,
        mouse
    } = useChart()

    const {
        xAxesState,
        yAxesState,
        setAxisAssignments,
        // setAxisBoundsFor,
        // updateAxesBounds = noop,
        // onUpdateAxesBounds,
    } = axes

    const {mouseOverHandlerFor, mouseLeaveHandlerFor} = mouse

    const {plotDimensions, margin} = usePlotDimensions()

    const {
        seriesObservable,
        windowingTime = 100,
        shouldSubscribe,

        onSubscribe = noop,
        onUpdateData,
    } = useDataObservable<OrdinalChartData, OrdinalDatum>()

    const {initialData} = useInitialData<OrdinalChartData, OrdinalDatum>()

    const {
        axisAssignments = new Map<string, AxesAssignment>(),
        dropDataAfter = Infinity,
        // panEnabled = false,
        // zoomEnabled = false,
        // zoomKeyModifiersRequired = true,
        meanLineColor = 'green',
        meanLineOpacity = 0.5,
        meanLineWidth = 1,
        barMargin = 2,
    } = props

    // some 'splainin: the dataRef holds on to a copy of the initial data, but, the Series in the array
    // are by reference, so the seriesRef, also holds on to the same Series. When the Series in seriesRef
    // get appended with new data, it's updating the underlying series, and so the dataRef sees those
    // changes as well. The dataRef is used for performance, so that in the updatePlot function we don't
    // need to create a temporary array to holds the series data, rather, we can just use the one held in
    // the dataRef.
    const dataRef = useRef<Array<BaseSeries<OrdinalDatum>>>(initialData.slice())
    const seriesRef = useRef<Map<string, BaseSeries<OrdinalDatum>>>(
        new Map(initialData.map(series => [series.name, series]))
    )
    const statsRef = useRef<WindowedOrdinalStats>(initialOrdinalStats(dataRef.current))

    // map(axis_id -> current_time) -- maps the axis ID to the current time for that axis
    const currentTimeRef = useRef<number>(0)

    const subscriptionRef = useRef<Subscription>()

    const isSubscriptionClosed = () => subscriptionRef.current === undefined || subscriptionRef.current.closed

    const allowTooltipRef = useRef<boolean>(isSubscriptionClosed())

    useEffect(
        () => {
            currentTimeRef.current = 0
            // currentTimeRef.current = new Map(Array.from(xAxesState.axes.keys()).map(id => [id, 0]))
        },
        [xAxesState]
    )

    // set the axis assignments needed if a tooltip is being used
    useEffect(
        () => {
            setAxisAssignments(axisAssignments)
        },
        [axisAssignments, setAxisAssignments]
    )

    // // calculates the distinct series IDs that cover all the series in the plot
    // const axesForSeries = useMemo(
    //     () => axesForSeriesGen<Datum>(initialData, axisAssignments, xAxesState),
    //     [initialData, axisAssignments, xAxesState]
    // )

    // updates the timing using the onUpdateTime and updatePlot references. This and the references
    // defined above allow the axes' times to be updated properly by avoid stale reference to these
    // functions.
    const updateTimingAndPlot = useCallback(
        // (ranges: Map<string, ContinuousAxisRange>): void => {
        (): void => {
            if (mainG !== null) {
                // onUpdateTimeRef.current(ranges)
                updatePlotRef.current(mainG)
                // updatePlotRef.current(ranges, mainG)
                // if (onUpdateAxesBounds) {
                //     setTimeout(() => {
                //         const times = new Map<string, [number, number]>()
                //         ranges.forEach((range, name) => times.set(name, [range.start, range.end]))
                //         onUpdateAxesBounds(times)
                //     }, 0)
                // }
            }
        },
        [mainG]
        // [mainG, onUpdateAxesBounds]
    )

    // todo find better way
    // when the initial data changes, then reset the plot. note that the initial data doesn't change
    // during the normal course of updates from the observable, only when the plot is restarted.
    useEffect(
        () => {
            dataRef.current = initialData.slice()
            seriesRef.current = new Map(initialData.map(series => [series.name, series]))
            currentTimeRef.current = 0
            // currentTimeRef.current = new Map(Array.from(xAxesState.axes.keys()).map(id => [id, 0]))
            updateTimingAndPlot()
            // updateTimingAndPlot(new Map(Array.from(continuousAxisRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>).entries())
            //         .map(([id, range]) => {
            //             // grab the current range, then calculate the minimum time from the initial data, and
            //             // set that as the start, and then add the range to it for the end time
            //             const [start, end] = range.original
            //             const minTime = (initialData as Array<TimeSeries>)
            //                 .filter(srs => axisAssignments.get(srs.name)?.xAxis === id)
            //                 .reduce(
            //                     (tMin: number, series: TimeSeries) => Math.min(
            //                         tMin,
            //                         !series.isEmpty() ? series.data[0].time : tMin
            //                     ),
            //                     Infinity
            //                 )
            //             const startTime = minTime === Infinity ? 0 : minTime
            //             return [id, continuousAxisRangeFor(startTime, startTime + end - start)]
            //         })
            //     )
            // )
        },
        // ** not happy about this **
        // only want this effect to run when the initial data is changed, which mean all the
        // other dependencies are recalculated anyway.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [initialData]
    )

    // /**
    //  * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
    //  * @param deltaX The amount that the plot is dragged
    //  * @param plotDimensions The dimensions of the plot
    //  * @param series An array of series names
    //  * @param ranges A map holding the axis ID and its associated time range
    //  */
    // const onPan = useCallback(
    //     (x: number,
    //      plotDimensions: Dimensions,
    //      series: Array<string>,
    //      ranges: Map<string, ContinuousAxisRange>
    //     ) => panHandler(axesForSeries, margin, setAxisBoundsFor, xAxesState)(x, plotDimensions, series, ranges),
    //     [axesForSeries, margin, setAxisBoundsFor, xAxesState]
    // )
    //
    // /**
    //  * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
    //  * at the location of the mouse when the scroll wheel or gesture was applied.
    //  * @param transform The d3 zoom transformation information
    //  * @param x The x-position of the mouse when the scroll wheel or gesture is used
    //  * @param plotDimensions The dimensions of the plot
    //  * @param series An array of series names
    //  * @param ranges A map holding the axis ID and its associated time-range
    //  */
    // const onZoom = useCallback(
    //     (
    //         transform: ZoomTransform,
    //         x: number,
    //         plotDimensions: Dimensions,
    //         ranges: Map<string, ContinuousAxisRange>,
    //     ) => axisZoomHandler(axesForSeries, margin, setAxisBoundsFor, xAxesState)(transform, x, plotDimensions, ranges),
    //     [axesForSeries, margin, setAxisBoundsFor, xAxesState]
    // )

    /**
     * @param timeRanges
     * @param mainGElem
     */
    const updatePlot = useCallback(
        // (timeRanges: Map<string, ContinuousAxisRange>, mainGElem: GSelection) => {
        (mainGElem: GSelection) => {
            if (container) {
                // select the svg element bind the data to them
                const svg = d3.select<SVGSVGElement, any>(container)

                // // set up panning
                // if (panEnabled) {
                //     const drag = d3.drag<SVGSVGElement, Datum>()
                //         .on("start", () => {
                //             d3.select(container).style("cursor", "move")
                //             allowTooltipRef.current = false
                //         })
                //         .on("drag", (event: any) => {
                //             const names = dataRef.current.map(series => series.name)
                //             onPan(event.dx, plotDimensions, names, timeRanges)
                //             // need to update the plot with the new time-ranges
                //             updatePlotRef.current(timeRanges, mainGElem)
                //         })
                //         .on("end", () => {
                //             d3.select(container).style("cursor", "auto")
                //             allowTooltipRef.current = isSubscriptionClosed()
                //         })
                //
                //     svg.call(drag)
                // }
                //
                // // set up for zooming
                // if (zoomEnabled) {
                //     const zoom = d3.zoom<SVGSVGElement, Datum>()
                //         .filter((event: any) => !zoomKeyModifiersRequired || event.shiftKey || event.ctrlKey)
                //         .scaleExtent([0, 10])
                //         .translateExtent([[margin.left, margin.top], [plotDimensions.width, plotDimensions.height]])
                //         .on("zoom", (event: any) => {
                //                 onZoom(
                //                     event.transform,
                //                     event.sourceEvent.offsetX - margin.left,
                //                     plotDimensions,
                //                     timeRanges,
                //                 )
                //                 updatePlotRef.current(timeRanges, mainGElem)
                //             }
                //         )
                //
                //     svg.call(zoom)
                // }

                // enter, update, delete the bar data
                dataRef.current.forEach(series => {
                    const [xAxis, yAxis] = axesFor(series.name, axisAssignments, xAxesState.axisFor, yAxesState.axisFor)

                    // grab the series styles, or the defaults if none exist
                    const {color, lineWidth, margin: categoryMargin = barMargin} = seriesStyles.get(series.name) || {
                        ...defaultCurrentValueStyle(),
                        highlightColor: defaultCurrentValueStyle().color
                    }

                    type PlotData = {
                        data: OrdinalDatum,
                        stats: OrdinalStats,
                    }

                    // only show the data for which the regex filter matches
                    const plotData = (series.name.match(seriesFilter)) ? [series.data[series.data.length - 1]] : []

                    // grab the functions for determining the lower and upper bounds of the category
                    const {lower, upper} = xAxisCategoryBoundsFn(xAxis.categorySize, lineWidth, categoryMargin)

                    // grab the value (index) associated with the series name (this is a category axis)
                    const x = xAxis.scale(series.name) || 0

                    //
                    // value lines
                    svg
                        .select<SVGGElement>(`#${series.name}-${chartId}-bar`)
                        .selectAll<SVGLineElement, PlotData>('.stream-charts-bar-value-lines')
                        .data(plotData)
                        .join(
                            enter => {
                                const selection = enter
                                    .append<SVGLineElement>('line')
                                    .attr('class', 'stream-charts-bar-value-lines')
                                    .attr('x1', _ => lower(x))
                                    .attr('x2', _ => upper(x))
                                    .attr('y1', datum => yAxis.scale(datum.value))
                                    .attr('y2', datum => yAxis.scale(datum.value))
                                    // .style('stroke', color)
                                    // .style('stroke-width', lineWidth)
                                return applyStrokeStylesTo(selection, {color, width: lineWidth})
                            },
                            update => {
                                const selection = update
                                    .attr('x1', _ => lower(x))
                                    .attr('x2', _ => upper(x))
                                    .attr('y1', datum => yAxis.scale(datum.value))
                                    .attr('y2', datum => yAxis.scale(datum.value))

                                return applyStrokeStylesTo(selection, {color, width: lineWidth})
                                // .style('stroke', color)
                                // .style('stroke-width', lineWidth)
                            },
                            exit => exit.remove()
                        )
                        .on(
                            "mouseover",
                            (event, datumArray) =>
                                handleMouseOverBar(
                                    container,
                                    yAxis,
                                    series.name,
                                    [datumArray.time, datumArray.value],
                                    event,
                                    margin,
                                    seriesStyles,
                                    allowTooltipRef.current,
                                    mouseOverHandlerFor(`tooltip-${chartId}`)
                                )
                        )
                        .on(
                            "mouseleave",
                            event => handleMouseLeaveSeries(
                                series.name,
                                event.currentTarget,
                                seriesStyles,
                                mouseLeaveHandlerFor(`tooltip-${chartId}`)
                            )
                        )

                    //
                    // windowed-mean line when the windowed status are defined for the series
                    const seriesWindowedStats = statsRef.current.windowedValueStatsForSeries.get(series.name)
                    if (seriesWindowedStats !== undefined) {
                        const windowedMeanLineY = yAxis.scale(isNaN(seriesWindowedStats.mean) ? 0 : seriesWindowedStats.mean)
                        svg
                            .select<SVGGElement>(`#${series.name}-${chartId}-bar`)
                            .selectAll<SVGLineElement, PlotData>('.stream-charts-bar-windowed-mean-lines')
                            .data(plotData)
                            .join(
                                enter => {
                                    const selection = enter
                                        .append<SVGLineElement>('line')
                                        .attr('class', 'stream-charts-bar-windowed-mean-lines')
                                        .attr('x1', _ => lower(x))
                                        .attr('x2', _ => upper(x))
                                        .attr('y1', () => windowedMeanLineY)
                                        .attr('y2', () => windowedMeanLineY)
                                        // .style('stroke', meanLineColor)
                                        // .style('stroke-opacity', meanLineOpacity)
                                        // .style('stroke-width', meanLineWidth)
                                    return applyStrokeStylesTo(selection, {color: meanLineColor, width: meanLineWidth, opacity: meanLineOpacity})
                                },
                                update => {
                                    const selection = update
                                        .attr('x1', _ => lower(x))
                                        .attr('x2', _ => upper(x))
                                        .attr('y1', () => windowedMeanLineY)
                                        .attr('y2', () => windowedMeanLineY)
                                        // .style('stroke', 'red')
                                        // .style('stroke-opacity', meanLineOpacity)
                                        // .style('stroke-width', meanLineWidth)
                                    return applyStrokeStylesTo(selection, {color: 'red', width: meanLineWidth, opacity: meanLineOpacity})
                                },
                                exit => exit.remove()
                            )

                        const windowedBar = barDimensions(
                            0.2,
                            lower(x), upper(x),
                            seriesWindowedStats.min.value, seriesWindowedStats.max.value,
                            yAxis
                        )

                        // todo these should come from the props (series styles for bars, see where the "color" is set)
                        const windowedBarColor = d3.color(color)?.darker(0.3).toString() ?? color
                        const windowedBarStrokeStyle: Partial<SvgStrokeStyle> = {}
                        const windowedBarFillStyle: Partial<SvgFillStyle> = {color: windowedBarColor, opacity: 0.6}
                        svg
                            .select<SVGGElement>(`#${series.name}-${chartId}-bar`)
                            .selectAll<SVGRectElement, PlotData>('.stream-charts-bar-windowed-min-max')
                            .data(plotData)
                            .join(
                                enter => barFor(
                                    enter.append<SVGRectElement>('rect').attr('class', 'stream-charts-bar-windowed-min-max'),
                                    windowedBar,
                                    windowedBarStrokeStyle,
                                    windowedBarFillStyle
                                ),
                                update => barFor(update, windowedBar, windowedBarStrokeStyle, windowedBarFillStyle),
                                exit => exit.remove()
                            )
                    }

                    //
                    // mean line
                    const meanLineY = yAxis.scale(statsRef.current.valueStatsForSeries.get(series.name)?.mean || 0)
                    svg
                        .select<SVGGElement>(`#${series.name}-${chartId}-bar`)
                        .selectAll<SVGLineElement, PlotData>('.stream-charts-bar-mean-lines')
                        .data(plotData)
                        .join(
                            enter => {
                                const selection = enter
                                    .append<SVGLineElement>('line')
                                    .attr('class', 'stream-charts-bar-mean-lines')
                                    .attr('x1', _ => lower(x))
                                    .attr('x2', _ => upper(x))
                                    .attr('y1', () => meanLineY)
                                    .attr('y2', () => meanLineY)
                                return applyStrokeStylesTo(selection, {color: meanLineColor, opacity: meanLineOpacity, width: meanLineWidth})
                            },
                            update => {
                                const selection = update
                                    .attr('x1', _ => lower(x))
                                    .attr('x2', _ => upper(x))
                                    .attr('y1', () => meanLineY)
                                    .attr('y2', () => meanLineY)
                                return applyStrokeStylesTo(selection, {color: meanLineColor, opacity: meanLineOpacity, width: meanLineWidth})
                            },
                            exit => exit.remove()
                        )

                    //
                    // min/max bar rectangle
                    const totalBar = barDimensions(
                        0.75,
                        lower(x), upper(x),
                        statsRef.current.valueStatsForSeries.get(series.name)?.min.value || 0,
                        statsRef.current.valueStatsForSeries.get(series.name)?.max.value || 0,
                        yAxis
                    )

                    // todo these should come from the props (series styles for bars, see where the "color" is set)
                    const totalsBarStrokeStyle: Partial<SvgStrokeStyle> = {color, opacity: 0.6, width: 1}
                    const totalsBarFillStyle: Partial<SvgFillStyle> = {color, opacity: 0.4}
                    svg
                        .select<SVGGElement>(`#${series.name}-${chartId}-bar`)
                        .selectAll<SVGRectElement, PlotData>('.stream-charts-bar-min-max')
                        .data(plotData)
                        .join(
                            enter => barFor(
                                enter.append<SVGRectElement>('rect').attr('class', 'stream-charts-bar-min-max'),
                                totalBar,
                                totalsBarStrokeStyle,
                                totalsBarFillStyle
                            ),
                            update => barFor(update, totalBar, totalsBarStrokeStyle, totalsBarFillStyle),
                            exit => exit.remove()
                        )
                })
            }
        },
        [
            container,
            axisAssignments, xAxesState.axisFor, yAxesState.axisFor,
            barMargin, seriesStyles,
            seriesFilter,
            chartId,
            margin,
            mouseOverHandlerFor, mouseLeaveHandlerFor,
            meanLineColor, meanLineOpacity, meanLineWidth
        ]
    )

    // need to keep the function references for use by the subscription, which forms a closure
    // on them. without the references, the closures become stale, and resizing during streaming
    // doesn't work properly
    // const updatePlotRef = useRef<(r: Map<string, ContinuousAxisRange>, g: GSelection) => void>(noop)
    const updatePlotRef = useRef<(g: GSelection) => void>(noop)
    useEffect(
        () => {
            if (mainG !== null && container !== null) {
                // when the update plot function doesn't yet exist, then create the container holding the plot
                const svg = d3.select<SVGSVGElement, any>(container)
                const clipPathId = setClipPath(chartId, svg, plotDimensions, margin)
                if (updatePlotRef.current === noop) {
                    mainG
                        .selectAll<SVGGElement, TimeSeries>('g')
                        .attr("clip-path", `url(#${clipPathId})`)
                        .data<TimeSeries>(dataRef.current)
                        .enter()
                        .append('g')
                        .attr('class', 'spikes-series')
                        .attr('id', series => `${series.name}-${chartId}-bar`)
                        .attr('transform', `translate(${margin.left}, ${margin.top})`)

                } else {
                    mainG
                        .selectAll<SVGGElement, TimeSeries>('g')
                        .attr("clip-path", `url(#${clipPathId})`)
                }
                updatePlotRef.current = updatePlot
            }
        },
        [chartId, container, mainG, margin, plotDimensions, updatePlot]
    )

    // // grab a reference to the function used to update the time ranges and update that reference
    // // if the function changes (solve for stale closures)
    // const onUpdateTimeRef = useRef(updateAxesBounds)
    // useEffect(
    //     () => {
    //         onUpdateTimeRef.current = updateAxesBounds
    //     },
    //     [updateAxesBounds]
    // )

    // memoized function for subscribing to the chart-data observable
    const subscribe = useCallback(
        () => {
            if (seriesObservable === undefined || mainG === null) return undefined
            return subscriptionOrdinalXFor(
                seriesObservable,
                onSubscribe,
                windowingTime,
                axisAssignments,
                yAxesState,
                onUpdateData,
                dropDataAfter,
                updateTimingAndPlot,
                // as new data flows into the subscription, the subscription
                // updates this map directly (for performance)
                seriesRef.current,
                statsRef,
                (currentTime: number) => currentTimeRef.current = currentTime
            )
        },
        [
            axisAssignments, dropDataAfter, mainG,
            onSubscribe, onUpdateData,
            seriesObservable, updateTimingAndPlot, windowingTime, yAxesState,
        ]
    )

    // const timeRangesRef = useRef<Map<string, ContinuousAxisRange>>(new Map())
    useEffect(
        () => {
            if (container && mainG) {
                // // so this gets a bit complicated. the time-ranges need to be updated whenever the time-ranges
                // // change. for example, as data is streamed in, the times change, and then we need to update the
                // // time-range. however, we want to keep the time-ranges to reflect their original scale so that
                // // we can zoom properly (so the updates can't fuck with the scale). At the same time, when the
                // // interpolation changes, then the update plot changes, and the time-ranges must maintain their
                // // original scale as well.
                // if (timeRangesRef.current.size === 0) {
                //     // when no time-ranges have yet been created, then create them and hold on to a mutable
                //     // reference to them
                //     timeRangesRef.current = continuousAxisRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)
                // } else {
                //     // when the time-ranges already exist, then we want to update the time-ranges for each
                //     // existing time-range in a way that maintains the original scale.
                //     const intervals = continuousAxisIntervals(xAxesState.axes as Map<string, ContinuousNumericAxis>)
                //     timeRangesRef.current
                //         .forEach((range, id, rangesMap) => {
                //             const [start, end] = intervals.get(id) || [NaN, NaN]
                //             if (!isNaN(start) && !isNaN(end)) {
                //                 // update the reference map with the new (start, end) portion of the range,
                //                 // while keeping the original scale intact
                //                 rangesMap.set(id, range.update(start, end))
                //             }
                //         })
                // }
                updatePlot(mainG)
                // updatePlot(timeRangesRef.current, mainG)
            }
        },
        [chartId, color, container, mainG, plotDimensions, updatePlot, xAxesState]
    )

    // subscribe/unsubscribe to the observable chart data. when the `shouldSubscribe`
    // is changed to `true` and we haven't subscribed yet, then subscribe. when the
    // `shouldSubscribe` is `false` and we had subscribed, then unsubscribe. otherwise,
    // do nothing.
    useEffect(
        () => {
            if (shouldSubscribe && subscriptionRef.current === undefined) {
                subscriptionRef.current = subscribe()
                allowTooltipRef.current = false
            } else if (!shouldSubscribe && subscriptionRef.current !== undefined) {
                subscriptionRef.current?.unsubscribe()
                subscriptionRef.current = undefined
                allowTooltipRef.current = true
            }
        },
        [shouldSubscribe, subscribe]
    )

    return null
}

/*
    Helper functions and types
 */

type BarDimensions = {
    upperX: number
    upperY: number
    width: number
    height: number
}

/**
 * Sets the attributes for the bar based on the d3 selection
 * @param selection The d3 selection (rect SVG element)
 * @param dimensions The bar dimensions
 * @param strokeStyle The stroke style
 * @param fillStyle The fill style
 * @return The updated SVG selection (rect SVG element)
 */
function barFor(
    selection: d3.Selection<SVGRectElement, OrdinalDatum, SVGGElement, any>,
    dimensions: BarDimensions,
    strokeStyle: Partial<SvgStrokeStyle>,
    fillStyle: Partial<SvgFillStyle>
):  d3.Selection<SVGRectElement, OrdinalDatum, SVGGElement, any> {
    selection
        .attr('x', () => dimensions.upperX)
        .attr('y', () => dimensions.upperY)
        .attr('width', () => dimensions.width)
        .attr('height', () => dimensions.height)
    applyFillStylesTo(selection, fillStyle)
    return applyStrokeStylesTo(selection, strokeStyle)
}


/**
 * Calculates the upper (x, y) coordinates of the bar, and the width and height of the bar
 * @param widthFraction The fraction of the category width that the bar should take
 * @param lowerX (Scaled to the axis) The lower bounds of the bar on the x-axis
 * @param upperX (Scaled to the axis) The upper bounds of the bar on the x-axis
 * @param min The minimum value for the category (NOT scaled to the axis)
 * @param max The maximum value for the category (NOT scaled to the axis)
 * @param axis The axis (needed for scaling)
 * @return The bar's upper (x, y) coordinates, the width, and height
 */
function barDimensions(widthFraction: number, lowerX: number, upperX: number, min: number, max: number, axis: ContinuousNumericAxis): BarDimensions {
    const x = lowerX + Math.max(0, 0.5 - widthFraction / 2) * (upperX - lowerX)

    const maxValue = (isNaN(max) || max === -Infinity) ? 0 : max
    const y = axis.scale(maxValue)

    const width = Math.max(0, widthFraction * (upperX - lowerX))

    const minValue = (isNaN(min) || min === -Infinity) ? 0 : min
    const height = Math.max(0, axis.scale(minValue) - axis.scale(maxValue))
    return {
        upperX: x,
        upperY: y,
        width,
        height,
    }
}

function defaultCurrentValueStyle(): SeriesLineStyle {
    return {...defaultLineStyle(), lineWidth: 3, highlightWidth: 5}
}

export enum BarPlotOrientation {
    VERTICAL = 0,
    HORIZONTAL = 1,
}

/**
 * Calculates the ordinal stats for each of the ordinal series (generally, initial data) and
 * returns a {@link WindowedOrdinalStats} object
 * @param series The array of ordinal series
 * @return A {@link WindowedOrdinalStats} object with the stats for each of the series
 */
function initialOrdinalStats(series: Array<OrdinalSeries>): WindowedOrdinalStats {
    const ordinalStats = calculateOrdinalStats(series)
    return {
        ...ordinalStats,
        windowedValueStatsForSeries: copyValueStatsForSeries(ordinalStats.valueStatsForSeries)
    }
}

/**
 * Functions that return the bounds of the category. The {@link lower} function
 * returns the lower bound of the category within which the value falls. The
 * {@link upper} function returns the upper bound of the category within which the
 * value falls
 */
type CategoryBounds = {
    lower: (value: number) => number
    upper: (value: number) => number,
}

/**
 * Attempts to locate the x- and y-axes for the specified series. If no axis is found for the
 * series name, then uses the default returned by the useChart() hook.
 * @param seriesName Name of the series for which to retrieve the axis
 * @param axisAssignments A map holding the series name and the associated x- and y-axes assigned
 * to that series. Note that the series in the axis-assignment map is merely a subset of the set
 * of series names.
 * @param xAxisFor The function that accepts an axis ID and returns the corresponding x-axis
 * @param yAxisFor The function that accepts an axis ID and returns the corresponding y-axis
 * @return A 2d tuple holding the linear x-axis as its first element and the category y-axis as
 * the second element.
 */
function axesFor(
    seriesName: string,
    axisAssignments: Map<string, AxesAssignment>,
    xAxisFor: (id: string) => BaseAxis | undefined,
    yAxisFor: (id: string) => BaseAxis | undefined,
): [xAxis: CategoryAxis, yAxis: ContinuousNumericAxis] {
    const axes = axisAssignments.get(seriesName)
    const xAxis = xAxisFor(axes?.xAxis || "")
    const xAxisCategory = xAxis as CategoryAxis
    if (xAxis && !xAxisCategory) {
        throw Error("Bar plot requires that x-axis be of type CategoryAxis")
    }
    const yAxis = yAxisFor(axes?.yAxis || "")
    const yAxisContinuous = yAxis as ContinuousNumericAxis
    if (yAxis && !yAxisContinuous) {
        throw Error("Barbar plot requires that y-axis be of type ContinuousNumericAxis")
    }
    return [xAxisCategory, yAxisContinuous]
}

/**
 * Calculates the upper and lower coordinate for the category
 * @param categorySize The size of the category (i.e. plot_height / num_series)
 * @param lineWidth The width of the series line
 * @param margin The margin applied to the top and bottom of the spike line (vertical spacing)
 * @return An object with two functions, that when handed a y-coordinate, return the location
 * for the start (yUpper) or end (yLower) of the spikes line.
 */
function yAxisCategoryBoundsFn(categorySize: number, lineWidth: number, margin: number): CategoryBounds {
    if (categorySize <= margin) return {
        upper: value => value,
        lower: value => value + lineWidth
    }
    return {
        upper: value => value + margin,
        lower: value => value + categorySize - margin
    }
}

/**
 * Calculates the upper and lower coordinate for the category
 * @param categorySize The size of the category (i.e. plot_height / num_series)
 * @param lineWidth The width of the series line
 * @param margin The margin applied to the top and bottom of the spike line (vertical spacing)
 * @return An object with two functions, that when handed a y-coordinate, return the location
 * for the start (yUpper) or end (yLower) of the spikes line.
 */
function xAxisCategoryBoundsFn(categorySize: number, lineWidth: number, margin: number): CategoryBounds {
    if (categorySize <= margin) return {
        upper: value => value + lineWidth,
        lower: value => value
    }
    return {
        upper: value => value + categorySize - margin,
        lower: value => value + margin
    }
}

/**
 * Renders a tooltip showing for the bar in the bar chart (see {@link BarPlotTooltipContent})
 * @param container The chart container
 * @param yAxis The y-axis
 * @param categoryName The name of the category
 * @param selectedDatum The selected datum
 * @param event The mouse-over series event
 * @param margin The plot margin
 * @param barStyles The series style information (needed for (un)highlighting)
 * @param allowTooltip When set to `false` won't show tooltip, even if it is visible (used by pan)
 * @param mouseOverHandlerFor The handler for the mouse over (registered by the <Tooltip/>)
 */
function handleMouseOverBar(
    container: SVGSVGElement,
    yAxis: ContinuousNumericAxis,
    categoryName: string,
    selectedDatum: [x: number, y: number],
    event: React.MouseEvent<SVGPathElement>,
    margin: Margin,
    barStyles: Map<string, SeriesLineStyle>,
    allowTooltip: boolean,
    mouseOverHandlerFor: ((seriesName: string, value: number, series: Series<[number, number]>, mouseCoords: [x: number, y: number]) => void) | undefined,
): void {
    // grab the time needed for the tooltip ID
    const [x, y] = d3.pointer(event, container)
    const value = Math.round(yAxis.scale.invert(y - margin.top))

    const {highlightColor, highlightWidth} = barStyles.get(categoryName) || defaultCurrentValueStyle()

    // Use d3 to select element, change color and size
    d3.select<SVGPathElement, Datum>(event.currentTarget)
        .attr('stroke', highlightColor)
        .attr('stroke-width', highlightWidth)

    if (mouseOverHandlerFor && allowTooltip) {
        // the contract for the mouse over handler is for a time-series, but here we only
        // need one point, the selected datum, and so we convert it into an array of point
        // (i.e. a time-series). The category tooltip is (and custom ones, must be)
        // written to expect only the selected point
        mouseOverHandlerFor(categoryName, value, [selectedDatum], [x, y])
    }
}

/**
 * Unselects the time series and calls the mouse-leave-series handler registered for this series.
 * @param seriesName The name of the series (i.e. the neuron ID)
 * @param segment The SVG line element representing the spike, over which the mouse is hovering.
 * @param seriesStyles The styles for the series (for (un)highlighting)
 * @param mouseLeaverHandlerFor Registered handler for the series when the mouse leaves
 */
function handleMouseLeaveSeries(
    seriesName: string,
    segment: SVGPathElement,
    seriesStyles: Map<string, SeriesLineStyle>,
    mouseLeaverHandlerFor: ((seriesName: string) => void) | undefined,
): void {
    const {color, lineWidth} = seriesStyles.get(seriesName) || defaultCurrentValueStyle()
    d3.select<SVGPathElement, Datum>(segment)
        .attr('stroke', color)
        .attr('stroke-width', lineWidth)

    if (mouseLeaverHandlerFor) {
        mouseLeaverHandlerFor(seriesName)
    }
}
