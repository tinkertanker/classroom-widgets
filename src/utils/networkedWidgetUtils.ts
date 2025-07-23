import { RoomType } from '../hooks/useSession';

/**
 * Generate standard event names for a networked widget
 */
export const createWidgetEventNames = (roomType: RoomType) => ({
  // Host events (teacher -> server)
  start: `session:${roomType}:start`,
  stop: `session:${roomType}:stop`,
  update: `session:${roomType}:update`,
  reset: `session:${roomType}:reset`,
  delete: `session:${roomType}:delete`,
  
  // Broadcast events (server -> all participants)
  started: `${roomType}:started`,
  stopped: `${roomType}:stopped`,
  updated: `${roomType}:updated`,
  stateChanged: `${roomType}:stateChanged`,
  
  // Student events
  submit: `session:${roomType}:submit`,
  requestState: `${roomType}:requestState`,
});

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