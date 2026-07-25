// code-based routing keeps the route tree (non-component exports: router, introRoute) alongside
// the shell/route components, so fast-refresh's "only export components" rule doesn't apply here
/* eslint-disable react-refresh/only-export-components */
import {type CSSProperties, type JSX, useState} from "react";
import {
    createRootRoute,
    createRoute,
    createRouter,
    Link,
    Outlet,
    redirect,
} from "@tanstack/react-router";
import {
    Grid,
    gridArea,
    GridItem,
    gridTemplateAreasBuilder,
    gridTrackTemplateBuilder,
    useGridCell,
    useWindowDimensions,
    withFraction,
    withPixels,
} from "react-resizable-grid-layout";
import {Toggle, ToggleStatus} from "./ui/Toggle";
import {defaultActiveTabStyle, defaultTabStyle} from "./ui/tabStyles";
import {darkTheme, lightTheme} from "./examples/Themes.ts";
import {StreamingRasterChart} from "./examples/StreamingRasterChart";
import {StreamingScatterChart} from "./examples/StreamingScatterChart";
import {StreamingPoincareChart} from "./examples/StreamingPoincareChart";
import {StreamingBarChart} from "./examples/StreamingBarChart";
import {StreamingOutlierChart} from "./examples/StreamingOutlierChart";
import Intro from "./examples/docs/Intro";
import {initialRandomWeightData} from "./examples/dataproviders/randomWeightData.ts";
import {initialTentMapData} from "./examples/dataproviders/randomIterateData.ts";
import {initialSineFnData} from "./examples/dataproviders/randomOrdinalData.ts";
import {useThemeStore} from "./examples/appstate/themeStore.ts";

/*
    Example data is generated once at module load so navigating between routes doesn't
    regenerate the random data (previously done at module scope in App.tsx).
 */
const seriesNames: Array<string> = []
for (let i = 0; i < 30; ++i) {
    seriesNames.push(`Series ${i}`)
}
const initialScatterData = initialRandomWeightData(seriesNames, 10, 500, 50, 20, 100)
const iterateSeriesNames = seriesNames.slice(1, 2)
const initialIterateData = initialTentMapData(25, new Map<string, number>(iterateSeriesNames.map(name => [name, Math.random() * 2])))

const spikeSeriesNames: Array<string> = []
for (let i = 0; i < 50; ++i) {
    spikeSeriesNames.push(`HC ${i + 1}`)
}
const initialSpikeData = initialRandomWeightData(spikeSeriesNames, 10, 500, 200, 20, 10)
const initialBarData = initialSineFnData(spikeSeriesNames.slice(), 1000, 4)

/*
    The tabs, now driven by routes rather than the <Tabs> component's internal state.
 */
type TabDef = {name: string, path: string}
const TABS: Array<TabDef> = [
    {name: "Intro", path: "/intro"},
    {name: "Scatter", path: "/scatter"},
    {name: "Raster", path: "/raster"},
    {name: "Poincare", path: "/poincare"},
    {name: "Bar", path: "/bar"},
    {name: "Outlier", path: "/outlier"},
]

/**
 * Routed replacement for the old <Tabs> header: renders one <Link> per tab, reusing the tab
 * styling exported from Tabs.tsx (composed the same way as TabHeader), with the active tab
 * shown bold and underlined. The theme overrides mirror what App.tsx passed to <Tabs>.
 * @return The tab navigation bar
 */
function TabNav(): JSX.Element {
    const {theme} = useThemeStore()
    const styleOverride: CSSProperties = {
        backgroundColor: theme.backgroundColor,
        color: theme.color,
        width: "auto",
        paddingLeft: 20,
        paddingRight: 20,
        display: "inline-block",
        textDecoration: "none",
    }
    const [isHovered, setIsHovered] = useState<string>("")
    const [isFocused, setIsFocused] = useState<string>("")

    const inactiveTabStyle: CSSProperties = {
        ...defaultTabStyle,
        ...styleOverride,
    }
    const activeTabStyle: CSSProperties = {
        ...defaultTabStyle,
        ...styleOverride,
        ...defaultActiveTabStyle,
        borderBottom: `1px solid ${theme.color}`,
    }
    return (
        <div style={{display: "flex"}}>
            {TABS.map(tab => (
                <Link
                    key={`tab-${tab.name}`}
                    to={tab.path}
                    // keep the tab active across all of its substates (e.g., /intro?page=2)
                    activeOptions={{includeSearch: false}}
                    style={isHovered === tab.name || isFocused === tab.name ?
                        {...inactiveTabStyle, borderBottom: `1px dotted ${theme.disabledColor}`} :
                        inactiveTabStyle
                    }
                    activeProps={{style: activeTabStyle}}
                    onMouseEnter={() => setIsHovered(tab.name)}
                    onMouseLeave={() => setIsHovered("")}
                    onFocus={() => setIsFocused(tab.name)}
                    onBlur={() => setIsFocused("")}
                >
                    {tab.name}
                </Link>
            ))}
        </div>
    )
}

/**
 * The application shell (header, theme toggle, tab navigation) rendered by the root route.
 * The active tab's content is rendered into the <Outlet/>. This component stays mounted across
 * navigation, so the theme toggle and theme context persist.
 * @return The application shell
 */
function RootLayout(): JSX.Element {
    const {theme, updateTheme} = useThemeStore()

    function handleThemeChange(status: ToggleStatus): void {
        updateTheme(status === ToggleStatus.OFF ? lightTheme : darkTheme)
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
                .build()}
            gridTemplateAreas={gridTemplateAreasBuilder()
                .addArea("app-header", gridArea(1, 1, 1, 3))
                .addArea("left-side", gridArea(2, 1, 5))
                .addArea("scatter-header", gridArea(2, 2))
                .addArea("scatter-chart", gridArea(3, 2))
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
                                leftLabel="light"
                                rightLabel="dark"
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
                <h3 style={{color: theme.color}}>Streaming Charts</h3>
            </GridItem>
            <GridItem gridAreaName="scatter-chart">
                <Grid
                    dimensionsSupplier={useGridCell}
                    gridTemplateColumns={gridTrackTemplateBuilder()
                        .addTrack(withFraction(1))
                        .build()}
                    gridTemplateRows={gridTrackTemplateBuilder()
                        .addTrack(withPixels(55))
                        .addTrack(withFraction(1))
                        .addTrack(withPixels(10))
                        .build()}
                    gridTemplateAreas={gridTemplateAreasBuilder()
                        .addArea("tab-header", gridArea(1, 1))
                        .addArea("tab", gridArea(2, 1))
                        .addArea("tab-bottom", gridArea(3, 1))
                        .build()}
                    styles={{color: theme.color}}
                >
                    <GridItem gridAreaName="tab-header">
                        <TabNav/>
                    </GridItem>
                    <GridItem gridAreaName="tab">
                        <Outlet/>
                    </GridItem>
                </Grid>
            </GridItem>
        </Grid>
    )
}

/*
    Route tree
 */
const rootRoute = createRootRoute({
    component: RootLayout,
})

const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    beforeLoad: () => {
        throw redirect({to: "/intro", search: {page: 0}})
    },
})

export const introRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/intro",
    validateSearch: (search: Record<string, unknown>): {page: number} => ({
        page: Number(search.page ?? 0),
    }),
    component: Intro,
})

const scatterRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/scatter",
    component: ScatterRoute,
})

const rasterRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/raster",
    component: RasterRoute,
})

const poincareRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/poincare",
    component: PoincareRoute,
})

const barRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/bar",
    component: BarRoute,
})

const outlierRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/outlier",
    component: OutlierRoute,
})

/*
    Route components for the charts. Each reads the theme from context and passes the same
    props the charts received previously in App.tsx.
 */
function ScatterRoute(): JSX.Element {
    const {theme} = useThemeStore()
    return <StreamingScatterChart theme={theme} timeWindow={1000} initialData={initialScatterData}/>
}

function RasterRoute(): JSX.Element {
    const {theme} = useThemeStore()
    return <StreamingRasterChart theme={theme} timeWindow={1000} initialData={initialSpikeData} seriesHeight={20} plotWidth={900}/>
}

function PoincareRoute(): JSX.Element {
    const {theme} = useThemeStore()
    return <StreamingPoincareChart theme={theme} timeWindow={1000} initialData={initialIterateData}/>
}

function BarRoute(): JSX.Element {
    const {theme} = useThemeStore()
    return <StreamingBarChart theme={theme} timeWindow={100} initialData={initialBarData} seriesHeight={20} plotWidth={900}/>
}

function OutlierRoute(): JSX.Element {
    const {theme} = useThemeStore()
    return <StreamingOutlierChart theme={theme} timeWindow={2500}/>
}

const routeTree = rootRoute.addChildren([
    indexRoute,
    introRoute,
    scatterRoute,
    rasterRoute,
    poincareRoute,
    barRoute,
    outlierRoute,
])

export const router = createRouter({
    routeTree,
    scrollRestoration: true,
    // key scroll cache by full path + search so each intro page (/intro?page=N) and each chart
    // remembers its own scroll position independently
    getScrollRestorationKey: location => location.pathname + location.searchStr,
})

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router
    }
}
