import React, {JSX, useRef, useState} from 'react';
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
import {lightTheme, Theme} from "../ui/Themes";

import {Datum, TimeSeries} from "../charts/series/timeSeries";
import {regexFilter} from "../charts/filters/regexFilter";
import {Chart} from "../charts/Chart";
import {defaultMargin} from '../charts/hooks/usePlotDimensions';
import {AxisLocation} from '../charts/axes/axes';
import {ContinuousAxis} from "../charts/axes/ContinuousAxis";
import {OrdinalAxis} from "../charts/axes/OrdinalAxis";
import {Tracker, TrackerLabelLocation} from "../charts/trackers/Tracker";
import {Tooltip} from "../charts/tooltips/Tooltip";
import {formatNumber, formatTime} from '../charts/utils';
import {Button} from "../ui/Button";
import {BaseSeries, seriesFrom} from "../charts/series/baseSeries";
import {BarPlot} from "../charts/plots/BarPlot";
import {BarPlotTooltipContent} from "../charts/tooltips/BarPlotTooltipContent";
import {OrdinalChartData, ordinalsObservable} from "../charts/observables/ordinals";
import {OrdinalDatum} from "../charts/series/ordinalSeries";
import {BarSeriesStyle, defaultBarSeriesStyle} from "../charts/styling/barPlotStyle";
import {WindowedOrdinalStats} from "../charts/subscriptions/subscriptions";
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

/**
 * An example wrapper to a bar chart, that accepts an rxjs observable. The {@link Chart} manages
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
        initialData,
    } = props

    const chartId = useRef<number>(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))

    const initialDataRef = useRef<Array<BaseSeries<OrdinalDatum>>>(initialDataFrom(initialData.map(series => seriesFrom(series.name, series.data.slice()))))
    const observableRef = useRef<Observable<OrdinalChartData>>(ordinalsObservable(barDanceDataObservable(initialDataRef.current, UPDATE_PERIOD)));
    const [running, setRunning] = useState<boolean>(false)

    const [filterValue, setFilterValue] = useState<string>('');
    const [filter, setFilter] = useState<RegExp>(new RegExp(''));

    const [showMinMax, setShowMinMax] = useState<boolean>(true);
    const [showValue, setShowValue] = useState<boolean>(true);
    const [showMean, setShowMean] = useState<boolean>(true);
    const [showWinMinMax, setShowWinMinMax] = useState<boolean>(true);
    const [showWinMean, setShowWinMean] = useState<boolean>(true);

    const [visibility, setVisibility] = useState<Visibility>(initialVisibility);

    // elapsed time
    const startTimeRef = useRef<number>(new Date().valueOf())
    const intervalRef = useRef<NodeJS.Timeout>()
    const [elapsed, setElapsed] = useState<number>(0)

    // chart time
    const chartTimeRef = useRef<number>(0)

    function initialDataFrom(data: Array<TimeSeries>): Array<BaseSeries<OrdinalDatum>> {
        return data.map(series => seriesFrom<OrdinalDatum>(series.name, series.data.map(datum => ({
            time: datum.time,
            ordinal: series.name,
            value: datum.value,
        }))))
        // return data.map(series => seriesFrom(series.name))
    }

    /**
     * Called when the user changes the regular expression filter
     * @param updatedFilter The updated the filter
     */
    function handleUpdateRegex(updatedFilter: string): void {
        setFilterValue(updatedFilter);
        regexFilter(updatedFilter).ifSome(regex => setFilter(regex));
    }

    /**
     * Updates the time from the chart (the max value of the axes ranges)
     * @param times A map associating the axis with its time range
     */
    function handleChartTimeUpdate(times: Map<string, [start: number, end: number]>): void {
        chartTimeRef.current = Math.max(...Array.from(times.values()).map(([, end]) => end))
    }

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

    return (
        <Grid
            dimensionsSupplier={useGridCell}
            gridTemplateColumns={gridTrackTemplateBuilder()
                .addTrack(withFraction(1))
                .build()}
            gridTemplateRows={gridTrackTemplateBuilder()
                .addTrack(withPixels(30))
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
                            backgroundColor: theme.backgroundColor,
                            borderColor: theme.color,
                            color: theme.color,
                            marginRight: 0,
                        }}
                        onClick={() => {
                            if (!running) {
                                observableRef.current = ordinalsObservable(barDanceDataObservable(initialDataRef.current, UPDATE_PERIOD))
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
                        key={7}
                        checked={showValue}
                        label="value"
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.color}
                        backgroundColorChecked={theme.backgroundColor}
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
                        backgroundColorChecked={theme.backgroundColor}
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
                        backgroundColorChecked={theme.backgroundColor}
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
                        backgroundColorChecked={theme.backgroundColor}
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
                        backgroundColorChecked={theme.backgroundColor}
                        labelColor={theme.color}
                        onChange={() => setShowWinMean(!showWinMean)}
                        marginLeft={0}
                    />
                    <Checkbox
                        key={1}
                        checked={visibility.tooltip}
                        label="tooltip"
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.color}
                        backgroundColorChecked={theme.backgroundColor}
                        labelColor={theme.color}
                        onChange={() => setVisibility({...visibility, tooltip: !visibility.tooltip})}
                        marginLeft={0}
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
                        marginLeft={0}
                    />
                    <span style={{
                        color: theme.color,
                        marginLeft: 25
                    }}>lag: {formatTime(Math.max(0, elapsed - chartTimeRef.current))} ms</span>
                </div>
            </GridItem>
            <GridItem gridAreaName="chart">
                <Chart<OrdinalChartData, OrdinalDatum, BarSeriesStyle, WindowedOrdinalStats>
                    chartId={chartId.current}
                    width={useGridCellWidth()}
                    height={useGridCellHeight()}
                    margin={{...defaultMargin, top: 70, bottom: 40, right: 75, left: 70}}
                    // svgStyle={{'background-color': 'pink'}}
                    color={theme.color}
                    backgroundColor={theme.backgroundColor}
                    seriesStyles={new Map<string, BarSeriesStyle>([
                        ['neuron1', {
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
                        ['neuron14', {
                            ...defaultBarSeriesStyle(theme.name === 'light' ? 'blue' : 'gray'),
                            lineWidth: 3,
                            highlightWidth: 5,
                            minMaxBar: {
                                ...defaultBarSeriesStyle(theme.name === 'light' ? 'blue' : 'gray').minMaxBar,
                                widthFraction: 1
                            }

                        } as BarSeriesStyle],
                        ['neuron31', {
                            ...defaultBarSeriesStyle('green'),
                            lineWidth: 2,
                        } as BarSeriesStyle],
                    ])}
                    initialData={initialDataRef.current}
                    seriesFilter={filter}
                    seriesObservable={observableRef.current}
                    shouldSubscribe={running}
                    onUpdateAxesBounds={handleChartTimeUpdate}
                    windowingTime={25}
                    // onSubscribe={subscription => console.log("subscribed raster")}
                >
                    <OrdinalAxis
                        axisId="x-axis-1"
                        location={AxisLocation.Bottom}
                        categories={initialDataRef.current.map(series => series.name)}
                        label="neuron"
                        axisTickStyle={{rotation: 90}}
                    />
                    <OrdinalAxis
                        axisId="x-axis-2"
                        location={AxisLocation.Top}
                        categories={initialDataRef.current.map(series => series.name)}
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
                        <BarPlotTooltipContent
                            xFormatter={value => formatNumber(value, " ,.0f") + ' ms'}
                            yFormatter={value => formatNumber(value, " ,.1f") + ' mV'}
                        />
                    </Tooltip>
                    <BarPlot
                        barMargin={1}
                        dropDataAfter={5000}
                        // panEnabled={true}
                        // zoomEnabled={true}
                        // zoomKeyModifiersRequired={true}
                        // withCadenceOf={50}

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
