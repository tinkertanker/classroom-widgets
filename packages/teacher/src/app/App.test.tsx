import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { useWorkspaceStore } from '../store/workspaceStore.simple';
import { widgetRegistry } from '../services/WidgetRegistry';
import { WidgetType } from '@shared/types';

vi.mock('./App.css', () => ({}));
vi.mock('../sounds/trash-crumple.mp3', () => ({ default: 'trash-crumple.mp3' }));

vi.mock('@shared/hooks/useWorkspace', () => ({
  useWorkspace: () => ({ theme: 'light', scale: 1 }),
  useServerConnection: () => ({ url: 'http://localhost:3001', setServerStatus: vi.fn() })
}));

vi.mock('@shared/utils/migration', () => ({
  migrateFromOldFormat: vi.fn()
}));

vi.mock('../contexts/ModalContext', () => ({
  ModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('../contexts/SocketProvider', () => ({
  SocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('../contexts/SessionContext', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('../contexts/ConfettiContext', () => ({
  ConfettiProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('@shared/hooks/useHudProximity', () => ({
  HudProximityProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('@shared/components/GlobalErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('@shared/components/SmallScreenWarning', () => ({
  default: () => <div data-testid="small-screen-warning" />
}));

vi.mock('../features/board/components', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas-board">{children}</div>
}));

vi.mock('../features/board/components/ColumnBoard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="column-board">{children}</div>
}));

vi.mock('../features/board/components/WidgetList', () => ({
  default: () => <div data-testid="widget-list" />
}));

vi.mock('../features/board/components/ColumnWidgetList', () => ({
  default: () => <div data-testid="column-widget-list" />
}));

vi.mock('../features/hud/components', () => ({
  default: () => <div data-testid="bottom-bar" />
}));

vi.mock('../features/hud/components/TopControls', () => ({
  default: () => <div data-testid="top-controls" />
}));

vi.mock('../features/hud/components/NarrowModeExitButton', () => ({
  default: () => <button type="button">Toggle layout</button>
}));

vi.mock('../features/voiceControl/components/VoiceInterface', () => ({
  default: () => <div data-testid="voice-interface" />
}));

vi.mock('../services/WidgetRegistry', () => ({
  widgetRegistry: { get: vi.fn() }
}));

const setWindowWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width
  });
};

class MockFileReader {
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

  readAsDataURL() {
    this.onload?.({ target: { result: 'data:image/png;base64,test' } } as ProgressEvent<FileReader>);
  }
}

describe('App narrow layout', () => {
  beforeEach(() => {
    setWindowWidth(500);
    localStorage.clear();
    useWorkspaceStore.setState({
      layoutFormat: 'canvas',
      widgets: [],
      widgetStates: new Map(),
      focusedWidgetId: null
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('forces column layout on initial narrow-screen load', async () => {
    render(<App />);

    await waitFor(() => {
      expect(useWorkspaceStore.getState().layoutFormat).toBe('column');
      expect(screen.getByTestId('column-board')).toBeInTheDocument();
    });
  });
});

describe('App image paste sizing', () => {
  const originalFileReader = globalThis.FileReader;
  const originalImage = globalThis.Image;

  beforeEach(() => {
    setWindowWidth(1200);
    localStorage.clear();
    useWorkspaceStore.setState({
      layoutFormat: 'canvas',
      widgets: [],
      widgetStates: new Map(),
      focusedWidgetId: null
    });
    vi.mocked(widgetRegistry.get).mockReturnValue({
      type: WidgetType.IMAGE_DISPLAY,
      name: 'Image',
      icon: () => null,
      component: () => null,
      defaultSize: { width: 350, height: 350 },
      minSize: { width: 200, height: 200 },
      features: {}
    });
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
    globalThis.Image = vi.fn(() => {
      const image = {
        width: 1000,
        height: 100,
        onload: null as (() => void) | null,
        set src(_value: string) {
          this.onload?.();
        }
      };
      return image;
    }) as unknown as typeof Image;
  });

  afterEach(() => {
    cleanup();
    globalThis.FileReader = originalFileReader;
    globalThis.Image = originalImage;
    vi.clearAllMocks();
  });

  it('preserves a pasted image aspect ratio when minimum size would otherwise distort it', async () => {
    render(<App />);

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        items: [
          {
            type: 'image/png',
            getAsFile: () => new File(['image'], 'wide.png', { type: 'image/png' })
          }
        ],
        getData: () => ''
      }
    });

    document.dispatchEvent(pasteEvent);

    await waitFor(() => {
      const [widget] = useWorkspaceStore.getState().widgets;
      expect(widget.size.width / widget.size.height).toBeCloseTo(10, 5);
    });
  });
});
