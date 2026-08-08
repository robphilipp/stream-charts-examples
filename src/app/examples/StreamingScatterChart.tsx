import {type JSX, useLayoutEffect, useRef, useState} from "react";
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
import {lightTheme, type Theme} from "../ui/Themes.ts";
import {seriesFrom} from "../charts/series/baseSeries";
import {AxisInterval} from "stream-charts";
import {TrackerLabelLocation} from "../charts/trackers/trackerUtils.ts";
import {LegendLocation} from "../charts/legends/constants";
import {defaultMargin} from "../charts/hooks/defaultPlotDimensions";
import {ExpandableControlBar} from "../ui/ExpandableControlBar.tsx";
import {CommonControls} from "./controls/CommonControls.tsx";
import {buttonStyle} from "../ui/utils.ts";
import {CommonExecutionControls} from "./controls/CommonExecutionControls.tsx";
import {INTERPOLATIONS} from "./options/interpolations.ts";
import {EXTERNAL_LEGEND_WIDTH, LEGEND_ANIMATION_DURATION_MS, LegendControl} from "./controls/LegendControl.tsx";
import {InterpolationControl} from "./controls/InterpolationControl.tsx";
import {FilterIcon, InterpolationIcon, LagIcon, MarkersIcon, TooltipIcon, TrackerIcon} from "../ui/Icons.tsx";
import {SeriesFilter} from "./controls/SeriesFilter.tsx";
import {DropDataControl} from "./controls/DropDataControl.tsx";
import {LagDisplay} from "./controls/LagDisplay.tsx";
import {Divider} from "../ui/Divider.tsx";
import {useScatterChartStore} from "./appstate/scatterChartStore.ts";
import {Optional} from "result-fn";
import {DROP_AFTER_20_SEC, dropDataOptionForMs} from "./options/dropDataAfter.ts";
import {useShallow} from "zustand/react/shallow";

// calculates a unique chart ID when the module is loaded
const CHART_ID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)

const X1_AXIS_ID = 'x-axis-1'
const X2_AXIS_ID = 'x-axis-2'

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

    const {
        // initial data and observable
        initialData,
        setInitialData,
        observable,
        // subscription for page remounts
        subscription,
        setSubscription,
        // subscription active and data is streaming
        running,
        setRunning,
        // range for the x1 and x2 axes
        x1axisRange,
        setX1axisRange,
        x2axisRange,
        setX2axisRange,
        // filters for series displayed in chart
        filterValue,
        setFilterValue,
        // visibility of tooltip, tracker, margin, legend
        visibility,
        setVisibility,
        // interpolation
        selectedInterpolationName,
        setSelectedInterpolationName,
        // drop data
        dropAfterMs,
        setDropAfterMs,
        // reset the state
        reset,
    } = useScatterChartStore(useShallow(state => ({...state})))

    const [filter, setFilter] = useState<RegExp>(new RegExp(filterValue));

    const [interpolation, setInterpolation] = useState<d3.CurveFactory>(
        () => interpolationFactoryFor(selectedInterpolationName).getOrElse(d3.curveLinear)
    )

    // elapsed time
    const startTimeRef = useRef<number>(new Date().valueOf())
    const intervalRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const [elapsed, setElapsed] = useState<number>(0)

    // legend
    const [legendLocation, setLegendLocation] = useState<LegendLocation>(LegendLocation.EXTERNAL_CONTAINER)
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

    /**
     * Processes an array of time series data and returns a new array with modified series.
     * @param data - The input array of time series objects to process.
     * @return A new array of time series objects with modifications applied.
     */
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

    function interpolationFactoryFor(interpolationName: string): Optional<d3.CurveFactory> {
        const interpolation = INTERPOLATIONS.get(interpolationName)
        if (interpolation) {
            const [, factory] = interpolation
            return Optional.of(factory)
        }
        return Optional.empty()
    }
    /**
     * Called when the interpolation is change for the chart. Converts the selected
     * interpolation name into the d3 curve-factory.
     * @param selectedInterpolation The name of the selected interpolation
     */
    function handleInterpolationChange(selectedInterpolation: string): void {
        const factory = interpolationFactoryFor(selectedInterpolation).getOrElse(d3.curveLinear)
        setInterpolation(() => factory)
        setSelectedInterpolationName(selectedInterpolation)
    }

    /**
     * Updates the time from the chart (the max value of the axes ranges)
     * @param times A map associating the axis with its time range
     */
    function handleChartTimeUpdate(times: Map<string, AxisInterval>): void {
        const x1AxisInterval = times.get(X1_AXIS_ID)
        if (x1AxisInterval) {
            setX1axisRange(x1AxisInterval.asTuple())
        }
        const x2AxisInterval = times.get(X2_AXIS_ID)
        if (x2AxisInterval) {
            setX2axisRange(x2AxisInterval.asTuple())
        }
    }

    if (initialData == null || initialData.length === 0) {
        setInitialData(initialDataFrom(originalInitialData))
    }

    function handleRunPauseClick(): void {
        if (!running) {
            setInitialData(initialData)
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
        setFilter(new RegExp(''))
        setInterpolation(() => d3.curveLinear)
        reset()
    }

    // the chart time is the end of the x2 axis range
    const chartTime = x1axisRange[1]
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
                        autoExpandOnMouseEnter={false}
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
                            <MarkersIcon color={visibility.markers ? theme.color : theme.disabledBackgroundColor}/>
                            <InterpolationIcon color={selectedInterpolationName === "curveLinear" ? theme.disabledBackgroundColor : theme.color}/>
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
                    margin={{...defaultMargin, top: 40, bottom: 40, right: 60}}
                    // svgStyle={{'background-color': 'pink'}}
                    color={theme.color}
                    backgroundColor={theme.backgroundColor}
                    seriesStyles={new Map(originalInitialData.map(
                        (data, index) => [data.name, {
                            ...defaultLineStyle(),
                            lineWidth: linewidthFor(data.name),
                            color: colorFor(index, initialData.length, theme.name),
                            highlightWidth: highlightLinewidthFor(data.name),
                            highlightColor: colorFor(index, initialData.length, theme.name)
                        }])
                    )}
                    initialData={initialData}
                    seriesFilter={filter}
                    seriesObservable={observable}
                    shouldSubscribe={running}
                    onSubscribe={setSubscription}
                    onUpdateAxesBounds={handleChartTimeUpdate}
                    windowingTime={25}
                >
                    <ContinuousAxis
                        axisId="x-axis-1"
                        location={AxisLocation.Bottom}
                        domain={[x1axisRange[0], x1axisRange[1]]}
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
                        domain={[x2axisRange[0], x2axisRange[1]]}
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
                        panEnabled={true}
                        zoomEnabled={true}
                        zoomKeyModifiersRequired={true}
                        markerRadius={visibility.markers ? 2 : undefined}
                        // withCadenceOf={30}
                        // timeWindowBehavior={TimeWindowBehavior.SQUEEZE}
                        subscription={subscription}
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
    if (name === 'Series 1') return 1
    if (name === 'Series 2' || name === 'Series 3') return 3

    return 1
}

function highlightLinewidthFor(name: string): number {
    if (name === 'Series 1') return 3
    if (name === 'Series 2' || name === 'Series 3') return 5

    return 3
}
