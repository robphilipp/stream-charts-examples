// this file intentionally exports both the provider component and the useTheme hook that share
// the context, so fast-refresh's "only export components" rule doesn't apply here
/* eslint-disable react-refresh/only-export-components */
import {createContext, type JSX, useContext, useMemo, useState} from "react";
import {lightTheme, type Theme} from "./Themes.ts";

/**
 * The value held by the {@link ThemeContext}: the current theme and a setter for it.
 */
export interface ThemeContextValue {
    theme: Theme
    setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

type Props = {
    // the initial theme (defaults to the light theme)
    initialTheme?: Theme
    children: JSX.Element | Array<JSX.Element>
}

/**
 * Holds the light/dark theme state above the router so that it persists across navigation
 * and toggling it doesn't create browser-history entries. Route components read the theme
 * with {@link useTheme} and hand it down to the charts.
 * @param props The properties
 * @return The children wrapped in the theme context provider
 */
export function ThemeProvider(props: Props): JSX.Element {
    const {initialTheme = lightTheme, children} = props
    const [theme, setTheme] = useState<Theme>(initialTheme)

    const value = useMemo<ThemeContextValue>(() => ({theme, setTheme}), [theme])

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Hook for reading the current theme and its setter from the {@link ThemeProvider}.
 * @return The current theme and a setter for updating it
 * @throws Error when used outside a {@link ThemeProvider}
 */
export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext)
    if (context === undefined) {
        throw new Error("useTheme() must be used within a <ThemeProvider>")
    }
    return context
}
