import {type JSX, useState} from "react";
import {
    DROP_AFTER_20_SEC,
    DROP_DATA_AFTER_MS,
    type DropAfterOptions
} from "../dropDataAfter.ts";
import type {Theme} from "../Themes.ts";

type Props = {
    theme: Theme
    initialValue?: DropAfterOptions
    handleDropAfterChange: (millis: number) => void
    disabled: boolean
}

export function DropDataControl(props: Props): JSX.Element {
    const {
        theme,
        initialValue = DROP_AFTER_20_SEC,
        handleDropAfterChange,
        disabled
    } = props

    const [selectedDropAfterName, setSelectedDropAfterName] = useState<string>(initialValue.description!)

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
                setSelectedDropAfterName(event.currentTarget.value)
                handleDropAfterChange(dropAfter)
            }}
            value={selectedDropAfterName}
            disabled={disabled}
        >
            {Array.from(DROP_DATA_AFTER_MS.entries()).map(([name, ]) => (
                <option key={name} value={name}>{name}</option>
            ))}
        </select>

    )
}