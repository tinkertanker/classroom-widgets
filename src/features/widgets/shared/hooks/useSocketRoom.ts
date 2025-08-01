import { useEffect, useState } from 'react';
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
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    // Debug: isActive, hasJoined, roomType
    if (isActive) {
      if (!hasJoined) {
        // Joining room
        setHasJoined(true);
        onJoin?.();
      }
    } else {
      if (hasJoined) {
        // Leaving room
        setHasJoined(false);
        onLeave?.();
      }
    }
  }, [isActive, onJoin, onLeave, roomType]); // Removed hasJoined from deps to prevent loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hasJoined) {
        onLeave?.();
      }
    };
  }, [onLeave, hasJoined]);

  return hasJoined;
}