import React, {useCallback, useEffect, useMemo, useRef} from 'react'
import {useChart} from "./hooks/useChart";
import {ContinuousAxisRange, continuousAxisRangeFor} from "./continuousAxisRangeFor";
import * as d3 from "d3";
import {ZoomTransform} from "d3";
import {setClipPath} from "./plot";
import {Datum} from "./timeSeries";
import {
    axesForSeriesGen,
    BaseAxis,
    ContinuousNumericAxis,
    continuousRangeForDefaultAxis,
    defaultLineStyle,
    panHandler,
    SeriesLineStyle,
    zoomHandler
} from "./axes";
import {GSelection} from "./d3types";
import {Observable, Subscription} from "rxjs";
import {formatTime, noop, textDimensions} from "./utils";
import {Dimensions, Margin} from "./margins";
import {subscriptionIteratesFor} from "./subscriptions";
import {useDataObservable} from "./hooks/useDataObservable";
import {IterateChartData} from "./iterates";
import {IterateDatum, IterateSeries} from "./iterateSeries";
import {usePlotDimensions} from "./hooks/usePlotDimensions";
import {useInitialData} from "./hooks/useInitialData";
import {AxesState} from "./hooks/AxesState";

type IteratePoint = { n: number, n_1: number, time: number, index: number }
type Series = Array<IteratePoint>

function emptyIteratePoint(): IteratePoint {
    return {n: NaN, n_1: NaN, time: NaN, index: NaN}
}

interface Props {
    /**
     * The line interpolation curve factory. See the d3 documentation for curves at
     * {@link https://github.com/d3/d3-shape#curves} for information on available interpolations
     */
    interpolation?: d3.CurveFactory
    /**
     * When set to `true` plots the data points as well as the line.
     */
    showPoints?: boolean
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
}

/**
 * Renders a streaming Poincare (iterates) plot for the series in the initial data and those sourced by the
 * observable specified as a property in the {@link Chart}. This component uses the {@link useChart}
 * hook, and therefore must be a child of the {@link Chart} in order to be plugged in to the
 * chart ecosystem (axes, tracker, tooltip).
 *
 * @param props The properties associated with the scatter plot
 * @constructor
 * @example
 <ScatterPlot
 interpolation={interpolation}
 axisAssignments={new Map([
 ['test2', assignAxes("x-axis-2", "y-axis-2")],
 ])}
 dropDataAfter={10000}
 panEnabled={true}
 zoomEnabled={true}
 zoomKeyModifiersRequired={true}
 />
 */
export function PoincarePlot(props: Props): null {
    const {
        chartId,
        container,
        mainG,
        axes,
        // plotDimensions,
        // margin,
        // color,
        backgroundColor,
        seriesStyles,
        seriesFilter,

        mouse
    } = useChart()

    const {
        xAxesState,
        yAxesState,
        setAxisBoundsFor,
        updateAxesBounds = noop,
        onUpdateAxesBounds,
    } = axes

    const {
        mouseOverHandlerFor,
        mouseLeaveHandlerFor
    } = mouse

    const {
        plotDimensions,
        margin,
    } = usePlotDimensions()

    const {
        seriesObservable,
        windowingTime = 100,
        shouldSubscribe,

        onSubscribe = noop,
        onUpdateData,
        onUpdateChartTime = noop,
    } = useDataObservable<IterateChartData, IterateDatum>()

    const {initialData} = useInitialData<IterateDatum>()

    const {
        // axisAssignments = new Map<string, AxesAssignment>(),
        interpolation = d3.curveStepAfter,
        showPoints = true,
        dropDataAfter = Infinity,
        panEnabled = false,
        zoomEnabled = false,
        zoomKeyModifiersRequired = true,
        withCadenceOf,
    } = props

    // some 'splainin: the dataRef holds on to a copy of the initial data, but, the Series in the array
    // are by reference, so the seriesRef, also holds on to the same Series. When new data is appended to
    // the Series in seriesRef, it's updating the underlying series, and so the dataRef sees those
    // changes as well. The dataRef is used for performance, so that in the updatePlot function we don't
    // need to create a temporary array to holds the series data, rather, we can just use the one held in
    // the dataRef.
    const dataRef = useRef<Array<IterateSeries>>(initialData.slice() as Array<IterateSeries>)
    const seriesRef = useRef<Map<string, IterateSeries>>(new Map(initialData.map(series => [series.name, series as IterateSeries])))
    // map(axis_id -> current_time) -- maps the axis ID to the current time for that axis
    const currentTimeRef = useRef<number>(0)

    const subscriptionRef = useRef<Subscription>()
    const isSubscriptionClosed = () => subscriptionRef.current === undefined || subscriptionRef.current.closed

    const allowTooltip = useRef<boolean>(isSubscriptionClosed())

    // useEffect(
    //     () => {
    //         currentTimeRef.current = new Map(Array.from(xAxesState.axes.keys()).map(id => [id, 0]))
    //     },
    //     [xAxesState]
    // )

    // calculates the distinct series IDs that cover all the series in the plot
    const axesForSeries = useMemo(
        (): Array<string> => axesForSeriesPoincare(initialData, xAxesState),
        [initialData, xAxesState]
    )

    const rangeMapFrom = useCallback(
        /**
         * Generates a range map from the f[n](x) and f[n+1](x) axis range
         * @param fnRange
         * @param fn1Range
         */
        (fnRange: ContinuousAxisRange, fn1Range: ContinuousAxisRange): Map<string, ContinuousAxisRange> => {
            const start = Math.min(fnRange.start, fn1Range.start)
            const end = Math.min(fnRange.end, fn1Range.end)
            const ranges = new Map<string, ContinuousAxisRange>()
            xAxesState.axisIds().forEach(id => ranges.set(id, continuousAxisRangeFor(start, end)))
            yAxesState.axisIds().forEach(id => ranges.set(id, continuousAxisRangeFor(start, end)))
            return ranges
        },
        [xAxesState, yAxesState]
    )

    const boundsMapFrom = useCallback(
        (ranges: Map<string, ContinuousAxisRange>): Map<string, [number, number]> => {
            return new Map<string, [number, number]>(
                Array.from(ranges.entries())
                    .map(([id, range]) => ([id, [range.start, range.end]]))
            )
        },
        []
    )

    const updateRangesAndPlot = useCallback(
        /**
         * Updates the ranges for the axes, constraining them to be equal, and
         * updates the bounds
         * @param fnRange The x-axis
         * @param fn1Range The y-axis
         */
        (fnRange: ContinuousAxisRange, fn1Range: ContinuousAxisRange): void => {
            if (mainG !== null) {
                // calculate the new map from the ranges
                const ranges = rangeMapFrom(fnRange, fn1Range)
                onUpdateTimeRef.current(ranges)

                // calculate the bounds
                updatePlotRef.current(fnRange, fn1Range, mainG)
                if (onUpdateAxesBounds) {
                    setTimeout(() => {
                        onUpdateAxesBounds(boundsMapFrom(ranges))
                    }, 0)
                }
            }
        },
        [mainG, onUpdateAxesBounds, rangeMapFrom, boundsMapFrom]
    )

    // todo find better way
    // when the initial data changes, then reset the plot. note that the initial data doesn't change
    // during the normal course of updates from the observable, only when the plot is restarted.
    useEffect(
        () => {
            dataRef.current = initialData.slice()
            seriesRef.current = new Map(initialData.map(series => [series.name, series]))
            currentTimeRef.current = 0

            const xRange = xAxesState.defaultAxis() ?
                continuousRangeForDefaultAxis(xAxesState.defaultAxis() as ContinuousNumericAxis) :
                continuousAxisRangeFor(Infinity, -Infinity)
            const [start, end] = xRange.original
            const range = continuousAxisRangeFor(start, end)

            updateRangesAndPlot(range, range)
        },
        // ** not happy about this **
        // only want this effect to run when the initial data is changed, which means all the
        // other dependencies are recalculated anyway.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [initialData]
    )

    /**
     * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
     * @param x The amount that the plot is dragged
     * @param plotDimensions The dimensions of the plot
     * @param series An array of series names
     * @param ranges A map holding the axis ID and its associated time range
     */
    const onPan = useCallback(
        (x: number,
         plotDimensions: Dimensions,
         series: Array<string>,
         ranges: Map<string, ContinuousAxisRange>,
        ) => panHandler(axesForSeries, margin, setAxisBoundsFor, xAxesState)(x, plotDimensions, series, ranges),
        [axesForSeries, margin, setAxisBoundsFor, xAxesState]
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
        ) => zoomHandler(axesForSeries, margin, setAxisBoundsFor, xAxesState)(transform, x, plotDimensions, series, ranges),
        [axesForSeries, margin, setAxisBoundsFor, xAxesState]
    )

    const updatePlot = useCallback(
        /**
         * Updates the plot data for the specified time-range, which may have changed due to zoom or pan
         * @param xRanges The current range of the x-axis (f[n](x))
         * @param yRanges The current range of the y-axis (f[n+1](x))
         * @param mainGElem The main <g> element selection for that holds the plot
         */
        (xRanges: ContinuousAxisRange, yRanges: ContinuousAxisRange, mainGElem: GSelection) => {
            if (container) {
                onUpdateChartTime(currentTimeRef.current)

                // select the svg element bind the data to them
                const svg = d3.select<SVGSVGElement, any>(container)

                // create a map associating series-names to their time-series.
                //
                // performance-related confusion: wondering where the dataRef is updated? well it isn't
                // directly. The dataRef holds on to an array of references to the Series. And so does the
                // seriesRef, though it uses a map(series_name -> series). The seriesRef is used to append
                // data to the underlying Series, and the dataRef is used so that we can just use
                // dataRef.current and don't have to do Array.from(seriesRef.current.values()) which
                // creates a temporary array
                // const offset = 1
                const boundedSeries = new Map<string, Series>(dataRef.current.map(series => {
                    // series.data.map((datum, index) => {
                    //     if (index < offset) {
                    //         return emptyIteratePoint()
                    //         // return [NaN, NaN]
                    //     }
                    //     return [series.data[index - offset].iterateN_1, datum.iterateN_1]
                    // })
                    return [
                        series.name,
                        series.data
                            .filter(datum => !isNaN(datum.iterateN))
                            .map((datum, index) => ({
                                    n: datum.iterateN,
                                    n_1: datum.iterateN_1,
                                    time: datum.time,
                                    index: index
                                })
                            ) as Series
                    ]
                }))
                // console.log("dataRef", dataRef.current)
                // console.log("boundedSeries", boundedSeries)

                // set up panning
                // if (panEnabled) {
                //     const drag = d3.drag<SVGSVGElement, Datum>()
                //         .on("start", () => {
                //             d3.select(container).style("cursor", "move")
                //             // during panning, we need to disable viewing the tooltip to prevent
                //             // tooltips from rendering but not getting removed
                //             allowTooltip.current = false;
                //         })
                //         .on("drag", (event) => {
                //             onPan(
                //                 event.dx,
                //                 plotDimensions,
                //                 Array.from(boundedSeries.keys()),
                //                 timeRanges,
                //             )
                //             updatePlotRef.current(timeRanges, mainGElem)
                //         })
                //         .on("end", () => {
                //             d3.select(container).style("cursor", "auto")
                //             // during panning, we disabled viewing the tooltip to prevent
                //             // tooltips from rendering but not getting removed, now that panning
                //             // is over, allow tooltips to render again
                //             allowTooltip.current = isSubscriptionClosed();
                //         })
                //
                //     svg.call(drag)
                // }

                // set up for zooming
                // if (zoomEnabled) {
                //     const zoom = d3.zoom<SVGSVGElement, Datum>()
                //         .filter(event => !zoomKeyModifiersRequired || event.shiftKey || event.ctrlKey)
                //         .scaleExtent([0, 10])
                //         .translateExtent([[margin.left, margin.top], [plotDimensions.width, plotDimensions.height]])
                //         .on("zoom", event => {
                //                 onZoom(
                //                     event.transform,
                //                     event.sourceEvent.offsetX - margin.left,
                //                     plotDimensions,
                //                     Array.from(boundedSeries.keys()),
                //                     timeRanges,
                //                 )
                //                 updatePlotRef.current(timeRanges, mainGElem)
                //             }
                //         )
                //
                //     svg.call(zoom)
                // }

                // define the clip-path so that the series lines don't go beyond the plot area
                const clipPathId = setClipPath(chartId, svg, plotDimensions, margin)

                // ---
                // todo only want to do this once, on the first plot, and then leave it,
                //     unless the axes are updated, also needs to be removed/added when the
                //     plot size changes
                const xAxis = xAxesState.defaultAxis() as ContinuousNumericAxis
                const yAxis = yAxesState.defaultAxis() as ContinuousNumericAxis
                const {start: xStart, end: xEnd} = continuousRangeForDefaultAxis(xAxis)
                const {start: yStart, end: yEnd} = continuousRangeForDefaultAxis(yAxis)

                const lineGenerator = d3.line<[x: number, y: number]>()
                    .x(d => xAxis.scale(d[0] || 0))
                    .y(d => yAxis.scale(d[1] || 0))

                mainGElem
                    .selectAll(`#fn-equals-fn1-${chartId}-poincare`)
                    .data([[[xStart, yStart], [xEnd, yEnd]] as Array<[x: number, y: number]>])
                    .join(enter => enter
                            .select("path")
                            .style("stroke", "grey")
                            .attr("class", `fn-equals-fn1-poincare`)
                            .attr("id", `#fn-equals-fn1-${chartId}-poincare`)
                            .attr('transform', `translate(${margin.left}, ${margin.top})`)
                            .attr("d", lineGenerator),
                        update => update.remove(),
                        exit => exit.remove()
                    )
                    // clear out mouse-enter callbacks for the diagonal line
                    .on("mouseenter", () => {
                    })
                    .on("mouseleave", () => {
                    })
                // ---

                boundedSeries.forEach((data, name) => {
                    // grab the x and y axes assigned to the series, and if either or both
                    // axes aren't found, then give up and return
                    const [xAxisLinear, yAxisLinear] = axesFor(xAxesState.axisFor, yAxesState.axisFor)
                    if (xAxisLinear === undefined || yAxisLinear === undefined) return

                    // grab the style for the series
                    const seriesLineStyle: SeriesLineStyle = seriesStyles.get(name) || {
                        ...defaultLineStyle,
                        highlightColor: defaultLineStyle.color
                    }

                    // only show the data for which the filter matches
                    const plotData = (name.match(seriesFilter)) ? data : []

                    // when specified, show a circle for the actual data point
                    if (showPoints) {
                        mainGElem
                            .selectAll(`.${name}-${chartId}-poincare-points`)
                            .data(plotData, () => `${name}`)
                            .join(
                                enter => enter
                                    .append("circle")
                                    .attr("class", `${name}-${chartId}-poincare-points`)
                                    // .attr("id", (_, index) => `${name}-${chartId}-poincare-points`)
                                    .attr("id", (_, index) => `${name}-${chartId}-poincare-point-${index}`)
                                    .attr("fill", seriesLineStyle.color)
                                    .attr("stroke", "none")
                                    .attr("cx", (d: IteratePoint) => xAxisLinear.scale(d.n) || 0)
                                    .attr("cy", (d: IteratePoint) => yAxisLinear.scale(d.n_1) || 0)
                                    .attr("r", 2)
                                    .attr('transform', `translate(${margin.left}, ${margin.top})`)
                                    .attr("clip-path", `url(#${clipPathId})`),
                                update => update
                                    .attr("cx", (d: IteratePoint) => xAxisLinear.scale(d.n) || 0)
                                    .attr("cy", (d: IteratePoint) => yAxisLinear.scale(d.n_1) || 0)
                                ,
                                exit => exit.remove()
                            )
                            .on("mouseenter",
                                (event: React.MouseEvent<SVGCircleElement>, datum: IteratePoint) =>
                                    handleMouseEnterPoint(
                                        chartId,
                                        name,
                                        event.currentTarget as SVGCircleElement,
                                        svg,
                                        datum,
                                        plotData,
                                        xAxisLinear,
                                        yAxisLinear,
                                        margin,
                                        seriesLineStyle,
                                        // color,
                                        // highlightColor,
                                        backgroundColor
                                    )
                            )
                            .on("mouseleave", (event: React.MouseEvent<SVGCircleElement>, datum: IteratePoint) =>
                                handleMouseLeavePoint(chartId, name, seriesLineStyle.color)
                            )
                    }

                    const pathGenerator = d3.line<IteratePoint>()
                        .x(d => xAxis.scale(d.n || 0))
                        .y(d => yAxis.scale(d.n_1 || 0))

                    // create the time-series paths
                    mainGElem
                        .selectAll(`#${name}-${chartId}-poincare`)
                        .data([[], plotData], () => `${name}`)
                        .join(
                            enter => enter
                                .append("path")
                                .attr("class", 'iterate-series-lines')
                                .attr("id", `${name}-${chartId}-poincare`)
                                .attr("d", pathGenerator.curve(interpolation))
                                .style("fill", "none")
                                .style("stroke", seriesLineStyle.color)
                                .style("stroke-width", seriesLineStyle.lineWidth)
                                .attr('transform', `translate(${margin.left}, ${margin.top})`)
                                .attr("clip-path", `url(#${clipPathId})`)
                            // .on(
                            //     "mouseenter",
                            //     (event, datumArray) =>
                            //         // recall that this handler is passed down via the "useChart" hook
                            //         handleMouseOverSeries(
                            //             chartId,
                            //             container,
                            //             xAxisLinear,
                            //             yAxisLinear,
                            //             name,
                            //             datumArray,
                            //             event,
                            //             margin,
                            //             seriesStyles,
                            //             allowTooltip.current,
                            //             mouseOverHandlerFor(`tooltip-${chartId}`)
                            //         )
                            // )
                            // .on(
                            //     "mouseleave",
                            //     event => handleMouseLeaveSeries(
                            //         name,
                            //         chartId,
                            //         event.currentTarget as SVGPathElement,
                            //         seriesStyles,
                            //         mouseLeaveHandlerFor(`tooltip-${chartId}`)
                            //     )
                            // )
                            ,
                            update => update,
                            exit => exit.remove()
                        )
                })
            }
        },
        [container, onUpdateChartTime, chartId, plotDimensions, margin, xAxesState, yAxesState, seriesStyles, seriesFilter, showPoints, backgroundColor, interpolation]
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
    const onUpdateTimeRef = useRef(updateAxesBounds)
    useEffect(
        () => {
            onUpdateTimeRef.current = updateAxesBounds
        },
        [updateAxesBounds]
    )

    // memoized function for subscribing to the chart-data observable
    const subscribe = useCallback(
        () => {
            if (seriesObservable === undefined || mainG === null) return undefined
            return subscriptionIteratesFor(
                seriesObservable as Observable<IterateChartData>,
                onSubscribe,
                windowingTime,
                xAxesState,
                yAxesState,
                onUpdateData,
                dropDataAfter,
                updateRangesAndPlot,
                seriesRef.current,
                end => currentTimeRef.current = end
            )
        },
        [
            dropDataAfter, mainG,
            onSubscribe, onUpdateData,
            seriesObservable, updateRangesAndPlot, windowingTime,
            xAxesState, yAxesState,
        ]
    )

    // updates the plot when the interpolation and filter change, because the updatePlot
    // callback has changed.
    useEffect(
        () => {
            if (container && mainG) {
                // todo the ranges are temporary, either they will be removed, or they will
                //     be updated to correspond to the ranges for all the axes
                updatePlot(continuousAxisRangeFor(0, 0), continuousAxisRangeFor(0, 0), mainG)
            }
        },
        [container, mainG, updatePlot]
    )

    // subscribe/unsubscribe to the observable chart data. when the `shouldSubscribe`
    // is changed to `true` and we haven't subscribed yet, then subscribe. when the
    // `shouldSubscribe` is `false` and we had subscribed, then unsubscribe. otherwise,
    // do nothing.
    useEffect(
        () => {
            if (shouldSubscribe && subscriptionRef.current === undefined) {
                subscriptionRef.current = subscribe()
                allowTooltip.current = false
            } else if (!shouldSubscribe && subscriptionRef.current !== undefined) {
                subscriptionRef.current?.unsubscribe()
                subscriptionRef.current = undefined
                allowTooltip.current = true
            }
        },
        [shouldSubscribe, subscribe]
    )

    return null
}

function axesForSeriesPoincare(series: Array<IterateSeries>, xAxesState: AxesState): Array<string> {
    return axesForSeriesGen(series, new Map(), xAxesState)
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
    xAxisFor: (id: string) => BaseAxis | undefined,
    yAxisFor: (id: string) => BaseAxis | undefined,
): [xAxis: ContinuousNumericAxis, yAxis: ContinuousNumericAxis] {
    const xAxis = xAxisFor("")
    const xAxisLinear = xAxis as ContinuousNumericAxis
    const yAxis = yAxisFor("")
    const yAxisLinear = yAxis as ContinuousNumericAxis
    if (xAxis && !xAxisLinear) {
        throw Error("Poincare plot requires that x-axis be of type LinearAxis")
    }
    if (yAxis && !yAxisLinear) {
        throw Error("Poincare plot requires that y-axis be of type LinearAxis")
    }
    return [xAxisLinear, yAxisLinear]
}

type Point = {
    readonly x: number
    readonly y: number
}

function isEmptyPoint(point: Point): boolean {
    return isNaN(point.x) && isNaN(point.y)
}

type IndexedPoint = {
    // the index of the data point in the series
    readonly index: number
    // the data point
    readonly point: Point
    // the distance along the path to the last data point
    readonly delta: number
    // the distance along the path, from the start of the
    // path to the point
    readonly distance: number
}

function emptyIndexedPoint(): IndexedPoint {
    return {
        index: NaN,
        point: {x: NaN, y: NaN},
        delta: NaN,
        distance: NaN
    }
}

function isEmptyIndexedPoint(point: IndexedPoint = emptyIndexedPoint()): boolean {
    return isNaN(point.index) && isNaN(point.delta) && isNaN(point.distance) && isEmptyPoint(point.point)
}

function distance(p1: Point, p2: Point, maxDistance: number = Infinity): number {
    if (p1 === undefined || p2 === undefined) {
        return maxDistance
    }
    return Math.min(
        Math.sqrt(
            (p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y)
        ),
        maxDistance
    )
}

function pointsEqualWithin(point1: Point, point2: Point, tolerance: number = 2): boolean {
    return distance(point1, point2) <= tolerance
}

/**
 * For the specified series of points, calculates the distance between each successive point,
 * and the total distance from the first point, Each point is enriched with its index into
 * the original series
 * @param series The series of points
 * @return An array of indexed points, and enriched with the index into the original series
 */
// function calculateLinearIndexedPoints(series: Series): Array<IndexedPoint> {
function calculateLinearIndexedPoints(series: Array<Point>): Array<IndexedPoint> {
    return series
        .reduce(
            (indexedPoints, point, currentIndex) => {
                const delta = currentIndex > 0 ? distance(indexedPoints[currentIndex - 1].point, point) : 0
                const totalDistance = currentIndex > 0 ? indexedPoints[currentIndex - 1].distance + delta : 0

                const indexPoint = {
                    index: currentIndex,
                    point,
                    delta,
                    distance: totalDistance
                }
                indexedPoints.push(indexPoint)
                return indexedPoints
            },
            [] as Array<IndexedPoint>
        )
}

/**
 * @param chartId The ID of the chart
 * @param seriesName The name of the series (i.e. the neuron ID)
 * @param circle
 * @param svg
 * @param datum The datum over which the mouse has entered
 * @param plotData The iterates series
 * @param xAxisLinear The x-axis (f[n](x))
 * @param yAxisLinear The y-axis (f[n+1](x))
 * @param margin The plot margin
 * @param seriesStyle The series style information (needed for (un)highlighting)
 * @param backgroundColor
 *
 * @param allowTooltip When set to `false` won't show tooltip, even if it is visible (used by pan)
 * @param mouseOverHandlerFor The handler for the mouse-over (registered by the <Tooltip/>)
 *
 */
function handleMouseEnterPoint(
    chartId: number,
    seriesName: string,
    circle: SVGCircleElement,
    svg: d3.Selection<SVGSVGElement, any, null, undefined>,
    datum: IteratePoint,
    plotData: Series,
    xAxisLinear: ContinuousNumericAxis,
    yAxisLinear: ContinuousNumericAxis,
    margin: Margin,
    seriesStyle: SeriesLineStyle,
    // color: string,
    // highlightColor: string,
    backgroundColor: string
): void {
    const {color, highlightColor, lineWidth} = seriesStyle

    const padding = 4
    const circleRadius = 5
    const circleStroke = lineWidth

    d3.select<SVGPathElement, Datum>(circle)
        .attr("r", circleRadius)
        .style("fill", highlightColor)

    const index = plotData
        .findIndex(point => point.n === datum.n && point.n_1 === datum.n_1)

    /**
     * Displays basic information about an iterate, generally its neighbors
     * @param index The index of the iterate
     */
    function showInfo(index: number): void {
        d3.select(`#${seriesName}-${chartId}-poincare-point-${index}`)
            .attr("r", circleRadius)
            .style("fill", d3.rgb(highlightColor).brighter(0.7).toString())
            .style("stroke-width", circleStroke)
            .style("stroke", color)

        // grab the (x, y)-coordinates for the plot
        const iterateN = xAxisLinear.scale(plotData[index].n) + margin.left
        const iterateN_1 = yAxisLinear.scale(plotData[index].n_1) + margin.top

        // add a rectangle that serves as the background for the text (to make the
        // text readable when the chart is busy)
        const rect = svg
            .append("rect")
            .attr("class", `${seriesName}-${chartId}-poincare-point-text-background`)

        // add the information about the iterate as a text element
        const textElement = svg
            .append("text")
            .attr('class', `${seriesName}-${chartId}-poincare-point-text`)
            .attr('fill', highlightColor)
            .attr('font-family', 'sans-serif')
            .attr('font-size', 11)
            .attr('font-weight', 700)
            .text(`n = ${index}; t = ${formatTime(plotData[index].time)} ms`)

        // calculate the width and height of the text element
        const {width, height} = textDimensions(textElement)

        textElement
            .attr("transform", `translate(${iterateN - 8}, ${iterateN_1 - circleRadius - circleStroke - padding})`)

        rect
            .attr("x", iterateN - padding / 2 - 8)
            .attr("y", iterateN_1 - padding / 2 - circleRadius - circleStroke - height)
            .attr("width", width + padding)
            .attr("height", height + padding / 2)
            .style("fill", backgroundColor)
    }

    if (index > 0) {
        showInfo(index - 1)
    }
    if (index < plotData.length - 1) {
        showInfo(index + 1)
    }
}

function handleMouseLeavePoint(
    chartId: number,
    seriesName: string,
    color: string
): void {
    d3.selectAll<SVGPathElement, Datum>(`.${seriesName}-${chartId}-poincare-points`)
        .attr("r", 2)
        .style("fill", color)
        .style("stroke", "none")
    d3.selectAll(`.${seriesName}-${chartId}-poincare-point-arrows`).remove()
    d3.selectAll(`.${seriesName}-${chartId}-poincare-point-text`).remove()
    d3.selectAll(`.${seriesName}-${chartId}-poincare-point-text-background`).remove()
}

/**
 * Renders a tooltip showing the neuron, spike time, and the spike strength when the mouse hovers over a spike.
 * @param chartId The ID of the chart
 * @param container The chart container
 * @param xAxis The x-axis (f[n](x))
 * @param yAxis The y-axis (f[n+1](x))
 * @param seriesName The name of the series (i.e. the neuron ID)
 * @param series The time series
 * @param event The mouse-over series event
 * @param margin The plot margin
 * @param seriesStyles The series style information (needed for (un)highlighting)
 * @param allowTooltip When set to `false` won't show tooltip, even if it is visible (used by pan)
 * @param mouseOverHandlerFor The handler for the mouse-over (registered by the <Tooltip/>)
 */
function handleMouseOverSeries(
    chartId: number,
    container: SVGSVGElement,
    xAxis: ContinuousNumericAxis,
    yAxis: ContinuousNumericAxis,
    seriesName: string,
    series: Series,
    event: React.MouseEvent<SVGPathElement>,
    margin: Margin,
    seriesStyles: Map<string, SeriesLineStyle>,
    allowTooltip: boolean,
    mouseOverHandlerFor: ((seriesName: string, time: number, series: Series, mouseCoords: [x: number, y: number]) => void) | undefined,
): void {

    const svgPath = event.currentTarget as SVGPathElement

    // grab the mouse coordinates (in screen coordinates)
    const mouseP = d3.pointer(event, container)
    const mousePixels = {x: mouseP[0], y: mouseP[1]} as Point

    // convert all the data points to screen coordinates
    const dataPixels = series.map(({n, n_1}) => ({
        x: xAxis.scale(n) + margin.left,
        y: yAxis.scale(n_1) + margin.top
    } as Point))

    // todo move this into the component as a ref and useEffect to recalculate when the data changes
    // calculate the linear distances between the data points, sorting them by their distance
    // from the first point. we use these to search for points.
    const pointsWithLinearDistances = calculateLinearIndexedPoints(dataPixels)

    // todo move this into the component as a ref and useEffect to recalculate when the data or the spline changes
    // holds points for which we hava found the distances along the path
    const foundPoints: Array<IndexedPoint> = series.map(() => emptyIndexedPoint())

    //
    // calculate getPointAtLength(distance) and see if it matches the mouse coordinates, if not increment the
    // distance by one, and then check to see if it matches the mouse coordinates, or any point that is the
    // incremented distance from the start. repeat this until the distance to the mouse coordinates is found.
    // Also fill in the map of data points to path distance mapping.
    //
    let upperBound: IndexedPoint = emptyIndexedPoint()
    const totalPathLength = svgPath.getTotalLength()

    // calculate the linear distance between the mouse coordinates and the first data point,
    // clamping the point at the SVG path length
    let mouseDistance: number = distance(mousePixels, dataPixels[0], svgPath.getTotalLength());
    let pathPoint: Point;
    do {
        // get the point on the path at the current distance
        const point = svgPath.getPointAtLength(mouseDistance)
        pathPoint = {x: point.x + margin.left, y: point.y + margin.top} as Point

        // todo should be able to drop the index in the indexed-points because I'm no longer sorting
        // as an optimization for later, check if any data points exist at this distance, and if so, add them
        // to the found points
        for (let index = 0; index < pointsWithLinearDistances.length; index++) {
            const indexedPoint = pointsWithLinearDistances[index]
            if (isEmptyIndexedPoint(foundPoints[indexedPoint.index]) && pointsEqualWithin(indexedPoint.point, pathPoint)) {
                const foundPoint: IndexedPoint = {
                    ...indexedPoint,
                    delta: (index > 0) ? mouseDistance - pointsWithLinearDistances[index - 1].distance : 0,
                    distance: mouseDistance
                }
                foundPoints[foundPoint.index] = foundPoint

                // this will only happen once the found points are calculated and held outside of this function
                // in the component and updated when points are added (but for now leave this
                if (foundPoint.index < foundPoints.length && !isEmptyIndexedPoint(foundPoints[foundPoint.index + 1])) {
                    // we found the bounds for the mouse, and we're done
                    upperBound = foundPoint
                }
                break;
            }
        }

        // update to the next pixel
        mouseDistance++
    } while (!pointsEqualWithin(mousePixels, pathPoint) && mouseDistance <= totalPathLength)

    // once the mouse distance is found, check to see if its distance falls between two successive
    // data point distances. if it does, then those are the points. otherwise continue.
    if (isEmptyIndexedPoint(upperBound)) {
        // continue the search starting at the mouse distance
        let pathDistance = mouseDistance
        let foundPoint = emptyIndexedPoint()
        do {
            // pathPoint = svgPath.getPointAtLength(pathDistance)
            const point = svgPath.getPointAtLength(pathDistance)
            pathPoint = {x: point.x + margin.left, y: point.y + margin.top} as Point

            for (let index = 0; index < pointsWithLinearDistances.length; index++) {
                const indexedPoint = pointsWithLinearDistances[index]
                if (isEmptyIndexedPoint(foundPoints[indexedPoint.index]) && pointsEqualWithin(indexedPoint.point, pathPoint)) {
                    foundPoint = {
                        ...indexedPoint,
                        delta: (index > 0) ? mouseDistance - pointsWithLinearDistances[index - 1].distance : 0,
                        distance: mouseDistance
                    }
                    foundPoints[foundPoint.index] = foundPoint

                    // this will only happen once the found points are calculated and held outside of this function
                    // in the component and updated when points are added (but for now leave this
                    if (foundPoint.index > 0 && !isEmptyIndexedPoint(foundPoints[foundPoint.index - 1])) {
                        // we found the bounds for the mouse, and we're done
                        upperBound = foundPoint
                    }
                    break;
                }
            }
            pathDistance++
        } while (!pointsEqualWithin(foundPoint.point, pathPoint) && pathDistance <= totalPathLength)

        upperBound = foundPoint
    }

    if (isEmptyIndexedPoint(upperBound)) {
        // this is an error
        console.error("Was unable to find the point")
    }

    const [x, y] = d3.pointer(event, container)
    const fn = xAxis.scale.invert(x - margin.left)
    const fn1 = yAxis.scale.invert(y - margin.top)

    const {highlightColor, highlightWidth} = seriesStyles.get(seriesName) || defaultLineStyle

    // Use d3 to select element, change color and size
    d3.select<SVGCircleElement, Datum>(`#${seriesName}-${chartId}-poincare-point-${upperBound.index}`)
        .attr('stroke', highlightColor)
        .attr("r", 5)
        .attr("fill", d3.rgb(highlightColor).brighter(0.7).toString())
    d3.select<SVGCircleElement, Datum>(`#${seriesName}-${chartId}-poincare-point-${upperBound.index - 1}`)
        .attr('stroke', highlightColor)
        .attr("r", 5)
        .attr("fill", d3.rgb(highlightColor).brighter(0.7).toString())
    d3.select(svgPath)
        .attr('stroke', highlightColor)
        .attr('stroke-width', 2)
    // .attr('stroke-width', highlightWidth)

    if (mouseOverHandlerFor && allowTooltip) {
        mouseOverHandlerFor(seriesName, fn, series, [x, y])
    }
}

/**
 * Unselects the time series and calls the mouse-leave-series handler registered for this series.
 * @param seriesName The name of the series (i.e. the neuron ID)
 * @param chartId The ID of the chart
 * @param svgPath The SVG path representing the spline between the iterates
 * @param seriesStyles The styles for the series (for (un)highlighting)
 * @param mouseLeaverHandlerFor Registered handler for the series when the mouse leaves
 */
function handleMouseLeaveSeries(
    seriesName: string,
    chartId: number,
    svgPath: SVGPathElement,
    seriesStyles: Map<string, SeriesLineStyle>,
    mouseLeaverHandlerFor: ((seriesName: string) => void) | undefined,
): void {
    const {color, lineWidth} = seriesStyles.get(seriesName) || defaultLineStyle
    d3.selectAll<SVGPathElement, Datum>(`.${seriesName}-${chartId}-poincare-points`)
        .attr('stroke', color)
        .attr('stroke-width', lineWidth)
        .attr("r", 2)
        .attr("fill", color)
    d3.select(svgPath)
        .attr('stroke', color)
        .attr('stroke-width', lineWidth)


    if (mouseLeaverHandlerFor) {
        mouseLeaverHandlerFor(seriesName)
    }
}
