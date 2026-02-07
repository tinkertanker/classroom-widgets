import React from 'react';
import type { TextBlock as TextBlockType } from '@shared/types/activity.types';

interface TextBlockProps {
  block: TextBlockType;
}

export function TextBlock({ block }: TextBlockProps) {
  const { content, variant = 'body', className = '' } = block.props;

  const baseClasses = 'text-warm-gray-800 dark:text-warm-gray-200';

  const variantClasses = {
    heading: 'text-lg font-semibold mb-2',
    body: 'text-base',
    caption: 'text-sm text-warm-gray-600 dark:text-warm-gray-400',
    inline: 'inline'
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {content}
    </span>
  );
}

export default TextBlock;
