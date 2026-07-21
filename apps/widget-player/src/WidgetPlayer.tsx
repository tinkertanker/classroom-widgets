import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { WidgetComponent, WidgetSpec } from '@classroom-widgets/widget-spec';

import { ComponentRenderer, type AssetResolver } from './components';
import { localeUsesLanguage, playerCopy } from './localisation';
import {
  hasCompleteResponse,
  initialRuntimeValues,
  isAssessableComponent,
  isCorrectResponse,
  questionNumberMap,
  type ComponentResponse,
  type ComponentResponses,
  type RuntimeValue,
} from './runtime';

export interface WidgetPlayerProps {
  /** A specification that has already passed widget-spec validation. */
  spec: WidgetSpec;
  /** Trusted Studio API route. Authored specifications cannot override it. */
  assetBaseUrl?: string;
  /** Anonymous, fixed-choice safety report route for a published widget. */
  reportEndpoint?: string;
  className?: string;
}

export function WidgetPlayer({
  spec,
  assetBaseUrl = '/v1/assets/',
  reportEndpoint,
  className = '',
}: WidgetPlayerProps) {
  const [screenIndex, setScreenIndex] = useState(0);
  const [values, setValues] = useState(() => initialRuntimeValues(spec.variables));
  const [responses, setResponses] = useState<ComponentResponses>({});
  const [submitted, setSubmitted] = useState<Set<string>>(() => new Set());
  const numbers = useMemo(() => questionNumberMap(spec), [spec]);
  const resolveAsset = useMemo(() => assetResolver(assetBaseUrl), [assetBaseUrl]);
  const copy = playerCopy(spec.metadata.locale);

  useEffect(() => {
    document.title = spec.metadata.title;
    document.documentElement.lang = spec.metadata.locale ?? 'en';
  }, [spec.metadata.locale, spec.metadata.title]);

  useEffect(() => {
    setScreenIndex(0);
    setValues(initialRuntimeValues(spec.variables));
    setResponses({});
    setSubmitted(new Set());
  }, [spec]);

  const screen = spec.screens[screenIndex];
  if (!screen) {
    return (
      <PlayerError
        title={copy.noPageTitle}
        message={copy.noPageMessage}
        locale={copy.locale}
      />
    );
  }

  const assessable = screen.components.filter(isAssessableComponent);
  const allComplete = assessable.every((component) =>
    hasCompleteResponse(component, responses[component.id]),
  );
  const screenSubmitted =
    assessable.length > 0 && assessable.every((component) => submitted.has(component.id));
  const score = assessable.filter((component) =>
    isCorrectResponse(component, responses[component.id]),
  ).length;

  function updateResponse(componentId: string, response: ComponentResponse) {
    setResponses((current) => ({ ...current, [componentId]: response }));
  }

  function updateVariable(variableId: string, value: RuntimeValue) {
    setValues((current) => ({ ...current, [variableId]: value }));
  }

  function checkScreen() {
    setSubmitted((current) => {
      const next = new Set(current);
      assessable.forEach((component) => next.add(component.id));
      return next;
    });
  }

  function retryScreen() {
    const ids = new Set(assessable.map((component) => component.id));
    setSubmitted((current) => new Set([...current].filter((id) => !ids.has(id))));
    setResponses((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => !ids.has(id))),
    );
  }

  function goToScreen(nextIndex: number) {
    setScreenIndex(nextIndex);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  return (
    <main
      className={`player-shell ${className}`.trim()}
      data-accent={spec.theme.accent}
      data-colour-scheme={spec.theme.colourScheme}
      data-density={spec.theme.density}
    >
      <article className="player-page">
        <header className="widget-header">
          <p className="widget-context">
            {spec.metadata.subject ? (
              <span lang={copy.locale}>{subjectLabel(spec.metadata.subject, spec.metadata.locale)}</span>
            ) : null}
            {spec.metadata.level ? (
              <span lang={copy.locale}>{levelLabel(spec.metadata.level, spec.metadata.locale)}</span>
            ) : null}
            {spec.metadata.estimatedMinutes ? (
              <span>{spec.metadata.estimatedMinutes} min</span>
            ) : null}
          </p>
          <h1 className="widget-title">{spec.metadata.title}</h1>
          <p className="widget-summary">{spec.metadata.summary}</p>
          {spec.metadata.learningObjective ? (
            <p className="learning-objective">
              <strong lang={copy.locale}>{copy.learningGoal}</strong>
              <span>{spec.metadata.learningObjective}</span>
            </p>
          ) : null}
        </header>

        <section
          className="screen-region"
          aria-labelledby={screen.title ? `${screen.id}-title` : undefined}
        >
          {screen.title ? (
            <h2 className="screen-title" id={`${screen.id}-title`}>
              {screen.title}
            </h2>
          ) : null}
          <div className="component-stack">
            {screen.components.map((component) => (
              <ComponentRenderer
                component={component}
                key={component.id}
                spec={spec}
                values={values}
                response={responses[component.id]}
                submitted={submitted.has(component.id)}
                questionNumber={numbers.get(component.id)}
                resolveAsset={resolveAsset}
                onResponseChange={(response) => updateResponse(component.id, response)}
                onVariableChange={updateVariable}
              />
            ))}
          </div>

          {assessable.length > 0 ? (
            <div className="activity-actions">
              {screenSubmitted ? (
                <>
                  <p className="result-summary" role="status" aria-live="polite" lang={copy.locale}>
                    <strong>
                      {copy.score(score, assessable.length)}
                    </strong>{' '}
                    {score === assessable.length
                      ? copy.everythingCorrect
                      : copy.reviewFeedback}
                  </p>
                  <button className="secondary-action" type="button" onClick={retryScreen} lang={copy.locale}>
                    {copy.tryAgain}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="primary-action"
                    type="button"
                    disabled={!allComplete}
                    onClick={checkScreen}
                    lang={copy.locale}
                  >
                    {copy.checkAnswers}
                  </button>
                  {!allComplete ? (
                    <p className="result-summary" lang={copy.locale}>{copy.answerEveryQuestion}</p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </section>

        {spec.screens.length > 1 ? (
          <nav className="screen-navigation" aria-label={copy.activityPages} lang={copy.locale}>
            <button
              type="button"
              disabled={screenIndex === 0}
              onClick={() => goToScreen(screenIndex - 1)}
            >
              {copy.previous}
            </button>
            <span className="screen-progress" aria-live="polite">
              {copy.pageProgress(screenIndex + 1, spec.screens.length)}
            </span>
            <button
              type="button"
              disabled={screenIndex === spec.screens.length - 1}
              onClick={() => goToScreen(screenIndex + 1)}
            >
              {copy.next}
            </button>
          </nav>
        ) : null}

        {reportEndpoint ? <ContentReport endpoint={reportEndpoint} locale={spec.metadata.locale} /> : null}
      </article>
    </main>
  );
}

type ReportReason =
  | 'inappropriate'
  | 'personal-data'
  | 'copyright'
  | 'accessibility'
  | 'other';

function ContentReport({ endpoint, locale }: { endpoint: string; locale?: string }) {
  const [reason, setReason] = useState<ReportReason>('inappropriate');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const copy = playerCopy(locale);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending' || status === 'sent') return;
    setStatus('sending');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
        credentials: 'omit',
      });
      setStatus(response.ok ? 'sent' : 'failed');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <footer className="widget-safety-footer" lang={copy.locale}>
      <details>
        <summary>{copy.reportWidget}</summary>
        {status === 'sent' ? (
          <p role="status">{copy.reportThanks}</p>
        ) : (
          <form className="report-form" onSubmit={(event) => void submit(event)}>
            <label htmlFor="report-reason">{copy.reportConcern}</label>
            <select
              id="report-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as ReportReason)}
            >
              <option value="inappropriate">{copy.reportReasons.inappropriate}</option>
              <option value="personal-data">{copy.reportReasons['personal-data']}</option>
              <option value="copyright">{copy.reportReasons.copyright}</option>
              <option value="accessibility">{copy.reportReasons.accessibility}</option>
              <option value="other">{copy.reportReasons.other}</option>
            </select>
            <button className="secondary-action" type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? copy.sending : copy.sendReport}
            </button>
            {status === 'failed' ? (
              <p className="report-error" role="alert">
                {copy.reportFailed}
              </p>
            ) : null}
          </form>
        )}
      </details>
    </footer>
  );
}

export function PlayerError({
  title,
  message,
  locale = 'en',
}: {
  title: string;
  message: string;
  locale?: string;
}) {
  return (
    <main className="player-shell player-error-page" lang={locale}>
      <section className="player-error" role="alert">
        <h1>{title}</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

function subjectLabel(
  subject: NonNullable<WidgetSpec['metadata']['subject']>,
  locale?: string,
): string {
  if (localeUsesLanguage(locale, 'ms')) {
    const labels: Record<string, string> = {
      science: 'Sains',
      mathematics: 'Matematik',
      english: 'Bahasa Inggeris',
      humanities: 'Kemanusiaan',
      languages: 'Bahasa',
      other: 'Lain-lain',
    };
    return labels[subject] ?? subject;
  }
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

function levelLabel(level: NonNullable<WidgetSpec['metadata']['level']>, locale?: string): string {
  if (localeUsesLanguage(locale, 'ms')) {
    switch (level) {
      case 'upper-primary':
        return 'Sekolah rendah tahap atas';
      case 'secondary':
        return 'Sekolah menengah';
      case 'other':
        return 'Semua peringkat';
    }
  }
  switch (level) {
    case 'upper-primary':
      return 'Upper primary';
    case 'secondary':
      return 'Secondary';
    case 'other':
      return 'All levels';
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function assetResolver(baseUrl: string): AssetResolver {
  return (asset) => {
    try {
      const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`, document.baseURI);
      if (
        base.protocol !== 'https:' &&
        base.protocol !== 'http:' &&
        base.protocol !== 'classroom-widget-asset:' &&
        base.protocol !== 'classroom-widget:'
      ) {
        return undefined;
      }
      return new URL(encodeURIComponent(asset.id), base).toString();
    } catch {
      return undefined;
    }
  };
}

export type { WidgetComponent };
