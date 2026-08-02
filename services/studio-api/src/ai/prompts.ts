import type { DesignCard, Exemplar, TeacherBrief } from "./provider";
export const PROMPT_VERSION = "html-v1";
export const SYSTEM_PROMPT = `Create a small accessible front-end-only classroom widget. Return exactly JSON {"html":"...","designCard":{...}} (designCard is optional). HTML must be a readable complete document with inline CSS and JavaScript, no network requests, external packages, credentials, analytics, authentication, student identity or submissions. Managed images use only relative paths assets/<assetId>. Use British English unless requested otherwise.`;
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
