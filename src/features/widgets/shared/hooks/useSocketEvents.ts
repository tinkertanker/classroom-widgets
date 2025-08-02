import { useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';

type EventHandler = (data: any) => void;
type EventMap = Record<string, EventHandler>;

interface UseSocketEventsProps {
  socket: Socket | null;
  events: EventMap;
  isActive?: boolean; // Controls whether events can be emitted
}

/**
 * Hook to manage socket event listeners with automatic cleanup
 * Prevents duplicate listeners and handles reconnection scenarios
 * 
 * Event listeners are always registered when a socket is available to ensure
 * events can be received regardless of widget state. The isActive flag only
 * controls whether events can be emitted.
 * 
 * @param socket - The socket.io socket instance
 * @param events - Map of event names to handler functions
 * @param isActive - Whether to allow emitting events (defaults to true)
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
    // Always register events when we have a socket
    // This ensures we can receive events regardless of widget state
    if (!socket) return;

    // Wrapper function to call the latest handler from the ref
    const wrappedEvents: EventMap = {};
    
    // Register all event listeners
    const eventEntries = Object.entries(eventsRef.current);
    console.log('[useSocketEvents] Registering events:', eventEntries.map(([name]) => name), 'isActive:', isActive);
    
    eventEntries.forEach(([eventName, handler]) => {
      const eventHandler = (data: any) => {
        if (eventsRef.current[eventName]) {
          eventsRef.current[eventName](data);
        }
      };
      wrappedEvents[eventName] = eventHandler;
      socket.on(eventName, eventHandler);
    });

    // Cleanup function to remove all listeners
    return () => {
      console.log('[useSocketEvents] Cleaning up events:', Object.keys(wrappedEvents));
      Object.entries(wrappedEvents).forEach(([eventName, handler]) => {
        socket.off(eventName, handler);
      });
    };
  }, [socket]); // Remove isActive from dependencies - always register when socket changes

  // Helper to emit events
  const emit = useCallback((eventName: string, data: any) => {
    console.log('[useSocketEvents] emit called:', {
      eventName,
      hasSocket: !!socket,
      isConnected: socket?.connected,
      isActive,
      willEmit: !!(socket && socket.connected && isActive)
    });
    if (socket && socket.connected && isActive) {
      socket.emit(eventName, data);
    } else {
      console.warn('[useSocketEvents] NOT emitting - missing requirements');
    }
  }, [socket, isActive]);

  return { emit };
}