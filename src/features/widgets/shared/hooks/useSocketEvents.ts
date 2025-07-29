import { useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';

type EventHandler = (data: any) => void;
type EventMap = Record<string, EventHandler>;

interface UseSocketEventsProps {
  socket: Socket | null;
  events: EventMap;
  isActive?: boolean;
}

/**
 * Hook to manage socket event listeners with automatic cleanup
 * Prevents duplicate listeners and handles reconnection scenarios
 */
export function useSocketEvents({ 
  socket, 
  events, 
  isActive = true 
}: UseSocketEventsProps) {
  const eventsRef = useRef<EventMap>(events);
  
  // Update ref when events change
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    if (!socket || !isActive) return;

    // Attach all event listeners
    const eventEntries = Object.entries(eventsRef.current);
    console.log('[useSocketEvents] Registering events:', eventEntries.map(([name]) => name));
    
    eventEntries.forEach(([eventName, handler]) => {
      socket.on(eventName, handler);
    });

    // Cleanup function to remove all listeners
    return () => {
      eventEntries.forEach(([eventName, handler]) => {
        socket.off(eventName, handler);
      });
    };
  }, [socket, isActive]);

  // Helper to emit events
  const emit = useCallback((eventName: string, data: any) => {
    if (socket && socket.connected && isActive) {
      socket.emit(eventName, data);
    }
  }, [socket, isActive]);

  return { emit };
}