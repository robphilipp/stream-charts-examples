import {Dimensions, Margin} from "../styling/margins";
import {
    defaultTooltipStyle,
    findPointAndNeighbors,
    TooltipDimensions,
    TooltipStyle,
    tooltipX,
    tooltipY
} from "./tooltipUtils";
import {formatTime, formatTimeChange, formatValue, formatValueChange} from "../utils";
import {useEffect, useMemo} from "react";
import {NoTooltipMetadata, useChart} from "../hooks/useChart";
import {usePlotDimensions} from "../hooks/usePlotDimensions";
import {emptyIterateDatum, IterateDatum} from "../series/iterateSeries";
import {SeriesLineStyle} from "../axes/axes";
import {TooltipData} from "../hooks/useTooltip";
import {TableData} from "./v2/tableData";
import {DataFrame} from "data-frame-ts";
import {TableFormatter} from "./v2/tableFormatter";
import {defaultColumnHeaderStyle, defaultColumnStyle, TableStyler} from "./v2/tableStyler";
import {createTable} from "./v2/tableSvg";
import {defaultTablePadding} from "./tableStyle";

/**
 # Want to write your own tooltip-content component?

 Here's how to write your own tooltip-content component.

 To create your own tooltip content `<MyTooltipContent/>` you must do the following:
 1. Create a react component for your tooltip content (see for example, {@link PoincarePlotTooltipContent}
 as a reference.
 2. Use the {@link useChart} hook to get the {@link registerTooltipContentProvider} registration function.
 3. When your tooltip content component (`<MyTooltipContent/>`) mounts, use the {@link registerTooltipContentProvider}
 function to register your tooltip content provider.
 4. When the chart dimensions, margin, container, etc, change, register your tooltip content provider
 again (you can register as many times as you like because it only uses the last content provider
 registered).

 That's it! A bit more details below.

 The {@link registerTooltipContentProvider} function from the {@link useChart} hook allows you to register
 one tooltip content provider. A second call to this function will cause the {@link useChart} hook to drop
 the first one in favor of the second one.

 The {@link registerTooltipContentProvider} function from the {@link useChart} hook accepts a higher-order
 function that allowing a closure on content/chart-specific data. Specifically, you must hand the
 {@link registerTooltipContentProvider} a function of the form:

 `(seriesName: string, time: number, series: TimeSeries, mouseCoords: [x: number, y: number]) => TooltipDimensions`

 Your function to add that actual content will be what this function calls whenever d3 fires a mouse-over
 event on one you the time-series in the chart.

 The code snippet below is from the `useEffect` call in the {@link PoincarePlotTooltipContent}.
 Note that the first four arguments to the {@link addTooltipContent} function are those provided by the {@link useChart} hook
 when a d3 mouse-over event occurs on one of your series. The additional six arguments are from the closure formed
 on the variables in your component. The `chartId`, `container`, `margin`, and `plotDimensions` are from the
 {@link useChart} hook called by the {@link PoincarePlotTooltipContent} component. The last two
 arguments, `defaultTooltipStyle` and `options` are specific to the {@link PoincarePlotTooltipContent}.
 For example, the `options` property is set by the caller of the {@link PoincarePlotTooltipContent}
 component.

 ```ts
 // register the tooltip content provider function with the chart hook (useChart) so that
 // it is visible to all children of the Chart (i.e. the <Tooltip>).
 registerTooltipContentProvider(
 (seriesName: string, time: number, series: TimeSeries, mouseCoords: [x: number, y: number]) =>
 addTooltipContent(
 seriesName, time, series, mouseCoords,
 chartId, container, margin, plotDimensions,
 defaultTooltipStyle, options
 )
 )
 ```

 This pattern allows you to supplement that `useChart` mouse-over callback with information specific to you component.

 */

/**
 * Options for displaying the tooltip content. These options are specific to this
 * particular implementation of a tooltip content. The options effect are applied
 * as shown below.
 * ```
 * series name
 *            headers.before       headers.after         headers.delta
 * labels.x   formatters.x.value   formatters.x.value    formatters.x.change
 * labels.y   formatters.y.value   formatters.y.value    formatters.y.change
 * ```
 */
interface TooltipOptions {
    labels: { x: string, y: string }
    headers: { nMinusLag: string, n: string, nPlusLag: string }
    formatters: {
        x: { value: (value: number) => string, change: (value1: number, value2: number) => string },
        y: { value: (value: number) => string, change: (value1: number, value2: number) => string },
    }
}

/**
 * Properties for rendering the tooltip content. The properties are applied as
 * shown below.
 * ```
 * series name
 *          beforeHeader      afterHeader        deltaHeader
 * xLabel   xValueFormatter   xValueFormatter    xChangeFormatter
 * yLabel   yValueFormatter   yValueFormatter    yChangeFormatter
 * ```
 */
interface Props {
    // label for the x-values (x-value row header)
    xLabel: string
    yLabel: string
    nMinusLagHeader?: string
    nHeader?: string
    nPlusLagHeader?: string
    xValueFormatter?: (value: number) => string
    yValueFormatter?: (value: number) => string
    xChangeFormatter?: (value1: number, value2: number) => string,
    yChangeFormatter?: (value1: number, value2: number) => string,
    style?: Partial<TooltipStyle>
}

/**
 * Adds tooltip content as a table. The columns of the table are the "label", the value before
 * the mouse cursor, then value after the mouse cursor, and the difference between the two values.
 * The rows of the table are x-values for the first row, and the y-values for the second row.
 * The table has the following form.
 * ```
 * series name
 *            before     after         ∆
 * x-label     x_tb      x_ta       x_ta - x_tb
 * y-label     y_tb      y_ta       y_ta - y_tb
 * ```
 *
 * Registers the tooltip-content provider with the `ChartContext` so that when d3 fires a mouse-over
 * event on a series. The content provider is returns the {@link addTooltipContent} function
 * when called. And when called the {@link addTooltipContent} function adds the actual tooltip
 * content to the SVG element.
 * @param props The properties describing the tooltip content
 * @return null
 * @constructor
 */
export function PoincarePlotTooltipContent(props: Props): null {
    const {
        chartId,
        container,
        tooltip
    } = useChart<IterateDatum, SeriesLineStyle, NoTooltipMetadata>()

    const {registerTooltipContentProvider} = tooltip

    const {
        margin,
        plotDimensions,
    } = usePlotDimensions()

    const {
        xLabel,
        yLabel,
        nMinusLagHeader = ' f[n-1](x)',
        nHeader = ' f[n](x)  ',
        nPlusLagHeader = ' f[n+1](x)',
        xValueFormatter = formatTime,
        yValueFormatter = formatValue,
        xChangeFormatter = formatTimeChange,
        yChangeFormatter = formatValueChange,
        style,
    } = props

    const tooltipStyle = useMemo(() => ({...defaultTooltipStyle, ...style}), [style])

    // register the tooltip content provider, which when called on mouse-enter-series events
    // will render the tooltip container and then the tooltip content. recall that the
    // tooltip content is generated in this plot (because this is the plot that holds all the
    // information needed to render it), and the container for the content is rendered by
    // the <Tooltip>, which this know nothing about.
    //
    // the 'registration function accepts a function of the form (seriesName, time, series) => TooltipDimensions.
    // and that function has a closure on the content-specific information needed to add the
    // actual content
    useEffect(
        () => {
            if (container) {
                // assemble the options for adding the tooltip
                const options: TooltipOptions = {
                    labels: {x: xLabel, y: yLabel},
                    headers: {nMinusLag: nMinusLagHeader, n: nHeader, nPlusLag: nPlusLagHeader},
                    formatters: {
                        x: {value: xValueFormatter, change: xChangeFormatter},
                        y: {value: yValueFormatter, change: yChangeFormatter},
                    }
                }

                // register the tooltip content provider function with the chart hook (useChart) so that
                // it is visible to all children of the Chart (i.e. the <Tooltip>).
                registerTooltipContentProvider(
                    (seriesName: string, time: number, tooltipData: TooltipData<IterateDatum, NoTooltipMetadata>, mouseCoords: [x: number, y: number]) =>
                        addTooltipContent(
                            seriesName, time, tooltipData, mouseCoords,
                            chartId, container, margin, plotDimensions, tooltipStyle,
                            options
                        )
                )
            }
        },
        [
            chartId, container, margin, plotDimensions, registerTooltipContentProvider,
            xLabel, xChangeFormatter, xValueFormatter,
            yLabel, yChangeFormatter, yValueFormatter,
            nMinusLagHeader, nHeader, nPlusLagHeader,
            tooltipStyle
        ]
    )

    return null
}

/**
 * Callback function that adds tooltip content and returns the tooltip width and text height
 * @param seriesName The name of the series (i.e. the neuron ID)
 * @param time The time (x-coordinate value) corresponding to the mouse location
 * @param tooltipData The series data and metadata
 * @param mouseCoords The coordinates of the mouse when the event was fired (relative to the plot container)
 * @param chartId The ID of this chart
 * @param container The plot container (SVGSVGElement)
 * @param margin The plot margins
 * @param tooltipStyle The style properties for the tooltip
 * @param plotDimensions The dimensions of the plot
 * @param options The options passed through the function that adds the tooltip content
 * @return The width and text height of the tooltip content
 */
function addTooltipContent(
    seriesName: string,
    time: number,
    tooltipData: TooltipData<IterateDatum, NoTooltipMetadata>,
    mouseCoords: [x: number, y: number],
    chartId: number,
    container: SVGSVGElement,
    margin: Margin,
    plotDimensions: Dimensions,
    tooltipStyle: TooltipStyle,
    options: TooltipOptions
): TooltipDimensions {
    const [x, y] = mouseCoords
    const {series} = tooltipData
    const [lower, point, upper, index] = findPointAndNeighbors(
        series, time, 0.1, value => value.time, () => emptyIterateDatum
    )

    // display the neuron ID in the tooltip
    // const header = d3.select<SVGSVGElement | null, any>(container)
    //     .append<SVGTextElement>("text")
    //     .attr('id', `tn${time}-${seriesName}-${chartId}`)
    //     .attr('class', 'tooltip')
    //     .style('fill', tooltipStyle.fontColor)
    //     .style('font-family', 'sans-serif')
    //     .style('font-size', tooltipStyle.fontSize)
    //     .style('font-weight', tooltipStyle.fontWeight)
    //     .text(() => seriesName)

    return DataFrame
        .from<number | string>([
            [lower.time, point.time, upper.time],
            [lower.iterateN_1, point.iterateN_1, upper.iterateN_1]
        ])
        // create the table data that has the column headers
        .flatMap(df => TableData
            .fromDataFrame(df)
            .withColumnHeader([
                index > 0 ? `f[${index - 1}](x)` : '- n/a -',
                `f[${index}](x)`,
                index < series.length - 1 ? `f[${index + 1}](x)` : '- n/a -'
            ])
            // .flatMap(td => td.withRowHeader(['(ms)', ' ']))
        )
        // add the dat formatters for the (x, y) values of the iterates
        .flatMap(tableData => TableFormatter.fromTableData(tableData)
            .addRowFormatter(1, value => formatTime(value as number, "ms"))
            // .addRowFormatter(1, value => `${formatTime(value as number)} ms`)
            .flatMap(tf => tf.addRowFormatter(2, value => formatValue(value as number)))
            .flatMap(tf => tf.formatTable())
        )
        .map(tableData => TableStyler.fromTableData(tableData)
            .withPadding({...defaultTablePadding, top: 20, left: 20})
            .withColumnHeaderStyle({...defaultColumnHeaderStyle, padding: {top: 0, bottom: 10}, dimension: {...defaultColumnHeaderStyle.dimension, maxHeight: 70}, alignText: 'center', background: {color: 'grey', opacity: 0.25}}, 10)
            .withColumnStyles([0, 1, 2], {...defaultColumnStyle, padding: {left: 10, right: 10}, alignText: 'right'})
            .styleTable()
        )
        .flatMap(styledTable =>
            createTable(styledTable, container, `t${time}-${seriesName}-header-${chartId}`, tooltipCoordinates)
        )
        .map(renderingInfo => {
            const {tableX: x, tableY: y, tableWidth: contentWidth, tableHeight: contentHeight} = renderingInfo
            return {x, y, contentWidth, contentHeight}
        })
        .getOrThrow()

    /**
     * Calculates the coordinates of the tooltip based on the width and height of the SVG
     * table. This is needed because the tooltip needs to be adjusted relative mouse location
     * when the mouse coordinates are too close to an edge.
     * @param width The SVG table width
     * @param height The SVG table height
     * @return The updated tooltip coordinates
     */
    function tooltipCoordinates(width: number, height: number): [x: number, y: number] {
        return [
            tooltipX(x, width, plotDimensions, tooltipStyle, margin),
            tooltipY(y, height, plotDimensions, tooltipStyle, margin)
        ]
    }

}
