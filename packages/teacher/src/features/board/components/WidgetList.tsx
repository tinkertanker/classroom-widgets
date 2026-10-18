// WidgetList - Isolated widget rendering to prevent App re-renders
// This component subscribes to the widgets array so App doesn't have to.
// The canvas and column layouts share it; they differ only in which renderer
// they mount and which widget types they exclude.

import React, { memo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { WidgetType } from '@shared/types';
import {
  BoundWidgetRenderer,
  CanvasWidgetRenderer,
  ColumnWidgetRenderer
} from './WidgetRenderer';

interface WidgetListProps {
  renderer: BoundWidgetRenderer;
  excludeTypes?: readonly WidgetType[];
}

// Stamps are canvas-only; the column layout has no free positioning to place them in.
const COLUMN_EXCLUDED_TYPES: readonly WidgetType[] = [WidgetType.STAMP];

const WidgetList: React.FC<WidgetListProps> = ({ renderer: Renderer, excludeTypes }) => {
  // Subscribe only to widget IDs using shallow comparison
  // This prevents re-renders when widget properties (position/size) change
  // Only re-renders when widgets are added/removed
  const widgetIds = useWorkspaceStore(
    useShallow((state) => state.widgets
      .filter(w => !excludeTypes?.includes(w.type))
      .map(w => w.id))
  );

  return (
    <>
      {widgetIds.map((widgetId) => (
        <Renderer key={widgetId} widgetId={widgetId} />
      ))}
    </>
  );
};

const MemoizedWidgetList = memo(WidgetList);

export const CanvasWidgetList: React.FC = () => (
  <MemoizedWidgetList renderer={CanvasWidgetRenderer} />
);

export const ColumnWidgetList: React.FC = () => (
  <MemoizedWidgetList
    renderer={ColumnWidgetRenderer}
    excludeTypes={COLUMN_EXCLUDED_TYPES}
  />
);
