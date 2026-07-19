import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { WidgetComponent, WidgetSpec } from '@classroom-widgets/widget-spec';

import { ComponentRenderer, type AssetResolver } from './components';
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
        title="This widget has no page to show"
        message="Ask the teacher to republish the activity, then open the link again."
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
            {spec.metadata.subject ? <span>{subjectLabel(spec.metadata.subject)}</span> : null}
            {spec.metadata.level ? <span>{levelLabel(spec.metadata.level)}</span> : null}
            {spec.metadata.estimatedMinutes ? (
              <span>{spec.metadata.estimatedMinutes} min</span>
            ) : null}
          </p>
          <h1 className="widget-title">{spec.metadata.title}</h1>
          <p className="widget-summary">{spec.metadata.summary}</p>
          {spec.metadata.learningObjective ? (
            <p className="learning-objective">
              <strong>Learning goal</strong>
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
                  <p className="result-summary" role="status" aria-live="polite">
                    <strong>
                      {score} of {assessable.length}
                    </strong>{' '}
                    {score === assessable.length
                      ? 'Everything is correct.'
                      : 'Review the feedback, then try again.'}
                  </p>
                  <button className="secondary-action" type="button" onClick={retryScreen}>
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="primary-action"
                    type="button"
                    disabled={!allComplete}
                    onClick={checkScreen}
                  >
                    Check answers
                  </button>
                  {!allComplete ? (
                    <p className="result-summary">Answer every question to check your work.</p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </section>

        {spec.screens.length > 1 ? (
          <nav className="screen-navigation" aria-label="Activity pages">
            <button
              type="button"
              disabled={screenIndex === 0}
              onClick={() => goToScreen(screenIndex - 1)}
            >
              Previous
            </button>
            <span className="screen-progress" aria-live="polite">
              Page {screenIndex + 1} of {spec.screens.length}
            </span>
            <button
              type="button"
              disabled={screenIndex === spec.screens.length - 1}
              onClick={() => goToScreen(screenIndex + 1)}
            >
              Next
            </button>
          </nav>
        ) : null}

        {reportEndpoint ? <ContentReport endpoint={reportEndpoint} /> : null}
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

function ContentReport({ endpoint }: { endpoint: string }) {
  const [reason, setReason] = useState<ReportReason>('inappropriate');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

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
    <footer className="widget-safety-footer">
      <details>
        <summary>Report this widget</summary>
        {status === 'sent' ? (
          <p role="status">Thank you. This widget has been flagged for review.</p>
        ) : (
          <form className="report-form" onSubmit={(event) => void submit(event)}>
            <label htmlFor="report-reason">What is the concern?</label>
            <select
              id="report-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as ReportReason)}
            >
              <option value="inappropriate">Inappropriate content</option>
              <option value="personal-data">Personal information</option>
              <option value="copyright">Copyright concern</option>
              <option value="accessibility">Accessibility problem</option>
              <option value="other">Another safety concern</option>
            </select>
            <button className="secondary-action" type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Send report'}
            </button>
            {status === 'failed' ? (
              <p className="report-error" role="alert">
                The report could not be sent. Check your connection and try again.
              </p>
            ) : null}
          </form>
        )}
      </details>
    </footer>
  );
}

export function PlayerError({ title, message }: { title: string; message: string }) {
  return (
    <main className="player-shell player-error-page">
      <section className="player-error" role="alert">
        <h1>{title}</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

function subjectLabel(subject: NonNullable<WidgetSpec['metadata']['subject']>): string {
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

function levelLabel(level: NonNullable<WidgetSpec['metadata']['level']>): string {
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
