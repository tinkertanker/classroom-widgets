// WidgetList - Isolated widget rendering to prevent App re-renders
// This component subscribes to the widgets array so App doesn't have to

import React, { memo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import WidgetRenderer from './WidgetRenderer';

const WidgetList: React.FC = () => {
  // Subscribe only to widget IDs using shallow comparison
  // This prevents re-renders when widget properties (position/size) change
  // Only re-renders when widgets are added/removed
  const widgetIds = useWorkspaceStore(
    useShallow((state) => state.widgets.map(w => w.id))
  );

  return (
    <>
      {widgetIds.map((widgetId) => (
        <WidgetRenderer key={widgetId} widgetId={widgetId} />
      ))}
    </>
  );
};

export default memo(WidgetList);
