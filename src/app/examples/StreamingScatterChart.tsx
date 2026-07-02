import {type JSX, useLayoutEffect, useRef, useState} from "react";
import {randomWeightDataObservable} from "./randomWeightData";
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
import type {Datum, TimeSeries} from "../charts/series/timeSeries";
import type {TimeSeriesChartData} from "../charts/series/timeSeriesChartData";
import {regexFilter} from "../charts/filters/regexFilter";
import {Chart} from "../charts/Chart";
import {AxisLocation, defaultLineStyle} from '../charts/axes/axes';
import {ContinuousAxis} from "../charts/axes/ContinuousAxis";
import {Tracker} from "../charts/trackers/Tracker";
import {Tooltip} from "../charts/tooltips/Tooltip";
import {ScatterPlotTooltipContent} from "../charts/tooltips/ScatterPlotTooltipContent";
import {formatNumber} from '../charts/utils';
import {ScatterPlot} from "../charts/plots/ScatterPlot";
import {Legend} from "../charts/legends/Legend";
import {assignAxes} from "../charts/plots/plot";
import * as d3 from "d3";
import {lightTheme, type Theme} from "../ui/Themes";
import {seriesFrom} from "../charts/series/baseSeries";
import {AxisInterval} from "stream-charts";
import {TrackerLabelLocation} from "../charts/trackers/trackerUtils.ts";
import {LegendLocation} from "../charts/legends/constants";
import {defaultMargin} from "../charts/hooks/defaultPlotDimensions";
import {type ControlBarType, ExpandableControlBar} from "../ui/ExpandableControlBar.tsx";
import {CommonControls} from "./controls/CommonControls.tsx";
import {buttonStyle} from "../ui/utils.ts";
import {CommonExecutionControls} from "./controls/CommonExecutionControls.tsx";
import {INTERPOLATIONS} from "./interpolations.ts";
import {ViewControlsHeader} from "./controls/ViewControlHeader.tsx";
import {createInitialVisibility, type Visibility} from "./visibility.ts";
import {EXTERNAL_LEGEND_WIDTH, LEGEND_ANIMATION_DURATION_MS, LegendControl} from "./controls/LegendControl.tsx";
import {InterpolationControl} from "./controls/InterpolationControl.tsx";
import {DEFAULT_DROP_AFTER} from "./dropDataAfter.ts";
import {FilterIcon, LagIcon, TooltipIcon, TrackerIcon} from "../ui/Icons.tsx";

const initialVisibility = createInitialVisibility()

const randomData = (delta: number, updatePeriod: number, min: number, max: number): (initialData: Array<TimeSeries>) => Observable<TimeSeriesChartData> => {
    return initialData => randomWeightDataObservable(initialData, delta, updatePeriod, min, max)
}

// calculates a unique chart ID when the module is loaded
const CHART_ID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)

/**
 * The properties
 */
interface Props {
    theme?: Theme
    timeWindow?: number
    initialData?: Array<TimeSeries>
    plotHeight?: number
    plotWidth?: number
}

export function StreamingScatterChart(props: Props): JSX.Element {
    const {
        theme = lightTheme,
        initialData: originalInitialData = [],
    } = props

    const randomDataObservable = randomData(25, 50, 10, 1000)
    const [initialData, setInitialData] = useState<Array<TimeSeries>>(originalInitialData.map(series => seriesFrom(series.name, series.data.slice())))
    const [observable, setObservable] = useState<Observable<TimeSeriesChartData>>(randomDataObservable(initialData))
    const [running, setRunning] = useState<boolean>(false)

    const [filterValue, setFilterValue] = useState<string>('');
    const [filter, setFilter] = useState<RegExp>(new RegExp(''));

    const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
    const [selectedInterpolationName, setSelectedInterpolationName] = useState<string>('curveLinear')
    const [interpolation, setInterpolation] = useState<d3.CurveFactory>(() => d3.curveLinear)

    const [legendLocation, setLegendLocation] = useState<LegendLocation>(LegendLocation.EXTERNAL_CONTAINER)

    // elapsed time
    const startTimeRef = useRef<number>(new Date().valueOf())
    const intervalRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const [elapsed, setElapsed] = useState<number>(0)

    // chart time
    const [chartTime, setChartTime] = useState<number>(0)

    // drop data after
    const [dropAfterMs, setDropAfterMs] = useState<number>(DEFAULT_DROP_AFTER[1])

    // legend
    const legendContainerRef = useRef<HTMLDivElement>(null)
    const [externalLegendWidth, setExternalLegendWidth] = useState<number>(0)
    const externalLegendWidthRef = useRef<number>(0)

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
        return data.map(series => seriesFrom<Datum>(series.name, series.data.slice()))
    }

    /**
     * Called when the user changes the regular expression filter
     * @param updatedFilter The updated the filter
     */
    function handleUpdateRegex(updatedFilter: string): void {
        setFilterValue(updatedFilter);
        regexFilter(updatedFilter).onSuccess((regex: RegExp) => setFilter(regex));
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
    function handleChartTimeUpdate(times: Map<string, AxisInterval>): void {
        setChartTime(Math.max(...Array.from(times.values()).map(range => range.end)))
    }

    function handleRunPauseClick(): void {
        if (!running) {
            setObservable(randomDataObservable(initialData))
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
                .addTrack(withPixels(70))
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
                        width={300}
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
                        <CommonControls
                            theme={theme}
                            type="controls"
                            filterValue={filterValue}
                            handleFilterUpdate={handleUpdateRegex}
                            running={running}
                            isTooltipSelected={visibility.tooltip}
                            onTooltipClick={() => setVisibility({...visibility, tooltip: !visibility.tooltip})}
                            isTrackerSelected={visibility.tracker}
                            onTrackerClick={() => setVisibility({...visibility, tracker: !visibility.tracker})}
                            handleDropAfterChange={setDropAfterMs}
                            lag={elapsed - chartTime}
                        />
                    </ExpandableControlBar>
                    <ExpandableControlBar
                        expandButtonStyle={buttonStyle(theme)}
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.disabledBackgroundColor}
                        borderRadius={10}
                        width={300}
                        minHeight={55}
                    >
                        <ViewControlsHeader type="header" theme={theme}/>
                        <ViewControls
                            type="controls"
                            theme={theme}
                            running={running}
                            visibility={visibility}
                            setVisibility={setVisibility}
                            selectedInterpolationName={selectedInterpolationName}
                            handleInterpolationChange={handleInterpolationChange}
                            legendLocation={legendLocation}
                            setLegendLocation={setLegendLocation}
                        />
                    </ExpandableControlBar>
                </div>
            </GridItem>
            <GridItem gridAreaName="chart">
                <Chart
                    chartId={CHART_ID}
                    width={useGridCellWidth()}
                    height={useGridCellHeight()}
                    margin={{...defaultMargin, top: 40, bottom: 40, right: 60}}
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
                        domain={[10, 10000]}
                        label="Time (ms)"
                    />
                    <ContinuousAxis
                        axisId="y-axis-1"
                        location={AxisLocation.Left}
                        domain={[0, 1000]}
                        label="Distance (µm)"
                    />
                    <ContinuousAxis
                        axisId="x-axis-2"
                        location={AxisLocation.Top}
                        domain={[100, 5000]}
                        label="Expanded Time (ms)"
                    />
                    <ContinuousAxis
                        axisId="y-axis-2"
                        location={AxisLocation.Right}
                        scale={d3.scaleLog()}
                        domain={[100, 1200]}
                        label="Distance (µm)"
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
                            borderOpacity: 0.5
                        }}
                    >
                        <ScatterPlotTooltipContent
                            xLabel="t (ms)"
                            yLabel="count"
                            yValueFormatter={value => formatNumber(value, " ,.0f")}
                            yChangeFormatter={(y1, y2) => formatNumber(y2 - y1, " ,.0f")}
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
                            padding: 0,
                        }}
                    />
                    <ScatterPlot
                        interpolation={interpolation}
                        axisAssignments={new Map([
                            ['Series 2', assignAxes("x-axis-2", "y-axis-2")],
                            ['Series 3', assignAxes("x-axis-2", "y-axis-1")],
                        ])}
                        dropDataAfter={dropAfterMs}
                        // dropDataAfter={3000000}
                        panEnabled={true}
                        zoomEnabled={true}
                        zoomKeyModifiersRequired={true}
                        markerRadius={visibility.markers ? 2 : undefined}
                        // withCadenceOf={30}
                        // timeWindowBehavior={TimeWindowBehavior.SQUEEZE}
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

function colorFor(name: string, index: number, numSeries: number, themeName: string): string {
    if (name === 'Series 1') return 'orange'
    if (name === 'Series 2') return themeName === 'light' ? 'blue' : 'gray'
    if (name === 'Series 3') return themeName === 'light' ? 'dodgerblue' : 'gray'

    const ratio = index / numSeries / 2
    return themeName === 'light' ?
        d3.interpolateRdBu(ratio > 0.25 ? ratio + 0.5 : ratio) :
        d3.interpolateRdBu(ratio + 0.25)
}

function linewidthFor(name: string): number {
    if (name === 'Series 1') return 1
    if (name === 'Series 2' || name === 'Series 3') return 3

    return 1
}

function highlightLinewidthFor(name: string): number {
    if (name === 'Series 1') return 3
    if (name === 'Series 2' || name === 'Series 3') return 5

    return 3
}

type ControlProps = {
    type: ControlBarType
    theme: Theme
    running: boolean
    visibility: Visibility
    setVisibility: (visibility: Visibility) => void

    selectedInterpolationName: string
    handleInterpolationChange: (selected: string) => void

    legendLocation: LegendLocation
    setLegendLocation: (location: LegendLocation) => void
}

function ViewControls(props: ControlProps): JSX.Element {
    const {
        theme,
        running,
        visibility,
        setVisibility,
        selectedInterpolationName,
        handleInterpolationChange,
        legendLocation,
        setLegendLocation
    } = props

    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            flexDirection: 'column',
            gap: 10,
            paddingTop: 10
        }}>
            <Checkbox
                key={5}
                checked={visibility.markers}
                disabled={running}
                label="markers"
                backgroundColor={theme.backgroundColor}
                borderColor={theme.color}
                labelColor={theme.color}
                onChange={() => setVisibility({...visibility, markers: !visibility.markers})}
            />
            <InterpolationControl
                theme={theme}
                selectedInterpolationName={selectedInterpolationName}
                handleInterpolationChange={handleInterpolationChange}
            />
            <Checkbox
                key={3}
                checked={visibility.legend}
                label="legend"
                backgroundColor={theme.backgroundColor}
                borderColor={theme.color}
                labelColor={theme.color}
                onChange={() => setVisibility({...visibility, legend: !visibility.legend})}
            />
            <LegendControl
                theme={theme}
                visibility={visibility}
                legendLocation={legendLocation}
                setLegendLocation={setLegendLocation}
            />
        </div>
    )
}
