import {type JSX} from "react";
import type {Theme} from "./Themes.ts";

/**
 * An option in a {@link DropDown}
 * @template V The type of the option's value
 */
export type DropDownOption<V extends string> = {
    /**
     * The value handed to the drop-down's `onChange` when this option is selected
     */
    value: V
    /**
     * The text shown for this option
     */
    label: string
}

type Props<V extends string> = {
    theme: Theme
    /**
     * The name of the underlying form control
     */
    name: string
    /**
     * The options, in the order they're listed
     */
    options: Array<DropDownOption<V>>
    /**
     * The value of the selected option
     */
    value: V
    /**
     * Called with the value of the option the user selects
     * @param value The selected option's value
     */
    onChange: (value: V) => void
    /**
     * When `true`, the drop-down is shown in the theme's disabled colors and can't be changed.
     * Defaults to `false`.
     */
    disabled?: boolean
}

/**
 * A themed drop-down (select) control
 * @param props The properties
 * @return The drop-down
 * @template V The type of the options' values
 */
export function DropDown<V extends string>(props: Props<V>): JSX.Element {
    const {
        theme,
        name,
        options,
        value,
        onChange,
        disabled = false,
    } = props

    return (
        <select
            name={name}
            style={{
                backgroundColor: disabled ? theme.disabledBackgroundColor : theme.backgroundColor,
                color: disabled ? theme.disabledColor : theme.color,
                borderColor: disabled ? theme.disabledColor : theme.color,
                padding: 5,
                borderRadius: 3,
                outlineStyle: 'none'
            }}
            // the selected value is always one of the options' values, since those are the only
            // values the select offers
            onChange={event => onChange(event.currentTarget.value as V)}
            value={value}
            disabled={disabled}
        >
            {options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    )
}
