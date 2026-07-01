import {type JSX} from "react";
import {INTERPOLATIONS} from "../interpolations.ts";
import type {Theme} from "../../ui/Themes.ts";

type Props = {
    theme: Theme
    selectedInterpolationName: string
    handleInterpolationChange: (selected: string) => void
}

export function InterpolationControl(props: Props): JSX.Element {
    const {
        theme,
        selectedInterpolationName,
        handleInterpolationChange,
    } = props

    return (
        <label style={{color: theme.color}}><span style={{marginLeft: 10, paddingRight: 10}}>Interpolation</span>
            <select
                name="interpolations"
                style={{
                    backgroundColor: theme.backgroundColor,
                    color: theme.color,
                    borderColor: theme.color,
                    padding: 5,
                    borderRadius: 3,
                    outlineStyle: 'none'
                }}
                onChange={event => handleInterpolationChange(event.currentTarget.value)}
                value={selectedInterpolationName}
            >
                {Array.from(INTERPOLATIONS.entries()).map(([value, [name,]]) => (
                    <option key={value} value={value}>{name}</option>
                ))}
            </select>
        </label>
    )
}