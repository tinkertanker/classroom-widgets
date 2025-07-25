import { io, Socket } from 'socket.io-client';
import { TypedSocket, SocketEventMap } from '../types/socket.types';
import { useConnectionStore } from '../store/connectionStore';

export class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<keyof SocketEventMap, Set<Function>> = new Map();
  private url: string;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  
  constructor(url: string = '') {
    this.url = url;
  }
  
  // Connect to socket server
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }
      
      this.socket = io(this.url) as Socket;
      const connectionStore = useConnectionStore.getState();
      
      // Set up connection handlers
      this.socket.on('connect', () => {
        console.log('[SocketService] Connected to server');
        connectionStore.setConnected(true);
        connectionStore.resetReconnectAttempts();
        resolve();
      });
      
      this.socket.on('disconnect', () => {
        console.log('[SocketService] Disconnected from server');
        connectionStore.setConnected(false);
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('[SocketService] Connection error:', error.message);
        connectionStore.setConnectionError(error.message);
        connectionStore.incrementReconnectAttempts();
        
        // Reject only on first connection attempt
        if (connectionStore.reconnectAttempts === 1) {
          reject(error);
        }
      });
      
      this.socket.on('reconnect', (attemptNumber) => {
        console.log(`[SocketService] Reconnected after ${attemptNumber} attempts`);
        connectionStore.setConnected(true);
        connectionStore.resetReconnectAttempts();
      });
      
      // Re-emit stored events when reconnected
      this.socket.on('connect', () => {
        this.reattachListeners();
      });
    });
  }
  
  // Disconnect from socket server
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      useConnectionStore.getState().setConnected(false);
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
  
  // Type-safe emit
  emit<K extends keyof SocketEventMap>(
    event: K,
    data: SocketEventMap[K],
    callback?: (response: any) => void
  ): void {
    if (!this.socket?.connected) {
      console.warn(`[SocketService] Cannot emit ${event}: not connected`);
      return;
    }
    
    if (callback) {
      this.socket.emit(event, data, callback);
    } else {
      this.socket.emit(event, data);
    }
  }
  
  // Type-safe on
  on<K extends keyof SocketEventMap>(
    event: K,
    handler: (data: SocketEventMap[K]) => void
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(handler);
    
    if (this.socket) {
      this.socket.on(event as string, handler as any);
    }
  }
  
  // Type-safe off
  off<K extends keyof SocketEventMap>(
    event: K,
    handler?: (data: SocketEventMap[K]) => void
  ): void {
    if (!handler) {
      // Remove all handlers for this event
      this.listeners.delete(event);
      if (this.socket) {
        this.socket.off(event as string);
      }
    } else {
      // Remove specific handler
      const handlers = this.listeners.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.listeners.delete(event);
        }
      }
      
      if (this.socket) {
        this.socket.off(event as string, handler as any);
      }
    }
  }
  
  // Type-safe once
  once<K extends keyof SocketEventMap>(
    event: K,
    handler: (data: SocketEventMap[K]) => void
  ): void {
    if (this.socket) {
      this.socket.once(event as string, handler as any);
    }
  }
  
  // Get connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
  
  // Get socket ID
  getSocketId(): string | undefined {
    return this.socket?.id;
  }
  
  // Reattach all listeners (used after reconnection)
  private reattachListeners(): void {
    if (!this.socket) return;
    
    this.listeners.forEach((handlers, event) => {
      handlers.forEach(handler => {
        this.socket!.on(event as string, handler as any);
      });
    });
  }
  
  // Get raw socket (use sparingly)
  getRawSocket(): Socket | null {
    return this.socket;
  }
}

// Singleton instance
let socketServiceInstance: SocketService | null = null;

export const getSocketService = (url?: string): SocketService => {
  if (!socketServiceInstance) {
    socketServiceInstance = new SocketService(url);
  }
  return socketServiceInstance;
};

// Helper to create typed socket wrapper
export const createTypedSocket = (socket: Socket): TypedSocket => {
  return socket as TypedSocket;
};