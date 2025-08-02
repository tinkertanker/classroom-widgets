import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useWorkspaceStore } from '../store/workspaceStore.simple';
import api from '../services/api';

interface ActiveRoom {
  roomType: string;
  widgetId: string;
  isActive: boolean;
  roomData?: any;
}

interface UnifiedSessionContextValue {
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

const UnifiedSessionContext = createContext<UnifiedSessionContextValue | null>(null);

export const useUnifiedSession = () => {
  const context = useContext(UnifiedSessionContext);
  if (!context) {
    throw new Error('useUnifiedSession must be used within UnifiedSessionProvider');
  }
  return context;
};

interface UnifiedSessionProviderProps {
  children: React.ReactNode;
}

export const UnifiedSessionProvider: React.FC<UnifiedSessionProviderProps> = ({ children }) => {
  const { socket } = useSocket();
  
  // Session state from store
  const storeSessionCode = useWorkspaceStore((state) => state.sessionCode);
  const storeSessionCreatedAt = useWorkspaceStore((state) => state.sessionCreatedAt);
  const setStoreSessionCode = useWorkspaceStore((state) => state.setSessionCode);
  
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
  const hasPerformedCleanup = useRef(false);
  
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
      console.log('[UnifiedSession] Socket connected');
      setIsConnected(true);
      setIsConnecting(false);
      
      // Attempt recovery if we have a session
      if (sessionCode && sessionCreatedAt && !hasAttemptedRecovery.current) {
        attemptSessionRecovery();
      }
    };
    
    const handleDisconnect = () => {
      console.log('[UnifiedSession] Socket disconnected');
      setIsConnected(false);
    };
    
    const handleConnecting = () => {
      console.log('[UnifiedSession] Socket connecting');
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
      console.log('[UnifiedSession] Room created:', data);
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
      console.log('[UnifiedSession] Room closed:', data);
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
      console.log('[UnifiedSession] Widget state changed:', data);
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
      console.log('[UnifiedSession] Session closed by host');
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
    
    hasAttemptedRecovery.current = true;
    setIsRecovering(true);
    console.log('[UnifiedSession] Attempting session recovery for:', sessionCode);
    
    try {
      // Check session age
      const sessionAge = Date.now() - sessionCreatedAt;
      if (sessionAge > TWO_HOURS) {
        console.log('[UnifiedSession] Session too old, clearing');
        clearSession();
        return;
      }
      
      // Check if session still exists on server
      try {
        const response = await api.get(`/api/sessions/${sessionCode}/exists`);
        if (!response.data.exists) {
          console.log('[UnifiedSession] Session no longer exists on server');
          clearSession();
          return;
        }
      } catch (error) {
        console.error('[UnifiedSession] Error checking session existence:', error);
        clearSession();
        return;
      }
      
      // Rejoin session
      socket.emit('session:create', { existingCode: sessionCode }, (response: any) => {
        if (!response.success) {
          console.error('[UnifiedSession] Failed to recover session:', response.error);
          clearSession();
          setIsRecovering(false);
          return;
        }
        
        console.log('[UnifiedSession] Session recovered successfully');
        
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
      });
    } catch (error) {
      console.error('[UnifiedSession] Recovery error:', error);
      setIsRecovering(false);
    }
  }, [sessionCode, sessionCreatedAt, socket, isRecovering]);
  
  // Clean up orphaned rooms after recovery is complete
  const cleanupOrphanedRooms = useCallback(async () => {
    if (!socket?.connected || !sessionCode) return;
    
    console.log('[UnifiedSession] Starting orphaned room cleanup');
    
    // Get current widgets from store
    const currentWidgets = useWorkspaceStore.getState().widgets;
    console.log('[UnifiedSession] All widgets in store:', currentWidgets);
    const networkedWidgetIds = currentWidgets
      .filter((w: any) => ['poll', 'questions', 'rtfeedback', 'linkShare'].includes(w.type))
      .map((w: any) => w.id);
    
    console.log('[UnifiedSession] Current networked widgets:', networkedWidgetIds);
    console.log('[UnifiedSession] Active rooms to check:', Array.from(activeRooms.keys()));
    
    // Check each active room
    const roomsToClose: string[] = [];
    activeRooms.forEach((_, widgetId) => {
      if (!networkedWidgetIds.includes(widgetId)) {
        console.log('[UnifiedSession] Found orphaned room:', widgetId);
        roomsToClose.push(widgetId);
      }
    });
    
    // Close orphaned rooms
    for (const widgetId of roomsToClose) {
      const room = activeRooms.get(widgetId);
      if (room) {
        console.log('[UnifiedSession] Closing orphaned room:', widgetId);
        socket.emit('session:closeRoom', {
          sessionCode,
          roomType: room.roomType,
          widgetId
        });
        // Remove from local state immediately
        activeRooms.delete(widgetId);
      }
    }
    
    console.log('[UnifiedSession] Orphaned room cleanup complete');
  }, [socket, sessionCode, activeRooms]);
  
  // Trigger cleanup after recovery is complete
  useEffect(() => {
    if (isInitialRecoveryComplete.current && !hasPerformedCleanup.current && !isRecovering) {
      // Delay cleanup to ensure widgets are loaded
      const timer = setTimeout(() => {
        cleanupOrphanedRooms();
        hasPerformedCleanup.current = true;
      }, 2000); // Increased delay to ensure widgets are fully loaded
      
      return () => clearTimeout(timer);
    }
  }, [isRecovering, cleanupOrphanedRooms]);
  
  // Clear session
  const clearSession = useCallback(() => {
    setSessionCode(null);
    setSessionCreatedAt(null);
    setStoreSessionCode(null);
    setActiveRooms(new Map());
    setRecoveryData(new Map());
    setParticipantCounts(new Map());
    hasAttemptedRecovery.current = false;
    hasPerformedCleanup.current = false;
  }, [setStoreSessionCode]);
  
  // Create session
  const createSession = useCallback(async (): Promise<string | null> => {
    if (!socket?.connected || isCreatingSession.current) {
      console.error('[UnifiedSession] Cannot create session - not connected or already creating');
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
            console.log('[UnifiedSession] Session created:', response.code);
            setSessionCode(response.code);
            setSessionCreatedAt(Date.now());
            setStoreSessionCode(response.code);
            sessionCodeRef.current = response.code; // Update ref immediately
            isInitialRecoveryComplete.current = true; // No recovery needed for new session
            hasPerformedCleanup.current = true; // No cleanup needed for new session
            setRecoveryData(new Map()); // Clear any old recovery data
            resolve(response.code);
          } else {
            console.error('[UnifiedSession] Failed to create session:', response.error);
            setError(response.error || 'Failed to create session');
            resolve(null);
          }
        });
      });
    } catch (error) {
      isCreatingSession.current = false;
      console.error('[UnifiedSession] Error creating session:', error);
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
    
    console.log('[UnifiedSession] Closing session:', sessionCode);
    socket.emit('session:close', { sessionCode });
    clearSession();
  }, [socket, sessionCode, clearSession]);
  
  // Create room
  const createRoom = useCallback(async (roomType: string, widgetId: string): Promise<boolean> => {
    // Use ref to always get the current session code
    const currentCode = sessionCodeRef.current;
    
    console.log('[UnifiedSession] createRoom - currentCode:', currentCode, 'isRecovering:', isRecovering);
    
    // Wait for recovery and cleanup to complete if in progress
    if ((isRecovering && !isInitialRecoveryComplete.current) || (isInitialRecoveryComplete.current && !hasPerformedCleanup.current)) {
      console.log('[UnifiedSession] Waiting for recovery and cleanup to complete before creating room');
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if ((!isRecovering || isInitialRecoveryComplete.current) && hasPerformedCleanup.current) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }
    
    if (!socket?.connected || !currentCode) {
      console.error('[UnifiedSession] Cannot create room - no session or not connected', { currentCode, connected: socket?.connected });
      return false;
    }
    
    return new Promise((resolve) => {
      socket.emit('session:createRoom', {
        sessionCode: currentCode,
        roomType,
        widgetId
      }, (response: any) => {
        if (response.success) {
          console.log('[UnifiedSession] Room created successfully');
          resolve(true);
        } else {
          console.error('[UnifiedSession] Failed to create room:', response.error);
          setError(response.error || 'Failed to create room');
          resolve(false);
        }
      });
    });
  }, [socket, isRecovering]);
  
  // Close room
  const closeRoom = useCallback((roomType: string, widgetId: string) => {
    if (!socket || !sessionCode) return;
    
    console.log('[UnifiedSession] Closing room:', widgetId);
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
  
  const value: UnifiedSessionContextValue = {
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
    <UnifiedSessionContext.Provider value={value}>
      {children}
    </UnifiedSessionContext.Provider>
  );
};