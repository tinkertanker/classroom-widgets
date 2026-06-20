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

  // Update events ref to avoid stale closures
  eventsRef.current = events;

  // Re-subscribe only when the SET of event names changes, not when the
  // events object identity changes — callers typically pass inline objects,
  // which would otherwise tear down and re-register every listener on every
  // render (and could drop events emitted in between)
  const eventNamesKey = Object.keys(events)
    .filter((name) => events[name as ServerEventName])
    .sort()
    .join(',');

  // Register/unregister event listeners
  useEffect(() => {
    if (!socket || !isActive) return;

    // Register a stable wrapper per event that reads the latest handler at
    // call time; cleanup removes only OUR wrappers, not all listeners for
    // the event, so multiple widgets of the same type can coexist
    const wrappers = new Map<string, (...args: any[]) => void>();
    const eventNames = eventNamesKey ? eventNamesKey.split(',') : [];

    eventNames.forEach((eventName) => {
      const wrapper = (...args: any[]) => {
        const handler = eventsRef.current[eventName as ServerEventName] as
          | ((...handlerArgs: any[]) => void)
          | undefined;
        handler?.(...args);
      };
      wrappers.set(eventName, wrapper);
      socket.on(eventName, wrapper);
    });

    return () => {
      wrappers.forEach((wrapper, eventName) => {
        socket.off(eventName, wrapper);
      });
    };
  }, [socket, eventNamesKey, isActive]);
  
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