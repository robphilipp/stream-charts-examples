import {type JSX} from "react";
import {LegendLocation} from "../../charts/legends/constants.ts";
import type {Theme} from "../../ui/Themes.ts";
import {LEGEND_LOCATIONS} from "../options/legendLocations.ts";
import Checkbox from "../../ui/Checkbox.tsx";

export const EXTERNAL_LEGEND_WIDTH = 100
export const LEGEND_ANIMATION_DURATION_MS = 220

type Props = {
    theme: Theme
    visibility: boolean
    setVisibility: (visibility: boolean) => void
    legendLocation: LegendLocation
    setLegendLocation: (location: LegendLocation) => void
}

export function LegendControl(props: Props): JSX.Element {
    const {
        theme,
        visibility,
        setVisibility,
        legendLocation,
        setLegendLocation
    } = props

    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            alignContent: 'center',
            flexDirection: 'row',
            gap: 5,
        }}>
            <label style={{color: theme.color}}>
                <Checkbox
                    key={3}
                    checked={visibility}
                    label="legend"
                    backgroundColor={theme.backgroundColor}
                    borderColor={theme.color}
                    labelColor={theme.color}
                    onChange={() => setVisibility(!visibility)}
                />
                <span style={{paddingRight: 10}}></span>
                <select
                    name="legend-location"
                    style={{
                        backgroundColor: visibility ? theme.backgroundColor : theme.disabledBackgroundColor,
                        color: visibility ? theme.color : theme.disabledColor,
                        borderColor: visibility ? theme.color : theme.disabledColor,
                        padding: 5,
                        borderRadius: 3,
                        outlineStyle: 'none',
                    }}
                    onChange={event => setLegendLocation(event.currentTarget.value as LegendLocation)}
                    value={legendLocation}
                    disabled={!visibility}
                >
                    {Array.from(LEGEND_LOCATIONS.entries()).map(([name, value]) => (
                        <option key={name} value={value}>{name}</option>
                    ))}
                </select>
            </label>
        </div>
    )
}