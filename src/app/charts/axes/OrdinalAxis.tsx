import {
    addOrdinalStringAxis,
    AxesFont,
    AxisLocation,
    AxisTickStyle,
    defaultAxesFont,
    defaultAxisTickStyle,
    labelIdFor,
    OrdinalStringAxis
} from "./axes"
import * as d3 from "d3";
import {ScaleBand} from "d3";
import {useChart} from "../hooks/useChart";
import {useEffect, useRef} from "react";
import {Dimensions} from "../styling/margins";
import {usePlotDimensions} from "../hooks/usePlotDimensions";
import {OrdinalAxisRange, scaleOrdinalBounds} from "./ordinalAxisRangeFor";
import {Datum} from "../series/timeSeries";
import {AxisInterval} from "./axisInterval";

interface Props {
    // the unique ID of the axis
    axisId: string
    // the location of the axis. for y-axes, this mut be either left or right,
    // for x-axis, must be either top or bottom.
    location: AxisLocation
    // category axes
    scale?: ScaleBand<string>
    // the min and max values for the axis
    categories: Array<string>
    // the font for drawing the axis ticks and labels
    font?: Partial<AxesFont>
    // styling for the axis ticks (e.g. font, rotation, etc)
    axisTickStyle?: Partial<AxisTickStyle>
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
 * Category axis that represents the x-axis when its location is either on the bottom or the top.
 * When the axis location is left or right, then the category axis represents the y-axis. The category
 * axis requires a set of categories that will form the axis. Generally, these categories should
 * be the name of the series used to represent each category.
 * @param props The properties for the component
 * @return null
 * @constructor
 */
export function OrdinalAxis(props: Props): null {
    const {
        chartId,
        container,
        axes,
        color,
    } = useChart<Datum, any, any, OrdinalAxisRange, OrdinalStringAxis>()

    const {
        xAxesState,
        yAxesState,
        addXAxis,
        addYAxis,
        setAxisBoundsFor,
        axisBoundsFor,
        addAxesBoundsUpdateHandler,
        originalAxisBoundsFor,
        setOriginalAxisBoundsFor,
    } = axes

    const {
        plotDimensions,
        margin,
        registerPlotDimensionChangeHandler,
        unregisterPlotDimensionChangeHandler
    } = usePlotDimensions()

    const {
        axisId,
        location,
        categories,
        updateAxisBasedOnDomainValues = true,
        label,
    } = props

    const rangeUpdateHandlerIdRef = useRef<string>(undefined)
    const axis = location === AxisLocation.Top || location === AxisLocation.Bottom ?
        xAxesState.axisFor(axisId) :
        yAxesState.axisFor(axisId)

    // handles plot size changes by updating the range of the axis and the original range of the axis
    // based on the change in the size
    useEffect(
        () => {
            const handlerId = registerPlotDimensionChangeHandler((oldDimension, newDimension) => {
                if (axis !== undefined) {
                    if (location === AxisLocation.Top || location === AxisLocation.Bottom) {
                        const {range, original} = scaleOrdinalBounds(oldDimension.width, newDimension.width, axisBoundsFor(axisId))
                        axis.update(range, original, plotDimensions, margin)
                    }
                    if (location === AxisLocation.Left || location === AxisLocation.Right) {
                        const {range, original} = scaleOrdinalBounds(oldDimension.height, newDimension.height, axisBoundsFor(axisId))
                        axis.update(range, original, plotDimensions, margin)
                    }
                }
            })
            return () => {
                unregisterPlotDimensionChangeHandler(handlerId)
            }
        },
        [axis, axisBoundsFor, axisId, location, margin, originalAxisBoundsFor, plotDimensions, registerPlotDimensionChangeHandler, setAxisBoundsFor, setOriginalAxisBoundsFor, unregisterPlotDimensionChangeHandler]
    );

    useEffect(
        () => {
            if (container) {
                const svg = d3.select<SVGSVGElement, any>(container)
                const font: AxesFont = {...defaultAxesFont(), color, ...props.font}
                const axisTickStyle = {...defaultAxisTickStyle(), ...props.axisTickStyle}


                // lambda that gets called when the axes need to be updated
                const handleRangeUpdates = (updates: Map<string, OrdinalAxisRange>, plotDim: Dimensions): void => {
                    if (rangeUpdateHandlerIdRef.current && axis) {
                        const range = updates.get(axisId)
                        if (range) {
                            axis.update(range.current, range.original, plotDim, margin)
                        }
                    }
                }

                if (axis === undefined) {
                    // add the x-axis or y-axis to the chart context depending on its
                    // location
                    switch (location) {
                        case AxisLocation.Top:
                        case AxisLocation.Bottom:
                            const xAxis = addOrdinalStringAxis(
                                chartId, axisId, svg, location, categories,
                                label, font, axisTickStyle, plotDimensions, margin,
                                setAxisBoundsFor, setOriginalAxisBoundsFor
                            )

                            // add the x-axis to the chart context
                            addXAxis(xAxis, axisId, AxisInterval.as(xAxis.scale.range()))

                            // add an update handler
                            rangeUpdateHandlerIdRef.current = `x-axis-${chartId}-${location.valueOf()}`
                            addAxesBoundsUpdateHandler(rangeUpdateHandlerIdRef.current, handleRangeUpdates)
                            break
                        case AxisLocation.Left:
                        case AxisLocation.Right:
                            const yAxis = addOrdinalStringAxis(
                                chartId, axisId, svg, location, categories,
                                label, font, axisTickStyle, plotDimensions, margin,
                                setAxisBoundsFor, setOriginalAxisBoundsFor
                            )
                            // add the y-axis to the chart context
                            addYAxis(yAxis, axisId, AxisInterval.as(yAxis.scale.range()))
                            // add an update handler
                            rangeUpdateHandlerIdRef.current = `y-axis-${chartId}-${location.valueOf()}`
                            addAxesBoundsUpdateHandler(rangeUpdateHandlerIdRef.current, handleRangeUpdates)
                    }
                } else {
                    const range = axisBoundsFor(axisId)
                    const originalRange = originalAxisBoundsFor(axisId)
                    if (range && originalRange) {
                        axis.update(range, originalRange, plotDimensions, margin)
                    }

                    svg.select(`#${labelIdFor(chartId, location)}`).attr('fill', color)
                }
            }
        },
        [addXAxis, addYAxis, addAxesBoundsUpdateHandler, setAxisBoundsFor, axisId, categories, chartId, color, container, label, location, margin, plotDimensions, props.axisTickStyle, props.font, xAxesState, yAxesState, axisBoundsFor, updateAxisBasedOnDomainValues, axis, setOriginalAxisBoundsFor, originalAxisBoundsFor]
    )

    return null
}

