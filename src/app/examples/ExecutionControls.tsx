import {type JSX} from "react";
import type {Theme} from "../ui/Themes.ts";
import {Button} from "../ui/Button.tsx";
import {buttonStyle} from "../ui/utils.ts";
import type {ControlBarType} from "../ui/ExpandableControlBar.tsx";
import {pauseIcon, playIcon, resetIcon} from "../ui/Icons.tsx";

type Props = {
    theme: Theme
    type: ControlBarType,
    running: boolean,
    onRunPauseClick: () => void
    onClearClick: () => void
}

export function ExecutionControls(props: Props): JSX.Element {
    const {
        theme,
        running,
        onRunPauseClick,
        onClearClick,
    } = props

    return (<>
        <div>
            <Button
                style={{...buttonStyle(theme), width: 70}}
                onClick={onRunPauseClick}
                icon={color => running ? pauseIcon(color) : playIcon(color)}
            >
                {running ? "Pause" : "Run"}
            </Button>
            <Button
                style={{...buttonStyle(theme), width: 70}}
                onClick={onClearClick}
                icon={color => resetIcon(color)}
                disabled={running}
            >
                Clear
            </Button>
        </div>
    </>)
}