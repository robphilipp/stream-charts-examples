import {type JSX} from "react";
import {LegendLocation} from "../../charts/legends/constants.ts";
import type {Theme} from "../../ui/Themes.ts";
import type {Visibility} from "../visibility.ts";
import {LEGEND_LOCATIONS} from "../legendLocations.ts";

export const EXTERNAL_LEGEND_WIDTH = 100
export const LEGEND_ANIMATION_DURATION_MS = 220

type Props = {
    theme: Theme
    visibility: Visibility
    legendLocation: LegendLocation
    setLegendLocation: (location: LegendLocation) => void
}

export function LegendControl(props: Props): JSX.Element {
    const {
        theme,
        visibility,
        legendLocation,
        setLegendLocation
    } = props

    return (
        <label style={{color: theme.color}}><span style={{marginLeft: 10, paddingRight: 10}}>Legend Location</span>
            <select
                name="legend-location"
                style={{
                    backgroundColor: visibility.legend ? theme.backgroundColor : theme.disabledBackgroundColor,
                    color: visibility.legend ? theme.color : theme.disabledColor,
                    borderColor: visibility.legend ? theme.color : theme.disabledColor,
                    padding: 5,
                    borderRadius: 3,
                    outlineStyle: 'none',
                }}
                onChange={event => setLegendLocation(event.currentTarget.value as LegendLocation)}
                value={legendLocation}
                disabled={!visibility.legend}
            >
                {Array.from(LEGEND_LOCATIONS.entries()).map(([name, value]) => (
                    <option key={name} value={value}>{name}</option>
                ))}
            </select>
        </label>
    )
}