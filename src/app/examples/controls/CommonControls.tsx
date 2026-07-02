import {type JSX} from "react";
import type {Theme} from "../../ui/Themes.ts";
import Checkbox from "../../ui/Checkbox.tsx";
import type {ControlBarType} from "../../ui/ExpandableControlBar.tsx";
import {DropDataControl} from "./DropDataControl.tsx";
import {SeriesFilter} from "./SeriesFilter.tsx";
import {LagDisplay} from "./LagDisplay.tsx";

// const inputStyle = (theme: Theme): CSSProperties => ({
//     backgroundColor: theme.backgroundColor,
//     outlineStyle: 'none',
//     borderColor: theme.color,
//     borderStyle: 'solid',
//     borderWidth: 1,
//     borderRadius: 3,
//     color: theme.color,
//     fontSize: 12,
//     padding: 4,
//     margin: 6,
//     marginRight: 20
// })

type Props = {
    theme: Theme
    type: ControlBarType
    // regex filter control
    filterValue: string
    handleFilterUpdate: (updatedFilter: string) => void
    // run/pause and clear buttons
    running: boolean,
    // visibility controls
    isTooltipSelected: boolean
    onTooltipClick: () => void
    isTrackerSelected: boolean
    onTrackerClick: () => void
    //
    handleDropAfterChange: (millis: number) => void
    // chart display lag
    lag: number
}

export function CommonControls(props: Props): JSX.Element {
    const {
        theme,
        filterValue,
        handleFilterUpdate,
        running,
        isTooltipSelected,
        onTooltipClick,
        isTrackerSelected,
        onTrackerClick,
        handleDropAfterChange,
        lag,
    } = props

    return (<div style={{display: 'flex', alignItems: 'flex-start', flexDirection: 'column', gap: 5}}>
        <SeriesFilter
            theme={theme}
            filterValue={filterValue}
            handleFilterUpdate={handleFilterUpdate}
        />
        <Checkbox
            key={1}
            checked={isTooltipSelected && !running}
            disabled={running}
            label="tooltip"
            backgroundColor={theme.backgroundColor}
            borderColor={theme.color}
            labelColor={theme.color}
            onChange={onTooltipClick}
        />
        <Checkbox
            key={2}
            checked={isTrackerSelected && !running}
            disabled={running}
            label="tracker"
            backgroundColor={theme.backgroundColor}
            borderColor={theme.color}
            labelColor={theme.color}
            onChange={onTrackerClick}
        />
        <DropDataControl
            theme={theme}
            handleDropAfterChange={handleDropAfterChange}
            disabled={running}
        />
        <LagDisplay
            theme={theme}
            lag={lag}
        />
    </div>)
}