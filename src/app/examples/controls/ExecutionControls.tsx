import {type JSX} from "react";
import type {Theme} from "../../ui/Themes.ts";
import {Button} from "../../ui/Button.tsx";
import {buttonStyle} from "../../ui/utils.ts";
import type {ControlBarType} from "../../ui/ExpandableControlBar.tsx";
import {filterIcon, lagIcon, pauseIcon, playIcon, resetIcon, tooltipIcon, trackerIcon} from "../../ui/Icons.tsx";

type Status = {
    isRunning: boolean
    isFiltering: boolean
    isShowTooltip: boolean
    isShowTracker: boolean
    lag: number
}

type Props = {
    theme: Theme
    type: ControlBarType
    // isRunning: boolean
    status: Status
    onRunPauseClick: () => void
    onClearClick: () => void
}

export function ExecutionControls(props: Props): JSX.Element {
    const {
        theme,
        onRunPauseClick,
        onClearClick,
    } = props

    const {
        isRunning,
        isFiltering,
        isShowTooltip,
        isShowTracker,
        lag,
    } = props.status

    return (<>
        <div style={{display: 'flex', alignItems: 'center', gap: 5}}>
            <Button
                style={{...buttonStyle(theme), width: 70}}
                onClick={onRunPauseClick}
                icon={color => isRunning ? pauseIcon(color) : playIcon(color)}
            >
                {isRunning ? "Pause" : "Run"}
            </Button>
            <Button
                style={{...buttonStyle(theme), width: 70}}
                onClick={onClearClick}
                icon={color => resetIcon(color)}
                disabled={isRunning}
            >
                Reset
            </Button>
            {lag > 0 ? lagIcon(theme.color, "#c64646") : lagIcon(theme.disabledBackgroundColor)}
            {isFiltering ? filterIcon(theme.color) : filterIcon(theme.disabledBackgroundColor)}
            {isShowTooltip ? tooltipIcon(theme.color) : tooltipIcon(theme.disabledBackgroundColor)}
            {isShowTracker ? trackerIcon(theme.color) : trackerIcon(theme.disabledBackgroundColor)}
        </div>
    </>)
}