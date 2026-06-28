import {type JSX} from "react";
import type {Theme} from "../ui/Themes.ts";
import {Button} from "../ui/Button.tsx";
import {buttonStyle} from "../ui/utils.ts";
import type {ControlBarType} from "../ui/ExpandableControlBar.tsx";

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
                style={buttonStyle(theme)}
                onClick={onRunPauseClick}
            >
                {running ? "Pause" : "Run"}
            </Button>
            <Button
                style={buttonStyle(theme)}
                onClick={onClearClick}
                disabled={running}
            >
                Clear
            </Button>
        </div>
    </>)
}