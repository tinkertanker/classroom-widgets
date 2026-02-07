import React, { createContext, useContext, useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { useWorkspaceStore } from '../store/workspaceStore.simple';
import { useServerConnection } from '@shared/hooks/useWorkspace';
import { debug } from '@shared/utils/debug';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export { SocketContext };

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { url, setServerStatus } = useServerConnection();

  useEffect(() => {
    const newSocket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000
    });

    setSocket(newSocket);
    
    // Store socket in window for backwards compatibility
    (window as any).socket = newSocket;

    newSocket.on('connect', () => {
      setServerStatus({ connected: true });
    });
    
    newSocket.on('disconnect', () => {
      setServerStatus({ connected: false });
    });
    
    newSocket.on('connect_error', (error: any) => {
      debug.error('Connection error:', error);
      setServerStatus({ connected: false, error: error.message });
    });
    
    newSocket.on('reconnect_attempt', (attemptNumber: number) => {
      debug(`Reconnecting... (attempt ${attemptNumber})`);
    });

    return () => {
      newSocket.disconnect();
      delete (window as any).socket;
    };
  }, [url, setServerStatus]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
