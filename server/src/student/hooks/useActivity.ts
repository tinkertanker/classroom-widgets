import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { ActivityType } from '../types/socket.types';
import { useActivityStore } from '../store/activityStore';
import { SocketService } from '../services/SocketService';

interface UseActivityOptions {
  socket: Socket;
  sessionCode: string;
  activityType: ActivityType;
  widgetId?: string;
  isSession?: boolean;
}

export function useActivity<T = any>({
  socket,
  sessionCode,
  activityType,
  widgetId,
  isSession = true
}: UseActivityOptions) {
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const activityStore = useActivityStore();
  const data = activityStore.getActivityData<T>(activityType, widgetId);
  
  // Create socket service wrapper
  const socketService = new SocketService();
  socketService['socket'] = socket;
  
  useEffect(() => {
    // Join room
    if (isSession && widgetId) {
      socketService.emit('session:joinRoom', {
        sessionCode,
        roomType: activityType,
        widgetId
      });
    }
    
    // Set up listeners
    const stateChangedEvent = `${activityType}:stateChanged` as keyof SocketEventMap;
    socketService.on(stateChangedEvent, (data: any) => {
      if (!widgetId || data.widgetId === widgetId || !data.widgetId) {
        setIsActive(data.isActive);
      }
    });
    
    // Request initial state
    const requestStateEvent = `${activityType}:requestState` as keyof SocketEventMap;
    socketService.emit(requestStateEvent, {
      code: sessionCode,
      widgetId
    } as any);
    
    // Cleanup
    return () => {
      if (isSession && widgetId) {
        socketService.emit('session:leaveRoom', {
          sessionCode,
          roomType: activityType,
          widgetId
        });
      }
      socketService.off(stateChangedEvent);
    };
  }, [socket, sessionCode, activityType, widgetId, isSession]);
  
  const updateData = (updates: Partial<T>) => {
    const currentData = data || {} as T;
    activityStore.setActivityData(
      activityType,
      widgetId,
      { ...currentData, ...updates }
    );
  };
  
  const clearData = () => {
    activityStore.clearActivityData(activityType, widgetId);
  };
  
  return {
    data,
    isActive,
    isLoading,
    error,
    setIsActive,
    setIsLoading,
    setError,
    updateData,
    clearData,
    socketService
  };
}