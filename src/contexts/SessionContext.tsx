import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useWorkspaceStore } from '../store/workspaceStore.simple';
import api from '../services/api';
import { debug } from '../shared/utils/debug';
import { WidgetType } from '../shared/types';

interface ActiveRoom {
  roomType: string;
  widgetId: string;
  isActive: boolean;
  roomData?: any;
}

interface SessionContextValue {
  // Session state
  sessionCode: string | null;
  sessionCreatedAt: number | null;
  isHost: boolean;

  // Connection state
  socket: any;
  isConnected: boolean;
  isConnecting: boolean;
  isRecovering: boolean;
  hasAttemptedRecovery: boolean;
  serverUrl: string;
  studentAppUrl: string | null;  // URL where students should connect
  
  // Room management
  activeRooms: Map<string, ActiveRoom>;
  participantCounts: Map<string, number>;
  
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
        isConnected: false,
        isConnecting: false,
        isRecovering: false,
        hasAttemptedRecovery: false,
        serverUrl: '',
        studentAppUrl: null,
        activeRooms: new Map(),
        participantCounts: new Map(),
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
  const [sessionCreatedAt, setSessionCreatedAt] = useState<number | null>(storeSessionCreatedAt);
  const [studentAppUrl, setStudentAppUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [activeRooms, setActiveRooms] = useState<Map<string, ActiveRoom>>(new Map());
  const [recoveryData, setRecoveryData] = useState<Map<string, ActiveRoom>>(new Map());
  const [participantCounts, setParticipantCounts] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);
    
  // Refs
  const hasAttemptedRecovery = useRef(false);
  const isCreatingSession = useRef(false);
  const sessionCodeRef = useRef(sessionCode);
  const isInitialRecoveryComplete = useRef(false);
  const recoveryPromiseRef = useRef<Promise<void> | null>(null);
  const recoveryResolveRef = useRef<(() => void) | null>(null);
  
  // Constants
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const RECOVERY_TIMEOUT = 5000; // 5 seconds per attempt
  const MAX_RECOVERY_ATTEMPTS = 3;
  const recoveryAbortControllerRef = useRef<AbortController | null>(null);
  
  // Sync with store
  useEffect(() => {
    setSessionCode(storeSessionCode);
    setSessionCreatedAt(storeSessionCreatedAt);
    sessionCodeRef.current = storeSessionCode; // Keep ref in sync
  }, [storeSessionCode, storeSessionCreatedAt]);
  
  // Socket connection management
  useEffect(() => {
    if (!socket) return;
    
    const handleConnect = () => {
      setIsConnected(true);
      setIsConnecting(false);
      
      // Attempt recovery if we have a session
      // Reset the recovery flag on reconnect to allow re-recovery
      if (sessionCode && sessionCreatedAt) {
        hasAttemptedRecovery.current = false;
        attemptSessionRecovery();
      }
    };
    
    const handleDisconnect = () => {
      setIsConnected(false);
      // Reset recovery state on disconnect
      setIsRecovering(false);
    };
    
    const handleConnecting = () => {
      setIsConnecting(true);
    };
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connecting', handleConnecting);
    
    // Set initial state
    setIsConnected(socket.connected);
    
    // Trigger initial recovery if connected
    if (socket.connected && sessionCode && !hasAttemptedRecovery.current) {
      attemptSessionRecovery();
    }
    
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connecting', handleConnecting);
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
          roomData: data.roomData
        });
        console.log('[UnifiedSession] Updated activeRooms:', Array.from(next.keys()));
        return next;
      });
    };
    
    const handleRoomClosed = (data: { roomType: string; widgetId: string }) => {
      setActiveRooms(prev => {
        const next = new Map(prev);
        next.delete(data.widgetId);
        return next;
      });
      setParticipantCounts(prev => {
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
      if (data.widgetId) {
        setParticipantCounts(prev => {
          const next = new Map(prev);
          next.set(data.widgetId!, data.count);
          return next;
        });
      }
    };
    
    const handleSessionClosed = () => {
      debug('[UnifiedSession] Session closed by host');
      clearSession();
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
      const timeout = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Aborted'));
        });
      }
    });
  };

  // Clear session - defined before attemptSessionRecovery to avoid circular dependency
  const clearSession = useCallback(() => {
    setSessionCode(null);
    setSessionCreatedAt(null);
    setStudentAppUrl(null);
    setStoreSessionCode(null);
    setActiveRooms(new Map());
    setRecoveryData(new Map());
    setParticipantCounts(new Map());
    hasAttemptedRecovery.current = false;
  }, [setStoreSessionCode]);

  // Session recovery with retry and exponential backoff
  const attemptSessionRecovery = useCallback(async () => {
    if (!sessionCode || !sessionCreatedAt || !socket?.connected || isRecovering || hasAttemptedRecovery.current) {
      return;
    }

    // Cancel any previous recovery attempt
    if (recoveryAbortControllerRef.current) {
      recoveryAbortControllerRef.current.abort();
    }
    recoveryAbortControllerRef.current = new AbortController();
    const signal = recoveryAbortControllerRef.current.signal;

    // Create a promise that resolves when recovery completes
    if (!recoveryPromiseRef.current) {
      recoveryPromiseRef.current = new Promise((resolve) => {
        recoveryResolveRef.current = resolve;
      });
    }

    hasAttemptedRecovery.current = true;
    setIsRecovering(true);
    debug('[UnifiedSession] Attempting session recovery for:', sessionCode);

    // Helper to complete recovery (success or failure)
    const completeRecovery = (success: boolean) => {
      if (signal.aborted) return;
      setIsRecovering(false);
      if (success) {
        isInitialRecoveryComplete.current = true;
      }
      if (recoveryResolveRef.current) {
        recoveryResolveRef.current();
        recoveryResolveRef.current = null;
        recoveryPromiseRef.current = null;
      }
      recoveryAbortControllerRef.current = null;
    };

    try {
      // Check session age
      const sessionAge = Date.now() - sessionCreatedAt;
      if (sessionAge > TWO_HOURS) {
        debug('[UnifiedSession] Session too old, clearing');
        clearSession();
        completeRecovery(false);
        return;
      }

      // Attempt recovery with retries
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= MAX_RECOVERY_ATTEMPTS; attempt++) {
        if (signal.aborted) return;

        debug(`[Session] Recovery attempt ${attempt}/${MAX_RECOVERY_ATTEMPTS}`);

        try {
          const response = await new Promise<any>((resolve, reject) => {
            // Set up timeout for this attempt
            const timeoutId = setTimeout(() => {
              reject(new Error(`Recovery attempt ${attempt} timed out`));
            }, RECOVERY_TIMEOUT);

            // Handle abort
            const abortHandler = () => {
              clearTimeout(timeoutId);
              reject(new Error('Aborted'));
            };
            signal.addEventListener('abort', abortHandler);

            // Attempt to rejoin session
            socket.emit('session:create', { existingCode: sessionCode }, (result: any) => {
              clearTimeout(timeoutId);
              signal.removeEventListener('abort', abortHandler);

              if (signal.aborted) {
                reject(new Error('Aborted'));
                return;
              }

              resolve(result);
            });
          });

          // Handle successful response
          if (response.success) {
            // Update studentAppUrl from server response
            if (response.studentAppUrl) {
              setStudentAppUrl(response.studentAppUrl);
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
              completeRecovery(true);
              return;
            }

            debug('[Session] Recovery - Session rejoined successfully');

            // Store recovery data separately - this is a snapshot from the server
            const recoveryMap = new Map<string, ActiveRoom>();
            const roomsMap = new Map<string, ActiveRoom>();

            (response.activeRooms || []).forEach((roomInfo: any) => {
              if (roomInfo.widgetId) {
                const room: ActiveRoom = {
                  roomType: roomInfo.roomType,
                  widgetId: roomInfo.widgetId,
                  isActive: roomInfo.room?.isActive || false,
                  roomData: roomInfo.room
                };
                roomsMap.set(roomInfo.widgetId, room);
                recoveryMap.set(roomInfo.widgetId, room);
              }
            });

            setActiveRooms(roomsMap);
            setRecoveryData(recoveryMap);
            completeRecovery(true);
            return;
          } else {
            // Server responded but with error
            debug.error('[UnifiedSession] Failed to recover session:', response.error);
            clearSession();
            completeRecovery(false);
            return;
          }
        } catch (attemptError: any) {
          if (signal.aborted || attemptError.message === 'Aborted') {
            return;
          }

          lastError = attemptError;
          debug(`[Session] Recovery attempt ${attempt} failed:`, attemptError.message);

          // If not the last attempt, wait with exponential backoff before retrying
          if (attempt < MAX_RECOVERY_ATTEMPTS) {
            const backoffMs = 1000 * attempt; // 1s, 2s, 3s
            debug(`[Session] Waiting ${backoffMs}ms before retry...`);
            try {
              await delay(backoffMs, signal);
            } catch {
              // Aborted during delay
              return;
            }
          }
        }
      }

      // All attempts failed - clear the stale session
      debug.error('[UnifiedSession] All recovery attempts failed:', lastError?.message);
      debug('[Session] Recovery timeout - clearing stale session');
      clearSession();
      completeRecovery(false);

    } catch (error) {
      if (signal.aborted) return;
      debug.error('[UnifiedSession] Recovery error:', error);
      clearSession();
      completeRecovery(false);
    }
  }, [sessionCode, sessionCreatedAt, socket, isRecovering, clearSession]);

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
      isInitialRecoveryComplete: isInitialRecoveryComplete.current,
      isRecovering,
      socketConnected: socket?.connected,
      sessionCode
    });

    // Only run after initial recovery is complete
    if (!isInitialRecoveryComplete.current || isRecovering) {
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
  }, [isRecovering, socket?.connected, sessionCode, cleanupOrphanedRooms]);

  // Create session
  const createSession = useCallback(async (): Promise<string | null> => {
    if (!socket?.connected || isCreatingSession.current) {
      debug.error('[UnifiedSession] Cannot create session - not connected or already creating');
      return null;
    }
    
    isCreatingSession.current = true;
    setError(null);
    
    try {
      // If we already have a valid session, return it
      if (sessionCode && sessionCreatedAt) {
        const sessionAge = Date.now() - sessionCreatedAt;
        if (sessionAge < TWO_HOURS) {
          isCreatingSession.current = false;
          return sessionCode;
        }
      }
      
      return await new Promise((resolve) => {
        socket.emit('session:create', {}, (response: any) => {
          isCreatingSession.current = false;

          if (response.success) {
            debug('[UnifiedSession] Session created:', response.code);
            setSessionCode(response.code);
            setSessionCreatedAt(Date.now());
            setStoreSessionCode(response.code);
            sessionCodeRef.current = response.code; // Update ref immediately
            isInitialRecoveryComplete.current = true; // No recovery needed for new session
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
      isCreatingSession.current = false;
      debug.error('[UnifiedSession] Error creating session:', error);
      setError('Failed to create session');
      return null;
    }
  }, [socket, sessionCode, sessionCreatedAt, setStoreSessionCode]);
  
  // Recover session (explicit)
  const recoverSession = useCallback(async (code: string): Promise<boolean> => {
    if (!socket?.connected) return false;
    
    setSessionCode(code);
    setSessionCreatedAt(Date.now());
    setStoreSessionCode(code);
    hasAttemptedRecovery.current = false;
    
    await attemptSessionRecovery();
    return true;
  }, [socket, setStoreSessionCode, attemptSessionRecovery]);
  
  // Close session
  const closeSession = useCallback(() => {
    if (!socket || !sessionCode) return;
    
    debug('[UnifiedSession] Closing session:', sessionCode);
    socket.emit('session:close', { sessionCode });
    clearSession();
  }, [socket, sessionCode, clearSession]);
  
  // Create room
  const createRoom = useCallback(async (roomType: string, widgetId: string): Promise<boolean> => {
    // Use ref to always get the current session code
    const currentCode = sessionCodeRef.current;

    console.log('[UnifiedSession] createRoom called:', { roomType, widgetId, currentCode, isRecovering });

    // Wait for recovery to complete if in progress (use promise-based approach)
    if (isRecovering && recoveryPromiseRef.current) {
      debug('[UnifiedSession] Waiting for recovery to complete before creating room');
      await recoveryPromiseRef.current;
    }

    if (!socket?.connected || !currentCode) {
      debug.error('[UnifiedSession] Cannot create room - no session or not connected', { currentCode, connected: socket?.connected });
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
        console.log('[UnifiedSession] createRoom callback received:', response);
        if (response.success) {
          console.log('[UnifiedSession] Room created successfully');
          resolve(true);
        } else {
          debug.error('[UnifiedSession] Failed to create room:', response.error);

          // Check if the error is because the session doesn't exist
          if (response.error === 'Session not found' || response.error === 'Invalid session or not host') {
            debug.info('[UnifiedSession] Session not found, creating new session and retrying...');
            setError('Session expired. Creating new session...'); // Clear any previous error and show informative message

            // Create a new session and retry
            createSession().then(newSessionCode => {
              if (newSessionCode) {
                debug.info('[UnifiedSession] New session created, retrying room creation...');
                setError(null); // Clear the temporary message
                // Retry the room creation with the new session code
                socket.emit('session:createRoom', {
                  sessionCode: newSessionCode,
                  roomType,
                  widgetId
                }, (retryResponse: any) => {
                  if (retryResponse.success) {
                    resolve(true);
                  } else {
                    debug.error('[UnifiedSession] Failed to create room even with new session:', retryResponse.error);
                    setError(retryResponse.error || 'Failed to create room');
                    resolve(false);
                  }
                });
              } else {
                debug.error('[UnifiedSession] Failed to create new session');
                setError('Failed to create session. Please refresh the page.');
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
  }, [socket, isRecovering, createSession]);
  
  // Close room
  const closeRoom = useCallback((roomType: string, widgetId: string) => {
    if (!socket || !sessionCode) return;

    // Debug: log call stack to trace where closeRoom is being called from
    console.log('[UnifiedSession] Closing room:', widgetId, 'roomType:', roomType);
    console.log('[UnifiedSession] closeRoom call stack:', new Error().stack);
    socket.emit('session:closeRoom', {
      sessionCode,
      roomType,
      widgetId
    });
  }, [socket, sessionCode]);
  
  // Update room state
  const updateRoomState = useCallback((roomType: string, widgetId: string, isActive: boolean) => {
    if (!socket || !sessionCode) return;
    
    socket.emit('session:updateWidgetState', {
      sessionCode,
      roomType,
      widgetId,
      isActive
    });
  }, [socket, sessionCode]);
  
  // Get widget recovery data
  const getWidgetRecoveryData = useCallback((widgetId: string): ActiveRoom | null => {
    // Only return data from the recovery snapshot, not live activeRooms
    return recoveryData.get(widgetId) || null;
  }, [recoveryData]);
  
  const value: SessionContextValue = {
    // Session state
    sessionCode,
    sessionCreatedAt,
    isHost: true,

    // Connection state
    socket,
    isConnected,
    isConnecting,
    isRecovering,
    hasAttemptedRecovery: hasAttemptedRecovery.current || isInitialRecoveryComplete.current,
    serverUrl,
    studentAppUrl,

    // Room management
    activeRooms,
    participantCounts,
    
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
  };
  
  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};