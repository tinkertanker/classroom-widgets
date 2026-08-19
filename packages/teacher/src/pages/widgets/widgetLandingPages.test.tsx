import { describe, expect, it } from 'vitest';
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';

import { widgetLandingPages, type WidgetLandingPageConfig } from './widgetLandingPages';
import FeedbackPage from './FeedbackPage';
import HandoutPage from './HandoutPage';
import ListPage from './ListPage';
import PollPage from './PollPage';
import QrCodePage from './QrCodePage';
import QuestionsPage from './QuestionsPage';
import RandomiserPage from './RandomiserPage';
import SoundEffectsPage from './SoundEffectsPage';
import TaskCuePage from './TaskCuePage';
import TextBannerPage from './TextBannerPage';
import TimerPage from './TimerPage';
import TrafficLightPage from './TrafficLightPage';

/**
 * Each entry pairs the routed page component with the config entry it is supposed
 * to render, so a page wired to the wrong config fails here rather than in production.
 */
const ROUTED_PAGES: Array<{
  name: string;
  route: string;
  Page: React.FC;
  config: WidgetLandingPageConfig;
}> = [
  { name: 'FeedbackPage', route: '/widgets/feedback', Page: FeedbackPage, config: widgetLandingPages.feedback },
  { name: 'HandoutPage', route: '/widgets/handout', Page: HandoutPage, config: widgetLandingPages.handout },
  { name: 'ListPage', route: '/widgets/list', Page: ListPage, config: widgetLandingPages.list },
  { name: 'PollPage', route: '/widgets/poll', Page: PollPage, config: widgetLandingPages.poll },
  { name: 'QrCodePage', route: '/widgets/qr-code', Page: QrCodePage, config: widgetLandingPages.qrCode },
  { name: 'QuestionsPage', route: '/widgets/questions', Page: QuestionsPage, config: widgetLandingPages.questions },
  { name: 'RandomiserPage', route: '/widgets/randomiser', Page: RandomiserPage, config: widgetLandingPages.randomiser },
  { name: 'SoundEffectsPage', route: '/widgets/sound-effects', Page: SoundEffectsPage, config: widgetLandingPages.soundEffects },
  { name: 'TaskCuePage', route: '/widgets/task-cue', Page: TaskCuePage, config: widgetLandingPages.taskCue },
  { name: 'TextBannerPage', route: '/widgets/text-banner', Page: TextBannerPage, config: widgetLandingPages.textBanner },
  { name: 'TimerPage', route: '/widgets/timer', Page: TimerPage, config: widgetLandingPages.timer },
  { name: 'TrafficLightPage', route: '/widgets/traffic-light', Page: TrafficLightPage, config: widgetLandingPages.trafficLight },
];

const renderPage = (Page: React.FC) => {
  const { container } = render(
    <HelmetProvider>
      <Page />
    </HelmetProvider>
  );
  return container;
};

describe('widget landing pages', () => {
  it('covers every configured page exactly once', () => {
    expect(ROUTED_PAGES).toHaveLength(Object.keys(widgetLandingPages).length);
    expect(new Set(ROUTED_PAGES.map((p) => p.config.slug)).size).toBe(ROUTED_PAGES.length);
    // Slugs drive og:url/canonical, so they must stay in step with the routes in index.tsx.
    for (const { route, config } of ROUTED_PAGES) {
      expect(route).toBe(`/widgets/${config.slug}`);
    }
  });

  it('gives every page a distinct heading, lede, how-to heading and meta title', () => {
    const configs = Object.values(widgetLandingPages);
    for (const field of ['heading', 'lede'] as const) {
      expect(new Set(configs.map((c) => c[field])).size).toBe(configs.length);
    }
    expect(new Set(configs.map((c) => c.steps.heading)).size).toBe(configs.length);
    expect(new Set(configs.map((c) => c.meta.title)).size).toBe(configs.length);
  });

  describe.each(ROUTED_PAGES)('$name', ({ Page, config }) => {
    it('renders its own hero, steps, cards and tips', () => {
      const container = renderPage(Page);

      expect(container.querySelector('h2')?.textContent).toBe(config.heading);
      expect(screen.getByText(config.lede)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: config.steps.heading, level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: config.cards.heading, level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: config.tips.heading, level: 3 })).toBeInTheDocument();

      for (const step of config.steps.items) {
        expect(screen.getByText(step.title)).toBeInTheDocument();
        expect(screen.getByText(step.body)).toBeInTheDocument();
      }
      for (const card of config.cards.items) {
        expect(screen.getByText(card.title)).toBeInTheDocument();
        expect(screen.getByText(card.body)).toBeInTheDocument();
      }
      for (const tip of config.tips.items) {
        expect(screen.getByText(tip)).toBeInTheDocument();
      }

      cleanup();
    });

    it('does not render any other page\'s content', () => {
      const container = renderPage(Page);
      const text = container.textContent ?? '';

      for (const other of ROUTED_PAGES) {
        if (other.config.slug === config.slug) continue;
        expect(text).not.toContain(other.config.lede);
        expect(text).not.toContain(other.config.steps.heading);
        expect(container.querySelector('h2')?.textContent).not.toBe(other.config.heading);
      }

      cleanup();
    });

    it('publishes its own canonical URL and page title', async () => {
      renderPage(Page);

      const canonicalUrl = `https://widgets.tk.sg/widgets/${config.slug}`;
      // react-helmet-async applies its head mutations on the next animation frame.
      await waitFor(() => expect(document.title).toBe(config.meta.title));
      expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonicalUrl);
      expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(canonicalUrl);
      expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(config.meta.description);
      expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(config.meta.ogTitle);
      expect(document.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe(config.meta.ogDescription);

      cleanup();
    });
  });
});
