import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import App from './App';
import { useWorkspaceStore } from '../store/workspaceStore.simple';
import { widgetRegistry } from '../services/WidgetRegistry';
import { WidgetType } from '@shared/types';
import { resetWidgetLauncherForTests } from '../features/desktop/widgetLauncher';

vi.mock('./App.css', () => ({}));
vi.mock('../sounds/trash-crumple.mp3', () => ({ default: 'trash-crumple.mp3' }));

vi.mock('@shared/hooks/useWorkspace', () => ({
  useWorkspace: () => ({ theme: 'light', scale: 1 }),
  useServerConnection: () => ({ url: 'http://localhost:3001', setServerStatus: vi.fn() })
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
  CanvasWidgetList: () => <div data-testid="widget-list" />,
  ColumnWidgetList: () => <div data-testid="column-widget-list" />
}));

vi.mock('../features/hud/components', () => ({
  default: () => <div data-testid="bottom-bar" />
}));

vi.mock('../features/hud/components/TopControls', () => ({
  default: ({ onSwitchToCompact }: { onSwitchToCompact?: () => void }) => (
    <div data-testid="top-controls">
      {onSwitchToCompact && (
        <button type="button" onClick={onSwitchToCompact}>Switch to compact overlay</button>
      )}
    </div>
  )
}));

vi.mock('../features/hud/components/NarrowModeExitButton', () => ({
  default: () => <button type="button">Toggle layout</button>
}));

vi.mock('../features/voiceControl/components/VoiceInterface', () => ({
  default: () => <div data-testid="voice-interface" />
}));

vi.mock('../services/WidgetRegistry', () => ({
  widgetRegistry: { get: vi.fn(), getAll: vi.fn(() => []) }
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
    window.history.replaceState({}, '', '/');
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
    resetWidgetLauncherForTests();
    delete window.openClassroomWidgetLauncher;
    delete window.webkit;
    vi.clearAllMocks();
  });

  it('forces column layout on initial narrow-screen load', async () => {
    render(<App />);

    await waitFor(() => {
      expect(useWorkspaceStore.getState().layoutFormat).toBe('column');
      expect(screen.getByTestId('column-board')).toBeInTheDocument();
    });
  });

  it('keeps the widget launcher bridge registered while compact mode hides the toolbar', async () => {
    const postMessage = vi.fn();
    window.history.replaceState({}, '', '/?dashboard=1&mode=compact');
    window.webkit = { messageHandlers: { classroomDashboard: { postMessage } } };

    render(<App />);

    await waitFor(() => {
      expect(typeof window.openClassroomWidgetLauncher).toBe('function');
    });
    expect(screen.queryByTestId('bottom-bar')).not.toBeInTheDocument();

    act(() => {
      window.openClassroomWidgetLauncher?.();
    });

    expect(postMessage).toHaveBeenCalledWith({
      type: 'window-mode-requested',
      mode: 'canvas'
    });
  });

  it('restores compact UI when native aborts after launcher prepare requests canvas', async () => {
    const postMessage = vi.fn();
    window.history.replaceState({}, '', '/?dashboard=1&mode=compact');
    window.webkit = { messageHandlers: { classroomDashboard: { postMessage } } };

    render(<App />);

    await waitFor(() => {
      expect(typeof window.openClassroomWidgetLauncher).toBe('function');
      expect(typeof window.classroomDashboard?.setWindowMode).toBe('function');
    });

    act(() => {
      window.openClassroomWidgetLauncher?.();
    });

    expect(document.documentElement).toHaveClass('desktop-dashboard-canvas');

    act(() => {
      window.classroomDashboard?.setWindowMode('compact');
    });

    expect(document.documentElement).toHaveClass('desktop-dashboard-compact');
    expect(document.documentElement).not.toHaveClass('desktop-dashboard-canvas');
  });

  it('keeps compact mode as a panel host without changing the saved canvas layout', async () => {
    window.history.replaceState({}, '', '/?dashboard=1&mode=compact');
    setWindowWidth(500);

    render(<App />);

    await waitFor(() => {
      expect(useWorkspaceStore.getState().layoutFormat).toBe('canvas');
      expect(screen.queryByTestId('column-widget-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('widget-list')).not.toBeInTheDocument();
    });
  });

  it('puts the canvas-to-compact action in the top controls without the canvas indicator', () => {
    const postMessage = vi.fn();
    window.history.replaceState({}, '', '/?dashboard=1&mode=canvas');
    window.webkit = { messageHandlers: { classroomDashboard: { postMessage } } };
    setWindowWidth(1200);

    render(<App />);

    expect(screen.queryByText('Classroom Widgets')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to compact overlay' }));
    expect(postMessage).toHaveBeenCalledWith({
      type: 'window-mode-requested',
      mode: 'compact'
    });
  });

  it('dismisses a visible dashboard with Escape', async () => {
    window.history.replaceState({}, '', '/?dashboard=1&visible=1&mode=canvas');
    setWindowWidth(1200);
    render(<App />);

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('desktop-dashboard-hidden');
    });
  });
});

describe('App image paste sizing', () => {
  const originalFileReader = globalThis.FileReader;
  const originalImage = globalThis.Image;

  beforeEach(() => {
    window.history.replaceState({}, '', '/');
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

describe('App double-Cmd-press voice activation', () => {
  const pressCmd = () => fireEvent.keyDown(document, { key: 'Meta', metaKey: true });
  const countKeydownCalls = (spy: ReturnType<typeof vi.spyOn>) =>
    spy.mock.calls.filter(([type]) => type === 'keydown').length;

  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    setWindowWidth(1200);
    localStorage.clear();
    useWorkspaceStore.setState({
      layoutFormat: 'canvas',
      widgets: [],
      widgetStates: new Map(),
      focusedWidgetId: null,
      bottomBar: { ...useWorkspaceStore.getState().bottomBar, voiceControlEnabled: true }
    });
  });

  afterEach(() => {
    cleanup();
    resetWidgetLauncherForTests();
    delete window.openClassroomWidgetLauncher;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('registers the keydown listener once and does not re-register it on a single Cmd press', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    render(<App />);

    await waitFor(() => {
      expect(countKeydownCalls(addSpy)).toBe(1);
    });

    pressCmd();

    expect(countKeydownCalls(addSpy)).toBe(1);
    expect(countKeydownCalls(removeSpy)).toBe(0);
  });

  it('activates voice control on a double Cmd press within the 500ms window', async () => {
    render(<App />);

    await waitFor(() => {
      expect(typeof (window as any).getVoiceControlActive).toBe('function');
    });

    pressCmd();
    pressCmd();

    expect((window as any).getVoiceControlActive()).toBe(true);
  });

  it('does not activate voice control when the second Cmd press is outside the 500ms window', async () => {
    render(<App />);

    await waitFor(() => {
      expect(typeof (window as any).getVoiceControlActive).toBe('function');
    });

    vi.useFakeTimers();
    pressCmd();
    vi.advanceTimersByTime(600);
    pressCmd();

    expect((window as any).getVoiceControlActive()).toBe(false);
  });

  it('does not treat a held Cmd key-repeat as a double press', async () => {
    render(<App />);

    await waitFor(() => {
      expect(typeof (window as any).getVoiceControlActive).toBe('function');
    });

    pressCmd();
    fireEvent.keyDown(document, { key: 'Meta', metaKey: true, repeat: true });

    expect((window as any).getVoiceControlActive()).toBe(false);
  });

  it('does not treat Cmd after Cmd+K as a double press', async () => {
    render(<App />);

    await waitFor(() => {
      expect(typeof window.openClassroomWidgetLauncher).toBe('function');
      expect(typeof (window as any).getVoiceControlActive).toBe('function');
    });

    const openLauncher = vi.fn();
    window.openClassroomWidgetLauncher = openLauncher;

    pressCmd();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    pressCmd();

    expect(openLauncher).toHaveBeenCalled();
    expect((window as any).getVoiceControlActive()).toBe(false);
  });
});
