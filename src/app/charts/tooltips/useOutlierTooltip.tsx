import {type JSX, createContext, useContext} from "react"
import type {OutlierBandTooltipMetadata} from "../plots/OutlierPlot"
import type {TooltipStyle} from "./tooltipUtils"

export type TooltipLocation = {left: number, top: number}
export type TooltipSeriesName = {seriesName: string}
export type TooltipContent<M extends readonly number[] = readonly number[]> = TooltipSeriesName & OutlierBandTooltipMetadata<M> & TooltipLocation

export type OutlierTooltipContentFormatters = {
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
     * @param innerProb Probability of points being within this band
     * @param outerProb Probability of points being outside this band
     * @return a human-readable description of the band
     */
    measureFormatter?: (innerProb: number, outerProb: number) => string | JSX.Element
}

export type OutlierTooltipContextValue = {
    tooltipContent: TooltipContent | null
    tooltipStyle: TooltipStyle
    datumFormatter: (x: number, y: number) => string | JSX.Element
    bandFormatter: (lower: number, upper: number) => string | JSX.Element
    measureFormatter: (innerProb: number, outerProb: number) => string | JSX.Element
}

export const UseOutlierTooltip = createContext<OutlierTooltipContextValue | null>(null)

/**
 * Hook for consuming the outlier tooltip context inside a child of
 * {@link OutlierPlotHtmlTooltipContent}.
 */
export function useOutlierTooltip(): OutlierTooltipContextValue {
    const ctx = useContext(UseOutlierTooltip)
    if (ctx === null) {
        throw new Error('useOutlierTooltip must be used inside OutlierPlotHtmlTooltipContent')
    }
    return ctx
}
