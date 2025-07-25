import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import AppWithContext from './AppWithContext';
import reportWebVitals from './reportWebVitals';

// Feature flag to switch between old and new architecture
const USE_NEW_ARCHITECTURE = import.meta.env.VITE_NEW_ARCH !== 'false';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element');
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    {USE_NEW_ARCHITECTURE ? <App /> : <AppWithContext />}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();