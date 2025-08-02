import { useEffect, useCallback, useRef } from 'react';
import { useSession } from '../../../contexts/SessionContext';

interface UseSocketEventsProps {
  events: Record<string, (data: any) => void>;
  isActive?: boolean; // Optional flag to enable/disable event listeners
}

interface UseSocketEventsReturn {
  emit: (event: string, data: any) => void;
  emitWithAck: (event: string, data: any) => Promise<any>;
}

/**
 * Hook to manage socket event listeners using the session
 * Automatically cleans up listeners on unmount or when events change
 */
export function useSocketEvents({
  events,
  isActive = true
}: UseSocketEventsProps): UseSocketEventsReturn {
  const { socket, isConnected } = useSession();
  const eventsRef = useRef(events);
  
  // Update events ref to avoid stale closures
  eventsRef.current = events;
  
  // Register/unregister event listeners
  useEffect(() => {
    if (!socket || !isActive) return;
    
    // Register all event listeners
    Object.entries(events).forEach(([eventName, handler]) => {
      socket.on(eventName, handler);
    });
    
    // Cleanup function
    return () => {
      Object.keys(events).forEach(eventName => {
        socket.off(eventName);
      });
    };
  }, [socket, events, isActive]);
  
  // Emit function
  const emit = useCallback((event: string, data: any) => {
    if (!socket || !isConnected) {
      console.warn(`[SocketEvents] Cannot emit ${event} - not connected`);
      return;
    }
    
    socket.emit(event, data);
  }, [socket, isConnected]);
  
  // Emit with acknowledgment
  const emitWithAck = useCallback(async (event: string, data: any): Promise<any> => {
    if (!socket || !isConnected) {
      console.warn(`[SocketEvents] Cannot emit ${event} - not connected`);
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${event} acknowledgment`));
      }, 10000);
      
      socket.emit(event, data, (response: any) => {
        clearTimeout(timeout);
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }, [socket, isConnected]);
  
  return { emit, emitWithAck };
}