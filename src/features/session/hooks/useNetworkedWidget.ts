import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '../../../contexts/SessionContext';
import { debug } from '../../../shared/utils/debug';

export type RoomType = 'poll' | 'linkShare' | 'rtfeedback' | 'questions' | 'handout' | 'activity';

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
  
  // Check for recovery data on mount and when recovery completes
  useEffect(() => {
    if (!widgetId) return;

    // Check if this widget has recovery data
    const roomData = session.getWidgetRecoveryData(widgetId);
    if (roomData) {
      setHasRoom(true);
    } else if (session.hasAttemptedRecovery && !session.isRecovering) {
      // Recovery has completed and there's no room for this widget
      setHasRoom(false);
    }
  }, [widgetId, session.getWidgetRecoveryData, session.hasAttemptedRecovery, session.isRecovering]);
  
  // Watch for session being cleared
  useEffect(() => {
    console.log('[useNetworkedWidget] Session check:', {
      sessionCode: session.sessionCode,
      hasRoom,
      widgetId
    });
    if (!session.sessionCode && hasRoom) {
      // Session has been cleared, so no rooms exist anymore
      console.log('[useNetworkedWidget] Clearing hasRoom - no session code');
      setHasRoom(false);
    }
  }, [session.sessionCode, hasRoom, widgetId]);
  
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

      // Set hasRoom directly on success - don't rely solely on session:roomCreated event
      // The event might not be received due to timing issues with socket room membership
      setHasRoom(true);
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
  // Uses a cleanup flag pattern instead of setTimeout for more reliable detection
  const isMountedRef = useRef(true);
  const isCleaningUpRef = useRef(false);
  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    isCleaningUpRef.current = false;

    // Cancel any pending cleanup if remounting quickly
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }

    return () => {
      isMountedRef.current = false;
      isCleaningUpRef.current = true;
    };
  }, []);

  // Cleanup on unmount only - with debounce to handle rapid mount/unmount cycles
  useEffect(() => {
    const currentWidgetId = widgetId;
    const currentRoomType = roomType;
    const currentHasRoom = hasRoom;
    const closeRoom = session.closeRoom;

    return () => {
      // Debounce cleanup to handle rapid mount/unmount cycles
      // This prevents closing rooms during React Strict Mode double-render
      cleanupTimeoutRef.current = setTimeout(() => {
        // Double-check that we're still unmounted after the delay
        if (isCleaningUpRef.current && !isMountedRef.current && currentWidgetId && currentHasRoom) {
          debug(`[NetworkedWidget] Widget ${currentWidgetId} truly unmounting, closing room`);
          closeRoom(currentRoomType, currentWidgetId);
        }
        cleanupTimeoutRef.current = null;
      }, 100); // 100ms debounce to handle rapid remounts
    };
  }, [widgetId, roomType, session.closeRoom, hasRoom]);
  
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