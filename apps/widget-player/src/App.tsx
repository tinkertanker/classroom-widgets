import { useEffect, useState } from 'react';
import { isWidgetSpec, WIDGET_SPEC_VERSION, type WidgetSpec } from '@classroom-widgets/widget-spec';

import { installWidgetPlayerBridge, postStudioBridgeMessage } from './bridge';
import { retrievalPracticeFixture } from './fixtures/retrievalPractice';
import { PlayerErrorBoundary } from './PlayerErrorBoundary';
import { PlayerError, WidgetPlayer } from './WidgetPlayer';

type PlayerState =
  | { status: 'ready'; spec: WidgetSpec; revision: number }
  | { status: 'loading' }
  | { status: 'waiting' }
  | { status: 'error'; title: string; message: string };

function initialState(slug: string | undefined): PlayerState {
  if (isWidgetSpec(window.__CLASSROOM_WIDGET_SPEC__)) {
    return { status: 'ready', spec: window.__CLASSROOM_WIDGET_SPEC__, revision: 0 };
  }
  if (slug) {
    return { status: 'loading' };
  }
  if (isLocalRoot()) {
    return { status: 'ready', spec: retrievalPracticeFixture, revision: 0 };
  }
  return { status: 'waiting' };
}

export function App() {
  const pathname = window.location.pathname;
  const legalPage = legalPageForPath(pathname);
  const slug = legalPage ? undefined : publicationSlug(pathname);
  const [state, setState] = useState<PlayerState>(() => initialState(slug));
  const apiBaseUrl = trustedApiBaseUrl();

  useEffect(
    () =>
      installWidgetPlayerBridge((spec) => {
        setState((current) => ({
          status: 'ready',
          spec,
          revision: current.status === 'ready' ? current.revision + 1 : 1,
        }));
      }),
    [],
  );

  useEffect(() => {
    postStudioBridgeMessage({
      type: 'ready',
      schemaVersion: WIDGET_SPEC_VERSION,
    });
  }, []);

  useEffect(() => {
    if (state.status === 'ready' && state.revision > 0) {
      postStudioBridgeMessage({ type: 'loaded' });
    }
  }, [state]);

  useEffect(() => {
    setState(initialState(slug));
  }, [pathname, slug]);

  useEffect(() => {
    if (legalPage || !slug || state.status !== 'loading') return;

    const controller = new AbortController();
    void loadPublication(apiBaseUrl, slug, controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setState(result);
      }
    });

    return () => controller.abort();
  }, [apiBaseUrl, legalPage, slug, state.status]);

  if (legalPage) return <LegalPage page={legalPage} />;

  if (state.status === 'loading') {
    return (
      <main className="player-shell player-error-page" aria-busy="true">
        <p className="player-loading" role="status">
          Opening your widget…
        </p>
      </main>
    );
  }

  if (state.status === 'waiting') {
    return (
      <PlayerError
        title="Waiting for a widget"
        message="Open a published Classroom Widgets link, or return to Studio and try the preview again."
      />
    );
  }

  if (state.status === 'error') {
    return <PlayerError title={state.title} message={state.message} />;
  }

  return (
    <PlayerErrorBoundary key={`${state.spec.id}:${state.revision}`}>
      <WidgetPlayer
        spec={state.spec}
        assetBaseUrl={
          window.__CLASSROOM_WIDGET_ASSET_BASE_URL__ ??
          apiUrl(
            apiBaseUrl,
            slug
              ? `/v1/publications/${encodeURIComponent(slug)}/assets/`
              : '/v1/assets/',
          )
        }
        reportEndpoint={
          slug
            ? apiUrl(
                apiBaseUrl,
                `/v1/publications/${encodeURIComponent(slug)}/reports`,
              )
            : undefined
        }
      />
    </PlayerErrorBoundary>
  );
}

type LegalPageName = 'privacy' | 'terms';

function legalPageForPath(pathname: string): LegalPageName | undefined {
  if (pathname === '/privacy' || pathname === '/privacy/') return 'privacy';
  if (pathname === '/terms' || pathname === '/terms/') return 'terms';
  return undefined;
}

function LegalPage({ page }: { page: LegalPageName }) {
  const privacy = page === 'privacy';
  useEffect(() => {
    document.title = privacy
      ? 'Privacy — Classroom Widgets Studio'
      : 'Terms — Classroom Widgets Studio';
  }, [privacy]);

  return (
    <main className="legal-shell">
      <article className="legal-page">
        <p className="legal-product">Classroom Widgets Studio</p>
        <h1>{privacy ? 'Privacy notice' : 'Terms of use'}</h1>
        <p className="legal-updated">Last updated 18 July 2026</p>
        {privacy ? <PrivacyContent /> : <TermsContent />}
        <nav aria-label="Legal pages">
          <a href={privacy ? '/terms' : '/privacy'}>
            {privacy ? 'Terms of use' : 'Privacy notice'}
          </a>
          <a href="https://tinkertanker.com/">Contact Tinkertanker</a>
        </nav>
      </article>
    </main>
  );
}

function PrivacyContent() {
  return (
    <>
      <section>
        <h2>Who operates Studio</h2>
        <p>
          Classroom Widgets Studio is operated by Tinkertanker Pte. Ltd. in Singapore. This
          notice covers the iPad authoring app, Studio service and published student widgets.
        </p>
      </section>
      <section>
        <h2>Teacher-created information</h2>
        <p>
          Studio processes approved lesson briefs, widget specifications, optional processed
          images, publication details and a pseudonymous ownership credential so teachers can
          edit or revoke their links. Do not enter pupil names, contact details, identity numbers
          or other personal student information.
        </p>
      </section>
      <section>
        <h2>Service providers</h2>
        <p>
          Trusted service providers process teacher text for generation and safety checks, and
          provide hosting, storage, delivery, abuse protection and image review. Content may be
          processed outside Singapore under those providers’ applicable terms and safeguards.
        </p>
      </section>
      <section>
        <h2>Students</h2>
        <p>
          Published widgets require no account, set no tracking cookie and contain no behavioural
          analytics. Answers and interaction state remain in the browser and are not submitted to
          Studio. Our delivery provider still processes ordinary network requests needed to
          deliver and protect the page. A safety report contains only a fixed concern category,
          not free text.
        </p>
      </section>
      <section>
        <h2>Retention and control</h2>
        <p>
          Published links expire after 90 days by default and can be extended or revoked. Inactive
          unpublished drafts are eligible for deletion after 180 days. Daily abuse-control hashes
          are removed after 14 days; content reports after 180 days. Teachers can delete a widget
          from the originating installation, which also removes its server draft and publication.
        </p>
      </section>
      <section>
        <h2>Questions or deletion requests</h2>
        <p>
          Use the contact link below. Include the widget link or publication slug, but never send
          student personal information.
        </p>
      </section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <section>
        <h2>Teacher responsibility</h2>
        <p>
          Studio assists teachers; it does not replace professional judgement. Review and test
          every widget for accuracy, age suitability, accessibility and classroom fit before
          sharing it with students.
        </p>
      </section>
      <section>
        <h2>Permitted use</h2>
        <p>
          Use Studio for lawful educational activities. Do not upload personal student data,
          identifiable pupil images, confidential material, infringing content or unsafe content.
          Do not attempt to bypass quotas, ownership controls, validation or moderation.
        </p>
      </section>
      <section>
        <h2>Links and availability</h2>
        <p>
          A widget link is unlisted, not access-controlled. Anyone with the link may open it until
          it expires or is revoked. Keep a source copy of important teaching material. Pilot
          features may change and the service may be suspended to protect users or repair faults.
        </p>
      </section>
      <section>
        <h2>Generated content</h2>
        <p>
          Generated content can be incomplete or inaccurate. You are responsible for rights to
          source material and images you provide and for confirming that the finished activity is
          suitable for your intended learners.
        </p>
      </section>
      <section>
        <h2>Reporting</h2>
        <p>
          Use “Report this widget” on a published activity to flag inappropriate content, personal
          data, copyright or accessibility concerns. Tinkertanker may restrict or remove content
          that breaches these terms.
        </p>
      </section>
    </>
  );
}

async function loadPublication(
  apiBaseUrl: string,
  slug: string,
  signal: AbortSignal,
): Promise<PlayerState> {
  let response: Response;
  try {
    response = await fetch(
      apiUrl(apiBaseUrl, `/v1/publications/${encodeURIComponent(slug)}`),
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        signal,
      },
    );
  } catch {
    return {
      status: 'error',
      title: 'This widget could not be opened',
      message: 'Check your connection, then reload the page.',
    };
  }

  if (response.status === 404) {
    return {
      status: 'error',
      title: 'Widget not found',
      message: 'Check the link with your teacher. It may have been typed incorrectly.',
    };
  }
  if (response.status === 410) {
    return {
      status: 'error',
      title: 'This widget is no longer available',
      message: 'The link has expired or the teacher has unpublished it.',
    };
  }
  if (!response.ok) {
    return {
      status: 'error',
      title: 'This widget is temporarily unavailable',
      message: 'Please try again in a moment.',
    };
  }

  try {
    const payload: unknown = await response.json();
    const candidate = publicationSpec(payload);
    return candidate
      ? { status: 'ready', spec: candidate, revision: 0 }
      : {
          status: 'error',
          title: 'This widget cannot be displayed',
          message: 'Ask the teacher to open it in Studio and publish it again.',
        };
  } catch {
    return {
      status: 'error',
      title: 'This widget cannot be displayed',
      message: 'Ask the teacher to open it in Studio and publish it again.',
    };
  }
}

function publicationSpec(payload: unknown): WidgetSpec | undefined {
  if (isWidgetSpec(payload)) return payload;
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }
  const nested = Reflect.get(payload, 'spec');
  return isWidgetSpec(nested) ? nested : undefined;
}

function publicationSlug(pathname: string): string | undefined {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 1) return undefined;
  const candidate = segments[0];
  if (!candidate || candidate === 'index.html') return undefined;
  return /^[A-Za-z0-9_-]{6,128}$/.test(candidate) ? candidate : undefined;
}

function trustedApiBaseUrl(): string {
  return (
    window.__CLASSROOM_WIDGET_API_BASE_URL__ ??
    import.meta.env.VITE_STUDIO_API_BASE_URL ??
    (window.location.protocol === 'http:' || window.location.protocol === 'https:'
      ? window.location.origin
      : 'https://invalid.local')
  );
}

function apiUrl(baseUrl: string, path: string): string {
  try {
    const base = new URL(baseUrl);
    if (base.protocol !== 'https:' && base.protocol !== 'http:') {
      throw new Error('Unsupported Studio API protocol.');
    }
    return new URL(path.replace(/^\//, ''), `${base.toString().replace(/\/$/, '')}/`).toString();
  } catch {
    return `https://invalid.local${path}`;
  }
}

function isLocalRoot(): boolean {
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  return localHosts.has(window.location.hostname) && window.location.pathname === '/';
}
