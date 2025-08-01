// Hook for networked widgets using the new architecture

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { useSession } from './useSession';

export type RoomType = 'poll' | 'linkShare' | 'rtfeedback' | 'questions';

interface UseNetworkedWidgetProps {
  widgetId?: string;
  roomType: RoomType;
  onRoomCreated?: () => void;
  onRoomClosed?: () => void;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface UseNetworkedWidgetReturn {
  isRoomActive: boolean;
  isStarting: boolean;
  error: string | null;
  handleStart: () => Promise<void>;
  handleStop: () => void;
  closeSession: () => void;
  session: {
    socket: any;
    sessionCode: string | null;
    participantCount: number;
    isConnected: boolean;
    isRecovering?: boolean;
  };
}

export function useNetworkedWidget({
  widgetId,
  roomType,
  onRoomCreated,
  onRoomClosed,
  savedState,
  onStateChange
}: UseNetworkedWidgetProps): UseNetworkedWidgetReturn {
  const [isRoomActive, setIsRoomActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  
  const session = useSession();
  const { socket, sessionCode, createSession, closeSession: closeSessionHook, isConnected, isRecovering } = session;
  
  // Setup socket listeners
  useEffect(() => {
    if (!socket) return;
    
    const handleRoomCreated = (data: { roomType: string; widgetId?: string; sessionCode?: string }) => {
      if (data.roomType === roomType) {
        const widgetMatch = data.widgetId === undefined || data.widgetId === widgetId;
        if (widgetMatch) {
          setIsRoomActive(true);
          onRoomCreated?.();
        }
      }
    };
    
    const handleRoomClosed = (data: { roomType: string; widgetId?: string }) => {
      if (data.roomType === roomType) {
        const widgetMatch = data.widgetId === undefined || data.widgetId === widgetId;
        if (widgetMatch) {
          setIsRoomActive(false);
          setParticipantCount(0);
          onRoomClosed?.();
        }
      }
    };
    
    const handleParticipantUpdate = (data: { count: number; roomType: string; widgetId?: string }) => {
      if (data.roomType === roomType) {
        const widgetMatch = data.widgetId === undefined || data.widgetId === widgetId;
        if (widgetMatch) {
          setParticipantCount(data.count);
        }
      }
    };
    
    const handleError = (data: { message: string; roomType?: string }) => {
      if (!data.roomType || data.roomType === roomType) {
        setError(data.message);
        setIsStarting(false);
      }
    };
    
    // Handle session recovery events
    const handleSessionRecovered = (data: { sessionCode: string; rooms: any[] }) => {
      if (data.sessionCode) {
        // Check if our room is active
        const ourRoom = data.rooms?.find(r => r.roomType === roomType && (!r.widgetId || r.widgetId === widgetId));
        if (ourRoom) {
          setIsRoomActive(true);
          onRoomCreated?.();
        }
      }
    };
    
    // Handle unified widget state changes from server
    const handleWidgetStateChanged = (data: { roomType: string; widgetId?: string; isActive: boolean }) => {
      if (data.roomType === roomType) {
        const widgetMatch = data.widgetId === undefined || data.widgetId === widgetId;
        if (widgetMatch) {
          // Widget should update its own state based on this event
          // This is handled by the widget-specific listeners (e.g., poll:stateChanged)
        }
      }
    };
    
    // Handle session closed by host
    const handleSessionClosed = () => {
      setIsRoomActive(false);
      setParticipantCount(0);
      setError('Session has been closed by the host');
      closeSessionHook(); // Use the closeSession from useSession
    };
    
    socket.on('session:roomCreated', handleRoomCreated);
    socket.on('session:roomClosed', handleRoomClosed);
    socket.on('session:participantUpdate', handleParticipantUpdate);
    socket.on('session:error', handleError);
    socket.on('session:recovered', handleSessionRecovered);
    socket.on('session:widgetStateChanged', handleWidgetStateChanged);
    socket.on('session:closed', handleSessionClosed);
    
    return () => {
      socket.off('session:roomCreated', handleRoomCreated);
      socket.off('session:roomClosed', handleRoomClosed);
      socket.off('session:participantUpdate', handleParticipantUpdate);
      socket.off('session:error', handleError);
      socket.off('session:recovered', handleSessionRecovered);
      socket.off('session:widgetStateChanged', handleWidgetStateChanged);
      socket.off('session:closed', handleSessionClosed);
    };
  }, [socket, roomType, widgetId, onRoomCreated, onRoomClosed, closeSessionHook]);
  
  // Handle start
  const handleStart = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    
    try {
      const sessionData = await createSession();
      const currentSessionCode = sessionData?.code;
      const activeRooms = sessionData?.activeRooms || [];
      
      // Check if our room is already active from a previous session
      const ourRoomIsActive = activeRooms.some(room => room.roomType === roomType && (room.widgetId === widgetId || !room.widgetId));
      if (ourRoomIsActive) {
        setIsRoomActive(true);
        setIsStarting(false);
        onRoomCreated?.();
        return;
      }
      
      if (currentSessionCode) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout creating room'));
          }, 10000);
          
          socket.emit('session:createRoom', { 
            sessionCode: currentSessionCode,
            roomType,
            widgetId 
          }, (response: any) => {
            clearTimeout(timeout);
            if (response.error) {
              if (response.error === 'Invalid session or not host') {
                closeSessionHook();
              }
              reject(new Error(response.error));
            } else if (response.success) {
              setIsRoomActive(true);
              setIsStarting(false);
              if (response.roomData) {
                onRoomCreated?.();
              }
              resolve();
            } else {
              reject(new Error('Failed to create room'));
            }
          });
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
      setIsStarting(false);
    }
  }, [socket, roomType, widgetId, createSession, closeSessionHook, onRoomCreated]);
  
  // Handle stop
  const handleStop = useCallback(() => {
    if (!socket || !sessionCode) return;
    
    socket.emit('session:closeRoom', { 
      sessionCode,
      roomType,
      widgetId 
    });
  }, [socket, sessionCode, roomType, widgetId]);
  
  // Handle explicit session close
  const closeSession = useCallback(() => {
    if (!socket || !sessionCode) return;
    
    // Close the session on the server
    socket.emit('session:close', { sessionCode });
    
    
  }, [socket, sessionCode, closeSessionHook]);
  
  // Load saved state - but don't restore session code automatically
  // Session codes should only be valid during active sessions
  useEffect(() => {
    if (savedState?.isRoomActive) {
      // Don't automatically restore room active state or session code
      // These should only be set when actively creating/joining a session
    }
  }, [savedState]);
  
  // Save state changes - but don't persist session code
  useEffect(() => {
    onStateChange?.({
      // Don't save isRoomActive or sessionCode
      // These should be ephemeral and not persist across reloads
    });
  }, [onStateChange]);
  
  return {
    isRoomActive,
    isStarting,
    error,
    handleStart,
    handleStop,
    closeSession,
    session: {
      socket: session.socket,
      sessionCode: session.sessionCode,
      participantCount,
      isConnected: session.isConnected,
      isRecovering: session.isRecovering
    }
  };
}