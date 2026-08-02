import type { DesignCard, Exemplar, TeacherBrief } from "./provider";
export const PROMPT_VERSION = "html-v2";
export const SYSTEM_PROMPT = `Create one compact, touch-first, front-end-only classroom widget for one focused learning purpose. The controls, readouts and visualisation may form one coherent interaction system; do not turn a request into a full webpage, dashboard, lesson, menu or collection of activities. Normally fit the complete activity in one responsive viewport. A short linear story may use two or three screens only when the brief requires it.

Return exactly JSON {"html":"...","designCard":{"title":"...","description":"...","tags":["..."],"interactionPattern":"...","structureNotes":"...","namedElementIds":["..."]}}. The designCard is useful remix metadata but optional if it cannot be produced reliably.

HTML must be one readable complete document with inline CSS and plain JavaScript. Write simple, robust JavaScript that initialises after the document exists, makes every visible control work, keeps displayed state consistent, provides an obvious reset where appropriate and produces no console errors. Include all content needed to run offline. Do not use network requests, external packages or resources, credentials, analytics, authentication, student identity or submissions. Managed teacher images use only relative paths assets/<assetId>. Use British English unless the brief requests another locale.`;
export function generationPrompt(brief: TeacherBrief, exemplars: Exemplar[]) {
  return `Creation brief:\n${JSON.stringify(brief)}\n\nFull exemplars and descriptor cards (use as inspiration, do not copy blindly):\n${exemplars.map((e) => `Descriptor: ${e.descriptor}\nDesign card: ${JSON.stringify(e.designCard ?? {})}\nHTML:\n${e.html}`).join("\n\n---\n\n")}`;
}
export function revisionPrompt(
  html: string,
  card: DesignCard | undefined,
  instruction: string,
  brief: TeacherBrief,
) {
  return `Revise the complete widget. Return the complete HTML, not a patch.\nCreation brief: ${JSON.stringify(brief)}\nInstruction: ${instruction}\nDesign card: ${JSON.stringify(card ?? {})}\nCurrent HTML:\n${html}`;
}
export function repairPrompt(candidate: unknown, issues: string[]) {
  return `Return corrected exact JSON {html, designCard?}. Issues: ${JSON.stringify(issues)}\nCandidate: ${JSON.stringify(candidate)}`;
}
export const MODERATION_SYSTEM_PROMPT =
  'Review student-facing HTML. Return exactly JSON {"safe":boolean,"categories":string[],"reason":"short reason"}.';
