import {type CSSProperties, type JSX} from "react";
import type {Theme} from "../../ui/Themes.ts";

const inputStyle = (theme: Theme): CSSProperties => ({
    backgroundColor: theme.backgroundColor,
    outlineStyle: 'none',
    borderColor: theme.color,
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 3,
    color: theme.color,
    fontSize: 12,
    padding: 4,
    margin: 6,
    marginRight: 20
})

type Props = {
    theme: Theme
    filterValue: string
    handleFilterUpdate: (value: string) => void
}

export function SeriesFilter(props: Props): JSX.Element {
    const {theme, filterValue, handleFilterUpdate} = props;
    return (
        <label style={{color: theme.color}}>
            <input
                type="text"
                value={filterValue}
                onChange={event => handleFilterUpdate(event.currentTarget.value)}
                style={inputStyle(theme)}
                placeholder="RegEx filter"
            />
        </label>

    )
}