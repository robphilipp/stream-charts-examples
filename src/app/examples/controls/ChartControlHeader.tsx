import type {ControlBarType} from "../../ui/ExpandableControlBar.tsx";
import type {Theme} from "../Themes.ts";
import type {JSX} from "react";

type Props = {
    type: ControlBarType
    theme: Theme
    // title: string
    children: JSX.Element | Array<JSX.Element>
}

export function ChartControlsHeader(props: Props): JSX.Element {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            height: 40,
            color: props.theme.color,
            gap: 10
        }}>
            {props.children}
        </div>
    )
}
