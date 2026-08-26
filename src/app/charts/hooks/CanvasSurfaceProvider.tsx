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
        const cc = createCanvasContext(chartId, canvas, color)
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

                // apply the style/background/color from the defaults and any style object passed
                // in as properties, one property at a time, rather than overwriting the whole
                // `style` attribute. This callback's identity changes whenever color/backgroundColor/
                // svgStyle change (e.g. a theme toggle), which makes React detach and reattach this
                // ref -- calling this function again with the *same* canvas element. A wholesale
                // `setAttribute('style', ...)` here would wipe out the width/height inline styles
                // that resizeCanvasTo() sets directly via canvas.style.width/height in a separate
                // effect that this callback's re-invocation does not also re-run, leaving the canvas
                // sized to its (much larger, dpr-scaled) backing store instead of its intended CSS
                // size. IMPORTANT: width/height are deliberately excluded here for the same reason --
                // sizing is handled exclusively by the resizeCanvasTo() effect above.
                Object.getOwnPropertyNames(svgStyle)
                    .filter(name => name !== 'width' && name !== 'height')
                    .forEach(name => canvasElement.style.setProperty(name, String(svgStyle[name])))

                canvasElement.style.backgroundColor = backgroundColor !== defaultBackground ? backgroundColor : ''
                canvasElement.style.color = color
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
