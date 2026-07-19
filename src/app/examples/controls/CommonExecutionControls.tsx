import {type JSX} from "react";
import type {Theme} from "../theme/Themes.ts";
import {Button} from "../../ui/Button.tsx";
import {buttonStyle} from "../../ui/utils.ts";
import type {ControlBarType} from "../../ui/ExpandableControlBar.tsx";
import {PauseIcon, PlayIcon, ResetIcon,} from "../../ui/Icons.tsx";

type Props = {
    type: ControlBarType
    theme: Theme
    isRunning: boolean
    onRunPauseClick: () => void
    onClearClick: () => void
    children: JSX.Element | Array<JSX.Element>
}

export function CommonExecutionControls(props: Props): JSX.Element {
    const {
        theme,
        isRunning,
        onRunPauseClick,
        onClearClick,
    } = props

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
            {props.children}
        </div>
    </>)
}