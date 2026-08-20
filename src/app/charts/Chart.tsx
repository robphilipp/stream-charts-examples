import {type JSX, useCallback, useEffect, useMemo, useState} from 'react'
import {type Dimensions, type Margin, plotDimensionsFrom} from "./styling/margins";
import {initialSvgStyle, type SvgStyle} from "./styling/svgStyle";
import type {CanvasContext} from "./d3types";
import type {BaseAxis, SeriesStyle} from "./axes/axes";
import {createCanvasContext, resizeCanvasTo} from "./plots/plot";
import {noop} from "./utils";
import {Observable, Subscription} from "rxjs";
import type {BaseSeries} from "./series/baseSeries";
import type {ChartData} from "./observables/ChartData";
import {AxisInterval} from "./axes/AxisInterval";
import type {BaseAxisRange} from "./axes/BaseAxisRange.ts";
import {defaultMargin} from "./hooks/defaultPlotDimensions";
import TooltipProvider from "./hooks/TooltipProvider";
import PlotDimensionsProvider from "./hooks/PlotDimensionsProvider";
import MouseProvider from "./hooks/MouseProvider";
import InitialDataProvider from "./hooks/InitialDataProvider";
import DataObservableProvider from "./hooks/DataObservableProvider";
import ChartProvider from "./hooks/ChartProvider";
import AxesProvider from "./hooks/AxesProvider";

const defaultBackground = '#202020';

/**
 * @param chartId A unique identifier for the chart. This is used to namespace draw-handles registered
 * with the chart's canvas context.
 * @param width The width of the chart container
 * @param height The height of the chart container
 * @param margin The margin between the edges of the chart container and the axes
 * @param color The base/default color of the chart lines. This can be overridden by the {@link Props.svgStyle} property.
 * @param backgroundColor The base/default background color. This can be overridden by the {@link Props.svgStyle} property.
 * @param svgStyle Overrides for the chart container's CSS style
 * @param seriesStyles Map holding the series name to the series style associated with that series.
 * @param initialData Initial (static) data to plot before subscribing to the {@link ChartData} observable.
 * @param asChartData Optional conversion function that converts an array of base-series with datum type D to a
 * descendent of a {@link ChartData} object
 * @param seriesFilter Regular expression that filters which series to display on the plot. Can be update while streaming
 * @param seriesObservable {@link ChartData} RxJS `Observable` that feeds the chart data to display (i.e. the data stream).
 * @param windowingTime The time-window (in milliseconds) to buffer the incoming data before updating the chart. This is
 * a lever to reduce the lag between real-time and chart-time when a large amount of data is being
 * sourced by the observable. Smaller time-windows result in smoother scrolling, but more updates, and
 * possibly a larger lag.
 * @param shouldSubscribe When switching to `true` from `false`, subscribes to the {@link seriesObservable}. When switching
 * to `false` from `true`, unsubscribes from the {@link seriesObservable}.
 * @param onSubscribe Callback when the chart subscribes to the {@link ChartData} observable
 * @param onUpdateAxesBounds Callback when the time range changes. This is generally used by plots where the
 * x-axis starts to scroll as the data streams in past the end of the current time
 * @param onUpdateChartTime Callback for updating the current chart time. This is generally used by plots
 * @template CD refers to the chart-data that is used by the Observable that has the stream of data.
 * @template D refers to the datum in the data-series
 * @template S refers to the type for the series style
 */
export interface Props<CD, D, S extends SeriesStyle> {
    chartId: number
    /**
     * The width of the chart container
     */
    width: number
    /**
     * The height of the chart container
     */
    height: number
    /**
     * The margin between the edges of the chart container and the axes
     */
    margin?: Partial<Margin>
    /**
     * The base/default color of the chart lines. This can be overridden by the {@link Props.svgStyle} property.
     */
    color?: string
    /**
     * The base/default background color. This can be overridden by the {@link Props.svgStyle} property.
     */
    backgroundColor?: string
    /**
     * Overrides for the chart container's CSS style
     */
    svgStyle?: Partial<SvgStyle>
    /**
     * Map holding the series name to the series style associated with that series.
     */
    seriesStyles?: Map<string, S>

    /*
     | INITIAL DATA
     */
    /**
     * Initial (static) data to plot before subscribing to the {@link ChartData} observable.
     */
    initialData: Array<BaseSeries<D>>
    /**
     * Optional conversion function that converts an array of base-series with datum type D to a
     * descendent of a {@link ChartData} object
     * @param initialData The initial array of series
     */
    asChartData?: (initialData: Array<BaseSeries<D>>) => CD
    /**
     * Regular expression that filters which series to display on the plot. Can be update while streaming
     */
    seriesFilter?: RegExp

    /*
     | DATA STREAM
     */
    /**
     * {@link ChartData} RxJS `Observable` that feeds the chart data to display (i.e. the data stream).
     */
    seriesObservable?: Observable<CD>
    /**
     * The time-window (in milliseconds) to buffer the incoming data before updating the chart. This is
     * a lever to reduce the lag between real-time and chart-time when a large amount of data is being
     * sourced by the observable. Smaller time-windows result in smoother scrolling, but more updates, and
     * possibly a larger lag.
     */
    windowingTime?: number
    /**
     * When switching to `true` from `false`, subscribes to the {@link seriesObservable}. When switching
     * to `false` from `true`, unsubscribes from the {@link seriesObservable}.
     */
    shouldSubscribe?: boolean
    /**
     * Callback when the chart subscribes to the {@link ChartData} observable
     * @param subscription The RxJS subscription
     */
    onSubscribe?: (subscription: Subscription) => void
    /**
     * Callback when the time range changes. This is generally used by plots where the
     * x-axis starts to scroll as the data streams in past the end of the current time
     * window.
     * @param ranges A function that accepts the ranges, (start, end) associated with
     * each axis in the plot. The ranges argument is a map(axis_id -> (start, end)).
     * Where start and end refer to the range for the axis.
     */
    onUpdateAxesBounds?: (ranges: Map<string, AxisInterval>) => void
    /**
     * Callback for updating the current chart time. This is generally used by plots
     * where the axes do not represent time, but rather some fix values, and the data
     * hold time information
     * @param time The current chart time
     */
    onUpdateChartTime?: (time: number) => void
    /**
     * Callback function that is called when new data arrives to the chart.
     * @param seriesName The name of the series for which new data arrived
     * @param data The new data that arrived in the windowing tine
     * @see UseChartValues.windowingTime
     */
    onUpdateData?: (seriesName: string, data: Array<D>) => void

    /**
     * The child components of the chart (i.e. the axis, plot, tracker, tooltip)
     */
    children: JSX.Element | Array<JSX.Element>;
}

/**
 * The chart container that holds the axes, plot, tracker, and tooltip. The chart manages the
 * subscription, sets up the {@link useChart} hook via the {@link ChartProvider}.
 *
 * Internally, the chart is backed by a single `<canvas>` element rather than an SVG element tree.
 * Axes, plots, and the tracker don't create/mutate their own DOM nodes anymore -- they register a
 * draw function with the {@link CanvasContext} (exposed via `useChart().canvasContext`), and the
 * canvas context clears and repaints all registered draw functions whenever a redraw is requested.
 * @param props The properties of the chart
 * @template CD Chart data
 * @template D The type of the datum type held in a series
 * @template S The type of the series style
 * @template TM The type of the tooltip metadata (the data about the series). If not specified,
 * defaults to an empty object
 * @example
 *

<Chart
    width={useGridCellWidth()}
    height={useGridCellHeight()}
    margin={{...defaultMargin, top: 60, right: 75, left: 70}}
    color={theme.color}
    backgroundColor={theme.backgroundColor}
    seriesStyles={new Map([
        ['neuron1', {
            ...defaultLineStyle,
            color: 'orange',
            lineWidth: 2,
            highlightColor: 'orange'
        }],
        ['neuron6', {
            ...defaultLineStyle,
            color: theme.name === 'light' ? 'blue' : 'gray',
            lineWidth: 3,
            highlightColor: theme.name === 'light' ? 'blue' : 'gray',
            highlightWidth: 5
        }],
    ])}
    initialData={initialDataRef.current}
    seriesFilter={filter}
    seriesObservable={observableRef.current}
    shouldSubscribe={running}
    onUpdateTime={handleChartTimeUpdate}
    windowingTime={150}
>
    <ContinuousAxis
        axisId="x-axis-1"
        location={AxisLocation.Bottom}
        domain={[0, 5000]}
        label="t (ms)"
    />
    <CategoryAxis
        axisId="y-axis-1"
        location={AxisLocation.Left}
        categories={initialDataRef.current.map(series => series.name)}
        label="neuron"
    />
    <CategoryAxis
        axisId="y-axis-2"
        location={AxisLocation.Right}
        categories={initialDataRef.current.map(series => series.name)}
        label="neuron"
    />
    <Tracker
        visible={visibility.tracker}
        labelLocation={TrackerLabelLocation.WithMouse}
        style={{color: theme.color}}
        font={{color: theme.color}}
    />
    <Tooltip
        visible={visibility.tooltip}
        style={{
            fontColor: theme.color,
            backgroundColor: theme.backgroundColor,
            borderColor: theme.color,
            backgroundOpacity: 0.9,
        }}
    >
        <RasterPlotTooltipContent
            xFormatter={value => formatNumber(value, " ,.0f") + ' ms'}
            yFormatter={value => formatNumber(value, " ,.1f") + ' mV'}
        />
    </Tooltip>
    <RasterPlot
        spikeMargin={1}
        dropDataAfter={5000}
        panEnabled={true}
        zoomEnabled={true}
        zoomKeyModifiersRequired={true}
    />
</Chart>
*/
export function Chart<CD extends ChartData, D, S extends SeriesStyle, TM, AR extends BaseAxisRange, A extends BaseAxis>(props: Props<CD, D, S>): JSX.Element {
    const {
        chartId,

        width,
        height,
        color = '#d2933f',
        backgroundColor = defaultBackground,
        seriesStyles = new Map<string, S>(),
        initialData,
        asChartData,
        seriesFilter = /./,
        seriesObservable,
        windowingTime = 100,
        shouldSubscribe = true,

        onSubscribe = noop,
        onUpdateAxesBounds = noop,
        onUpdateChartTime = noop,
        onUpdateData = noop,

        children,
    } = props

    // override the defaults with the parent's properties, leaving any unset values as the default value
    const margin = {...defaultMargin, ...props.margin}
    const svgStyle = useMemo<SvgStyle>(
        () => ({...initialSvgStyle, ...props.svgStyle, width: props.width, height: props.height}),
        [props.height, props.svgStyle, props.width]
    )

    // hold a reference to the current width and the plot dimensions
    const [plotDim, ] = useState<Dimensions>(() => plotDimensionsFrom(width, height, margin))

    // the canvas element and the drawing-context/redraw-registry built on top of it. `canvasContext`
    // replaces the old `mainG` (root SVG `<g>` selection) -- axes, plots, and the tracker register
    // their draw functions with it instead of appending/updating SVG child elements.
    const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
    const [canvasContext, setCanvasContext] = useState<CanvasContext | null>(null)

    // create the canvas context (and size the backing store) if it doesn't already exist
    if (!canvasContext && canvas) {
        const cc = createCanvasContext(chartId, canvas, plotDim, color)
        resizeCanvasTo(cc, {width, height})
        setCanvasContext(cc)
    }

    // keep the canvas's backing store in sync with the container's pixel dimensions; mirrors the
    // old effect that updated the SVG element's `width`/`height` attributes
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
                // as properties. IMPORTANT: width/height are deliberately excluded here. svgStyle
                // carries them as bare numbers (a holdover from the SVG version, where unitless
                // `width`/`height` are valid presentation-attribute values); as CSS `style`
                // properties, a unitless number is invalid and gets silently ignored by the
                // browser. Since resizeCanvasTo() is the sole thing responsible for the canvas's
                // CSS size (via properly `px`-suffixed values) and its dpr-scaled backing store,
                // letting a width/height slip into this string would overwrite that correct,
                // unitted sizing with an invalid one -- which the browser then discards, falling
                // back to the (dpr-scaled, so wrong on any non-1 devicePixelRatio) backing-store
                // size as the canvas's effective on-screen size.
                const style = Object.getOwnPropertyNames(svgStyle)
                    .filter(name => name !== 'width' && name !== 'height')
                    .map(name => `${name}: ${svgStyle[name]}; `)
                    .join("")

                // when the chart "backgroundColor" property is set (i.e. not the default value),
                // then we need to add it to the styles, overwriting any color that may have been
                // set in the style object
                const background = backgroundColor !== defaultBackground ?
                    `background-color: ${backgroundColor}; ` :
                    ''

                // update the style (dimensions are handled separately, on the canvas's backing
                // store, by resizeCanvasTo -- see the effect above)
                canvasElement.setAttribute('style', style + background + ` color: ${color}`)
            }
        },
        [backgroundColor, color, svgStyle]
    )

    return (
        <>
            <div style={{position: 'relative', width, height}}>
                <canvas ref={setCanvasCallback}/>
            </div>
            <PlotDimensionsProvider containerDimensions={{width, height}} margin={margin}>
                <AxesProvider onUpdateAxesInterval={onUpdateAxesBounds}>
                    <MouseProvider<D, TM>>
                        <TooltipProvider<D, TM>>
                            <InitialDataProvider<CD, D>
                                initialData={initialData}
                                asChartData={asChartData}
                            >
                                <DataObservableProvider<CD, D>
                                    seriesObservable={seriesObservable}
                                    windowingTime={windowingTime}
                                    shouldSubscribe={shouldSubscribe}

                                    onSubscribe={onSubscribe}
                                    onUpdateData={onUpdateData}
                                    onUpdateChartTime={onUpdateChartTime}
                                >
                                    <ChartProvider<S, AR, A>
                                        chartId={chartId}
                                        canvas={canvas}
                                        canvasContext={canvasContext}

                                        color={color}
                                        backgroundColor={backgroundColor}
                                        svgStyle={svgStyle}
                                        seriesStyles={seriesStyles}
                                        seriesFilter={seriesFilter}
                                    >
                                        {
                                            // the chart elements are the children
                                            children
                                        }
                                    </ChartProvider>
                                </DataObservableProvider>
                            </InitialDataProvider>
                        </TooltipProvider>
                    </MouseProvider>
                </AxesProvider>
            </PlotDimensionsProvider>
        </>
    );
}
