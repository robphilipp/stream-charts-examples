import App from './app/App'
import './styles/index.css'
import {WindowDimensionsProvider} from "react-resizable-grid-layout"
import {createRoot} from "react-dom/client"
import {StrictMode} from "react";

const domNode = document.getElementById('root')
const root = createRoot(domNode!)

root.render(
    <StrictMode>
        <WindowDimensionsProvider>
            <App/>
        </WindowDimensionsProvider>
    </StrictMode>
)
