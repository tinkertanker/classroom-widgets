import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '../../../contexts/SessionContext';
import { debug } from '../../../shared/utils/debug';

export type RoomType = 'poll' | 'linkShare' | 'rtfeedback' | 'questions';

interface UseNetworkedWidgetProps {
  widgetId?: string;
  roomType: RoomType;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface UseNetworkedWidgetResult {
  // Room state
  hasRoom: boolean;
  isStarting: boolean;
  error: string | null;
  
  // Actions
  handleStart: () => Promise<void>;
  handleStop: () => void;
  
  // Session info
  session: {
    socket: any;
    sessionCode: string | null;
    participantCount: number;
    isConnected: boolean;
    isRecovering: boolean;
  };
  
  // Recovery data
  recoveryData: any | null;
}

export function useNetworkedWidget({
  widgetId,
  roomType,
  savedState,
  onStateChange
}: UseNetworkedWidgetProps): UseNetworkedWidgetResult {
  const session = useSession();
  const [hasRoom, setHasRoom] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Check for recovery data on mount
  useEffect(() => {
    if (!widgetId) return;
    
    // Check if this widget has recovery data
    const roomData = session.getWidgetRecoveryData(widgetId);
    if (roomData) {
      setHasRoom(true);
    }
  }, [widgetId, session.getWidgetRecoveryData]); // Only depends on widgetId and the getter function
  
  // Watch for session being cleared
  useEffect(() => {
    if (!session.sessionCode && hasRoom) {
      // Session has been cleared, so no rooms exist anymore
      setHasRoom(false);
    }
  }, [session.sessionCode, hasRoom]);
  
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
      }
    };
    
    const handleSessionClosed = () => {
      // When the entire session is closed, all rooms are closed
      setHasRoom(false);
    };
    
    session.socket.on('session:roomCreated', handleRoomCreated);
    session.socket.on('session:roomClosed', handleRoomClosed);
    session.socket.on('session:closed', handleSessionClosed);
    
    return () => {
      session.socket.off('session:roomCreated', handleRoomCreated);
      session.socket.off('session:roomClosed', handleRoomClosed);
      session.socket.off('session:closed', handleSessionClosed);
    };
  }, [session.socket, roomType, widgetId]);
  
  // Handle start
  const handleStart = useCallback(async () => {
    if (!widgetId) {
      setLocalError('Widget ID is required');
      return;
    }
    
    setIsStarting(true);
    setLocalError(null);
    
    try {
      // Ensure we have a session first
      let sessionCode = session.sessionCode;
      if (!sessionCode) {
        sessionCode = await session.createSession();
        if (!sessionCode) {
          throw new Error('Failed to create session');
        }
        
        // Wait a bit for the session to propagate through the context
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Create the room
      const success = await session.createRoom(roomType, widgetId);
      if (!success) {
        throw new Error('Failed to create room');
      }
      
      setIsStarting(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start';
      setLocalError(errorMessage);
      setIsStarting(false);
      console.error('[NetworkedWidget] Start error:', err);
    }
  }, [widgetId, roomType, session]);
  
  // Handle stop
  const handleStop = useCallback(() => {
    if (!widgetId) return;
    
    session.closeRoom(roomType, widgetId);
  }, [widgetId, roomType, session]);
  
  // Track if component is truly unmounting vs just re-rendering
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      // Small delay to check if this is a real unmount or just a re-render
      setTimeout(() => {
        if (!isMountedRef.current && widgetId && hasRoom) {
          debug(`[NetworkedWidget] Widget ${widgetId} truly unmounting, closing room`);
          session.closeRoom(roomType, widgetId);
        }
      }, 0);
    };
  }, [widgetId, roomType, session, hasRoom]);
  
  // Get recovery data
  const recoveryData = widgetId ? session.getWidgetRecoveryData(widgetId) : null;
  
  // Get participant count for this widget
  const participantCount = widgetId ? (session.participantCounts.get(widgetId) || 0) : 0;
  
  return {
    hasRoom,
    isStarting,
    error: localError || session.error,
    handleStart,
    handleStop,
    session: {
      socket: session.socket,
      sessionCode: session.sessionCode,
      participantCount,
      isConnected: session.isConnected,
      isRecovering: session.isRecovering
    },
    recoveryData
  };
}