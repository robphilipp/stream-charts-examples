import {BaseAxis, defaultLineStyle, SeriesLineStyle, SeriesStyle} from "../axes/axes";
import {BaseAxisRange} from "../axes/BaseAxisRange";
import {usePlotDimensions} from "../hooks/usePlotDimensions";
import {useChart} from "../hooks/useChart";
import {useInitialData} from "../hooks/useInitialData";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
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
     * Ignored when `container` is provided.
     * @default "top-right"
     */
    location?: LegendLocation
    /** Style overrides for the legend */
    style?: Partial<LegendStyle>
    /**
     * Optional offset in pixels from the chosen corner, applied after the margin.
     * Ignored when `container` is provided.
     * @default { x: 10, y: 10 }
     */
    offset?: { x: number; y: number }
    /**
     * When provided, the legend renders as an HTML element portalled into this
     * external container instead of inside the chart SVG. Position the container
     * however you like — the legend fills it.
     */
    container?: React.RefObject<HTMLElement | null>
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
): React.ReactElement | null {
    const { visible, location = "top-right", offset = { x: 10, y: 10 }, style, container: externalContainer } = props

    const { chartId, container, color, seriesStyles, seriesFilter, mouse } = useChart<D, S, TM, AR, A>()
    const { margin, plotDimensions } = usePlotDimensions()
    const { initialData } = useInitialData<any, D>()

    const legendStyle = useMemo<LegendStyle>(
        () => ({ ...defaultLegendStyle, ...style }),
        [style]
    )

    // Refs don't trigger re-renders when populated, so track readiness in state
    const [externalContainerReady, setExternalContainerReady] = useState(false)
    useEffect(() => {
        setExternalContainerReady(!!externalContainer?.current)
    }, [externalContainer])

    // Track the currently-hovered series name so legend entries can be highlighted
    const [hoveredSeriesName, setHoveredSeriesName] = useState<string | null>(null)
    useEffect(() => {
        const handlerId = `legend-${chartId}`
        mouse.registerMouseOverHandler(handlerId, seriesName => setHoveredSeriesName(seriesName))
        mouse.registerMouseLeaveHandler(handlerId, () => setHoveredSeriesName(null))
        return () => {
            mouse.unregisterMouseOverHandler(handlerId)
            mouse.unregisterMouseLeaveHandler(handlerId)
        }
    }, [chartId, mouse])

    // Keep a ref so D3 closures in the SVG legend always read current styles
    const seriesStylesRef = useRef(seriesStyles)
    seriesStylesRef.current = seriesStyles

    const highlightSeriesInPlot = (name: string) => {
        if (!container) return
        const { highlightColor, highlightWidth } = (seriesStylesRef.current.get(name) as SeriesLineStyle | undefined) || defaultLineStyle()
        d3.select(container).selectAll<SVGPathElement, unknown>(`[data-series-name="${name}"]`)
            .attr('stroke', highlightColor)
            .attr('stroke-width', highlightWidth)
    }

    const restoreSeriesInPlot = (name: string) => {
        if (!container) return
        const { color, lineWidth } = (seriesStylesRef.current.get(name) as SeriesLineStyle | undefined) || defaultLineStyle()
        d3.select(container).selectAll<SVGPathElement, unknown>(`[data-series-name="${name}"]`)
            .attr('stroke', color)
            .attr('stroke-width', lineWidth)
    }

    // Derive the filtered list of series names
    const visibleSeriesNames = useMemo(
        () => initialData.map(s => s.name).filter(name => seriesFilter.test(name)),
        [initialData, seriesFilter]
    )

    useEffect(
        () => {
            if (!container) return
            if (externalContainer) return // SVG legend not used when rendering outside

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

                const rowG = legendG
                    .append("g")
                    .attr("class", "legend-row")
                    .attr("data-series-name", name)
                    .style("cursor", "default")
                    .on("mouseover", () => {
                        setHoveredSeriesName(name)
                        highlightSeriesInPlot(name)
                    })
                    .on("mouseleave", () => {
                        setHoveredSeriesName(null)
                        restoreSeriesInPlot(name)
                    })

                // Color swatch — a short horizontal line to mimic series appearance
                rowG
                    .append("line")
                    .attr("x1", padding)
                    .attr("y1", swatchMidY)
                    .attr("x2", padding + swatchWidth)
                    .attr("y2", swatchMidY)
                    .attr("stroke", seriesColor)
                    .attr("stroke-width", swatchHeight)
                    .attr("stroke-linecap", "round")

                // Series name label
                rowG
                    .append("text")
                    .attr("x", padding + swatchWidth + swatchLabelGap)
                    .attr("y", swatchMidY)
                    .attr("dominant-baseline", "middle")
                    .attr("data-series-name", name)
                    .style("font-size", `${fontSize}px`)
                    .style("font-family", fontFamily)
                    .style("fill", fontColor)
                    .text(name)
            })
        },
        [
            visible,
            container,
            externalContainer,
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

    // Update SVG row opacity when the hovered series changes
    useEffect(() => {
        if (!container || externalContainer) return
        const legendG = d3.select(container).select(`#${LEGEND_CONTAINER_ID_PREFIX}-${chartId}`)
        if (legendG.empty()) return
        legendG.selectAll<SVGGElement, unknown>("g.legend-row")
            .style("opacity", function() {
                if (hoveredSeriesName === null) return 1
                return d3.select(this).attr("data-series-name") === hoveredSeriesName ? 1 : 0.35
            })
        legendG.selectAll<SVGTextElement, unknown>("text[data-series-name]")
            .style("font-weight", function() {
                const name: string = d3.select(this).attr("data-series-name")
                return hoveredSeriesName !== null && name === hoveredSeriesName ? "bold" : "normal"
            })
    }, [hoveredSeriesName, container, externalContainer, chartId])

    // HTML portal legend — rendered outside the SVG into an external container
    if (externalContainerReady && externalContainer?.current && visible && visibleSeriesNames.length > 0) {
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

        const bg = d3.color(backgroundColor)
        const bgWithOpacity = bg
            ? `rgba(${(bg as d3.RGBColor).r},${(bg as d3.RGBColor).g},${(bg as d3.RGBColor).b},${backgroundOpacity})`
            : backgroundColor
        const bd = d3.color(borderColor)
        const bdWithOpacity = bd
            ? `rgba(${(bd as d3.RGBColor).r},${(bd as d3.RGBColor).g},${(bd as d3.RGBColor).b},${borderOpacity})`
            : borderColor

        const boxStyle: React.CSSProperties = {
            display: "inline-flex",
            flexDirection: "column",
            gap: rowGap,
            backgroundColor: bgWithOpacity,
            border: `${borderWidth}px solid ${bdWithOpacity}`,
            borderRadius,
            padding,
            fontFamily,
            fontSize,
            color: fontColor,
            boxSizing: "border-box",
        }

        const anyHovered = hoveredSeriesName !== null
        return createPortal(
            <div style={boxStyle}>
                {visibleSeriesNames.map(name => {
                    const seriesColor = seriesStyles.get(name)?.color ?? color
                    const isHovered = name === hoveredSeriesName
                    const rowStyle: React.CSSProperties = {
                        display: "flex",
                        alignItems: "center",
                        gap: swatchLabelGap,
                        opacity: anyHovered && !isHovered ? 0.35 : 1,
                        fontWeight: isHovered ? "bold" : "normal",
                        transition: "opacity 0.15s, font-weight 0s",
                    }
                    return (
                        <div
                            key={name}
                            style={{...rowStyle, cursor: "default"}}
                            onMouseEnter={() => {
                                setHoveredSeriesName(name)
                                highlightSeriesInPlot(name)
                            }}
                            onMouseLeave={() => {
                                setHoveredSeriesName(null)
                                restoreSeriesInPlot(name)
                            }}
                        >
                            <span style={{
                                display: "inline-block",
                                width: swatchWidth,
                                height: swatchHeight,
                                backgroundColor: seriesColor,
                                borderRadius: swatchHeight / 2,
                                flexShrink: 0,
                            }} />
                            <span>{name}</span>
                        </div>
                    )
                })}
            </div>,
            externalContainer.current
        )
    }

    return null
}