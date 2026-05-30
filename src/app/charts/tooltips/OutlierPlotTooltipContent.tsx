import {useEffect, useMemo} from "react"
import * as d3 from "d3"
import {useChart} from "../hooks/useChart"
import {usePlotDimensions} from "../hooks/usePlotDimensions"
import type {ContinuousNumericAxis, SeriesLineStyle} from "../axes/axes"
import {ContinuousAxisRange} from "../axes/ContinuousAxisRange"
import {
    defaultTooltipStyle,
    textHeightFor,
    textWidthFor,
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
    /**
     * Formatter for the datum
     * @param x X-coordinate of the datum
     * @param y Y-coordinate of the datum
     * @return a human-readable description of the datum
     */
    datumFormatter?: (x: number, y: number) => string
    /**
     * Formatter for the measure
     * @param lower Lower bound of the band
     * @param upper Upper bound of the band
     * @return a human-readable description of the band
     */
    bandFormatter?: (lower: number, upper: number) => string
    /**
     * Formatter for the measure description
     * @param innerProb Probability of points being within this band where the band is defined by
     * the lower and upper bounds.
     * @param outerProb Probability of points being outside this band (greater than the upper bound)
     * @return a human-readable description of the band
     */
    measureFormatter?: (innerProb: number, outerProb: number) => Array<string>
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
        style,
        datumFormatter = (x: number, y: number) => `(${x}, ${y})`,
        bandFormatter = (lower: number, upper: number) => `Band: ${lower} \u2B62 ${upper}`,
        measureFormatter = (innerProb: number, outerProb: number) => [
            `Points have a ${(innerProb * 100).toFixed(1)}% probability of being in this band,`,
            `and a ${(outerProb * 100).toFixed(1)}% probability of being outside this band.`
        ],
    } = props

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
            ...style
        }),
        [style]
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
                        chartId, container, margin, plotDimensions, tooltipStyle,
                        datumFormatter, bandFormatter, measureFormatter
                    )
                )
            }
        },
        [
            bandFormatter, chartId, container, datumFormatter, margin, measureFormatter,
            plotDimensions, registerTooltipContentProvider, tooltipStyle
        ]
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
    datumFormatter: (x: number, y: number) => string,
    bandFormatter: (lower: number, upper: number) => string,
    measureFormatter: (innerProb: number, outerProb: number) => Array<string>,
): TooltipDimensions {
    const {
        datum,
        upperMeasure = 1,
        lowerMeasure = 0,
        pointsInBand,
    } = metadata
    const outerProb = 1 - upperMeasure
    const innerProb = upperMeasure - lowerMeasure
    const [x, y] = mouseCoords

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mainGroup = d3.select<SVGSVGElement | null, any>(container)
    const idPrefix = `ob${time}-${seriesName}-${chartId}`

    // create the text elements that get displayed in the tooltip
    const elements: Array<d3.Selection<SVGTextElement, unknown, null, undefined>> = []
    const header = createTextElement(
        mainGroup,
        `${idPrefix}-h`,
        {...tooltipStyle, fontWeight: tooltipStyle.fontWeight + 500, fontSize: tooltipStyle.fontSize + 2},
        `Series: ${seriesName}`
    )
    elements.push(header)
    elements.push(createTextElement(mainGroup, `${idPrefix}-lh0`, tooltipStyle, " "))

    if (datum) {
        elements.push(createTextElement(
            mainGroup,
            `${idPrefix}-p`,
            tooltipStyle,
            datumFormatter(datum.datum.x, datum.datum.y)
        ))
    }
    const measureText = createTextElement(
        mainGroup,
        `${idPrefix}-m`,
        tooltipStyle,
        bandFormatter(lowerMeasure, upperMeasure)
    )
    elements.push(measureText)
    elements.push(createTextElement(mainGroup, `${idPrefix}-l1`, tooltipStyle, " "))

    const explanation = measureFormatter(innerProb, outerProb)
        .map(line => {
            const elem = createTextElement(
                mainGroup,
                `${idPrefix}-m`,
                tooltipStyle,
                line
            )
            elements.push(elem)
            return elem
        })
    elements.push(createTextElement(mainGroup, `${idPrefix}-l2`, tooltipStyle, " "))

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
        textWidthFor(countText), ...explanation.map(line => textWidthFor(line))
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
