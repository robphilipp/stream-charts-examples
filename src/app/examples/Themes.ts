export interface Theme {
    name: 'dark' | 'light'
    color: string
    backgroundColor: string
}

export const darkTheme: Theme = {
    name: 'dark',
    color: '#d2933f',
    backgroundColor: '#202020'
}

export const lightTheme: Theme = {
    name: 'light',
    color: '#202020',
    backgroundColor: '#eee'
}