import React from 'react';
import type { UIBlock, SpecificUIBlock } from '@shared/types/activity.types';
import { TextBlock } from './blocks/TextBlock';
import { DraggableItemBlock } from './blocks/DraggableItemBlock';
import { DropZoneBlock } from './blocks/DropZoneBlock';
import { TextInputBlock } from './blocks/TextInputBlock';
import { ContainerBlock } from './blocks/ContainerBlock';
import { CodeEditorBlock } from './blocks/CodeEditorBlock';

interface BlockRendererProps {
  block: UIBlock;
}

/**
 * Renders a UI block based on its type
 * This is the core component that maps recipe blocks to React components
 */
export function BlockRenderer({ block }: BlockRendererProps) {
  switch (block.type) {
    case 'text':
      return <TextBlock block={block as any} />;

    case 'draggable-item':
      return <DraggableItemBlock block={block as any} />;

    case 'drop-zone':
      return <DropZoneBlock block={block as any} />;

    case 'text-input':
      return <TextInputBlock block={block as any} />;

    case 'container':
      return <ContainerBlock block={block as any} />;

    case 'code-editor':
      return <CodeEditorBlock block={block as any} />;

    default:
      console.warn(`Unknown block type: ${(block as UIBlock).type}`);
      return null;
  }
}

export default BlockRenderer;
