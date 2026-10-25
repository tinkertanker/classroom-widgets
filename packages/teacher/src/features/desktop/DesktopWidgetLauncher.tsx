import React, { useCallback, useEffect } from 'react';
import '../../app/App.css';
import { WidgetType } from '@shared/types';
import { FaDisplay } from 'react-icons/fa6';
import { postNativeMessage } from '@shared/utils/nativeBridge';
import WidgetLaunchpad, { LaunchpadExtraItem } from '../hud/components/WidgetLaunchpad';

const DesktopWidgetLauncher = () => {
  useEffect(() => {
    document.title = 'Add Widget — Classroom Widgets';
  }, []);

  // Follow the OS appearance, like the desktop dashboard does.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applySystemTheme = () => {
      document.documentElement.classList.toggle('dark', media.matches);
    };
    applySystemTheme();
    media.addEventListener('change', applySystemTheme);
    return () => media.removeEventListener('change', applySystemTheme);
  }, []);

  const close = useCallback(() => {
    postNativeMessage('classroomDashboard', {
      type: 'desktop-launcher-close',
      schemaVersion: 1
    });
  }, []);

  const addWidget = useCallback((widgetType: WidgetType) => {
    postNativeMessage('classroomDashboard', {
      type: 'desktop-launcher-add-widget',
      schemaVersion: 1,
      widgetType
    });
  }, []);

  const openDisplayPreview = useCallback(() => {
    postNativeMessage('classroomDashboard', {
      type: 'desktop-launcher-open-display-preview',
      schemaVersion: 1
    });
  }, []);

  const extraItems: LaunchpadExtraItem[] = [
    { id: 'display-preview', name: 'Display', description: 'Preview a display', icon: FaDisplay, onSelect: openDisplayPreview }
  ];

  return (
    <main className="min-h-screen bg-warm-gray-100 p-4 text-warm-gray-800 dark:bg-warm-gray-900 dark:text-warm-gray-100 sm:p-6">
      <section className="mx-auto flex h-[calc(100vh-2rem)] max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-warm-gray-800 sm:h-[calc(100vh-3rem)]">
        <header className="flex items-start justify-between gap-4 border-b border-warm-gray-200 px-4 py-4 dark:border-warm-gray-700 sm:px-6">
          <div>
            <h1 className="text-xl font-semibold">Add a widget</h1>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close widget launcher"
            className="rounded-lg px-3 py-1.5 text-sm text-warm-gray-500 hover:bg-warm-gray-100 hover:text-warm-gray-800 focus:outline-none focus:ring-2 focus:ring-sage-500 dark:hover:bg-warm-gray-700 dark:hover:text-white"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1">
          <WidgetLaunchpad compactOnly extraItems={extraItems} onClose={close} onSelectWidget={addWidget} />
        </div>
      </section>
    </main>
  );
};

export default DesktopWidgetLauncher;
