import React from 'react';
import ReactDOM from 'react-dom/client';
// Self-hosted web fonts. Browsers fetch a face only when text uses it, so the
// Text Banner families cost nothing until a banner shows them.
import '@shared/assets/fonts/poppins.css';
import '@shared/assets/fonts/lora.css';
import '@shared/assets/fonts/roboto-slab.css';
import '@shared/assets/fonts/jetbrains-mono.css';
import './index.css';
import { redirectFirstVisitToLanding, rememberLandingSeen } from './app/firstVisit';

const surface = new URLSearchParams(window.location.search).get('surface');
const isCompactWidgetPanel = surface === 'widget-panel';
const isDesktopWidgetLauncher = surface === 'widget-launcher';
// Must run before App is imported: the workspace store writes its storage key on load.
const redirectedToLanding = redirectFirstVisitToLanding();

// Load Umami analytics conditionally (only if env vars are set)
const umamiScriptUrl = import.meta.env.VITE_UMAMI_SCRIPT_URL;
const umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;

if (!surface && umamiScriptUrl && umamiWebsiteId) {
  const script = document.createElement('script');
  script.defer = true;
  script.src = umamiScriptUrl;
  script.dataset.websiteId = umamiWebsiteId;
  if (redirectedToLanding) {
    // Umami has no pre-load queue; window.umami exists once the script has run.
    script.addEventListener('load', () => window.umami?.track('first-visit-redirect'));
  }
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

  if (isDesktopWidgetLauncher) {
    const { default: DesktopWidgetLauncher } = await import('./features/desktop/DesktopWidgetLauncher');
    root.render(
      <React.StrictMode>
        <DesktopWidgetLauncher />
      </React.StrictMode>
    );
    return;
  }

  // The board (also every desktop dashboard host) needs neither the router nor
  // Helmet: its only route is `/`, and index.html already carries its tags.
  if (window.location.pathname === '/') {
    const { default: App } = await import('./app/App');
    root.render(
      <React.StrictMode>
        <React.Suspense fallback={null}>
          <App />
        </React.Suspense>
      </React.StrictMode>
    );
    return;
  }

  rememberLandingSeen();
  const [
    { Helmet, HelmetProvider },
    { BrowserRouter, Routes, Route },
  ] = await Promise.all([
    import('react-helmet-async'),
    import('react-router-dom'),
  ]);

  const App = React.lazy(() => import('./app/App'));
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

  // index.html's data-rh tags are crawler defaults. Re-declare them through Helmet so
  // page-level tags replace them instead of being appended after them.
  const defaultMeta = Array.from(
    document.head.querySelectorAll<HTMLMetaElement>('meta[data-rh]'),
    (el) => (el.name ? { name: el.name, content: el.content } : { property: el.getAttribute('property')!, content: el.content }),
  );

  root.render(
    <React.StrictMode>
      <HelmetProvider>
        <Helmet meta={defaultMeta} />
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
