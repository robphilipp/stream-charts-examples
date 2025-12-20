import {default as React, JSX, useEffect, useRef, useState} from "react";
import {gaussMapFn, iterateFunctionObservable, logisticMapFn, tentMapFn} from "./randomIterateData";
import {Observable} from "rxjs";
import Checkbox from "../ui/Checkbox";
import {
    Grid,
    gridArea,
    GridItem,
    gridTemplateAreasBuilder,
    gridTrackTemplateBuilder,
    useGridCell,
    useGridCellHeight,
    useGridCellWidth,
    withFraction,
    withPixels
} from "react-resizable-grid-layout";
import {Datum, TimeSeries} from "../charts/series/timeSeries";
import {Chart} from "../charts/Chart";
import {defaultMargin} from '../charts/hooks/usePlotDimensions';
import {AxisLocation, defaultLineStyle} from '../charts/axes/axes';
import {ContinuousAxis} from "../charts/axes/ContinuousAxis";
import {Tracker, TrackerLabelLocation} from "../charts/trackers/Tracker";
import {Tooltip} from "../charts/tooltips/Tooltip";
import {PoincarePlotTooltipContent} from "../charts/tooltips/PoincarePlotTooltipContent";
import {formatNumber, formatTime} from '../charts/utils';
import {NoCurveFactory, PoincarePlot} from "../charts/plots/PoincarePlot";
// import {
//     assignAxes,
//     AxisLocation,
//     Chart,
//     ChartData,
//     ContinuousAxis,
//     defaultLineStyle,
//     defaultMargin,
//     formatNumber, formatTime,
//     regexFilter,
//     PoincarePlot,
//     PoincarePlotTooltipContent,
//     Series,
//     seriesFrom,
//     Tooltip,
//     Tracker,
//     TrackerLabelLocation
// } from "stream-charts";
import * as d3 from "d3";
import {lightTheme, Theme} from "../ui/Themes";
import {IterateChartData, iteratesObservable} from "../charts/observables/iterates";
import {BaseSeries, seriesFrom} from "../charts/series/baseSeries";
import {Button} from "../ui/Button";
import {defaultTooltipStyle} from "../charts/tooltips/tooltipUtils";

//
// the interpolations for the lines drawn between each iterate point.
// the "step-after" interpolations show a "cobweb" plot. the others
// are there for fun
//
const INTERPOLATIONS = new Map<string, [string, d3.CurveFactory]>([
    ['curveLinear', ['Linear', d3.curveLinear]],
    ['curveNatural', ['Natural', d3.curveNatural]],
    ['curveMonotoneX', ['Monotone', d3.curveMonotoneX]],
    ['curveStep', ['Step', d3.curveStep]],
    ['curveStepAfter', ['Step After', d3.curveStepAfter]],
    ['curveStepBefore', ['Step Before', d3.curveStepBefore]],
    ['curveBumpX', ['Bump', d3.curveBumpX]],
    ['curveNoLine', ['No Line', NoCurveFactory]],
])

/**
 * Returns a d3 curve-factory for generating the interpolations
 * @param name The name of the interpolation
 * @param [defaultFactory=d3.curveLinear] The default curve factory
 * @return A d3 curve-factory for generating the interpolations
 */
function interpolationFactoryFor(name: string, defaultFactory: d3.CurveFactory = d3.curveLinear): d3.CurveFactory {
    return (INTERPOLATIONS.get(name) || [undefined, defaultFactory])[1]
}

//
// policy for when to drop old data from long-running charts. recall that the data is
// streamed in at a specified interval, and so the data builds up over time.
//
const DROP_DATA_AFTER_SECONDS: Map<string, number> = new Map<string, number>([
    ['Drop after 10 s', 10000], ['Drop after 20 s', 20000], ['Drop after 50 s', 50000], ['Drop after 100 s', 100000], ['Keep All', Infinity]
])
const DEFAULT_DROP_AFTER: [name: string, value: number] = Array.from(DROP_DATA_AFTER_SECONDS.entries())[1]

//
// By default, the iterates plot shows f[n](x) versus f[n+1](x). Generally, given a lag "m",
// the plot can show f[n](x) versus f[n+m](x).
//
const LAG_N: Map<string, number> = new Map<string, number>([
    ['lag = 1', 1], ['lag = 2', 2], ['lag = 3', 3], ['lag = 4', 4], ['lag = 5', 5]
])
const DEFAULT_LAG_N: [name: string, value: number] = Array.from(LAG_N.entries())[0]

//
// iterate functions for Poincare plots
//
type IterateFunction = (time: number, xn: number) => Datum
type IterateFunctionCallback = (fn: IterateFunction) => void
type IterateFunctionInfo = {inputFn: (callback: IterateFunctionCallback, theme: Theme) => JSX.Element, range: [start: number, end: number]}

const inputStyleFor = (theme: Theme) => ({
    backgroundColor: theme.backgroundColor,
    outlineStyle: 'none',
    borderColor: theme.color,
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 3,
    color: theme.color,
    fontSize: 12,
    padding: 4,
    margin: 6,
    marginLeft: 0,
    marginRight: 20,
})

const spanStyleFor = (theme: Theme) => ({
    padding: 4,
    backgroundColor: theme.disabledBackgroundColor,
})

const labelStyleFor = (theme: Theme) => ({
    color: theme.color,
    paddingLeft: 6,
    paddingRight: 0,
})

// input components are at the end of the file
const ITERATE_FUNCTIONS: Map<string, IterateFunctionInfo> = new Map([
    ['Tent Map', {
        inputFn: (callback: IterateFunctionCallback, theme: Theme) => (<TentMapGenerator onFunctionChange={callback} theme={theme}/>),
        range: [0, 1]
    }],
    ['Logistic Map', {
        inputFn: (callback: IterateFunctionCallback, theme: Theme) => (<LogisticMapGenerator onFunctionChange={callback} theme={theme}/>),
        range: [0, 1]
    }],
    ['Gauss Map', {
        inputFn: (callback: IterateFunctionCallback, theme: Theme) => (<GaussMapGenerator onFunctionChange={callback} theme={theme}/>),
        range: [-1, 1]
    }],
])

const DEFAULT_ITER_FUNC = Array.from(ITERATE_FUNCTIONS.entries())[0]

//
// styling information
//
interface Visibility {
    tooltip: boolean;
    tracker: boolean;
    magnifier: boolean;
}

const initialVisibility: Visibility = {
    tooltip: false,
    tracker: false,
    magnifier: false
}

/**
 * The properties
 */
interface Props {
    theme?: Theme
    timeWindow?: number
    initialData: Array<BaseSeries<Datum>>
    plotHeight?: number
    plotWidth?: number
}

/**
 * Example of a streaming Poincare chart that shows iterate functions plotted as f[n](x) versus f[n+m](x).
 * I've added a few iterate functions: tent-map, logistic-map, and Gauss-map, with parameter inputs so that
 * you can play with the functions interactively.
 * @param props The props
 * @constructor
 */
export function StreamingPoincareChart(props: Props): JSX.Element {
    const {
        theme = lightTheme,
        initialData = [],
    } = props

    const chartId = useRef<number>(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))

    const initialDataRef = useRef<Array<TimeSeries>>(initialData.map(series => seriesFrom(series.name, series.data.slice())))
    const [running, setRunning] = useState<boolean>(false)

    const [visibility, setVisibility] = useState<Visibility>(initialVisibility);

    //
    // header bar information
    //
    const [selectedInterpolationName, setSelectedInterpolationName] = useState<string>('curveStepAfter')
    const [interpolation, setInterpolation] = useState<d3.CurveFactory>(() => interpolationFactoryFor(selectedInterpolationName))

    const [selectedDropAfterName, setSelectedDropAfterName] = useState<string>(DEFAULT_DROP_AFTER[0])
    const [dropAfterMs, setDropAfterMs] = useState<number>(DEFAULT_DROP_AFTER[1])

    const [selectedLagN, setSelectedLagN] = useState<string>(DEFAULT_LAG_N[0])
    const [lagN, setLagN] = useState<number>(DEFAULT_LAG_N[1])

    const [selectedIterateFunction, setSelectedIterateFunction] = useState<string>(DEFAULT_ITER_FUNC[0])
    const [iterateFunctionInputGen, setIterateFunctionInputGen] = useState<(callback: IterateFunctionCallback, theme: Theme) => JSX.Element>(() => DEFAULT_ITER_FUNC[1].inputFn)
    const [iterateFunction, setIterateFunction] = useState<IterateFunction>(() => tentMapFn(1.8))
    const [axesRange, setAxesRange] = useState<[start: number, end: number]>(DEFAULT_ITER_FUNC[1].range)

    // holds the iterate function input component as state, updating it when the iterate function
    // input generator changes (e.g. when the user selects a new iterate function
    const [iterFuncInput, setIterFuncInput] = useState<JSX.Element>(() => iterateFunctionInputGen((iterFn: IterateFunction) => setIterateFunction(() => iterFn), theme))
    useEffect(() => {
        setIterFuncInput(iterateFunctionInputGen((iterFn: IterateFunction) => setIterateFunction(() => iterFn), theme))
    }, [iterateFunctionInputGen, theme]);

    /**
     * Creates an iterates stream with lag N from a stream of points (time-series chart data
     * @param updatePeriod The time between successive points
     * @param lagN The lag of the iterates plot (e.g. f[n](x) vs f[n+N](x), where N is the lag)
     */
    const randomData = (updatePeriod: number, lagN: number): (initialData: Array<TimeSeries>) => Observable<IterateChartData> => {
        return initialData => iteratesObservable(iterateFunctionObservable(iterateFunction, initialData, updatePeriod), lagN)
    }
    const randomDataObservable = randomData(50, lagN)
    const observableRef = useRef<Observable<IterateChartData>>(randomDataObservable(initialDataRef.current))

    // elapsed time
    const startTimeRef = useRef<number>(new Date().valueOf())
    const intervalRef = useRef<NodeJS.Timeout>(undefined)
    const [elapsed, setElapsed] = useState<number>(0)

    // chart time
    const [chartTime, setChartTime] = useState<number>(0)

    function initialDataFrom(data: Array<TimeSeries>): Array<TimeSeries> {
        return data.map(series => seriesFrom(series.name, series.data.slice()))
    }

    /**
     * Called when the interpolation is change for the chart. Converts the selected
     * interpolation name into the d3 curve-factory.
     * @param selectedInterpolation The name of the selected interpolation
     */
    function handleInterpolationChange(selectedInterpolation: string): void {
        const factory = interpolationFactoryFor(selectedInterpolation)
        setInterpolation(() => factory)
        setSelectedInterpolationName(selectedInterpolation)
    }

    /**
     * When the user changes the time after which to drop points that are older than that time
     * @param selectedDropAfterName The name (in the select dropdown) representing the drop-after time
     */
    function handleDropAfterChange(selectedDropAfterName: string): void {
        const dropAfter = DROP_DATA_AFTER_SECONDS.get(selectedDropAfterName) || Infinity
        setDropAfterMs(dropAfter)
        setSelectedDropAfterName(selectedDropAfterName)
    }

    /**
     * The lag of the iterates plot (e.g. f[n](x) vs f[n+N](x), where N is the lag)
     * @param selectedLagN The name in the select dropdown that represents the lag N
     */
    function handleUpdateLag(selectedLagN: string): void {
        const lag = LAG_N.get(selectedLagN) || 1
        setLagN(lag)
        setSelectedLagN(selectedLagN)
    }

    /**
     * Updates the plot, axis bounds, and clears the data when the user selects a different
     * iterate function from the select dropdown
     * @param iterateFunction The name of the iterate function to use
     */
    function handleIterateFunctionChange(iterateFunction: string): void {
        setSelectedIterateFunction(iterateFunction)

        handleClearChart()

        const componentFactory = ITERATE_FUNCTIONS.get(iterateFunction)!.inputFn
        setIterateFunctionInputGen(() => componentFactory)

        const [start, end] = ITERATE_FUNCTIONS.get(iterateFunction)?.range || [0, 1]
        setAxesRange([start, end])
    }

    /**
     * Clears the chart and initializes the zoom
     */
    function handleClearChart(): void {
        initialDataRef.current = initialDataFrom(initialData)
        setElapsed(0)

        const [start, end] = ITERATE_FUNCTIONS.get(selectedIterateFunction)?.range || [0, 1]
        setAxesRange([start, end])
    }

    /**
     * Updates the time from the chart (the max value of the axes ranges)
     * @param time The current max time
     */
    function handleChartTimeUpdate(time: number): void {
        setChartTime(time)
    }

    return (
        <Grid
            dimensionsSupplier={useGridCell}
            gridTemplateColumns={gridTrackTemplateBuilder()
                .addTrack(withFraction(1))
                .build()}
            gridTemplateRows={gridTrackTemplateBuilder()
                .addTrack(withPixels(50))
                .addTrack(withFraction(1))
                .addTrack(withPixels(10))
                .build()}
            gridTemplateAreas={gridTemplateAreasBuilder()
                .addArea("chart-controls", gridArea(1, 1))
                .addArea("chart", gridArea(2, 1))
                .addArea("chart-bottom", gridArea(3, 1))
                .build()}
            styles={{color: '#d2933f'}}
        >
            <GridItem gridAreaName="chart-controls">
                <div>
                    <Button
                        style={{
                            backgroundColor: theme.backgroundColor,
                            borderColor: theme.color,
                            color: theme.color
                        }}
                        onClick={() => {
                            if (!running) {
                                observableRef.current = randomDataObservable(initialData)
                                startTimeRef.current = new Date().valueOf()
                                setElapsed(0)
                                intervalRef.current = setInterval(() => setElapsed(new Date().valueOf() - startTimeRef.current), 1000)
                            } else {
                                if (intervalRef.current) clearInterval(intervalRef.current)
                                intervalRef.current = undefined
                            }
                            setRunning(!running)
                        }}
                    >
                        {running ? "Stop" : "Run"}
                    </Button>
                    <Button
                        style={{
                            backgroundColor: theme.backgroundColor,
                            borderColor: theme.color,
                            color: theme.color
                        }}
                        disabledStyle={{
                            backgroundColor: theme.disabledBackgroundColor,
                            color: theme.disabledColor
                        }}
                        onClick={handleClearChart}
                        disabled={running}
                    >
                        Clear
                    </Button>
                    <Checkbox
                        key={1}
                        checked={visibility.tooltip}
                        label="tooltip"
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.color}
                        backgroundColorChecked={theme.backgroundColor}
                        labelColor={theme.color}
                        onChange={() => setVisibility({...visibility, tooltip: !visibility.tooltip})}
                    />
                    <Checkbox
                        key={2}
                        checked={visibility.tracker}
                        label="tracker"
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.color}
                        backgroundColorChecked={theme.backgroundColor}
                        labelColor={theme.color}
                        onChange={() => setVisibility({...visibility, tracker: !visibility.tracker})}
                    />
                    <select
                        name="lagN"
                        style={{
                            backgroundColor: theme.backgroundColor,
                            color: theme.color,
                            borderColor: theme.color,
                            padding: 5,
                            borderRadius: 3,
                            outlineStyle: 'none'
                        }}
                        onChange={event => handleUpdateLag(event.currentTarget.value)}
                        value={selectedLagN}
                        disabled={running}
                    >
                        {Array.from(LAG_N.entries()).map(([name, ]) => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                    <select
                        name="interpolations"
                        style={{
                            backgroundColor: theme.backgroundColor,
                            color: theme.color,
                            borderColor: theme.color,
                            padding: 5,
                            borderRadius: 3,
                            outlineStyle: 'none'
                        }}
                        onChange={event => handleInterpolationChange(event.currentTarget.value)}
                        value={selectedInterpolationName}
                    >
                        {Array.from(INTERPOLATIONS.entries()).map(([value, [name,]]) => (
                            <option key={value} value={value}>{name}</option>
                        ))}
                    </select>
                    <select
                        name="drop_after"
                        style={{
                            backgroundColor: theme.backgroundColor,
                            color: theme.color,
                            borderColor: theme.color,
                            padding: 5,
                            borderRadius: 3,
                            outlineStyle: 'none'
                        }}
                        onChange={event => handleDropAfterChange(event.currentTarget.value)}
                        value={selectedDropAfterName}
                        disabled={running}
                    >
                        {Array.from(DROP_DATA_AFTER_SECONDS.entries()).map(([name, _]) => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                    <span style={spanStyleFor(theme)}>
                    <select
                        name="iterate_function"
                        style={{
                            backgroundColor: theme.backgroundColor,
                            color: theme.color,
                            borderColor: theme.color,
                            padding: 5,
                            borderRadius: 3,
                            outlineStyle: 'none'
                        }}
                        onChange={event => handleIterateFunctionChange(event.currentTarget.value)}
                        value={selectedIterateFunction}
                        disabled={running}
                    >
                        {Array.from(ITERATE_FUNCTIONS.entries()).map(([name, _]) => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                    {iterFuncInput}
                        </span>
                    <span style={{
                        color: theme.color,
                        marginLeft: 25
                    }}>lag: {formatTime(Math.max(0, elapsed - chartTime))} ms</span>
                </div>
            </GridItem>
            <GridItem gridAreaName="chart">
                <Chart
                    chartId={chartId.current}
                    width={useGridCellWidth()}
                    height={useGridCellHeight()}
                    margin={{...defaultMargin, top: 40, bottom: 30, right: 60}}
                    // svgStyle={{'background-color': 'pink'}}
                    color={theme.color}
                    backgroundColor={theme.backgroundColor}
                    seriesStyles={new Map([
                        ['test1', {
                            ...defaultLineStyle(),
                            color: 'orange',
                            lineWidth: 1,
                            highlightColor: 'orange'
                        }],
                        ['test2', {
                            ...defaultLineStyle(),
                            color: theme.name === 'light' ? 'blue' : 'gray',
                            lineWidth: 1,
                            highlightColor: theme.name === 'light' ? 'blue' : 'gray',
                            highlightWidth: 5
                        }],
                        ['test3', {
                            ...defaultLineStyle(),
                            color: theme.name === 'light' ? 'red' : 'gray',
                            lineWidth: 1,
                            highlightColor: theme.name === 'light' ? 'dodgerblue' : 'gray',
                            highlightWidth: 5
                        }],
                    ])}
                    initialData={initialDataRef.current}
                    // seriesFilter={filter}
                    seriesObservable={observableRef.current}
                    shouldSubscribe={running}
                    onUpdateChartTime={handleChartTimeUpdate}
                    windowingTime={25}
                >
                    <ContinuousAxis
                        axisId="x-axis-1"
                        location={AxisLocation.Bottom}
                        domain={axesRange}
                        label="f[n](x)"
                        updateAxisBasedOnDomainValues={false}
                    />
                    <ContinuousAxis
                        axisId="y-axis-1"
                        location={AxisLocation.Left}
                        domain={axesRange}
                        label={`f[n+${lagN}](x)`}
                        updateAxisBasedOnDomainValues={false}
                    />
                    <ContinuousAxis
                        axisId="x-axis-2"
                        location={AxisLocation.Top}
                        domain={axesRange}
                        label="f[n](x)"
                        updateAxisBasedOnDomainValues={false}
                    />
                    <ContinuousAxis
                        axisId="y-axis-2"
                        location={AxisLocation.Right}
                        domain={axesRange}
                        label={`f[n+${lagN}](x)`}
                        updateAxisBasedOnDomainValues={false}
                    />
                    <Tracker
                        key="tracker-x-axis"
                        visible={visibility.tracker}
                        labelLocation={TrackerLabelLocation.WithMouse}
                        trackerAxis={AxisLocation.Bottom}
                        labelFormatter={x => `${d3.format(",.3f")(x)}`}
                        style={{color: theme.color}}
                        font={{color: theme.color}}
                        // onTrackerUpdate={update => console.dir("bottom", update)}
                    />
                    <Tracker
                        key="tracker-y-axis"
                        visible={visibility.tracker}
                        labelLocation={TrackerLabelLocation.WithMouse}
                        trackerAxis={AxisLocation.Left}
                        labelFormatter={x => `${d3.format(",.3f")(x)}`}
                        style={{color: theme.color}}
                        font={{color: theme.color}}
                        // onTrackerUpdate={update => console.dir("left", update)}
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
                        <PoincarePlotTooltipContent
                            xLabel="t (ms)"
                            yLabel="f(x)"
                            yValueFormatter={value => formatNumber(value, " ,.4f")}
                            style={{
                                ...defaultTooltipStyle,
                                fontColor: 'black',
                                // fontColor: theme.color,
                                fontWeight: 650
                            }}
                        />
                    </Tooltip>
                    <PoincarePlot
                        interpolation={interpolation}
                        dropDataAfter={dropAfterMs}
                        panEnabled={true}
                        zoomEnabled={true}
                        zoomKeyModifiersRequired={true}
                        // withCadenceOf={30}
                    />
                </Chart>
            </GridItem>
        </Grid>
    );
}


function TentMapGenerator(props: {onFunctionChange: (fn: IterateFunction) => void, theme?: Theme}): JSX.Element {
    const {theme = lightTheme, onFunctionChange} = props

    const [mu, setMu] = useState<string>('1.8')

    // we need the useEffect so that on mount, we issue the callback with the new iterate
    // function
    useEffect(() => {
        onFunctionChange(tentMapFn(parseFloat(mu)))
    }, [mu, onFunctionChange]);

    return <>
        <label style={labelStyleFor(theme)}>µ <input
            type="text"
            value={mu}
            onChange={event => setMu(event.currentTarget.value)}
            style={inputStyleFor(theme)}
        /></label>
    </>
}

function LogisticMapGenerator(props: {onFunctionChange: (fn: IterateFunction) => void, theme?: Theme}): JSX.Element {
    const {theme = lightTheme, onFunctionChange} = props

    const [r, setR] = useState<string>('4.0')

    // we need the useEffect so that on mount, we issue the callback with the new iterate
    // function
    useEffect(() => {
        onFunctionChange(logisticMapFn(parseFloat(r)))
    }, [r, onFunctionChange]);

    return <>
        <label style={labelStyleFor(theme)}>r <input
            type="text"
            value={r}
            onChange={event => setR(event.currentTarget.value)}
            style={inputStyleFor(theme)}
        /></label>
    </>
}

function GaussMapGenerator(props: {onFunctionChange: (fn: IterateFunction) => void, theme?: Theme}): JSX.Element {
    const {theme = lightTheme, onFunctionChange} = props

    const [alpha, setAlpha] = useState<string>('4.90')
    const [beta, setBeta] = useState<string>('-0.58')

    // we need the useEffect so that on mount, we issue the callback with the new iterate
    // function
    useEffect(() => {
        onFunctionChange(gaussMapFn(parseFloat(alpha), parseFloat(beta)))
    }, [alpha, beta, onFunctionChange]);

    return <span style={spanStyleFor(theme)}>
        <label style={labelStyleFor(theme)}>α <input
            type="text"
            value={alpha}
            onChange={event => setAlpha(event.currentTarget.value)}
            style={{...inputStyleFor(theme), marginRight: 6}}
        /></label>
        <label style={labelStyleFor(theme)}>β <input
            type="text"
            value={beta}
            onChange={event => setBeta(event.currentTarget.value)}
            style={inputStyleFor(theme)}
        /></label>
    </span>
}
