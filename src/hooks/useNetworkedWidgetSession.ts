import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '../contexts/SessionContext';
import { RoomType } from './useSession';

interface UseNetworkedWidgetSessionProps {
  widgetId?: string;
  roomType: RoomType;
  onRoomCreated?: () => void;
  onRoomClosed?: () => void;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface UseNetworkedWidgetSessionReturn {
  isRoomActive: boolean;
  isStarting: boolean;
  error: string | null;
  handleStart: () => Promise<void>;
  handleStop: () => void;
  session: ReturnType<typeof useSessionContext>;
}

export function useNetworkedWidgetSession({
  widgetId,
  roomType,
  onRoomCreated,
  onRoomClosed,
  savedState,
  onStateChange
}: UseNetworkedWidgetSessionProps): UseNetworkedWidgetSessionReturn {
  const [isRoomActive, setIsRoomActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const session = useSessionContext();

  // Setup common socket listeners
  useEffect(() => {
    if (!session.socket) return;

    const handleRoomCreated = (data: { roomType: string }) => {
      if (data.roomType === roomType) {
        setIsRoomActive(true);
        onRoomCreated?.();
      }
    };

    const handleRoomClosed = (data: { roomType: string }) => {
      if (data.roomType === roomType) {
        setIsRoomActive(false);
        onRoomClosed?.();
      }
    };

    session.socket.on('session:roomCreated', handleRoomCreated);
    session.socket.on('session:roomClosed', handleRoomClosed);

    return () => {
      session.socket?.off('session:roomCreated', handleRoomCreated);
      session.socket?.off('session:roomClosed', handleRoomClosed);
    };
  }, [session.socket, roomType, onRoomCreated, onRoomClosed]);

  // Handle widget cleanup
  useEffect(() => {
    const handleWidgetCleanup = (event: CustomEvent) => {
      if (event.detail.widgetId === widgetId && isRoomActive) {
        session.closeRoom(roomType);
      }
    };
    
    window.addEventListener('widget-cleanup' as any, handleWidgetCleanup);
    
    return () => {
      window.removeEventListener('widget-cleanup' as any, handleWidgetCleanup);
    };
  }, [widgetId, isRoomActive, session, roomType]);

  // Load saved state
  useEffect(() => {
    if (savedState) {
      setIsRoomActive(savedState.isRoomActive || false);
    }
  }, [savedState]);

  // Save state when it changes
  useEffect(() => {
    onStateChange?.({ 
      isRoomActive,
      roomType
    });
  }, [isRoomActive, roomType, onStateChange]);

  // Handle starting the widget
  const handleStart = useCallback(async () => {
    try {
      setIsStarting(true);
      setError(null);
      
      // Ensure we have a session
      await session.ensureSession();
      
      // Create the room
      await session.createRoom(roomType);
      
      // Room active state will be set by the roomCreated event
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start';
      setError(errorMessage);
      console.error(`Failed to start ${roomType}:`, err);
    } finally {
      setIsStarting(false);
    }
  }, [session, roomType]);

  // Handle stopping the widget
  const handleStop = useCallback(() => {
    if (session.socket && session.sessionCode) {
      // Close the room
      session.closeRoom(roomType);
    }
  }, [session, roomType]);

  return {
    isRoomActive,
    isStarting,
    error,
    handleStart,
    handleStop,
    session
  };
}