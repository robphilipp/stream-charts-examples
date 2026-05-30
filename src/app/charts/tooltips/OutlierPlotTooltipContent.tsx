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
        datum,
        upperMeasure = 1,
        lowerMeasure = 0,
        pointsInBand,
        measureDescription
    } = metadata
    const outerProb = ((1 - upperMeasure) * 100).toFixed(1)
    const innerProb = ((upperMeasure - lowerMeasure) * 100).toFixed(1)
    const [x, y] = mouseCoords

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mainGroup = d3.select<SVGSVGElement | null, any>(container)
    const idPrefix = `ob${time}-${seriesName}-${chartId}`

    // create the text elements that get displayed in the tooltip
    const elements: Array<d3.Selection<SVGTextElement, unknown, null, undefined>> = []
    const header = createTextElement(
        mainGroup,
        `${idPrefix}-h`,
        {...tooltipStyle, fontWeight: tooltipStyle.fontWeight + 300},
        `Series: ${seriesName}`
    )
    elements.push(header)
    if (datum) {
        elements.push(createTextElement(
            mainGroup,
            `${idPrefix}-p`,
            tooltipStyle,
            `(${datum.datum.x}, ${datum.datum.y})`
        ))
    }
    const measureText = createTextElement(
        mainGroup,
        `${idPrefix}-m`,
        tooltipStyle,
        `Band: ` + (lowerMeasure ? `${lowerMeasure} - ` : ``) + `${upperMeasure}`
    )
    elements.push(measureText)
    let explanation = createTextElement(
        mainGroup,
        `${idPrefix}-o`,
        tooltipStyle,
        `Points have a ${innerProb}% of being in this band, and a ${outerProb}% probability of being outside this band`
    )
    if (measureDescription) {
        explanation = createTextElement(mainGroup, `${idPrefix}-o`, tooltipStyle, measureDescription)
    }
    elements.push(explanation)
    const countText = createTextElement(
        mainGroup,
        `${idPrefix}-c`,
        tooltipStyle,
        `Points in band: ${pointsInBand}`
    )
    elements.push(countText)

    // tooltip dimensions
    const lineHeight = textHeightFor(header)
    const contentWidth = Math.max(
        textWidthFor(header), textWidthFor(measureText),
        textWidthFor(explanation), textWidthFor(countText)
    )
    const contentHeight = lineHeight * elements.length

    // tooltip positioning
    const xCoord = tooltipX(x, contentWidth, plotDimensions, tooltipStyle, margin)
    const yCoord = tooltipY(y, contentHeight, plotDimensions, tooltipStyle, margin)
    const xTip = xCoord + tooltipStyle.paddingLeft
    const yTip = yCoord + tooltipStyle.paddingTop + lineHeight

    // update the element attributes
    elements.forEach((element, index) => {
        element.attr("x", xTip).attr("y", yTip + lineHeight * index)
    })

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
