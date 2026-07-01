import {type JSX, useState} from "react";
import {DEFAULT_DROP_AFTER, DROP_DATA_AFTER_SECONDS} from "../dropDataAfter.ts";
import type {Theme} from "../../ui/Themes.ts";

type Props = {
    theme: Theme
    // selectedDropAfterName: string
    handleDropAfterChange: (name: string) => void
    disabled: boolean
}

export function DropDataControl(props: Props): JSX.Element {
    const {
        theme,
        // selectedDropAfterName,
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
                setSelectedDropAfterName(event.currentTarget.value)
                handleDropAfterChange(event.currentTarget.value)
            }}
            value={selectedDropAfterName}
            disabled={disabled}
        >
            {Array.from(DROP_DATA_AFTER_SECONDS.entries()).map(([name, ]) => (
                <option key={name} value={name}>{name}</option>
            ))}
        </select>

    )
}