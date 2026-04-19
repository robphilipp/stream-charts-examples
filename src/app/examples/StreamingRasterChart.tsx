import React, {CSSProperties, JSX, useRef, useState} from 'react';
import {Observable} from "rxjs";
import Checkbox from "../ui/Checkbox";
import {randomSpikeDataObservable} from "./randomSpikeData";
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

import {
    AxisInterval,
    AxisLocation,
    Chart,
    ContinuousAxis,
    Datum,
    defaultLineStyle,
    defaultMargin,
    formatNumber,
    formatTime,
    Legend,
    LegendLocation,
    OrdinalAxis,
    RasterPlot,
    RasterPlotTooltipContent,
    regexFilter,
    seriesFrom,
    TimeSeries,
    TimeSeriesChartData,
    Tooltip,
    Tracker,
    TrackerLabelLocation,
    EmptyAxis
} from "stream-charts";
import {Button} from "../ui/Button";
import * as d3 from "d3";

interface Visibility {
    tooltip: boolean;
    tracker: boolean;
    magnifier: boolean;
    legend: boolean;
}

const initialVisibility: Visibility = {
    tooltip: false,
    tracker: false,
    magnifier: false,
    legend: false,
}

const LEGEND_LOCATIONS = new Map<string, LegendLocation>([
    ['Top-Left', LegendLocation.TOP_LEFT],
    ['Top-Right', LegendLocation.TOP_RIGHT],
    ['Bottom-Left', LegendLocation.BOTTOM_LEFT],
    ['Bottom-Right', LegendLocation.BOTTOM_RIGHT],
    ['External', LegendLocation.EXTERNAL_CONTAINER]
])

/**
 * The properties
 */
interface Props {
    theme?: Theme
    timeWindow?: number;
    initialData: Array<TimeSeries>;
    seriesHeight?: number;
    plotWidth?: number;
}

/**
 * The spike-chart data produced by the rxjs observable that is pushed to the `RasterChart`
 */
export interface SpikesChartData {
    maxTime: number;
    spikes: Array<{ index: number; spike: Datum }>
}

/**
 * An example wrapper to a raster chart, that accepts an rxjs observable. The {@link Chart} manages
 * the subscription to the observable, but we can control when the {@link Chart} subscribes through the
 * `shouldSubscribe` property. Once subscribed, the observable emits a sequence or random chart data. The
 * {@link Chart} updates itself with the new data without causing React to re-render the component. In this
 * example, we delay the subscription to the observable by 1 second.
 * after the {@link Chart} has mounted.
 * @param {Props} props The properties passed down from the parent
 * @return {Element} The streaming raster chart
 * @constructor
 */
export function StreamingRasterChart(props: Props): JSX.Element {
    const {
        theme = lightTheme,
        initialData,
    } = props;

    const chartId = useRef<number>(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))

    const initialDataRef = useRef<Array<TimeSeries>>(initialDataFrom(initialData.map(series => seriesFrom(series.name, series.data.slice()))))
    const observableRef = useRef<Observable<TimeSeriesChartData>>(randomSpikeDataObservable(initialDataRef.current, 25));
    const [running, setRunning] = useState<boolean>(false)

    const [filterValue, setFilterValue] = useState<string>('');
    const [filter, setFilter] = useState<RegExp>(new RegExp(''));

    const [visibility, setVisibility] = useState<Visibility>(initialVisibility);

    const [legendLocation, setLegendLocation] = useState<LegendLocation>(LegendLocation.EXTERNAL_CONTAINER)
    const legendContainerRef = useRef<HTMLDivElement>(null)

    // elapsed time
    const startTimeRef = useRef<number>(new Date().valueOf())
    const intervalRef = useRef<NodeJS.Timeout>(undefined)
    const [elapsed, setElapsed] = useState<number>(0)

    // chart time
    const chartTimeRef = useRef<number>(0)

    function initialDataFrom(data: Array<TimeSeries>): Array<TimeSeries> {
        return data.map(series => seriesFrom(series.name, series.data.slice()))
    }

    /**
     * Called when the user changes the regular expression filter
     * @param updatedFilter The updated the filter
     */
    function handleUpdateRegex(updatedFilter: string): void {
        setFilterValue(updatedFilter);
        regexFilter(updatedFilter).onSuccess(regex => setFilter(regex));
    }

    /**
     * Updates the time from the chart (the max value of the axes ranges)
     * @param times A map associating the axis with its time range
     */
    function handleChartTimeUpdate(times: Map<string, AxisInterval>): void {
        chartTimeRef.current = Math.max(...Array.from(times.values()).map(range => range.end))
    }

    // the input style for the regex filter to select which series to display
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

    function handleInterpolationChange(selectedLegendLocation: string): void {
        const location = LEGEND_LOCATIONS.get(selectedLegendLocation)
        if (location) {
            setLegendLocation(location)
        }
    }

    return (
        <Grid
            dimensionsSupplier={useGridCell}
            gridTemplateColumns={gridTrackTemplateBuilder()
                .addTrack(withFraction(1))
                .addTrack(withPixels(visibility.legend && legendLocation === LegendLocation.EXTERNAL_CONTAINER ? 100 : 0))
                .build()}
            gridTemplateRows={gridTrackTemplateBuilder()
                .addTrack(withPixels(50))
                .addTrack(withFraction(1))
                .build()}
            gridTemplateAreas={gridTemplateAreasBuilder()
                .addArea("chart-controls", gridArea(1, 1))
                .addArea("chart", gridArea(2, 1))
                .addArea("chart-legend", gridArea(2, 2))
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
                                observableRef.current = randomSpikeDataObservable(initialDataRef.current, 50, 0.1)
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
                    <Checkbox
                        key={3}
                        checked={visibility.legend}
                        label="legend"
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.color}
                        backgroundColorChecked={theme.backgroundColor}
                        labelColor={theme.color}
                        onChange={() => setVisibility({...visibility, legend: !visibility.legend})}
                    />
                    {visibility.legend &&
                        <select
                            name="legendLocations"
                            style={{
                                backgroundColor: theme.backgroundColor,
                                color: theme.color,
                                borderColor: theme.color,
                                padding: 5,
                                borderRadius: 3,
                                outlineStyle: 'none'
                            }}
                            onChange={event => handleInterpolationChange(event.currentTarget.value)}
                            value={Array.from(LEGEND_LOCATIONS.entries()).find(([, v]) => v === legendLocation)?.[0]}
                        >
                            {Array.from(LEGEND_LOCATIONS.entries()).map(([name,]) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    }
                    <span style={{
                        color: theme.color,
                        marginLeft: 25
                    }}>lag: {formatTime(Math.max(0, elapsed - chartTimeRef.current))} ms</span>
                </div>
            </GridItem>
            <GridItem gridAreaName="chart">
                <Chart
                    chartId={chartId.current}
                    width={useGridCellWidth()}
                    height={useGridCellHeight()}
                    margin={{...defaultMargin, top: 40, right: visibility.legend && legendLocation === LegendLocation.EXTERNAL_CONTAINER ? 20 : 35, left: 70, bottom: 40}}
                    // svgStyle={{'background-color': 'pink'}}
                    color={theme.color}
                    backgroundColor={theme.backgroundColor}
                    seriesStyles={new Map(initialData.map(
                        (data, index) => [data.name, {
                            ...defaultLineStyle(),
                            lineWidth: linewidthFor(data.name),
                            color: colorFor(data.name, index, initialData.length, theme.name),
                            highlightWidth: highlightLinewidthFor(data.name),
                            highlightColor: colorFor(data.name, index, initialData.length, theme.name)
                        }])
                    )}
                    // seriesStyles={new Map([
                    //     ['neuron1', {
                    //         ...defaultLineStyle(),
                    //         color: 'orange',
                    //         lineWidth: 2,
                    //         highlightColor: 'orange'
                    //     }],
                    //     ['neuron2', {
                    //         ...defaultLineStyle(),
                    //         color: 'orange',
                    //         lineWidth: 2,
                    //         highlightColor: 'orange'
                    //     }],
                    //     ['neuron3', {
                    //         ...defaultLineStyle(),
                    //         color: 'orange',
                    //         lineWidth: 2,
                    //         highlightColor: 'orange'
                    //     }],
                    //     ['neuron4', {
                    //         ...defaultLineStyle(),
                    //         color: 'orange',
                    //         lineWidth: 2,
                    //         highlightColor: 'orange'
                    //     }],
                    //     ['neuron5', {
                    //         ...defaultLineStyle(),
                    //         color: 'orange',
                    //         lineWidth: 2,
                    //         highlightColor: 'orange'
                    //     }],
                    //     ['neuron6', {
                    //         ...defaultLineStyle(),
                    //         color: theme.name === 'light' ? 'blue' : 'gray',
                    //         lineWidth: 3,
                    //         highlightColor: theme.name === 'light' ? 'blue' : 'gray',
                    //         highlightWidth: 5
                    //     }],
                    //     // ['test3', {...defaultLineStyle, color: 'dodgerblue', lineWidth: 1, highlightColor: 'dodgerblue', highlightWidth: 3}],
                    // ])}
                    initialData={initialDataRef.current}
                    seriesFilter={filter}
                    seriesObservable={observableRef.current}
                    shouldSubscribe={running}
                    onUpdateAxesBounds={handleChartTimeUpdate}
                    windowingTime={25}
                    // onSubscribe={subscription => console.log("subscribed raster")}
                >
                    <ContinuousAxis
                        axisId="x-axis-1"
                        location={AxisLocation.Bottom}
                        domain={[0, 5000]}
                        label="t (ms)"
                        // font={{color: theme.color}}
                    />
                    <ContinuousAxis
                        axisId="x-axis-2"
                        location={AxisLocation.Top}
                        domain={[0, 5000]}
                        label="t (ms)"
                        // font={{color: theme.color}}
                    />
                    {/*<EmptyAxis*/}
                    {/*    axisId="x-axis-2"*/}
                    {/*    location={AxisLocation.Top}*/}
                    {/*/>*/}
                    <OrdinalAxis
                        axisId="y-axis-1"
                        location={AxisLocation.Left}
                        categories={initialDataRef.current.map(series => series.name)}
                        label="neuron"
                        axisTickStyle={{rotation: 25}}
                    />
                   <EmptyAxis
                        axisId="y-axis-2"
                        location={AxisLocation.Right}
                    />
                    <Tracker
                        visible={visibility.tracker}
                        labelLocation={TrackerLabelLocation.ByAxis}
                        labelFormatter={x => `${d3.format(",.0f")(x)} ms`}
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
                        <RasterPlotTooltipContent
                            xFormatter={value => formatNumber(value, " ,.0f") + ' ms'}
                            yFormatter={value => formatNumber(value, " ,.1f") + ' mV'}
                        />
                    </Tooltip>
                    <Legend
                        visible={visibility.legend}
                        // choose either the external legend (using react createPortal) or the internal legend
                        container={legendLocation === LegendLocation.EXTERNAL_CONTAINER ? legendContainerRef : undefined}
                        location={legendLocation !== LegendLocation.EXTERNAL_CONTAINER ? legendLocation : undefined}
                        style={{
                            fontColor: theme.color,
                            backgroundColor: theme.backgroundColor,
                            borderColor: theme.backgroundColor,
                            padding: 15,
                        }}
                    />
                    <RasterPlot
                        axisAssignments={new Map([
                            // ['test', assignAxes("x-axis-1", "y-axis-1")],
                            // ['neuron1', assignAxes("x-axis-2", "y-axis-2")],
                            // ['neuron2', assignAxes("x-axis-2", "y-axis-2")],
                            // ['neuron3', assignAxes("x-axis-2", "y-axis-2")],
                            // ['neuron4', assignAxes("x-axis-2", "y-axis-2")],
                            // ['neuron5', assignAxes("x-axis-2", "y-axis-2")],
                            // ['neuron6', assignAxes("x-axis-2", "y-axis-2")],
                            // ['test3', assignAxes("x-axis-1", "y-axis-1")],
                        ])}
                        spikeMargin={1}
                        dropDataAfter={5000}
                        panEnabled={true}
                        zoomEnabled={true}
                        zoomKeyModifiersRequired={true}
                        withCadenceOf={50}
                    />
                </Chart>
            </GridItem>
            <GridItem gridAreaName="chart-legend">
                <div ref={legendContainerRef} style={{marginTop: 30, padding: 8 }} />
            </GridItem>
        </Grid>
    );
}

function colorFor(name: string, index: number, numSeries: number, themeName: string): string {
    if (name === 'test1') return 'orange'
    if (name === 'test2') return themeName === 'light' ? 'blue' : 'gray'
    if (name === 'test3') return themeName === 'light' ? 'dodgerblue' : 'gray'

    const ratio = index / numSeries / 2
    return themeName === 'light' ?
        d3.interpolateRdBu(ratio > 0.25 ? ratio + 0.5 : ratio) :
        d3.interpolateRdBu(ratio + 0.25)
}

function linewidthFor(name: string): number {
    if (name === 'test1') return 1
    if (name === 'test2' || name === 'test3') return 3

    return 1
}

function highlightLinewidthFor(name: string): number {
    if (name === 'test1') return 3
    if (name === 'test2' || name === 'test3') return 5

    return 3
}
