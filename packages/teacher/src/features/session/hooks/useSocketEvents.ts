import { useEffect, useCallback, useRef } from 'react';
import { useSession } from '../../../contexts/SessionContext';
import type {
  ServerEventName,
  ServerEventData,
  ClientEventName,
  ClientEventData,
  ClientToServerEvents
} from '@shared/types/socket.types';

/** A handler per server event, each receiving that event's payload type. */
export type SocketEventHandlers = {
  [K in ServerEventName]?: (data: ServerEventData<K>) => void;
};

/** The payload a client event's acknowledgement callback receives. */
type AckResponse<T extends ClientEventName> =
  Parameters<ClientToServerEvents[T]> extends [unknown, (response: infer R) => void] ? R : never;

interface UseSocketEventsProps {
  events: SocketEventHandlers;
  isActive?: boolean; // Optional flag to enable/disable event listeners
}

interface UseSocketEventsReturn {
  emit: <T extends ClientEventName>(event: T, data: ClientEventData<T>) => void;
  emitWithAck: <T extends ClientEventName>(event: T, data: ClientEventData<T>) => Promise<AckResponse<T>>;
}

// Object.keys widens to string[]; the keys of a handler map are event names.
const handledEventNames = (events: SocketEventHandlers): ServerEventName[] =>
  (Object.keys(events) as ServerEventName[]).filter((name) => events[name]);

// Calls the latest handler for one event. Generic so the payload type follows
// the event name.
const dispatch = <K extends ServerEventName>(
  events: SocketEventHandlers,
  eventName: K,
  data: ServerEventData<K>
) => {
  const handler: SocketEventHandlers[K] = events[eventName];
  handler?.(data);
};

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
  const { socket, sessionCode, canEditSession } = useSession();
  const eventsRef = useRef(events);

  // Update events ref to avoid stale closures
  eventsRef.current = events;

  // Re-subscribe only when the SET of event names changes, not when the
  // events object identity changes — callers typically pass inline objects,
  // which would otherwise tear down and re-register every listener on every
  // render (and could drop events emitted in between)
  const eventNamesKey = handledEventNames(events)
    .sort()
    .join(',');

  // Register/unregister event listeners
  useEffect(() => {
    if (!socket || !isActive) return;

    // Register a stable wrapper per event that reads the latest handler at
    // call time; cleanup removes only OUR wrappers, not all listeners for
    // the event, so multiple widgets of the same type can coexist
    const wrappers = new Map<ServerEventName, (data: never) => void>();
    // The latest events object holds exactly the names in eventNamesKey.
    handledEventNames(eventsRef.current).forEach((eventName) => {
      const wrapper = (data: ServerEventData<typeof eventName>) => {
        dispatch(eventsRef.current, eventName, data);
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
    if (!socket?.connected || !sessionCode || !canEditSession()) {
      console.warn(`[SocketEvents] Cannot emit ${event} - session not ready`);
      return;
    }

    socket.emit(event, data);
  }, [socket, sessionCode, canEditSession]);

  // Emit with acknowledgment and type safety
  const emitWithAck = useCallback(async <T extends ClientEventName>(event: T, data: ClientEventData<T>): Promise<AckResponse<T>> => {
    if (!socket?.connected || !sessionCode || !canEditSession()) {
      console.warn(`[SocketEvents] Cannot emit ${event} - session not ready`);
      throw new Error('Session not ready');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${event} acknowledgment`));
      }, 10000);

      socket.emit(event, data, (response: AckResponse<T> & { error?: string }) => {
        clearTimeout(timeout);
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }, [socket, sessionCode, canEditSession]);
  
  return { emit, emitWithAck };
}
