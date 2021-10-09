import {default as React, useRef, useState} from "react";
import {randomWeightDataObservable} from "./randomData";
import {Observable} from "rxjs";
import Checkbox from "./Checkbox";
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
// import {Series, seriesFrom} from "../charts/datumSeries";
// import {ChartData} from "../charts/chartData";
// import {regexFilter} from "../charts/regexFilter";
// import {Chart} from "../charts/Chart";
// import { defaultMargin } from '../charts/hooks/useChart';
// import {AxisLocation, defaultLineStyle } from '../charts/axes';
// import {ContinuousAxis} from "../charts/ContinuousAxis";
// import {Tracker, TrackerLabelLocation} from "../charts/Tracker";
// import {Tooltip} from "../charts/Tooltip";
// import {ScatterPlotTooltipContent} from "../charts/ScatterPlotTooltipContent";
// import {formatNumber, formatTime} from '../charts/utils';
// import {ScatterPlot} from "../charts/ScatterPlot";
// import {assignAxes} from "../charts/plot";
import {
    assignAxes,
    AxisLocation,
    Chart,
    ChartData,
    ContinuousAxis,
    defaultLineStyle,
    defaultMargin,
    formatNumber, formatTime,
    regexFilter,
    ScatterPlot,
    ScatterPlotTooltipContent,
    Series,
    seriesFrom,
    Tooltip,
    Tracker,
    TrackerLabelLocation
} from "stream-charts";
import * as d3 from "d3";
import {lightTheme, Theme} from "./Themes";

const INTERPOLATIONS = new Map<string, [string, d3.CurveFactory]>([
    ['curveLinear', ['Linear', d3.curveLinear]],
    ['curveNatural', ['Natural', d3.curveNatural]],
    ['curveMonotoneX', ['Monotone', d3.curveMonotoneX]],
    ['curveStep', ['Step', d3.curveStep]],
    ['curveStepAfter', ['Step After', d3.curveStepAfter]],
    ['curveStepBefore', ['Step Before', d3.curveStepBefore]],
    ['curveBumpX', ['Bump', d3.curveBumpX]],
])

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

const randomData = (delta: number, updatePeriod: number, min: number, max: number): (initialData: Array<Series>) => Observable<ChartData> => {
    return initialData => randomWeightDataObservable(initialData, delta, updatePeriod, min, max)
}

/**
 * The properties
 */
interface Props {
    theme?: Theme
    timeWindow?: number
    initialData: Array<Series>
    plotHeight?: number
    plotWidth?: number
}

export function StreamingScatterChart(props: Props): JSX.Element {
    const {
        theme = lightTheme,
        initialData,
    } = props


    const inputStyle = {
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
        marginRight: 20
    }

    const buttonStyle = {
        backgroundColor: theme.backgroundColor,
        outlineStyle: 'none',
        borderColor: theme.color,
        borderStyle: 'solid',
        borderWidth: 1,
        borderRadius: 3,
        color: theme.color,
        fontSize: 12,
        width: 50,
        padding: 4,
        margin: 6,
        marginRight: 20,
        cursor: 'pointer',
    }

    const randomDataObservable = randomData(25, 50, 10, 1000)
    const initialDataRef = useRef<Array<Series>>(props.initialData.map(series => seriesFrom(series.name, series.data.slice())))
    const observableRef = useRef<Observable<ChartData>>(randomDataObservable(initialDataRef.current))
    const [running, setRunning] = useState<boolean>(false)

    const [filterValue, setFilterValue] = useState<string>('');
    const [filter, setFilter] = useState<RegExp>(new RegExp(''));

    const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
    const [selectedInterpolationName, setSelectedInterpolationName] = useState<string>('curveLinear')
    const [interpolation, setInterpolation] = useState<d3.CurveFactory>(() => d3.curveLinear)

    // elapsed time
    const startTimeRef = useRef<number>(new Date().valueOf())
    const intervalRef = useRef<NodeJS.Timer>()
    const [elapsed, setElapsed] = useState<number>(0)

    // chart time
    const chartTimeRef = useRef<number>(0)

    function initialDataFrom(data: Array<Series>): Array<Series> {
        return data.map(series => seriesFrom(series.name, series.data.slice()))
    }

    /**
     * Called when the user changes the regular expression filter
     * @param updatedFilter The updated the filter
     */
    function handleUpdateRegex(updatedFilter: string): void {
        setFilterValue(updatedFilter);
        regexFilter(updatedFilter).ifSome((regex: RegExp) => setFilter(regex));
    }

    /**
     * Called when the interpolation is change for the chart. Converts the selected
     * interpolation name into the d3 curve-factory.
     * @param selectedInterpolation The name of the selected interpolation
     */
    function handleInterpolationChange(selectedInterpolation: string): void {
        const [, factory] = INTERPOLATIONS.get(selectedInterpolation) || ['Linear', d3.curveLinear]
        setInterpolation(() => factory)
        setSelectedInterpolationName(selectedInterpolation)
    }

    /**
     * Updates the time from the chart (the max value of the axes ranges)
     * @param times A map associating the axis with its time range
     */
    function handleChartTimeUpdate(times: Map<string, [start: number, end: number]>): void {
        chartTimeRef.current = Math.max(...Array.from(times.values()).map(([, end]) => end))
    }

    return (
        <Grid
            dimensionsSupplier={useGridCell}
            gridTemplateColumns={gridTrackTemplateBuilder()
                .addTrack(withFraction(1))
                .build()}
            gridTemplateRows={gridTrackTemplateBuilder()
                .addTrack(withPixels(35))
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
                    <label style={{color: theme.color}}>regex filter <input
                        type="text"
                        value={filterValue}
                        onChange={event => handleUpdateRegex(event.currentTarget.value)}
                        style={inputStyle}
                    /></label>
                    <button
                        onClick={() => {
                            if (!running) {
                                initialDataRef.current = initialDataFrom(initialData)
                                observableRef.current = randomDataObservable(initialDataRef.current)
                                startTimeRef.current = new Date().valueOf()
                                setElapsed(0)
                                intervalRef.current = setInterval(() => setElapsed(new Date().valueOf() - startTimeRef.current), 1000)
                            } else {
                                if (intervalRef.current) clearInterval(intervalRef.current)
                                intervalRef.current = undefined
                            }
                            setRunning(!running)
                        }}
                        style={buttonStyle}
                    >
                        {running ? "Stop" : "Run"}
                    </button>
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
                    <span style={{color: theme.color, marginLeft: 25}}>lag: {formatTime(Math.max(0, elapsed - chartTimeRef.current))} ms</span>
                    {/*<Checkbox*/}
                    {/*    key={3}*/}
                    {/*    checked={visibility.magnifier}*/}
                    {/*    label="magnifier"*/}
                    {/*    backgroundColor={theme.backgroundColor}*/}
                    {/*    borderColor={theme.color}*/}
                    {/*    backgroundColorChecked={theme.backgroundColor}*/}
                    {/*    labelColor={theme.color}*/}
                    {/*    onChange={() => setVisibility({*/}
                    {/*        tooltip: false,*/}
                    {/*        tracker: false,*/}
                    {/*        magnifier: !visibility.magnifier*/}
                    {/*    })}*/}
                    {/*/>*/}
                    {/*{visibility.magnifier ?*/}
                    {/*    (<label style={{color: theme.color}}><input*/}
                    {/*        type="range"*/}
                    {/*        value={magnification}*/}
                    {/*        min={1}*/}
                    {/*        max={10}*/}
                    {/*        step={1}*/}
                    {/*        onChange={event => setMagnification(parseInt(event.target.value))}*/}
                    {/*    /> ({magnification})</label>) :*/}
                    {/*    (<span/>)*/}
                    {/*}*/}
                </div>
            </GridItem>
            <GridItem gridAreaName="chart">
                <Chart
                    width={useGridCellWidth()}
                    height={useGridCellHeight()}
                    margin={{...defaultMargin, top: 60, right: 60}}
                    // svgStyle={{'background-color': 'pink'}}
                    color={theme.color}
                    backgroundColor={theme.backgroundColor}
                    seriesStyles={new Map([
                        ['test1', {...defaultLineStyle, color: 'orange', lineWidth: 1, highlightColor: 'orange'}],
                        ['test2', {...defaultLineStyle, color: theme.name === 'light' ? 'blue' : 'gray', lineWidth: 3, highlightColor: theme.name === 'light' ? 'blue' : 'gray', highlightWidth: 5}],
                        // ['test3', {...defaultLineStyle, color: 'dodgerblue', lineWidth: 1, highlightColor: 'dodgerblue', highlightWidth: 3}],
                    ])}
                    initialData={initialDataRef.current}
                    seriesFilter={filter}
                    seriesObservable={observableRef.current}
                    shouldSubscribe={running}
                    onUpdateTime={handleChartTimeUpdate}
                    windowingTime={75}
                    // windowingTime={25}
                >
                    <ContinuousAxis
                        axisId="x-axis-1"
                        location={AxisLocation.Bottom}
                        domain={[10, 10000]}
                        label="x-axis"
                        // font={{color: theme.color}}
                    />
                    <ContinuousAxis
                        axisId="y-axis-1"
                        location={AxisLocation.Left}
                        domain={[0, 1000]}
                        label="y-axis"
                    />
                    <ContinuousAxis
                        axisId="x-axis-2"
                        location={AxisLocation.Top}
                        domain={[100, 2500]}
                        label="x-axis (2)"
                    />
                    <ContinuousAxis
                        axisId="y-axis-2"
                        location={AxisLocation.Right}
                        scale={d3.scaleLog()}
                        domain={[100, 1200]}
                        label="y-axis (2)"
                    />
                    <Tracker
                        visible={visibility.tracker}
                        labelLocation={TrackerLabelLocation.WithMouse}
                        style={{color: theme.color}}
                        font={{color: theme.color}}
                        // onTrackerUpdate={update => console.dir(update)}
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
                        <ScatterPlotTooltipContent
                            xLabel="t (ms)"
                            yLabel="count"
                            yValueFormatter={value => formatNumber(value, " ,.0f")}
                            yChangeFormatter={value => formatNumber(value, " ,.0f")}
                        />
                    </Tooltip>
                    <ScatterPlot
                        interpolation={interpolation}
                        axisAssignments={new Map([
                            // ['test', assignAxes("x-axis-1", "y-axis-1")],
                            ['test2', assignAxes("x-axis-2", "y-axis-2")],
                            // ['test3', assignAxes("x-axis-1", "y-axis-1")],
                        ])}
                        dropDataAfter={10000}
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
