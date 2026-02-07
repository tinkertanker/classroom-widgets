import { useEffect, useCallback, useRef } from 'react';
import { useSession } from '../../../contexts/SessionContext';
import { ServerEventName, ClientEventName, ServerEventData, ClientEventData } from '@shared/types/socket.types';

interface UseSocketEventsProps {
  events: Partial<Record<ServerEventName, (data: any) => void>>;
  isActive?: boolean; // Optional flag to enable/disable event listeners
}

interface UseSocketEventsReturn {
  emit: <T extends ClientEventName>(event: T, data: ClientEventData<T>) => void;
  emitWithAck: <T extends ClientEventName>(event: T, data: ClientEventData<T>) => Promise<any>;
}

/**
 * Hook to manage socket event listeners using the session
 * Automatically cleans up listeners on unmount or when events change
 *
 * IMPORTANT: This hook stores handler references and only removes OUR specific
 * handlers on cleanup. This allows multiple widgets of the same type to coexist
 * without interfering with each other's event listeners.
 */
export function useSocketEvents({
  events,
  isActive = true
}: UseSocketEventsProps): UseSocketEventsReturn {
  const { socket, isConnected } = useSession();
  const eventsRef = useRef(events);

  // Store handler references so we can remove only our handlers on cleanup
  const handlersRef = useRef<Map<string, (...args: any[]) => void>>(new Map());

  // Update events ref to avoid stale closures
  eventsRef.current = events;

  // Register/unregister event listeners
  useEffect(() => {
    if (!socket || !isActive) return;

    // Clear previous handlers before registering new ones
    handlersRef.current.clear();

    // Register all event listeners and store handler references
    Object.entries(events).forEach(([eventName, handler]) => {
      if (handler) {
        handlersRef.current.set(eventName, handler);
        socket.on(eventName, handler);
      }
    });

    // Cleanup function - remove only OUR handlers, not all listeners for the event
    return () => {
      handlersRef.current.forEach((handler, eventName) => {
        socket.off(eventName, handler);
      });
      handlersRef.current.clear();
    };
  }, [socket, events, isActive]);
  
  // Emit function with type safety
  const emit = useCallback(<T extends ClientEventName>(event: T, data: ClientEventData<T>) => {
    if (!socket || !isConnected) {
      console.warn(`[SocketEvents] Cannot emit ${event} - not connected`);
      return;
    }

    socket.emit(event, data);
  }, [socket, isConnected]);

  // Emit with acknowledgment and type safety
  const emitWithAck = useCallback(async <T extends ClientEventName>(event: T, data: ClientEventData<T>): Promise<any> => {
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