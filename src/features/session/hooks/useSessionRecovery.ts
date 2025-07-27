import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';

interface UseSessionRecoveryProps {
  socket: any;
  sessionCode: string | null;
  isConnected: boolean;
  onSessionRestored?: () => void;
  onSessionLost?: () => void;
}

/**
 * Hook to handle session recovery after disconnections (e.g., hot reload)
 * Attempts to rejoin existing sessions automatically
 */
export function useSessionRecovery({
  socket,
  sessionCode,
  isConnected,
  onSessionRestored,
  onSessionLost
}: UseSessionRecoveryProps) {
  const attemptingRecovery = useRef(false);
  const lastSessionCode = useRef<string | null>(null);
  const hasEverHadSession = useRef(false);
  const hasDisconnected = useRef(false);  // Track if we've ever disconnected
  
  useEffect(() => {
    // Track the last known session code
    if (sessionCode) {
      lastSessionCode.current = sessionCode;
      hasEverHadSession.current = true;
    }
  }, [sessionCode]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleConnect = async () => {
      console.log('[useSessionRecovery] Socket connected, checking for session recovery...');
      
      // Only attempt recovery if we've disconnected before (not on initial connect)
      if (lastSessionCode.current && !attemptingRecovery.current && hasDisconnected.current) {
        attemptingRecovery.current = true;
        console.log('[useSessionRecovery] Attempting to recover session:', lastSessionCode.current);
        
        try {
          // Check if session still exists on server
          const response = await fetch(`/api/sessions/${lastSessionCode.current}/exists`);
          
          // Check if response is ok and is JSON
          if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
            throw new Error('Invalid response from server');
          }
          
          const data = await response.json();
          
          if (data.exists) {
            // Session still exists, emit recovery event
            socket.emit('session:recover', { 
              sessionCode: lastSessionCode.current 
            }, (response: any) => {
              if (response.success) {
                console.log('[useSessionRecovery] Session recovered successfully');
                onSessionRestored?.();
              } else {
                console.log('[useSessionRecovery] Failed to recover session:', response.error);
                lastSessionCode.current = null;
                // Only call onSessionLost if we actually had a session before
                if (hasEverHadSession.current) {
                  onSessionLost?.();
                }
              }
              attemptingRecovery.current = false;
            });
          } else {
            console.log('[useSessionRecovery] Session no longer exists on server');
            lastSessionCode.current = null;
            // Only call onSessionLost if we actually had a session before
            if (hasEverHadSession.current) {
              onSessionLost?.();
            }
            attemptingRecovery.current = false;
          }
        } catch (error) {
          console.error('[useSessionRecovery] Error checking session:', error);
          attemptingRecovery.current = false;
          // Only call onSessionLost if we actually had a session before
          if (hasEverHadSession.current) {
            onSessionLost?.();
          }
        }
      }
    };

    const handleDisconnect = () => {
      console.log('[useSessionRecovery] Socket disconnected');
      hasDisconnected.current = true;
      // Don't clear lastSessionCode here - we need it for recovery
    };

    // Listen for connection events
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    // Check immediately if already connected
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, isConnected, onSessionRestored, onSessionLost]);

  return {
    isRecovering: attemptingRecovery.current,
    lastSessionCode: lastSessionCode.current
  };
}