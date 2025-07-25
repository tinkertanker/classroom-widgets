// Hook for networked widgets using the new architecture

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';

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
  
  // console.log('[useNetworkedWidget] Connection status:', { isConnected, serverUrl, sessionCode });
  
  const [socket, setSocket] = useState<any>(null);
  
  // Get socket from window - check periodically until available
  useEffect(() => {
    const checkSocket = () => {
      const windowSocket = (window as any).socket;
      if (windowSocket && windowSocket !== socket) {
        setSocket(windowSocket);
      }
    };
    
    // Check immediately
    checkSocket();
    
    // Then check every 100ms for up to 5 seconds
    const interval = setInterval(checkSocket, 100);
    const timeout = setTimeout(() => clearInterval(interval), 5000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [socket]);
  
  // Track session code locally to ensure it's immediately available
  const [localSessionCode, setLocalSessionCode] = useState<string | null>(sessionCode);
  
  // Update local session code when store changes
  useEffect(() => {
    if (sessionCode && sessionCode !== localSessionCode) {
      setLocalSessionCode(sessionCode);
    }
  }, [sessionCode, localSessionCode]);
  
  // Create session object - memoize to prevent infinite rerenders
  const session = useMemo(() => {
    const code = localSessionCode || sessionCode;
    return {
      socket,
      sessionCode: code,
      participantCount,
      isConnected
    };
  }, [socket, localSessionCode, sessionCode, participantCount, isConnected]);
  
  // Setup socket listeners
  useEffect(() => {
    if (!socket) return;
    
    const handleRoomCreated = (data: { roomType: string; widgetId?: string; sessionCode: string }) => {
      if (data.roomType === roomType) {
        const widgetMatch = data.widgetId === undefined || data.widgetId === widgetId;
        if (widgetMatch) {
          setIsRoomActive(true);
          setSessionCode(data.sessionCode);
          setLocalSessionCode(data.sessionCode);
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
  }, [socket, roomType, widgetId, onRoomCreated, onRoomClosed, setSessionCode, setLocalSessionCode]);
  
  // Handle start
  const handleStart = useCallback(async () => {
    if (!socket || !isConnected) {
      setError('Not connected to server. Please check your connection.');
      return;
    }
    
    setIsStarting(true);
    setError(null);
    
    try {
      // First ensure we have a session
      let currentSessionCode = sessionCode;
      if (!currentSessionCode) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout creating session'));
          }, 10000);
          
          socket.emit('session:create', {}, (response: any) => {
            clearTimeout(timeout);
            // console.log('[useNetworkedWidget] session:create response:', response);
            if (response.error) {
              reject(new Error(response.error));
            } else if (response.success) {
              currentSessionCode = response.code;
              setSessionCode(response.code);
              setLocalSessionCode(response.code);
              // console.log('[useNetworkedWidget] Session created with code:', currentSessionCode);
              resolve();
            } else {
              reject(new Error('Failed to create session'));
            }
          });
        });
      }
      
      // Now create the room with the session code
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout creating room'));
        }, 10000);
        
        socket.emit('session:createRoom', { 
          sessionCode: currentSessionCode,
          roomType,
          widgetId 
        }, (response: any) => {
          clearTimeout(timeout);
          // console.log('[useNetworkedWidget] createRoom response:', response);
          if (response.error) {
            reject(new Error(response.error));
          } else if (response.success) {
            // Set room as active and ensure session code is set
            setIsRoomActive(true);
            setIsStarting(false);
            // Make sure local session code is set
            if (!localSessionCode && currentSessionCode) {
              setLocalSessionCode(currentSessionCode);
            }
            resolve();
          } else {
            reject(new Error('Failed to create room'));
          }
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
      setIsStarting(false);
    }
  }, [socket, isConnected, sessionCode, roomType, widgetId, setSessionCode]);
  
  // Handle stop
  const handleStop = useCallback(() => {
    if (!socket || !sessionCode) return;
    
    socket.emit('session:closeRoom', { 
      sessionCode,
      roomType,
      widgetId 
    });
  }, [socket, sessionCode, roomType, widgetId]);
  
  // Load saved state
  useEffect(() => {
    if (savedState?.isRoomActive) {
      setIsRoomActive(true);
      if (savedState.sessionCode) {
        setSessionCode(savedState.sessionCode);
        setLocalSessionCode(savedState.sessionCode);
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