// Hook for networked widgets using the new architecture

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';

export type RoomType = 'poll' | 'linkShare' | 'rtFeedback' | 'questions';

interface UseNetworkedWidgetProps {
  widgetId?: string;
  roomType: RoomType;
  onRoomCreated?: () => void;
  onRoomClosed?: () => void;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface UseNetworkedWidgetReturn {
  isRoomActive: boolean;
  isStarting: boolean;
  error: string | null;
  handleStart: () => Promise<void>;
  handleStop: () => void;
  session: {
    socket: any;
    sessionCode: string | null;
    participantCount: number;
    isConnected: boolean;
  };
}

export function useNetworkedWidget({
  widgetId,
  roomType,
  onRoomCreated,
  onRoomClosed,
  savedState,
  onStateChange
}: UseNetworkedWidgetProps): UseNetworkedWidgetReturn {
  const [isRoomActive, setIsRoomActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  
  const sessionCode = useWorkspaceStore((state) => state.sessionCode);
  const setSessionCode = useWorkspaceStore((state) => state.setSessionCode);
  const isConnected = useWorkspaceStore((state) => state.serverStatus.connected);
  const serverUrl = useWorkspaceStore((state) => state.serverStatus.url);
  
  const socketRef = useRef<any>(null);
  
  // Get socket from window
  useEffect(() => {
    socketRef.current = (window as any).socket;
  }, []);
  
  // Create session object
  const session = {
    socket: socketRef.current,
    sessionCode,
    participantCount,
    isConnected
  };
  
  // Setup socket listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    
    const handleRoomCreated = (data: { roomType: string; widgetId?: string; sessionCode: string }) => {
      if (data.roomType === roomType) {
        const widgetMatch = data.widgetId === undefined || data.widgetId === widgetId;
        if (widgetMatch) {
          setIsRoomActive(true);
          setSessionCode(data.sessionCode);
          onRoomCreated?.();
        }
      }
    };
    
    const handleRoomClosed = (data: { roomType: string; widgetId?: string }) => {
      if (data.roomType === roomType) {
        const widgetMatch = data.widgetId === undefined || data.widgetId === widgetId;
        if (widgetMatch) {
          setIsRoomActive(false);
          setSessionCode(null);
          setParticipantCount(0);
          onRoomClosed?.();
        }
      }
    };
    
    const handleParticipantUpdate = (data: { count: number; roomType: string; widgetId?: string }) => {
      if (data.roomType === roomType) {
        const widgetMatch = data.widgetId === undefined || data.widgetId === widgetId;
        if (widgetMatch) {
          setParticipantCount(data.count);
        }
      }
    };
    
    const handleError = (data: { message: string; roomType?: string }) => {
      if (!data.roomType || data.roomType === roomType) {
        setError(data.message);
        setIsStarting(false);
      }
    };
    
    socket.on('session:roomCreated', handleRoomCreated);
    socket.on('session:roomClosed', handleRoomClosed);
    socket.on('session:participantUpdate', handleParticipantUpdate);
    socket.on('session:error', handleError);
    
    return () => {
      socket.off('session:roomCreated', handleRoomCreated);
      socket.off('session:roomClosed', handleRoomClosed);
      socket.off('session:participantUpdate', handleParticipantUpdate);
      socket.off('session:error', handleError);
    };
  }, [roomType, widgetId, onRoomCreated, onRoomClosed, setSessionCode]);
  
  // Handle start
  const handleStart = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket || !isConnected) {
      setError('Not connected to server. Please check your connection.');
      return;
    }
    
    setIsStarting(true);
    setError(null);
    
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout creating room'));
        }, 10000);
        
        socket.emit('session:createRoom', { 
          roomType,
          widgetId 
        }, (response: any) => {
          clearTimeout(timeout);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve();
          }
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
      setIsStarting(false);
    }
  }, [isConnected, roomType, widgetId]);
  
  // Handle stop
  const handleStop = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !sessionCode) return;
    
    socket.emit('session:closeRoom', { 
      sessionCode,
      roomType,
      widgetId 
    });
  }, [sessionCode, roomType, widgetId]);
  
  // Load saved state
  useEffect(() => {
    if (savedState?.isRoomActive) {
      setIsRoomActive(true);
      if (savedState.sessionCode) {
        setSessionCode(savedState.sessionCode);
      }
    }
  }, [savedState, setSessionCode]);
  
  // Save state changes
  useEffect(() => {
    onStateChange?.({
      isRoomActive,
      sessionCode
    });
  }, [isRoomActive, sessionCode, onStateChange]);
  
  return {
    isRoomActive,
    isStarting,
    error,
    handleStart,
    handleStop,
    session
  };
}