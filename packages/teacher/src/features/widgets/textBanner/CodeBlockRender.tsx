import React, { useEffect, useMemo, useState } from 'react';
import { highlightCode, normaliseCode, type HighlightedCode } from './highlight';

const escapeHtml = (input: string) =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface CodeBlockRenderProps {
  code: string;
  language: string;
  fontSize: number;
}

export const CodeBlockRender = React.forwardRef<HTMLDivElement, CodeBlockRenderProps>(
  ({ code, language, fontSize }, ref) => {
    const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

    const normalised = useMemo(() => normaliseCode(code), [code]);

    useEffect(() => {
      let cancelled = false;
      highlightCode(normalised, language)
        .then((result) => {
          if (!cancelled) setHighlighted(result);
        })
        .catch(() => {
          if (!cancelled) setHighlighted({ html: escapeHtml(normalised), language: 'plaintext' });
        });
      return () => {
        cancelled = true;
      };
    }, [normalised, language]);

    return (
      <div
        ref={ref}
        className="max-w-full"
        style={{ fontSize: `${fontSize}px` }}
      >
        <pre className="text-banner-code">
          <code
            dangerouslySetInnerHTML={{
              __html: highlighted?.html ?? escapeHtml(normalised)
            }}
          />
        </pre>
      </div>
    );
  }
);
CodeBlockRender.displayName = 'CodeBlockRender';
