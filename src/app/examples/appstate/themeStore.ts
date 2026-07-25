import {create} from 'zustand'
import {lightTheme, type Theme} from "../Themes.ts";

interface ThemeStore {
    theme: Theme,
    updateTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeStore>()(set => ({
    theme: lightTheme,
    updateTheme: (theme: Theme) => set({theme})
}))