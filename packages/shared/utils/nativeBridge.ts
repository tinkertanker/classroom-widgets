export type NativeMessageHandlerName = 'classroomDashboard' | 'classroomWidgetPanel';

type WebKitMessageHandlers = Partial<Record<NativeMessageHandlerName, { postMessage: (message: unknown) => void }>>;

interface NativeBridgeWindow {
  webkit?: { messageHandlers?: WebKitMessageHandlers };
  chrome?: { webview?: { postMessage: (message: unknown) => void } };
  classroomNativeBridge?: { postMessage: (message: unknown) => void };
}

/**
 * Posts a message to the native desktop shell. macOS (WKWebView) exposes one
 * script message handler per channel; Windows (WebView2) exposes a single
 * `chrome.webview.postMessage`, and Linux (Electron) exposes a
 * `window.classroomNativeBridge` via contextBridge — both carry the channel
 * name in the payload.
 */
export function postNativeMessage(handler: NativeMessageHandlerName, message: object): void {
  if (typeof window === 'undefined') return;
  const bridgeWindow = window as NativeBridgeWindow;
  const webkitHandler = bridgeWindow.webkit?.messageHandlers?.[handler];
  if (webkitHandler) {
    webkitHandler.postMessage(message);
    return;
  }
  const nativeBridge = bridgeWindow.classroomNativeBridge;
  if (nativeBridge) {
    nativeBridge.postMessage({ handler, ...message });
    return;
  }
  bridgeWindow.chrome?.webview?.postMessage({ handler, ...message });
}
