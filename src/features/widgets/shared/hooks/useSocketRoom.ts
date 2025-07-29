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
 * Hook to manage socket room lifecycle for networked widgets on teacher side
 * Since teachers are the room hosts, they don't need to join/leave rooms
 * This hook just tracks connection state for compatibility
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
    if (!socket || !sessionCode) {
      if (hasJoinedRef.current && onLeave) {
        onLeave();
        hasJoinedRef.current = false;
      }
      return;
    }
    
    // Teacher is automatically part of the room as the host
    // No need to emit join/leave events
    hasJoinedRef.current = true;
    onJoin?.();

    // Cleanup function
    return () => {
      hasJoinedRef.current = false;
      onLeave?.();
    };
  }, [socket, sessionCode, onJoin, onLeave]);

  return hasJoinedRef.current;
}