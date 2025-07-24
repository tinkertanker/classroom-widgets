import { useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { ActivityRoomType } from '../types/activity.types';

interface UseActivitySocketProps {
  socket: Socket;
  sessionCode: string;
  roomType: ActivityRoomType;
  widgetId?: string;
  isSession?: boolean;
  onRequestState?: () => void;
}

interface UseActivitySocketReturn {
  isConnected: boolean;
  emit: (event: string, data: any, callback?: Function) => void;
  on: (event: string, handler: Function) => void;
  off: (event: string, handler: Function) => void;
}

/**
 * Common hook for managing socket connections in activity components
 * Handles room join/leave and provides wrapped socket methods
 */
export function useActivitySocket({
  socket,
  sessionCode,
  roomType,
  widgetId,
  isSession = true,
  onRequestState
}: UseActivitySocketProps): UseActivitySocketReturn {
  const mountedRef = useRef(true);
  const handlersRef = useRef<Map<string, Function>>(new Map());

  // Join room on mount, leave on unmount
  useEffect(() => {
    mountedRef.current = true;

    if (isSession && widgetId) {
      // Join the widget-specific room
      socket.emit('session:joinRoom', {
        sessionCode,
        roomType,
        widgetId
      });

      // Request initial state after a short delay
      const stateTimer = setTimeout(() => {
        if (mountedRef.current && onRequestState) {
          onRequestState();
        }
      }, 100);

      return () => {
        mountedRef.current = false;
        clearTimeout(stateTimer);
        
        // Leave room on unmount
        socket.emit('session:leaveRoom', {
          sessionCode,
          roomType,
          widgetId
        });

        // Clean up all handlers
        handlersRef.current.forEach((handler, event) => {
          socket.off(event, handler as any);
        });
        handlersRef.current.clear();
      };
    }

    return () => {
      mountedRef.current = false;
    };
  }, [socket, sessionCode, roomType, widgetId, isSession, onRequestState]);

  // Wrapped emit that checks if component is still mounted
  const emit = useCallback((event: string, data: any, callback?: Function) => {
    if (mountedRef.current && socket.connected) {
      if (callback) {
        socket.emit(event, data, callback);
      } else {
        socket.emit(event, data);
      }
    }
  }, [socket]);

  // Wrapped on that tracks handlers for cleanup
  const on = useCallback((event: string, handler: Function) => {
    const wrappedHandler = (...args: any[]) => {
      if (mountedRef.current) {
        handler(...args);
      }
    };
    
    handlersRef.current.set(event, wrappedHandler);
    socket.on(event, wrappedHandler as any);
  }, [socket]);

  // Wrapped off that removes from tracking
  const off = useCallback((event: string, handler: Function) => {
    const wrappedHandler = handlersRef.current.get(event);
    if (wrappedHandler) {
      socket.off(event, wrappedHandler as any);
      handlersRef.current.delete(event);
    }
  }, [socket]);

  return {
    isConnected: socket.connected,
    emit,
    on,
    off
  };
}