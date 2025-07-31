import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';

interface UseSessionRecoveryProps {
  socket: any;
  sessionCode: string | null;
  isConnected: boolean;
  onSessionRestored?: () => void;
  onSessionLost?: () => void;
  isCreatingSession?: boolean;
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
  onSessionLost,
  isCreatingSession = false
}: UseSessionRecoveryProps) {
  const attemptingRecovery = useRef(false);
  const lastSessionCode = useRef<string | null>(null);
  const hasEverHadSession = useRef(false);
  const hasDisconnected = useRef(false);  // Track if we've ever disconnected
  const hasAttemptedInitialRecovery = useRef(false);  // Track initial page load recovery
  const lastSocketId = useRef<string | null>(null);  // Track socket changes
  const hasRetried = useRef(false);  // Track if we've retried recovery
  
  // Get persisted session info from store
  const persistedSessionCode = useWorkspaceStore((state) => state.sessionCode);
  const sessionCreatedAt = useWorkspaceStore((state) => state.sessionCreatedAt);
  
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
      console.log('[SessionRecovery] handleConnect called', {
        isConnected,
        sessionCode,
        persistedSessionCode,
        sessionCreatedAt,
        hasAttemptedInitialRecovery: hasAttemptedInitialRecovery.current,
        lastSessionCode: lastSessionCode.current
      });
      
      const TWO_HOURS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
      
      // Check if socket has changed (page reload)
      const socketChanged = socket.id && socket.id !== lastSocketId.current;
      if (socketChanged) {
        console.log('[SessionRecovery] Socket changed', {
          oldSocketId: lastSocketId.current,
          newSocketId: socket.id
        });
        lastSocketId.current = socket.id;
      }
      
      // Skip recovery if we're actively creating a session
      if (isCreatingSession) {
        console.log('[SessionRecovery] Skipping recovery - session creation in progress');
        return;
      }
      
      // Check for persisted session on initial page load OR socket change
      if ((!hasAttemptedInitialRecovery.current || socketChanged) && persistedSessionCode && sessionCreatedAt) {
        hasAttemptedInitialRecovery.current = true;
        const sessionAge = Date.now() - sessionCreatedAt;
        
        console.log('[SessionRecovery] Checking persisted session', {
          persistedSessionCode,
          sessionAge: sessionAge / 1000 / 60, // in minutes
          maxAge: TWO_HOURS / 1000 / 60, // in minutes
          socketChanged,
          isCreatingSession
        });
        
        // Don't attempt recovery if the session was created in the last 5 seconds
        // This prevents recovery attempts on freshly created sessions
        if (sessionAge > 5000 && sessionAge < TWO_HOURS) {
          // Check if we're already connected to this session
          if (sessionCode === persistedSessionCode && isConnected) {
            console.log('[SessionRecovery] Already connected to this session, skipping recovery');
            lastSessionCode.current = persistedSessionCode;
          } else {
            // Session is still valid, try to recover it
            console.log('[SessionRecovery] Found persisted session, attempting recovery:', persistedSessionCode);
            lastSessionCode.current = persistedSessionCode;
            hasDisconnected.current = true; // Simulate disconnect to trigger recovery
          }
        } else if (sessionAge >= TWO_HOURS) {
          // Session is too old, clear it from store
          console.log('[SessionRecovery] Persisted session too old, clearing');
          useWorkspaceStore.getState().setSessionCode(null);
        } else {
          console.log('[SessionRecovery] Session too fresh, skipping recovery (age:', sessionAge, 'ms)');
        }
      }
      
      // Only attempt recovery if we've disconnected before (not on initial connect)
      // OR if the socket has changed (page reload)
      if (lastSessionCode.current && !attemptingRecovery.current && (hasDisconnected.current || socketChanged)) {
        console.log('[SessionRecovery] Attempting recovery for session:', lastSessionCode.current, {
          hasDisconnected: hasDisconnected.current,
          attemptingRecovery: attemptingRecovery.current,
          sessionCode
        });
        attemptingRecovery.current = true;
        
        try {
          // Get the server URL from the store
          const serverUrl = useWorkspaceStore.getState().serverStatus.url || 'http://localhost:3001';
          
          // Check if session still exists on server
          const response = await fetch(`${serverUrl}/api/sessions/${lastSessionCode.current}/exists`);
          
          // Check if response is ok and is JSON
          if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
            throw new Error('Invalid response from server');
          }
          
          const data = await response.json();
          
          if (data.exists) {
            // Session still exists, emit recovery event
            console.log('[SessionRecovery] Session exists but recovery disabled for debugging');
            // RECOVERY DISABLED TEMPORARILY
            /*
            socket.emit('session:recover', { 
              sessionCode: lastSessionCode.current 
            }, (response: any) => {
              console.log('[SessionRecovery] Recovery response:', response);
              if (response.success) {
                console.log('[SessionRecovery] Successfully recovered session');
                onSessionRestored?.();
                attemptingRecovery.current = false;
              } else {
                console.log('[SessionRecovery] Recovery failed:', response.error);
                lastSessionCode.current = null;
                attemptingRecovery.current = false;
                
                // If recovery failed due to "Host already connected", wait and retry once
                if (response.error === 'Host already connected' && !hasRetried.current) {
                  hasRetried.current = true;
                  console.log('[SessionRecovery] Retrying recovery after delay...');
                  setTimeout(() => {
                    attemptingRecovery.current = false;
                    hasDisconnected.current = true;
                    handleConnect(); // Retry the recovery
                  }, 2000);
                } else {
                  // Only call onSessionLost if we actually had a session before
                  if (hasEverHadSession.current) {
                    onSessionLost?.();
                  }
                }
              }
            });
            */
            attemptingRecovery.current = false;
            lastSessionCode.current = null;
          } else {
            // Session doesn't exist on server - this is OK if we're about to create a new one
            console.log('[SessionRecovery] Session does not exist on server, skipping recovery');
            lastSessionCode.current = null;
            attemptingRecovery.current = false;
            // Don't call onSessionLost - let the widget create a fresh session
          }
        } catch (error) {
          console.log('[SessionRecovery] Error checking session:', error);
          attemptingRecovery.current = false;
          lastSessionCode.current = null;
          // Don't call onSessionLost on errors - let the widget create a fresh session
        }
      }
    };

    const handleDisconnect = () => {
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
  }, [socket, isConnected, sessionCode, persistedSessionCode, sessionCreatedAt, onSessionRestored, onSessionLost]);

  return {
    isRecovering: attemptingRecovery.current,
    lastSessionCode: lastSessionCode.current
  };
}