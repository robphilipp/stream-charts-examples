import {type JSX, useRef, useState} from "react"
import {Observable} from "rxjs"
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
} from "react-resizable-grid-layout"
import * as d3 from "d3"

import {initialOutlierData, periodicWithSeveralBandsFn, randomOutlierDataObservable} from "./dataproviders/randomOutlierData.ts"
import {Chart} from "../charts/Chart"
import {ContinuousAxis} from "../charts/axes/ContinuousAxis"
import {AxisLocation, defaultLineStyle} from "../charts/axes/axes"
import {OutlierPlot} from "../charts/plots/OutlierPlot"
import {Tooltip} from "../charts/tooltips/Tooltip"
import {OutlierPlotTooltipContent} from "../charts/tooltips/OutlierPlotTooltipContent"
import type {OutlierChartData} from "../charts/observables/outliers"
import {type OutlierSeries, outlierSeriesFrom} from "../charts/series/outlierSeries"
import {lightTheme, type Theme} from "../ui/Themes.ts"
import Checkbox from "../ui/Checkbox"
import {buttonStyle} from "../ui/utils"
import {defaultMargin} from "../charts/hooks/defaultPlotDimensions"
import {AxisInterval} from "../charts/axes/AxisInterval"
import {regexFilter} from "../charts/filters/regexFilter"
import {OutlierPlotHtmlTooltipContent} from "../charts/tooltips/OutlierPlotHtmlTooltipContent.tsx";
import {Toggle, ToggleStatus} from "../ui/Toggle.tsx";
import {INTERPOLATIONS} from "./options/interpolations.ts";
import {InterpolationControl} from "./controls/InterpolationControl.tsx";
import {ExpandableControlBar} from "../ui/ExpandableControlBar.tsx";
import {CommonExecutionControls} from "./controls/CommonExecutionControls.tsx";
import {FilterIcon, InterpolationIcon, LagIcon, MarkersIcon, TooltipIcon} from "../ui/Icons.tsx";
import {CommonControls} from "./controls/CommonControls.tsx";
import {DropDataControl} from "./controls/DropDataControl.tsx";
import {LagDisplay} from "./controls/LagDisplay.tsx";
import {Divider} from "../ui/Divider.tsx";
import {SeriesFilter} from "./controls/SeriesFilter.tsx";
import {DEFAULT_DROP_AFTER_20, DROP_AFTER_20_SEC, dropDataOptionForMs} from "./options/dropDataAfter.ts";
import {VerticalDivider} from "../ui/VerticalDivider.tsx";

// 1 sigma (~68%), 2 sigma (~95%), 3 sigma (~99.7%)
const MEASURES = [0.68, 0.95, 0.997] as const
type Measures = typeof MEASURES
const MEASURE_DESCRIPTIONS = [
    "Points in this band are not outliers.",
    "Points in this band are unlikely to be outliers.",
    "Points in this band are possibly outliers. Points outside of this band are likely outliers.",
] as readonly [string, string, string]

const SERIES_NAME = "Spot Price Index"
const CHART_ID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
const UPDATE_PERIOD = 25
const NOISE_SIGMA = 0.5
const PERIODS: Array<[period: number, offset: number]> = [[4000, -1], [970, 1.3], [310, 2.1]]
const PERIOD_MAGNITUDE = 30
const INITIAL_POINT_COUNT = 400  // 100 * 25ms = 2500ms, fills the default x-axis window

function baseDataFnFactory() {
    return periodicWithSeveralBandsFn<Measures>(PERIODS, PERIOD_MAGNITUDE)
}

function defaultInitialOutlierData(): Array<OutlierSeries<Measures>> {
    return initialOutlierData<Measures>(
        SERIES_NAME,
        baseDataFnFactory(),
        MEASURES,
        NOISE_SIGMA,
        UPDATE_PERIOD,
        INITIAL_POINT_COUNT,
        MEASURE_DESCRIPTIONS
    )
}

function lastTimeIn(seriesList: Array<OutlierSeries<Measures>>): number {
    return seriesList.reduce(
        (tMax, series) => Math.max(tMax, series.last().map(d => d.datum.x).getOrElse(0)),
        0
    )
}

/**
 * Builds a fresh array of {@link OutlierSeries} from the given template. The subscription
 * appends to `series.data` in place, so the chart needs its own copy of the data arrays —
 * otherwise the pristine seed gets mutated and "Clear" silently becomes a no-op.
 */
function freshCopyOf(template: Array<OutlierSeries<Measures>>): Array<OutlierSeries<Measures>> {
    return template.map(series => outlierSeriesFrom(series.name, series.data.slice(), series.measures, series.measureDescriptions))
}

interface Props {
    theme?: Theme
    timeWindow?: number
    initialData?: Array<OutlierSeries<Measures>>
    plotHeight?: number
    plotWidth?: number
}

export function StreamingOutlierChart(props: Props): JSX.Element {
    const {
        theme = lightTheme,
        initialData: originalInitialData,
    } = props

    // pristine template that never gets mutated; freshCopyOf() produces working copies for the chart
    const [seededInitialData] = useState<Array<OutlierSeries<Measures>>>(() =>
        originalInitialData && originalInitialData.length > 0
            ? originalInitialData
            : defaultInitialOutlierData()
    )

    const buildObservable = (initData: Array<OutlierSeries<Measures>>): Observable<OutlierChartData<Measures>> =>
        randomOutlierDataObservable<Measures>(
            SERIES_NAME,
            baseDataFnFactory(),
            MEASURES,
            NOISE_SIGMA,
            UPDATE_PERIOD,
            lastTimeIn(initData),
        )

    const [initialData, setInitialData] = useState<Array<OutlierSeries<Measures>>>(() => freshCopyOf(seededInitialData))
    const [observable, setObservable] = useState<Observable<OutlierChartData<Measures>>>(() => buildObservable(seededInitialData))
    const [running, setRunning] = useState<boolean>(false)

    const [filterValue, setFilterValue] = useState<string>('')
    const [filter, setFilter] = useState<RegExp>(new RegExp(''))
    const [dropAfterMs, setDropAfterMs] = useState<number>(DEFAULT_DROP_AFTER_20[1])

    const [selectedInterpolationName, setSelectedInterpolationName] = useState<string>('curveLinear')
    const [interpolation, setInterpolation] = useState<d3.CurveFactory>(() => d3.curveLinear)
    const [showMarkers, setShowMarkers] = useState<boolean>(true)
    const [showTooltip, setShowTooltip] = useState<boolean>(true)
    const [tooltipType, setTooltipType] = useState<'html' | 'svg'>('html')

    const startTimeRef = useRef<number>(new Date().valueOf())
    const intervalRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const [elapsed, setElapsed] = useState<number>(0)
    const [chartTime, setChartTime] = useState<number>(0)

    function handleToggleTooltipType(status: ToggleStatus): void {
        if (status === ToggleStatus.OFF) {
            setTooltipType('html')
        } else {
            setTooltipType('svg')
        }
    }

    function handleUpdateRegex(updatedFilter: string): void {
        setFilterValue(updatedFilter)
        regexFilter(updatedFilter).onSuccess((regex: RegExp) => setFilter(regex))
    }

    function handleInterpolationChange(name: string): void {
        const [, factory] = INTERPOLATIONS.get(name) || ['Linear', d3.curveLinear]
        setInterpolation(() => factory)
        setSelectedInterpolationName(name)
    }

    function handleChartTimeUpdate(times: Map<string, AxisInterval>): void {
        setChartTime(Math.max(...Array.from(times.values()).map(range => range.end)))
    }

    function handleRunPauseClick(): void {
        if (!running) {
            setObservable(buildObservable(initialData))
            startTimeRef.current = new Date().valueOf()
            setElapsed(0)
            intervalRef.current = setInterval(
                () => setElapsed(new Date().valueOf() - startTimeRef.current),
                1000
            )
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current)
            intervalRef.current = undefined
        }
        setRunning(!running)
    }

    function handleClearClick(): void {
        setInitialData(freshCopyOf(seededInitialData))
        setElapsed(0)
        setChartTime(0)
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
                            <TooltipIcon color={showTooltip ? theme.color : theme.disabledBackgroundColor}/>
                            {/*<TrackerIcon color={visibility.tracker ? theme.color : theme.disabledBackgroundColor}/>*/}
                            <MarkersIcon color={showMarkers ? theme.color : theme.disabledBackgroundColor}/>
                            <InterpolationIcon
                                color={selectedInterpolationName === "curveLinear" ? theme.disabledBackgroundColor : theme.color}/>
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
                            <div style={{display: 'flex', flexDirection: 'row', gap: '5'}}>
                                <Checkbox
                                    key={1}
                                    checked={showTooltip && !running}
                                    disabled={running}
                                    label="tooltip"
                                    backgroundColor={theme.backgroundColor}
                                    borderColor={theme.color}
                                    labelColor={theme.color}
                                    onChange={() => setShowTooltip(!showTooltip)}
                                />
                                <span style={{paddingLeft: 10}}/>
                                <VerticalDivider color={theme.disabledColor} height={20}/>
                                <span style={{paddingLeft: 10}}/>
                                <Toggle
                                    leftLabel="html"
                                    rightLabel="svg"
                                    onToggle={handleToggleTooltipType}
                                    toggleOffColor={theme.color}
                                    toggleOffBackgroundColor={theme.backgroundColor}
                                    toggleOnColor={theme.color}
                                    toggleOnBackgroundColor={theme.backgroundColor}
                                    toggleBorderColor={theme.color}
                                    labelFontColor={theme.color}
                                    toggleHeight={15}
                                    disabled={!showTooltip || running}
                                    disabledColor={theme.disabledColor}
                                    disabledBackgroundColor={theme.disabledBackgroundColor}
                                    disabledBorderColor={theme.disabledColor}
                                />
                            </div>
                            {/*<Checkbox*/}
                            {/*    key={2}*/}
                            {/*    checked={visibility.tracker && !running}*/}
                            {/*    disabled={running}*/}
                            {/*    label="tracker"*/}
                            {/*    backgroundColor={theme.backgroundColor}*/}
                            {/*    borderColor={theme.color}*/}
                            {/*    labelColor={theme.color}*/}
                            {/*    onChange={() => setVisibility({...visibility, tracker: !visibility.tracker})}*/}
                            {/*/>*/}
                            <Checkbox
                                key={5}
                                checked={showMarkers}
                                disabled={running}
                                label="markers"
                                backgroundColor={theme.backgroundColor}
                                borderColor={theme.color}
                                labelColor={theme.color}
                                onChange={() => setShowMarkers(!showMarkers)}
                            />
                            <Divider theme={theme}/>
                            <InterpolationControl
                                theme={theme}
                                selectedInterpolationName={selectedInterpolationName}
                                handleInterpolationChange={handleInterpolationChange}
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
                    color={theme.color}
                    backgroundColor={theme.backgroundColor}
                    seriesStyles={new Map([
                        [SERIES_NAME, {
                            ...defaultLineStyle(),
                            color: theme.name === 'light' ? '#1f77b4' : '#5bc0eb',
                            lineWidth: 1.5,
                            highlightColor: theme.name === 'light' ? '#1f77b4' : '#5bc0eb',
                            highlightWidth: 3,
                        }]
                    ])}
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
                        domain={[0, 40000]}
                        label="Time (ms)"
                    />
                    <ContinuousAxis
                        axisId="y-axis-1"
                        location={AxisLocation.Left}
                        domain={[0, 250]}
                        label="Spot Price Index (USD)"
                    />
                    <OutlierPlot<Measures>
                        interpolation={interpolation}
                        dropDataAfter={dropAfterMs}
                        panEnabled={true}
                        zoomEnabled={true}
                        zoomKeyModifiersRequired={true}
                        bandOpacity={0.12}
                        bandOpacityStep={0.14}
                        markerRadius={showMarkers ? 2 : 0}
                        outlierMarkerColors={['#f4c542', '#f08a3b', '#d62728']}
                    />
                    <Tooltip
                        visible={showTooltip}
                        style={{
                            fontColor: theme.color,
                            backgroundColor: theme.backgroundColor,
                            borderColor: theme.color,
                            backgroundOpacity: 0.9,
                            borderOpacity: 0.5,
                        }}
                    >
                        {tooltipType === 'svg' ?
                            <OutlierPlotTooltipContent
                                datumFormatter={(x, y) => `(${x.toFixed(0)} ms, ${y.toFixed(2)} USD)`}
                                bandFormatter={(lower, upper) => `Band: [${lower}, ${upper})`}
                                measureFormatter={svgMeasureDescription}
                            /> :
                            <OutlierPlotHtmlTooltipContent
                                datumFormatter={(x, y) =>
                                    <div>Index: <b>{y.toFixed(2)} USD</b> (<em>@ {x.toFixed(0)} ms</em>)</div>}
                                bandFormatter={(lower, upper) => <div>Band: [{lower}, {upper})</div>}
                                measureFormatter={htmlMeasureDescription}
                            >
                                {/* You can uncomment the MyOutlierHtmlTooltipContent below to use a custom tooltip */}
                                {/*<MyOutlierHtmlTooltipContent/>*/}
                            </OutlierPlotHtmlTooltipContent>
                        }
                    </Tooltip>
                </Chart>
            </GridItem>
        </Grid>
    )
}

/**
 * Creates the JSX element that describes the probability of points being in or outside the outlier band.
 * @param innerProb The probability of points being within the outlier band.
 * @param outerProb The probability of points being outside the outlier band.
 */
function svgMeasureDescription(innerProb: number, outerProb: number): Array<string> {
    if (Math.abs(outerProb) < 1e-4) {
        return [`Points have a ${(innerProb * 100).toFixed(1)}% probability of being in this band.`]
    }
    return [
        `Points have a ${(innerProb * 100).toFixed(1)}% probability of being in this band,`,
        `and a ${(outerProb * 100).toFixed(1)}% probability of being outside this band.`
    ]
}

/**
 * Creates the JSX element that describes the probability of points being in or outside the outlier band.
 * @param innerProb The probability of points being within the outlier band.
 * @param outerProb The probability of points being outside the outlier band.
 */
function htmlMeasureDescription(innerProb: number, outerProb: number): JSX.Element {
    if (Math.abs(outerProb) < 1e-4) {
        return <div>
            <hr/>
            Points have a {(innerProb * 100).toFixed(1)}% probability of being in this band.
            <hr/>
        </div>
    }
    return <div>
        <hr/>
        <div>Points have a {(innerProb * 100).toFixed(1)}% probability of being in this band,</div>
        <div>and a {(outerProb * 100).toFixed(1)}% probability of being outside this band.</div>
        <hr/>
    </div>
}
