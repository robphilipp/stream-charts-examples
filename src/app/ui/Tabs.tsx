import React, {cloneElement, JSX, useState} from "react"
import {Button} from "./Button";
import {noop} from "../charts/utils";
import {
    Grid,
    gridArea,
    GridItem,
    gridTemplateAreasBuilder,
    gridTrackTemplateBuilder,
    useGridCell,
    withFraction,
    withPixels
} from "react-resizable-grid-layout";

export type Props = {
    style?: React.CSSProperties
    activeStyle?: React.CSSProperties
    tabNames: Array<string>
    onTabChange?: (index: number, name: string) => void
    withGrids?: boolean
    children: Array<JSX.Element>
}

export function Tabs(props: Props): JSX.Element {
    const {
        tabNames = [],
        onTabChange = noop,
        withGrids = false,
        children = []
    } = props

    if (tabNames.length !== children.length) {
        throw new Error(`Each tab must have a name; num_tabs: ${children.length}; num_tab_names: ${tabNames.length}`);
    }

    const [activeTab, setActiveTab] = useState(0)

    function handleTabChange(newIndex: number) {
        onTabChange(newIndex, tabNames[newIndex])
        setActiveTab(newIndex)
    }

    const tabHeader = <TabHeader
        names={tabNames}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        style={props.style}
        activeStyle={props.activeStyle}
    />
    const tabContents = <>
        {children
            .filter((_, index) => index === activeTab)
            .map((child, index) => cloneElement(child, {key: `child-tab-${tabNames[index]}-${index}`, name: tabNames[index]}))
        }
    </>

    if (withGrids) {
        return wrapWithGrid(tabHeader, tabContents)
    }

    return <>
        {tabHeader}
        {tabContents}
    </>

}

function wrapWithGrid(tabHeader: JSX.Element, tabContent: JSX.Element): JSX.Element {
    return <>
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
            styles={{color: '#d2933f'}}
        >
            <GridItem gridAreaName="tab-header">
                {tabHeader}
            </GridItem>
            <GridItem gridAreaName="tab">
                {tabContent}
            </GridItem>
        </Grid>
    </>
}

type HeaderProps = {
    style?: React.CSSProperties
    activeStyle?: React.CSSProperties
    names: Array<string>
    activeTab: number
    setActiveTab: (index: number) => void
}

const defaultTabStyle = {
    backgroundColor: '#fff',
    borderLeft: 'unset',
    borderRight: 'unset',
    borderTop: 'unset',
    borderBottom: 'unset',
    borderRadius: 0,
    fontColor: '#202020',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    width: 50,
    padding: 4,
    margin: 6,
    marginRight: 20,
    cursor: 'pointer',
}

const defaultActiveTabStyle = {
    borderBottom: '3px solid #202020',
    fontWeight: 700,
}

function TabHeader(props: HeaderProps): JSX.Element {
    const {style = defaultTabStyle, activeStyle = defaultActiveTabStyle} = props
    const activeTabStyle = {...defaultTabStyle, ...style, ...defaultActiveTabStyle, ...activeStyle}
    const inactiveTabStyle = {...defaultTabStyle, ...style}
    return <div>
        {props.names.map((name, index) => (
            <Button
                key={`tab-button-booboo-${name}-${index}`}
                style={index === props.activeTab ? {...activeTabStyle} : {...inactiveTabStyle}}
                onClick={() => props.setActiveTab(index)}
            >
                {name}
            </Button>
        ))}
    </div>
}
