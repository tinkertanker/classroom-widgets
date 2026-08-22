import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const isCompactWidgetPanel = new URLSearchParams(window.location.search).get('surface') === 'widget-panel';

// Load Umami analytics conditionally (only if env vars are set)
const umamiScriptUrl = import.meta.env.VITE_UMAMI_SCRIPT_URL;
const umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;

if (!isCompactWidgetPanel && umamiScriptUrl && umamiWebsiteId) {
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

async function renderApp() {
  if (isCompactWidgetPanel) {
    const { default: CompactWidgetApp } = await import('./features/desktop/CompactWidgetApp');
    root.render(
      <React.StrictMode>
        <CompactWidgetApp />
      </React.StrictMode>
    );
    return;
  }

  const [
    { default: App },
    { HelmetProvider },
    { BrowserRouter, Routes, Route },
  ] = await Promise.all([
    import('./app/App'),
    import('react-helmet-async'),
    import('react-router-dom'),
  ]);

  const About = React.lazy(() => import('./pages/About'));
  const WidgetsHub = React.lazy(() => import('./pages/WidgetsHub'));
  const PollPage = React.lazy(() => import('./pages/widgets/PollPage'));
  const QuestionsPage = React.lazy(() => import('./pages/widgets/QuestionsPage'));
  const FeedbackPage = React.lazy(() => import('./pages/widgets/FeedbackPage'));
  const HandoutPage = React.lazy(() => import('./pages/widgets/HandoutPage'));
  const TimerPage = React.lazy(() => import('./pages/widgets/TimerPage'));
  const RandomiserPage = React.lazy(() => import('./pages/widgets/RandomiserPage'));
  const ListPage = React.lazy(() => import('./pages/widgets/ListPage'));
  const TaskCuePage = React.lazy(() => import('./pages/widgets/TaskCuePage'));
  const TrafficLightPage = React.lazy(() => import('./pages/widgets/TrafficLightPage'));
  const TextBannerPage = React.lazy(() => import('./pages/widgets/TextBannerPage'));
  const QrCodePage = React.lazy(() => import('./pages/widgets/QrCodePage'));
  const SoundEffectsPage = React.lazy(() => import('./pages/widgets/SoundEffectsPage'));

  root.render(
    <React.StrictMode>
      <HelmetProvider>
        <BrowserRouter>
          <React.Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/about" element={<About />} />
              <Route path="/widgets" element={<WidgetsHub />} />
              <Route path="/widgets/poll" element={<PollPage />} />
              <Route path="/widgets/questions" element={<QuestionsPage />} />
              <Route path="/widgets/feedback" element={<FeedbackPage />} />
              <Route path="/widgets/handout" element={<HandoutPage />} />
              <Route path="/widgets/timer" element={<TimerPage />} />
              <Route path="/widgets/randomiser" element={<RandomiserPage />} />
              <Route path="/widgets/list" element={<ListPage />} />
              <Route path="/widgets/task-cue" element={<TaskCuePage />} />
              <Route path="/widgets/traffic-light" element={<TrafficLightPage />} />
              <Route path="/widgets/text-banner" element={<TextBannerPage />} />
              <Route path="/widgets/qr-code" element={<QrCodePage />} />
              <Route path="/widgets/sound-effects" element={<SoundEffectsPage />} />
            </Routes>
          </React.Suspense>
        </BrowserRouter>
      </HelmetProvider>
    </React.StrictMode>
  );
}

void renderApp();
