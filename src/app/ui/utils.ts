import {Theme} from "./Themes";
import {CSSProperties} from "react";

export function interpolateColor(
    startColor: string,
    endColor: string,
    factor: number
): string {
    return `color-mix(in srgb, ${startColor}, ${endColor} ${factor}%)`;
}

export function buttonStyle(theme: Theme): CSSProperties {
    return {
        backgroundColor: interpolateColor(theme.backgroundColor, theme.color, 5),
        borderColor: interpolateColor(theme.color, theme.backgroundColor, 85),
        color: theme.color,
        borderRadius: 7,
        margin: 6,
    };
}