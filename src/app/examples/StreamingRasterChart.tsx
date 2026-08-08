import {type JSX, useLayoutEffect, useRef, useState} from 'react';
import {Observable} from "rxjs";
import Checkbox from "../ui/Checkbox";
import {randomSpikeDataObservable} from "./dataproviders/randomSpikeData.ts";
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
import {lightTheme, type Theme} from "../ui/Themes.ts";

import type {TimeSeries} from "../charts/series/timeSeries";
import type {TimeSeriesChartData} from "../charts/series/timeSeriesChartData";
import {regexFilter} from "../charts/filters/regexFilter";
import {Chart} from "../charts/Chart";
import {AxisLocation, defaultLineStyle} from '../charts/axes/axes';
import {ContinuousAxis} from "../charts/axes/ContinuousAxis";
import {OrdinalAxis} from "../charts/axes/OrdinalAxis";
import {EmptyAxis} from "../charts/axes/EmptyAxis";
import {Tracker} from "../charts/trackers/Tracker";
import {Tooltip} from "../charts/tooltips/Tooltip";
import {RasterPlotTooltipContent} from "../charts/tooltips/RasterPlotTooltipContent";
import {formatNumber} from '../charts/utils';
import {RasterPlot} from "../charts/plots/RasterPlot";
import {Legend} from "../charts/legends/Legend";
import {seriesFrom} from "../charts/series/baseSeries";
import {AxisInterval} from "../charts/axes/AxisInterval";
import * as d3 from "d3";
import {buttonStyle} from "../ui/utils";
import {TrackerLabelLocation} from "../charts/trackers/trackerUtils.ts";
import {LegendLocation} from "../charts/legends/constants";
import {defaultMargin} from "../charts/hooks/defaultPlotDimensions";
import {ExpandableControlBar} from "../ui/ExpandableControlBar.tsx";
import {CommonExecutionControls} from "./controls/CommonExecutionControls.tsx";
import {CommonControls} from "./controls/CommonControls.tsx";
import {createInitialVisibility, type Visibility} from "./options/visibility.ts";
import {EXTERNAL_LEGEND_WIDTH, LEGEND_ANIMATION_DURATION_MS, LegendControl} from "./controls/LegendControl.tsx";
import {DEFAULT_DROP_AFTER_20, DROP_AFTER_20_SEC, dropDataOptionForMs} from "./options/dropDataAfter.ts";
import {FilterIcon, LagIcon, TooltipIcon, TrackerIcon} from "../ui/Icons.tsx";
import {SeriesFilter} from "./controls/SeriesFilter.tsx";
import {DropDataControl} from "./controls/DropDataControl.tsx";
import {LagDisplay} from "./controls/LagDisplay.tsx";
import {Divider} from "../ui/Divider.tsx";
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

const initialVisibility = createInitialVisibility()

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

// calculates a unique chart ID when the module is loaded
const CHART_ID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)

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
        initialData: originalInitialData = [],
    } = props

    const [initialData, setInitialData] = useState<Array<TimeSeries>>(() => initialDataFrom(originalInitialData.map(series => seriesFrom(series.name, series.data.slice()))))
    const [observable, setObservable] = useState<Observable<TimeSeriesChartData>>(randomSpikeDataObservable(initialData, 50));
    const [running, setRunning] = useState<boolean>(false)

    const [filterValue, setFilterValue] = useState<string>('');
    const [filter, setFilter] = useState<RegExp>(new RegExp(''));

    const [visibility, setVisibility] = useState<Visibility>(initialVisibility);

    const [legendLocation, setLegendLocation] = useState<LegendLocation>(LegendLocation.EXTERNAL_CONTAINER)
    const legendContainerRef = useRef<HTMLDivElement>(null)
    const [externalLegendWidth, setExternalLegendWidth] = useState<number>(0)
    const externalLegendWidthRef = useRef<number>(0)

    // elapsed time
    const startTimeRef = useRef<number>(new Date().valueOf())
    const intervalRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const [elapsed, setElapsed] = useState<number>(0)

    const [dropAfterMs, setDropAfterMs] = useState<number>(DEFAULT_DROP_AFTER_20[1])

    // chart time
    const [chartTime, setChartTime] = useState<number>(0)

    const shouldShowExternalLegend = visibility.legend && legendLocation === LegendLocation.EXTERNAL_CONTAINER
    const shouldRenderExternalLegend = legendLocation === LegendLocation.EXTERNAL_CONTAINER &&
        (shouldShowExternalLegend || externalLegendWidth > 0)

    useLayoutEffect(() => {
        const targetWidth = shouldShowExternalLegend ? EXTERNAL_LEGEND_WIDTH : 0
        if (externalLegendWidthRef.current === targetWidth) return

        const startWidth = externalLegendWidthRef.current
        const startedAt = performance.now()
        let animationFrameId = 0

        const easeInOutQuad = (progress: number): number =>
            progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2

        const animate = (now: number): void => {
            const progress = Math.min(1, (now - startedAt) / LEGEND_ANIMATION_DURATION_MS)
            const easedProgress = easeInOutQuad(progress)
            const nextWidth = startWidth + (targetWidth - startWidth) * easedProgress

            externalLegendWidthRef.current = nextWidth
            setExternalLegendWidth(nextWidth)

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate)
            }
        }

        animationFrameId = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(animationFrameId)
    }, [shouldShowExternalLegend])

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
        setChartTime(Math.max(...Array.from(times.values()).map(range => range.end)))
    }

    function handleRunPauseClick(): void {
        if (!running) {
            setObservable(randomSpikeDataObservable(initialData, 50, 0.1))
            startTimeRef.current = new Date().valueOf()
            setElapsed(0)
            intervalRef.current = setInterval(() => setElapsed(new Date().valueOf() - startTimeRef.current), 1000)
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current)
            intervalRef.current = undefined
        }
        setRunning(!running)
    }

    function handleClearClick(): void {
        setInitialData(initialDataFrom(originalInitialData))
        setElapsed(0)
    }

    return (
        <Grid
            dimensionsSupplier={useGridCell}
            gridTemplateColumns={gridTrackTemplateBuilder()
                .addTrack(withFraction(1))
                .addTrack(withPixels(Math.round(externalLegendWidth)))
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
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 8,
                    alignItems: 'flex-start',
                    width: '100%',
                    minWidth: 0,
                    overflowX: 'auto',
                    overflowY: 'visible',
                    scrollbarWidth: 'thin',
                    padding: '12px 28px 20px 28px',
                    marginTop: '-12px',
                    boxSizing: 'border-box',
                }}>
                    <ExpandableControlBar
                        expandButtonStyle={buttonStyle(theme)}
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.disabledBackgroundColor}
                        borderRadius={10}
                        minHeight={55}
                    >
                        <CommonExecutionControls
                            theme={theme}
                            type="header"
                            isRunning={running}
                            onRunPauseClick={handleRunPauseClick}
                            onClearClick={handleClearClick}
                        >
                            <LagIcon
                                color={elapsed - chartTime > 0 ? theme.color : theme.disabledBackgroundColor}
                                fill={elapsed - chartTime > 0 ? "#c64646" : "none"}
                            />
                            <FilterIcon color={filterValue.length > 0 ? theme.color : theme.disabledBackgroundColor}/>
                            <TooltipIcon color={visibility.tooltip ? theme.color : theme.disabledBackgroundColor}/>
                            <TrackerIcon color={visibility.tracker ? theme.color : theme.disabledBackgroundColor}/>
                        </CommonExecutionControls>
                        <CommonControls>
                            <DropDataControl
                                theme={theme}
                                value={dropDataOptionForMs(dropAfterMs).getOrElse(DROP_AFTER_20_SEC)}
                                handleDropAfterChange={setDropAfterMs}
                                disabled={running}
                            />
                            <LagDisplay
                                theme={theme}
                                lag={elapsed - chartTime}
                            />
                            <Divider theme={theme}/>
                            <SeriesFilter
                                theme={theme}
                                filterValue={filterValue}
                                handleFilterUpdate={handleUpdateRegex}
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
                            />
                            <Divider theme={theme}/>
                            <LegendControl
                                theme={theme}
                                visibility={visibility.legend}
                                setVisibility={visible => setVisibility({...visibility, legend: visible})}
                                legendLocation={legendLocation}
                                setLegendLocation={setLegendLocation}
                            />
                        </CommonControls>
                    </ExpandableControlBar>
                </div>
            </GridItem>
            <GridItem gridAreaName="chart">
                <Chart
                    chartId={CHART_ID}
                    width={useGridCellWidth()}
                    height={useGridCellHeight()}
                    margin={{...defaultMargin, top: 40, right: 35, left: 90, bottom: 50}}
                    // svgStyle={{'background-color': 'pink'}}
                    color={theme.color}
                    backgroundColor={theme.backgroundColor}
                    seriesStyles={new Map(initialData.map(
                        (data, index) => [data.name, {
                            ...defaultLineStyle(),
                            lineWidth: linewidthFor(data.name),
                            color: colorFor(index, initialData.length, theme.name),
                            highlightWidth: highlightLinewidthFor(data.name),
                            highlightColor: colorFor(index, initialData.length, theme.name),
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
                    initialData={initialData}
                    seriesFilter={filter}
                    seriesObservable={observable}
                    shouldSubscribe={running}
                    onUpdateAxesBounds={handleChartTimeUpdate}
                    windowingTime={25}
                >
                    <ContinuousAxis
                        axisId="x-axis-1"
                        location={AxisLocation.Bottom}
                        domain={[0, 10000]}
                        label="t (ms)"
                        // font={{color: theme.color}}
                    />
                    <EmptyAxis
                        axisId="x-axis-2"
                        location={AxisLocation.Top}
                    />
                    <OrdinalAxis
                        axisId="y-axis-1"
                        location={AxisLocation.Left}
                        categories={initialData.map(series => series.name)}
                        label="Neuron ID"
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
                        visible={legendLocation === LegendLocation.EXTERNAL_CONTAINER ? shouldRenderExternalLegend : visibility.legend}
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
                        // axisAssignments={new Map([
                        //     // ['test', assignAxes("x-axis-1", "y-axis-1")],
                        //     // ['neuron1', assignAxes("x-axis-2", "y-axis-2")],
                        //     // ['neuron2', assignAxes("x-axis-2", "y-axis-2")],
                        //     // ['neuron3', assignAxes("x-axis-2", "y-axis-2")],
                        //     // ['neuron4', assignAxes("x-axis-2", "y-axis-2")],
                        //     // ['neuron5', assignAxes("x-axis-2", "y-axis-2")],
                        //     // ['neuron6', assignAxes("x-axis-2", "y-axis-2")],
                        //     // ['test3', assignAxes("x-axis-1", "y-axis-1")],
                        // ])}
                        spikeMargin={1}
                        dropDataAfter={dropAfterMs}
                        panEnabled={true}
                        zoomEnabled={true}
                        zoomKeyModifiersRequired={true}
                        withCadenceOf={50}
                    />
                </Chart>
            </GridItem>
            <GridItem gridAreaName="chart-legend" isVisible={shouldRenderExternalLegend}>
                <div
                    ref={legendContainerRef}
                    style={{
                        marginTop: 30,
                        padding: 8,
                        opacity: externalLegendWidth / EXTERNAL_LEGEND_WIDTH,
                        overflow: 'hidden',
                    }}
                />
            </GridItem>
        </Grid>
    );
}

function colorFor(index: number, numSeries: number, themeName: string): string {
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
