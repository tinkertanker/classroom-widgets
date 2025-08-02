import { useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface UseActiveStateProps {
  socket: Socket | null;
  sessionCode: string | null;
  roomType: string;
  widgetId?: string;
  isActive: boolean;
  isRoomActive: boolean; // TODO: Rename to hasRoom
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
  isRoomActive, // TODO: Rename to hasRoom
  startEvent,
  stopEvent
}: UseActiveStateProps) {
  // Default event names if not provided
  const startEventName = startEvent || `session:${roomType}:start`;
  const stopEventName = stopEvent || `session:${roomType}:stop`;

  // Removed useEffect that was causing duplicate emissions
  // The toggleActive function below handles all state updates

  // Helper function to toggle active state
  const toggleActive = useCallback((newState: boolean) => {
    console.log('[useActiveState] toggleActive called with newState:', newState);
    console.log('[useActiveState] socket:', !!socket, 'sessionCode:', sessionCode, 'hasRoom:', isRoomActive);
    
    if (!socket || !sessionCode) {
      console.log('[useActiveState] BLOCKED - missing:', {
        socket: !socket,
        sessionCode: !sessionCode
      });
      return;
    }

    // Use unified state update event
    console.log('[useActiveState] Emitting session:updateWidgetState with data:', {
      sessionCode,
      roomType,
      widgetId,
      isActive: newState,
      socketConnected: socket.connected,
      socketId: socket.id
    });
    
    if (!socket.connected) {
      console.error('[useActiveState] Socket is not connected!');
      return;
    }
    
    socket.emit('session:updateWidgetState', {
      sessionCode,
      roomType,
      widgetId,
      isActive: newState
    }, (response: any) => {
      console.log('[useActiveState] Server response:', response);
    });
  }, [socket, sessionCode, widgetId, roomType]);

  return { toggleActive };
}