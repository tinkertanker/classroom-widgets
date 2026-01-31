import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Load Umami analytics conditionally (only if env vars are set)
const umamiScriptUrl = import.meta.env.VITE_UMAMI_SCRIPT_URL;
const umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;

if (umamiScriptUrl && umamiWebsiteId) {
  const script = document.createElement('script');
  script.defer = true;
  script.src = umamiScriptUrl;
  script.dataset.websiteId = umamiWebsiteId;
  document.head.appendChild(script);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);