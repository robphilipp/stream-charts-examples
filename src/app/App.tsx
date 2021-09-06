import React, {useState} from 'react';
// import {Series, seriesFrom} from "stream-charts";
import {
    Grid,
    gridArea,
    GridItem,
    gridTemplateAreasBuilder,
    gridTrackTemplateBuilder,
    useGridCell,
    useWindowDimensions,
    withFraction,
    withPixels
} from 'react-resizable-grid-layout';
import {Series, seriesFrom, seriesFromTuples} from "./charts/datumSeries";
import {StreamingScatterChart} from "./examples/StreamingScatterChart";
import {Toggle, ToggleStatus} from "./examples/Toggle";
import {darkTheme, lightTheme, Theme} from "./examples/Themes";

const inputNeurons: Array<string> = Array.from({length: 5}, (_, i) => `in${i}`);
const outputNeurons: Array<string> = Array.from({length: 25}, (_, i) => `out${i}`);
const spikes: Array<Series> = inputNeurons.concat(outputNeurons).map(neuron => seriesFrom(neuron));
const weights: Array<Series> = inputNeurons.flatMap(input => outputNeurons.map(output => seriesFrom(`${input}-${output}`)));

const initialData = [
    seriesFromTuples('test1', [
        [10, 80], [20, 220], [30, 300], [40, 380], [50, 510], [60, 620], [70, 680],
        [80, 1080], [90, 980], [100, 880], [110, 750]
    ]),
    seriesFromTuples('test2', [
        [100, 980], [200, 880], [300, 980], [400, 1080], [500, 680], [600, 620], [700, 510],
        [800, 380], [900, 300], [1000, 20], [1100, 180], [1200, 180], [1300, 480],
    ]),
    seriesFromTuples('test3', [
        [10, 100], [20, 103], [30, 110], [40, 100], [50, 90], [60, 88], [70, 160], [80, 130],
        [90, 100], [100, 120], [110, 100], [120, -250], [130, 120], [150, 180], [170, 280],
    ]),
]

const App: React.FC = () => {
    const [theme, setTheme] = useState<Theme>(lightTheme)

    function handleThemeChange(status: ToggleStatus): void {
        if (status === ToggleStatus.OFF) {
            setTheme(lightTheme)
        } else {
            setTheme(darkTheme)
        }
    }

    return (
        <Grid
            dimensionsSupplier={useWindowDimensions}
            gridTemplateColumns={gridTrackTemplateBuilder()
                .addTrack(withPixels(40))
                .addTrack(withFraction(1))
                .addTrack(withPixels(40))
                .build()}
            gridTemplateRows={gridTrackTemplateBuilder()
                .addTrack(withPixels(25))
                .addTrack(withPixels(50))
                .addTrack(withFraction(2))
                .addTrack(withPixels(50))
                .addTrack(withFraction(1))
                .build()}
            gridTemplateAreas={gridTemplateAreasBuilder()
                .addArea("left-side", gridArea(2, 1, 5))
                .addArea("app-header", gridArea(1, 1, 1, 3))
                .addArea("scatter-header", gridArea(2, 2))
                .addArea("scatter-chart", gridArea(3, 2))
                .addArea("raster-header", gridArea(4, 2))
                .addArea("raster-chart", gridArea(5, 2))
                .addArea("left-side", gridArea(1, 3, 5))
                .build()}
            styles={{backgroundColor: theme.backgroundColor}}
        >
            <GridItem gridAreaName="app-header">
                <Grid
                    dimensionsSupplier={useGridCell}
                    gridTemplateColumns={gridTrackTemplateBuilder()
                        .addTrack(withFraction(1))
                        .addTrack(withPixels(125))
                        .build()}
                    gridTemplateRows={gridTrackTemplateBuilder()
                        .addTrack(withFraction(1))
                        .build()}
                >
                    <GridItem row={1} column={2}>
                        <div style={{marginTop: 3}}>
                        <Toggle
                            onToggle={handleThemeChange}
                            toggleOffColor={lightTheme.color}
                            toggleOffBackgroundColor={lightTheme.backgroundColor}
                            toggleOnColor={darkTheme.color}
                            toggleOnBackgroundColor={darkTheme.backgroundColor}
                            toggleBorderColor={theme.color}
                            labelFontColor={theme.color}
                        />
                        </div>
                    </GridItem>
                </Grid>
            </GridItem>
            <GridItem gridAreaName="scatter-header">
                <h3 style={{color: theme.color}}>Streaming Scatter Chart</h3>
            </GridItem>
            <GridItem gridAreaName="scatter-chart">
                {/*<StreamingScatterChart*/}
                {/*    timeWindow={1000}*/}
                {/*    seriesList={weights}*/}
                {/*    plotHeight={500}*/}
                {/*    plotWidth={900}*/}
                {/*/>*/}
                {/*<Chart*/}
                {/*    width={useGridCellWidth()}*/}
                {/*    height={useGridCellHeight()}*/}
                {/*    margin={{*/}
                {/*        ...defaultMargin,*/}
                {/*        top: 60,*/}
                {/*        right: 60*/}
                {/*    }}*/}
                {/*    // svgStyle={{'background-color': 'pink'}}*/}
                {/*    backgroundColor='lightgray'*/}
                {/*    seriesStyles={new Map([*/}
                {/*        ['test1', {...defaultLineStyle, color: 'orange', lineWidth: 1}],*/}
                {/*        ['test2', {...defaultLineStyle, color: 'blue', lineWidth: 3}],*/}
                {/*    ])}*/}
                {/*    initialData={initialData}*/}
                {/*    // seriesFilter={/test*!/*/}
                {/*    seriesObservable={new Observable()}*/}
                {/*>*/}
                {/*    <ContinuousAxis axisId="x-axis-1" location={AxisLocation.Bottom} domain={[10, 100]} label="x-axis"/>*/}
                {/*    <ContinuousAxis axisId="y-axis-1" location={AxisLocation.Left} domain={[0, 1000]} label="y-axis"/>*/}
                {/*    <ContinuousAxis axisId="x-axis-2" location={AxisLocation.Top} domain={[100, 1000]} label="x-axis (2)"/>*/}
                {/*    <ContinuousAxis axisId="y-axis-2" location={AxisLocation.Right} scale={d3.scaleLog()} domain={[100, 1200]} label="y-axis (2)"/>*/}
                {/*    <ScatterPlot*/}
                {/*        axisAssignments={new Map([*/}
                {/*            // ['test', assignedAxes("x-axis-1", "y-axis-1")],*/}
                {/*            ['test2', assignedAxes("x-axis-2", "y-axis-2")],*/}
                {/*            // ['test3', assignedAxes("x-axis-1", "y-axis-1")],*/}
                {/*        ])}*/}
                {/*    />*/}
                {/*</Chart>*/}
                <StreamingScatterChart
                    theme={theme}
                    timeWindow={1000}
                    initialData={initialData}
                    // seriesList={Array.from(initialData.values())}
                />
            </GridItem>
            <GridItem gridAreaName="raster-header">
                <h3 style={{color: theme.color}}>Streaming Raster Chart</h3>
            </GridItem>
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
