import { useEffect, useId, useState } from 'react';
import type {
  AssetSpec,
  ChoiceQuestionComponent,
  FeedbackSpec,
  HotspotsComponent,
  ImageAssetSpec,
  ItemContent,
  MatchingComponent,
  NumberControlComponent,
  PlotComponent,
  SelectControlComponent,
  SequencingComponent,
  ShortAnswerQuestionComponent,
  SortingComponent,
  TextComponent,
  ToggleControlComponent,
  ValueDisplayComponent,
  VariableSpec,
  WidgetComponent,
  WidgetSpec,
} from '@classroom-widgets/widget-spec';

import {
  choiceOptions,
  evaluateExpression,
  initialSequenceOrder,
  isCorrectResponse,
  type ComponentResponse,
  type RuntimeValue,
  type RuntimeValues,
} from './runtime';
import { playerCopy } from './localisation';
import { RandomiserRenderer } from './readyMade/RandomiserRenderer';
import { TaskListRenderer } from './readyMade/TaskListRenderer';
import { TimerRenderer } from './readyMade/TimerRenderer';
import { TrafficLightRenderer } from './readyMade/TrafficLightRenderer';

export type AssetResolver = (asset: AssetSpec) => string | undefined;

export interface ComponentRendererProps {
  component: WidgetComponent;
  spec: WidgetSpec;
  values: RuntimeValues;
  response: ComponentResponse | undefined;
  submitted: boolean;
  questionNumber?: number;
  resolveAsset?: AssetResolver;
  onResponseChange: (response: ComponentResponse) => void;
  onVariableChange: (variableId: string, value: RuntimeValue) => void;
}

export function ComponentRenderer(props: ComponentRendererProps) {
  const { component } = props;

  switch (component.kind) {
    case 'text':
      return <TextRenderer component={component} />;
    case 'image':
      return (
        <ImageRenderer
          component={component}
          spec={props.spec}
          resolveAsset={props.resolveAsset}
        />
      );
    case 'choiceQuestion':
      return <ChoiceQuestionRenderer {...props} component={component} />;
    case 'shortAnswerQuestion':
      return <ShortAnswerRenderer {...props} component={component} />;
    case 'matching':
      return <MatchingRenderer {...props} component={component} />;
    case 'sorting':
      return <SortingRenderer {...props} component={component} />;
    case 'sequencing':
      return <SequencingRenderer {...props} component={component} />;
    case 'hotspots':
      return <HotspotsRenderer {...props} component={component} />;
    case 'numberControl':
      return <NumberControlRenderer {...props} component={component} />;
    case 'toggleControl':
      return <ToggleControlRenderer {...props} component={component} />;
    case 'selectControl':
      return <SelectControlRenderer {...props} component={component} />;
    case 'valueDisplay':
      return <ValueDisplayRenderer {...props} component={component} />;
    case 'plot':
      return <PlotRenderer {...props} component={component} />;
    case 'timer':
      return <TimerRenderer component={component} />;
    case 'randomiser':
      return <RandomiserRenderer component={component} />;
    case 'taskList':
      return <TaskListRenderer component={component} />;
    case 'trafficLight':
      return <TrafficLightRenderer component={component} />;
    default:
      return <UnsupportedComponent component={component} />;
  }
}

function TextRenderer({ component }: { component: TextComponent }) {
  const variant =
    component.role === 'title' || component.role === 'heading'
      ? 'heading'
      : component.role === 'caption'
        ? 'caption'
        : 'body';

  if (variant === 'heading') {
    return (
      <h2 className="text-component" data-variant={variant}>
        {component.text}
      </h2>
    );
  }

  return (
    <p className="text-component" data-variant={variant}>
      {component.text}
    </p>
  );
}

function ImageRenderer({
  component,
  spec,
  resolveAsset,
}: {
  component: Extract<WidgetComponent, { kind: 'image' }>;
  spec: WidgetSpec;
  resolveAsset?: AssetResolver;
}) {
  const asset = findImageAsset(spec, component.assetId);
  const source = asset && resolveAsset?.(asset);

  return (
    <figure className="image-component">
      {source ? (
        <img
          src={source}
          alt={component.decorative ? '' : component.altText}
          decoding="async"
          data-fit={component.fit}
        />
      ) : (
        <MissingImage altText={component.altText} decorative={component.decorative} />
      )}
      {component.caption ? <figcaption>{component.caption}</figcaption> : null}
    </figure>
  );
}

function ChoiceQuestionRenderer({
  component,
  response,
  submitted,
  questionNumber,
  spec,
  resolveAsset,
  onResponseChange,
}: ComponentRendererProps & { component: ChoiceQuestionComponent }) {
  const copy = playerCopy(spec.metadata.locale);
  const selected = Array.isArray(response) ? response : [];
  const correct = submitted && isCorrectResponse(component, response);
  const feedbackId = `${component.id}-feedback`;

  function update(optionId: string, checked: boolean) {
    if (component.selectionMode === 'single') {
      onResponseChange(checked ? [optionId] : []);
      return;
    }
    onResponseChange(
      checked
        ? [...selected, optionId]
        : selected.filter((selectedId) => selectedId !== optionId),
    );
  }

  return (
    <fieldset
      className="question"
      disabled={submitted}
      aria-describedby={submitted ? feedbackId : undefined}
    >
      <legend>
        {questionNumber ? (
          <span className="question-number">{copy.question(questionNumber)}</span>
        ) : null}
        {component.prompt}
      </legend>
      <div className="choice-list">
        {choiceOptions(component).map((option) => {
          const checked = selected.includes(option.id);
          const result = submitted
            ? component.correctOptionIds.includes(option.id)
              ? 'correct'
              : checked
                ? 'incorrect'
                : undefined
            : undefined;
          return (
            <label
              className="choice-option"
              data-result={result}
              data-disabled={submitted}
              key={option.id}
            >
              <input
                type={component.selectionMode === 'single' ? 'radio' : 'checkbox'}
                name={component.id}
                value={option.id}
                checked={checked}
                onChange={(event) => update(option.id, event.currentTarget.checked)}
              />
              <ItemContentRenderer
                content={option.content}
                spec={spec}
                resolveAsset={resolveAsset}
              />
            </label>
          );
        })}
      </div>
      {submitted ? (
        <AssessmentFeedback
          id={feedbackId}
          correct={correct}
          feedback={component.feedback}
        />
      ) : null}
    </fieldset>
  );
}

function ShortAnswerRenderer({
  component,
  response,
  submitted,
  questionNumber,
  spec,
  onResponseChange,
}: ComponentRendererProps & { component: ShortAnswerQuestionComponent }) {
  const copy = playerCopy(spec.metadata.locale);
  const inputId = useId();
  const answer = typeof response === 'string' ? response : '';
  const correct = submitted && isCorrectResponse(component, response);
  const feedbackId = `${component.id}-feedback`;

  return (
    <div className="question">
      <label className="question-label" htmlFor={inputId}>
        {questionNumber ? (
          <span className="question-number">{copy.question(questionNumber)}</span>
        ) : null}
        {component.prompt}
      </label>
      <input
        className="short-answer-input"
        data-result={submitted ? (correct ? 'correct' : 'incorrect') : undefined}
        id={inputId}
        type="text"
        value={answer}
        placeholder={component.placeholder}
        disabled={submitted}
        aria-describedby={submitted ? feedbackId : undefined}
        onChange={(event) => onResponseChange(event.currentTarget.value)}
      />
      {submitted ? (
        <AssessmentFeedback
          id={feedbackId}
          correct={correct}
          feedback={component.feedback}
        />
      ) : null}
    </div>
  );
}

function MatchingRenderer({
  component,
  response,
  submitted,
  spec,
  resolveAsset,
  onResponseChange,
}: ComponentRendererProps & { component: MatchingComponent }) {
  const copy = playerCopy(spec.metadata.locale);
  const answers = responseMap(response);
  const correct = submitted && isCorrectResponse(component, response);

  return (
    <section aria-labelledby={`${component.id}-heading`}>
      <h2 className="interaction-heading" id={`${component.id}-heading`}>
        {component.prompt}
      </h2>
      <p className="interaction-instructions">{copy.matchingInstructions}</p>
      <ul className="response-list">
        {component.items.map((item) => (
          <li className="response-row" key={item.id}>
            <span className="response-label" id={`${component.id}-${item.id}-label`}>
              <ItemContentRenderer
                content={item.content}
                spec={spec}
                resolveAsset={resolveAsset}
              />
            </span>
            <select
              aria-labelledby={`${component.id}-${item.id}-label`}
              value={answers[item.id] ?? ''}
              disabled={submitted}
              onChange={(event) =>
                onResponseChange({
                  ...answers,
                  [item.id]: event.currentTarget.value,
                })
              }
            >
              <option value="">{copy.chooseMatch}</option>
              {component.targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {contentLabel(target.content)}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {submitted ? (
        <AssessmentFeedback correct={correct} feedback={component.feedback} />
      ) : null}
    </section>
  );
}

function SortingRenderer({
  component,
  response,
  submitted,
  spec,
  resolveAsset,
  onResponseChange,
}: ComponentRendererProps & { component: SortingComponent }) {
  const copy = playerCopy(spec.metadata.locale);
  const answers = responseMap(response);
  const correct = submitted && isCorrectResponse(component, response);

  return (
    <section aria-labelledby={`${component.id}-heading`}>
      <h2 className="interaction-heading" id={`${component.id}-heading`}>
        {component.prompt}
      </h2>
      <p className="interaction-instructions">{copy.sortingInstructions}</p>
      <ul className="response-list">
        {component.items.map((item) => (
          <li className="response-row" key={item.id}>
            <span className="response-label" id={`${component.id}-${item.id}-label`}>
              <ItemContentRenderer
                content={item.content}
                spec={spec}
                resolveAsset={resolveAsset}
              />
            </span>
            <select
              aria-labelledby={`${component.id}-${item.id}-label`}
              value={answers[item.id] ?? ''}
              disabled={submitted}
              onChange={(event) =>
                onResponseChange({
                  ...answers,
                  [item.id]: event.currentTarget.value,
                })
              }
            >
              <option value="">{copy.chooseCategory}</option>
              {component.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {submitted ? (
        <AssessmentFeedback correct={correct} feedback={component.feedback} />
      ) : null}
    </section>
  );
}

function SequencingRenderer({
  component,
  response,
  submitted,
  spec,
  resolveAsset,
  onResponseChange,
}: ComponentRendererProps & { component: SequencingComponent }) {
  const copy = playerCopy(spec.metadata.locale);
  const itemIds = component.items.map((item) => item.id);
  const order = Array.isArray(response)
    ? response
    : initialSequenceOrder(component.id, itemIds, component.correctOrder);
  const correct = submitted && isCorrectResponse(component, order);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onResponseChange(next);
  }

  return (
    <section aria-labelledby={`${component.id}-heading`}>
      <h2 className="interaction-heading" id={`${component.id}-heading`}>
        {component.prompt}
      </h2>
      <p className="interaction-instructions">{copy.sequencingInstructions}</p>
      <ol className="sequence-list">
        {order.map((itemId, index) => {
          const item = component.items.find((candidate) => candidate.id === itemId);
          if (!item) return null;
          const label = contentLabel(item.content);
          return (
            <li className="sequence-item" key={item.id}>
              <ItemContentRenderer
                content={item.content}
                spec={spec}
                resolveAsset={resolveAsset}
              />
              <span className="sequence-controls">
                <button
                  className="sequence-action"
                  type="button"
                  disabled={submitted || index === 0}
                  aria-label={copy.moveEarlier(label)}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  className="sequence-action"
                  type="button"
                  disabled={submitted || index === order.length - 1}
                  aria-label={copy.moveLater(label)}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      {submitted ? (
        <AssessmentFeedback correct={correct} feedback={component.feedback} />
      ) : null}
    </section>
  );
}

function HotspotsRenderer({
  component,
  spec,
  resolveAsset,
}: ComponentRendererProps & { component: HotspotsComponent }) {
  const [selectedId, setSelectedId] = useState<string>();

  useEffect(() => {
    setSelectedId(undefined);
  }, [component]);

  const selected = component.hotspots.find((hotspot) => hotspot.id === selectedId);
  const asset = findImageAsset(spec, component.imageAssetId);
  const source = asset && resolveAsset?.(asset);

  return (
    <section aria-labelledby={`${component.id}-heading`}>
      <h2 className="interaction-heading" id={`${component.id}-heading`}>
        {component.prompt}
      </h2>
      <div className="hotspot-stage">
        {source ? (
          <img src={source} alt={component.altText} decoding="async" />
        ) : (
          <MissingImage altText={component.altText} decorative={false} />
        )}
        {source ? (
          <svg
            className="hotspot-overlay"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-label="Interactive points"
          >
            {component.hotspots.map((hotspot, index) => {
              const position = hotspotPosition(hotspot.shape);
              const select = () => setSelectedId(hotspot.id);
              return (
                <g
                  className="hotspot-target"
                  key={hotspot.id}
                  role="button"
                  tabIndex={0}
                  aria-label={hotspot.label}
                  aria-pressed={selectedId === hotspot.id}
                  onClick={select}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      select();
                    }
                  }}
                >
                  {hotspot.shape.kind === 'circle' ? (
                    <circle
                      className="hotspot-hit-area"
                      cx={hotspot.shape.centreX * 100}
                      cy={hotspot.shape.centreY * 100}
                      r={hotspot.shape.radius * 100}
                    />
                  ) : (
                    <rect
                      className="hotspot-hit-area"
                      x={hotspot.shape.x * 100}
                      y={hotspot.shape.y * 100}
                      width={hotspot.shape.width * 100}
                      height={hotspot.shape.height * 100}
                    />
                  )}
                  <circle
                    className="hotspot-marker"
                    cx={position.x}
                    cy={position.y}
                    r="5"
                  />
                  <text
                    x={position.x}
                    y={position.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {index + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : null}
      </div>
      {selected ? (
        <div className="hotspot-detail" role="status" aria-live="polite">
          <strong>{selected.label}.</strong> {selected.reveal}
        </div>
      ) : (
        <p className="interaction-instructions">Choose a numbered point to learn more.</p>
      )}
    </section>
  );
}

function NumberControlRenderer({
  component,
  spec,
  values,
  onVariableChange,
}: ComponentRendererProps & { component: NumberControlComponent }) {
  const variable = findVariable(spec, component.variableId, 'number');
  if (!variable) return <BrokenReference label="number control" />;
  const currentValue = values[variable.id];
  const value = typeof currentValue === 'number' ? currentValue : variable.initial;

  if (component.presentation === 'stepper') {
    return (
      <div className="control-field">
        <span id={`${component.id}-label`}>
          {variable.label}:{' '}
          <strong className="control-value">
            {value}{variable.unit ? ` ${variable.unit}` : ''}
          </strong>
        </span>
        <div className="toggle-options" role="group" aria-labelledby={`${component.id}-label`}>
          <button
            className="secondary-action"
            type="button"
            disabled={value <= variable.minimum}
            aria-label={`Decrease ${variable.label}`}
            onClick={() =>
              onVariableChange(variable.id, Math.max(variable.minimum, value - variable.step))
            }
          >
            −
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={value >= variable.maximum}
            aria-label={`Increase ${variable.label}`}
            onClick={() =>
              onVariableChange(variable.id, Math.min(variable.maximum, value + variable.step))
            }
          >
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="control-field">
      <label htmlFor={component.id}>
        {variable.label}:{' '}
        <output className="control-value" htmlFor={component.id}>
          {value}{variable.unit ? ` ${variable.unit}` : ''}
        </output>
      </label>
      <input
        id={component.id}
        type="range"
        min={variable.minimum}
        max={variable.maximum}
        step={variable.step}
        value={value}
        onChange={(event) => onVariableChange(variable.id, event.currentTarget.valueAsNumber)}
      />
    </div>
  );
}

function ToggleControlRenderer({
  component,
  spec,
  values,
  onVariableChange,
}: ComponentRendererProps & { component: ToggleControlComponent }) {
  const variable = findVariable(spec, component.variableId, 'boolean');
  if (!variable) return <BrokenReference label="toggle control" />;
  const currentValue = values[variable.id];
  const value = typeof currentValue === 'boolean' ? currentValue : variable.initial;

  return (
    <fieldset className="toggle-field">
      <legend>{variable.label}</legend>
      <div className="toggle-options">
        <label>
          <input
            type="radio"
            name={component.id}
            checked={!value}
            onChange={() => onVariableChange(variable.id, false)}
          />
          <span>Off</span>
        </label>
        <label>
          <input
            type="radio"
            name={component.id}
            checked={value}
            onChange={() => onVariableChange(variable.id, true)}
          />
          <span>On</span>
        </label>
      </div>
    </fieldset>
  );
}

function SelectControlRenderer({
  component,
  spec,
  values,
  onVariableChange,
}: ComponentRendererProps & { component: SelectControlComponent }) {
  const variable = findVariable(spec, component.variableId, 'choice');
  if (!variable) return <BrokenReference label="choice control" />;
  const currentValue = values[variable.id];
  const value = typeof currentValue === 'string' ? currentValue : variable.initialOptionId;

  return (
    <div className="response-row">
      <label htmlFor={component.id}>{variable.label}</label>
      <select
        id={component.id}
        value={value}
        onChange={(event) => onVariableChange(variable.id, event.currentTarget.value)}
      >
        {variable.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ValueDisplayRenderer({
  component,
  values,
}: ComponentRendererProps & { component: ValueDisplayComponent }) {
  const value = evaluateExpression(component.expression, values);
  return (
    <div className="value-display" aria-live="polite">
      <span className="value-display-label">{component.label}</span>
      <output className="value-display-output">
        {value === undefined ? 'Unavailable' : value.toFixed(component.decimalPlaces)}
        {value !== undefined && component.unit ? ` ${component.unit}` : ''}
      </output>
    </div>
  );
}

function PlotRenderer({
  component,
  values,
}: ComponentRendererProps & { component: PlotComponent }) {
  const titleId = `${component.id}-plot-title`;
  const descriptionId = `${component.id}-plot-description`;
  const width = 640;
  const height = 360;
  const margin = { top: 28, right: 28, bottom: 55, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xSpan = component.domain.maximum - component.domain.minimum;
  const ySpan = component.range.maximum - component.range.minimum;
  const requestedSteps = Math.ceil(xSpan / component.domain.step);
  const sampleCount = Math.min(240, Math.max(2, requestedSteps));
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  const xPosition = (value: number) =>
    margin.left + ((value - component.domain.minimum) / xSpan) * plotWidth;
  const yPosition = (value: number) =>
    margin.top + (1 - (value - component.range.minimum) / ySpan) * plotHeight;

  return (
    <section aria-labelledby={`${component.id}-heading`}>
      <h2 className="interaction-heading" id={`${component.id}-heading`}>
        {component.title}
      </h2>
      {component.description ? (
        <p className="interaction-instructions">{component.description}</p>
      ) : null}
      <div className="plot-frame">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby={`${titleId} ${descriptionId}`}
        >
          <title id={titleId}>{component.title}</title>
          <desc id={descriptionId}>
            {component.description ??
              `A graph of ${component.range.label} against ${component.domain.label}.`}
          </desc>
          {component.showGrid
            ? gridLines.flatMap((position) => [
                <line
                  className="plot-grid"
                  key={`vertical-${position}`}
                  x1={margin.left + position * plotWidth}
                  x2={margin.left + position * plotWidth}
                  y1={margin.top}
                  y2={margin.top + plotHeight}
                />,
                <line
                  className="plot-grid"
                  key={`horizontal-${position}`}
                  x1={margin.left}
                  x2={margin.left + plotWidth}
                  y1={margin.top + position * plotHeight}
                  y2={margin.top + position * plotHeight}
                />,
              ])
            : null}
          <line
            className="plot-axis"
            x1={margin.left}
            x2={margin.left}
            y1={margin.top}
            y2={margin.top + plotHeight}
          />
          <line
            className="plot-axis"
            x1={margin.left}
            x2={margin.left + plotWidth}
            y1={margin.top + plotHeight}
            y2={margin.top + plotHeight}
          />
          {component.series.map((series) => {
            const points: string[] = [];
            for (let index = 0; index <= sampleCount; index += 1) {
              const x = component.domain.minimum + (index / sampleCount) * xSpan;
              const y = evaluateExpression(series.yExpression, {
                ...values,
                [component.domain.variableId]: x,
              });
              if (y !== undefined) {
                points.push(`${xPosition(x)},${yPosition(y)}`);
              }
            }
            return (
              <polyline
                className="plot-line"
                data-series-colour={series.colour}
                key={series.id}
                points={points.join(' ')}
              />
            );
          })}
          <text
            className="plot-label"
            x={margin.left + plotWidth / 2}
            y={height - 14}
            textAnchor="middle"
          >
            {component.domain.label}
            {component.domain.unit ? ` (${component.domain.unit})` : ''}
          </text>
          <text
            className="plot-label"
            x={18}
            y={margin.top + plotHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 18 ${margin.top + plotHeight / 2})`}
          >
            {component.range.label}
            {component.range.unit ? ` (${component.range.unit})` : ''}
          </text>
        </svg>
      </div>
      {component.showLegend ? (
        <ul className="plot-legend" aria-label="Graph lines">
          {component.series.map((series) => (
            <li key={series.id}>
              <span data-series-colour={series.colour} />
              {series.label}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function AssessmentFeedback({
  id,
  correct,
  feedback,
}: {
  id?: string;
  correct: boolean;
  feedback: FeedbackSpec;
}) {
  return (
    <p
      className="question-feedback"
      data-result={correct ? 'correct' : 'incorrect'}
      id={id}
      role="status"
      aria-live="polite"
    >
      {correct ? feedback.correct : feedback.incorrect}
      {feedback.explanation ? ` ${feedback.explanation}` : ''}
    </p>
  );
}

function ItemContentRenderer({
  content,
  spec,
  resolveAsset,
}: {
  content: ItemContent;
  spec: WidgetSpec;
  resolveAsset?: AssetResolver;
}) {
  if (content.kind === 'text') {
    return <span>{content.text}</span>;
  }

  const asset = findImageAsset(spec, content.assetId);
  const source = asset && resolveAsset?.(asset);
  return source ? (
    <img className="item-image" src={source} alt={content.altText} decoding="async" />
  ) : (
    <span>{content.altText}</span>
  );
}

function MissingImage({
  altText,
  decorative,
}: {
  altText: string;
  decorative: boolean;
}) {
  return (
    <div
      className="asset-unavailable"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : `${altText}. Image unavailable.`}
      aria-hidden={decorative || undefined}
    >
      <span aria-hidden="true">▧</span>
      {!decorative ? <small>Image unavailable</small> : null}
    </div>
  );
}

function UnsupportedComponent({ component }: { component: never }) {
  const kind = (component as { kind?: unknown }).kind;
  return (
    <section className="unsupported-component" role="status">
      <h2>This part needs a newer player</h2>
      <p>
        Update Classroom Widgets to display
        {typeof kind === 'string' ? ` the “${kind}” component` : ' this component'}.
      </p>
    </section>
  );
}

function BrokenReference({ label }: { label: string }) {
  return (
    <section className="unsupported-component" role="status">
      <h2>This {label} is unavailable</h2>
      <p>The activity refers to a setting that could not be found.</p>
    </section>
  );
}

function findImageAsset(spec: WidgetSpec, assetId: string): ImageAssetSpec | undefined {
  return spec.assets.find(
    (asset): asset is ImageAssetSpec => asset.kind === 'image' && asset.id === assetId,
  );
}

function findVariable<K extends VariableSpec['kind']>(
  spec: WidgetSpec,
  variableId: string,
  kind: K,
): Extract<VariableSpec, { kind: K }> | undefined {
  return spec.variables.find(
    (variable): variable is Extract<VariableSpec, { kind: K }> =>
      variable.kind === kind && variable.id === variableId,
  );
}

function responseMap(response: ComponentResponse | undefined): Record<string, string> {
  return typeof response === 'object' && response !== null && !Array.isArray(response)
    ? response
    : {};
}

function contentLabel(content: ItemContent): string {
  return content.kind === 'text' ? content.text : content.altText;
}

function hotspotPosition(shape: HotspotsComponent['hotspots'][number]['shape']) {
  if (shape.kind === 'circle') {
    return { x: shape.centreX * 100, y: shape.centreY * 100 };
  }
  return {
    x: (shape.x + shape.width / 2) * 100,
    y: (shape.y + shape.height / 2) * 100,
  };
}
