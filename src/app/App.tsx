import React from 'react';
import {Series, seriesFrom} from "stream-charts";
import {
    Grid,
    gridArea,
    GridItem,
    gridTemplateAreasBuilder,
    gridTrackTemplateBuilder,
    useGridCellHeight,
    useGridCellWidth,
    useWindowDimensions,
    withFraction,
    withPixels
} from 'react-resizable-grid-layout';
import {Chart} from "./charts/Chart";
import {Observable} from "rxjs";
import {AxisLocation, defaultLineStyle} from "./charts/axes";
import {defaultMargin} from "./charts/useChart";
import {ContinuousAxis} from "./charts/ContinuousAxis";
import {assignedAxes, ScatterPlot} from "./charts/ScatterPlot";
import {datumOf} from "./charts/datumSeries";
import * as d3 from 'd3';

const inputNeurons: Array<string> = Array.from({length: 5}, (_, i) => `in${i}`);
const outputNeurons: Array<string> = Array.from({length: 25}, (_, i) => `out${i}`);
const spikes: Array<Series> = inputNeurons.concat(outputNeurons).map(neuron => seriesFrom(neuron));
const weights: Array<Series> = inputNeurons.flatMap(input => outputNeurons.map(output => seriesFrom(`${input}-${output}`)));

const initialData = new Map([
    ['test', seriesFrom('test', [
        datumOf(10, 80),
        datumOf(20, 220),
        datumOf(30, 300),
        datumOf(40, 380),
        datumOf(50, 510),
        datumOf(60, 620),
        datumOf(70, 680),
        datumOf(80, 1080),
        datumOf(90, 980),
        datumOf(100, 880),
        datumOf(110, 980),
    ])],
    ['test2', seriesFrom('test2', [
        datumOf(100, 980),
        datumOf(200, 880),
        datumOf(300, 980),
        datumOf(400, 1080),
        datumOf(500, 680),
        datumOf(600, 620),
        datumOf(700, 510),
        datumOf(800, 380),
        datumOf(900, 300),
        datumOf(1000, 20),
        datumOf(1100, 180),
        datumOf(1200, 180),
        datumOf(1300, 480),
    ])],
    ['test3', seriesFrom('test3', [
        datumOf(10, 100),
        datumOf(20, 103),
        datumOf(30, 110),
        datumOf(40, 100),
        datumOf(50, 90),
        datumOf(60, 88),
        datumOf(70, 160),
        datumOf(80, 130),
        datumOf(90, 100),
        datumOf(100, 120),
        datumOf(110, 100),
        datumOf(120, -250),
        datumOf(130, 120),
        datumOf(150, 180),
        datumOf(170, 280),
    ])],
])

const App: React.FC = () => {
    return (
        <Grid
            dimensionsSupplier={useWindowDimensions}
            gridTemplateColumns={gridTrackTemplateBuilder()
                .addTrack(withPixels(40))
                .addTrack(withFraction(1))
                .addTrack(withPixels(40))
                .build()}
            gridTemplateRows={gridTrackTemplateBuilder()
                .addTrack(withPixels(50))
                .addTrack(withFraction(1))
                .addTrack(withPixels(50))
                .addTrack(withFraction(1))
                .build()}
            gridTemplateAreas={gridTemplateAreasBuilder()
                .addArea("left-side", gridArea(1, 1, 4))
                .addArea("scatter-header", gridArea(1, 2))
                .addArea("scatter-chart", gridArea(2, 2))
                .addArea("raster-header", gridArea(3, 2))
                .addArea("raster-chart", gridArea(4, 2))
                .addArea("left-side", gridArea(1, 3, 4))
                .build()}
            styles={{backgroundColor: '#202020'}}
        >
            <GridItem gridAreaName="scatter-header">
                <h3 style={{color: '#d2933f'}}>Streaming Scatter Chart</h3>
            </GridItem>
            <GridItem gridAreaName="scatter-chart">
                {/*<StreamingScatterChart*/}
                {/*    timeWindow={1000}*/}
                {/*    seriesList={weights}*/}
                {/*    plotHeight={500}*/}
                {/*    plotWidth={900}*/}
                {/*/>*/}
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
                        ['test', {...defaultLineStyle, color: 'orange', lineWidth: 1}],
                        ['test2', {...defaultLineStyle, color: 'blue', lineWidth: 3}],
                    ])}
                    initialData={initialData}
                    seriesObservable={new Observable()}
                >
                    <ContinuousAxis axisId="x-axis-1" location={AxisLocation.Bottom} domain={[10, 100]} label="x-axis"/>
                    <ContinuousAxis axisId="y-axis-1" location={AxisLocation.Left} domain={[0, 1000]} label="y-axis"/>
                    <ContinuousAxis axisId="x-axis-2" location={AxisLocation.Top} domain={[100, 1000]} label="x-axis (2)"/>
                    <ContinuousAxis axisId="y-axis-2" location={AxisLocation.Right} scale={d3.scaleLog()} domain={[100, 1200]} label="y-axis (2)"/>
                    <ScatterPlot
                        axisAssignments={new Map([
                            // ['test', assignedAxes("x-axis-1", "y-axis-1")],
                            ['test2', assignedAxes("x-axis-2", "y-axis-2")],
                            // ['test3', assignedAxes("x-axis-1", "y-axis-1")],
                        ])}
                    />
                    <div>test</div>
                </Chart>
            </GridItem>
            {/*<GridItem gridAreaName="raster-header">*/}
            {/*    <h3 style={{color: '#d2933f'}}>Streaming Raster Chart</h3>*/}
            {/*</GridItem>*/}
            {/*<GridItem gridAreaName="raster-chart">*/}
            {/*    <StreamingRasterChart*/}
            {/*        timeWindow={1000}*/}
            {/*        seriesList={spikes}*/}
            {/*        seriesHeight={20}*/}
            {/*        plotWidth={900}*/}
            {/*    />*/}
            {/*</GridItem>*/}
        </Grid>
    );
};

export default App;
