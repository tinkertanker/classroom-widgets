import { validateHtmlArtifact } from '../../scripts/lib/studio-html-artifact.mjs';

const INTERACTION_PATTERNS = {
  choice: /<(?:button|select)\b|<input\b[^>]*type=["'](?:radio|checkbox)/i,
  graph: /<(?:svg|canvas)\b/i,
  hotspots: /\bhotspot|data-(?:hot|i)=|class=["'][^"']*\bhot\b/i,
  matching: /\bmatch|padan|<select\b|\bdraggable\b/i,
  range: /<input\b[^>]*type=["']range["']/i,
  reset: /\breset\b|tetapkan semula/i,
  sequence: /\bsequence|chronolog|order|susun|data-i=|draggable/i,
  'short-answer': /<(?:input|textarea)\b(?![^>]*type=["'](?:range|radio|checkbox))/i,
  timer: /\bsetInterval\s*\(|\btimer\b/i,
  pause: /\bpause\b|jeda/i,
};

export function parseProviderArtifact(output) {
  let candidate = output;
  if (typeof candidate === 'string') {
    let text = candidate.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
    if (fence) text = fence[1];
    try {
      candidate = JSON.parse(text);
    } catch {
      throw new Error('Provider output must be JSON containing {html, designCard?}.');
    }
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || typeof candidate.html !== 'string') {
    throw new Error('Provider output must be an object containing an html string.');
  }
  if (candidate.designCard !== undefined && (!candidate.designCard || typeof candidate.designCard !== 'object' || Array.isArray(candidate.designCard))) {
    throw new Error('designCard must be an object when provided.');
  }
  return { html: candidate.html, ...(candidate.designCard ? { designCard: candidate.designCard } : {}) };
}

export function assessArtifact(output, request = {}) {
  let artifact;
  try {
    artifact = parseProviderArtifact(output);
  } catch (error) {
    return { valid: false, artifact: undefined, checks: [], issues: [{ code: 'provider-output', message: error.message }] };
  }
  const basic = validateHtmlArtifact(artifact.html);
  const checks = [];
  for (const interaction of request.expectedInteractions ?? []) {
    const pattern = INTERACTION_PATTERNS[interaction];
    checks.push({
      kind: 'interaction',
      requested: interaction,
      passed: Boolean(pattern?.test(artifact.html)),
    });
  }
  for (const term of request.contentTerms ?? []) {
    checks.push({
      kind: 'content',
      requested: term,
      passed: artifact.html.toLocaleLowerCase().includes(String(term).toLocaleLowerCase()),
    });
  }
  if (request.locale) {
    checks.push({
      kind: 'locale',
      requested: request.locale,
      passed: new RegExp(`<html\\b[^>]*\\blang=["']${escapeRegex(request.locale)}["']`, 'i').test(artifact.html),
    });
  }
  const heuristicIssues = checks
    .filter((check) => !check.passed)
    .map((check) => ({ code: `missing-${check.kind}`, message: `Requested ${check.kind} was not evident: ${check.requested}.` }));
  return { valid: basic.valid && heuristicIssues.length === 0, artifact, checks, issues: [...basic.issues, ...heuristicIssues] };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
