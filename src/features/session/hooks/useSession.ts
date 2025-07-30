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
  
  const { isRecovering } = useSessionRecovery({
    socket,
    sessionCode: localSessionCode || sessionCode,
    isConnected,
    isCreatingSession: isStarting,
    onSessionRestored: () => {
      console.log('[Session] Session restored successfully');
      setError(null);
      const storedCode = useWorkspaceStore.getState().sessionCode;
      if (storedCode && !sessionCode) {
        setSessionCode(storedCode);
        setLocalSessionCode(storedCode);
      }
    },
    onSessionLost: () => {
      console.log('[Session] Session lost');
      setSessionCode(null);
      setLocalSessionCode(null);
      useWorkspaceStore.getState().setSessionCode(null);
      if (localSessionCode || sessionCode) {
        setError('Session expired. Please start a new session.');
      }
    }
  });
  
  const createSession = useCallback(async () => {
    if (!socket?.connected || !isConnected) {
      setError('Not connected to server. Please check your connection.');
      return null;
    }
    
    setIsStarting(true);
    setError(null);
    
    if (error === 'Session expired. Please start a new session.') {
      setSessionCode(null);
      setLocalSessionCode(null);
    }
    
    try {
      let currentSessionCode = localSessionCode || sessionCode;
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      
      if (currentSessionCode && sessionCreatedAt) {
        const sessionAge = Date.now() - sessionCreatedAt;
        if (sessionAge > TWO_HOURS) {
          setSessionCode(null);
          setLocalSessionCode(null);
          currentSessionCode = null;
        } else if (isRecovering) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          currentSessionCode = sessionCode || localSessionCode;
        } else {
          try {
            const response = await api.get(`/api/sessions/${currentSessionCode}/exists`);
            if (!response.data.exists) {
              setSessionCode(null);
              setLocalSessionCode(null);
              currentSessionCode = null;
            }
          } catch (error) {
            setSessionCode(null);
            setLocalSessionCode(null);
            currentSessionCode = null;
          }
        }
      }
      
      if (!currentSessionCode) {
        return await new Promise<string | null>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout creating session'));
          }, 10000);
          
          socket.emit('session:create', {}, (response: any) => {
            clearTimeout(timeout);
            if (response.error) {
              reject(new Error(response.error));
            } else if (response.success) {
              setSessionCode(response.code);
              setLocalSessionCode(response.code);
              setTimeout(() => resolve(response.code), 100);
            } else {
              reject(new Error('Failed to create session'));
            }
          });
        });
      }
      return currentSessionCode;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
      setIsStarting(false);
      return null;
    }
  }, [socket?.connected, isConnected, sessionCode, localSessionCode, isRecovering, sessionCreatedAt, setSessionCode]);
  
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
