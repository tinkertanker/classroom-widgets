import { useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface UseSessionRoomProps {
  socket: Socket;
  sessionCode: string;
  roomType: 'poll' | 'linkShare' | 'rtfeedback' | 'questions';
  widgetId?: string;
  isSession?: boolean;
}

/**
 * Custom hook to manage session room joining and leaving
 * Extracts common pattern used by all activity components
 */
export const useSessionRoom = ({
  socket,
  sessionCode,
  roomType,
  widgetId,
  isSession = false
}: UseSessionRoomProps): void => {
  useEffect(() => {
    if (isSession && widgetId) {
      socket.emit('session:joinRoom', {
        sessionCode,
        roomType,
        widgetId
      });

      return () => {
        socket.emit('session:leaveRoom', {
          sessionCode,
          roomType,
          widgetId
        });
      };
    }
  }, [socket, sessionCode, roomType, widgetId, isSession]);
};