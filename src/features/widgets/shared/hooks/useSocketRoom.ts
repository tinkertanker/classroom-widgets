import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface UseSocketRoomProps {
  socket: Socket | null;
  sessionCode: string | null;
  roomType: string;
  widgetId?: string;
  isActive: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
}

/**
 * Hook to manage socket room join/leave lifecycle for networked widgets
 * Handles automatic room joining when component mounts and leaving when it unmounts
 */
export function useSocketRoom({
  socket,
  sessionCode,
  roomType,
  widgetId,
  isActive,
  onJoin,
  onLeave
}: UseSocketRoomProps) {
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    if (!socket || !sessionCode || !isActive) {
      if (hasJoinedRef.current && onLeave) {
        onLeave();
        hasJoinedRef.current = false;
      }
      return;
    }

    // Join the room
    socket.emit('session:joinRoom', {
      sessionCode,
      roomType,
      widgetId
    });
    
    hasJoinedRef.current = true;
    onJoin?.();

    // Cleanup function to leave room
    return () => {
      if (socket.connected) {
        socket.emit('session:leaveRoom', {
          sessionCode,
          roomType,
          widgetId
        });
      }
      hasJoinedRef.current = false;
      onLeave?.();
    };
  }, [socket, sessionCode, roomType, widgetId, isActive, onJoin, onLeave]);

  return hasJoinedRef.current;
}