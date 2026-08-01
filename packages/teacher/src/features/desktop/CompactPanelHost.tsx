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
  const widgetRevisionsRef = useRef(new Map<string, { revision: number; signature: string }>());
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
    return workspace.widgets.flatMap((widget) => {
      const config = widgetRegistry.get(widget.type);
      if (!config?.compactPanel?.supported) return [];

      const compactPanel = config.compactPanel;
      const minimumSize = compactPanel.minimumSize ?? config.minSize ?? { width: 220, height: 180 };
      const maximumSize = config.maxSize ?? null;
      const preferredWidth = Math.max(minimumSize.width, Math.min(
        compactPanel.preferredSize?.width ?? widget.size.width,
        maximumSize?.width ?? 420
      ));
      const preferredHeight = Math.max(minimumSize.height, Math.min(
        compactPanel.preferredSize?.height ?? (config.columnSizing === 'aspect-ratio'
          ? preferredWidth * (config.defaultSize.height / config.defaultSize.width)
          : (config.columnHeight ?? widget.size.height)),
        maximumSize?.height ?? Infinity
      ));

      return [{
        schemaVersion: 1,
        workspaceId: workspace.currentWorkspaceId || 'default',
        revision: 0,
        widgetId: widget.id,
        widgetType: widget.type,
        title: config.name,
        preferredSize: { width: Math.round(preferredWidth), height: Math.round(preferredHeight) },
        minimumSize,
        maximumSize,
        isResizable: config.features?.isResizable !== false,
        maintainsAspectRatio: config.maintainAspectRatio === true,
        state: asJsonValue(workspace.widgetStates.get(widget.id)),
        theme: workspace.theme
      } satisfies CompactWidgetSnapshot];
    });
  }, [workspace]);

  useEffect(() => {
    const revision = revisionRef.current + 1;
    revisionRef.current = revision;
    const nextWidgetRevisions = new Map<string, { revision: number; signature: string }>();
    const publishedSnapshots = snapshots.map((snapshot) => {
      const signature = JSON.stringify(snapshot);
      const previous = widgetRevisionsRef.current.get(snapshot.widgetId);
      const widgetRevision = previous?.signature === signature ? previous.revision : revision;
      nextWidgetRevisions.set(snapshot.widgetId, { revision: widgetRevision, signature });
      return { ...snapshot, revision: widgetRevision };
    });
    widgetRevisionsRef.current = nextWidgetRevisions;
    const inventory: CompactWidgetPanelInventory = {
      type: 'widget-panels-changed',
      schemaVersion: 1,
      hostInstanceId: hostInstanceIdRef.current,
      inventoryRevision: revision,
      widgets: publishedSnapshots,
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
        if (widgetRevisionsRef.current.get(change.widgetId)?.revision !== change.baseRevision) return false;
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
