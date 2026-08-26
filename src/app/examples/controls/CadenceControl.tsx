import {type CSSProperties, type JSX, useState} from "react";
import type {Theme} from "../../ui/Themes.ts";

const inputStyle = (theme: Theme, disabled: boolean): CSSProperties => ({
    backgroundColor: disabled ? theme.disabledBackgroundColor : theme.backgroundColor,
    outlineStyle: 'none',
    borderColor: disabled ? theme.disabledColor : theme.color,
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 3,
    color: disabled ? theme.disabledColor : theme.color,
    fontSize: 12,
    padding: 4,
    height: 20,
    width: 40,
})

type Props = {
    theme: Theme
    cadence: number
    handleCadenceChange: (cadence: number) => void
    disabled: boolean
}

/**
 * Text field for setting the plot's update-cadence period (`withCadenceOf`, in milliseconds) --
 * a periodic redraw tick that keeps the plot scrolling even when no new data has arrived. A value
 * of `0` disables the cadence (the plot only redraws when new data arrives). Only meant to be
 * changed while the chart isn't running (see the `disabled` prop).
 */
export function CadenceControl(props: Props): JSX.Element {
    const {theme, cadence, handleCadenceChange, disabled} = props

    // holds the raw text so the field can reflect what's being typed (including transient
    // invalid states, like a temporarily empty field) without immediately reverting
    const [text, setText] = useState<string>(String(cadence))

    // keep the field in sync when the cadence changes from elsewhere (e.g. reset), adjusting
    // state during render rather than in an effect (see "Adjusting some state when a prop
    // changes" in the React docs) -- this avoids the extra commit+effect round trip
    const [prevCadence, setPrevCadence] = useState<number>(cadence)
    if (cadence !== prevCadence) {
        setPrevCadence(cadence)
        setText(String(cadence))
    }

    function handleChange(value: string): void {
        setText(value)
        const parsed = Number(value)
        if (Number.isInteger(parsed) && parsed >= 0) {
            handleCadenceChange(parsed)
        }
    }

    return (
        <label style={{
            color: disabled ? theme.disabledColor : theme.color,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
        }}>
            Cadence (ms)
            <input
                type="text"
                value={text}
                onChange={event => handleChange(event.currentTarget.value)}
                style={inputStyle(theme, disabled)}
                disabled={disabled}
            />
        </label>
    )
}
