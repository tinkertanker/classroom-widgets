import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Socket } from 'socket.io-client';

interface ConnectionState {
  // Connection state
  sockets: Map<string, Socket>;
  primarySocket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  reconnectAttempts: number;
  
  // Actions
  addSocket: (id: string, socket: Socket) => void;
  removeSocket: (id: string) => void;
  setPrimarySocket: (socket: Socket | null) => void;
  setConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  getSocket: (id: string) => Socket | undefined;
  clearAllSockets: () => void;
}

export const useConnectionStore = create<ConnectionState>()(
  devtools(
    (set, get) => ({
      // Initial state
      sockets: new Map(),
      primarySocket: null,
      isConnected: false,
      connectionError: null,
      reconnectAttempts: 0,
      
      // Actions
      addSocket: (id, socket) => {
        set((state) => {
          const newSockets = new Map(state.sockets);
          newSockets.set(id, socket);
          return { sockets: newSockets };
        });
      },
      
      removeSocket: (id) => {
        set((state) => {
          const newSockets = new Map(state.sockets);
          const socket = newSockets.get(id);
          if (socket) {
            socket.close();
            newSockets.delete(id);
          }
          return { sockets: newSockets };
        });
      },
      
      setPrimarySocket: (socket) => {
        set({ primarySocket: socket });
      },
      
      setConnected: (connected) => {
        set({ isConnected: connected });
        if (connected) {
          set({ connectionError: null, reconnectAttempts: 0 });
        }
      },
      
      setConnectionError: (error) => {
        set({ connectionError: error });
      },
      
      incrementReconnectAttempts: () => {
        set((state) => ({ 
          reconnectAttempts: state.reconnectAttempts + 1 
        }));
      },
      
      resetReconnectAttempts: () => {
        set({ reconnectAttempts: 0 });
      },
      
      getSocket: (id) => {
        return get().sockets.get(id);
      },
      
      clearAllSockets: () => {
        const { sockets } = get();
        sockets.forEach(socket => socket.close());
        set({ 
          sockets: new Map(), 
          primarySocket: null,
          isConnected: false 
        });
      }
    }),
    {
      name: 'connection-store'
    }
  )
);