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

const KNOWN_BLOCK_TYPES: ReadonlyArray<SpecificUIBlock['type']> = [
  'text', 'draggable-item', 'drop-zone', 'text-input', 'container', 'code-editor'
];

// The recipe arrives over the socket, and each block's type names the shape
// of its props.
const isSpecificBlock = (block: UIBlock): block is SpecificUIBlock =>
  KNOWN_BLOCK_TYPES.includes(block.type);

/**
 * Renders a UI block based on its type
 * This is the core component that maps recipe blocks to React components
 */
export function BlockRenderer({ block }: BlockRendererProps) {
  if (!isSpecificBlock(block)) {
    console.warn(`Unknown block type: ${block.type}`);
    return null;
  }

  switch (block.type) {
    case 'text':
      return <TextBlock block={block} />;

    case 'draggable-item':
      return <DraggableItemBlock block={block} />;

    case 'drop-zone':
      return <DropZoneBlock block={block} />;

    case 'text-input':
      return <TextInputBlock block={block} />;

    case 'container':
      return <ContainerBlock block={block} />;

    case 'code-editor':
      return <CodeEditorBlock block={block} />;
  }
}

export default BlockRenderer;
