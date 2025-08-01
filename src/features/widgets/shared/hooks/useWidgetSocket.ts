import { useState, useCallback, useMemo } from 'react';
import { useSocketRoom } from './useSocketRoom';
import { useSocketEvents } from './useSocketEvents';
import { useActiveState } from './useActiveState';
import { Socket } from 'socket.io-client';

interface UseWidgetSocketProps {
  socket: Socket | null;
  sessionCode: string | null;
  roomType: string;
  widgetId?: string;
  isActive: boolean;
  isRoomActive: boolean;
  events?: Record<string, (data: any) => void>;
  startEvent?: string;
  stopEvent?: string;
}

/**
 * Composite hook that combines socket room management, event handling,
 * and active state management for networked widgets
 */
export function useWidgetSocket({
  socket,
  sessionCode,
  roomType,
  widgetId,
  isActive,
  isRoomActive,
  events = {},
  startEvent,
  stopEvent
}: UseWidgetSocketProps) {
  const [isConnected, setIsConnected] = useState(false);

  const onJoin = useCallback(() => setIsConnected(true), []);
  const onLeave = useCallback(() => setIsConnected(false), []);

  // Manage room join/leave
  // For teacher side, we join the room when it's active (created)
  const hasJoinedRoom = useSocketRoom({
    socket,
    sessionCode,
    roomType,
    widgetId,
    isActive: isRoomActive,
    onJoin,
    onLeave
  });

  // Manage socket events
  const { emit } = useSocketEvents({
    socket,
    events,
    isActive: hasJoinedRoom
  });

  // Manage active state
  const { toggleActive } = useActiveState({
    socket,
    sessionCode,
    roomType,
    widgetId,
    isActive,
    isRoomActive: hasJoinedRoom,
    startEvent,
    stopEvent
  });

  // Helper to emit widget-specific events
  const emitWidgetEvent = useCallback((eventName: string, data: any) => {
    emit(`session:${roomType}:${eventName}`, {
      sessionCode,
      widgetId,
      ...data
    });
  }, [emit, roomType, sessionCode, widgetId]);

  return {
    isConnected,
    hasJoinedRoom,
    emit,
    emitWidgetEvent,
    toggleActive
  };
}