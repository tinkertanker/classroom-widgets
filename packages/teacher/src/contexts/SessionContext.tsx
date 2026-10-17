import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useWorkspaceStore } from '../store/workspaceStore.simple';
import { useWorkspaceUiStore } from '../store/workspaceUiStore';
import { debug } from '@shared/utils/debug';
import type { SessionCreatedResponse } from '@shared/types/socket.types';
import type { ActiveRoom, ConnectionPhase, CreateRoomResponse, SessionContextValue } from './session/sessionTypes';
import { readStoredHostToken, writeStoredHostToken, hostTokenForCode } from './session/hostToken';
import { hmrFallbackSession } from './session/hmrFallbackSession';
import { useOrphanedRoomCleanup } from './session/useOrphanedRoomCleanup';
import {
  MAX_RECOVERY_ATTEMPTS,
  SESSION_ENDED_MESSAGE,
  abortableDelay,
  isAbortError,
  requestSessionReclaim,
  retryDelayAfterThrottle,
  roomsFromRecovery
} from './session/sessionRecovery';
import { useSessionRoomEvents } from './session/useSessionRoomEvents';

export { isRecoverySettled } from './session/sessionTypes';
export type { ActiveRoom, ConnectionPhase, SessionContextValue } from './session/sessionTypes';

const SessionContext = createContext<SessionContextValue | null>(null);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    // During HMR, provide a fallback to prevent errors during hot reload
    if (import.meta.env.DEV) {
      console.warn('useSession called during HMR reload, context temporarily unavailable');
      // Return a minimal fallback context to prevent crashes
      return hmrFallbackSession;
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
  const serverUrl = useWorkspaceUiStore((state) => state.serverStatus.url);
  
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
  const hostTokenRef = useRef<string | null>(readStoredHostToken());

  // Persist the host reconnect token issued by session:create responses,
  // together with the session code it belongs to
  const storeHostToken = useCallback((token: string | null, code?: string | null) => {
    hostTokenRef.current = token;
    writeStoredHostToken(token, code);
  }, []);
  const setConnectionPhase = useCallback((phase: ConnectionPhase) => {
    connectionPhaseRef.current = phase;
    setConnectionPhaseState(phase);
  }, []);
  const isCreatingSession = useRef(false);
  // The in-flight session:create, so a concurrent caller can wait for it
  const creatingSessionRef = useRef<Promise<string | null> | null>(null);
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

  // Editors can retry an unreclaimed session, but never a replaced identity.
  const isCurrentSession = useCallback(() => (
    socketRef.current === socket && sessionCodeRef.current === sessionCode
  ), [sessionCode, socket]);

  // No classroom means local editing is allowed, even offline. Otherwise the
  // current socket must have reclaimed this identity. Read phase at call time:
  // modal content retains callbacks from before disconnect/recovery.
  const canEditSession = useCallback(() => (
    isCurrentSession() &&
    (!sessionCode || (Boolean(socket?.connected) && connectionPhaseRef.current === 'recovered'))
  ), [sessionCode, socket, isCurrentSession]);

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
  useSessionRoomEvents(socket, setActiveRooms, () => {
    // The host socket is in the session room, so closing our own session
    // echoes back here after closeSession has already cleared it. Acting on
    // the echo would report our own close as an error and abort a session
    // the teacher has already started creating in its place.
    if (!sessionCodeRef.current) return;
    debug('[UnifiedSession] Session closed by host');
    cancelSessionWork();
    clearSession();
    setConnectionPhase(socket?.connected ? 'connected' : 'disconnected');
    setError('Session has been closed');
  });

  // Clear session - defined before attemptSessionRecovery to avoid circular dependency.
  // `keepStorage` ends the session in this tab only, leaving the stored code
  // and token that another tab now holds.
  const clearSession = useCallback(({ keepStorage = false }: { keepStorage?: boolean } = {}) => {
    sessionCodeRef.current = null;
    setSessionCode(null);
    setSessionCreatedAt(null);
    setStudentAppUrl(null);
    setActiveRooms(new Map());
    setRecoveryData(new Map());
    if (keepStorage) {
      hostTokenRef.current = null;
      return;
    }
    setStoreSessionCode(null);
    storeHostToken(null);
  }, [setStoreSessionCode, storeHostToken]);

  // Record a room we know exists from a createRoom acknowledgement.
  // The server only broadcasts session:roomCreated for genuinely new rooms, so
  // rejoining an existing room would otherwise leave no activeRooms entry for
  // participant counts to land on.
  const rememberRoom = useCallback((roomType: string, widgetId: string, roomData: ActiveRoom['roomData']) => {
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
      // Attempt recovery with retries
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= MAX_RECOVERY_ATTEMPTS; attempt++) {
        if (signal.aborted) return false;

        debug(`[Session] Recovery attempt ${attempt}/${MAX_RECOVERY_ATTEMPTS}`);
        let retryDelay = 1000 * attempt;
        const sentToken = hostTokenForCode(code, hostTokenRef.current);

        try {
          // reclaimOnly: if the server no longer holds this session it says
          // so, rather than handing the teacher a session they never started
          const response = await requestSessionReclaim(
            socket,
            { existingCode: code, hostToken: sentToken, reclaimOnly: true },
            signal,
            attempt
          );
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
              storeHostToken(response.hostToken, response.code);
            }

            // Check if this is actually recovery of existing session. A server
            // that predates reclaimOnly still answers a gone session with a new
            // one (isExisting: false); adopt it rather than fail.
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
            const rooms = roomsFromRecovery(response.activeRooms);
            setActiveRooms(rooms);
            setRecoveryData(new Map(rooms));
            return completeRecovery('recovered');
          }

          lastError = new Error(response.error);
          if (response.retryAfter === undefined) {
            // Terminal rejection: the stored session is gone. Only forget the
            // stored copy if it still holds the token we sent (tokens are
            // unique, so that is this session's pair); otherwise another tab
            // has moved on and owns it.
            debug.error('[UnifiedSession] Failed to recover session:', response.error);
            const storedNow = readStoredHostToken();
            clearSession({ keepStorage: storedNow !== null && storedNow !== sentToken });
            setError(SESSION_ENDED_MESSAGE);
            return completeRecovery('recovery-failed');
          }

          // Defer until an explicit retry or reconnect on an unusable hint
          const throttledDelay = retryDelayAfterThrottle(retryDelay, response.retryAfter);
          if (throttledDelay === null) break;
          retryDelay = throttledDelay;
        } catch (attemptError: unknown) {
          if (signal.aborted || isAbortError(attemptError)) {
            return false;
          }

          lastError = attemptError instanceof Error ? attemptError : new Error(String(attemptError));
          debug(`[Session] Recovery attempt ${attempt} failed:`, lastError.message);
        }
        if (attempt < MAX_RECOVERY_ATTEMPTS) {
          debug(`[Session] Waiting ${retryDelay}ms before retry...`);
          await abortableDelay(retryDelay, signal);
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

  // Close rooms whose widgets have left the board
  useOrphanedRoomCleanup({ socket, sessionCode, connectionPhase, setActiveRooms });

  // Create session
  const createSession = useCallback(async ({ replace = false }: { replace?: boolean } = {}): Promise<string | null> => {
    if (!socket?.connected) {
      debug.error('[UnifiedSession] Cannot create session - not connected');
      return null;
    }
    // Another widget is already creating one: share its result
    if (isCreatingSession.current && creatingSessionRef.current) {
      return creatingSessionRef.current;
    }

    // This is get-or-create for widgets; do not cancel a valid recovery merely
    // because another widget asks for the same session. The ref observes close
    // and new intents immediately, even before React has rendered them.
    const currentCode = sessionCodeRef.current;
    if (currentCode && !replace) {
      return currentCode;
    }

    cancelSessionWork();
    const controller = new AbortController();
    sessionAbortControllerRef.current = controller;
    const signal = controller.signal;
    isCreatingSession.current = true;
    setError(null);
    
    const creation = (async (): Promise<string | null> => { try {
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
              storeHostToken(response.hostToken, response.code);
            }
            // isExisting: this socket already hosts that session (a second
            // "Session not found" replace), so its live rooms stay
            const sameSession = response.isExisting && response.code === sessionCodeRef.current;
            setSessionCode(response.code);
            if (!sameSession) setSessionCreatedAt(Date.now());
            setStoreSessionCode(response.code);
            sessionCodeRef.current = response.code; // Update ref immediately
            // A brand new session needs no recovery, so it is already settled
            if (connectionPhaseRef.current !== 'disconnected') {
              setConnectionPhase('recovered');
            }
            if (!sameSession) {
              setActiveRooms(new Map());
              setRecoveryData(new Map()); // Clear any old recovery data
            }
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
    } })();
    creatingSessionRef.current = creation;
    creation.finally(() => {
      if (creatingSessionRef.current === creation) creatingSessionRef.current = null;
    });
    return creation;
  }, [socket, setStoreSessionCode, setConnectionPhase, storeHostToken, cancelSessionWork]);

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
      }, (response: CreateRoomResponse) => {
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
            createSession({ replace: true }).then(newSessionCode => {
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
                }, (retryResponse: CreateRoomResponse) => {
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

  // The recovery snapshot is only newer than a widget's saved state until that
  // widget has restored from it. The widget then drops it, so a remount
  // (layout switch, compact overlay) keeps its newer saved state.
  const releaseWidgetRecoveryData = useCallback((widgetId: string) => {
    setRecoveryData(prev => {
      if (!prev.has(widgetId)) return prev;
      const next = new Map(prev);
      next.delete(widgetId);
      return next;
    });
  }, []);
  
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
    isCurrentSession,
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
    releaseWidgetRecoveryData,
    
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
    isCurrentSession,
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
    releaseWidgetRecoveryData,
    error
  ]);
  
  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};
