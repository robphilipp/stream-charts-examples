import * as React from "react"
import {CSSProperties, useEffect, useRef} from "react"
import * as d3 from "d3"
import {ScaleLinear, Selection, ZoomTransform} from "d3"
import {Dimensions, Margin, plotDimensionsFrom} from "./margins"
import {Datum, emptySeries, Series} from "./datumSeries"
import {ContinuousAxisRange, continuousAxisRangeFor} from "./continuousAxisRangeFor"
import {defaultTooltipStyle, TooltipStyle} from "./TooltipStyle"
import {noop, Observable, Subscription} from "rxjs"
import {ChartData} from "./chartData"
import {
    createMagnifierLens,
    magnifyAll, showMagnifierLens,
    RadialLensAxesSelections,
    RadialMagnifier,
    RadialMagnifierStyle,
    radialMagnifierWith, hideMagnifierLens
} from "./radialMagnifier"
import {windowTime} from "rxjs/operators"
import {createTrackerControl, defaultTrackerStyle, removeTrackerControl, TrackerStyle} from "./tracker"
import {initialSvgStyle, SvgStyle} from "./svgStyle"
import {
    addLinearAxis,
    Axes,
    AxesLabelFont,
    AxesLineStyle,
    AxisLocation,
    calculatePanFor,
    defaultAxesLabelFont,
    defaultLineStyle,
    LinearAxis
} from "./axes";
import {GSelection, RadialMagnifierSelection, SvgSelection, TextSelection, TrackerSelection} from "./d3types";
import {formatTime, formatTimeChange, formatValue, formatValueChange, handleZoom, mouseInPlotAreaFor} from "./utils";
import {TimeSeries} from "./plot";
import {boundingPoints, createTooltip, removeTooltip, TooltipDimensions, tooltipX, tooltipY} from "./tooltip";

const defaultMargin: Margin = {top: 30, right: 20, bottom: 30, left: 50}
const defaultAxesStyle = {color: '#d2933f'}

const defaultRadialMagnifierStyle: RadialMagnifierStyle = {
    visible: false,
    radius: 100,
    magnification: 5,
    color: '#d2933f',
    lineWidth: 2,
}

interface Props {
    width: number
    height: number
    margin?: Partial<Margin>
    axisLabelFont?: Partial<AxesLabelFont>
    axisStyle?: Partial<CSSProperties>
    backgroundColor?: string
    lineStyle?: Partial<AxesLineStyle>
    plotGridLines?: Partial<{ visible: boolean, color: string }>
    tooltip?: Partial<TooltipStyle>
    tooltipValueLabel?: string
    magnifier?: Partial<RadialMagnifierStyle>
    tracker?: Partial<TrackerStyle>
    svgStyle?: Partial<SvgStyle>

    minY?: number
    maxY?: number

    // data to plot: time-window is the time-range of data shown (slides in time)
    timeWindow: number
    seriesList: Array<Series>
    dropDataAfter: number

    // data stream
    seriesObservable: Observable<ChartData>
    windowingTime?: number
    shouldSubscribe?: boolean
    onSubscribe?: (subscription: Subscription) => void
    onUpdateData?: (seriesName: string, data: Array<Datum>) => void
    onUpdateTime?: (time: number) => void

    // regex filter used to select which series are displayed
    filter?: RegExp

    // a map that holds the series name and it's associated cooler
    seriesColors?: Map<string, string>
}

/**
 * Renders a scatter chart of time-series. The x-axis is time, and the y-axis shows the values. The chart
 * relies on an rxjs `Observable` of {@link ChartData} for its data. By default, this chart will subscribe
 * to the observable when it mounts. However, you can control the timing of the subscription through the
 * `shouldSubscribe` property by setting it to `false`, and then some time later setting it to `true`.
 * Once the observable starts sourcing a sequence of {@link ChartData}, for performance, this chart updates
 * itself without invoking React's re-render.
 * @param props The properties from the parent
 * @return {JSX.Element} The scatter chart
 * @constructor
 */
export function ScatterChart(props: Props): JSX.Element {

    const {
        width,
        height,
        backgroundColor = '#202020',
        minY = -1, maxY = 1,
        tooltipValueLabel = 'y',
        timeWindow,
        seriesList,
        seriesObservable,
        windowingTime = 100,
        dropDataAfter = Infinity,
        shouldSubscribe = true,
        onSubscribe = noop,
        onUpdateData = noop,
        onUpdateTime = noop,
        filter = /./,
        seriesColors = seriesColorsFor(seriesList, defaultLineStyle.color, "#a9a9b4")
    } = props

    // override the defaults with the parent's properties, leaving any unset values as the default value
    const margin = {...defaultMargin, ...props.margin}
    const axisStyle = {...defaultAxesStyle, ...props.axisStyle}
    const axisLabelFont: AxesLabelFont = {...defaultAxesLabelFont, ...props.axisLabelFont}
    const tooltipStyle: TooltipStyle = {...defaultTooltipStyle, ...props.tooltip}
    const magnifierStyle = {...defaultRadialMagnifierStyle, ...props.magnifier}
    const lineStyle = {...defaultLineStyle, ...props.lineStyle}
    const trackerStyle = {...defaultTrackerStyle, ...props.tracker}
    const svgStyle = props.width ?
        {...initialSvgStyle, ...props.svgStyle, width: props.width} :
        {...initialSvgStyle, ...props.svgStyle}

    // id of the chart to avoid dom conflicts when multiple raster charts are used in the same app
    const chartId = useRef<number>(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))

    // hold a reference to the current width and the plot dimensions
    const plotDimRef = useRef<Dimensions>(plotDimensionsFrom(width, height, margin))

    // the container that holds the d3 svg element
    const containerRef = useRef<SVGSVGElement>(null)
    const mainGRef = useRef<GSelection>()

    const magnifierRef = useRef<RadialMagnifierSelection>()
    const magnifierAxesRef = useRef<RadialLensAxesSelections>()

    const trackerRef = useRef<Selection<SVGLineElement, Datum, null, undefined>>()

    const zoomFactorRef = useRef<number>(5)

    // reference to the axes for the plot
    const axesRef = useRef<Axes<LinearAxis, LinearAxis>>()

    // reference for the min/max values
    const minValueRef = useRef<number>(minY)
    const maxValueRef = useRef<number>(maxY)

    const liveDataRef = useRef<Map<string, Series>>(new Map<string, Series>(seriesList.map(series => [series.name, series])))
    const seriesRef = useRef<Map<string, Series>>(new Map<string, Series>(seriesList.map(series => [series.name, series])))
    const currentTimeRef = useRef<number>(0)


    // unlike the magnifier, the handler forms a closure on the tooltip properties, and so if they change in this
    // component, the closed properties are unchanged. using a ref allows the properties to which the reference
    // points to change.
    const tooltipRef = useRef<TooltipStyle>(tooltipStyle)

    // calculates to the time-range based on the (min, max)-time from the props
    const timeRangeRef = useRef<ContinuousAxisRange>(continuousAxisRangeFor(0, timeWindow))

    const seriesFilterRef = useRef<RegExp>(filter)

    // set the colors used for the time-series
    const colorsRef = useRef<Map<string, string>>(seriesColors)

    const borderColor = d3.rgb(tooltipStyle.backgroundColor).brighter(3.5).hex()

    // called on mount to set up the <g> element into which to render
    useEffect(
        () => {
            if (containerRef.current) {
                const svg = d3.select<SVGSVGElement, any>(containerRef.current)
                axesRef.current = initializeAxes(svg, plotDimRef.current, timeRangeRef.current, axisLabelFont, margin)
                updateDimensionsAndPlot(width, height)
            }
        },
        // we really, really only want this called when the component mounts, and there are
        // no stale closures in the this. recall that d3 manages the updates to the chart, and
        // react is only used when certain props change (e.g. magnifier, tracker, tooltip visibility
        // state, magnification power)
        //
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    )

    useEffect(
        () => {
            updateDimensionsAndPlot(width, height)
        },
        [width, height]
    )

    // called on mount, dismount and when shouldSubscribe changes
    useEffect(
        () => {
            if (shouldSubscribe) {
                const subscription = subscribe()

                // stop the stream on dismount
                return () => subscription.unsubscribe()
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [shouldSubscribe]
    )

    // update the plot for tooltip, magnifier, or tracker if their visibility changes
    useEffect(
        () => {
            // update the reference to reflect the selection (only one is allowed)
            if (tooltipStyle.visible) {
                tooltipRef.current.visible = true
                trackerRef.current = undefined
                magnifierRef.current = undefined
            } else if (trackerStyle.visible) {
                tooltipRef.current.visible = false
                magnifierRef.current = undefined
            } else if (magnifierStyle.visible) {
                tooltipRef.current.visible = false
                trackerRef.current = undefined
            }
            // when no enhancements are selected, then make sure they are all off
            else {
                tooltipRef.current.visible = false
                trackerRef.current = undefined
                magnifierRef.current = undefined
                if (containerRef.current) {
                    d3.select<SVGSVGElement, any>(containerRef.current).on('mousemove', () => null)
                }
            }
            seriesFilterRef.current = filter
            updatePlot(timeRangeRef.current, plotDimRef.current)
        },
        // seriesFilterRef and timeRangeRef are not included in the dependencies because we don't want
        // react involved in the SVG updates. Rather, the rxjs observable we subscribed to manage the
        // updates to the time-range and the svg plot
        //
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [tooltipStyle.visible, magnifierStyle.visible, magnifierStyle.magnification, trackerStyle.visible, filter]
    )

    /**
     * Calculates the min and max values for the specified array of time-series
     * @param data The array of time-series
     * @return {[number, number]} A pair with the min value as the first element and the max
     * value as the second element.
     */
    function calcMinMaxValues(data: Array<TimeSeries>): [number, number] {
        const minValue = d3.min(data, series => d3.min(series, datum => datum[1])) || 0
        const maxValue = d3.max(data, series => d3.max(series, datum => datum[1])) || 1
        return [
            Math.min(minValue, minValueRef.current),
            Math.max(maxValue, maxValueRef.current)
        ]
    }

    /**
     * Initializes the x and y axes and returns the axes generators, axes, and scale functions
     * @param svg The main SVG container
     * @param plotDimensions The dimensions of the plot
     * @param timeRange The current time-range of the plot
     * @param axesLabelFont The font style for the axes labels
     * @param margin The plot margins
     * @return The axes generators, axes, and scale functions
     */
    function initializeAxes(
        svg: SvgSelection,
        plotDimensions: Dimensions,
        timeRange: ContinuousAxisRange,
        axesLabelFont: AxesLabelFont,
        margin: Margin,
    ): Axes<LinearAxis, LinearAxis> {
        const xAxis = addLinearAxis(1, svg, AxisLocation.Bottom, plotDimensions, [timeRange.start, timeRange.end], axesLabelFont, margin, "t (ms)")
        const yAxis = addLinearAxis(1, svg, AxisLocation.Left, plotDimensions, [minY, maxY], axesLabelFont, margin, "Weight")

        return {xAxis, yAxis}
    }

    /**
     * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
     * at the location of the mouse when the scroll wheel or gesture was applied.
     * @param transform The d3 zoom transformation information
     * @param x The x-position of the mouse when the scroll wheel or gesture is used
     * @param plotDimensions The dimensions of the plot
     */
    function onZoom(transform: ZoomTransform, x: number, plotDimensions: Dimensions): void {
        if (axesRef.current !== undefined) {
            const zoom = handleZoom(transform, x, plotDimensions, width, margin, axesRef.current.xAxis, timeRangeRef.current)
            if (zoom) {
                timeRangeRef.current = zoom.timeRange
                zoomFactorRef.current = zoom.zoomFactor
                updatePlot(timeRangeRef.current, plotDimensions)
            }
        }
    }

    /**
     * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
     * @param deltaX The amount that the plot is dragged
     * @param plotDimensions The dimensions of the plot
     */
    function onPan(deltaX: number, plotDimensions: Dimensions): void {
        if (axesRef.current !== undefined) {
            timeRangeRef.current = calculatePanFor(deltaX, plotDimensions, axesRef.current.xAxis, timeRangeRef.current)
            updatePlot(timeRangeRef.current, plotDimensions)
        }
    }

    /**
     * Renders a tooltip showing the neuron, spike time, and the spike strength when the mouse hovers over a spike.
     * @param datum The datum
     * @param seriesName The name of the series (i.e. the neuron ID)
     * @param segment The SVG line element representing the spike, over which the mouse is hovering.
     */
    function handleShowTooltip(datum: TimeSeries, seriesName: string, segment: SVGPathElement): void {
        if ((tooltipRef.current.visible || magnifierStyle.visible) && containerRef.current && axesRef.current) {
            // grab the time needed for the tooltip ID
            const [x, ] = d3.mouse(containerRef.current)
            const time = Math.round(axesRef.current.xAxis.scale.invert(x - margin.left))

            // Use d3 to select element, change color and size
            d3.select<SVGPathElement, Datum>(segment)
                .attr('stroke', lineStyle.highlightColor)
                .attr('stroke-width', lineStyle.highlightWidth)

            createTooltip(
                `r${time}-${seriesName}-${chartId}`,
                containerRef.current,
                margin,
                tooltipStyle,
                plotDimRef.current,
                () => addTooltipContent(datum, seriesName)
            )
        }
    }

    /**
     * Unselects the time series and removes the tooltip
     * @param seriesName The name of the series (i.e. the neuron ID)
     * @param segment The SVG line element representing the spike, over which the mouse is hovering.
     */
    function handleRemoveTooltip(seriesName?: string, segment?: SVGPathElement) {
        if (segment && seriesName) {
            d3.select<SVGPathElement, Datum>(segment)
                .attr('stroke', colorsRef.current.get(seriesName) || lineStyle.color)
                .attr('stroke-width', lineStyle.lineWidth)
        }
        removeTooltip()
    }

    /**
     * Callback function that adds tooltip content and returns the tooltip width and text height
     * @param datum The spike datum (t ms, s mV)
     * @param seriesName The name of the series (i.e. the neuron ID)
     * @return The width and text height of the tooltip content
     */
    function addTooltipContent(datum: TimeSeries, seriesName: string): TooltipDimensions {
        if (containerRef.current && axesRef.current) {
            const [x, y] = d3.mouse(containerRef.current)
            const time = Math.round(axesRef.current.xAxis.scale.invert(x - margin.left))
            const [lower, upper] = boundingPoints(datum, time)

            // todo...finally, these can be exposed as a callback for the user of the <ScatterChart/>
            // display the neuron ID in the tooltip
            const header = d3.select<SVGSVGElement | null, any>(containerRef.current)
                .append<SVGTextElement>("text")
                .attr('id', `tn${time}-${seriesName}-${chartId.current}`)
                .attr('class', 'tooltip')
                .attr('fill', tooltipRef.current.fontColor)
                .attr('font-family', 'sans-serif')
                .attr('font-size', tooltipRef.current.fontSize)
                .attr('font-weight', tooltipRef.current.fontWeight)
                .text(() => seriesName)


            // create the table that shows the points that come before and after the mouse time, and the
            // changes in the time and value
            const table = d3.select<SVGSVGElement | null, any>(containerRef.current)
                .append("g")
                .attr('id', `t${time}-${seriesName}-header-${chartId.current}`)
                .attr('class', 'tooltip')
                .attr('fill', tooltipRef.current.fontColor)
                .attr('font-family', 'sans-serif')
                .attr('font-size', tooltipRef.current.fontSize + 2)
                .attr('font-weight', tooltipRef.current.fontWeight + 150)


            const headerRow = table.append('g').attr('font-weight', tooltipRef.current.fontWeight + 550)
            const hrLower = headerRow.append<SVGTextElement>("text").text(() => 'before')
            const hrUpper = headerRow.append<SVGTextElement>("text").text(() => 'after')
            const hrDelta = headerRow.append<SVGTextElement>("text").text(() => '∆')

            const trHeader = table.append<SVGTextElement>("text").text(() => 't (ms)')
            const trLower = table.append<SVGTextElement>("text").text(() => formatTime(lower[0]))
            const trUpper = table.append<SVGTextElement>("text").text(() => formatTime(upper[0]))
            const trDelta = table.append<SVGTextElement>("text").text(() => formatTimeChange(lower[0], upper[0]))

            const vrHeader = table.append<SVGTextElement>("text").text(() => tooltipValueLabel)
            const vrLower = table.append<SVGTextElement>("text").text(() => formatValue(lower[1]))
            const vrUpper = table.append<SVGTextElement>("text").text(() => formatValue(upper[1]))
            const vrDelta = table.append<SVGTextElement>("text").text(() => formatValueChange(lower[1], upper[1]))

            const textWidthOf = (elem: TextSelection) => elem.node()?.getBBox()?.width || 0
            const textHeightOf = (elem: TextSelection) => elem.node()?.getBBox()?.height || 0
            const spacesWidthFor = (spaces: number) => spaces * textWidthOf(hrLower) / 5

            // calculate the max width and height of the text
            const tooltipWidth = Math.max(textWidthOf(header), spacesWidthFor(33))
            const headerTextHeight = textHeightOf(header)
            const headerRowHeight = textHeightOf(hrLower)
            const timeRowHeight = textHeightOf(trHeader)
            const valueRowHeight = textHeightOf(vrHeader)
            const textHeight = headerTextHeight + headerRowHeight + timeRowHeight + valueRowHeight

            // set the header text location
            const xTooltip = tooltipX(x, tooltipWidth, plotDimRef.current, tooltipStyle, margin) + tooltipRef.current.paddingLeft
            const yTooltip = tooltipY(y, textHeight, plotDimRef.current, tooltipStyle, margin) + tooltipRef.current.paddingTop
            header
                .attr('x', () => xTooltip)
                .attr('y', () => yTooltip - (headerRowHeight + timeRowHeight + valueRowHeight) + textHeight)


            const hrRowY = yTooltip + headerTextHeight + headerRowHeight
            const hrLowerX = spacesWidthFor(14)
            const hrUpperX = spacesWidthFor(24)
            const hrDeltaX = spacesWidthFor(32)
            hrLower.attr('x', () => xTooltip + hrLowerX - textWidthOf(hrLower)).attr('y', () => hrRowY)
            hrUpper.attr('x', () => xTooltip + hrUpperX - textWidthOf(hrUpper)).attr('y', () => hrRowY)
            hrDelta.attr('x', () => xTooltip + hrDeltaX - textWidthOf(hrDelta)).attr('y', () => hrRowY)

            const trRowY = hrRowY + timeRowHeight
            trHeader.attr('x', () => xTooltip).attr('y', () => trRowY)
            trLower.attr('x', () => xTooltip + hrLowerX - textWidthOf(trLower)).attr('y', () => trRowY)
            trUpper.attr('x', () => xTooltip + hrUpperX - textWidthOf(trUpper)).attr('y', () => trRowY)
            trDelta.attr('x', () => xTooltip + hrDeltaX - textWidthOf(trDelta)).attr('y', () => trRowY)

            const vrRowY = trRowY + valueRowHeight
            vrHeader.attr('x', () => xTooltip).attr('y', () => vrRowY)
            vrLower.attr('x', () => xTooltip + hrLowerX - textWidthOf(vrLower)).attr('y', () => vrRowY)
            vrUpper.attr('x', () => xTooltip + hrUpperX - textWidthOf(vrUpper)).attr('y', () => vrRowY)
            vrDelta.attr('x', () => xTooltip + hrDeltaX - textWidthOf(vrDelta)).attr('y', () => vrRowY)

            return {contentWidth: tooltipWidth, contentHeight: textHeight}
        } else {
            return {contentWidth: 0, contentHeight: 0}
        }
    }

    /**
     * Called when the magnifier is enabled to set up the radial magnifier lens
     * @param svg The path selection
     * holding the magnifier whose properties need to be updated.
     */
    function handleShowMagnify(svg: SvgSelection | undefined) {
        if (containerRef.current && svg && axesRef.current && mainGRef.current && magnifierAxesRef.current) {
            const [mx, my] = d3.mouse(containerRef.current)

            const xScale = axesRef.current.xAxis.generator.scale<ScaleLinear<number, number>>()
            const yScale = axesRef.current.yAxis.generator.scale<ScaleLinear<number, number>>()

            if (mouseInPlotAreaFor(mx, my, margin, {width, height})) {
                showMagnifierLens(
                    chartId.current,
                    mainGRef.current,
                    svg,
                    [mx, my],
                    magnifierStyle,
                    margin,
                    xScale,
                    yScale,
                    magnifierAxesRef.current
                )
            } else {
                hideMagnifierLens(
                    chartId.current,
                    mainGRef.current,
                    svg,
                    xScale,
                    yScale,
                    magnifierAxesRef.current,
                    [mx, my],
                    magnifierStyle
                )
            }
        }
    }

    /**
     * Creates the SVG elements for displaying a radial magnifier lens on the data
     * @param svg The SVG selection
     * @param visible `true` if the lens is visible; `false` otherwise
     * @return The magnifier selection if visible; otherwise undefined
     */
    function magnifierLens(svg: SvgSelection, visible: boolean): RadialMagnifierSelection | undefined {
        if (visible && magnifierRef.current === undefined && containerRef.current !== null && axesRef.current && mainGRef.current) {
            const lens = createMagnifierLens(
                chartId.current, svg, containerRef.current, margin, width, height, magnifierStyle,
                axesRef.current, axisLabelFont, mainGRef.current, tooltipStyle, borderColor
            )

            magnifierAxesRef.current = {...lens.axesSelections}

            svg.on('mousemove', () => handleShowMagnify(svg))

            return lens.magnifierSelection
        }
        // if the magnifier was defined, and is now no longer defined (i.e. props changed, then remove the magnifier)
        else if ((!visible && magnifierRef.current) || tooltipRef.current.visible) {
            svg.on('mousemove', () => null)
            return undefined
        } else if (visible && magnifierRef.current) {
            svg.on('mousemove', () => handleShowMagnify(svg))
        }
        return magnifierRef.current
    }

    /**
     * Creates the SVG elements for displaying a tracker line
     * @param svg The SVG selection
     * @param visible `true` if the tracker is visible; `false` otherwise
     * @return The tracker selection if visible; otherwise undefined
     */
    function trackerControl(svg: SvgSelection, visible: boolean): TrackerSelection | undefined {
        if (visible && containerRef.current) {
            return createTrackerControl(
                chartId.current,
                containerRef.current,
                svg,
                plotDimRef.current,
                margin,
                trackerStyle,
                axisLabelFont,
                x => `${d3.format(",.0f")(axesRef.current!.xAxis.scale.invert(x - margin.left))} ms`
            )
        }
        // if the magnifier was defined, and is now no longer defined (i.e. props changed, then remove the magnifier)
        else if ((!visible && trackerRef.current) || tooltipRef.current.visible) {
            removeTrackerControl(svg)
            return undefined
        }
    }

    /**
     * Updates the plot data for the specified time-range, which may have changed due to zoom or pan
     * @param timeRange The current time range
     * @param plotDimensions The dimensions of the plot
     */
    function updatePlot(timeRange: ContinuousAxisRange, plotDimensions: Dimensions): void {
        timeRangeRef.current = timeRange

        if (containerRef.current && axesRef.current) {
            // select the svg element bind the data to them
            const svg = d3.select<SVGSVGElement, any>(containerRef.current)

            // create the tensor of data (time, value)
            const data: Array<Array<[number, number]>> = Array
                .from(liveDataRef.current.values())
                .map(series => selectInTimeRange(series))

            // calculate and update the min and max values for updating the y-axis. only updates when
            // the min is less than the historical min, and the max is larger than the historical max.
            const [minValue, maxValue] = calcMinMaxValues(data)
            minValueRef.current = minValue
            maxValueRef.current = maxValue

            // update the x and y axes
            axesRef.current.xAxis.update([timeRangeRef.current.start, timeRangeRef.current.end], plotDimensions, margin)
            axesRef.current.yAxis.update([Math.max(minY, minValue), Math.min(maxY, maxValue)], plotDimensions, margin)

            // create/update the magnifier lens if needed
            magnifierRef.current = magnifierLens(svg, magnifierStyle.visible)

            // create/update the tracker line if needed
            trackerRef.current = trackerControl(svg, trackerStyle.visible)

            // set up the main <g> container for svg and translate it based on the margins, but do it only
            // once
            if (mainGRef.current === undefined) {
                mainGRef.current = svg
                    .attr('width', width)
                    .attr('height', height)
                    .attr('color', axisStyle.color)
                    .append<SVGGElement>('g')
            }

            // set up panning
            const drag = d3.drag<SVGSVGElement, Datum>()
                .on("start", () => {
                    // during a pan, we want to hide the tooltip
                    tooltipRef.current.visible = false
                    handleRemoveTooltip()
                    d3.select(containerRef.current).style("cursor", "move")
                })
                .on("drag", () => onPan(d3.event.dx, plotDimensions))
                .on("end", () => {
                    // if the tooltip was originally visible, then allow it to be seen again
                    tooltipRef.current.visible = tooltipStyle.visible
                    d3.select(containerRef.current).style("cursor", "auto")
                })


            svg.call(drag)

            // set up for zooming
            const zoom = d3.zoom<SVGSVGElement, Datum>()
                .scaleExtent([0, 10])
                .translateExtent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
                .on("zoom", () => {
                    onZoom(d3.event.transform, d3.event.sourceEvent.offsetX - margin.left, plotDimensions)
                })


            svg.call(zoom)

            // remove the old clipping region and add a new one with the updated plot dimensions
            svg.select('defs').remove()
            svg
                .append('defs')
                .append("clipPath")
                .attr("id", `clip-series-${chartId.current}`)
                .append("rect")
                .attr("width", plotDimensions.width)
                .attr("height", plotDimensions.height - margin.top)


            liveDataRef.current.forEach((series, name) => {
                const data = selectInTimeRange(series)

                if (data.length === 0) return

                // only show the data for which the filter matches
                // const plotData = (series.name.match(seriesFilterRef.current)) ? data : []
                const plotData = (name.match(seriesFilterRef.current)) ? data : []

                // create the time-series paths
                mainGRef.current!
                    .selectAll(`#${series.name}`)
                    .data([[], plotData], () => `${series.name}`)
                    .join(
                        enter => enter
                            .append("path")
                            .attr("class", 'time-series-lines')
                            .attr("id", `${series.name}`)
                            .attr("d", d3.line()
                                .x((d: [number, number]) => axesRef.current!.xAxis.scale(d[0]))
                                .y((d: [number, number]) => axesRef.current!.yAxis.scale(d[1]))
                            )
                            .attr("fill", "none")
                            // .attr("stroke", lineStyle.color)
                            .attr("stroke", colorsRef.current.get(series.name) || lineStyle.color)
                            .attr("stroke-width", lineStyle.lineWidth)
                            .attr('transform', `translate(${margin.left}, ${margin.top})`)
                            .attr("clip-path", `url(#clip-series-${chartId.current})`)
                            .on(
                                "mouseover",
                                (datumArray, i, group) =>
                                    tooltipRef.current.visible ? handleShowTooltip(datumArray, series.name, group[i]) : null
                            )
                            .on(
                                "mouseleave",
                                (datumArray, i, group) =>
                                    tooltipRef.current.visible ?
                                        handleRemoveTooltip(series.name, group[i]) :
                                        null
                            ),
                        update => update,
                        exit => exit.remove()
                    )
            })
        }
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
    function inTimeRange(datum: Datum, index: number, array: Datum[]): boolean {
        // also want to include the point whose previous or next value are in the time range
        const prevDatum = array[Math.max(0, index - 1)]
        const nextDatum = array[Math.min(index + 1, array.length - 1)]
        return (datum.time >= timeRangeRef.current.start && datum.time <= timeRangeRef.current.end) ||
            (datum.time < timeRangeRef.current.start && nextDatum.time >= timeRangeRef.current.start) ||
            (prevDatum.time <= timeRangeRef.current.end && datum.time > timeRangeRef.current.end)
    }

    /**
     * Returns the data in the time-range and the datum that comes just before the start of the time range.
     * The point before the time range is so that the line draws up to the y-axis, where it is clipped.
     * @param series The series
     * @return An array of (time, value) points that fit within the time range,
     * and the point just before the time range.
     */
    function selectInTimeRange(series: Series): TimeSeries {
        return series.data
            .filter((datum: Datum, index: number, array: Datum[]) => inTimeRange(datum, index, array))
            .map(datum => [datum.time, datum.value])
    }

    /**
     * Subscribes to the observable that streams chart events and hands the subscription a consumer
     * that updates the charts as events enter. Also hands the subscription back to the parent
     * component using the registered {@link onSubscribe} callback method from the properties.
     * @return The subscription (disposable) for cancelling
     */
    function subscribe(): Subscription {
        const subscription = seriesObservable
            .pipe(windowTime(windowingTime))
            .subscribe(dataList => {
                dataList.forEach(data => {
                    // updated the current time to be the max of the new data
                    currentTimeRef.current = data.maxTime

                    // add each new point to it's corresponding series
                    data.newPoints.forEach((newData, name) => {
                        // grab the current series associated with the new data
                        const series = seriesRef.current.get(name) || emptySeries(name)

                        // update the handler with the new data point
                        onUpdateData(name, newData)

                        // add the new data to the series
                        series.data.push(...newData)

                        // drop data that is older than the max time-window
                        while (currentTimeRef.current - series.data[0].time > dropDataAfter) {
                            series.data.shift()
                        }
                    })

                    // update the data
                    liveDataRef.current = seriesRef.current
                    timeRangeRef.current = continuousAxisRangeFor(
                        Math.max(0, currentTimeRef.current - timeWindow),
                        Math.max(currentTimeRef.current, timeWindow)
                    )
                }).then(() => {
                    // updates the caller with the current time
                    onUpdateTime(currentTimeRef.current)

                    updatePlot(timeRangeRef.current, plotDimRef.current)
                })
            })

        // provide the subscription to the caller
        onSubscribe(subscription)

        return subscription
    }

    /**
     * Updates the plot dimensions and then updates the plot
     */
    function updateDimensionsAndPlot(containerWidth: number, containerHeight: number): void {
        plotDimRef.current = plotDimensionsFrom(containerWidth, containerHeight, margin)
        updatePlot(timeRangeRef.current, plotDimRef.current)
    }

    return (
        <svg
            style={{
                ...svgStyle,
                backgroundColor: backgroundColor,
                height: height
            }}
            ref={containerRef}
        />
    )
}

/**
 * Constructs a spectrum of colors, one for each time-series, starting with the `startColor` and interpolating
 * to the `stopColor`.
 * @param series The array holding the time-series
 * @param startColor The "start" color for the interpolation
 * @param stopColor The "stop" color for the interpolation
 * @return {Map<string, string>} A map of the series name and associated colors
 */
export function seriesColorsFor(series: Array<Series>, startColor: string, stopColor: string): Map<string, string> {
    return new Map(d3
        .quantize(d3.interpolateHcl(startColor, stopColor), series.length)
        .map((color, index) => [series[index].name, color]) as Array<[string, string]>
    )
}
