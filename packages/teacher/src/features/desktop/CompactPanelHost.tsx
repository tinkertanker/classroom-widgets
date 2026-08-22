import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import type {
  CompactPanelHostBridge,
  CompactRandomiserListChange,
  CompactPanelStateChange,
  CompactWidgetOption,
  CompactWidgetPanelInventory,
  CompactWidgetSnapshot,
  JsonValue
} from '@shared/types/compactPanel';
import { WidgetType } from '@shared/types';
import { useWorkspaceStore } from '../../store/workspaceStore.simple';
import { widgetRegistry } from '../../services/WidgetRegistry';

declare global {
  interface Window {
    classroomPanelHost?: CompactPanelHostBridge;
  }
}

const asJsonValue = (value: unknown): JsonValue | null => {
  if (value === undefined) return null;
  if (typeof structuredClone === 'function') {
    return structuredClone(value) as JsonValue;
  }
  return JSON.parse(JSON.stringify(value)) as JsonValue;
};

const createHostInstanceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `compact-host-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

interface CompactPanelHostProps {
  dashboardTheme?: 'light' | 'dark';
  windowMode?: 'compact' | 'canvas';
}

const CompactPanelHost = ({ dashboardTheme = 'light', windowMode = 'compact' }: CompactPanelHostProps) => {
  const revisionRef = useRef(0);
  const widgetRevisionsRef = useRef(new Map<string, {
    revision: number;
    signature: string;
    stateRevision: number;
    stateSignature: string;
  }>());
  const hostInstanceIdRef = useRef(createHostInstanceId());
  const lastPostedFingerprintRef = useRef<string | null>(null);
  const workspace = useWorkspaceStore(useShallow((state) => ({
    currentWorkspaceId: state.currentWorkspaceId,
    widgets: state.widgets,
    widgetStates: state.widgetStates,
    randomiserLists: state.savedCollections.randomiserLists
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
        stateRevision: 0,
        widgetId: widget.id,
        widgetType: widget.type,
        title: config.name,
        preferredSize: { width: Math.round(preferredWidth), height: Math.round(preferredHeight) },
        minimumSize,
        maximumSize,
        isResizable: config.features?.isResizable !== false,
        maintainsAspectRatio: config.maintainAspectRatio === true,
        state: asJsonValue(workspace.widgetStates.get(widget.id)),
        theme: dashboardTheme,
        savedRandomiserLists: widget.type === WidgetType.RANDOMISER
          ? Object.values(workspace.randomiserLists).sort((a, b) => b.updatedAt - a.updatedAt)
          : []
      } satisfies CompactWidgetSnapshot];
    });
  }, [dashboardTheme, workspace]);

  useEffect(() => {
    const nextRevision = revisionRef.current + 1;
    const nextWidgetRevisions = new Map<string, {
      revision: number;
      signature: string;
      stateRevision: number;
      stateSignature: string;
    }>();
    const publishedSnapshots = snapshots.map((snapshot) => {
      const metadataSignature = JSON.stringify({
        workspaceId: snapshot.workspaceId,
        widgetType: snapshot.widgetType,
        title: snapshot.title,
        preferredSize: snapshot.preferredSize,
        minimumSize: snapshot.minimumSize,
        maximumSize: snapshot.maximumSize,
        isResizable: snapshot.isResizable,
        maintainsAspectRatio: snapshot.maintainsAspectRatio,
        theme: snapshot.theme,
        savedRandomiserLists: snapshot.savedRandomiserLists
      });
      const stateSignature = JSON.stringify(snapshot.state);
      const previous = widgetRevisionsRef.current.get(snapshot.widgetId);
      const widgetRevision = previous?.signature === metadataSignature ? previous.revision : nextRevision;
      const stateRevision = previous?.stateSignature === stateSignature ? previous.stateRevision : nextRevision;
      nextWidgetRevisions.set(snapshot.widgetId, {
        revision: widgetRevision,
        signature: metadataSignature,
        stateRevision,
        stateSignature
      });
      return { ...snapshot, revision: widgetRevision, stateRevision };
    });
    const fingerprint = [
      windowMode,
      hostInstanceIdRef.current,
      compactWidgetOptions.map((option) => `${option.widgetType}:${option.title}`).join(','),
      publishedSnapshots.map((snapshot) => (
        `${snapshot.widgetId}:${snapshot.revision}:${snapshot.stateRevision}`
      )).join(',')
    ].join('|');
    if (fingerprint === lastPostedFingerprintRef.current) {
      return;
    }
    lastPostedFingerprintRef.current = fingerprint;
    revisionRef.current = nextRevision;
    widgetRevisionsRef.current = nextWidgetRevisions;
    const inventory: CompactWidgetPanelInventory = {
      type: 'widget-panels-changed',
      schemaVersion: 1,
      hostInstanceId: hostInstanceIdRef.current,
      inventoryRevision: nextRevision,
      windowMode,
      widgets: publishedSnapshots,
      compactWidgetOptions
    };

    window.webkit?.messageHandlers?.classroomDashboard?.postMessage(inventory);
  }, [compactWidgetOptions, snapshots, windowMode]);

  useEffect(() => {
    window.classroomPanelHost = {
      applyStateChange: (change: CompactPanelStateChange) => {
        if (change.schemaVersion !== 1) return false;
        const widgetExists = useWorkspaceStore.getState().widgets.some((widget) => widget.id === change.widgetId);
        if (!widgetExists) return change.flush === true;
        const previous = widgetRevisionsRef.current.get(change.widgetId);
        if (!change.flush && previous?.stateRevision !== change.baseRevision) return false;
        const stateSignature = JSON.stringify(change.state);
        if (previous?.stateSignature === stateSignature) return true;
        widgetRevisionsRef.current.set(change.widgetId, {
          revision: previous?.revision ?? change.baseRevision,
          signature: previous?.signature ?? '',
          stateRevision: Math.max(previous?.stateRevision ?? 0, change.baseRevision) + 1,
          stateSignature
        });
        useWorkspaceStore.getState().updateWidgetState(change.widgetId, change.state);
        return true;
      },
      applyRandomiserListChange: (change: CompactRandomiserListChange) => {
        if (change.schemaVersion !== 1) return false;
        const randomiserExists = useWorkspaceStore.getState().widgets.some(
          (widget) => widget.id === change.widgetId && widget.type === WidgetType.RANDOMISER
        );
        if (!randomiserExists) return false;
        if (change.type === 'randomiser-list-save') {
          if (!change.name.trim() || !Array.isArray(change.choices)) return false;
          useWorkspaceStore.getState().saveRandomiserList(change.name, change.choices);
          return true;
        }
        if (!change.id) return false;
        useWorkspaceStore.getState().deleteRandomiserList(change.id);
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
