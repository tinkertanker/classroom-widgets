import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import type { SessionWidgetStateChangedData } from '@shared/types/socket.types';

/** The room's `<roomType>:stateUpdate` payload, whose extra fields vary by room. */
type StateUpdate<TState> = Partial<TState> & { isActive?: boolean; widgetId?: string };

interface UseWidgetStateChangeParams<TState> {
  socket: Socket;
  roomCode: string;
  roomType: string;
  widgetId?: string;
  initialIsActive?: boolean;
  // `data` is the room's own state update; a bare active/paused change has none
  onStateChange: (isActive: boolean, data?: StateUpdate<TState>) => void;
}

export const useWidgetStateChange = <TState extends object = Record<string, never>>({
  socket,
  roomCode,
  roomType,
  widgetId,
  initialIsActive,
  onStateChange
}: UseWidgetStateChangeParams<TState>) => {
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    const handleWidgetStateChanged = (data: SessionWidgetStateChangedData) => {
      // Only handle state changes for this specific widget type and instance
      if (data.roomType === roomType && (data.widgetId === widgetId || (!data.widgetId && !widgetId))) {
        onStateChangeRef.current(data.isActive);
      }
    };

    const handleStateUpdate = (data: StateUpdate<TState>) => {
      if (typeof data.isActive === 'boolean' && (data.widgetId === widgetId || (!data.widgetId && !widgetId))) {
        onStateChangeRef.current(data.isActive, data);
      }
    };

    // After a reconnect the card keeps its state, but every update the teacher
    // made while this socket was away was missed: ask for the current state
    const handleReconnect = () => {
      socket.emit(`${roomType}:requestState`, { sessionCode: roomCode, widgetId });
    };

    socket.on('session:widgetStateChanged', handleWidgetStateChanged);
    socket.on(`${roomType}:stateUpdate`, handleStateUpdate);
    socket.on('connect', handleReconnect);

    // Request current state if we don't have initial state
    let timer: NodeJS.Timeout | undefined;
    if (initialIsActive === undefined) {
      timer = setTimeout(() => {
        socket.emit(`${roomType}:requestState`, { sessionCode: roomCode, widgetId });
      }, 100);
    }

    return () => {
      if (timer) clearTimeout(timer);
      socket.off('session:widgetStateChanged', handleWidgetStateChanged);
      socket.off(`${roomType}:stateUpdate`, handleStateUpdate);
      socket.off('connect', handleReconnect);
    };
  }, [socket, roomCode, roomType, widgetId, initialIsActive]);
};