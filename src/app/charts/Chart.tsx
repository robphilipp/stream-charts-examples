import * as React from 'react'
import {useEffect, useRef, useState} from 'react'
import {Dimensions, Margin, plotDimensionsFrom} from "./margins";
import {initialSvgStyle, SvgStyle} from "./svgStyle";
import {Datum} from "./datumSeries";
import {noop, Observable, Subscription} from "rxjs";
import {ChartData} from "./chartData";
import {GSelection} from "./d3types";
import ChartProvider from "./useChart";
import * as d3 from "d3";
import {createPlotContainer} from "./plot";

const defaultMargin: Margin = {top: 30, right: 20, bottom: 30, left: 50}
const defaultAxesStyle = {color: '#d2933f'}
const defaultBackground = '#202020';

interface Props {
    width: number
    height: number
    margin?: Partial<Margin>
    // axisLabelFont?: Partial<AxesLabelFont>
    // axisStyle?: Partial<CSSProperties>
    color?: string
    backgroundColor?: string
    svgStyle?: Partial<SvgStyle>

    // data stream
    seriesObservable: Observable<ChartData>
    windowingTime?: number
    shouldSubscribe?: boolean
    onSubscribe?: (subscription: Subscription) => void
    onUpdateData?: (seriesName: string, data: Array<Datum>) => void
    onUpdateTime?: (time: number) => void

    // regex filter used to select which series are displayed
    filter?: RegExp

    children: JSX.Element | Array<JSX.Element>;
}

export function Chart(props: Props): JSX.Element {
    const {
        width,
        height,
        color = '##d2933f',
        backgroundColor = defaultBackground,
        seriesObservable,
        windowingTime = 100,
        shouldSubscribe = true,
        onSubscribe = noop,
        onUpdateData = noop,
        onUpdateTime = noop,
        filter = /./,
        children,
    } = props

    // override the defaults with the parent's properties, leaving any unset values as the default value
    const margin = {...defaultMargin, ...props.margin}
    // const axisStyle = {...defaultAxesStyle, ...props.axisStyle}
    // const axisLabelFont: AxesLabelFont = {...defaultAxesLabelFont, ...props.axisLabelFont}
    const svgStyle: SvgStyle = {...initialSvgStyle, ...props.svgStyle, width: props.width, height: props.height}

    // id of the chart to avoid dom conflicts when multiple charts are used in the same app
    const chartId = useRef<number>(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))

    // hold a reference to the current width and the plot dimensions
    const plotDimRef = useRef<Dimensions>(plotDimensionsFrom(width, height, margin))

    // the container that holds the d3 svg element
    const mainGRef = useRef<GSelection>()
    const containerRef = useRef<SVGSVGElement>(null)

    // const [dimensions, setDimensions] = useState<Dimensions>({width, height})

    // called on mount to set up the <g> element into which to render
    useEffect(
        () => {
            if (containerRef.current !== null) {
                // create the main SVG element if it doesn't already exist
                if (mainGRef.current === undefined) {
                    mainGRef.current = d3.select<SVGSVGElement, any>(containerRef.current)
                        .append<SVGGElement>('g')
                        .attr('id', `main-container-${chartId}`)
                }

                // build up the svg style from the defaults and any svg style object
                // passed in as properties
                const style = Object.getOwnPropertyNames(svgStyle)
                    .map(name => `${name}: ${svgStyle[name]}; `)
                    .join("")

                const background = backgroundColor !== defaultBackground ?
                    `background-color: ${backgroundColor}; ` :
                    ''

                // update the dimension and style
                d3.select<SVGSVGElement, any>(containerRef.current)
                    .attr('width', width)
                    .attr('height', height)
                    .attr('style', style + background)
            }
        },
        [height, width]
    )

    return (
        <>
            <svg ref={containerRef}/>
            <ChartProvider
                container={containerRef.current}
                chartId={chartId.current}
                containerDimensions={{width, height}}
            >
                {
                    // the chart elements are the children
                    children
                }
            </ChartProvider>
        </>
    );
}