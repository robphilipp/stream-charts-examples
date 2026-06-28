import {type CSSProperties, type JSX} from "react";
import type {Theme} from "../ui/Themes.ts";
import Checkbox from "../ui/Checkbox.tsx";
import {formatTime} from "stream-charts";
import type {ControlBarType} from "../ui/ExpandableControlBar.tsx";

const inputStyle = (theme: Theme): CSSProperties => ({
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
})

type Props = {
    theme: Theme
    type: ControlBarType
    // regex filter control
    filterValue: string
    handleFilterUpdate: (updatedFilter: string) => void
    // run/pause and clear buttons
    running: boolean,
    // onRunPauseClick: () => void
    // onClearClick: () => void
    // visibility controls
    isTooltipSelected: boolean
    onTooltipClick: () => void
    isTrackerSelected: boolean
    onTrackerClick: () => void
    // chart display lag
    lag: number
}

export function CommonControls(props: Props): JSX.Element {
    const {
        theme,
        filterValue,
        handleFilterUpdate,
        running,
        // onRunPauseClick,
        // onClearClick,
        isTooltipSelected,
        onTooltipClick,
        isTrackerSelected,
        onTrackerClick,
        lag,
    } = props

    return (<>
        {/*<div>*/}
        {/*    <Button*/}
        {/*        style={buttonStyle(theme)}*/}
        {/*        onClick={onRunPauseClick}*/}
        {/*    >*/}
        {/*        {running ? "Pause" : "Run"}*/}
        {/*    </Button>*/}
        {/*    <Button*/}
        {/*        style={buttonStyle(theme)}*/}
        {/*        onClick={onClearClick}*/}
        {/*        disabled={running}*/}
        {/*    >*/}
        {/*        Clear*/}
        {/*    </Button>*/}
        {/*</div>*/}
        <label
            style={{color: theme.color}}
        >regex filter
            <input
                type="text"
                value={filterValue}
                onChange={event => handleFilterUpdate(event.currentTarget.value)}
                style={inputStyle(theme)}
            />
        </label>
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
        <span style={{
            color: theme.color,
            marginLeft: 25
        }}>lag: {formatTime(Math.max(0, lag))} ms</span>
    </>)
}