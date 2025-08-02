import { useState, useEffect, useCallback, useRef } from 'react';
import { useSessionContext } from '../../../contexts/SessionContext';
import { useSession } from './useSession';

export type RoomType = 'poll' | 'linkShare' | 'rtfeedback' | 'questions';

interface UseNetworkedWidgetProps {
  widgetId?: string;
  roomType: RoomType;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface UseNetworkedWidgetReturn {
  hasRoom: boolean;
  isStarting: boolean;
  error: string | null;
  handleStart: () => Promise<void>;
  handleStop: () => void;
  session: {
    socket: any;
    sessionCode: string | null;
    participantCount: number;
    isConnected: boolean;
    isRecovering: boolean;
  };
  recoveryData: any | null;
}

export function useNetworkedWidget({
  widgetId,
  roomType,
  savedState,
  onStateChange
}: UseNetworkedWidgetProps): UseNetworkedWidgetReturn {
  const [hasRoom, setHasRoom] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  
  const sessionContext = useSessionContext();
  const session = useSession();
  const hasCheckedRecovery = useRef(false);
  
  // Check for recovery data on mount
  useEffect(() => {
    if (!widgetId || hasCheckedRecovery.current) return;
    
    const recoveryData = sessionContext.getWidgetRecoveryData(widgetId);
    if (recoveryData) {
      console.log(`[NetworkedWidget] Found recovery data for widget ${widgetId}:`, recoveryData);
      setHasRoom(true);
      hasCheckedRecovery.current = true;
    }
  }, [widgetId, sessionContext]);
  
  // Listen for room events
  useEffect(() => {
    if (!session.socket || !widgetId) return;
    
    const handleRoomCreated = (data: { roomType: string; widgetId?: string }) => {
      if (data.roomType === roomType && data.widgetId === widgetId) {
        setHasRoom(true);
      }
    };
    
    const handleRoomClosed = (data: { roomType: string; widgetId?: string }) => {
      if (data.roomType === roomType && data.widgetId === widgetId) {
        setHasRoom(false);
        setParticipantCount(0);
      }
    };
    
    const handleParticipantUpdate = (data: { count: number; roomType: string; widgetId?: string }) => {
      if (data.roomType === roomType && data.widgetId === widgetId) {
        setParticipantCount(data.count);
      }
    };
    
    session.socket.on('session:roomCreated', handleRoomCreated);
    session.socket.on('session:roomClosed', handleRoomClosed);
    session.socket.on('session:participantUpdate', handleParticipantUpdate);
    
    return () => {
      session.socket.off('session:roomCreated', handleRoomCreated);
      session.socket.off('session:roomClosed', handleRoomClosed);
      session.socket.off('session:participantUpdate', handleParticipantUpdate);
    };
  }, [session.socket, roomType, widgetId]);
  
  // Handle start
  const handleStart = useCallback(async () => {
    if (!widgetId) return;
    
    setIsStarting(true);
    setError(null);
    
    try {
      // Ensure we have a session
      let currentSessionCode = sessionContext.sessionCode;
      if (!currentSessionCode) {
        currentSessionCode = await sessionContext.createSession();
        if (!currentSessionCode) {
          throw new Error('Failed to create session');
        }
      }
      
      // Create the room
      const success = await sessionContext.createRoom(roomType, widgetId);
      if (!success) {
        throw new Error('Failed to create room');
      }
      
      setIsStarting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
      setIsStarting(false);
    }
  }, [widgetId, roomType, sessionContext]);
  
  // Handle stop
  const handleStop = useCallback(() => {
    if (!widgetId) return;
    sessionContext.closeRoom(roomType, widgetId);
  }, [widgetId, roomType, sessionContext]);
  
  // Get recovery data
  const recoveryData = widgetId ? sessionContext.getWidgetRecoveryData(widgetId) : null;
  
  return {
    hasRoom,
    isStarting,
    error,
    handleStart,
    handleStop,
    session: {
      socket: session.socket,
      sessionCode: sessionContext.sessionCode,
      participantCount,
      isConnected: sessionContext.isConnected,
      isRecovering: sessionContext.isRecovering
    },
    recoveryData
  };
}