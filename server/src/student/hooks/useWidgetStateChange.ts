import { useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface UseWidgetStateChangeParams {
  socket: Socket;
  roomCode: string;
  roomType: string;
  widgetId?: string;
  initialIsActive?: boolean;
  onStateChange: (isActive: boolean, wasInactive?: boolean) => void;
}

export const useWidgetStateChange = ({
  socket,
  roomCode,
  roomType,
  widgetId,
  initialIsActive,
  onStateChange
}: UseWidgetStateChangeParams) => {
  useEffect(() => {
    const handleWidgetStateChanged = (data: { roomType: string; widgetId?: string; isActive: boolean }) => {
      // Only handle state changes for this specific widget type and instance
      if (data.roomType === roomType && (data.widgetId === widgetId || (!data.widgetId && !widgetId))) {
        onStateChange(data.isActive);
      }
    };

    // Also listen for the legacy event for backward compatibility
    const handleLegacyStateChanged = (data: { isActive: boolean; widgetId?: string }) => {
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        onStateChange(data.isActive);
      }
    };

    socket.on('session:widgetStateChanged', handleWidgetStateChanged);
    socket.on(`${roomType}:stateChanged`, handleLegacyStateChanged);
    
    // Request current state if we don't have initial state
    let timer: NodeJS.Timeout | undefined;
    if (initialIsActive === undefined) {
      timer = setTimeout(() => {
        socket.emit(`${roomType}:requestState`, { code: roomCode, widgetId });
      }, 100);
    }

    return () => {
      if (timer) clearTimeout(timer);
      socket.off('session:widgetStateChanged', handleWidgetStateChanged);
      socket.off(`${roomType}:stateChanged`, handleLegacyStateChanged);
    };
  }, [socket, roomCode, roomType, widgetId, initialIsActive, onStateChange]);
};