import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { useSessionRecovery } from './useSessionRecovery';
import { useSocket } from '../../../hooks/useSocket';
import api from '../../../services/api';

export function useSession() {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sessionCode = useWorkspaceStore((state) => state.sessionCode);
  const sessionCreatedAt = useWorkspaceStore((state) => state.sessionCreatedAt);
  const setSessionCode = useWorkspaceStore((state) => state.setSessionCode);
  const isConnected = useWorkspaceStore((state) => state.serverStatus.connected);
  
  const { socket } = useSocket();
  
  const [localSessionCode, setLocalSessionCode] = useState<string | null>(sessionCode);
  
  useEffect(() => {
    if (sessionCode && sessionCode !== localSessionCode) {
      setLocalSessionCode(sessionCode);
    }
  }, [sessionCode, localSessionCode]);
  
  const onSessionRestored = useCallback(() => {
    console.log('[Session] Session restored successfully');
    setError(null);
    const storedCode = useWorkspaceStore.getState().sessionCode;
    if (storedCode && !sessionCode) {
      setSessionCode(storedCode);
      setLocalSessionCode(storedCode);
    }
  }, [sessionCode, setSessionCode]);

  const onSessionLost = useCallback(() => {
    console.log('[Session] Session lost');
    setSessionCode(null);
    setLocalSessionCode(null);
    useWorkspaceStore.getState().setSessionCode(null);
    if (localSessionCode || sessionCode) {
      setError('Session expired. Please start a new session.');
    }
  }, [localSessionCode, sessionCode, setSessionCode]);

  const { isRecovering } = useSessionRecovery({
    socket,
    sessionCode: localSessionCode || sessionCode,
    isConnected,
    isCreatingSession: isStarting,
    onSessionRestored,
    onSessionLost
  });
  
  const createSession = useCallback(async () => {
    if (!socket?.connected || !isConnected) {
      setError('Not connected to server. Please check your connection.');
      return null;
    }
    
    setIsStarting(true);
    setError(null);
    
    try {
      // Get latest session state directly from the store to avoid dependency cycle
      let currentSessionCode = useWorkspaceStore.getState().sessionCode;
      const currentSessionCreatedAt = useWorkspaceStore.getState().sessionCreatedAt;
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      
      if (currentSessionCode && currentSessionCreatedAt) {
        const sessionAge = Date.now() - currentSessionCreatedAt;
        if (sessionAge > TWO_HOURS) {
          setSessionCode(null);
          currentSessionCode = null;
        } else {
          try {
            const response = await api.get(`/api/sessions/${currentSessionCode}/exists`);
            if (!response.data.exists) {
              setSessionCode(null);
              currentSessionCode = null;
            }
          } catch (error) {
            setSessionCode(null);
            currentSessionCode = null;
          }
        }
      }
      
      if (!currentSessionCode) {
        // Create a new session
        return await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout creating session'));
          }, 10000);
          
          socket.emit('session:create', {}, (response: any) => {
            clearTimeout(timeout);
            if (response.error) {
              reject(new Error(response.error));
            } else if (response.success) {
              setSessionCode(response.code);
              resolve({ code: response.code, activeRooms: [] });
            } else {
              reject(new Error('Failed to create session'));
            }
          });
        });
      } else {
        // Rejoin existing session as teacher
        return await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout rejoining session'));
          }, 10000);
          
          socket.emit('session:create', { 
            existingCode: currentSessionCode
          }, (response: any) => {
            clearTimeout(timeout);
            if (response.error) {
              reject(new Error(response.error));
            } else if (response.success) {
              console.log('[Session] Rejoined session as teacher:', currentSessionCode, 'with active rooms:', response.activeRooms);
              setSessionCode(currentSessionCode);
              resolve({ code: currentSessionCode, activeRooms: response.activeRooms || [] });
            } else {
              reject(new Error('Failed to rejoin session'));
            }
          });
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
      setIsStarting(false);
      return null;
    }
  }, [socket, isConnected, setSessionCode]);
  
  const closeSession = useCallback(() => {
    if (!socket || !sessionCode) return;
    
    socket.emit('session:close', { sessionCode });
    
    setSessionCode(null);
    setLocalSessionCode(null);
  }, [socket?.connected, sessionCode, setSessionCode]);
  
  const session = useMemo(() => {
    const code = localSessionCode || sessionCode;
    return {
      socket,
      sessionCode: code,
      isConnected,
      isRecovering,
      isStarting,
      error,
      createSession,
      closeSession,
    };
  }, [socket, localSessionCode, sessionCode, isConnected, isRecovering, isStarting, error, createSession, closeSession]);
  
  return session;
}
