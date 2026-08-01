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

  useEffect(() => {
    document.documentElement.classList.add('compact-widget-panel');
    window.classroomWidgetPanel = {
      receiveSnapshot: (nextSnapshot) => {
        if (nextSnapshot.schemaVersion !== 1 || nextSnapshot.widgetId !== requestedWidgetId) return;
        snapshotRef.current = nextSnapshot;
        lastReportedStateRef.current = JSON.stringify(nextSnapshot.state);
        setSnapshot(nextSnapshot);
      }
    };
    window.webkit?.messageHandlers?.classroomWidgetPanel?.postMessage({
      type: 'panel-ready',
      schemaVersion: 1,
      widgetId: requestedWidgetId
    });

    return () => {
      document.documentElement.classList.remove('compact-widget-panel', 'dark');
      delete window.classroomWidgetPanel;
    };
  }, [requestedWidgetId]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', snapshot?.theme === 'dark');
  }, [snapshot?.theme]);

  const handleStateChange = useCallback((state: unknown) => {
    const currentSnapshot = snapshotRef.current;
    if (!currentSnapshot) return;
    const serializedState = JSON.stringify(state);
    if (serializedState === undefined) return;
    if (serializedState === lastReportedStateRef.current) return;

    lastReportedStateRef.current = serializedState;
    window.webkit?.messageHandlers?.classroomWidgetPanel?.postMessage({
      type: 'panel-state-change',
      schemaVersion: 1,
      widgetId: currentSnapshot.widgetId,
      baseRevision: currentSnapshot.revision,
      state: JSON.parse(serializedState) as JsonValue
    });
  }, []);

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
