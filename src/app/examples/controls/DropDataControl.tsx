import {type JSX, useState} from "react";
import {DEFAULT_DROP_AFTER, DROP_DATA_AFTER_MS} from "../dropDataAfter.ts";
import type {Theme} from "../../ui/Themes.ts";

type Props = {
    theme: Theme
    handleDropAfterChange: (millis: number) => void
    disabled: boolean
}

export function DropDataControl(props: Props): JSX.Element {
    const {
        theme,
        handleDropAfterChange,
        disabled
    } = props

    const [selectedDropAfterName, setSelectedDropAfterName] = useState<string>(DEFAULT_DROP_AFTER[0])

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