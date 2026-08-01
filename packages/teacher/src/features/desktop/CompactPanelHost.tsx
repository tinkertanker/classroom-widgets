import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import type {
  CompactPanelHostBridge,
  CompactPanelStateChange,
  CompactWidgetOption,
  CompactWidgetPanelInventory,
  CompactWidgetSnapshot,
  JsonValue
} from '@shared/types/compactPanel';
import { useWorkspaceStore } from '../../store/workspaceStore.simple';
import { widgetRegistry } from '../../services/WidgetRegistry';

declare global {
  interface Window {
    classroomPanelHost?: CompactPanelHostBridge;
  }
}

const asJsonValue = (value: unknown): JsonValue | null => {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value)) as JsonValue;
};

const createHostInstanceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `compact-host-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const CompactPanelHost = () => {
  const revisionRef = useRef(0);
  const hostInstanceIdRef = useRef(createHostInstanceId());
  const workspace = useWorkspaceStore(useShallow((state) => ({
    currentWorkspaceId: state.currentWorkspaceId,
    widgets: state.widgets,
    widgetStates: state.widgetStates,
    theme: state.theme
  })));

  const compactWidgetOptions = useMemo<CompactWidgetOption[]>(() => (
    widgetRegistry.getAll().flatMap((config) => (
      config.compactPanel?.supported
        ? [{ widgetType: config.type, title: config.name }]
        : []
    ))
  ), []);

  const snapshots = useMemo<CompactWidgetSnapshot[]>(() => {
    revisionRef.current += 1;
    const revision = revisionRef.current;

    return workspace.widgets.flatMap((widget) => {
      const config = widgetRegistry.get(widget.type);
      if (!config?.compactPanel?.supported) return [];

      const compactPanel = config.compactPanel;
      const minimumSize = compactPanel.minimumSize ?? config.minSize ?? { width: 220, height: 180 };
      const preferredWidth = compactPanel.preferredSize?.width
        ?? Math.max(minimumSize.width, Math.min(widget.size.width, 420));
      const preferredHeight = compactPanel.preferredSize?.height
        ?? (config.columnSizing === 'aspect-ratio'
          ? preferredWidth * (config.defaultSize.height / config.defaultSize.width)
          : (config.columnHeight ?? widget.size.height));

      return [{
        schemaVersion: 1,
        workspaceId: workspace.currentWorkspaceId || 'default',
        revision,
        widgetId: widget.id,
        widgetType: widget.type,
        title: config.name,
        preferredSize: { width: Math.round(preferredWidth), height: Math.round(preferredHeight) },
        minimumSize,
        maximumSize: config.maxSize ?? null,
        isResizable: config.features?.isResizable !== false,
        maintainsAspectRatio: config.maintainAspectRatio === true,
        state: asJsonValue(workspace.widgetStates.get(widget.id)),
        theme: workspace.theme
      } satisfies CompactWidgetSnapshot];
    });
  }, [workspace]);

  useEffect(() => {
    const inventory: CompactWidgetPanelInventory = {
      type: 'widget-panels-changed',
      schemaVersion: 1,
      hostInstanceId: hostInstanceIdRef.current,
      inventoryRevision: revisionRef.current,
      widgets: snapshots,
      compactWidgetOptions
    };

    window.webkit?.messageHandlers?.classroomDashboard?.postMessage(inventory);
  }, [compactWidgetOptions, snapshots]);

  useEffect(() => {
    window.classroomPanelHost = {
      applyStateChange: (change: CompactPanelStateChange) => {
        if (change.schemaVersion !== 1) return false;
        const widgetExists = useWorkspaceStore.getState().widgets.some((widget) => widget.id === change.widgetId);
        if (!widgetExists) return false;
        useWorkspaceStore.getState().updateWidgetState(change.widgetId, change.state);
        return true;
      },
      addWidget: (widgetType) => {
        const config = widgetRegistry.get(widgetType);
        if (!config?.compactPanel?.supported) return false;
        useWorkspaceStore.getState().addWidget(widgetType);
        return true;
      },
      removeWidget: (widgetId: string) => {
        const widgetExists = useWorkspaceStore.getState().widgets.some((widget) => widget.id === widgetId);
        if (!widgetExists) return false;
        useWorkspaceStore.getState().removeWidget(widgetId);
        return true;
      }
    };

    return () => {
      delete window.classroomPanelHost;
    };
  }, []);

  return null;
};

export default CompactPanelHost;
