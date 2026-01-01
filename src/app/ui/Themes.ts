export interface Theme {
    name: 'dark' | 'light'
    color: string
    backgroundColor: string
    disabledColor: string
    disabledBackgroundColor: string
}

export const darkTheme: Theme = {
    name: 'dark',
    color: '#eee',
    backgroundColor: '#202020',
    disabledColor: '#b2b0b0',
    disabledBackgroundColor: '#3e3d3d'
}

export const lightTheme: Theme = {
    name: 'light',
    color: '#202020',
    backgroundColor: '#eee',
    disabledColor: '#575656',
    disabledBackgroundColor: '#cccaca'
}