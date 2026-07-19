import type { WidgetSpec } from '@classroom-widgets/widget-spec';
import type { TeacherBrief } from './ai/provider';

export interface ModerationFinding {
  code:
    | 'POSSIBLE_EMAIL'
    | 'POSSIBLE_PHONE'
    | 'POSSIBLE_STUDENT_IDENTIFIER'
    | 'UNSAFE_HARM_INSTRUCTION'
    | 'SEXUAL_CONTENT_INVOLVING_MINORS';
  message: string;
}

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE = /(?:^|\D)(?:\+?65[ -]?)?[689]\d{3}[ -]?\d{4}(?:\D|$)/;
const SINGAPORE_ID = /\b[STFGM]\d{7}[A-Z]\b/i;
const HARM_INSTRUCTION_PATTERNS = [
  /\bhow to\b.{0,80}\b(?:make|build|assemble|use)\b.{0,80}\b(?:bomb|explosive|weapon|poison)\b/is,
  /\b(?:give|provide|write|show|teach|list|compare)\b.{0,80}\b(?:steps?|instructions?|methods?|guide|conceal)\b.{0,100}\b(?:suicid(?:e|al)|self[- ]?harm|kill (?:a |the )?person|make (?:a )?bomb|poison someone)\b/is,
  /\b(?:suicid(?:e|al)|self[- ]?harm|bomb|explosive|poison someone)\b.{0,120}\b(?:steps?|instructions?|methods?|guide|materials?|combine|conceal)\b/is,
] as const;
const SEXUAL_MINOR_CONTENT =
  /\b(?:create|generate|show|depict|write)\b.{0,80}\b(?:sexual|nude|pornographic)\b.{0,60}\b(?:child|minor|pupil|schoolchild)\b|\b(?:child|minor|pupil|schoolchild)\b.{0,60}\b(?:sexual|nude|pornographic)\b/is;

export function inspectTeacherBrief(brief: TeacherBrief): ModerationFinding[] {
  const text = Object.values(brief).filter((value) => typeof value === 'string').join('\n');
  return inspectText(text);
}

export function inspectWidgetSpec(spec: WidgetSpec): ModerationFinding[] {
  return inspectText(collectWidgetText(spec));
}

export function inspectUnknownText(value: unknown): ModerationFinding[] {
  const text: string[] = [];
  const stack: unknown[] = [value];
  const seen = new WeakSet<object>();
  let nodes = 0;
  while (stack.length > 0 && nodes < 20_000) {
    const candidate = stack.pop();
    nodes += 1;
    if (typeof candidate === 'string') {
      text.push(candidate);
    } else if (Array.isArray(candidate)) {
      for (let index = candidate.length - 1; index >= 0; index -= 1) stack.push(candidate[index]);
    } else if (candidate !== null && typeof candidate === 'object') {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      const values = Object.values(candidate);
      for (let index = values.length - 1; index >= 0; index -= 1) stack.push(values[index]);
    }
  }
  return inspectText(text.join('\n'));
}

export function inspectText(text: string): ModerationFinding[] {
  const findings: ModerationFinding[] = [];
  if (EMAIL.test(text)) {
    findings.push({ code: 'POSSIBLE_EMAIL', message: 'Remove personal email addresses before continuing.' });
  }
  if (PHONE.test(text)) {
    findings.push({ code: 'POSSIBLE_PHONE', message: 'Remove personal phone numbers before continuing.' });
  }
  if (SINGAPORE_ID.test(text)) {
    findings.push({
      code: 'POSSIBLE_STUDENT_IDENTIFIER',
      message: 'Remove identity numbers before continuing.',
    });
  }
  if (HARM_INSTRUCTION_PATTERNS.some((pattern) => pattern.test(text))) {
    findings.push({
      code: 'UNSAFE_HARM_INSTRUCTION',
      message: 'This request asks for unsafe instructions and cannot be made into a classroom widget.',
    });
  }
  if (SEXUAL_MINOR_CONTENT.test(text)) {
    findings.push({
      code: 'SEXUAL_CONTENT_INVOLVING_MINORS',
      message: 'This request contains unsafe sexual content involving children and cannot be processed.',
    });
  }
  return findings;
}

export function collectWidgetText(spec: WidgetSpec): string {
  return JSON.stringify(spec);
}
