import { useState, useEffect, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

export type RoomType = 'poll' | 'dataShare' | 'rtfeedback';

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
        // For poll, use harmonized event-based creation
        newSocket.on('poll:created', (data: { code: string; success: boolean }) => {
          if (data.success) {
            console.log('Poll room created:', data.code);
            setRoomCode(data.code);
            setIsConnecting(false);
            
            if (onRoomCreated) {
              onRoomCreated(data.code);
            }
          }
        });

        newSocket.on('connect', () => {
          // Emit create room when connected
          setTimeout(() => {
            newSocket.emit('poll:create');
          }, 100);
        });
      } else if (roomType === 'dataShare') {
        // For dataShare, use harmonized event names
        newSocket.on('dataShare:created', (data: { code: string; success: boolean }) => {
          if (data.success) {
            console.log('Data share room created:', data.code);
            setRoomCode(data.code);
            setIsConnecting(false);
            
            if (onRoomCreated) {
              onRoomCreated(data.code);
            }
          }
        });

        newSocket.on('connect', () => {
          // Emit create room when connected
          setTimeout(() => {
            newSocket.emit('dataShare:create');
          }, 100);
        });
      } else if (roomType === 'rtfeedback') {
        // For rtfeedback, use harmonized event names
        newSocket.on('rtFeedback:created', (data: { code: string; success: boolean }) => {
          if (data.success) {
            console.log('RT Feedback room created:', data.code);
            setRoomCode(data.code);
            setIsConnecting(false);
            
            if (onRoomCreated) {
              onRoomCreated(data.code);
            }
          }
        });

        newSocket.on('connect', () => {
          // Emit create room when connected
          setTimeout(() => {
            newSocket.emit('rtFeedback:create');
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