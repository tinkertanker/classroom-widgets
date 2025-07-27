import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

interface UseSessionRecoveryProps {
  socket: Socket | null;
  sessionCode: string | null;
  isConnected: boolean;
  onSessionRestored?: (rooms: any[]) => void;
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
  const [isRecovering, setIsRecovering] = useState(false);
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
        setIsRecovering(true);
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
            // Session still exists, try to rejoin
            socket.emit('session:join', { 
              code: lastSessionCode.current,
              name: localStorage.getItem('studentName') || 'Anonymous',
              studentId: socket.id
            });
            
            // Wait for join response
            const joinTimeout = setTimeout(() => {
              console.log('[useSessionRecovery] Join timeout - session may be invalid');
              lastSessionCode.current = null;
              if (hasEverHadSession.current) {
                onSessionLost?.();
              }
              attemptingRecovery.current = false;
              setIsRecovering(false);
            }, 5000);
            
            socket.once('session:joined', (joinData) => {
              clearTimeout(joinTimeout);
              if (joinData.success && joinData.activeRooms) {
                console.log('[useSessionRecovery] Session recovered successfully');
                onSessionRestored?.(joinData.activeRooms);
              } else {
                console.log('[useSessionRecovery] Failed to recover session');
                lastSessionCode.current = null;
                if (hasEverHadSession.current) {
                  onSessionLost?.();
                }
              }
              attemptingRecovery.current = false;
              setIsRecovering(false);
            });
          } else {
            console.log('[useSessionRecovery] Session no longer exists on server');
            lastSessionCode.current = null;
            if (hasEverHadSession.current) {
              onSessionLost?.();
            }
            attemptingRecovery.current = false;
            setIsRecovering(false);
          }
        } catch (error) {
          console.error('[useSessionRecovery] Error checking session:', error);
          attemptingRecovery.current = false;
          setIsRecovering(false);
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

    // Check immediately if already connected
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      // Cleanup not needed as socket event listeners are managed elsewhere
    };
  }, [socket, isConnected, onSessionRestored, onSessionLost]);

  return {
    isRecovering,
    lastSessionCode: lastSessionCode.current
  };
}