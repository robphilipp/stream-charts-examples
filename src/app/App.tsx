import React, {useState} from 'react';
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
import {StreamingScatterChart} from "./examples/StreamingScatterChart";
import {Toggle, ToggleStatus} from "./examples/Toggle";
import {darkTheme, lightTheme, Theme} from "./examples/Themes";
import {StreamingRasterChart} from "./examples/StreamingRasterChart";
import {initialRandomWeightData} from "./examples/randomData";

const seriesNames: Array<string> = []
for (let i = 0; i < 30; ++i) {
    seriesNames.push(`test${i}`)
}
const initialScatterData = initialRandomWeightData(seriesNames, 10, 500, 50, 20, 10)

const spikeSeriesNames: Array<string> = []
for (let i = 0; i < 50; ++i) {
    spikeSeriesNames.push(`neuron${i+1}`)
}
const initialSpikeData = initialRandomWeightData(spikeSeriesNames, 10, 500, 50, 20, 10)

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
                .addTrack(withFraction(1))
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
                    initialData={initialScatterData}
                />
            </GridItem>
            <GridItem gridAreaName="raster-header">
                <h3 style={{color: theme.color}}>Streaming Raster Chart</h3>
            </GridItem>
            <GridItem gridAreaName="raster-chart">
                <StreamingRasterChart
                    theme={theme}
                    timeWindow={1000}
                    initialData={initialSpikeData}
                    seriesHeight={20}
                    plotWidth={900}
                />
            </GridItem>
        </Grid>
    );
};

export default App;
