import { RoomType } from '../types/socket.types';

/**
 * Generate standard event names for a networked widget
 */
export const createWidgetEventNames = (roomType: RoomType, widgetId?: string) => {
  // Create room identifier
  const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
  
  return {
    // Host events (teacher -> server)
    start: `session:${roomId}:start`,
    stop: `session:${roomId}:stop`,
    update: `session:${roomId}:update`,
    reset: `session:${roomId}:reset`,
    delete: `session:${roomId}:delete`,
    
    // Broadcast events (server -> all participants)
    started: `${roomId}:started`,
    stopped: `${roomId}:stopped`,
    updated: `${roomId}:updated`,
    stateUpdate: `${roomId}:stateUpdate`,
    
    // Student events
    submit: `session:${roomId}:submit`,
    requestState: `${roomId}:requestState`,
  };
};

/**
 * Standard response handler for socket emissions
 */
export const handleSocketResponse = (
  response: { success: boolean; error?: string },
  onSuccess?: () => void,
  onError?: (error: string) => void
) => {
  if (response.success) {
    onSuccess?.();
  } else {
    onError?.(response.error || 'Operation failed');
  }
};

/**
 * Create a standard socket emit with response handling
 */
export const emitWithResponse = (
  socket: any,
  event: string,
  data: any,
  onSuccess?: () => void,
  onError?: (error: string) => void
) => {
  socket.emit(event, data, (response: { success: boolean; error?: string }) => {
    handleSocketResponse(response, onSuccess, onError);
  });
};

/**
 * Common widget state interface
 */
export interface NetworkedWidgetState {
  isRoomActive: boolean;
  isActive?: boolean;
  roomType: RoomType;
  [key: string]: any;
}

/**
 * Create initial state for a networked widget
 */
export const createInitialWidgetState = (
  roomType: RoomType,
  additionalState: Record<string, any> = {}
): NetworkedWidgetState => ({
  isRoomActive: false,
  isActive: false,
  roomType,
  ...additionalState
});