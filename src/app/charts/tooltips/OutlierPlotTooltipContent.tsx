import type {CSSProperties, ReactElement} from "react"
import {useEffect, useMemo, useState} from "react"
import {createPortal} from "react-dom"
import {useChart} from "../hooks/useChart"
import {usePlotDimensions} from "../hooks/usePlotDimensions"
import type {ContinuousNumericAxis, SeriesLineStyle} from "../axes/axes"
import {ContinuousAxisRange} from "../axes/ContinuousAxisRange"
import {defaultTooltipStyle, type TooltipDimensions, type TooltipStyle, tooltipX, tooltipY} from "./tooltipUtils"
import {withAlpha} from "../styling/canvasStyle"
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
 * The data needed to render the tooltip's content, captured at mouse-over time and read back out
 * during render. Replaces the old version's immediate SVG DOM manipulation (which appended and
 * hand-positioned one SVG `<text>` element per line, using `getBBox()` to measure each) -- plain
 * HTML/CSS text flows and sizes itself, so no equivalent per-line measurement is needed here.
 */
interface OutlierTooltipContentState {
    header: string
    datumLine?: string
    bandLine: string
    explanationLines: Array<string>
    countLine: string
    left: number
    top: number
}

/** A generous estimate of the tooltip's rendered width, used to keep it from running off the right edge of the viewport. */
const ESTIMATED_WIDTH = 320
/** A generous estimate of the tooltip's rendered height, used to keep it from running off the bottom edge of the plot. */
const ESTIMATED_HEIGHT = 140

/**
 * Registers a tooltip content provider for {@link OutlierPlot} bands. When the user hovers over
 * a band, the tooltip shows the measure associated with the band along with the implied outlier
 * probabilities for points inside and outside the band.
 *
 * Must be rendered as a child of a {@link Tooltip} inside a {@link Chart} that contains an
 * {@link OutlierPlot}. On mouse-over, the registered provider just captures the data needed to
 * render (via `setTooltipContent`) and returns off-screen {@link TooltipDimensions} so the parent
 * {@link Tooltip}'s own background element stays invisible -- this component renders its own,
 * independent portal instead (see {@link OutlierPlotHtmlTooltipContent} for the established
 * pattern this follows).
 */
export function OutlierPlotTooltipContent(props: Props): ReactElement | null {
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
        canvas,
        tooltip,
        mouse
    } = useChart<OutlierDatum<readonly number[]>, SeriesLineStyle, OutlierBandTooltipMetadata, ContinuousAxisRange, ContinuousNumericAxis>()

    const {registerTooltipContentProvider} = tooltip
    const {registerMouseLeaveHandler, unregisterMouseLeaveHandler} = mouse

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

    const [tooltipContent, setTooltipContent] = useState<OutlierTooltipContentState | null>(null)

    // register the tooltip content provider, which when called on mouse-over-band events
    // captures the data needed to render the tooltip; the actual rendering happens declaratively
    // below, via the portal.
    useEffect(
        () => {
            if (canvas) {
                registerTooltipContentProvider(
                    (
                        seriesName: string,
                        _time: number,
                        tooltipData: TooltipData<OutlierDatum<readonly number[]>, OutlierBandTooltipMetadata>,
                        mouseCoords: [x: number, y: number]
                    ) => captureTooltipContent(
                        seriesName, tooltipData.metadata, mouseCoords,
                        canvas, margin, plotDimensions, tooltipStyle,
                        datumFormatter, bandFormatter, measureFormatter,
                        setTooltipContent
                    )
                )
            }
        },
        [
            bandFormatter, chartId, canvas, datumFormatter, margin, measureFormatter,
            plotDimensions, registerTooltipContentProvider, tooltipStyle
        ]
    )

    // clears the captured content (and so unmounts the portal) when the mouse leaves the band
    useEffect(
        () => {
            const handlerId = `html-tooltip-leave-${chartId}`
            registerMouseLeaveHandler(handlerId, () => setTooltipContent(null))
            return () => unregisterMouseLeaveHandler(handlerId)
        },
        [chartId, registerMouseLeaveHandler, unregisterMouseLeaveHandler]
    )

    if (tooltipContent === null) return null

    const divStyle: CSSProperties = {
        position: 'fixed',
        left: tooltipContent.left,
        top: tooltipContent.top,
        backgroundColor: withAlpha(tooltipStyle.backgroundColor, tooltipStyle.backgroundOpacity),
        border: `${tooltipStyle.borderWidth}px solid ${withAlpha(tooltipStyle.borderColor, tooltipStyle.borderOpacity)}`,
        borderRadius: tooltipStyle.borderRadius,
        padding: `${tooltipStyle.paddingTop}px ${tooltipStyle.paddingRight}px ${tooltipStyle.paddingBottom}px ${tooltipStyle.paddingLeft}px`,
        fontFamily: tooltipStyle.fontFamily,
        fontSize: tooltipStyle.fontSize,
        color: tooltipStyle.fontColor,
        pointerEvents: 'none',
        zIndex: 9999,
    }

    return createPortal(
        <div style={divStyle}>
            <div style={{fontWeight: tooltipStyle.fontWeight + 500, fontSize: tooltipStyle.fontSize + 2}}>
                {tooltipContent.header}
            </div>
            {tooltipContent.datumLine && <div style={{marginTop: 6}}>{tooltipContent.datumLine}</div>}
            <div style={{marginTop: 6}}>{tooltipContent.bandLine}</div>
            <div style={{marginTop: 6}}>
                {tooltipContent.explanationLines.map((line, index) => <div key={index}>{line}</div>)}
            </div>
            <div style={{marginTop: 6}}>{tooltipContent.countLine}</div>
        </div>,
        document.body
    )
}

/**
 * Captures the data needed to render the tooltip content, and computes its viewport-fixed
 * position. Replaces the old version, which appended and hand-positioned one SVG `<text>` element
 * per line via `getBBox()`.
 * @param seriesName The name of the series
 * @param metadata The band metadata
 * @param mouseCoords The coordinates of the mouse when the event was fired, in canvas-local coordinates
 * @param canvas The chart's canvas element
 * @param margin The plot margins
 * @param plotDimensions The dimensions of the plot
 * @param tooltipStyle The style properties for the tooltip
 * @param datumFormatter Formatter for the hovered datum
 * @param bandFormatter Formatter for the band's bounds
 * @param measureFormatter Formatter for the band's inside/outside probabilities
 * @param setTooltipContent Setter that stashes the captured content for the component to render
 * @return Off-screen {@link TooltipDimensions}, so the parent <Tooltip>'s own background stays invisible
 */
function captureTooltipContent(
    seriesName: string,
    metadata: OutlierBandTooltipMetadata,
    mouseCoords: [x: number, y: number],
    canvas: HTMLCanvasElement,
    margin: Margin,
    plotDimensions: Dimensions,
    tooltipStyle: TooltipStyle,
    datumFormatter: (x: number, y: number) => string,
    bandFormatter: (lower: number, upper: number) => string,
    measureFormatter: (innerProb: number, outerProb: number) => Array<string>,
    setTooltipContent: (content: OutlierTooltipContentState) => void,
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

    const xCoord = tooltipX(x, ESTIMATED_WIDTH, plotDimensions, tooltipStyle, margin)
    const yCoord = tooltipY(y, ESTIMATED_HEIGHT, plotDimensions, tooltipStyle, margin)

    const canvasRect = canvas.getBoundingClientRect()
    setTooltipContent({
        header: `Series: ${seriesName}`,
        datumLine: datum ? datumFormatter(datum.datum.x, datum.datum.y) : undefined,
        bandLine: bandFormatter(lowerMeasure, upperMeasure),
        explanationLines: measureFormatter(innerProb, outerProb),
        countLine: `Points in band: ${pointsInBand}`,
        left: canvasRect.left + xCoord,
        top: canvasRect.top + yCoord,
    })

    // return off-screen coordinates so the Tooltip parent's background div is invisible
    return {x: -99999, y: -99999, contentWidth: 0, contentHeight: 0}
}
