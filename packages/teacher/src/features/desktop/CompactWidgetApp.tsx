import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type {
  CompactWidgetPanelBridge,
  CompactWidgetSnapshot,
  JsonValue
} from '@shared/types/compactPanel';
import ErrorBoundary from '@shared/components/ErrorBoundary';
import { widgetRegistry } from '../../services/WidgetRegistry';
import { ModalProvider } from '../../contexts/ModalContext';
import { ConfettiProvider } from '../../contexts/ConfettiContext';

declare global {
  interface Window {
    classroomWidgetPanel?: CompactWidgetPanelBridge;
  }
}

const CompactWidgetApp = () => {
  const requestedWidgetId = new URLSearchParams(window.location.search).get('widgetId');
  const [snapshot, setSnapshot] = useState<CompactWidgetSnapshot | null>(null);
  const snapshotRef = useRef<CompactWidgetSnapshot | null>(null);
  const lastReportedStateRef = useRef<string | undefined>(undefined);
  const inFlightStateRef = useRef<string | null>(null);
  const queuedStateRef = useRef<string | null>(null);
  const closingRef = useRef(false);
  const randomiserListListenersRef = useRef(new Set<(lists: CompactWidgetSnapshot['savedRandomiserLists']) => void>());

  const reportState = useCallback((serializedState: string, baseRevision: number) => {
    const currentSnapshot = snapshotRef.current;
    if (!currentSnapshot || closingRef.current) return;
    inFlightStateRef.current = serializedState;
    lastReportedStateRef.current = serializedState;
    window.webkit?.messageHandlers?.classroomWidgetPanel?.postMessage({
      type: 'panel-state-change',
      schemaVersion: 1,
      widgetId: currentSnapshot.widgetId,
      baseRevision,
      state: JSON.parse(serializedState) as JsonValue
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('compact-widget-panel');
    window.classroomWidgetPanel = {
      receiveSnapshot: (nextSnapshot) => {
        if (nextSnapshot.schemaVersion !== 1 || nextSnapshot.widgetId !== requestedWidgetId) return;
        if (nextSnapshot.revision <= (snapshotRef.current?.revision ?? -1)) return;
        randomiserListListenersRef.current.forEach((listener) => listener(nextSnapshot.savedRandomiserLists));
        const currentSnapshot = snapshotRef.current;
        const stateRevisionAdvanced = nextSnapshot.stateRevision > (currentSnapshot?.stateRevision ?? -1);
        if (!stateRevisionAdvanced && inFlightStateRef.current !== null) {
          const optimisticState = queuedStateRef.current ?? inFlightStateRef.current;
          const metadataSnapshot = {
            ...nextSnapshot,
            state: JSON.parse(optimisticState) as JsonValue
          };
          snapshotRef.current = metadataSnapshot;
          setSnapshot(metadataSnapshot);
          return;
        }
        snapshotRef.current = nextSnapshot;
        const echoedState = JSON.stringify(nextSnapshot.state);
        lastReportedStateRef.current = echoedState;
        inFlightStateRef.current = null;
        const queuedState = queuedStateRef.current;
        queuedStateRef.current = null;
        if (queuedState !== null && queuedState !== echoedState) {
          const optimisticSnapshot = {
            ...nextSnapshot,
            state: JSON.parse(queuedState) as JsonValue
          };
          snapshotRef.current = optimisticSnapshot;
          setSnapshot(optimisticSnapshot);
          reportState(queuedState, nextSnapshot.stateRevision);
        } else {
          setSnapshot(nextSnapshot);
        }
      },
      getRandomiserLists: () => snapshotRef.current?.savedRandomiserLists ?? [],
      subscribeRandomiserLists: (listener) => {
        randomiserListListenersRef.current.add(listener);
        listener(snapshotRef.current?.savedRandomiserLists ?? []);
        return () => randomiserListListenersRef.current.delete(listener);
      },
      saveRandomiserList: (name, choices) => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;
        window.webkit?.messageHandlers?.classroomWidgetPanel?.postMessage({
          type: 'randomiser-list-save',
          schemaVersion: 1,
          widgetId: currentSnapshot.widgetId,
          name,
          choices
        });
      },
      deleteRandomiserList: (id) => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;
        window.webkit?.messageHandlers?.classroomWidgetPanel?.postMessage({
          type: 'randomiser-list-delete',
          schemaVersion: 1,
          widgetId: currentSnapshot.widgetId,
          id
        });
      },
      takePendingState: () => {
        const currentSnapshot = snapshotRef.current;
        const pendingState = queuedStateRef.current ?? inFlightStateRef.current;
        closingRef.current = true;
        queuedStateRef.current = null;
        inFlightStateRef.current = null;
        if (!currentSnapshot || pendingState === null) return null;
        return {
          schemaVersion: 1,
          widgetId: currentSnapshot.widgetId,
          baseRevision: currentSnapshot.stateRevision,
          state: JSON.parse(pendingState) as JsonValue,
          flush: true
        };
      }
    };
    window.webkit?.messageHandlers?.classroomWidgetPanel?.postMessage({
      type: 'panel-ready',
      schemaVersion: 1,
      widgetId: requestedWidgetId
    });

    return () => {
      document.documentElement.classList.remove('compact-widget-panel', 'dark');
      randomiserListListenersRef.current.clear();
      delete window.classroomWidgetPanel;
    };
  }, [reportState, requestedWidgetId]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', snapshot?.theme === 'dark');
  }, [snapshot?.theme]);

  const handleStateChange = useCallback((state: unknown) => {
    const currentSnapshot = snapshotRef.current;
    if (!currentSnapshot) return;
    const serializedState = JSON.stringify(state);
    if (serializedState === undefined) return;
    if (inFlightStateRef.current !== null) {
      queuedStateRef.current = serializedState;
      return;
    }
    if (serializedState === lastReportedStateRef.current) return;
    reportState(serializedState, currentSnapshot.stateRevision);
  }, [reportState]);

  if (!snapshot) {
    return <div className="compact-widget-panel-loading" aria-label="Loading widget" />;
  }

  const config = widgetRegistry.get(snapshot.widgetType);
  if (!config?.compactPanel?.supported) return null;
  const Component = config.component;

  return (
    <ConfettiProvider>
      <ModalProvider>
        <div className="compact-widget-panel-root">
          <ErrorBoundary widgetName={snapshot.title}>
            <Suspense fallback={<div className="compact-widget-panel-loading" aria-label="Loading widget" />}>
              <Component
                widgetId={snapshot.widgetId}
                savedState={snapshot.state ?? undefined}
                onStateChange={handleStateChange}
                renderTheme={snapshot.theme}
                isCompactPanel
                isActive
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      </ModalProvider>
    </ConfettiProvider>
  );
};

export default CompactWidgetApp;
