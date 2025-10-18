import {
    addOrdinalStringAxis,
    AxesFont,
    AxisLocation,
    AxisTickStyle,
    OrdinalStringAxis,
    defaultAxesFont,
    defaultAxisTickStyle,
    labelIdFor
} from "./axes"
import * as d3 from "d3";
import {ScaleBand} from "d3";
import {useChart} from "../hooks/useChart";
import {useEffect, useRef} from "react";
import {Dimensions, Margin} from "../styling/margins";
import {usePlotDimensions} from "../hooks/usePlotDimensions";
import {OrdinalAxisRange} from "./ordinalAxisRangeFor";
import {Datum} from "../series/timeSeries";

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
    } = useChart<Datum, any, any, OrdinalAxisRange>()

    const {
        xAxesState, yAxesState,
        addXAxis, addYAxis,
        setAxisBoundsFor,
        axisBoundsFor,
        addAxesBoundsUpdateHandler,
        resetAxisBoundsFor
    } = axes

    const {plotDimensions, margin} = usePlotDimensions()

    const {
        axisId,
        location,
        scale = d3.scaleBand(),
        categories,
        label,
    } = props

    const axisRef = useRef<OrdinalStringAxis>(undefined)
    const rangeUpdateHandlerIdRef = useRef<string>(undefined)

    const axisIdRef = useRef<string>(axisId)
    const marginRef = useRef<Margin>(margin)
    const categoriesRef = useRef<Array<string>>(categories)
    useEffect(
        () => {
            axisIdRef.current = axisId
            marginRef.current = margin
        },
        [axisId, plotDimensions, margin]
    )

    useEffect(
        () => {
            if (container) {
                const svg = d3.select<SVGSVGElement, any>(container)
                const font: AxesFont = {...defaultAxesFont(), color, ...props.font}
                const axisTickStyle = {...defaultAxisTickStyle(), ...props.axisTickStyle}


                const handleRangeUpdates = (updates: Map<string, OrdinalAxisRange>, plotDim: Dimensions): void => {
                    if (rangeUpdateHandlerIdRef.current && axisRef.current) {
                        const range = updates.get(axisId)
                        if (range) {
                            axisRef.current.update(range.current.slice() as [start: number, end: number], plotDim, marginRef.current)
                            // axisRef.current.update(range.categories, range.originalCategories.length, plotDim, marginRef.current)
                            // axisRef.current.update([range.start, range.end], plotDim, marginRef.current)
                        }
                    }
                }
                if (axisRef.current === undefined) {
                    axisRef.current = addOrdinalStringAxis(chartId, axisId, svg, location, categories, label, font, axisTickStyle, plotDimensions, margin, setAxisBoundsFor)

                    // add the x-axis or y-axis to the chart context depending on its
                    // location
                    switch (location) {
                        case AxisLocation.Top:
                        case AxisLocation.Bottom:
                            axisRef.current = addOrdinalStringAxis(
                                chartId, axisId, svg, location, categories,
                                label, font, axisTickStyle, plotDimensions, margin,
                                setAxisBoundsFor
                            )
                            // add the x-axis to the chart context
                            addXAxis(axisRef.current, axisId)

                            // add an update handler
                            rangeUpdateHandlerIdRef.current = `x-axis-${chartId}-${location.valueOf()}`
                            addAxesBoundsUpdateHandler(rangeUpdateHandlerIdRef.current, handleRangeUpdates)
                            break
                        case AxisLocation.Left:
                        case AxisLocation.Right:
                            axisRef.current = addOrdinalStringAxis(
                                chartId, axisId, svg, location, categories,
                                label, font, axisTickStyle, plotDimensions, margin,
                                setAxisBoundsFor
                            )
                            // add the y-axis to the chart context
                            addYAxis(axisRef.current, axisId)
                            // add an update handler
                            rangeUpdateHandlerIdRef.current = `y-axis-${chartId}-${location.valueOf()}`
                            addAxesBoundsUpdateHandler(rangeUpdateHandlerIdRef.current, handleRangeUpdates)
                    }
                } else {
                    // const range = axisBoundsFor(axisId)
                    const range = axisRef.current.generator.scale().range()
                    if (range) {
                        axisRef.current.update(range as [start: number, end: number], plotDimensions, margin)
                        // axisRef.current.update(range, range.length, plotDimensions, margin)
                    }
                    if (rangeUpdateHandlerIdRef.current !== undefined) {
                        addAxesBoundsUpdateHandler(rangeUpdateHandlerIdRef.current, handleRangeUpdates)
                    }

                    // update the category size in case the plot dimensions changed
                    axisRef.current.update(range as [start: number, end: number], plotDimensions, margin)
                    axisRef.current.categorySize = axisRef.current.scale.bandwidth()
                    // axisRef.current.categorySize = axisRef.current.update(categories, categories.length, plotDimensions, margin)
                    svg.select(`#${labelIdFor(chartId, location)}`).attr('fill', color)
                }
            }
        },
        [
            addXAxis, addYAxis,
            axisId,
            categories,
            chartId,
            color,
            container,
            label,
            location,
            margin,
            plotDimensions,
            props.axisTickStyle,
            props.font
        ]
    )

    return null
}
