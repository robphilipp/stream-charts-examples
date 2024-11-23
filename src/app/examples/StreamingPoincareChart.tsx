import {default as React, JSX, useRef, useState} from "react";
import {tentMapObservable} from "./randomData";
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
import {Datum, TimeSeries} from "../charts/timeSeries";
import {regexFilter} from "../charts/regexFilter";
import {Chart} from "../charts/Chart";
import {defaultMargin} from '../charts/hooks/usePlotDimensions';
import {AxisLocation, defaultLineStyle} from '../charts/axes';
import {ContinuousAxis} from "../charts/ContinuousAxis";
import {Tracker, TrackerLabelLocation} from "../charts/Tracker";
import {Tooltip} from "../charts/Tooltip";
import {PoincarePlotTooltipContent} from "../charts/PoincarePlotTooltipContent";
import {formatNumber, formatTime} from '../charts/utils';
import {NoCurveFactory, PoincarePlot} from "../charts/PoincarePlot";
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
import {IterateChartData, iteratesObservable} from "../charts/iterates";
import {BaseSeries, seriesFrom} from "../charts/baseSeries";
import {Button} from "../ui/Button";

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

const DROP_DATA_AFTER_SECONDS: Map<string, number> = new Map<string, number>([
    ['Drop after 10 s', 10000], ['Drop after 20 s', 20000], ['Drop after 50 s', 50000], ['Drop after 100 s', 100000], ['Keep All', Infinity]
])
const DEFAULT_DROP_AFTER: [name: string, value: number] = Array.from(DROP_DATA_AFTER_SECONDS.entries())[1]

function interpolationFactoryFor(name: string, defaultFactory: d3.CurveFactory = d3.curveLinear): d3.CurveFactory {
    return (INTERPOLATIONS.get(name) || [undefined, defaultFactory])[1]
}

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

const randomData = (mu: number, updatePeriod: number): (initialData: Array<TimeSeries>) => Observable<IterateChartData> => {
    return initialData => iteratesObservable(tentMapObservable(mu, initialData, updatePeriod), 1)
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

export function StreamingPoincareChart(props: Props): JSX.Element {
    const {
        theme = lightTheme,
        initialData = [],
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

    const chartId = useRef<number>(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))

    const [tentMapMu, setTentMapMu] = useState<number>(1.8)

    const randomDataObservable = randomData(tentMapMu, 100)
    // const randomDataObservable = randomData(1.83, 100)
    const initialDataRef = useRef<Array<TimeSeries>>(initialData.map(series => seriesFrom(series.name, series.data.slice())))
    const observableRef = useRef<Observable<IterateChartData>>(randomDataObservable(initialDataRef.current))
    const [running, setRunning] = useState<boolean>(false)

    const [filterValue, setFilterValue] = useState<string>('');
    const [filter, setFilter] = useState<RegExp>(new RegExp(''));

    const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
    const [selectedInterpolationName, setSelectedInterpolationName] = useState<string>('curveStepAfter')
    const [interpolation, setInterpolation] = useState<d3.CurveFactory>(() => interpolationFactoryFor(selectedInterpolationName))

    const [selectedDropAfterName, setSelectedDropAfterName] = useState<string>(DEFAULT_DROP_AFTER[0])
    const [dropAfterMs, setDropAfterMs] = useState<number>(DEFAULT_DROP_AFTER[1])

    // elapsed time
    const startTimeRef = useRef<number>(new Date().valueOf())
    const intervalRef = useRef<NodeJS.Timeout>()
    const [elapsed, setElapsed] = useState<number>(0)

    // chart time
    // const chartTimeRef = useRef<number>(0)
    const [chartTime, setChartTime] = useState<number>(0)

    function initialDataFrom(data: Array<TimeSeries>): Array<TimeSeries> {
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
        const factory = interpolationFactoryFor(selectedInterpolation)
        setInterpolation(() => factory)
        setSelectedInterpolationName(selectedInterpolation)
    }

    function handleDropAfterChange(selectedDropAfterName: string): void {
        const dropAfter = DROP_DATA_AFTER_SECONDS.get(selectedDropAfterName) || Infinity
        setDropAfterMs(dropAfter)
        setSelectedDropAfterName(selectedDropAfterName)
    }

    function handleTentMapMuUpdate(mu: number): void {
        setTentMapMu(mu)
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
                        onClick={() => {
                            initialDataRef.current = initialDataFrom(initialData)
                            setElapsed(0)
                        }}
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
                    >
                        {Array.from(DROP_DATA_AFTER_SECONDS.entries()).map(([name, seconds]) => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                    <label style={{color: theme.color, paddingLeft: 10}}>mu <input
                        type="number"
                        value={tentMapMu}
                        onChange={event => handleTentMapMuUpdate(event.currentTarget.value as unknown as number)}
                        style={inputStyle}
                        disabled={running}
                    /></label>
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
                    margin={{...defaultMargin, top: 60, bottom: 30, right: 60}}
                    // svgStyle={{'background-color': 'pink'}}
                    color={theme.color}
                    backgroundColor={theme.backgroundColor}
                    seriesStyles={new Map([
                        ['test1', {
                            ...defaultLineStyle,
                            color: 'orange',
                            lineWidth: 1,
                            highlightColor: 'orange'
                        }],
                        ['test2', {
                            ...defaultLineStyle,
                            color: theme.name === 'light' ? 'blue' : 'gray',
                            lineWidth: 1,
                            highlightColor: theme.name === 'light' ? 'blue' : 'gray',
                            highlightWidth: 5
                        }],
                        ['test3', {
                            ...defaultLineStyle,
                            color: theme.name === 'light' ? 'red' : 'gray',
                            lineWidth: 1,
                            highlightColor: theme.name === 'light' ? 'dodgerblue' : 'gray',
                            highlightWidth: 5
                        }],
                    ])}
                    initialData={initialDataRef.current}
                    seriesFilter={filter}
                    seriesObservable={observableRef.current}
                    shouldSubscribe={running}
                    onUpdateChartTime={handleChartTimeUpdate}
                    // onUpdateAxesBounds={() => {}}
                    windowingTime={150}
                >
                    <ContinuousAxis
                        axisId="x-axis-1"
                        location={AxisLocation.Bottom}
                        domain={[0, 1]}
                        label="f[n](x)"
                    />
                    <ContinuousAxis
                        axisId="y-axis-1"
                        location={AxisLocation.Left}
                        domain={[0, 1]}
                        label="f[n+1](x)"
                    />
                    <ContinuousAxis
                        axisId="x-axis-2"
                        location={AxisLocation.Top}
                        domain={[0, 1]}
                        label="f[n](x)"
                    />
                    <ContinuousAxis
                        axisId="y-axis-2"
                        location={AxisLocation.Right}
                        domain={[0, 1]}
                        label="f[n+1](x)"
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
                        <PoincarePlotTooltipContent
                            xLabel="t (ms)"
                            yLabel="count"
                            yValueFormatter={value => formatNumber(value, " ,.0f")}
                            yChangeFormatter={(y1, y2) => formatNumber(y2 - y1, " ,.0f")}
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
