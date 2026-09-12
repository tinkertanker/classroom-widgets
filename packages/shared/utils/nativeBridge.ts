export type NativeMessageHandlerName = 'classroomDashboard' | 'classroomWidgetPanel';

type WebKitMessageHandlers = Partial<Record<NativeMessageHandlerName, { postMessage: (message: unknown) => void }>>;

interface NativeBridgeWindow {
  webkit?: { messageHandlers?: WebKitMessageHandlers };
  chrome?: { webview?: { postMessage: (message: unknown) => void } };
}

/**
 * Posts a message to the native desktop shell. macOS (WKWebView) exposes one
 * script message handler per channel; Windows (WebView2) exposes a single
 * `chrome.webview.postMessage`, so the channel name is carried in the payload.
 */
export function postNativeMessage(handler: NativeMessageHandlerName, message: object): void {
  if (typeof window === 'undefined') return;
  const bridgeWindow = window as NativeBridgeWindow;
  const webkitHandler = bridgeWindow.webkit?.messageHandlers?.[handler];
  if (webkitHandler) {
    webkitHandler.postMessage(message);
    return;
  }
  bridgeWindow.chrome?.webview?.postMessage({ handler, ...message });
}
