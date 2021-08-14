import {default as React, useRef, useState} from "react";
// import {Series, ScatterChart, ChartData, regexFilter} from "stream-charts";
import {randomWeightDataObservable} from "./randomData";
import {Observable, Subscription} from "rxjs";
import Checkbox from "./Checkbox";
import {
    Grid, gridArea, GridItem,
    gridTemplateAreasBuilder,
    gridTrackTemplateBuilder,
    useGridCell, useGridCellHeight, useGridCellWidth,
    withFraction,
    withPixels
} from "react-resizable-grid-layout";
import {Series} from "../charts/datumSeries";
import { ChartData } from "../charts/chartData";
import { regexFilter } from "../charts/regexFilter";
import {ScatterChart} from "../charts/ScatterChart";
import {Chart} from "../charts/Chart";
import {defaultMargin} from "../charts/useChart";
import {AxisLocation, defaultLineStyle} from "../charts/axes";
import {ContinuousAxis} from "../charts/ContinuousAxis";
import * as d3 from "d3";
import {assignAxes, ScatterPlot} from "../charts/ScatterPlot";

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
    timeWindow?: number;
    initialData: Array<Series>
    plotHeight?: number;
    plotWidth?: number;
}

export function StreamingScatterChart(props: Props): JSX.Element {
    const {
        initialData,
    } = props;

    const observableRef = useRef<Observable<ChartData>>(randomWeightDataObservable(
        initialData,
        25,
        25,
        0, 1000
    ));
    // const observableRef = useRef<Observable<ChartData>>(randomWeightDataObservable(initialData.map(series => series.name), 0.1));
    const subscriptionRef = useRef<Subscription>();

    const [filterValue, setFilterValue] = useState<string>('');
    const [filter, setFilter] = useState<RegExp>(new RegExp(''));

    const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
    const [magnification, setMagnification] = useState(5);

    /**
     * Called when the user changes the regular expression filter
     * @param {string} updatedFilter The updated the filter
     */
    function handleUpdateRegex(updatedFilter: string): void {
        setFilterValue(updatedFilter);
        regexFilter(updatedFilter).ifSome((regex: RegExp) => setFilter(regex));
    }

    const inputStyle = {
        backgroundColor: '#202020',
        outlineStyle: 'none',
        borderColor: '#d2933f',
        borderStyle: 'solid',
        borderWidth: 1,
        borderRadius: 3,
        color: '#d2933f',
        fontSize: 12,
        padding: 4,
        margin: 6,
        marginRight: 20
    };

    return (
        <Grid
            dimensionsSupplier={useGridCell}
            gridTemplateColumns={gridTrackTemplateBuilder()
                .addTrack(withFraction(1))
                .build()}
            gridTemplateRows={gridTrackTemplateBuilder()
                .addTrack(withPixels(35))
                .addTrack(withFraction(1))
                .addTrack(withPixels(10))
                .build()}
            gridTemplateAreas={gridTemplateAreasBuilder()
                .addArea("chart-controls", gridArea(1, 1))
                .addArea("chart", gridArea(2, 1))
                .addArea("chart-bottom", gridArea(3, 1))
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
                    <Checkbox
                        key={1}
                        checked={visibility.tooltip}
                        label="tooltip"
                        onChange={() => setVisibility({tooltip: !visibility.tooltip, tracker: false, magnifier: false})}
                    />
                    <Checkbox
                        key={2}
                        checked={visibility.tracker}
                        label="tracker"
                        onChange={() => setVisibility({tooltip: false, tracker: !visibility.tracker, magnifier: false})}
                    />
                    <Checkbox
                        key={3}
                        checked={visibility.magnifier}
                        label="magnifier"
                        onChange={() => setVisibility({
                            tooltip: false,
                            tracker: false,
                            magnifier: !visibility.magnifier
                        })}
                    />
                    {visibility.magnifier ?
                        (<label><input
                            type="range"
                            value={magnification}
                            min={1}
                            max={10}
                            step={1}
                            onChange={event => setMagnification(parseInt(event.target.value))}
                        /> ({magnification})</label>) :
                        (<span/>)
                    }
                </div>
            </GridItem>
            <GridItem gridAreaName="chart">
                <Chart
                    width={useGridCellWidth()}
                    height={useGridCellHeight()}
                    margin={{
                        ...defaultMargin,
                        top: 60,
                        right: 60
                    }}
                    // svgStyle={{'background-color': 'pink'}}
                    backgroundColor='lightgray'
                    seriesStyles={new Map([
                        ['test1', {...defaultLineStyle, color: 'orange', lineWidth: 1}],
                        ['test2', {...defaultLineStyle, color: 'blue', lineWidth: 3}],
                    ])}
                    initialData={initialData}
                    seriesFilter={filter}
                    seriesObservable={observableRef.current}
                    shouldSubscribe={false}
                    windowingTime={10}
                >
                    <ContinuousAxis axisId="x-axis-1" location={AxisLocation.Bottom} domain={[10, 1000]} label="x-axis"/>
                    {/*<ContinuousAxis axisId="x-axis-1" location={AxisLocation.Bottom} domain={[0, 100]} label="x-axis"/>*/}
                    <ContinuousAxis axisId="y-axis-1" location={AxisLocation.Left} domain={[0, 1000]} label="y-axis"/>
                    {/*<ContinuousAxis axisId="x-axis-2" location={AxisLocation.Top} domain={[100, 1000]} label="x-axis (2)"/>*/}
                    {/*<ContinuousAxis axisId="y-axis-2" location={AxisLocation.Right} scale={d3.scaleLog()} domain={[100, 1200]} label="y-axis (2)"/>*/}
                    <ScatterPlot
                        // axisAssignments={new Map([
                        //     // ['test', assignAxes("x-axis-1", "y-axis-1")],
                        //     ['test2', assignAxes("x-axis-2", "y-axis-2")],
                        //     // ['test3', assignAxes("x-axis-1", "y-axis-1")],
                        // ])}
                    />
                </Chart>
                {/*<ScatterChart*/}
                {/*    // when the `width` property is specified, then the width of the chart will be that number*/}
                {/*    // in pixels. alternatively, if the `svgStyle` property has a `width` property with a relative*/}
                {/*    // width (i.e. percentage), then the chart will resize its width as the window resizes.*/}
                {/*    width={useGridCellWidth()}*/}

                {/*    // the `height` property specifies the height of the plot in pixels*/}
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
                {/*    // shouldSubscribe={shouldSubscribe}*/}

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
                {/*    windowingTime={50}*/}
                {/*    // the `margin` around the plot*/}
                {/*    margin={{top: 30, right: 20, bottom: 30, left: 75}}*/}
                {/*    // the `tooltip` style properties that allow you to specify the way the tooltip looks*/}
                {/*    tooltip={{visible: visibility.tooltip}}*/}
                {/*    // the `tooltipValueLabel` specifies the value label in the tooltip. this represents the values*/}
                {/*    // of the y-axis*/}
                {/*    tooltipValueLabel='weight'*/}
                {/*    // the `magnifier` style properties*/}
                {/*    magnifier={{visible: visibility.magnifier, magnification: magnification, radius: 150}}*/}
                {/*    // the `tracker` style properties*/}
                {/*    tracker={{visible: visibility.tracker}}*/}
                {/*    // the `filter` property specifies the javascript regex object used to filter the data. all series*/}
                {/*    // whose name match the regex express will be displayed in the chart.*/}
                {/*    filter={filter}*/}
                {/*    // you can specify a map that holds the colors for each series id, or you can let the*/}
                {/*    // chart pick the colors for you.*/}
                {/*    // seriesColors={new Map()}*/}

                {/*    // the `svgStyle` property allow you to set the svg container's style. for example, here the svg*/}
                {/*    // container has a relative width so that the chart width updates when the window is resized*/}
                {/*    svgStyle={{width: '100%'}}*/}

                {/*    dropDataAfter={10000}/>*/}
            </GridItem>
        </Grid>
    );
}