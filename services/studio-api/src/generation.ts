import {
  type ValidationIssue,
  type WidgetSpec,
  validateWidgetSpec,
} from '@classroom-widgets/widget-spec';
import type { ModelProvider, TeacherBrief } from './ai/provider';
import { inspectWidgetSpec } from './moderation';

export class InvalidModelOutputError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super('The model could not produce a valid widget specification.');
  }
}

export async function generateWidgetSpec(
  provider: ModelProvider,
  brief: TeacherBrief,
  maximumRepairAttempts = 2,
): Promise<WidgetSpec> {
  return validateWithRepair(
    provider,
    await provider.generate(brief),
    maximumRepairAttempts,
    (spec) =>
      spec.assets.length === 0
        ? []
        : [
            {
              path: '/assets',
              code: 'generation.assets',
              message: 'Initial generation cannot invent uploaded image assets.',
            },
          ],
  );
}

export async function patchWidgetSpec(
  provider: ModelProvider,
  current: WidgetSpec,
  instruction: string,
  maximumRepairAttempts = 2,
): Promise<WidgetSpec> {
  let candidate = await provider.patch(current, instruction);

  for (let attempt = 0; attempt <= maximumRepairAttempts; attempt += 1) {
    const validation = validateWidgetSpec(candidate);
    const issues = validation.valid
      ? [...moderationIssues(validation.value), ...patchPreservationIssues(current, validation.value)]
      : validation.errors;
    if (validation.valid && issues.length === 0) return validation.value;
    if (attempt === maximumRepairAttempts) throw new InvalidModelOutputError(issues);
    candidate = await provider.patch(
      current,
      `${instruction}\n\nThe previous revision was rejected. Correct only these issues and preserve the current widget:\n${JSON.stringify(issues)}`,
    );
  }

  throw new InvalidModelOutputError([]);
}

export async function repairWidgetSpec(
  provider: ModelProvider,
  candidate: unknown,
  maximumRepairAttempts = 2,
): Promise<WidgetSpec> {
  return validateWithRepair(provider, candidate, maximumRepairAttempts);
}

async function validateWithRepair(
  provider: ModelProvider,
  initialCandidate: unknown,
  maximumRepairAttempts: number,
  extraIssues: (spec: WidgetSpec) => ValidationIssue[] = () => [],
): Promise<WidgetSpec> {
  let candidate = initialCandidate;

  for (let attempt = 0; attempt <= maximumRepairAttempts; attempt += 1) {
    const result = validateWidgetSpec(candidate);
    const issues = result.valid
      ? [...moderationIssues(result.value), ...extraIssues(result.value)]
      : result.errors;
    if (result.valid && issues.length === 0) return result.value;
    if (attempt === maximumRepairAttempts) throw new InvalidModelOutputError(issues);
    candidate = await provider.repair(candidate, issues);
  }

  throw new InvalidModelOutputError([]);
}

function moderationIssues(spec: WidgetSpec): ValidationIssue[] {
  return inspectWidgetSpec(spec).map((finding) => ({
    path: '/',
    code: `moderation.${finding.code.toLowerCase()}`,
    message: finding.message,
  }));
}

function patchPreservationIssues(current: WidgetSpec, next: WidgetSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (next.id !== current.id) {
    issues.push({ path: '/id', code: 'patch.identity', message: 'A revision must preserve the widget ID.' });
  }
  if (next.schemaVersion !== current.schemaVersion) {
    issues.push({
      path: '/schemaVersion',
      code: 'patch.schema-version',
      message: 'A revision must preserve the schema version.',
    });
  }
  if (JSON.stringify(next.assets) !== JSON.stringify(current.assets)) {
    issues.push({
      path: '/assets',
      code: 'patch.assets',
      message: 'Prompted revisions cannot add, remove or replace uploaded assets.',
    });
  }

  const currentScreenIds = current.screens.map((screen) => screen.id);
  const nextScreenIds = new Set(next.screens.map((screen) => screen.id));
  const currentComponentIds = current.screens.flatMap((screen) =>
    screen.components.map((component) => component.id),
  );
  const nextComponentIds = new Set(
    next.screens.flatMap((screen) => screen.components.map((component) => component.id)),
  );
  const currentVariableIds = current.variables.map((variable) => variable.id);
  const nextVariableIds = new Set(next.variables.map((variable) => variable.id));

  requireRetainedIds('/screens', 'screen', currentScreenIds, nextScreenIds, issues);
  requireRetainedIds('/screens', 'component', currentComponentIds, nextComponentIds, issues);
  requireRetainedIds('/variables', 'variable', currentVariableIds, nextVariableIds, issues);

  const componentDelta = Math.abs(currentComponentIds.length - nextComponentIds.size);
  if (componentDelta > 6) {
    issues.push({
      path: '/screens',
      code: 'patch.scope',
      message: 'This revision changes too many components at once.',
    });
  }

  const changeCount = countLeafChanges(current, next);
  const allowedChanges = Math.max(12, Math.floor(countLeaves(current) * 0.45));
  if (changeCount > allowedChanges) {
    issues.push({
      path: '/',
      code: 'patch.scope',
      message: 'This revision replaces too much of the working widget. Make the requested change only.',
    });
  }
  return issues;
}

function requireRetainedIds(
  path: string,
  label: string,
  currentIds: string[],
  nextIds: Set<string>,
  issues: ValidationIssue[],
): void {
  if (currentIds.length === 0) return;
  const retained = currentIds.filter((id) => nextIds.has(id)).length;
  if (retained < Math.ceil(currentIds.length / 2)) {
    issues.push({
      path,
      code: 'patch.identifiers',
      message: `A revision must retain the working ${label} identifiers.`,
    });
  }
}

function countLeaves(value: unknown): number {
  if (value === null || typeof value !== 'object') return 1;
  const entries = Array.isArray(value) ? value : Object.values(value);
  return Math.max(1, entries.reduce((total, entry) => total + countLeaves(entry), 0));
}

function countLeafChanges(left: unknown, right: unknown): number {
  if (Object.is(left, right)) return 0;
  if (
    left === null ||
    right === null ||
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    Array.isArray(left) !== Array.isArray(right)
  ) {
    return Math.max(countLeaves(left), countLeaves(right));
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    const length = Math.max(left.length, right.length);
    let changes = 0;
    for (let index = 0; index < length; index += 1) {
      changes += countLeafChanges(left[index], right[index]);
    }
    return changes;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
  let changes = 0;
  for (const key of keys) changes += countLeafChanges(leftRecord[key], rightRecord[key]);
  return changes;
}
