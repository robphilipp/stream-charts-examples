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
import {ScatterPlotTooltipContent} from "../charts/ScatterPlotTooltipContent";
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
 * An example wrapper to the {@link RasterChart} that accepts an rxjs observable. The {@link RasterChart} manages
 * the subscription to the observable, but we can control when the {@link RasterChart} subscribes through the
 * `shouldSubscribe` property. Once subscribed, the observable emits a sequence or random chart data. The
 * {@link RasterChart} updates itself with the new data without causing React to re-render the component. In this
 * example, we delay the subscription to the observable by 1 second.
 * after the {@link RasterChart} has mounted.
 * @param {Props} props The properties passed down from the parent
 * @return {Element} The streaming raster chart
 * @constructor
 */
export function StreamingRasterChart(props: Props): JSX.Element {
    const {
        theme = lightTheme,
        // initialData,
        timeWindow = 100,
        seriesHeight = 20,
        // plotWidth = 500
    } = props;

    const initialDataRef = useRef<Array<Series>>(props.initialData.map(series => seriesFrom(series.name, series.data.slice())))
    // const observableRef = useRef<Observable<ChartData>>(randomSpikeDataObservable(initialData.map(series => series.name)));
    const observableRef = useRef<Observable<ChartData>>(randomSpikeDataObservable(initialDataRef.current.slice()));
    // const observableRef = useRef<Observable<ChartData>>(randomSpikeDataObservable(initialDataRef.current.map(series => series.name)));
    const [running, setRunning] = useState<boolean>(false)
    // const subscriptionRef = useRef<Subscription>();

    const [filterValue, setFilterValue] = useState<string>('');
    const [filter, setFilter] = useState<RegExp>(new RegExp(''));

    const [visibility, setVisibility] = useState<Visibility>(initialVisibility);

    // const [shouldSubscribe, setShouldSubscribe] = useState<boolean>(false);

    /**
     * Called when the user changes the regular expression filter
     * @param {string} updatedFilter The updated the filter
     */
    function handleUpdateRegex(updatedFilter: string): void {
        setFilterValue(updatedFilter);
        regexFilter(updatedFilter).ifSome((regex: RegExp) => setFilter(regex));
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

    // // demonstrates the use of the 'shouldSubscribe' property
    // useEffect(
    //     () => {
    //         setTimeout(() => setShouldSubscribe(true), 100);
    //     },
    //     []
    // );

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
                    <label>regex filter <input
                        type="text"
                        value={filterValue}
                        onChange={event => handleUpdateRegex(event.currentTarget.value)}
                        style={inputStyle}
                    /></label>
                    <button
                        onClick={() => setRunning(!running)}
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
                    windowingTime={10}
                >
                    <ContinuousAxis
                        axisId="x-axis-1"
                        location={AxisLocation.Bottom}
                        domain={[10, 5000]}
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
                        // axisAssignments={new Map([
                        //     ['test', assignAxes("x-axis-1", "y-axis-1")],
                        //     ['test2', assignAxes("x-axis-1", "y-axis-1")],
                        //     ['test3', assignAxes("x-axis-1", "y-axis-1")],
                        // ])}
                        // dropDataAfter={10000}
                        panEnabled={true}
                        zoomEnabled={true}
                        zoomKeyModifiersRequired={true}
                    />
                </Chart>
                {/*<RasterChart*/}
                {/*    // when the `width` property is specified, then the width of the chart will be that number*/}
                {/*    // in pixels. alternatively, if the `svgStyle` property has a `width` property with a relative*/}
                {/*    // width (i.e. percentage), then the chart will resize its width as the window resizes.*/}
                {/*    // width={plotWidth}*/}
                {/*    width={useGridCellWidth()}*/}

                {/*    // the `height` property specifies the height of the plot in pixels*/}
                {/*    // height={seriesList.length * seriesHeight}*/}
                {/*    height={useGridCellHeight()}*/}
                {/*    // the `seriesList` is used to determine the list of series ids and initial data*/}
                {/*    seriesList={seriesList}*/}
                {/*    // the `seriesObservable` is the rxjs observable that streams `ChartData` to the chart.*/}
                {/*    seriesObservable={observableRef.current}*/}
                {/*    // the `onSubscribe` provides a callback that gets handed the subscription when the chart*/}
                {/*    // subscribes to the rxjs observable. this can be used to hold on to the subscription for*/}
                {/*    // cancelling, or to perform some other action when the chart subscribes to the observable*/}
                {/*    onSubscribe={(subscription: Subscription) => subscriptionRef.current = subscription}*/}
                {/*    // the `shouldSubscribe` property is optional, and true by default, which means that the chart*/}
                {/*    // will subscribe to the observable when it mounts. however, you can set it to `false`, in which*/}
                {/*    // case the chart will not subscribe to the observable until it is later set to `true`*/}
                {/*    shouldSubscribe={shouldSubscribe}*/}
                {/*    // the `onUpdateTime` is an optional property that when specified will be called when the time*/}
                {/*    // is updated. in this example, we use it to unsubscribe to the observable after 3 seconds*/}
                {/*    onUpdateTime={(t: number) => {*/}
                {/*        if (t > 3000) subscriptionRef.current!.unsubscribe()*/}
                {/*    }}*/}
                {/*    // the `onUpdateData` is an optional property that when specified will be called when the data*/}
                {/*    // is updated. please note that this could get called a lot and so should only perform a short*/}
                {/*    // task*/}
                {/*    // onUpdateData={(name: string, data: Array<Datum>) => do something}*/}

                {/*    // the `timeWindow` property defines how much of the data is displayed in the chart's rolling*/}
                {/*    // time window. for example, 2000 would mean that the most recent 2 seconds are displayed*/}
                {/*    timeWindow={timeWindow}*/}
                {/*    // the `windowingTime` is the amount of time that the data is buffered before the chart is updated.*/}
                {/*    // the shorter this window, the smoother the updates, but the more CPU will be used. the window size*/}
                {/*    // should be balanced with the amount of data. less data could have short window sizes. more data*/}
                {/*    // should have longer window sizes*/}
                {/*    windowingTime={100}*/}
                {/*    // the `margin` around the plot*/}
                {/*    margin={{top: 30, right: 20, bottom: 30, left: 75}}*/}
                {/*    // the `tooltip` style properties that allow you to specify the way the tooltip looks*/}
                {/*    tooltip={{visible: visibility.tooltip}}*/}
                {/*    // the `magnifier` style properties*/}
                {/*    magnifier={{visible: visibility.magnifier, magnification: 5}}*/}
                {/*    // the `tracker` style properties*/}
                {/*    tracker={{visible: visibility.tracker}}*/}
                {/*    // the `filter` property specifies the javascript regex object used to filter the data. all series*/}
                {/*    // whose name match the regex express will be displayed in the chart.*/}
                {/*    filter={filter}*/}
                {/*    // the `svgStyle` property allow you to set the svg container's style. for example, here the svg*/}
                {/*    // container has a relative width so that the chart width updates when the window is resized*/}
                {/*    svgStyle={{width: '100%'}}*/}
                {/*/>*/}
            </GridItem>
        </Grid>
    );
}

// export default StreamingRasterChart;
