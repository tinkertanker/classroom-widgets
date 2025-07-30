// Hook for networked widgets using the new architecture

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { useSessionRecovery } from './useSessionRecovery';

export type RoomType = 'poll' | 'linkShare' | 'rtfeedback' | 'questions';

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
  closeSession: () => void;
  session: {
    socket: any;
    sessionCode: string | null;
    participantCount: number;
    isConnected: boolean;
    isRecovering?: boolean;
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
  const sessionCreatedAt = useWorkspaceStore((state) => state.sessionCreatedAt);
  const setSessionCode = useWorkspaceStore((state) => state.setSessionCode);
  const isConnected = useWorkspaceStore((state) => state.serverStatus.connected);
  const serverUrl = useWorkspaceStore((state) => state.serverStatus.url);
  
  
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
  
  // Session recovery after hot reload - only if we had a session
  const { isRecovering } = useSessionRecovery({
    socket,
    sessionCode: localSessionCode || sessionCode,
    isConnected,
    isCreatingSession: isStarting,
    onSessionRestored: () => {
      console.log('[NetworkedWidget] Session restored successfully');
      setError(null);
      // Ensure session code is properly set after recovery
      const storedCode = useWorkspaceStore.getState().sessionCode;
      if (storedCode && !sessionCode) {
        setSessionCode(storedCode);
        setLocalSessionCode(storedCode);
      }
    },
    onSessionLost: () => {
      console.log('[NetworkedWidget] Session lost');
      setIsRoomActive(false);
      setSessionCode(null);
      setLocalSessionCode(null);
      setParticipantCount(0);
      // Clear persisted session from store
      useWorkspaceStore.getState().setSessionCode(null);
      // Only show error if we actually had a session before
      if (localSessionCode || sessionCode) {
        setError('Session expired. Please start a new session.');
      }
    }
  });
  
  // Create session object - memoize to prevent infinite rerenders
  const session = useMemo(() => {
    const code = localSessionCode || sessionCode;
    return {
      socket,
      sessionCode: code,
      participantCount,
      isConnected,
      isRecovering
    };
  }, [socket, localSessionCode, sessionCode, participantCount, isConnected, isRecovering]);
  
  // Setup socket listeners
  useEffect(() => {
    if (!socket) return;
    
    const handleRoomCreated = (data: { roomType: string; widgetId?: string; sessionCode?: string }) => {
      if (data.roomType === roomType) {
        const widgetMatch = data.widgetId === undefined || data.widgetId === widgetId;
        if (widgetMatch) {
          setIsRoomActive(true);
          // Don't override existing session code - we already have it from session creation
          // Only set if we somehow don't have one and the server provides it
          if (!sessionCode && !localSessionCode && data.sessionCode) {
            setSessionCode(data.sessionCode);
            setLocalSessionCode(data.sessionCode);
          }
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
    
    // Handle session recovery events
    const handleSessionRecovered = (data: { sessionCode: string; rooms: any[] }) => {
      if (data.sessionCode) {
        setSessionCode(data.sessionCode);
        setLocalSessionCode(data.sessionCode);
        
        // Check if our room is active
        const ourRoom = data.rooms?.find(r => r.roomType === roomType && (!r.widgetId || r.widgetId === widgetId));
        if (ourRoom) {
          setIsRoomActive(true);
          onRoomCreated?.();
        }
      }
    };
    
    // Handle unified widget state changes from server
    const handleWidgetStateChanged = (data: { roomType: string; widgetId?: string; isActive: boolean }) => {
      if (data.roomType === roomType) {
        const widgetMatch = data.widgetId === undefined || data.widgetId === widgetId;
        if (widgetMatch) {
          // Widget should update its own state based on this event
          // This is handled by the widget-specific listeners (e.g., poll:stateChanged)
        }
      }
    };
    
    // Handle session closed by host
    const handleSessionClosed = () => {
      setIsRoomActive(false);
      setSessionCode(null);
      setLocalSessionCode(null);
      setParticipantCount(0);
      setError('Session has been closed by the host');
    };
    
    socket.on('session:roomCreated', handleRoomCreated);
    socket.on('session:roomClosed', handleRoomClosed);
    socket.on('session:participantUpdate', handleParticipantUpdate);
    socket.on('session:error', handleError);
    socket.on('session:recovered', handleSessionRecovered);
    socket.on('session:widgetStateChanged', handleWidgetStateChanged);
    socket.on('session:closed', handleSessionClosed);
    
    return () => {
      socket.off('session:roomCreated', handleRoomCreated);
      socket.off('session:roomClosed', handleRoomClosed);
      socket.off('session:participantUpdate', handleParticipantUpdate);
      socket.off('session:error', handleError);
      socket.off('session:recovered', handleSessionRecovered);
      socket.off('session:widgetStateChanged', handleWidgetStateChanged);
      socket.off('session:closed', handleSessionClosed);
    };
  }, [socket, roomType, widgetId, onRoomCreated, onRoomClosed, setSessionCode, setLocalSessionCode]);
  
  // Handle start
  const handleStart = useCallback(async () => {
    console.log('[NetworkedWidget] handleStart called', {
      socket: !!socket,
      isConnected,
      sessionCode,
      localSessionCode,
      isRecovering
    });
    
    if (!socket || !isConnected) {
      setError('Not connected to server. Please check your connection.');
      return;
    }
    
    setIsStarting(true);
    setError(null);
    
    // Clear any stale session data when starting fresh after an error
    if (error === 'Session expired. Please start a new session.') {
      console.log('[NetworkedWidget] Clearing stale session data');
      setSessionCode(null);
      setLocalSessionCode(null);
    }
    
    try {
      // First ensure we have a session
      let currentSessionCode = localSessionCode || sessionCode;
      const TWO_HOURS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
      
      // Check if existing session is valid
      if (currentSessionCode && sessionCreatedAt) {
        const sessionAge = Date.now() - sessionCreatedAt;
        if (sessionAge > TWO_HOURS) {
          // Session is too old, clear it
          console.log('[NetworkedWidget] Session too old, clearing');
          setSessionCode(null);
          setLocalSessionCode(null);
          currentSessionCode = null;
        } else if (isRecovering) {
          // If we're currently recovering, wait for it to complete
          console.log('[NetworkedWidget] Session recovery in progress, waiting...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Re-check session code after recovery
          currentSessionCode = sessionCode || localSessionCode;
        } else {
          // Session exists and is valid - check if it still exists on server
          try {
            const response = await fetch(`${serverUrl}/api/sessions/${currentSessionCode}/exists`);
            const data = await response.json();
            if (!data.exists) {
              console.log('[NetworkedWidget] Session no longer exists on server, clearing');
              setSessionCode(null);
              setLocalSessionCode(null);
              currentSessionCode = null;
            }
          } catch (error) {
            console.log('[NetworkedWidget] Error checking session, clearing:', error);
            setSessionCode(null);
            setLocalSessionCode(null);
            currentSessionCode = null;
          }
        }
      }
      
      if (!currentSessionCode) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout creating session'));
          }, 10000);
          
          console.log('[NetworkedWidget] Creating new session');
          socket.emit('session:create', {}, (response: any) => {
            clearTimeout(timeout);
            if (response.error) {
              reject(new Error(response.error));
            } else if (response.success) {
              currentSessionCode = response.code;
              setSessionCode(response.code);
              setLocalSessionCode(response.code);
              // Add a small delay to prevent immediate recovery attempts
              setTimeout(() => resolve(), 100);
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
        
        console.log('[NetworkedWidget] Emitting session:createRoom', {
          sessionCode: currentSessionCode,
          roomType,
          widgetId
        });
        
        socket.emit('session:createRoom', { 
          sessionCode: currentSessionCode,
          roomType,
          widgetId 
        }, (response: any) => {
          clearTimeout(timeout);
          console.log('[NetworkedWidget] createRoom response:', response);
          if (response.error) {
            // If we get "Invalid session or not host", clear the session and retry
            if (response.error === 'Invalid session or not host') {
              console.log('[NetworkedWidget] Not recognized as host, clearing session');
              setSessionCode(null);
              setLocalSessionCode(null);
              useWorkspaceStore.getState().setSessionCode(null);
            }
            reject(new Error(response.error));
          } else if (response.success) {
            // Set room as active based on server response
            setIsRoomActive(true);
            setIsStarting(false);
            // Make sure local session code is set
            if (!localSessionCode && currentSessionCode) {
              setLocalSessionCode(currentSessionCode);
            }
            
            // If server provided room data, notify parent component
            if (response.roomData) {
              onRoomCreated?.();
              // The widget will receive the isActive state through session:widgetStateChanged event
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
  
  // Handle explicit session close
  const closeSession = useCallback(() => {
    if (!socket || !sessionCode) return;
    
    // Close the session on the server
    socket.emit('session:close', { sessionCode });
    
    // Clear local session state
    setSessionCode(null);
    setLocalSessionCode(null);
    setIsRoomActive(false);
    setParticipantCount(0);
  }, [socket, sessionCode, setSessionCode]);
  
  // Load saved state - but don't restore session code automatically
  // Session codes should only be valid during active sessions
  useEffect(() => {
    if (savedState?.isRoomActive) {
      // Don't automatically restore room active state or session code
      // These should only be set when actively creating/joining a session
    }
  }, [savedState]);
  
  // Save state changes - but don't persist session code
  useEffect(() => {
    onStateChange?.({
      // Don't save isRoomActive or sessionCode
      // These should be ephemeral and not persist across reloads
    });
  }, [onStateChange]);
  
  return {
    isRoomActive,
    isStarting,
    error,
    handleStart,
    handleStop,
    closeSession,
    session
  };
}