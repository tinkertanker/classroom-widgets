import type { HLJSApi } from 'highlight.js';

let hljsPromise: Promise<HLJSApi> | null = null;
let stylesInjected = false;

const STYLE_ID = 'text-banner-hljs-styles';

const HLJS_CSS = `
.text-banner-code {
  display: block;
  max-width: 100%;
  text-align: left;
  white-space: pre;
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
  padding: 0.6em 0.85em;
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.35);
  color: #f5f5f5;
  margin: 0;
}
.text-banner-code .hljs-comment,
.text-banner-code .hljs-quote { color: #9ca3af; font-style: italic; }
.text-banner-code .hljs-keyword,
.text-banner-code .hljs-selector-tag,
.text-banner-code .hljs-literal,
.text-banner-code .hljs-section,
.text-banner-code .hljs-link { color: #f9a8d4; }
.text-banner-code .hljs-string,
.text-banner-code .hljs-attr,
.text-banner-code .hljs-symbol,
.text-banner-code .hljs-bullet { color: #bef264; }
.text-banner-code .hljs-number,
.text-banner-code .hljs-meta,
.text-banner-code .hljs-built_in,
.text-banner-code .hljs-builtin-name { color: #fdba74; }
.text-banner-code .hljs-title,
.text-banner-code .hljs-name,
.text-banner-code .hljs-type,
.text-banner-code .hljs-class .hljs-title { color: #93c5fd; }
.text-banner-code .hljs-variable,
.text-banner-code .hljs-template-variable,
.text-banner-code .hljs-attribute { color: #fde68a; }
.text-banner-code .hljs-tag,
.text-banner-code .hljs-regexp,
.text-banner-code .hljs-deletion { color: #fca5a5; }
.text-banner-code .hljs-addition { color: #86efac; }
.text-banner-code .hljs-emphasis { font-style: italic; }
.text-banner-code .hljs-strong { font-weight: 600; }
`;

function ensureStyles() {
  if (stylesInjected) return;
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) {
    stylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = HLJS_CSS;
  document.head.appendChild(style);
  stylesInjected = true;
}

async function loadHighlighter(): Promise<HLJSApi> {
  if (!hljsPromise) {
    hljsPromise = import('highlight.js')
      .then((mod) => mod.default)
      .catch((err) => {
        // Drop the cached rejection so the next attempt can retry the chunk
        // load after a transient network failure.
        hljsPromise = null;
        throw err;
      });
  }
  return hljsPromise;
}

export interface HighlightedCode {
  html: string;
  language: string;
}

export const normaliseCode = (input: string) =>
  input
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/–/g, '-')
    .replace(/—/g, '--')
    .replace(/…/g, '...');

export async function highlightCode(code: string, language?: string): Promise<HighlightedCode> {
  ensureStyles();
  const hljs = await loadHighlighter();
  const trimmed = normaliseCode(code.replace(/\n+$/, ''));
  if (language && hljs.getLanguage(language)) {
    const result = hljs.highlight(trimmed, { language, ignoreIllegals: true });
    return { html: result.value, language: result.language ?? language };
  }
  const result = hljs.highlightAuto(trimmed);
  return { html: result.value, language: result.language ?? 'plaintext' };
}

const CODE_BLOCK_RE = /^[ \t]*```([a-zA-Z0-9_+-]*)\n([\s\S]*?)\n[ \t]*```[ \t]*$/m;

export interface ParsedCodeBlock {
  language: string;
  code: string;
  match: string;
  index: number;
}

export function findCodeBlock(text: string): ParsedCodeBlock | null {
  const match = CODE_BLOCK_RE.exec(text);
  if (!match) return null;
  return {
    language: match[1] || '',
    code: match[2],
    match: match[0],
    index: match.index
  };
}
