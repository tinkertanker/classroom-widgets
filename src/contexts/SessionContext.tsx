import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useWorkspaceStore } from '../store/workspaceStore.simple';

interface ActiveRoom {
  roomType: string;
  widgetId: string;
  isActive: boolean;
  roomData?: any;
}

interface SessionContextValue {
  // Session info
  sessionCode: string | null;
  isHost: boolean;
  
  // Connection state
  isConnected: boolean;
  isRecovering: boolean;
  
  // Room management
  activeRooms: Map<string, ActiveRoom>;
  
  // Methods
  createSession: () => Promise<string | null>;
  closeSession: () => void;
  createRoom: (roomType: string, widgetId: string) => Promise<boolean>;
  closeRoom: (roomType: string, widgetId: string) => void;
  
  // Widget recovery data
  getWidgetRecoveryData: (widgetId: string) => ActiveRoom | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export const useSessionContext = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionContext must be used within SessionProvider');
  }
  return context;
};

interface SessionProviderProps {
  children: React.ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const { socket } = useSocket();
  const sessionCode = useWorkspaceStore((state) => state.sessionCode);
  const sessionCreatedAt = useWorkspaceStore((state) => state.sessionCreatedAt);
  const setSessionCode = useWorkspaceStore((state) => state.setSessionCode);
  const widgets = useWorkspaceStore((state) => state.widgets);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [activeRooms, setActiveRooms] = useState<Map<string, ActiveRoom>>(new Map());
  const recoveryProcessed = useRef(false);
  
  // Track connection state
  useEffect(() => {
    if (!socket) return;
    
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    // Set initial state
    setIsConnected(socket.connected);
    
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);
  
  // Handle session recovery on mount or reconnection
  useEffect(() => {
    if (!socket || !sessionCode || !sessionCreatedAt || !isConnected) return;
    if (recoveryProcessed.current) return;
    
    const handleSessionRecovery = async () => {
      console.log('[SessionContext] Starting session recovery');
      setIsRecovering(true);
      
      // Check session age
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      const sessionAge = Date.now() - sessionCreatedAt;
      
      if (sessionAge > TWO_HOURS) {
        console.log('[SessionContext] Session too old, clearing');
        setSessionCode(null);
        setIsRecovering(false);
        return;
      }
      
      // Rejoin session and get active rooms
      socket.emit('session:create', { existingCode: sessionCode }, (response: any) => {
        if (!response.success) {
          console.error('[SessionContext] Failed to recover session:', response.error);
          setSessionCode(null);
          setIsRecovering(false);
          return;
        }
        
        console.log('[SessionContext] Session recovered with rooms:', response.activeRooms);
        
        // Update active rooms map
        const roomsMap = new Map<string, ActiveRoom>();
        (response.activeRooms || []).forEach((roomInfo: any) => {
          if (roomInfo.widgetId) {
            roomsMap.set(roomInfo.widgetId, {
              roomType: roomInfo.roomType,
              widgetId: roomInfo.widgetId,
              isActive: roomInfo.room?.isActive || false,
              roomData: roomInfo.room // This contains pollData, results, etc.
            });
          }
        });
        setActiveRooms(roomsMap);
        
        // Clean up orphaned rooms (rooms without local widgets)
        const networkedWidgetIds = widgets
          .filter(w => ['poll', 'questions', 'rtfeedback', 'linkShare'].includes(w.type))
          .map(w => w.id);
        
        response.activeRooms?.forEach((room: ActiveRoom) => {
          if (room.widgetId && !networkedWidgetIds.includes(room.widgetId)) {
            console.log('[SessionContext] Closing orphaned room:', room.widgetId);
            socket.emit('session:closeRoom', {
              sessionCode,
              roomType: room.roomType,
              widgetId: room.widgetId
            });
          }
        });
        
        recoveryProcessed.current = true;
        setIsRecovering(false);
        
        // Emit recovery complete event for widgets to listen to
        socket.emit('session:recoveryComplete', { sessionCode });
      });
    };
    
    // Small delay to ensure everything is ready
    const timer = setTimeout(handleSessionRecovery, 100);
    return () => clearTimeout(timer);
  }, [socket, sessionCode, sessionCreatedAt, isConnected, setSessionCode, widgets]);
  
  // Listen for room updates
  useEffect(() => {
    if (!socket) return;
    
    const handleRoomCreated = (data: { roomType: string; widgetId: string; roomData: any }) => {
      console.log('[SessionContext] Room created:', data);
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
      console.log('[SessionContext] Room closed:', data);
      setActiveRooms(prev => {
        const next = new Map(prev);
        next.delete(data.widgetId);
        return next;
      });
    };
    
    const handleWidgetStateChanged = (data: { roomType: string; widgetId: string; isActive: boolean }) => {
      console.log('[SessionContext] Widget state changed:', data);
      setActiveRooms(prev => {
        const next = new Map(prev);
        const room = next.get(data.widgetId);
        if (room) {
          room.isActive = data.isActive;
        }
        return next;
      });
    };
    
    socket.on('session:roomCreated', handleRoomCreated);
    socket.on('session:roomClosed', handleRoomClosed);
    socket.on('session:widgetStateChanged', handleWidgetStateChanged);
    
    return () => {
      socket.off('session:roomCreated', handleRoomCreated);
      socket.off('session:roomClosed', handleRoomClosed);
      socket.off('session:widgetStateChanged', handleWidgetStateChanged);
    };
  }, [socket]);
  
  // Reset recovery flag when session changes
  useEffect(() => {
    recoveryProcessed.current = false;
    setActiveRooms(new Map());
  }, [sessionCode]);
  
  const createSession = useCallback(async (): Promise<string | null> => {
    if (!socket?.connected) {
      console.error('[SessionContext] Cannot create session - not connected');
      return null;
    }
    
    return new Promise((resolve) => {
      socket.emit('session:create', {}, (response: any) => {
        if (response.success) {
          setSessionCode(response.code);
          resolve(response.code);
        } else {
          console.error('[SessionContext] Failed to create session:', response.error);
          resolve(null);
        }
      });
    });
  }, [socket, setSessionCode]);
  
  const closeSession = useCallback(() => {
    if (!socket || !sessionCode) return;
    
    socket.emit('session:close', { sessionCode });
    setSessionCode(null);
    setActiveRooms(new Map());
  }, [socket, sessionCode, setSessionCode]);
  
  const createRoom = useCallback(async (roomType: string, widgetId: string): Promise<boolean> => {
    console.log('[SessionContext] createRoom called, sessionCode:', sessionCode, 'socket:', !!socket);
    if (!socket || !sessionCode) {
      console.error('[SessionContext] Cannot create room - no session. sessionCode:', sessionCode, 'socket:', !!socket);
      return false;
    }
    
    return new Promise((resolve) => {
      socket.emit('session:createRoom', {
        sessionCode,
        roomType,
        widgetId
      }, (response: any) => {
        resolve(response.success || false);
      });
    });
  }, [socket, sessionCode]);
  
  const closeRoom = useCallback((roomType: string, widgetId: string) => {
    if (!socket || !sessionCode) return;
    
    socket.emit('session:closeRoom', {
      sessionCode,
      roomType,
      widgetId
    });
  }, [socket, sessionCode]);
  
  const getWidgetRecoveryData = useCallback((widgetId: string): ActiveRoom | null => {
    return activeRooms.get(widgetId) || null;
  }, [activeRooms]);
  
  const value: SessionContextValue = {
    sessionCode,
    isHost: true, // Always true for teacher app
    isConnected,
    isRecovering,
    activeRooms,
    createSession,
    closeSession,
    createRoom,
    closeRoom,
    getWidgetRecoveryData
  };
  
  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};