import {type JSX} from "react";
import {INTERPOLATIONS} from "../options/interpolations.ts";
import type {Theme} from "../../ui/Themes.ts";
import {DropDown, type DropDownOption} from "../../ui/DropDown.tsx";

// the interpolations, valued by their curve's name (e.g. "curveLinear") and labelled with a
// display name (e.g. "Linear")
const OPTIONS: Array<DropDownOption<string>> = Array.from(INTERPOLATIONS.entries())
    .map(([value, [label,]]) => ({value, label}))

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
        <label style={{color: theme.color}}>
            <DropDown
                theme={theme}
                name="interpolations"
                options={OPTIONS}
                value={selectedInterpolationName}
                onChange={handleInterpolationChange}
            />
            <span style={{paddingLeft: 10}}>Interpolation</span>
        </label>
    )
}