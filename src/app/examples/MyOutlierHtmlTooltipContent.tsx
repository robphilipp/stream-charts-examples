import {type JSX} from "react"
import {useOutlierTooltip} from "../charts/tooltips/useOutlierTooltip.tsx"

/**
 * Note: this is unused but serves as an additional example of a custom tooltip. To use
 * this tooltip, uncomment its usage in the {@link StreamingOutlierChart}.
 * <br/>
 * Default tooltip content for {@link OutlierPlotHtmlTooltipContent}. Reads tooltip data and
 * formatters from context via {@link useOutlierTooltip}. Used automatically when no custom
 * children are provided to {@link OutlierPlotHtmlTooltipContent}.
 */
export function MyOutlierHtmlTooltipContent(): JSX.Element {
    const {
        tooltipContent,
        tooltipStyle,
        datumFormatter,
        bandFormatter,
        measureFormatter,
    } = useOutlierTooltip()

    if (tooltipContent === null) return <></>

    const {
        seriesName,
        datum,
        upperMeasure = 1,
        lowerMeasure = 0,
        pointsInBand,
    } = tooltipContent

    const outerProb = 1 - upperMeasure
    const innerProb = upperMeasure - lowerMeasure

    return (
        <>
            <div style={{fontWeight: tooltipStyle.fontWeight + 500, fontSize: tooltipStyle.fontSize + 2}}>My Series: {seriesName}</div>
            <hr/>
            {datum && <div>{datumFormatter(datum.datum.x, datum.datum.y)}</div>}
            <div>{bandFormatter(lowerMeasure, upperMeasure)}</div>
            <div>{measureFormatter(innerProb, outerProb)}</div>
            <div>Points in band: {pointsInBand}</div>
            <hr/>
            <div>(custom HTML tooltip)</div>
        </>
    )
}
