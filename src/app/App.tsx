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
import {StreamingRasterChart} from "./examples/StreamingRasterChart";

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
const initialData2 = initialData.map(series => seriesFrom(series.name, series.data.slice()))

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
                <StreamingScatterChart
                    theme={theme}
                    timeWindow={1000}
                    initialData={initialData}
                />
            </GridItem>
            <GridItem gridAreaName="raster-header">
                <h3 style={{color: theme.color}}>Streaming Raster Chart</h3>
            </GridItem>
            <GridItem gridAreaName="raster-chart">
                <StreamingRasterChart
                    theme={theme}
                    timeWindow={1000}
                    initialData={initialData}
                    seriesHeight={20}
                    plotWidth={900}
                />
            </GridItem>
        </Grid>
    );
};

export default App;
