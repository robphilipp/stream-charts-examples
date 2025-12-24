import React, {StrictMode} from 'react';
import './styles/index.css';
import App from './app/App';
import {WindowDimensionsProvider} from "react-resizable-grid-layout"
import {createRoot} from "react-dom/client";

const domNode = document.getElementById('root');
const root = createRoot(domNode!);

root.render(
    // <StrictMode>
        <WindowDimensionsProvider>
            <App/>
        </WindowDimensionsProvider>
    // </StrictMode>
)
