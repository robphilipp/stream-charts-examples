import {
    type AxesFont,
    AxisLocation,
    defaultAxesFont,
    type SeriesStyle,
    addContinuousNumericXAxis,
    addContinuousNumericYAxis,
    removeContinuousXAxis,
    removeContinuousYAxis,
    type ContinuousNumericAxis
} from "./axes";
import {useChart} from "../hooks/useChart";
import {useEffect, useRef} from "react";
import * as d3 from "d3";
import type {ScaleContinuousNumeric} from "d3";
import type {Dimensions, Margin} from "../styling/margins";
import {usePlotDimensions} from "../hooks/usePlotDimensions";
import type {Datum} from "../series/timeSeries";
import {AxisInterval} from "./AxisInterval";
import {ContinuousAxisRange} from "./ContinuousAxisRange";

export interface Props {
    // the unique ID of the axis
    axisId: string
    // the location of the axis. for x-axes, this must be either top or bottom. for
    // y-axes, this mut be either left or right
    location: AxisLocation
    // linear, log, or power scale that defaults to linear scale when not specified
    scale?: ScaleContinuousNumeric<number, number>
    // the min and max values for the axis
    domain: [min: number, max: number]
    // the font for drawing the axis ticks and labels
    font?: Partial<AxesFont>
    // the axis label
    label: string
    // The domain prop holds the axis bounds as a (min, max) tuple. The default
    // behavior is to update the axis bounds when the **values** of the domain
    // prop change, rather than when the object reference changes. This allows
    // a user of the chart to specify a tuple-literal as the ranges, rather than
    // forcing the user of the chart to create a ref and use that ref.
    //
    // This behavior is important when allowing the axes to scroll in time, as
    // is done in the scatter plot or the raster plot. In this case, if the user
    // of the raster chart specifies the axis domain as a tuple-literal, then
    // the bounds will get reset to their original value with each render.
    //
    // However, for charts that don't scroll, such as the iterates chart, but where
    // the user would like to change axis-bounds, say for a different iterates
    // function, we would like the axis bounds to be reset based on a change to
    // the object ref instead. In this case, we can set this property to false.
    updateAxisBasedOnDomainValues?: boolean
}

/**
 * Represents a continuous numeric axis (x or y) that can be place on the top, bottom,
 * left, or right of the chart. The domain (axis range) can be managed by this axis
 * component or managed externally (i.e. deferred). This component returns null, meaning
 * React won't render it because we are drawing directly onto the chart's shared canvas and
 * don't want React involved, except to call this function if the props change.
 * @param props The properties for the axis
 */
export function ContinuousAxis(props: Props): null {
    const {
        chartId,
        canvasContext,
        axes,
        color
    } = useChart<Datum, SeriesStyle, unknown, ContinuousAxisRange, ContinuousNumericAxis>()

    const {
        xAxesState,
        yAxesState,
        addXAxis,
        addYAxis,
        axisRangeFor,
        setAxisIntervalFor,
        updateAxisRanges,
        addAxesRangesUpdateHandler,
    } = axes

    const {
        plotDimensions,
        margin
    } = usePlotDimensions()

    const {
        axisId,
        location,
        scale = d3.scaleLinear(),
        domain,
        updateAxisBasedOnDomainValues = true,
        label,
    } = props

    const axisRef = useRef<ContinuousNumericAxis>(undefined)
    const rangeUpdateHandlerIdRef = useRef<string>(undefined)

    const axisIdRef = useRef<string>(axisId)
    const marginRef = useRef<Margin>(margin)
    // holds on the domain from the original props so that we can determine whether the props changed
    // or whether the axis change from resizing, zoom, scrolling, etc
    const domainRef = useRef<AxisInterval>(AxisInterval.as(domain))
    const domainPropRef = useRef<[min: number, max: number]>(domain)
    useEffect(
        () => {
            axisIdRef.current = axisId
            marginRef.current = margin
        },
        [axisId, plotDimensions, margin]
    )

    useEffect(
        () => {
            if (canvasContext) {
                const font: AxesFont = {...defaultAxesFont(), color, ...props.font}

                const handleRangeUpdates = (updates: Map<string, ContinuousAxisRange>, plotDim: Dimensions): void => {
                    if (rangeUpdateHandlerIdRef.current && axisRef.current) {
                        const range = updates.get(axisId)
                        if (range) {
                            axisRef.current.update(range.current, plotDim, marginRef.current)
                        }
                    }
                }

                if (axisRef.current === undefined) {
                    switch (location) {
                        case AxisLocation.Bottom:
                        case AxisLocation.Top: {
                            axisRef.current = addContinuousNumericXAxis(
                                canvasContext, axisId, plotDimensions, location, scale, domain,
                                font, margin, label, setAxisIntervalFor
                            )
                            // add the x-axis to the chart context
                            const [start, end] = AxisInterval.as(domain).asTuple()
                            addXAxis(axisRef.current, axisId, ContinuousAxisRange.from(start, end))

                            // add an update handler
                            rangeUpdateHandlerIdRef.current = `x-axis-${chartId}-${axisId}-${location.valueOf()}`
                            addAxesRangesUpdateHandler(rangeUpdateHandlerIdRef.current, handleRangeUpdates)

                            break
                        }

                        case AxisLocation.Left:
                        case AxisLocation.Right: {
                            axisRef.current = addContinuousNumericYAxis(
                                canvasContext, axisId, plotDimensions, location, scale, domain,
                                font, margin, label, setAxisIntervalFor
                            )
                            // add the y-axis to the chart context
                            const [start, end] = AxisInterval.as(domain).asTuple()
                            addYAxis(axisRef.current, axisId, ContinuousAxisRange.from(start, end))

                            // add an update handler
                            rangeUpdateHandlerIdRef.current = `y-axis-${chartId}-${axisId}-${location.valueOf()}`
                            addAxesRangesUpdateHandler(rangeUpdateHandlerIdRef.current, handleRangeUpdates)
                        }
                    }
                } else {
                    // calculate the current domain for the axis based on the current interval (range)
                    const currentDomain = axisRangeFor(axisId)
                        .map(range => range.current)
                        .getOrElse(AxisInterval.empty())

                    // convert the domain from the props to an axis interval for easier comparison
                    const propDomain = AxisInterval.as(domain)

                    // select whether to update based on whether we have specified that we update the axis
                    // range when the domain from the props changes. If the conditions of the first if
                    // statement are met, then we do a full update of the axis (we update the current, original
                    // range and make the callback that the range has changed with the updated range map)
                    if (
                        // update axis when the domain from the props has changed
                        (updateAxisBasedOnDomainValues && !domainRef.current.equals(propDomain)) ||
                        // or when the axis range has actually changed, but we don't update from props
                        (!updateAxisBasedOnDomainValues && domainPropRef.current !== domain)
                    ) {
                        domainRef.current = propDomain
                        domainPropRef.current = domain
                        updateAxisRanges(new Map([
                            [axisId, ContinuousAxisRange.from(propDomain.start, propDomain.end)]
                        ]))
                    }
                    // otherwise, if the domain exists, update the current axis
                    else if (currentDomain.isNotEmpty()) {
                        axisRef.current.update(currentDomain, plotDimensions, margin)
                    }

                    // keep the label/tick color in sync with the chart's color (e.g. on theme change),
                    // without recreating the axis or touching its domain
                    axisRef.current.updateFont(font)
                }
            }
        },
        [
            chartId, axisId, label, location, props.font, xAxesState, yAxesState, addXAxis, addYAxis, domain,
            scale, canvasContext, margin, plotDimensions, setAxisIntervalFor,
            axisRangeFor,
            addAxesRangesUpdateHandler,
            updateAxisRanges,
            color, updateAxisBasedOnDomainValues
        ]
    )

    // unregister the axis' draw function when the axis unmounts (e.g. the chart is torn down, or
    // this axis is swapped out for a different one)
    useEffect(
        () => {
            return () => {
                if (canvasContext) {
                    switch (location) {
                        case AxisLocation.Bottom:
                        case AxisLocation.Top:
                            removeContinuousXAxis(canvasContext, axisId)
                            break
                        case AxisLocation.Left:
                        case AxisLocation.Right:
                            removeContinuousYAxis(canvasContext, axisId)
                    }
                }
            }
        },
        [canvasContext, axisId, location]
    )

    return null
}
