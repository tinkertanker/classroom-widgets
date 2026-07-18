import type { ValidationIssue, WidgetSpec } from '@classroom-widgets/widget-spec';

export interface TeacherBrief {
  level: string;
  subject: string;
  learningObjective: string;
  studentAction: string;
  content?: string;
  feedback?: string;
  durationMinutes?: number;
  accessibilityNeeds?: string;
}

export interface ModerationDecision {
  safe: boolean;
  categories: string[];
  reason?: string;
}

export interface ModelProvider {
  readonly name: string;
  generate(brief: TeacherBrief): Promise<unknown>;
  patch(current: WidgetSpec, instruction: string): Promise<unknown>;
  repair(candidate: unknown, issues: ValidationIssue[]): Promise<unknown>;
  moderate(spec: WidgetSpec): Promise<ModerationDecision>;
}

export class ModelProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
