import type {ControlBarType} from "../../ui/ExpandableControlBar.tsx";
import type {Theme} from "../../ui/Themes.ts";
import type {JSX} from "react";

type Props = {
    type: ControlBarType
    theme: Theme
}

export function ViewControlsHeader(props: Props): JSX.Element {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                height: 40,
                color: props.theme.color,
                paddingLeft: 10
            }}
        >
            View Controls
        </div>
    )
}
