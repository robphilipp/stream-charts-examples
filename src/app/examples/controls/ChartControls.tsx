import {type JSX} from "react";
import type {ControlBarType} from "../../ui/ExpandableControlBar.tsx";

type Props = {
    type: ControlBarType
    children: JSX.Element | Array<JSX.Element>
}

export function ChartControls(props: Props): JSX.Element {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            flexDirection: 'column',
            gap: 10,
            padding: 10
        }}>
            {props.children}
        </div>
    )
}