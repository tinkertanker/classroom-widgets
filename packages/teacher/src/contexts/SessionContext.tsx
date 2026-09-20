import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useWorkspaceStore } from '../store/workspaceStore.simple';
import { debug } from '@shared/utils/debug';
import { WidgetType } from '@shared/types';
import type { SessionCreatedResponse } from '@shared/types/socket.types';

interface ActiveRoom {
  roomType: string;
  widgetId: string;
  isActive: boolean;
  participantCount: number;
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

interface SessionContextValue {
  // Session state
  sessionCode: string | null;
  sessionCreatedAt: number | null;
  isHost: boolean;

  // Connection state
  socket: any;
  connectionPhase: ConnectionPhase;
  // Derived from connectionPhase - kept for consumers that only care about one axis
  isConnected: boolean;
  isRecovering: boolean;
  isSessionReady: boolean;
  // Call-time guard for editors/actions that may outlive a render or session.
  canEditSession: () => boolean;
  serverUrl: string;
  studentAppUrl: string | null;  // URL where students should connect

  // Room management
  activeRooms: Map<string, ActiveRoom>;

  // Session methods
  createSession: () => Promise<string | null>;
  recoverSession: (code: string) => Promise<boolean>;
  closeSession: () => void;
  
  // Room methods
  createRoom: (roomType: string, widgetId: string) => Promise<boolean>;
  closeRoom: (roomType: string, widgetId: string) => void;
  updateRoomState: (roomType: string, widgetId: string, isActive: boolean) => void;
  
  // Widget recovery
  getWidgetRecoveryData: (widgetId: string) => ActiveRoom | null;
  
  // Error state
  error: string | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const HOST_TOKEN_STORAGE_KEY = 'classroom-widgets:hostToken';

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    // During HMR, provide a fallback to prevent errors during hot reload
    if (import.meta.env.DEV) {
      console.warn('useSession called during HMR reload, context temporarily unavailable');
      // Return a minimal fallback context to prevent crashes
      return {
        sessionCode: null,
        sessionCreatedAt: null,
        isHost: false,
        socket: null,
        connectionPhase: 'disconnected',
        isConnected: false,
        isRecovering: false,
        isSessionReady: false,
        canEditSession: () => true,
        serverUrl: '',
        studentAppUrl: null,
        activeRooms: new Map(),
        createSession: async () => null,
        recoverSession: async () => false,
        closeSession: () => {},
        createRoom: async () => false,
        closeRoom: () => {},
        updateRoomState: () => {},
        getWidgetRecoveryData: () => null,
        error: null
      } as SessionContextValue;
    }
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
};

interface SessionProviderProps {
  children: React.ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const { socket } = useSocket();
  
  // Session state from store
  const storeSessionCode = useWorkspaceStore((state) => state.sessionCode);
  const storeSessionCreatedAt = useWorkspaceStore((state) => state.sessionCreatedAt);
  const setStoreSessionCode = useWorkspaceStore((state) => state.setSessionCode);
  const serverUrl = useWorkspaceStore((state) => state.serverStatus.url);
  
  // Local state
  const [sessionCode, setSessionCode] = useState<string | null>(storeSessionCode);
  const [sessionCreatedAt, setSessionCreatedAtState] = useState<number | null>(storeSessionCreatedAt);
  const [studentAppUrl, setStudentAppUrl] = useState<string | null>(null);
  const [connectionPhase, setConnectionPhaseState] = useState<ConnectionPhase>('disconnected');
  const [activeRooms, setActiveRooms] = useState<Map<string, ActiveRoom>>(new Map());
  const [recoveryData, setRecoveryData] = useState<Map<string, ActiveRoom>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Derived connection state - never stored separately, so the two can never disagree
  const isConnected = connectionPhase !== 'disconnected';
  const isRecovering = connectionPhase === 'recovering';
  const isSessionReady = connectionPhase === 'recovered' && Boolean(sessionCode);

  // Refs
  // Mirror of connectionPhase for the socket callbacks and the recovery routine:
  // they run outside the render cycle and would otherwise read a stale phase
  // (handleConnect in particular has to reset the phase and immediately act on it).
  const connectionPhaseRef = useRef<ConnectionPhase>('disconnected');
  const hostTokenRef = useRef<string | null>(localStorage.getItem(HOST_TOKEN_STORAGE_KEY));

  // Persist the host reconnect token issued by session:create responses
  const storeHostToken = useCallback((token: string | null) => {
    hostTokenRef.current = token;
    if (token) {
      localStorage.setItem(HOST_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(HOST_TOKEN_STORAGE_KEY);
    }
  }, []);
  const setConnectionPhase = useCallback((phase: ConnectionPhase) => {
    connectionPhaseRef.current = phase;
    setConnectionPhaseState(phase);
  }, []);
  const isCreatingSession = useRef(false);
  const sessionCodeRef = useRef(sessionCode);
  const sessionCreatedAtRef = useRef(sessionCreatedAt);
  const setSessionCreatedAt = useCallback((createdAt: number | null) => {
    sessionCreatedAtRef.current = createdAt;
    setSessionCreatedAtState(createdAt);
  }, []);
  const socketRef = useRef(socket);
  socketRef.current = socket;
  const recoveryPromiseRef = useRef<Promise<boolean> | null>(null);
  const recoveryResolveRef = useRef<((success: boolean) => void) | null>(null);

  // No classroom means local editing is allowed, even offline. Otherwise the
  // current socket must have reclaimed this identity. Read phase at call time:
  // modal content retains callbacks from before disconnect/recovery.
  const canEditSession = useCallback(() => (
    socketRef.current === socket && sessionCodeRef.current === sessionCode &&
    (!sessionCode || (Boolean(socket?.connected) && connectionPhaseRef.current === 'recovered'))
  ), [sessionCode, socket]);

  // Constants
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const RECOVERY_TIMEOUT = 5000; // 5 seconds per attempt
  const MAX_RECOVERY_ATTEMPTS = 3;
  // Retain the signal after success so later room acknowledgements belong to
  // the same session intent, and cannot update a closed or replaced session.
  const sessionAbortControllerRef = useRef<AbortController | null>(null);

  const cancelSessionWork = useCallback(() => {
    sessionAbortControllerRef.current?.abort();
    sessionAbortControllerRef.current = null;
    isCreatingSession.current = false;
    recoveryResolveRef.current?.(false);
    recoveryResolveRef.current = null;
    recoveryPromiseRef.current = null;
  }, []);

  // Socket replacement and unmount invalidate work, but a normal render must
  // not abort recovery. Reset the ref for the StrictMode cleanup/setup cycle.
  useEffect(() => () => {
    cancelSessionWork();
    connectionPhaseRef.current = 'disconnected';
  }, [socket, cancelSessionWork]);
  
  // Sync with store
  useEffect(() => {
    if (sessionCodeRef.current !== storeSessionCode) {
      cancelSessionWork();
      setActiveRooms(new Map());
      setRecoveryData(new Map());
      setStudentAppUrl(null);
      if (!storeSessionCode) storeHostToken(null);
      setConnectionPhase(socket?.connected ? 'connected' : 'disconnected');
    }
    setSessionCode(storeSessionCode);
    setSessionCreatedAt(storeSessionCreatedAt);
    sessionCodeRef.current = storeSessionCode; // Keep ref in sync
  }, [storeSessionCode, storeSessionCreatedAt]);
  
  // Socket connection management
  useEffect(() => {
    if (!socket) return;
    
    const handleConnect = () => {
      cancelSessionWork();
      // 'connected' also means "no recovery attempted yet", which is what lets
      // recovery run again after a reconnect
      setConnectionPhase('connected');

      // Attempt recovery if we have a session
      if (sessionCode && sessionCreatedAt) {
        attemptSessionRecovery();
      }
    };

    const handleDisconnect = () => {
      cancelSessionWork();
      setConnectionPhase('disconnected');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Sync with the socket's current state. This effect re-runs whenever the
    // session code changes, so only move to 'connected' from 'disconnected' -
    // otherwise a completed recovery would be reset back to "not attempted".
    if (!socket.connected) {
      cancelSessionWork();
      setConnectionPhase('disconnected');
    } else if (connectionPhaseRef.current === 'disconnected') {
      setConnectionPhase('connected');
    }

    // Trigger initial recovery if connected and not attempted yet
    if (socket.connected && sessionCode && connectionPhaseRef.current === 'connected') {
      attemptSessionRecovery();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, sessionCode, sessionCreatedAt]);
  
  // Socket event listeners for room updates
  useEffect(() => {
    if (!socket) return;
    
    const handleRoomCreated = (data: { roomType: string; widgetId: string; roomData: any }) => {
      console.log('[UnifiedSession] Received session:roomCreated event:', data);
      setActiveRooms(prev => {
        const next = new Map(prev);
        next.set(data.widgetId, {
          roomType: data.roomType,
          widgetId: data.widgetId,
          isActive: data.roomData?.isActive || false,
          participantCount: data.roomData?.participantCount || 0,
          roomData: data.roomData
        });
        console.log('[UnifiedSession] Updated activeRooms:', Array.from(next.keys()));
        return next;
      });
    };

    const handleRoomClosed = (data: { roomType: string; widgetId: string }) => {
      // The participant count lives on the room entry, so removing the room
      // cannot leave a stale count behind
      setActiveRooms(prev => {
        const next = new Map(prev);
        next.delete(data.widgetId);
        return next;
      });
    };

    const handleWidgetStateChanged = (data: { roomType: string; widgetId: string; isActive: boolean }) => {
      setActiveRooms(prev => {
        const next = new Map(prev);
        const room = next.get(data.widgetId);
        if (room) {
          room.isActive = data.isActive;
        }
        return next;
      });
    };
    
    const handleParticipantUpdate = (data: { count: number; roomType: string; widgetId?: string }) => {
      if (!data.widgetId) return;
      // Patch the existing room only. Session-level participant updates arrive
      // without a widgetId and are ignored; a room-scoped update for a widget we
      // have no room for would only create an entry nothing can ever clean up.
      setActiveRooms(prev => {
        const room = prev.get(data.widgetId!);
        if (!room) return prev;
        const next = new Map(prev);
        next.set(data.widgetId!, { ...room, participantCount: data.count });
        return next;
      });
    };

    const handleSessionClosed = () => {
      debug('[UnifiedSession] Session closed by host');
      cancelSessionWork();
      clearSession();
      setConnectionPhase(socket.connected ? 'connected' : 'disconnected');
      setError('Session has been closed');
    };
    
    socket.on('session:roomCreated', handleRoomCreated);
    socket.on('session:roomClosed', handleRoomClosed);
    socket.on('session:widgetStateChanged', handleWidgetStateChanged);
    socket.on('session:participantUpdate', handleParticipantUpdate);
    socket.on('session:closed', handleSessionClosed);
    
    return () => {
      socket.off('session:roomCreated', handleRoomCreated);
      socket.off('session:roomClosed', handleRoomClosed);
      socket.off('session:widgetStateChanged', handleWidgetStateChanged);
      socket.off('session:participantUpdate', handleParticipantUpdate);
      socket.off('session:closed', handleSessionClosed);
    };
  }, [socket]);
  
  // Helper function for delay with abort support
  const delay = (ms: number, signal?: AbortSignal): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Aborted'));
        return;
      }
      const onAbort = () => {
        clearTimeout(timeout);
        reject(new Error('Aborted'));
      };
      // Detach the abort listener once the delay completes — recovery retries
      // reuse the same signal, so leaked listeners would accumulate and fire
      // stale rejections on a later abort
      const timeout = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  };

  // Clear session - defined before attemptSessionRecovery to avoid circular dependency
  const clearSession = useCallback(() => {
    sessionCodeRef.current = null;
    setSessionCode(null);
    setSessionCreatedAt(null);
    setStudentAppUrl(null);
    setStoreSessionCode(null);
    setActiveRooms(new Map());
    setRecoveryData(new Map());
    storeHostToken(null);
  }, [setStoreSessionCode, storeHostToken]);

  // Record a room we know exists from a createRoom acknowledgement.
  // The server only broadcasts session:roomCreated for genuinely new rooms, so
  // rejoining an existing room would otherwise leave no activeRooms entry for
  // participant counts to land on.
  const rememberRoom = useCallback((roomType: string, widgetId: string, roomData: any) => {
    setActiveRooms(prev => {
      const existing = prev.get(widgetId);
      const next = new Map(prev);
      next.set(widgetId, {
        roomType,
        widgetId,
        isActive: roomData?.isActive ?? existing?.isActive ?? false,
        participantCount: roomData?.participantCount ?? existing?.participantCount ?? 0,
        roomData: roomData ?? existing?.roomData
      });
      return next;
    });
  }, []);

  // Three requests per recovery run. Transport errors use 1s/2s backoff;
  // throttles also honor the server's millisecond retryAfter window.
  const attemptSessionRecovery = useCallback(async (
    code = sessionCodeRef.current,
    createdAt = sessionCreatedAt
  ): Promise<boolean> => {
    // 'connected' is the only phase from which a recovery attempt is due:
    // anything else is either offline, already in flight, or already settled
    if (!code || !createdAt || !socket?.connected || connectionPhaseRef.current !== 'connected') {
      return false;
    }

    cancelSessionWork();
    const controller = new AbortController();
    sessionAbortControllerRef.current = controller;
    const signal = controller.signal;

    // Each run owns its waiters. Cancellation resolves the old run before a
    // new one can start, rather than leaving createRoom waiting indefinitely.
    recoveryPromiseRef.current = new Promise((resolve) => {
      recoveryResolveRef.current = resolve;
    });

    setConnectionPhase('recovering');
    debug('[UnifiedSession] Attempting session recovery for:', code);

    const completeRecovery = (phase: 'recovered' | 'recovery-failed' | 'recovery-deferred') => {
      if (signal.aborted || sessionAbortControllerRef.current !== controller) return false;
      setConnectionPhase(phase);
      const success = phase === 'recovered';
      recoveryResolveRef.current?.(success);
      recoveryResolveRef.current = null;
      recoveryPromiseRef.current = null;
      return success;
    };

    try {
      // Check session age
      const sessionAge = Date.now() - createdAt;
      if (sessionAge > TWO_HOURS) {
        debug('[UnifiedSession] Session too old, clearing');
        clearSession();
        return completeRecovery('recovery-failed');
      }

      // Attempt recovery with retries
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= MAX_RECOVERY_ATTEMPTS; attempt++) {
        if (signal.aborted) return false;

        debug(`[Session] Recovery attempt ${attempt}/${MAX_RECOVERY_ATTEMPTS}`);
        let retryDelay = 1000 * attempt;

        try {
          const response = await new Promise<SessionCreatedResponse>((resolve, reject) => {
            // Set up timeout for this attempt; detach the abort listener on
            // this path too — the signal is shared across retry attempts
            const timeoutId = setTimeout(() => {
              signal.removeEventListener('abort', abortHandler);
              reject(new Error(`Recovery attempt ${attempt} timed out`));
            }, RECOVERY_TIMEOUT);

            // Handle abort
            const abortHandler = () => {
              clearTimeout(timeoutId);
              reject(new Error('Aborted'));
            };
            signal.addEventListener('abort', abortHandler, { once: true });

            // Attempt to rejoin session
            socket.emit('session:create', { existingCode: code, hostToken: hostTokenRef.current }, (result: SessionCreatedResponse) => {
              clearTimeout(timeoutId);
              signal.removeEventListener('abort', abortHandler);

              if (signal.aborted) {
                reject(new Error('Aborted'));
                return;
              }

              resolve(result);
            });
          });
          // Cancellation may happen after the callback resolves but before
          // this continuation runs. No state or token writes before this check.
          if (signal.aborted) return false;

          // Handle successful response
          if (response.success) {
            // Update studentAppUrl from server response
            if (response.studentAppUrl) {
              setStudentAppUrl(response.studentAppUrl);
            }
            if (response.hostToken) {
              storeHostToken(response.hostToken);
            }

            // Check if this is actually recovery of existing session
            // If isExisting is false, the server created a new session (old one was gone)
            if (!response.isExisting) {
              debug('[Session] Old session not found, server created new session. Clearing stale state.');
              // Update to use the new session code from server
              setSessionCode(response.code);
              setSessionCreatedAt(Date.now());
              setStoreSessionCode(response.code);
              sessionCodeRef.current = response.code;
              setActiveRooms(new Map());
              setRecoveryData(new Map());
              return completeRecovery('recovered');
            }

            debug('[Session] Recovery - Session rejoined successfully');

            // Store recovery data separately - this is a snapshot from the server
            const recoveryMap = new Map<string, ActiveRoom>();
            const roomsMap = new Map<string, ActiveRoom>();

            (response.activeRooms || []).forEach((roomInfo) => {
              if (roomInfo.widgetId) {
                const room: ActiveRoom = {
                  roomType: roomInfo.roomType,
                  widgetId: roomInfo.widgetId,
                  isActive: roomInfo.room?.isActive || false,
                  participantCount: roomInfo.room?.participantCount || 0,
                  roomData: roomInfo.room
                };
                roomsMap.set(roomInfo.widgetId, room);
                recoveryMap.set(roomInfo.widgetId, room);
              }
            });

            setActiveRooms(roomsMap);
            setRecoveryData(recoveryMap);
            return completeRecovery('recovered');
          }

          lastError = new Error(response.error);
          if (response.retryAfter === undefined) {
            // Preserve the existing terminal rejection/authentication behavior.
            debug.error('[UnifiedSession] Failed to recover session:', response.error);
            clearSession();
            return completeRecovery('recovery-failed');
          }

          // Invalid/overflowing timer hints must not turn into a hot loop or
          // destructive cleanup. Defer until an explicit retry or reconnect.
          if (!Number.isFinite(response.retryAfter) || response.retryAfter < 0 || response.retryAfter > 2_147_483_646) break;
          // The fixed window expires at age > windowMs. Cross that boundary by
          // 1ms; retain backoff for retryAfter: 0 instead of immediately retrying.
          retryDelay = Math.max(retryDelay, Math.ceil(response.retryAfter) + 1);
        } catch (attemptError: any) {
          if (signal.aborted || attemptError.message === 'Aborted') {
            return false;
          }

          lastError = attemptError;
          debug(`[Session] Recovery attempt ${attempt} failed:`, attemptError.message);
        }
        if (attempt < MAX_RECOVERY_ATTEMPTS) {
          debug(`[Session] Waiting ${retryDelay}ms before retry...`);
          await delay(retryDelay, signal);
        }
      }

      // A throttle or transport timeout is not proof that the session is gone.
      // Stop automatic work, release waiters, and keep state for the next run.
      debug.error('[UnifiedSession] All recovery attempts failed:', lastError?.message);
      return completeRecovery('recovery-deferred');

    } catch (error) {
      if (signal.aborted) return false;
      debug.error('[UnifiedSession] Recovery error:', error);
      return completeRecovery('recovery-deferred');
    }
  }, [sessionCreatedAt, socket, setConnectionPhase, clearSession, cancelSessionWork, setStoreSessionCode, storeHostToken]);

  // Clean up orphaned rooms - called after recovery or when widgets are deleted
  // Uses the new session:cleanupRooms event for more efficient server-side cleanup
  const cleanupOrphanedRooms = useCallback(() => {
    if (!socket?.connected || !sessionCode) return;

    // Get current widgets from store
    // These are the widget types that create server-side rooms
    const networkedWidgetTypes = [
      WidgetType.POLL,
      WidgetType.QUESTIONS,
      WidgetType.RT_FEEDBACK,
      WidgetType.LINK_SHARE,
      WidgetType.HANDOUT,
      WidgetType.FILL_BLANK,
      WidgetType.CODE_FILL_BLANK,
      WidgetType.SORTING,
      WidgetType.SEQUENCING,
      WidgetType.MATCHING
    ];
    const currentWidgets = useWorkspaceStore.getState().widgets;
    const networkedWidgetIds = currentWidgets
      .filter((w: any) => networkedWidgetTypes.includes(w.type))
      .map((w: any) => w.id);

    console.log('[UnifiedSession] cleanupOrphanedRooms: Found networked widgets:', networkedWidgetIds);
    console.log('[UnifiedSession] cleanupOrphanedRooms: Current activeRooms:', Array.from(activeRooms.keys()));

    // Send cleanup request to server with list of active widget IDs
    // Server will close any rooms not in this list
    socket.emit('session:cleanupRooms', {
      sessionCode,
      activeWidgetIds: networkedWidgetIds
    });

    // Update local state to remove orphaned rooms
    setActiveRooms(prev => {
      const next = new Map(prev);
      let hasChanges = false;
      prev.forEach((_, widgetId) => {
        if (!networkedWidgetIds.includes(widgetId)) {
          debug('[UnifiedSession] Removing orphaned room from local state:', widgetId);
          next.delete(widgetId);
          hasChanges = true;
        }
      });
      return hasChanges ? next : prev;
    });

    debug('[UnifiedSession] Orphaned room cleanup complete');
  }, [socket, sessionCode]);

  // Schedule cleanup after recovery completes and widgets have had time to mount
  // This handles the case where widgets were deleted while offline
  useEffect(() => {
    console.log('[UnifiedSession] Cleanup useEffect triggered:', {
      connectionPhase,
      socketConnected: socket?.connected,
      sessionCode
    });

    // Only run once the session is established (recovered or freshly created)
    if (connectionPhase !== 'recovered') {
      console.log('[UnifiedSession] Cleanup skipped: not ready');
      return;
    }
    if (!socket?.connected || !sessionCode) {
      console.log('[UnifiedSession] Cleanup skipped: no socket or session');
      return;
    }

    // Wait for widgets to mount before cleaning up orphaned rooms
    // This delay ensures React has rendered all widgets before we check
    console.log('[UnifiedSession] Scheduling cleanup in 2 seconds...');
    const cleanupTimer = setTimeout(() => {
      console.log('[UnifiedSession] Running post-recovery cleanup NOW');
      cleanupOrphanedRooms();
    }, 2000); // 2 second delay to allow widgets to mount

    return () => {
      console.log('[UnifiedSession] Cleanup timer cancelled');
      clearTimeout(cleanupTimer);
    };
  }, [connectionPhase, socket?.connected, sessionCode, cleanupOrphanedRooms]);

  // Create session
  const createSession = useCallback(async (): Promise<string | null> => {
    if (!socket?.connected || isCreatingSession.current) {
      debug.error('[UnifiedSession] Cannot create session - not connected or already creating');
      return null;
    }

    // This is get-or-create for widgets; do not cancel a valid recovery merely
    // because another widget asks for the same session. The ref observes close
    // and new intents immediately, even before React has rendered them.
    const currentCode = sessionCodeRef.current;
    if (currentCode && sessionCreatedAt && Date.now() - sessionCreatedAt < TWO_HOURS) {
      return currentCode;
    }

    cancelSessionWork();
    const controller = new AbortController();
    sessionAbortControllerRef.current = controller;
    const signal = controller.signal;
    isCreatingSession.current = true;
    setError(null);
    
    try {
      return await new Promise((resolve) => {
        const onAbort = () => resolve(null);
        signal.addEventListener('abort', onAbort, { once: true });
        socket.emit('session:create', {}, (response: SessionCreatedResponse) => {
          signal.removeEventListener('abort', onAbort);
          if (signal.aborted) return;
          isCreatingSession.current = false;

          if (response.success) {
            debug('[UnifiedSession] Session created:', response.code);
            if (response.hostToken) {
              storeHostToken(response.hostToken);
            }
            setSessionCode(response.code);
            setSessionCreatedAt(Date.now());
            setStoreSessionCode(response.code);
            sessionCodeRef.current = response.code; // Update ref immediately
            // A brand new session needs no recovery, so it is already settled
            if (connectionPhaseRef.current !== 'disconnected') {
              setConnectionPhase('recovered');
            }
            setActiveRooms(new Map());
            setRecoveryData(new Map()); // Clear any old recovery data
            // Store the student app URL from server response
            if (response.studentAppUrl) {
              setStudentAppUrl(response.studentAppUrl);
            }
            resolve(response.code);
          } else {
            debug.error('[UnifiedSession] Failed to create session:', response.error);
            setError(response.error || 'Failed to create session');
            resolve(null);
          }
        });
      });
    } catch (error) {
      if (signal.aborted) return null;
      isCreatingSession.current = false;
      debug.error('[UnifiedSession] Error creating session:', error);
      setError('Failed to create session');
      return null;
    }
  }, [socket, sessionCreatedAt, setStoreSessionCode, setConnectionPhase, storeHostToken, cancelSessionWork]);

  // Recover session (explicit)
  const recoverSession = useCallback(async (code: string): Promise<boolean> => {
    if (!socket?.connected) return false;

    cancelSessionWork();
    const sameSession = sessionCodeRef.current === code;
    const createdAt = sameSession ? sessionCreatedAtRef.current : Date.now();
    if (!sameSession) {
      setActiveRooms(new Map());
      setRecoveryData(new Map());
      setStudentAppUrl(null);
      sessionCodeRef.current = code;
      setSessionCode(code);
      setSessionCreatedAt(createdAt);
      setStoreSessionCode(code);
    }
    // Retrying the same identity must not renew its local/persisted age.
    // Back to "connected, not attempted" so recovery may run for the new code
    setConnectionPhase('connected');

    return attemptSessionRecovery(code, createdAt);
  }, [socket, setStoreSessionCode, setConnectionPhase, attemptSessionRecovery, cancelSessionWork]);
  
  // Close session
  const closeSession = useCallback(() => {
    cancelSessionWork();
    const code = sessionCodeRef.current;
    if (socket && code) {
      debug('[UnifiedSession] Closing session:', code);
      socket.emit('session:close', { sessionCode: code });
    }
    clearSession();
    setConnectionPhase(socket?.connected ? 'connected' : 'disconnected');
  }, [socket, clearSession, cancelSessionWork, setConnectionPhase]);
  
  // Create room
  const createRoom = useCallback(async (roomType: string, widgetId: string): Promise<boolean> => {
    const signal = sessionAbortControllerRef.current?.signal;
    // Wait for recovery to complete if in progress (use promise-based approach)
    if (recoveryPromiseRef.current) {
      debug('[UnifiedSession] Waiting for recovery to complete before creating room');
      if (!await recoveryPromiseRef.current) return false;
    }

    // Recovery may replace an expired session. Read the code after waiting and
    // do not emit for an aborted intent or an exhausted, unconfirmed recovery.
    const currentCode = sessionCodeRef.current;
    if (signal?.aborted || !socket?.connected || !currentCode || connectionPhaseRef.current !== 'recovered') {
      debug.error('[UnifiedSession] Cannot create room - session not established');
      return false;
    }

    console.log('[UnifiedSession] Emitting session:createRoom:', { sessionCode: currentCode, roomType, widgetId });
    return new Promise((resolve) => {
      console.log('[UnifiedSession] Setting up emit with callback...');
      socket.emit('session:createRoom', {
        sessionCode: currentCode,
        roomType,
        widgetId
      }, (response: any) => {
        if (signal?.aborted) {
          resolve(false);
          return;
        }
        console.log('[UnifiedSession] createRoom callback received:', response);
        if (response.success) {
          console.log('[UnifiedSession] Room created successfully');
          rememberRoom(roomType, widgetId, response.roomData);
          resolve(true);
        } else {
          debug.error('[UnifiedSession] Failed to create room:', response.error);

          // Check if the error is because the session doesn't exist
          if (response.error === 'Session not found' || response.error === 'Invalid session or not host') {
            debug.info('[UnifiedSession] Session not found, creating new session and retrying...');
            setError('Session expired. Creating new session...'); // Clear any previous error and show informative message

            // Create a new session and retry
            createSession().then(newSessionCode => {
              if (!socket.connected || sessionCodeRef.current !== newSessionCode) {
                resolve(false);
                return;
              }
              if (newSessionCode) {
                const retrySignal = sessionAbortControllerRef.current?.signal;
                debug.info('[UnifiedSession] New session created, retrying room creation...');
                setError(null); // Clear the temporary message
                // Retry the room creation with the new session code
                socket.emit('session:createRoom', {
                  sessionCode: newSessionCode,
                  roomType,
                  widgetId
                }, (retryResponse: any) => {
                  if (retrySignal?.aborted) {
                    resolve(false);
                    return;
                  }
                  if (retryResponse.success) {
                    rememberRoom(roomType, widgetId, retryResponse.roomData);
                    resolve(true);
                  } else {
                    debug.error('[UnifiedSession] Failed to create room even with new session:', retryResponse.error);
                    setError(retryResponse.error || 'Failed to create room');
                    resolve(false);
                  }
                });
              } else {
                debug.error('[UnifiedSession] Failed to create new session');
                if (!signal?.aborted) setError('Failed to create session. Please refresh the page.');
                resolve(false);
              }
            });
          } else {
            setError(response.error || 'Failed to create room');
            resolve(false);
          }
        }
      });
    });
  }, [socket, createSession, rememberRoom]);
  
  // Close room
  const closeRoom = useCallback((roomType: string, widgetId: string) => {
    if (!socket || !sessionCode || !canEditSession()) return;

    // Debug: log call stack to trace where closeRoom is being called from
    console.log('[UnifiedSession] Closing room:', widgetId, 'roomType:', roomType);
    console.log('[UnifiedSession] closeRoom call stack:', new Error().stack);
    socket.emit('session:closeRoom', {
      sessionCode,
      roomType,
      widgetId
    });
  }, [socket, sessionCode, canEditSession]);
  
  // Update room state
  const updateRoomState = useCallback((roomType: string, widgetId: string, isActive: boolean) => {
    if (!socket || !sessionCode || !canEditSession()) return;
    
    socket.emit('session:updateWidgetState', {
      sessionCode,
      roomType,
      widgetId,
      isActive
    });
  }, [socket, sessionCode, canEditSession]);
  
  // Get widget recovery data
  const getWidgetRecoveryData = useCallback((widgetId: string): ActiveRoom | null => {
    // Only return data from the recovery snapshot, not live activeRooms
    return recoveryData.get(widgetId) || null;
  }, [recoveryData]);
  
  const value = useMemo<SessionContextValue>(() => ({
    // Session state
    sessionCode,
    sessionCreatedAt,
    isHost: true,

    // Connection state
    socket,
    connectionPhase,
    isConnected,
    isRecovering,
    isSessionReady,
    canEditSession,
    serverUrl,
    studentAppUrl,

    // Room management
    activeRooms,

    // Session methods
    createSession,
    recoverSession,
    closeSession,
    
    // Room methods
    createRoom,
    closeRoom,
    updateRoomState,
    
    // Widget recovery
    getWidgetRecoveryData,
    
    // Error state
    error
  }), [
    sessionCode,
    sessionCreatedAt,
    socket,
    connectionPhase,
    isConnected,
    isRecovering,
    isSessionReady,
    canEditSession,
    serverUrl,
    studentAppUrl,
    activeRooms,
    createSession,
    recoverSession,
    closeSession,
    createRoom,
    closeRoom,
    updateRoomState,
    getWidgetRecoveryData,
    error
  ]);
  
  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};
