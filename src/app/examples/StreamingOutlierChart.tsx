import {type CSSProperties, type JSX, useRef, useState} from "react"
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

import {initialOutlierData, periodicWithSeveralBandsFn, randomOutlierDataObservable} from "./randomOutlierData"
import {Chart} from "../charts/Chart"
import {ContinuousAxis} from "../charts/axes/ContinuousAxis"
import {AxisLocation, defaultLineStyle} from "../charts/axes/axes"
import {OutlierPlot} from "../charts/plots/OutlierPlot"
import {Tooltip} from "../charts/tooltips/Tooltip"
import {OutlierPlotTooltipContent} from "../charts/tooltips/OutlierPlotTooltipContent"
import type {OutlierChartData} from "../charts/observables/outliers"
import {type OutlierSeries, outlierSeriesFrom} from "../charts/series/outlierSeries"
import {lightTheme, type Theme} from "../ui/Themes"
import {Button} from "../ui/Button"
import Checkbox from "../ui/Checkbox"
import {buttonStyle} from "../ui/utils"
import {defaultMargin} from "../charts/hooks/defaultPlotDimensions"
import {formatTime} from "../charts/utils"
import {AxisInterval} from "../charts/axes/AxisInterval"
import {regexFilter} from "../charts/filters/regexFilter"
import {OutlierPlotHtmlTooltipContent} from "../charts/tooltips/OutlierPlotHtmlTooltipContent.tsx";
import {Toggle, ToggleStatus} from "../ui/Toggle.tsx";
import {INTERPOLATIONS} from "./interpolations.ts";
import {InterpolationControl} from "./controls/InterpolationControl.tsx";

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
                        style={inputStyle}
                    /></label>
                    <Button
                        style={buttonStyle(theme)}
                        onClick={() => {
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
                        }}
                    >
                        {running ? "Pause" : "Run"}
                    </Button>
                    <Button
                        style={buttonStyle(theme)}
                        onClick={() => {
                            setInitialData(freshCopyOf(seededInitialData))
                            setElapsed(0)
                            setChartTime(0)
                        }}
                        disabled={running}
                    >
                        Clear
                    </Button>
                    <InterpolationControl
                        theme={theme}
                        selectedInterpolationName={selectedInterpolationName}
                        handleInterpolationChange={handleInterpolationChange}
                    />
                    <Checkbox
                        checked={showMarkers}
                        label="markers"
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.color}
                        labelColor={theme.color}
                        onChange={() => setShowMarkers(!showMarkers)}
                    />
                    <Checkbox
                        checked={showTooltip}
                        label="tooltip"
                        backgroundColor={theme.backgroundColor}
                        borderColor={theme.color}
                        labelColor={theme.color}
                        onChange={() => setShowTooltip(!showTooltip)}
                    />
                    {showTooltip &&
                        <Toggle
                            leftLabel="HTML"
                            rightLabel="SVG"
                            onToggle={handleToggleTooltipType}
                            toggleOffColor={theme.color}
                            toggleOffBackgroundColor={theme.backgroundColor}
                            toggleOnColor={theme.color}
                            toggleOnBackgroundColor={theme.backgroundColor}
                            toggleBorderColor={theme.color}
                            labelFontColor={theme.color}
                        />}
                    <span style={{color: theme.color, marginLeft: 25}}>
                        lag: {formatTime(Math.max(0, elapsed - chartTime))} ms
                    </span>
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
                        dropDataAfter={2000000}
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
                                datumFormatter={(x, y) => <div>Index: <b>{y.toFixed(2)} USD</b> (<em>@ {x.toFixed(0)} ms</em>)</div>}
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
