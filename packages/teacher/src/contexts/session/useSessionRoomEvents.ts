import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  SessionParticipantUpdateData,
  SessionRoomClosedData,
  SessionRoomCreatedData,
  SessionWidgetStateChangedData
} from '@shared/types/socket.types';
import type { ActiveRoom } from './sessionTypes';

/**
 * Keeps `activeRooms` in step with the server's session-level room broadcasts,
 * and reports when the server closes the session.
 */
export const useSessionRoomEvents = (
  socket: Socket | null,
  setActiveRooms: Dispatch<SetStateAction<Map<string, ActiveRoom>>>,
  onSessionClosed: () => void
): void => {
  // Listeners are bound once per socket; read the latest handler at call time
  const onSessionClosedRef = useRef(onSessionClosed);
  onSessionClosedRef.current = onSessionClosed;

  useEffect(() => {
    if (!socket) return;

    const handleRoomCreated = (data: SessionRoomCreatedData) => {
      console.log('[UnifiedSession] Received session:roomCreated event:', data);
      setActiveRooms(prev => {
        const next = new Map(prev);
        next.set(data.widgetId, {
          roomType: data.roomType,
          widgetId: data.widgetId,
          isActive: data.roomData?.isActive || false,
          participantCount: data.roomData?.participantCount || 0,
          roomData: data.roomData
        });
        console.log('[UnifiedSession] Updated activeRooms:', Array.from(next.keys()));
        return next;
      });
    };

    const handleRoomClosed = (data: SessionRoomClosedData) => {
      // The participant count lives on the room entry, so removing the room
      // cannot leave a stale count behind
      setActiveRooms(prev => {
        const next = new Map(prev);
        next.delete(data.widgetId);
        return next;
      });
    };

    const handleWidgetStateChanged = (data: SessionWidgetStateChangedData) => {
      setActiveRooms(prev => {
        const next = new Map(prev);
        const room = next.get(data.widgetId);
        if (room) {
          room.isActive = data.isActive;
        }
        return next;
      });
    };

    const handleParticipantUpdate = (data: SessionParticipantUpdateData) => {
      const { widgetId } = data;
      if (!widgetId) return;
      // Patch the existing room only. Session-level participant updates arrive
      // without a widgetId and are ignored; a room-scoped update for a widget we
      // have no room for would only create an entry nothing can ever clean up.
      setActiveRooms(prev => {
        const room = prev.get(widgetId);
        if (!room) return prev;
        const next = new Map(prev);
        next.set(widgetId, { ...room, participantCount: data.count });
        return next;
      });
    };

    const handleSessionClosed = () => onSessionClosedRef.current();

    socket.on('session:roomCreated', handleRoomCreated);
    socket.on('session:roomClosed', handleRoomClosed);
    socket.on('session:widgetStateChanged', handleWidgetStateChanged);
    socket.on('session:participantUpdate', handleParticipantUpdate);
    socket.on('session:closed', handleSessionClosed);

    return () => {
      socket.off('session:roomCreated', handleRoomCreated);
      socket.off('session:roomClosed', handleRoomClosed);
      socket.off('session:widgetStateChanged', handleWidgetStateChanged);
      socket.off('session:participantUpdate', handleParticipantUpdate);
      socket.off('session:closed', handleSessionClosed);
    };
  }, [socket, setActiveRooms]);
};
