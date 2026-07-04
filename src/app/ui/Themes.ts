export interface Theme {
    name: 'dark' | 'light'
    color: string
    backgroundColor: string
    disabledColor: string
    disabledBackgroundColor: string
}

export const darkTheme: Theme = {
    name: 'dark',
    color: '#bcbcb7',
    backgroundColor: '#100f0c',
    disabledColor: '#b2b0b0',
    disabledBackgroundColor: '#3e3d3d'
}

export const lightTheme: Theme = {
    name: 'light',
    color: '#100f0c',
    backgroundColor: '#efefea',
    disabledColor: '#989797',
    disabledBackgroundColor: '#cccaca'
}