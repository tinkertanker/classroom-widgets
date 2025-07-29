import { useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface UseActiveStateProps {
  socket: Socket | null;
  sessionCode: string | null;
  roomType: string;
  widgetId?: string;
  isActive: boolean;
  isRoomActive: boolean;
  startEvent?: string;
  stopEvent?: string;
}

/**
 * Hook to manage active/inactive state for networked widgets
 * Emits start/stop events when the active state changes
 */
export function useActiveState({
  socket,
  sessionCode,
  roomType,
  widgetId,
  isActive,
  isRoomActive,
  startEvent,
  stopEvent
}: UseActiveStateProps) {
  // Default event names if not provided
  const startEventName = startEvent || `session:${roomType}:start`;
  const stopEventName = stopEvent || `session:${roomType}:stop`;

  useEffect(() => {
    if (!socket || !sessionCode || !isRoomActive) return;

    const eventName = isActive ? startEventName : stopEventName;
    
    socket.emit(eventName, {
      sessionCode,
      widgetId
    });
  }, [isActive, socket, sessionCode, isRoomActive, widgetId, startEventName, stopEventName]);

  // Helper function to toggle active state
  const toggleActive = useCallback((newState: boolean) => {
    console.log('[useActiveState] toggleActive called with newState:', newState);
    console.log('[useActiveState] socket:', !!socket, 'sessionCode:', sessionCode, 'isRoomActive:', isRoomActive);
    
    if (!socket || !sessionCode || !isRoomActive) {
      console.log('[useActiveState] BLOCKED - missing:', {
        socket: !socket,
        sessionCode: !sessionCode,
        isRoomActive: !isRoomActive
      });
      return;
    }

    const eventName = newState ? startEventName : stopEventName;
    console.log('[useActiveState] Emitting event:', eventName, 'with data:', {
      sessionCode,
      widgetId
    });
    
    socket.emit(eventName, {
      sessionCode,
      widgetId
    });
  }, [socket, sessionCode, isRoomActive, widgetId, startEventName, stopEventName]);

  return { toggleActive };
}