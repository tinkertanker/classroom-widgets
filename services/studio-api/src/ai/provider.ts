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
export interface DesignCard {
  title?: string;
  description?: string;
  tags?: string[];
  [key: string]: unknown;
}
export interface Exemplar {
  revisionId: string;
  html: string;
  designCard?: DesignCard;
  descriptor: string;
}
export interface GeneratedArtifact {
  html: string;
  designCard?: DesignCard;
}
export interface ModerationDecision {
  safe: boolean;
  categories: string[];
  reason?: string;
}
export interface ModelProvider {
  readonly name: string;
  generate(brief: TeacherBrief, exemplars: Exemplar[]): Promise<unknown>;
  revise(
    currentHtml: string,
    designCard: DesignCard | undefined,
    instruction: string,
    brief: TeacherBrief,
  ): Promise<unknown>;
  repair(candidate: unknown, issues: string[]): Promise<unknown>;
  moderate(html: string): Promise<ModerationDecision>;
}
export class ModelProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
