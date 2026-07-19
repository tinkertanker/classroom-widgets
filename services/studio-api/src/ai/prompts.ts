import type { ValidationIssue, WidgetSpec } from '@classroom-widgets/widget-spec';
import widgetSpecV1Schema from '@classroom-widgets/widget-spec/schema/v1' with { type: 'json' };
import type { TeacherBrief } from './provider';

const MINIMAL_WIDGET_EXAMPLE = {
  schemaVersion: '1.0',
  id: 'example-widget',
  metadata: {
    title: 'A focused classroom widget',
    summary: 'Students read one concise instruction.',
  },
  theme: { accent: 'sage', colourScheme: 'light', density: 'comfortable' },
  assets: [],
  variables: [],
  screens: [
    {
      id: 'main',
      components: [
        { id: 'instructions', kind: 'text', role: 'instruction', text: 'Read this instruction.' },
      ],
    },
  ],
};

export const SYSTEM_PROMPT = `You create one small, front-end-only classroom widget for a teacher.
Return only one JSON object conforming to Classroom Widgets WidgetSpec schema version 1.0.

Safety and product constraints:
- Never emit JavaScript, HTML, CSS, package names, class names, event handlers, URLs or network requests.
- Never add student identity, submissions, analytics, authentication, advertising or student-facing AI.
- Use only the declared WidgetSpec component and expression kinds.
- Use stable, unique kebab-case ids inside the specification.
- Keep language age-appropriate, concise and in British English unless the brief requests another language.
- Provide specific, constructive feedback. Do not shame a learner.
- Prefer one screen and one clear student action unless the brief genuinely needs more.
- Do not invent uploaded assets. An image component may reference only an asset already present in the supplied specification.
- Mathematical behaviour must use the safe NumericExpression tree, never a string formula.

The output is validated deterministically. Unknown fields cause rejection.

Complete JSON Schema:
${JSON.stringify(widgetSpecV1Schema)}

Minimal valid shape example:
${JSON.stringify(MINIMAL_WIDGET_EXAMPLE)}`;

export function generationPrompt(brief: TeacherBrief): string {
  return `Create a widget from this approved teacher brief:\n${JSON.stringify(brief, null, 2)}`;
}

export function patchPrompt(current: WidgetSpec, instruction: string): string {
  return `Modify the current widget to satisfy the teacher's instruction.
Preserve every unrelated id, component, answer, variable, asset, theme and piece of metadata exactly.
Return the complete revised WidgetSpec, not a patch and not an explanation.

Teacher instruction:
${instruction}

Current WidgetSpec:
${JSON.stringify(current)}`;
}

export function repairPrompt(candidate: unknown, issues: ValidationIssue[]): string {
  return `Repair this candidate into a valid WidgetSpec without changing its teaching intention.
Return only the complete repaired JSON object.

Validation issues:
${JSON.stringify(issues)}

Candidate:
${JSON.stringify(candidate)}`;
}

export const MODERATION_SYSTEM_PROMPT = `You are the final safety reviewer for a teacher-created,
student-facing classroom activity. Return only JSON in this exact shape:
{"safe":true,"categories":[],"reason":"short reason"}

Mark safe=false for content that gives actionable instructions for violence, weapons, illegal drugs,
self-harm or serious wrongdoing; sexual content involving minors; graphic sexual or violent content;
hate or targeted humiliation; personal student data; or age-inappropriate abuse.
Legitimate, age-appropriate teaching about history, health, safeguarding, literature or science is
allowed when it does not provide harmful instructions or gratuitous detail. Do not block ordinary
names of historical figures, fictional characters, authors or places. When uncertain about material
that children will see, mark it unsafe.`;

export function moderationPrompt(spec: WidgetSpec): string {
  return `Review this complete WidgetSpec before it is published to students:\n${JSON.stringify(spec)}`;
}
