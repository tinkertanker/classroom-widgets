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

    const handleRoomCreated = (data: { roomType: string; widgetId?: string }) => {
      // Only respond if:
      // 1. Room type matches AND
      // 2. Widget IDs match (including both being undefined)
      // IMPORTANT: If widgetId is provided in the event, it must match this widget's ID
      if (data.roomType === roomType) {
        // If the event has a widgetId, only respond if it matches ours
        if (data.widgetId && data.widgetId !== widgetId) {
          return;
        }
        // If we have a widgetId but the event doesn't specify one, don't respond
        if (widgetId && !data.widgetId) {
          return;
        }
        // Otherwise, the widget IDs match (or both are undefined)
        setIsRoomActive(true);
        onRoomCreated?.();
      }
    };

    const handleRoomClosed = (data: { roomType: string; widgetId?: string }) => {
      // Only respond if:
      // 1. Room type matches AND
      // 2. Widget IDs match (including both being undefined)
      // IMPORTANT: If widgetId is provided in the event, it must match this widget's ID
      if (data.roomType === roomType) {
        // If the event has a widgetId, only respond if it matches ours
        if (data.widgetId && data.widgetId !== widgetId) {
          return;
        }
        // If we have a widgetId but the event doesn't specify one, don't respond
        if (widgetId && !data.widgetId) {
          return;
        }
        // Otherwise, the widget IDs match (or both are undefined)
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
  }, [session.socket, roomType, widgetId, onRoomCreated, onRoomClosed]);

  // Handle widget cleanup
  useEffect(() => {
    const handleWidgetCleanup = (event: CustomEvent) => {
      if (event.detail.widgetId === widgetId && isRoomActive) {
        session.closeRoom(roomType, widgetId);
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
      // Don't restore isRoomActive from saved state
      // Rooms are ephemeral and don't persist across page reloads
      // Widget must create a new room after page refresh
      setIsRoomActive(false);
    }
  }, [savedState]);

  // Save state when it changes
  useEffect(() => {
    onStateChange?.({ 
      // Don't save isRoomActive - rooms are ephemeral
      roomType
    });
  }, [roomType, onStateChange]);

  // Handle starting the widget
  const handleStart = useCallback(async () => {
    try {
      setIsStarting(true);
      setError(null);
      
      // Ensure we have a session
      await session.ensureSession();
      
      // Create the room with widgetId
      await session.createRoom(roomType, widgetId);
      
      // Room active state will be set by the roomCreated event
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start';
      setError(errorMessage);
      console.error(`Failed to start ${roomType}:`, err);
    } finally {
      setIsStarting(false);
    }
  }, [session, roomType, widgetId]);

  // Handle stopping the widget
  const handleStop = useCallback(() => {
    if (session.socket && session.sessionCode) {
      // Close the room with widgetId
      session.closeRoom(roomType, widgetId);
    }
  }, [session, roomType, widgetId]);

  return {
    isRoomActive,
    isStarting,
    error,
    handleStart,
    handleStop,
    session
  };
}