import {type JSX} from "react";
import {formatTime} from "stream-charts";
import type {Theme} from "../Themes.ts";

type Props = {
    theme: Theme
    lag: number
}

export function LagDisplay(props: Props): JSX.Element {
    const {theme, lag} = props;
    return (
        <div style={{color: theme.color}}>
            Update Lag: {formatTime(Math.max(0, lag))} ms
        </div>
    )
}