import React, {type CSSProperties, type JSX, type ReactElement, useEffect, useMemo, useState} from "react"
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
import {DefaultOutlierHtmlTooltipContent} from "./DefaultOutlierHtmlTooltipContent.tsx"
import {
    UseOutlierTooltip,
    type OutlierTooltipContextValue,
    type OutlierTooltipContentFormatters,
    type TooltipContent,
    type TooltipLocation,
    type TooltipSeriesName,
} from "./useOutlierTooltip.tsx"

// Re-export context types so callers only need to import from this file
export type {TooltipLocation, TooltipSeriesName, TooltipContent, OutlierTooltipContentFormatters, OutlierTooltipContextValue}
// export {useOutlierTooltip} from "./OutlierTooltipContext.tsx"

export type Props = {
    style?: Partial<TooltipStyle>
    /**
     * Custom tooltip content. Receives tooltip data and formatters via {@link useOutlierTooltip}.
     * Defaults to {@link DefaultOutlierHtmlTooltipContent} when not provided.
     */
    children?: JSX.Element | Array<JSX.Element>
} & OutlierTooltipContentFormatters

/**
 * Registers an HTML tooltip content provider for {@link OutlierPlot} bands. When the user hovers
 * over a band, a React portal renders an absolutely-positioned HTML div near the cursor.
 *
 * Provides tooltip data and formatters to children via context ({@link useOutlierTooltip}).
 * When no children are supplied, renders {@link DefaultOutlierHtmlTooltipContent}.
 *
 * Must be rendered as a child of a {@link Tooltip} inside a {@link Chart} that contains an
 * {@link OutlierPlot}. Showing is triggered by the parent {@link Tooltip} via
 * {@link registerTooltipContentProvider}; hiding is triggered by the mouse-leave event.
 */
export function OutlierPlotHtmlTooltipContent(props: Props): React.ReactElement | null {
    const {
        style,
        children,
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

    const tooltipStyle = useMemo<TooltipStyle>(
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

    const bg = d3.color(tooltipStyle.backgroundColor) as d3.RGBColor | null
    const bgColor = bg
        ? `rgba(${bg.r},${bg.g},${bg.b},${tooltipStyle.backgroundOpacity})`
        : tooltipStyle.backgroundColor
    const bc = d3.color(tooltipStyle.borderColor) as d3.RGBColor | null
    const borderColor = bc
        ? `rgba(${bc.r},${bc.g},${bc.b},${tooltipStyle.borderOpacity})`
        : tooltipStyle.borderColor

    const divStyle: CSSProperties = {
        position: 'fixed',
        left: tooltipContent.left,
        top: tooltipContent.top,
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

    // Tooltip.cloneElement always injects the original <OutlierPlotHtmlTooltipContent> element
    // (including the user's actual children inside it) as our `children` prop. Unwrap one level.
    const content = (children as ReactElement<Props> | undefined)?.props.children

    return createPortal(
        <UseOutlierTooltip.Provider value={{tooltipContent, tooltipStyle, datumFormatter, bandFormatter, measureFormatter}}>
            <div style={divStyle}>
                {content ?? <DefaultOutlierHtmlTooltipContent/>}
            </div>
        </UseOutlierTooltip.Provider>,
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

    setTooltipContent({bandIndex: 0, seriesName, datum, upperMeasure, lowerMeasure, pointsInBand, left, top})

    // Return off-screen coordinates so the Tooltip parent's SVG rect is invisible
    return {x: -99999, y: -99999, contentWidth: 0, contentHeight: 0}
}
