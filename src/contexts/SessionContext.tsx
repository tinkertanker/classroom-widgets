import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useWorkspaceStore } from '../store/workspaceStore.simple';
import api from '../services/api';
import { debug } from '../shared/utils/debug';

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
      setActiveRooms(prev => {
        const next = new Map(prev);
        next.set(data.widgetId, {
          roomType: data.roomType,
          widgetId: data.widgetId,
          isActive: data.roomData?.isActive || false,
          roomData: data.roomData
        });
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
  
  // Session recovery
  const attemptSessionRecovery = useCallback(async () => {
    if (!sessionCode || !sessionCreatedAt || !socket?.connected || isRecovering || hasAttemptedRecovery.current) {
      return;
    }

    // Create a promise that resolves when recovery completes
    if (!recoveryPromiseRef.current) {
      recoveryPromiseRef.current = new Promise((resolve) => {
        recoveryResolveRef.current = resolve;
      });
    }

    // Add timeout for recovery attempt
    const recoveryTimeout = setTimeout(() => {
      debug('[Session] Recovery timeout - falling back to normal state');
      setIsRecovering(false);
      hasAttemptedRecovery.current = true;
      // Resolve the promise on timeout
      if (recoveryResolveRef.current) {
        recoveryResolveRef.current();
        recoveryResolveRef.current = null;
        recoveryPromiseRef.current = null;
      }
    }, 2000); // 2 second timeout

    hasAttemptedRecovery.current = true;
    setIsRecovering(true);
    debug('[UnifiedSession] Attempting session recovery for:', sessionCode);
    
    try {
      // Check session age
      const sessionAge = Date.now() - sessionCreatedAt;
      if (sessionAge > TWO_HOURS) {
        debug('[UnifiedSession] Session too old, clearing');
        clearSession();
        setIsRecovering(false);
        clearTimeout(recoveryTimeout);
        // Resolve the promise when session is too old
        if (recoveryResolveRef.current) {
          recoveryResolveRef.current();
          recoveryResolveRef.current = null;
          recoveryPromiseRef.current = null;
        }
        return;
      }

      // Rejoin session directly via socket - let the server determine if it exists
      socket.emit('session:create', { existingCode: sessionCode }, (response: any) => {
        if (!response.success) {
          debug.error('[UnifiedSession] Failed to recover session:', response.error);
          clearSession();
          setIsRecovering(false);
          clearTimeout(recoveryTimeout);
          // Resolve the promise on failure
          if (recoveryResolveRef.current) {
            recoveryResolveRef.current();
            recoveryResolveRef.current = null;
            recoveryPromiseRef.current = null;
          }
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
            // Store in both maps
            roomsMap.set(roomInfo.widgetId, room);
            recoveryMap.set(roomInfo.widgetId, room);
          }
        });

        setActiveRooms(roomsMap);
        setRecoveryData(recoveryMap); // This won't change after recovery

        // Don't clean up orphaned rooms during initial recovery
        // This prevents closing rooms before widgets are loaded
        // cleanupOrphanedRooms(response.activeRooms || []);

        setIsRecovering(false);
        isInitialRecoveryComplete.current = true;
        clearTimeout(recoveryTimeout);
        // Resolve the promise on success
        if (recoveryResolveRef.current) {
          recoveryResolveRef.current();
          recoveryResolveRef.current = null;
          recoveryPromiseRef.current = null;
        }
      });
    } catch (error) {
      debug.error('[UnifiedSession] Recovery error:', error);
      setIsRecovering(false);
      clearTimeout(recoveryTimeout);
      // Resolve the promise on error
      if (recoveryResolveRef.current) {
        recoveryResolveRef.current();
        recoveryResolveRef.current = null;
        recoveryPromiseRef.current = null;
      }
    }
  }, [sessionCode, sessionCreatedAt, socket, isRecovering]);
  
  // Clean up orphaned rooms - should be called when widgets are deleted
  // Not called automatically to prevent closing rooms during page refresh
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const cleanupOrphanedRooms = useCallback(async () => {
    if (!socket?.connected || !sessionCode) return;
    
    
    // Get current widgets from store
    const currentWidgets = useWorkspaceStore.getState().widgets;
    const networkedWidgetIds = currentWidgets
      .filter((w: any) => ['poll', 'questions', 'rtfeedback', 'linkShare'].includes(w.type))
      .map((w: any) => w.id);
    
    // Check each active room
    const roomsToClose: string[] = [];
    activeRooms.forEach((_, widgetId) => {
      if (!networkedWidgetIds.includes(widgetId)) {
        debug('[UnifiedSession] Found orphaned room:', widgetId);
        roomsToClose.push(widgetId);
      }
    });
    
    // Close orphaned rooms
    for (const widgetId of roomsToClose) {
      const room = activeRooms.get(widgetId);
      if (room) {
        debug('[UnifiedSession] Closing orphaned room:', widgetId);
        socket.emit('session:closeRoom', {
          sessionCode,
          roomType: room.roomType,
          widgetId
        });
        // Remove from local state immediately
        activeRooms.delete(widgetId);
      }
    }
    
    debug('[UnifiedSession] Orphaned room cleanup complete');
  }, [socket, sessionCode, activeRooms]);
  
  // Don't trigger automatic cleanup after recovery
  // Cleanup should only happen when widgets are explicitly deleted
  // This prevents closing rooms during page refresh when widgets haven't loaded yet
  
  // Clear session
  const clearSession = useCallback(() => {
    setSessionCode(null);
    setSessionCreatedAt(null);
    setStoreSessionCode(null);
    setActiveRooms(new Map());
    setRecoveryData(new Map());
    setParticipantCounts(new Map());
    hasAttemptedRecovery.current = false;
  }, [setStoreSessionCode]);
  
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

    // Wait for recovery to complete if in progress (use promise-based approach)
    if (isRecovering && recoveryPromiseRef.current) {
      debug('[UnifiedSession] Waiting for recovery to complete before creating room');
      await recoveryPromiseRef.current;
    }

    if (!socket?.connected || !currentCode) {
      debug.error('[UnifiedSession] Cannot create room - no session or not connected', { currentCode, connected: socket?.connected });
      return false;
    }
    
    return new Promise((resolve) => {
      socket.emit('session:createRoom', {
        sessionCode: currentCode,
        roomType,
        widgetId
      }, (response: any) => {
        if (response.success) {
          resolve(true);
        } else {
          debug.error('[UnifiedSession] Failed to create room:', response.error);
          setError(response.error || 'Failed to create room');
          resolve(false);
        }
      });
    });
  }, [socket, isRecovering]);
  
  // Close room
  const closeRoom = useCallback((roomType: string, widgetId: string) => {
    if (!socket || !sessionCode) return;
    
    debug('[UnifiedSession] Closing room:', widgetId);
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