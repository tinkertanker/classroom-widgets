import { isWidgetSpec, type WidgetSpec } from '@classroom-widgets/widget-spec';

export type StudioBridgeMessage =
  | { type: 'ready'; schemaVersion: string }
  | { type: 'loaded' }
  | { type: 'error'; message: string };

export interface WidgetPlayerBridge {
  load: (spec: unknown) => boolean;
}

declare global {
  interface Window {
    ClassroomWidgetsPlayer?: WidgetPlayerBridge;
    __CLASSROOM_WIDGET_SPEC__?: unknown;
    __CLASSROOM_WIDGET_ASSET_BASE_URL__?: string;
    __CLASSROOM_WIDGET_API_BASE_URL__?: string;
    webkit?: {
      messageHandlers?: {
        studioBridge?: {
          postMessage: (message: StudioBridgeMessage) => void;
        };
      };
    };
  }

  interface WindowEventMap {
    'classroom-widgets:load': CustomEvent<unknown>;
  }
}

export function installWidgetPlayerBridge(
  onLoad: (spec: WidgetSpec) => void,
): () => void {
  const load = (input: unknown): boolean => {
    if (!isWidgetSpec(input)) {
      postStudioBridgeMessage({
        type: 'error',
        message: 'The widget specification is invalid or unsupported.',
      });
      return false;
    }

    onLoad(input);
    return true;
  };

  const bridge: WidgetPlayerBridge = { load };
  const handleLoad = (event: CustomEvent<unknown>) => load(event.detail);

  window.ClassroomWidgetsPlayer = bridge;
  window.addEventListener('classroom-widgets:load', handleLoad);

  return () => {
    window.removeEventListener('classroom-widgets:load', handleLoad);
    if (window.ClassroomWidgetsPlayer === bridge) {
      delete window.ClassroomWidgetsPlayer;
    }
  };
}

export function postStudioBridgeMessage(message: StudioBridgeMessage): void {
  try {
    window.webkit?.messageHandlers?.studioBridge?.postMessage(message);
  } catch {
    // A host bridge is optional in Safari and in the local fixture demo.
  }
}
