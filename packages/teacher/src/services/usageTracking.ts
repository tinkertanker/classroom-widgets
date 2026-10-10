import type { Socket } from 'socket.io-client';
import { WidgetType } from '@shared/types';
import { isNativeDesktop } from '@shared/utils/nativeBridge';

// Anonymous usage counts for the admin dashboard at <server>/admin. Each
// event carries a random per-browser ID, a per-load visit ID and, for widget
// adds, the widget type. Nothing about the teacher, students or board content.

const CLIENT_ID_KEY = 'cw-usage-client-id';
const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // randomUUID needs a secure context; desktop shells may not provide one.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

let clientId: string | null = null;
function getClientId(): string {
  if (clientId) return clientId;
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY);
    if (stored && ID_PATTERN.test(stored)) {
      clientId = stored;
      return clientId;
    }
    clientId = randomId();
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  } catch {
    // Storage blocked: count this load on its own.
    clientId = clientId || randomId();
  }
  return clientId;
}

const visitId = randomId();
let socket: Socket | null = null;
let appOpenSent = false;

function emit(event: 'app_open' | 'app_resume' | 'widget_add', extra: Record<string, string> = {}) {
  socket?.emit('usage:track', {
    event,
    clientId: getClientId(),
    visitId,
    surface: isNativeDesktop() ? 'desktop' : 'web',
    ...extra
  });
}

/** Called by SocketProvider for the teacher app's server connection. */
export function attachUsageSocket(next: Socket): () => void {
  socket = next;
  // Wait for a real connection so a socket torn down before connecting
  // (React StrictMode, a server URL change) does not swallow the event.
  // Every later connection is a reconnect: the server socket is new, so
  // re-identify it without counting another app open.
  const onConnect = () => {
    if (appOpenSent) {
      emit('app_resume');
      return;
    }
    appOpenSent = true;
    emit('app_open');
  };
  if (next.connected) onConnect();
  next.on('connect', onConnect);
  return () => {
    next.off('connect', onConnect);
    if (socket === next) socket = null;
  };
}

export function trackWidgetAdd(type: WidgetType): void {
  const widget = WidgetType[type];
  if (widget) emit('widget_add', { widget });
}
