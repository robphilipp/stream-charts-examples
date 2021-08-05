import * as React from 'react'
import {useEffect, useRef} from 'react'
import * as d3 from "d3";
import {addLinearYAxis, AxesLabelFont, AxisLocation, defaultAxesLabelFont, LinearAxis} from "./axes";
import {useChart} from "./useChart";

interface Props {
    location: AxisLocation.Left | AxisLocation.Right,
    domain: [min: number, max: number],
    font?: Partial<AxesLabelFont>,
    label: string
}

export function AxisY(props: Props) {
    const {
        chartId,
        container,
        plotDimensions,
        margin,
    } = useChart()

    const {
        location,
        domain,
        label
    } = props

    const axisRef = useRef<LinearAxis>()

    useEffect(
        () => {
            if (container) {
                const svg = d3.select<SVGSVGElement, any>(container)
                const font: AxesLabelFont = {...defaultAxesLabelFont, ...props.font}

                if (axisRef.current === undefined) {
                    axisRef.current = addLinearYAxis(
                        chartId,
                        svg,
                        plotDimensions,
                        location,
                        domain,
                        font,
                        margin,
                        label,
                    )
                } else {
                    axisRef.current.update(domain, plotDimensions, margin)
                }
            }
        },
        [chartId, container, domain, label, location, margin, plotDimensions]
    )

    return null
}