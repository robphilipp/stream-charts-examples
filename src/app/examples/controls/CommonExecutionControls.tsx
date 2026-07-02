import {type JSX} from "react";
import type {Theme} from "../../ui/Themes.ts";
import {Button} from "../../ui/Button.tsx";
import {buttonStyle} from "../../ui/utils.ts";
import type {ControlBarType} from "../../ui/ExpandableControlBar.tsx";
import {
    FilterIcon,
    LagIcon, PauseIcon, PlayIcon, ResetIcon,
    TooltipIcon,
    TrackerIcon,
} from "../../ui/Icons.tsx";

type Status = {
    isRunning: boolean
    isFiltering?: boolean
    isShowTooltip: boolean
    isShowTracker: boolean
    lag: number
}

type Props = {
    theme: Theme
    type: ControlBarType
    status: Status
    onRunPauseClick: () => void
    onClearClick: () => void
}

export function CommonExecutionControls(props: Props): JSX.Element {
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
                icon={color => isRunning ? <PauseIcon color={color}/> : <PlayIcon color={color}/>}
            >
                {isRunning ? "Pause" : "Run"}
            </Button>
            <Button
                style={{...buttonStyle(theme), width: 70}}
                onClick={onClearClick}
                icon={color => <ResetIcon color={color}/>}
                disabled={isRunning}
            >
                Reset
            </Button>
            <LagIcon color={lag > 0 ? theme.color : theme.disabledBackgroundColor} fill={lag > 0 ? "#c64646" : "none"}/>
            <FilterIcon color={isFiltering ? theme.color : theme.disabledBackgroundColor}/>
            <TooltipIcon color={isShowTooltip ? theme.color : theme.disabledBackgroundColor}/>
            <TrackerIcon color={isShowTracker ? theme.color : theme.disabledBackgroundColor}/>
        </div>
    </>)
}