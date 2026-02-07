import React from 'react';
import type { ContainerBlock as ContainerBlockType } from '@shared/types/activity.types';
import { BlockRenderer } from '../BlockRenderer';

interface ContainerBlockProps {
  block: ContainerBlockType;
}

export function ContainerBlock({ block }: ContainerBlockProps) {
  const { layout, gap = '8px', className = '', wrap = true } = block.props;
  const children = block.children || [];

  const layoutClasses = {
    row: 'flex flex-row items-center',
    column: 'flex flex-col',
    grid: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
    inline: 'inline-flex flex-wrap items-baseline'
  };

  const wrapClass = layout === 'row' && wrap ? 'flex-wrap' : '';

  return (
    <div
      className={`${layoutClasses[layout]} ${wrapClass} ${className}`}
      style={{ gap }}
    >
      {children.map((child, index) => (
        <BlockRenderer key={child.id || index} block={child} />
      ))}
    </div>
  );
}

export default ContainerBlock;
