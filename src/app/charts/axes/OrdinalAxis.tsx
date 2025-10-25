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
import {Dimensions, dimensionsEqual, dimensionsNotEqual, Margin} from "../styling/margins";
import {usePlotDimensions} from "../hooks/usePlotDimensions";
import {OrdinalAxisRange, ordinalAxisRangeFor} from "./ordinalAxisRangeFor";
import {Datum} from "../series/timeSeries";
import {continuousAxisRangeFor} from "./continuousAxisRangeFor";
import {AxisRangeTuple} from "../hooks/useAxes";

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
    } = useChart<Datum, any, any, OrdinalAxisRange>()

    const {
        xAxesState,
        yAxesState,
        addXAxis,
        addYAxis,
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
        updateAxisBasedOnDomainValues = true,
        label,
    } = props

    const axisRef = useRef<OrdinalStringAxis>(undefined)
    const rangeUpdateHandlerIdRef = useRef<string>(undefined)

    const axisIdRef = useRef<string>(axisId)
    const marginRef = useRef<Margin>(margin)
    const plotDimensionsRef = useRef<Dimensions>(plotDimensions)
    const categoriesRef = useRef<Array<string>>(categories)
    // const rangeRef = useRef<[start: number, end: number]>(scale.range())

    useEffect(
        () => {
            axisIdRef.current = axisId
            marginRef.current = margin
        },
        [axisId, margin]
    )

    useEffect(
        () => {
            if (container) {
                const svg = d3.select<SVGSVGElement, any>(container)
                const font: AxesFont = {...defaultAxesFont(), color, ...props.font}
                const axisTickStyle = {...defaultAxisTickStyle(), ...props.axisTickStyle}


                // lambda that gets called when the axes need to be updated
                const handleRangeUpdates = (updates: Map<string, OrdinalAxisRange>, plotDim: Dimensions): void => {
                    if (rangeUpdateHandlerIdRef.current && axisRef.current) {
                        const range = updates.get(axisId)
                        if (range) {
                            axisRef.current.categorySize = axisRef.current.update(range.current, plotDim, marginRef.current)
                        }
                    }
                }

                if (axisRef.current === undefined) {
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
                            addXAxis(axisRef.current, axisId, axisRef.current.scale.range())

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
                            addYAxis(axisRef.current, axisId, axisRef.current.scale.range())
                            // add an update handler
                            rangeUpdateHandlerIdRef.current = `y-axis-${chartId}-${location.valueOf()}`
                            addAxesBoundsUpdateHandler(rangeUpdateHandlerIdRef.current, handleRangeUpdates)
                    }
                } else {
                    const range = axisBoundsFor(axisId)
                    // const range = axisRef.current.scale.range()
                    if (range) {
                        // when the plot-dimensions aren't equal, then the window must have resized,
                        // and so we need to update the plot-range of the axis accordingly
                        if (dimensionsNotEqual(plotDimensions, plotDimensionsRef.current)) {
                            // todo deal with y-axis ordinal ranges
                            const widthChange = plotDimensions.width - plotDimensionsRef.current.width
                            const updatedRange = [range[0], range[1] + widthChange] as AxisRangeTuple
                            // plotDimensionsRef.current = plotDimensions
                            axisRef.current.update(updatedRange, plotDimensions, margin)
                        } else {
                            axisRef.current.update(range, plotDimensions, margin)
                        }
                        // axisRef.current.update(range as [start: number, end: number], plotDimensionsRef.current, margin)
                    }
                    // if (
                    //     (updateAxisBasedOnDomainValues && (rangeRef.current[0] !== range[0] || rangeRef.current[1] !== range[1])) ||
                    //     (!updateAxisBasedOnDomainValues && rangeRef.current !== range)
                    // ) {
                    //     rangeRef.current = range
                    //     resetAxisBoundsFor(axisId, ordinalAxisRangeFor, range)
                    // }

                    svg.select(`#${labelIdFor(chartId, location)}`).attr('fill', color)
                }
            }
        },
        [
            addXAxis, addYAxis,
            addAxesBoundsUpdateHandler,
            setAxisBoundsFor,
            axisId, categories, chartId, color, container, label, location,
            margin,
            plotDimensions,
            props.axisTickStyle,
            props.font,
            xAxesState,
            yAxesState,
            axisBoundsFor,
            updateAxisBasedOnDomainValues,
            resetAxisBoundsFor
        ]
    )

    useEffect(() => {
        plotDimensionsRef.current = plotDimensions
    }, [plotDimensions]);

    return null
}
