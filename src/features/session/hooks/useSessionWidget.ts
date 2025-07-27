import { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { useSession, RoomType } from './useSession';

interface UseSessionWidgetProps {
  widgetId: string;
  roomType: RoomType;
  onRoomReady?: () => void;
  onRoomClosed?: () => void;
}

interface UseSessionWidgetReturn {
  socket: Socket | null;
  sessionCode: string;
  isConnecting: boolean;
  connectionError: string;
  isConnected: boolean;
  isRoomActive: boolean;
  participantCount: number;
  startRoom: () => Promise<void>;
  stopRoom: () => void;
  sendToRoom: (event: string, data: any) => void;
}

export function useSessionWidget({
  widgetId,
  roomType,
  onRoomReady,
  onRoomClosed
}: UseSessionWidgetProps): UseSessionWidgetReturn {
  const [isRoomActive, setIsRoomActive] = useState(false);
  
  const session = useSession({
    onRoomCreated: (createdRoomType) => {
      if (createdRoomType === roomType) {
        setIsRoomActive(true);
        onRoomReady?.();
      }
    },
    onRoomClosed: (closedRoomType) => {
      if (closedRoomType === roomType) {
        setIsRoomActive(false);
        onRoomClosed?.();
      }
    }
  });

  // Handle widget deletion cleanup
  useEffect(() => {
    const handleWidgetCleanup = (event: CustomEvent) => {
      if (event.detail.widgetId === widgetId && isRoomActive) {
        session.closeRoom(roomType);
      }
    };
    
    window.addEventListener('widget-cleanup' as any, handleWidgetCleanup);
    
    return () => {
      window.removeEventListener('widget-cleanup' as any, handleWidgetCleanup);
    };
  }, [widgetId, roomType, isRoomActive, session]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRoomActive) {
        session.closeRoom(roomType);
      }
    };
  }, []);

  // Start the room
  const startRoom = useCallback(async () => {
    try {
      // Create session if needed
      if (!session.sessionCode) {
        await session.createSession();
      }
      
      // Create room within session
      await session.createRoom(roomType);
      setIsRoomActive(true);
    } catch (error) {
      throw error;
    }
  }, [session, roomType]);

  // Stop the room
  const stopRoom = useCallback(() => {
    session.closeRoom(roomType);
    setIsRoomActive(false);
  }, [session, roomType]);

  // Send event to room participants
  const sendToRoom = useCallback((event: string, data: any) => {
    if (!session.socket || !session.sessionCode || !isRoomActive) return;
    
    // Add session prefix to event
    const sessionEvent = `session:${roomType}:${event}`;
    session.socket.emit(sessionEvent, {
      sessionCode: session.sessionCode,
      ...data
    });
  }, [session.socket, session.sessionCode, roomType, isRoomActive]);

  return {
    socket: session.socket,
    sessionCode: session.sessionCode,
    isConnecting: session.isConnecting,
    connectionError: session.connectionError,
    isConnected: session.isConnected,
    isRoomActive,
    participantCount: session.participantCount,
    startRoom,
    stopRoom,
    sendToRoom
  };
}