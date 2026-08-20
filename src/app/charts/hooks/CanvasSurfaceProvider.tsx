import {type JSX, useCallback, useEffect, useMemo, useState} from "react";
import {usePlotDimensions} from "./usePlotDimensions";
import {createCanvasContext, resizeCanvasTo} from "../plots/plot";
import type {CanvasContext} from "../d3types";
import {CanvasSurfaceContext} from "./useCanvasSurface";
import {initialSvgStyle, type SvgStyle} from "../styling/svgStyle";

const defaultBackground = '#202020';

export type Props = {
    chartId: number
    color: string
    backgroundColor: string
    svgStyle?: Partial<SvgStyle>
    children: JSX.Element | Array<JSX.Element>
}

/**
 * Creates and sizes the chart's `<canvas>` element, and provides the resulting canvas element and
 * drawing context (via {@link useCanvasSurface}) to descendants -- most notably {@link ChartProvider}.
 *
 * Must be rendered as a descendant of {@link PlotDimensionsProvider}. The canvas's size is derived
 * entirely from {@link usePlotDimensions}'s `plotDimensions`/`margin` -- the single source of truth
 * for the chart's dimensions -- rather than from static width/height props. This matters because
 * `usePlotDimensions` also exposes `updateDimensions(...)`, an escape hatch for updating
 * dimensions independent of any prop (e.g. from a `ResizeObserver`-driven descendant); sourcing
 * the canvas's size from the same place those updates land keeps the canvas from ever drifting out
 * of sync with what the axes/plots believe the plot dimensions to be.
 * @param props The properties
 * @return The children, wrapped in the canvas-surface context provider
 */
export default function CanvasSurfaceProvider(props: Props): JSX.Element {
    const {
        chartId,
        color,
        backgroundColor,
        children
    } = props

    // the container (canvas) size is the plot area plus its margins -- i.e. the inverse of what
    // plotDimensionsFrom(width, height, margin) computes -- reconstructed from usePlotDimensions'
    // state rather than from props, so this stays correct even when dimensions are updated via
    // updateDimensions(...) rather than a containerDimensions prop change.
    const {plotDimensions, margin} = usePlotDimensions()
    const width = plotDimensions.width + margin.left + margin.right
    const height = plotDimensions.height + margin.top + margin.bottom

    const svgStyle = useMemo<SvgStyle>(
        () => ({...initialSvgStyle, ...props.svgStyle}),
        [props.svgStyle]
    )

    const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
    const [canvasContext, setCanvasContext] = useState<CanvasContext | null>(null)

    // create the canvas context (and size the backing store) if it doesn't already exist
    if (!canvasContext && canvas) {
        const cc = createCanvasContext(chartId, canvas, plotDimensions, color)
        resizeCanvasTo(cc, {width, height})
        setCanvasContext(cc)
    }

    // keep the canvas's backing store in sync with the plot dimensions, however they change
    // (prop-driven container resize, or a direct updateDimensions(...) call)
    useEffect(
        () => {
            if (canvasContext) {
                resizeCanvasTo(canvasContext, {width, height})
                canvasContext.requestRedraw()
            }
        },
        [canvasContext, width, height]
    )

    const setCanvasCallback = useCallback(
        /**
         * Callback for setting the canvas element and updating its CSS style.
         * @param canvasElement - The canvas element, or null if not available (e.g. unmounting).
         */
        (canvasElement: HTMLCanvasElement | null) => {
            if (canvasElement) {
                setCanvas(canvasElement)

                // build up the container style from the defaults and any style object passed in
                // as properties. IMPORTANT: width/height are deliberately excluded here. A
                // unitless number (which is what a bare width/height would be) is invalid CSS and
                // gets silently ignored by the browser -- sizing is handled exclusively by the
                // resizeCanvasTo() effect above (via properly `px`-suffixed values) and the
                // dpr-scaled backing store; letting width/height slip into this string would
                // overwrite that correct, unitted sizing with an invalid one.
                const style = Object.getOwnPropertyNames(svgStyle)
                    .filter(name => name !== 'width' && name !== 'height')
                    .map(name => `${name}: ${svgStyle[name]}; `)
                    .join("")

                const background = backgroundColor !== defaultBackground ?
                    `background-color: ${backgroundColor}; ` :
                    ''

                canvasElement.setAttribute('style', style + background + ` color: ${color}`)
            }
        },
        [backgroundColor, color, svgStyle]
    )

    return (
        <CanvasSurfaceContext.Provider value={{canvas, canvasContext}}>
            <div style={{position: 'relative', width, height}}>
                <canvas ref={setCanvasCallback}/>
            </div>
            {children}
        </CanvasSurfaceContext.Provider>
    )
}
