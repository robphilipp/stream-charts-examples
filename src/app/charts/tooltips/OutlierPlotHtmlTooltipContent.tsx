import React, {type JSX, useEffect, useMemo, useState} from "react"
import {createPortal} from "react-dom"
import * as d3 from "d3"
import {useChart} from "../hooks/useChart"
import {usePlotDimensions} from "../hooks/usePlotDimensions"
import type {ContinuousNumericAxis, SeriesLineStyle} from "../axes/axes"
import {ContinuousAxisRange} from "../axes/ContinuousAxisRange"
import {defaultTooltipStyle, type TooltipDimensions, type TooltipStyle} from "./tooltipUtils"
import type {TooltipData} from "../hooks/useTooltip"
import type {OutlierBandTooltipMetadata} from "../plots/OutlierPlot"
import type {OutlierDatum} from "../series/outlierSeries"

export interface Props {
    style?: Partial<TooltipStyle>
    /**
     * Formatter for the datum
     * @param x X-coordinate of the datum
     * @param y Y-coordinate of the datum
     * @return a human-readable description of the datum
     */
    datumFormatter?: (x: number, y: number) => string | JSX.Element
    /**
     * Formatter for the measure
     * @param lower Lower bound of the band
     * @param upper Upper bound of the band
     * @return a human-readable description of the band
     */
    bandFormatter?: (lower: number, upper: number) => string | JSX.Element
    /**
     * Formatter for the measure description
     * @param innerProb Probability of points being within this band where the band is defined by
     * the lower and upper bounds.
     * @param outerProb Probability of points being outside this band (greater than the upper bound)
     * @return a human-readable description of the band
     */
    measureFormatter?: (innerProb: number, outerProb: number) => string | JSX.Element
}

interface TooltipContent {
    seriesName: string
    datum?: OutlierDatum<readonly number[]>
    upperMeasure: number
    lowerMeasure: number
    pointsInBand: number
    left: number
    top: number
}

/**
 * Registers an HTML tooltip content provider for {@link OutlierPlot} bands. When the user hovers
 * over a band, a React portal renders an absolutely-positioned HTML div near the cursor with the
 * same content as {@link OutlierPlotTooltipContent}.
 *
 * Must be rendered as a child of a {@link Tooltip} inside a {@link Chart} that contains an
 * {@link OutlierPlot}. Showing is triggered by the parent {@link Tooltip} via
 * {@link registerTooltipContentProvider}; hiding is triggered by the mouse-leave event.
 */
export function OutlierPlotHtmlTooltipContent(props: Props): React.ReactElement | null {
    const {
        style,
        datumFormatter = (x: number, y: number) => `(${x}, ${y})`,
        bandFormatter = (lower: number, upper: number) => `Band: ${lower} \u2B62 ${upper}`,
        measureFormatter = (innerProb: number, outerProb: number) => `Points have a ${(innerProb * 100).toFixed(1)}% probability of being in this band, and a ${(outerProb * 100).toFixed(1)}% probability of being outside this band`,
    } = props

    const {
        chartId,
        container,
        tooltip,
        mouse,
    } = useChart<OutlierDatum<readonly number[]>, SeriesLineStyle, OutlierBandTooltipMetadata, ContinuousAxisRange, ContinuousNumericAxis>()

    const {registerTooltipContentProvider} = tooltip
    const {registerMouseLeaveHandler, unregisterMouseLeaveHandler} = mouse

    const {margin, plotDimensions} = usePlotDimensions()

    const tooltipStyle = useMemo(
        () => ({...defaultTooltipStyle, ...style}),
        [style]
    )

    const [tooltipContent, setTooltipContent] = useState<TooltipContent | null>(null)

    // Register the content provider — called by <Tooltip> on mouse-over to show the portal
    useEffect(
        () => {
            if (container) {
                registerTooltipContentProvider(
                    (
                        seriesName: string,
                        _: number,
                        tooltipData: TooltipData<OutlierDatum<readonly number[]>, OutlierBandTooltipMetadata>,
                        mouseCoords: [x: number, y: number]
                    ) => buildTooltipContent(
                        seriesName, tooltipData.metadata, mouseCoords,
                        container,
                        setTooltipContent
                    )
                )
            }
        },
        [chartId, container, margin, plotDimensions, registerTooltipContentProvider, tooltipStyle]
    )

    // Register a mouse-leave handler to unmount the portal — <Tooltip> handles its own SVG cleanup
    // (removeTooltip) while we handle ours (clearing the portal state)
    useEffect(
        () => {
            const handlerId = `html-tooltip-leave-${chartId}`
            registerMouseLeaveHandler(handlerId, () => setTooltipContent(null))
            return () => unregisterMouseLeaveHandler(handlerId)
        },
        [chartId, registerMouseLeaveHandler, unregisterMouseLeaveHandler]
    )

    if (tooltipContent === null) return null

    const {
        seriesName,
        datum,
        upperMeasure,
        lowerMeasure,
        pointsInBand,
        left,
        top
    } = tooltipContent
    const outerProb = 1 - upperMeasure
    const innerProb = upperMeasure - lowerMeasure
    // const outerProb = ((1 - upperMeasure) * 100).toFixed(1)
    // const innerProb = ((upperMeasure - lowerMeasure) * 100).toFixed(1)

    const bg = d3.color(tooltipStyle.backgroundColor) as d3.RGBColor | null
    const bgColor = bg
        ? `rgba(${bg.r},${bg.g},${bg.b},${tooltipStyle.backgroundOpacity})`
        : tooltipStyle.backgroundColor
    const bc = d3.color(tooltipStyle.borderColor) as d3.RGBColor | null
    const borderColor = bc
        ? `rgba(${bc.r},${bc.g},${bc.b},${tooltipStyle.borderOpacity})`
        : tooltipStyle.borderColor

    const divStyle: React.CSSProperties = {
        position: 'fixed',
        left,
        top,
        backgroundColor: bgColor,
        border: `${tooltipStyle.borderWidth}px solid ${borderColor}`,
        borderRadius: tooltipStyle.borderRadius,
        padding: `${tooltipStyle.paddingTop}px ${tooltipStyle.paddingRight}px ${tooltipStyle.paddingBottom}px ${tooltipStyle.paddingLeft}px`,
        fontFamily: tooltipStyle.fontFamily,
        fontSize: tooltipStyle.fontSize,
        color: tooltipStyle.fontColor,
        lineHeight: 1.6,
        pointerEvents: 'none',
        zIndex: 9999,
    }

    return createPortal(
        <div style={divStyle}>
            <div style={{fontWeight: tooltipStyle.fontWeight + 500, fontSize: tooltipStyle.fontSize + 2}}>Series: {seriesName}</div>
            <hr/>
            {datum && <div>{datumFormatter(datum.datum.x, datum.datum.y)}</div>}
            {bandFormatter(lowerMeasure, upperMeasure)}
            {measureFormatter(innerProb, outerProb)}
            <div>Points in band: {pointsInBand}</div>
        </div>,
        document.body
    )
}

function buildTooltipContent(
    seriesName: string,
    metadata: OutlierBandTooltipMetadata,
    mouseCoords: [x: number, y: number],
    container: SVGSVGElement,
    setTooltipContent: (content: TooltipContent) => void,
): TooltipDimensions {
    const {
        datum,
        upperMeasure = 1,
        lowerMeasure = 0,
        pointsInBand,
    } = metadata

    const svgRect = container.getBoundingClientRect()
    const ESTIMATED_WIDTH = 350
    const left = Math.min(svgRect.left + mouseCoords[0] + 12, window.innerWidth - ESTIMATED_WIDTH)
    const top = svgRect.top + mouseCoords[1] + 12

    setTooltipContent({seriesName, datum, upperMeasure, lowerMeasure, pointsInBand, left, top})

    // Return off-screen coordinates so the Tooltip parent's SVG rect is invisible
    return {x: NaN, y: NaN, contentWidth: 0, contentHeight: 0}
}
