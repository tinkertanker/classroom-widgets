import React from 'react';

/**
 * Render a {{answer}} template with each blank shown as an empty block.
 * Shared by the fill-blank widgets and their editors.
 */
export function renderBlankPreview(template: string, blankClassName: string) {
  const parts = template.split(/(\{\{[^}]+\}\})/);
  return parts.map((part, index) => {
    if (part.match(/^\{\{[^}]+\}\}$/)) {
      return <span key={index} className={blankClassName} />;
    }
    return <span key={index}>{part}</span>;
  });
}
