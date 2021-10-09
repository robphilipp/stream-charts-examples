import React from 'react';
import ReactDOM from 'react-dom';
import './styles/index.css';
import App from './app/App';
import {WindowDimensionsProvider} from "react-resizable-grid-layout"

ReactDOM.render(
    <WindowDimensionsProvider>
        <App />
    </WindowDimensionsProvider>,
    document.getElementById('root')
);
