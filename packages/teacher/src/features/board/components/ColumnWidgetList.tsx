import React, { memo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { WidgetType } from '@shared/types';
import ColumnWidgetRenderer from './ColumnWidgetRenderer';

const ColumnWidgetList: React.FC = () => {
  const widgetIds = useWorkspaceStore(
    useShallow((state) => state.widgets
      .filter(w => w.type !== WidgetType.STAMP)
      .map(w => w.id))
  );

  return (
    <>
      {widgetIds.map((widgetId) => (
        <ColumnWidgetRenderer key={widgetId} widgetId={widgetId} />
      ))}
    </>
  );
};

export default memo(ColumnWidgetList);
