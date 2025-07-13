import { useState, useEffect, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

export type RoomType = 'poll' | 'dataShare';

interface UseNetworkedWidgetProps {
  widgetId?: string;
  roomType: RoomType;
  onRoomCreated?: (code: string) => void;
  onSocketConnected?: (socket: Socket) => void;
}

interface UseNetworkedWidgetReturn {
  socket: Socket | null;
  roomCode: string;
  isConnecting: boolean;
  connectionError: string;
  isConnected: boolean;
  createRoom: () => Promise<void>;
  closeRoom: () => void;
}

export function useNetworkedWidget({
  widgetId,
  roomType,
  onRoomCreated,
  onSocketConnected
}: UseNetworkedWidgetProps): UseNetworkedWidgetReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);

  // Handle widget deletion cleanup
  useEffect(() => {
    const handleWidgetCleanup = (event: CustomEvent) => {
      if (event.detail.widgetId === widgetId && socket && roomCode) {
        console.log(`${roomType} widget cleanup triggered for room:`, roomCode);
        
        // If socket is connected, send the close event
        if (socket.connected) {
          socket.emit('host:closeRoom', { code: roomCode, type: roomType });
          console.log('Sent host:closeRoom event');
        }
        
        // Give it a moment to send, then disconnect
        setTimeout(() => {
          socket.disconnect();
        }, 100);
      }
    };
    
    window.addEventListener('widget-cleanup' as any, handleWidgetCleanup);
    
    return () => {
      window.removeEventListener('widget-cleanup' as any, handleWidgetCleanup);
    };
  }, [widgetId, socket, roomCode, roomType]);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socket && roomCode) {
        if (socket.connected) {
          socket.emit('host:closeRoom', { code: roomCode, type: roomType });
        }
        setTimeout(() => {
          socket.disconnect();
        }, 100);
      }
    };
  }, [socket, roomCode, roomType]);

  const closeRoom = useCallback(() => {
    if (socket && roomCode) {
      if (socket.connected) {
        socket.emit('host:closeRoom', { code: roomCode, type: roomType });
      }
      setTimeout(() => {
        socket.disconnect();
        setSocket(null);
        setRoomCode('');
        setIsConnected(false);
      }, 100);
    }
  }, [socket, roomCode, roomType]);

  const createRoom = async () => {
    setIsConnecting(true);
    setConnectionError('');
    
    try {
      const newSocket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001', {
        transports: ['websocket', 'polling']
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setConnectionError('');
        setIsConnected(true);
        
        if (onSocketConnected) {
          onSocketConnected(newSocket);
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setConnectionError('Unable to connect to server. Make sure the server is running on port 3001.');
        setIsConnecting(false);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setIsConnected(false);
      });

      setSocket(newSocket);

      // Handle room creation based on type
      if (roomType === 'poll') {
        // For poll, we need to wait for connection then create room via API
        newSocket.on('host:joined', (data) => {
          if (data.success) {
            console.log('Joined room:', data.code);
          }
        });

        newSocket.once('connect', async () => {
          try {
            const response = await fetch(`${import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'}/api/rooms/create`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
              throw new Error('Server request failed');
            }
            
            const data = await response.json();
            
            if (data.success) {
              setRoomCode(data.code);
              // Join room as host
              newSocket.emit('host:join', data.code);
              setIsConnecting(false);
              
              if (onRoomCreated) {
                onRoomCreated(data.code);
              }
            }
          } catch (error) {
            console.error('Failed to create room:', error);
            setConnectionError('Cannot connect to server. Please ensure the server is running (cd server && npm start).');
            setIsConnecting(false);
            newSocket.disconnect();
          }
        });
      } else if (roomType === 'dataShare') {
        // For dataShare, emit creation event after connection
        newSocket.on('room:created', (code: string) => {
          console.log('Data share room created:', code);
          setRoomCode(code);
          setIsConnecting(false);
          
          if (onRoomCreated) {
            onRoomCreated(code);
          }
        });

        newSocket.on('connect', () => {
          // Emit create room when connected
          setTimeout(() => {
            newSocket.emit('host:createDataShareRoom');
          }, 100);
        });
      }
    } catch (error) {
      console.error('Error creating socket:', error);
      setConnectionError('Failed to connect to server');
      setIsConnecting(false);
    }
  };

  return {
    socket,
    roomCode,
    isConnecting,
    connectionError,
    isConnected,
    createRoom,
    closeRoom
  };
}