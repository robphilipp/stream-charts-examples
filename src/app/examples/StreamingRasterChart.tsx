import * as React from 'react';
import {useRef, useState} from 'react';
import {Observable} from "rxjs";
import Checkbox from "./Checkbox";
import {randomSpikeDataObservable} from "./randomData";
import {Datum, Series, seriesFrom} from "../charts/datumSeries";
import {ChartData} from "../charts/chartData";
import {regexFilter} from "../charts/regexFilter";
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
import {Chart} from "../charts/Chart";
import {defaultMargin} from "../charts/hooks/useChart";
import {AxisLocation, defaultLineStyle} from "../charts/axes";
import {ContinuousAxis} from "../charts/ContinuousAxis";
import {Tracker, TrackerLabelLocation} from "../charts/Tracker";
import {Tooltip} from "../charts/Tooltip";
import {formatNumber} from "../charts/utils";
import {lightTheme, Theme} from "./Themes";
import {CategoryAxis} from "../charts/CategoryAxis";
import {RasterPlot} from "../charts/RasterPlot";
import {assignAxes} from "../charts/plot";
import {RasterPlotTooltipContent} from "../charts/RasterPlotTooltipContent";

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

/**
 * The properties
 */
interface Props {
    theme?: Theme
    timeWindow?: number;
    initialData: Array<Series>;
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

    const initialDataRef = useRef<Array<Series>>(initialDataFrom(initialData))
    const observableRef = useRef<Observable<ChartData>>(randomSpikeDataObservable(initialDataRef.current.slice(), 25));
    const [running, setRunning] = useState<boolean>(false)

    const [filterValue, setFilterValue] = useState<string>('');
    const [filter, setFilter] = useState<RegExp>(new RegExp(''));

    const [visibility, setVisibility] = useState<Visibility>(initialVisibility);

    function initialDataFrom(data: Array<Series>): Array<Series> {
        return data.map(series => seriesFrom(series.name, series.data.slice()))
    }

    /**
     * Called when the user changes the regular expression filter
     * @param updatedFilter The updated the filter
     */
    function handleUpdateRegex(updatedFilter: string): void {
        setFilterValue(updatedFilter);
        regexFilter(updatedFilter).ifSome(regex => setFilter(regex));
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
                        style={inputStyle}
                    /></label>
                    <button
                        onClick={() => {
                            if (!running) {
                                initialDataRef.current = initialDataFrom(initialData)
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
                    windowingTime={35}
                >
                    <ContinuousAxis
                        axisId="x-axis-1"
                        location={AxisLocation.Bottom}
                        domain={[10, 5000]}
                        label="x-axis"
                        // font={{color: theme.color}}
                    />
                    <ContinuousAxis
                        axisId="x-axis-2"
                        location={AxisLocation.Top}
                        domain={[0, 2500]}
                        label="x-axis"
                        // font={{color: theme.color}}
                    />
                    <CategoryAxis
                        axisId="y-axis-1"
                        location={AxisLocation.Left}
                        categories={initialDataRef.current.map(series => series.name)}
                        label="y-axis"
                    />
                    <CategoryAxis
                        axisId="y-axis-2"
                        location={AxisLocation.Right}
                        categories={initialDataRef.current.map(series => series.name)}
                        label="y-axis"
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
                        <RasterPlotTooltipContent
                            xFormatter={value => formatNumber(value, " ,.0f") + ' ms'}
                            yFormatter={value => formatNumber(value, " ,.1f") + ' mV'}
                        />
                    </Tooltip>
                    <RasterPlot
                        axisAssignments={new Map([
                            // ['test', assignAxes("x-axis-1", "y-axis-1")],
                            ['test2', assignAxes("x-axis-2", "y-axis-2")],
                            // ['test3', assignAxes("x-axis-1", "y-axis-1")],
                        ])}
                        dropDataAfter={10000}
                        panEnabled={true}
                        zoomEnabled={true}
                        zoomKeyModifiersRequired={true}
                        withCadenceOf={30}
                    />
                </Chart>
            </GridItem>
        </Grid>
    );
}
