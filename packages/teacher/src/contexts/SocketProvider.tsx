import React, { createContext, useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { useServerConnection } from '@shared/hooks/useWorkspace';
import { debug } from '@shared/utils/debug';
import { attachUsageSocket } from '../services/usageTracking';

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
    const detachUsage = attachUsageSocket(newSocket);

    newSocket.on('connect', () => {
      setServerStatus({ connected: true });
    });
    
    newSocket.on('disconnect', () => {
      setServerStatus({ connected: false });
    });
    
    newSocket.on('connect_error', (error) => {
      debug.error('Connection error:', error);
      setServerStatus({ connected: false, error: error.message });
    });

    return () => {
      detachUsage();
      newSocket.disconnect();
    };
  }, [url, setServerStatus]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
