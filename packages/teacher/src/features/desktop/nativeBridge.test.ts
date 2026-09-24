import { afterEach, describe, expect, it, vi } from 'vitest';
import { postNativeMessage } from '@shared/utils/nativeBridge';

type BridgeWindow = Window & {
  chrome?: { webview?: { postMessage: (message: unknown) => void } };
};

describe('postNativeMessage', () => {
  afterEach(() => {
    delete window.webkit;
    delete (window as BridgeWindow).chrome;
  });

  it('prefers the WebKit script message handler when present', () => {
    const webkitPost = vi.fn();
    const webviewPost = vi.fn();
    window.webkit = { messageHandlers: { classroomDashboard: { postMessage: webkitPost } } };
    (window as BridgeWindow).chrome = { webview: { postMessage: webviewPost } };

    postNativeMessage('classroomDashboard', { type: 'visibility-changed', visible: true });

    expect(webkitPost).toHaveBeenCalledWith({ type: 'visibility-changed', visible: true });
    expect(webviewPost).not.toHaveBeenCalled();
  });

  it('tags WebView2 messages with the handler name', () => {
    const webviewPost = vi.fn();
    (window as BridgeWindow).chrome = { webview: { postMessage: webviewPost } };

    postNativeMessage('classroomWidgetPanel', { type: 'panel-ready', schemaVersion: 1, widgetId: 'w1' });

    expect(webviewPost).toHaveBeenCalledWith({
      handler: 'classroomWidgetPanel',
      type: 'panel-ready',
      schemaVersion: 1,
      widgetId: 'w1'
    });
  });

});
