import {BaseAxis, SeriesStyle} from "../axes/axes";
import {BaseAxisRange} from "../axes/BaseAxisRange";
import {usePlotDimensions} from "../hooks/usePlotDimensions";
import {useChart} from "../hooks/useChart";
import {useInitialData} from "../hooks/useInitialData";
import {useEffect, useMemo } from "react";
import * as d3 from "d3";

export type LegendLocation = "top-left" | "top-right" | "bottom-left" | "bottom-right"

export interface LegendStyle {
    /** Font size for the legend labels */
    fontSize: number
    /** Font family for the legend labels */
    fontFamily: string
    /** Font color for the legend labels */
    fontColor: string
    /** Background fill color for the legend box */
    backgroundColor: string
    /** Background opacity for the legend box */
    backgroundOpacity: number
    /** Border/stroke color for the legend box */
    borderColor: string
    /** Border width for the legend box */
    borderWidth: number
    /** Border opacity for the legend box */
    borderOpacity: number
    /** Corner radius of the legend box */
    borderRadius: number
    /** Padding inside the legend box (in pixels) */
    padding: number
    /** Vertical space between legend entries */
    rowGap: number
    /** Width of the color swatch next to each label */
    swatchWidth: number
    /** Height of the color swatch next to each label */
    swatchHeight: number
    /** Gap between the swatch and the label text */
    swatchLabelGap: number
}

export const defaultLegendStyle: LegendStyle = {
    fontSize: 12,
    fontFamily: "sans-serif",
    fontColor: "#d2933f",
    backgroundColor: "#202020",
    backgroundOpacity: 0.85,
    borderColor: "#d2933f",
    borderWidth: 1,
    borderOpacity: 0.7,
    borderRadius: 4,
    padding: 8,
    rowGap: 6,
    swatchWidth: 16,
    swatchHeight: 3,
    swatchLabelGap: 6,
}

interface Props {
    /** Whether the legend is visible */
    visible: boolean
    /**
     * Where to anchor the legend within the plot area.
     * @default "top-right"
     */
    location?: LegendLocation
    /** Style overrides for the legend */
    style?: Partial<LegendStyle>
    /**
     * Optional offset in pixels from the chosen corner, applied after the margin.
     * @default { x: 10, y: 10 }
     */
    offset?: { x: number; y: number }
}

const LEGEND_CONTAINER_ID_PREFIX = "stream-charts-legend"

/**
 * A legend component that can be placed inside any `<Chart>` alongside any Plot.
 * It automatically reads the series names from the initial data and their colors
 * from the `seriesStyles` map (falling back to the chart's base `color`).
 * The legend respects the active `seriesFilter`, showing only the matching series.
 *
 * @example
 * ```tsx
 * <Chart ...>
 *   <ContinuousAxis ... />
 *   <ScatterPlot ... />
 *   <Legend visible={true} location="top-right" />
 * </Chart>
 * ```
 */
export function Legend<D, S extends SeriesStyle, TM, AR extends BaseAxisRange, A extends BaseAxis>(
    props: Props
): null {
    const { visible, location = "top-right", offset = { x: 10, y: 10 }, style } = props

    const { chartId, container, color, seriesStyles, seriesFilter } = useChart<D, S, TM, AR, A>()
    const { margin, plotDimensions } = usePlotDimensions()
    const { initialData } = useInitialData<any, D>()

    const legendStyle = useMemo<LegendStyle>(
        () => ({ ...defaultLegendStyle, ...style }),
        [style]
    )

    // Derive the filtered list of series names
    const visibleSeriesNames = useMemo(
        () => initialData.map(s => s.name).filter(name => seriesFilter.test(name)),
        [initialData, seriesFilter]
    )

    useEffect(
        () => {
            if (!container) return

            const legendId = `${LEGEND_CONTAINER_ID_PREFIX}-${chartId}`
            const svg = d3.select<SVGSVGElement, unknown>(container)

            // Remove any existing legend before redrawing
            svg.select(`#${legendId}`).remove()

            if (!visible || visibleSeriesNames.length === 0) return

            const {
                fontSize,
                fontFamily,
                fontColor,
                backgroundColor,
                backgroundOpacity,
                borderColor,
                borderWidth,
                borderOpacity,
                borderRadius,
                padding,
                rowGap,
                swatchWidth,
                swatchHeight,
                swatchLabelGap,
            } = legendStyle

            const rowHeight = Math.max(swatchHeight, fontSize)
            const totalRows = visibleSeriesNames.length
            const contentHeight = totalRows * rowHeight + (totalRows - 1) * rowGap
            const boxHeight = contentHeight + 2 * padding

            // Use a temporary hidden SVG text element to measure max label width
            const tempText = svg
                .append<SVGTextElement>("text")
                .style("font-size", `${fontSize}px`)
                .style("font-family", fontFamily)
                .style("visibility", "hidden")

            let maxLabelWidth = 0
            visibleSeriesNames.forEach(name => {
                tempText.text(name)
                const w = tempText.node()?.getBBox().width ?? name.length * (fontSize * 0.6)
                if (w > maxLabelWidth) maxLabelWidth = w
            })
            tempText.remove()

            const boxWidth = padding + swatchWidth + swatchLabelGap + maxLabelWidth + padding

            // Determine the (x, y) position of the legend box within the SVG (plot area coordinates)
            const plotLeft = margin.left
            const plotTop = margin.top
            const plotRight = margin.left + plotDimensions.width
            const plotBottom = margin.top + plotDimensions.height

            let boxX: number
            let boxY: number

            switch (location) {
                case "top-left":
                    boxX = plotLeft + offset.x
                    boxY = plotTop + offset.y
                    break
                case "top-right":
                    boxX = plotRight - boxWidth - offset.x
                    boxY = plotTop + offset.y
                    break
                case "bottom-left":
                    boxX = plotLeft + offset.x
                    boxY = plotBottom - boxHeight - offset.y
                    break
                case "bottom-right":
                default:
                    boxX = plotRight - boxWidth - offset.x
                    boxY = plotBottom - boxHeight - offset.y
                    break
            }

            // Create the legend container group
            const legendG = svg
                .append<SVGGElement>("g")
                .attr("id", legendId)
                .attr("transform", `translate(${boxX}, ${boxY})`)

            // Background box
            legendG
                .append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", boxWidth)
                .attr("height", boxHeight)
                .attr("rx", borderRadius)
                .attr("fill", backgroundColor)
                .attr("fill-opacity", backgroundOpacity)
                .attr("stroke", borderColor)
                .attr("stroke-width", borderWidth)
                .attr("stroke-opacity", borderOpacity)

            // Legend rows
            visibleSeriesNames.forEach((name, i) => {
                const seriesColor = seriesStyles.get(name)?.color ?? color
                const rowY = padding + i * (rowHeight + rowGap)
                const swatchMidY = rowY + rowHeight / 2

                // Color swatch — a short horizontal line to mimic series appearance
                legendG
                    .append("line")
                    .attr("x1", padding)
                    .attr("y1", swatchMidY)
                    .attr("x2", padding + swatchWidth)
                    .attr("y2", swatchMidY)
                    .attr("stroke", seriesColor)
                    .attr("stroke-width", swatchHeight)
                    .attr("stroke-linecap", "round")

                // Series name label
                legendG
                    .append("text")
                    .attr("x", padding + swatchWidth + swatchLabelGap)
                    .attr("y", swatchMidY)
                    .attr("dominant-baseline", "middle")
                    .style("font-size", `${fontSize}px`)
                    .style("font-family", fontFamily)
                    .style("fill", fontColor)
                    .text(name)
            })
        },
        [
            visible,
            container,
            chartId,
            visibleSeriesNames,
            legendStyle,
            location,
            offset,
            margin,
            plotDimensions,
            color,
            seriesStyles,
        ]
    )

    return null
}