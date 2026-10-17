import React from 'react';

const formatInlineText = (line: string) => {
  const tokens = line.split(/(\*_[^_]+_\*|\*[^*]+\*|_[^_]+_|~[^~]+~|`[^`]+`)/g);
  return tokens.map((token, index) => {
    if (token.startsWith('*_') && token.endsWith('_*')) {
      return (
        <strong key={`bold-italic-${index}`}><em>{token.slice(2, -2)}</em></strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return (
        <strong key={`bold-${index}`}>{token.slice(1, -1)}</strong>
      );
    }
    if (token.startsWith('_') && token.endsWith('_')) {
      return (
        <em key={`italic-${index}`}>{token.slice(1, -1)}</em>
      );
    }
    if (token.startsWith('~') && token.endsWith('~')) {
      return (
        <span key={`strike-${index}`} className="line-through">{token.slice(1, -1)}</span>
      );
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <span key={`mono-${index}`} className="font-mono">{token.slice(1, -1)}</span>
      );
    }
    return <span key={`text-${index}`}>{token}</span>;
  });
};

export const renderFormattedText = (value: string) => {
  const lines = value.split('\n');
  return lines.map((line, index) => (
    <React.Fragment key={`line-${index}`}>
      {(() => {
        const headingMatch = line.match(/^\s*#{1,3}\s+(.*)$/);
        const content = headingMatch ? headingMatch[1] : line;
        const isHeading = Boolean(headingMatch);
        const headingClass = isHeading ? 'font-semibold' : undefined;
        return (
          <span className={headingClass}>
            {formatInlineText(content)}
          </span>
        );
      })()}
      {index < lines.length - 1 ? <br /> : null}
    </React.Fragment>
  ));
};
