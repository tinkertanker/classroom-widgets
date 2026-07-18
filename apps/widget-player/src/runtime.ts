import type {
  ChoiceQuestionComponent,
  NumericExpression,
  ShortAnswerQuestionComponent,
  VariableSpec,
  WidgetComponent,
  WidgetSpec,
} from '@classroom-widgets/widget-spec';
import { evaluateNumericExpression } from '@classroom-widgets/widget-spec';

export type RuntimeValue = number | boolean | string;
export type RuntimeValues = Record<string, RuntimeValue>;

export type ComponentResponse = string | string[] | Record<string, string>;
export type ComponentResponses = Record<string, ComponentResponse>;

export function initialRuntimeValues(variables: VariableSpec[]): RuntimeValues {
  return Object.fromEntries(
    variables.map((variable) => {
      switch (variable.kind) {
        case 'number':
          return [variable.id, variable.initial];
        case 'boolean':
          return [variable.id, variable.initial];
        case 'choice':
          return [variable.id, variable.initialOptionId];
      }
    }),
  );
}

export function isAssessableComponent(
  component: WidgetComponent,
): component is Extract<
  WidgetComponent,
  {
    kind:
      | 'choiceQuestion'
      | 'shortAnswerQuestion'
      | 'matching'
      | 'sorting'
      | 'sequencing';
  }
> {
  return [
    'choiceQuestion',
    'shortAnswerQuestion',
    'matching',
    'sorting',
    'sequencing',
  ].includes(component.kind);
}

export function hasCompleteResponse(
  component: WidgetComponent,
  response: ComponentResponse | undefined,
): boolean {
  switch (component.kind) {
    case 'choiceQuestion':
      return Array.isArray(response) && response.length > 0;
    case 'shortAnswerQuestion':
      return typeof response === 'string' && response.trim().length > 0;
    case 'matching':
      return (
        isResponseMap(response) &&
        component.items.every((item) => Boolean(response[item.id]))
      );
    case 'sorting':
      return (
        isResponseMap(response) &&
        component.items.every((item) => Boolean(response[item.id]))
      );
    case 'sequencing':
      return Array.isArray(response) && response.length === component.items.length;
    default:
      return true;
  }
}

export function isCorrectResponse(
  component: WidgetComponent,
  response: ComponentResponse | undefined,
): boolean {
  switch (component.kind) {
    case 'choiceQuestion':
      return (
        Array.isArray(response) &&
        sameMembers(response, component.correctOptionIds)
      );
    case 'shortAnswerQuestion':
      return isCorrectShortAnswer(component, response);
    case 'matching':
      return (
        isResponseMap(response) &&
        component.correctMatches.every(
          ({ itemId, targetId }) => response[itemId] === targetId,
        )
      );
    case 'sorting':
      return (
        isResponseMap(response) &&
        component.correctPlacements.every(
          ({ itemId, categoryId }) => response[itemId] === categoryId,
        )
      );
    case 'sequencing':
      return (
        Array.isArray(response) &&
        response.every((itemId, index) => component.correctOrder[index] === itemId)
      );
    default:
      return true;
  }
}

function isCorrectShortAnswer(
  component: ShortAnswerQuestionComponent,
  response: ComponentResponse | undefined,
): boolean {
  if (typeof response !== 'string') {
    return false;
  }

  const answer = normaliseAnswer(response, component);
  return component.acceptedAnswers.some(
    (accepted) => normaliseAnswer(accepted, component) === answer,
  );
}

function normaliseAnswer(
  value: string,
  component: ShortAnswerQuestionComponent,
): string {
  let normalised = value;
  if (component.normalisation.trimWhitespace) {
    normalised = normalised.trim();
  }
  if (component.normalisation.collapseWhitespace) {
    normalised = normalised.replace(/\s+/g, ' ');
  }
  if (!component.normalisation.caseSensitive) {
    normalised = normalised.toLocaleLowerCase();
  }
  return normalised;
}

function isResponseMap(
  response: ComponentResponse | undefined,
): response is Record<string, string> {
  return typeof response === 'object' && response !== null && !Array.isArray(response);
}

function sameMembers(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

export function stableShuffle<T>(values: T[], seed: string): T[] {
  const shuffled = [...values];
  let state = hashString(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const target = state % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }

  return shuffled;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function initialSequenceOrder(
  componentId: string,
  itemIds: string[],
  correctOrder: string[],
): string[] {
  const shuffled = stableShuffle(itemIds, `${componentId}-sequence`);
  if (shuffled.length > 1 && shuffled.every((id, index) => id === correctOrder[index])) {
    return [...shuffled.slice(1), shuffled[0]!];
  }
  return shuffled;
}

/**
 * Walks the constrained expression tree directly. It never turns authored
 * content into JavaScript and deliberately rejects non-finite results.
 */
export function evaluateExpression(
  expression: NumericExpression,
  values: RuntimeValues,
): number | undefined {
  const numericValues = Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, number] =>
      typeof entry[1] === 'number',
    ),
  );
  const result = evaluateNumericExpression(expression, numericValues);
  return result.ok ? result.value : undefined;
}

export function questionNumberMap(spec: WidgetSpec): Map<string, number> {
  const numbers = new Map<string, number>();
  let number = 0;
  for (const screen of spec.screens) {
    for (const component of screen.components) {
      if (
        component.kind === 'choiceQuestion' ||
        component.kind === 'shortAnswerQuestion'
      ) {
        number += 1;
        numbers.set(component.id, number);
      }
    }
  }
  return numbers;
}

export function choiceOptions(
  component: ChoiceQuestionComponent,
): ChoiceQuestionComponent['options'] {
  return component.shuffleOptions
    ? stableShuffle(component.options, `${component.id}-options`)
    : component.options;
}
