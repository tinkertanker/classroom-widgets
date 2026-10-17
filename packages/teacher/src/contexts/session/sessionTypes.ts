import type { Socket } from 'socket.io-client';

/**
 * A server-side room owned by a widget. `roomData` is the widget-specific room
 * snapshot from the server (`Session.getActiveRooms()`); each widget reads its
 * own shape from it.
 */
export interface ActiveRoom {
  roomType: string;
  widgetId: string;
  isActive: boolean;
  participantCount: number;
  // Widget-specific snapshot; its shape differs per room type
  roomData?: any;
}

/**
 * Single representation of the socket + session-recovery lifecycle.
 *
 * - `disconnected`     no socket connection
 * - `connected`        connected, no recovery attempted yet in this connection
 * - `recovering`       a recovery attempt is in flight
 * - `recovered`        the session is established (recovered, or freshly created)
 * - `recovery-deferred` transient retries exhausted; keep state for another reconnect
 * - `recovery-failed`  recovery definitively rejected or the local session expired
 */
export type ConnectionPhase =
  | 'disconnected'
  | 'connected'
  | 'recovering'
  | 'recovered'
  | 'recovery-deferred'
  | 'recovery-failed';

/**
 * Recovery answered definitively (either outcome). Until this is true, the
 * absence of recovery data for a widget means "recovery has not answered yet",
 * not "this widget has no room".
 */
export const isRecoverySettled = (phase: ConnectionPhase): boolean =>
  phase === 'recovered' || phase === 'recovery-failed';

export interface SessionContextValue {
  // Session state
  sessionCode: string | null;
  sessionCreatedAt: number | null;
  isHost: boolean;

  // Connection state
  socket: Socket | null;
  connectionPhase: ConnectionPhase;
  // Derived from connectionPhase - kept for consumers that only care about one axis
  isConnected: boolean;
  isRecovering: boolean;
  isSessionReady: boolean;
  // Call-time guard for editors/actions that may outlive a render or session.
  isCurrentSession: () => boolean;
  canEditSession: () => boolean;
  serverUrl: string;
  studentAppUrl: string | null;  // URL where students should connect

  // Room management
  activeRooms: Map<string, ActiveRoom>;

  // Session methods
  // Get-or-create. `replace` asks for a new session even if one is stored,
  // for when the server has said the stored one is gone.
  createSession: (options?: { replace?: boolean }) => Promise<string | null>;
  recoverSession: (code: string) => Promise<boolean>;
  closeSession: () => void;

  // Room methods
  createRoom: (roomType: string, widgetId: string) => Promise<boolean>;
  closeRoom: (roomType: string, widgetId: string) => void;
  updateRoomState: (roomType: string, widgetId: string, isActive: boolean) => void;

  // Widget recovery
  getWidgetRecoveryData: (widgetId: string) => ActiveRoom | null;
  releaseWidgetRecoveryData: (widgetId: string) => void;

  // Error state
  error: string | null;
}

/**
 * The server's `session:createRoom` acknowledgement. `roomData` is the room
 * snapshot when the room already existed (a rejoin).
 */
export interface CreateRoomResponse {
  success: boolean;
  error?: string;
  roomData?: ActiveRoom['roomData'];
}
