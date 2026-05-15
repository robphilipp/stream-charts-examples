import {useEffect, useMemo} from "react"
import * as d3 from "d3"
import {useChart} from "../hooks/useChart"
import {usePlotDimensions} from "../hooks/usePlotDimensions"
import type {ContinuousNumericAxis, SeriesLineStyle} from "../axes/axes"
import {ContinuousAxisRange} from "../axes/ContinuousAxisRange"
import {
    defaultTooltipStyle,
    textHeightFor, textWidthFor,
    type TooltipDimensions,
    type TooltipStyle,
    tooltipX,
    tooltipY
} from "./tooltipUtils"
import type {TooltipData} from "../hooks/useTooltip"
import type {OutlierBandTooltipMetadata} from "../plots/OutlierPlot"
import type {OutlierDatum} from "../series/outlierSeries"
import type {Dimensions, Margin} from "../styling/margins"

export interface Props {
    style?: Partial<TooltipStyle>
}

/**
 * Registers a tooltip content provider for {@link OutlierPlot} bands. When the user hovers over
 * a band, the tooltip shows the measure associated with the band along with the implied outlier
 * probabilities for points inside and outside the band.
 *
 * Must be rendered as a child of a {@link Tooltip} inside a {@link Chart} that contains an
 * {@link OutlierPlot}.
 */
export function OutlierPlotTooltipContent(props: Props): null {
    const {
        chartId,
        container,
        tooltip
    } = useChart<OutlierDatum<readonly number[]>, SeriesLineStyle, OutlierBandTooltipMetadata, ContinuousAxisRange, ContinuousNumericAxis>()

    const {registerTooltipContentProvider} = tooltip

    const {
        margin,
        plotDimensions
    } = usePlotDimensions()

    const tooltipStyle = useMemo(
        () => ({
            ...defaultTooltipStyle,
            ...props.style
        }),
        [props.style]
    )

    useEffect(
        () => {
            if (container) {
                registerTooltipContentProvider(
                    (
                        seriesName: string,
                        time: number,
                        tooltipData: TooltipData<OutlierDatum<readonly number[]>, OutlierBandTooltipMetadata>,
                        mouseCoords: [x: number, y: number]
                    ) => addTooltipContent(
                        seriesName, time, tooltipData.metadata, mouseCoords,
                        chartId, container, margin, plotDimensions, tooltipStyle
                    )
                )
            }
        },
        [chartId, container, margin, plotDimensions, registerTooltipContentProvider, tooltipStyle]
    )

    return null
}

function addTooltipContent(
    seriesName: string,
    time: number,
    metadata: OutlierBandTooltipMetadata,
    mouseCoords: [x: number, y: number],
    chartId: number,
    container: SVGSVGElement,
    margin: Margin,
    plotDimensions: Dimensions,
    tooltipStyle: TooltipStyle,
): TooltipDimensions {
    const {
        measure,
        lowerMeasure = 0,
        pointsInBand
    } = metadata
    const outerProb = ((1 - measure) * 100).toFixed(1)
    const innerProb = ((measure - lowerMeasure) * 100).toFixed(1)
    const [x, y] = mouseCoords

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mainGroup = d3.select<SVGSVGElement | null, any>(container)
    const idPrefix = `ob${time}-${seriesName}-${chartId}`

    const header = createTextElement(
        mainGroup,
        `${idPrefix}-h`,
        {...tooltipStyle, fontWeight: tooltipStyle.fontWeight + 300},
        `Series: ${seriesName}`
    )
    const measureText = createTextElement(
        mainGroup,
        `${idPrefix}-m`,
        tooltipStyle,
        `Measure: ${measure}`
    )
    const explanation = createTextElement(
        mainGroup,
        `${idPrefix}-o`,
        tooltipStyle,
        `Points have a ${innerProb}% of being in this band, and a ${outerProb}% probability of being outside this band`
    )
    const countText = createTextElement(
        mainGroup,
        `${idPrefix}-c`,
        tooltipStyle,
        `Points in band: ${pointsInBand}`
    )

    const lineHeight = textHeightFor(header)
    const contentWidth = Math.max(
        textWidthFor(header), textWidthFor(measureText),
        textWidthFor(explanation), textWidthFor(countText)
    )
    const contentHeight = lineHeight * 4

    const xCoord = tooltipX(x, contentWidth, plotDimensions, tooltipStyle, margin)
    const yCoord = tooltipY(y, contentHeight, plotDimensions, tooltipStyle, margin)
    const xTip = xCoord + tooltipStyle.paddingLeft
    const yTip = yCoord + tooltipStyle.paddingTop + lineHeight

    header.attr("x", xTip).attr("y", yTip)
    measureText.attr("x", xTip).attr("y", yTip + lineHeight)
    explanation.attr("x", xTip).attr("y", yTip + lineHeight * 2)
    countText  .attr("x", xTip).attr("y", yTip + lineHeight * 3)

    return {x: xCoord, y: yCoord, contentWidth, contentHeight}
}

/**
 * Creates a text element with the given style and content.
 * @param mainGroup The SVG group holding the plot container
 * @param id The id of the text element
 * @param style The style of the text element
 * @param content The content of the text element
 * @return The SVG text element
 */
function createTextElement(mainGroup: d3.Selection<SVGSVGElement | null, unknown, null, undefined>, id: string, style: TooltipStyle, content: string): d3.Selection<SVGTextElement, unknown, null, undefined> {
    return mainGroup.append<SVGTextElement>("text")
        .attr("id", id)
        .attr("class", "tooltip")
        .attr("fill", style.fontColor)
        .attr("font-family", "sans-serif")
        .attr("font-size", style.fontSize)
        .attr("font-weight", style.fontWeight)
        .text(content)
}
