import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import App from './app/App';
import About from './pages/About';
import WidgetsHub from './pages/WidgetsHub';
import PollPage from './pages/widgets/PollPage';
import QuestionsPage from './pages/widgets/QuestionsPage';
import FeedbackPage from './pages/widgets/FeedbackPage';
import HandoutPage from './pages/widgets/HandoutPage';

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

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element');
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/about" element={<About />} />
          <Route path="/widgets" element={<WidgetsHub />} />
          <Route path="/widgets/poll" element={<PollPage />} />
          <Route path="/widgets/questions" element={<QuestionsPage />} />
          <Route path="/widgets/feedback" element={<FeedbackPage />} />
          <Route path="/widgets/handout" element={<HandoutPage />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);