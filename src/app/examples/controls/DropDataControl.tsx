import {type JSX} from "react";
import {DROP_DATA_AFTER_MS, type DropAfterOptions} from "../options/dropDataAfter.ts";
import type {Theme} from "../../ui/Themes.ts";

type Props = {
    theme: Theme
    value: DropAfterOptions
    handleDropAfterChange: (millis: number) => void
    disabled: boolean
}

export function DropDataControl(props: Props): JSX.Element {
    const {
        theme,
        value,
        handleDropAfterChange,
        disabled
    } = props

    return (
        <select
            name="drop_after"
            style={{
                backgroundColor: disabled ? theme.disabledBackgroundColor : theme.backgroundColor,
                color: disabled ? theme.disabledColor : theme.color,
                borderColor: disabled ? theme.disabledColor : theme.color,
                padding: 5,
                borderRadius: 3,
                outlineStyle: 'none'
            }}
            onChange={event => {
                const dropAfter = DROP_DATA_AFTER_MS.get(event.currentTarget.value) || Infinity
                handleDropAfterChange(dropAfter)
            }}
            value={value.description}
            disabled={disabled}
        >
            {Array.from(DROP_DATA_AFTER_MS.entries()).map(([name, ]) => (
                <option key={name} value={name}>{name}</option>
            ))}
        </select>

    )
}