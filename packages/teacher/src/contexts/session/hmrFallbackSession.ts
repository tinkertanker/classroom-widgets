import type { SessionContextValue } from './sessionTypes';

// What useSession returns while HMR has the provider temporarily unmounted
export const hmrFallbackSession: SessionContextValue = {
  sessionCode: null,
  sessionCreatedAt: null,
  isHost: false,
  socket: null,
  connectionPhase: 'disconnected',
  isConnected: false,
  isRecovering: false,
  isSessionReady: false,
  isCurrentSession: () => true,
  canEditSession: () => true,
  serverUrl: '',
  studentAppUrl: null,
  activeRooms: new Map(),
  createSession: async () => null,
  recoverSession: async () => false,
  closeSession: () => {},
  createRoom: async () => false,
  closeRoom: () => {},
  updateRoomState: () => {},
  getWidgetRecoveryData: () => null,
  releaseWidgetRecoveryData: () => {},
  error: null
};
