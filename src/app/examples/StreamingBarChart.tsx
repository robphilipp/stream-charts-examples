import {type CSSProperties, type JSX, useRef, useState} from 'react';
import * as d3 from "d3";
import {Observable} from "rxjs";
import Checkbox from "../ui/Checkbox";
import {barDanceDataObservable} from "./randomOrdinalData";
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
} from 'react-resizable-grid-layout';
import {lightTheme, type Theme} from "../ui/Themes";

import type {Datum, TimeSeries} from "../charts/series/timeSeries";
import {regexFilter} from "../charts/filters/regexFilter";
import {Chart} from "../charts/Chart";
import {AxisLocation, type OrdinalStringAxis} from '../charts/axes/axes';
import {ContinuousAxis} from "../charts/axes/ContinuousAxis";
import {OrdinalAxis} from "../charts/axes/OrdinalAxis";
import {Tracker} from "../charts/trackers/Tracker";
import {Tooltip} from "../charts/tooltips/Tooltip";
import {formatTime} from '../charts/utils';
import {Button} from "../ui/Button";
import {type BaseSeries, seriesFrom} from "../charts/series/baseSeries";
import {BarPlot} from "../charts/plots/BarPlot";
import {BarPlotTooltipContent} from "../charts/tooltips/BarPlotTooltipContent";
import {type OrdinalChartData, ordinalsObservable} from "../charts/observables/ordinals";
import {type OrdinalDatum} from "../charts/series/ordinalSeries";
import {type BarSeriesStyle, defaultBarSeriesStyle} from "../charts/styling/barPlotStyle";
import {type WindowedOrdinalStats} from "../charts/subscriptions/subscriptions";
import {AxisInterval} from "../charts/axes/AxisInterval";
import {assignAxes} from "../charts/plots/plot";
import {buttonStyle} from "../ui/utils";
import type {OrdinalAxisRange} from "../charts/axes/OrdinalAxisRange.ts";
import {TrackerLabelLocation} from "../charts/trackers/trackerUtils.ts";
import {defaultMargin} from "../charts/hooks/defaultPlotDimensions";
// import {
//     AxisLocation,
//     CategoryAxis,
//     Chart,
//     ChartData,
//     ContinuousAxis,
//     Datum,
//     defaultLineStyle,
//     defaultMargin,
//     formatNumber,
//     formatTime,
//     RasterPlot,
//     RasterPlotTooltipContent,
//     regexFilter,
//     Series,
//     seriesFrom,
//     Tooltip,
//     Tracker,
//     TrackerLabelLocation
// } from "stream-charts"

interface Visibility {
    tooltip: boolean
    tracker: boolean
    magnifier: boolean
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
    seriesHeight?: number
    plotWidth?: number
}

const UPDATE_PERIOD = 75
// calculates a unique chart ID when the module is loaded
const CHART_ID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)

/**
 * An example wrapper to a bar chart that accepts a rxjs observable. The {@link Chart} manages
 * the subscription to the observable, but we can control when the {@link Chart} subscribes through the
 * `shouldSubscribe` property. Once subscribed, the observable emits a sequence or random chart data. The
 * {@link Chart} updates itself with the new data without causing React to re-render the component. In this
 * example, we delay the subscription to the observable by 1 second.
 * after the {@link Chart} has mounted.
 * @param {Props} props The properties passed down from the parent
 * @return {Element} The streaming raster chart
 * @constructor
 */
export function StreamingBarChart(props: Props): JSX.Element {
    const {
        theme = lightTheme,
        initialData: originalInitialData = [],
    } = props

    // const chartId = useRef<number>(CHART_ID)

    const [initialData, setInitialData] = useState<Array<BaseSeries<OrdinalDatum>>>(initialDataFrom(originalInitialData.map(series => seriesFrom(series.name, series.data.slice()))))
    const [observable, setObservable] = useState<Observable<OrdinalChartData>>(ordinalsObservable(barDanceDataObservable(initialData, UPDATE_PERIOD)));
    const [running, setRunning] = useState<boolean>(false)

    // holds the state of the series filter input field
    const [filterValue, setFilterValue] = useState<string>('');
    const [filter, setFilter] = useState<RegExp>(new RegExp(''));

    // holds the state of the time-series statistics show in the plot
    const [showMinMax, setShowMinMax] = useState<boolean>(true);
    const [showValue, setShowValue] = useState<boolean>(true);
    const [showMean, setShowMean] = useState<boolean>(true);
    const [showWinMinMax, setShowWinMinMax] = useState<boolean>(true);
    const [showWinMean, setShowWinMean] = useState<boolean>(true);

    const [visibility, setVisibility] = useState<Visibility>(initialVisibility);

    // elapsed time
    const startTimeRef = useRef<number>(new Date().valueOf())
    const intervalRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const [elapsed, setElapsed] = useState<number>(0)

    // chart time
    const [chartTime, setChartTime] = useState<number>(0)

    /**
     * Converts each of the specified time-series to a base-series of ordinal data. Recall that a
     * `TimeSeries` is a `BaseSeries` of `Datum` which are (time, value)-pairs. The bar chart shows
     * the current (time, value) for each series (as well as stats). `OrdinalDatum` is a
     * (name, time, value)-tuple which we need for an ordinal chart. Hence the conversion.
     * @param data An array of time-series to plot
     * @return An array of base-series of ordinal data
     */
    function initialDataFrom(data: Array<TimeSeries>): Array<BaseSeries<OrdinalDatum>> {
        return data.map(series => seriesFrom<OrdinalDatum>(series.name, series.data.map(datum => ({
            time: datum.x,
            ordinal: series.name,
            value: datum.y,
        }))))
    }

    /**
     * Called when the user changes the regular expression filter to filter the time-series
     * @param updatedFilter The updated the filter
     */
    function handleUpdateRegex(updatedFilter: string): void {
        setFilterValue(updatedFilter);
        regexFilter(updatedFilter).onSuccess(regex => setFilter(regex));
    }

    /**
     * Updates the chart time based on the observable data time
     * @param time The time from the observable data
     */
    function handleChartTimeUpdate(time: number): void {
        setChartTime(time)
    }

    /**
     * Updates the time from the chart (the max value of the axes ranges)
     * @param times A map associating the axis with its time range
     */
    function handleChartRangeUpdate(times: Map<string, AxisInterval>): void {
        setChartTime(Math.max(...Array.from(times.values()).map(range => range.end)))
    }

    const inputStyle: CSSProperties = {
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

    return (
        <Grid
            dimensionsSupplier={useGridCell}
            gridTemplateColumns={gridTrackTemplateBuilder()
                .addTrack(withFraction(1))
                .build()}
            gridTemplateRows={gridTrackTemplateBuilder()
                .addTrack(withPixels(50))
                .addTrack(withFraction(1))
                .build()}
            gridTemplateAreas={gridTemplateAreasBuilder()
                .addArea("chart-controls", gridArea(1, 1))
                .addArea("chart", gridArea(2, 1))
                .build()}
            styles={{color: '#d2933f'}}
        >
            <GridItem gridAreaName="chart-controls">
                <div>
                    <label style={{color: theme.color}}>regex filter <input
                        type="text"
                        value={filterValue}
                        onChange={event => handleUpdateRegex(event.currentTarget.value)}
                        style={{...inputStyle,  marginRight: 10}}
                    /></label>
                    <Button
                        style={{
                            ...buttonStyle(theme),
                            marginRight: 0,
                        }}
                        onClick={() => {
                            if (!running) {
                                setObservable(ordinalsObservable(barDanceDataObservable(initialData, UPDATE_PERIOD)))
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
                        {running ? "Pause" : "Run"}
                    </Button>
                    <Button
                        style={buttonStyle(theme)}
                        onClick={() => {
                            setInitialData(initialDataFrom(originalInitialData))
                            setElapsed(0)
                        }}
                        disabled={running}
                    >
                        Clear
                    </Button>
                    <Checkbox
                        key={7}
                        checked={showValue}
                        label="value"
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.color}
                        labelColor={theme.color}
                        onChange={() => setShowValue(!showValue)}
                        marginLeft={0}
                    />
                    <Checkbox
                        key={3}
                        checked={showMinMax}
                        label="min/max"
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.color}
                        labelColor={theme.color}
                        onChange={() => setShowMinMax(!showMinMax)}
                        marginLeft={0}
                    />
                    <Checkbox
                        key={4}
                        checked={showMean}
                        label="mean"
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.color}
                        labelColor={theme.color}
                        onChange={() => setShowMean(!showMean)}
                        marginLeft={0}
                    />
                    <Checkbox
                        key={5}
                        checked={showWinMinMax}
                        label="win min/max"
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.color}
                        labelColor={theme.color}
                        onChange={() => setShowWinMinMax(!showWinMinMax)}
                        marginLeft={0}
                    />
                    <Checkbox
                        key={6}
                        checked={showWinMean}
                        label="win mean"
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.color}
                        labelColor={theme.color}
                        onChange={() => setShowWinMean(!showWinMean)}
                        marginLeft={0}
                    />
                    <Checkbox
                        key={1}
                        checked={visibility.tooltip && !running}
                        disabled={running}
                        label="tooltip"
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.color}
                        labelColor={theme.color}
                        onChange={() => setVisibility({...visibility, tooltip: !visibility.tooltip})}
                        marginLeft={0}
                    />
                    <Checkbox
                        key={2}
                        checked={visibility.tracker && !running}
                        disabled={running}
                        label="tracker"
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.color}
                        labelColor={theme.color}
                        onChange={() => setVisibility({...visibility, tracker: !visibility.tracker})}
                        marginLeft={0}
                    />
                    <span style={{
                        color: theme.color,
                        marginLeft: 25
                    }}>lag: {formatTime(Math.max(0, elapsed - chartTime))} ms</span>
                </div>
            </GridItem>
            <GridItem gridAreaName="chart">
                <Chart<OrdinalChartData, OrdinalDatum, BarSeriesStyle, WindowedOrdinalStats, OrdinalAxisRange, OrdinalStringAxis>
                    chartId={CHART_ID}
                    // chartId={chartId.current}
                    width={useGridCellWidth()}
                    height={useGridCellHeight()}
                    margin={{...defaultMargin, top: 60, bottom: 80, right: 75, left: 70}}
                    // svgStyle={{'background-color': 'pink'}}
                    color={theme.color}
                    backgroundColor={theme.backgroundColor}
                    seriesStyles={new Map<string, BarSeriesStyle>([
                        ['HC 1', {
                            ...defaultBarSeriesStyle('orange'),
                            lineWidth: 2,
                            minMaxBar: {
                                ...defaultBarSeriesStyle('orange').minMaxBar,
                                stroke: {
                                    ...defaultBarSeriesStyle('orange').minMaxBar.stroke,
                                    width: 0
                                }
                            }
                        } as BarSeriesStyle],
                        ['HC 14', {
                            ...defaultBarSeriesStyle(theme.name === 'light' ? 'blue' : 'gray'),
                            lineWidth: 3,
                            highlightWidth: 5,
                            minMaxBar: {
                                ...defaultBarSeriesStyle(theme.name === 'light' ? 'blue' : 'gray').minMaxBar,
                                widthFraction: 1
                            }

                        } as BarSeriesStyle],
                        ['HC 31', {
                            ...defaultBarSeriesStyle('green'),
                            lineWidth: 2,
                        } as BarSeriesStyle],
                    ])}
                    initialData={initialData}
                    seriesObservable={observable}
                    seriesFilter={filter}
                    shouldSubscribe={running}
                    onUpdateChartTime={handleChartTimeUpdate}
                    onUpdateAxesBounds={handleChartRangeUpdate}
                    windowingTime={25}
                >
                    <OrdinalAxis
                        axisId="x-axis-1"
                        location={AxisLocation.Bottom}
                        categories={initialData.map(series => series.name)}
                        label="neuron"
                        axisTickStyle={{rotation: 90}}
                    />
                    <OrdinalAxis
                        axisId="x-axis-2"
                        location={AxisLocation.Top}
                        categories={initialData.map(series => series.name)}
                        label="neuron"
                        axisTickStyle={{rotation: 40}}
                    />
                    <ContinuousAxis
                        axisId="y-axis-1"
                        location={AxisLocation.Left}
                        domain={[-1.1, 1.1]}
                        label="ρ (mV)"
                    />
                    <ContinuousAxis
                        axisId="y-axis-2"
                        location={AxisLocation.Right}
                        domain={[-1.1, 1.1]}
                        label="ρ (mV)"
                    />
                    <Tracker
                        // todo add horizontal/vertical for track, or both, maybe a mode
                        visible={visibility.tracker}
                        trackerAxis={AxisLocation.Left}
                        labelLocation={TrackerLabelLocation.ByAxis}
                        labelFormatter={x => `${d3.format(".2f")(x)} mV`}
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
                        <BarPlotTooltipContent ordinalUnits="mV"/>
                    </Tooltip>
                    <BarPlot
                        barMargin={1}
                        dropDataAfter={5000000}
                        panEnabled={true}
                        zoomEnabled={true}
                        zoomKeyModifiersRequired={true}
                        // withCadenceOf={50}

                        // to have the upper axis zoom when the series zoom, we must have at
                        // least one series assigned to this axis.
                        axisAssignments={new Map([
                            ['neuron1', assignAxes("x-axis-2", "y-axis-2")],
                        ])}

                        showMinMaxBars={showMinMax}
                        showValueLines={showValue}
                        showMeanValueLines={showMean}
                        showWindowedMinMaxBars={showWinMinMax}
                        showWindowedMeanValueLines={showWinMean}
                    />
                </Chart>
            </GridItem>
        </Grid>
    );
}
