import { useState, useEffect, useCallback, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

export type RoomType = 'poll' | 'dataShare' | 'rtfeedback' | 'questions';

interface SessionParticipant {
  name: string;
  studentId: string;
  joinedAt: number;
  socketId: string;
}

interface UseSessionProps {
  onSessionCreated?: (code: string) => void;
  onParticipantUpdate?: (count: number, participants: SessionParticipant[]) => void;
  onRoomCreated?: (roomType: RoomType) => void;
  onRoomClosed?: (roomType: RoomType) => void;
}

interface UseSessionReturn {
  socket: Socket | null;
  sessionCode: string;
  isConnecting: boolean;
  connectionError: string;
  isConnected: boolean;
  participantCount: number;
  participants: SessionParticipant[];
  activeRooms: RoomType[];
  createSession: () => Promise<string>;
  createRoom: (roomType: RoomType) => Promise<boolean>;
  closeRoom: (roomType: RoomType) => void;
  cleanup: () => void;
  ensureSession: () => Promise<string>;
}

const SERVER_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin.replace('3000', '3001')
  : 'http://localhost:3001';

export function useSession({
  onSessionCreated,
  onParticipantUpdate,
  onRoomCreated,
  onRoomClosed
}: UseSessionProps = {}): UseSessionReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionCode, setSessionCode] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [activeRooms, setActiveRooms] = useState<RoomType[]>([]);
  
  const sessionCodeRef = useRef<string>('');

  // Initialize socket connection
  useEffect(() => {
    if (!socket) {
      const newSocket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setIsConnected(true);
        setConnectionError('');
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setConnectionError('Failed to connect to server');
        setIsConnected(false);
      });

      // Session event handlers
      newSocket.on('session:participantUpdate', (data) => {
        setParticipantCount(data.count);
        setParticipants(data.participants);
        onParticipantUpdate?.(data.count, data.participants);
      });

      newSocket.on('session:roomCreated', (data) => {
        const { roomType } = data;
        setActiveRooms(prev => [...new Set([...prev, roomType])]);
        onRoomCreated?.(roomType);
      });

      newSocket.on('session:roomClosed', (data) => {
        const { roomType } = data;
        setActiveRooms(prev => prev.filter(rt => rt !== roomType));
        onRoomClosed?.(roomType);
      });

      setSocket(newSocket);
    }

    return () => {
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        setSocket(null);
      }
    };
  }, []); // Only run once on mount

  // Create or get existing session
  const createSession = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!socket || !isConnected) {
        reject(new Error('Not connected to server'));
        return;
      }

      setIsConnecting(true);
      
      socket.emit('session:create', (response: any) => {
        setIsConnecting(false);
        
        if (response.success) {
          setSessionCode(response.code);
          sessionCodeRef.current = response.code;
          setActiveRooms([]);
          setParticipants([]);
          setParticipantCount(0);
          
          if (!response.isExisting) {
            onSessionCreated?.(response.code);
          }
          
          resolve(response.code);
        } else {
          reject(new Error(response.error || 'Failed to create session'));
        }
      });
    });
  }, [socket, isConnected, onSessionCreated]);

  // Create a room within the session
  const createRoom = useCallback((roomType: RoomType): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      const currentSessionCode = sessionCodeRef.current || sessionCode;
      
      if (!socket || !isConnected || !currentSessionCode) {
        reject(new Error('Not connected or no session'));
        return;
      }

      socket.emit('session:createRoom', { 
        sessionCode: currentSessionCode, 
        roomType 
      }, (response: any) => {
        if (response.success) {
          if (!response.isExisting) {
            setActiveRooms(prev => [...new Set([...prev, roomType])]);
          }
          resolve(true);
        } else {
          reject(new Error(response.error || 'Failed to create room'));
        }
      });
    });
  }, [socket, isConnected, sessionCode]);

  // Close a room within the session
  const closeRoom = useCallback((roomType: RoomType) => {
    if (!socket || !isConnected || !sessionCode) return;

    socket.emit('session:closeRoom', { 
      sessionCode: sessionCodeRef.current || sessionCode, 
      roomType 
    });
    
    setActiveRooms(prev => prev.filter(rt => rt !== roomType));
  }, [socket, isConnected, sessionCode]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (socket) {
      // Close all active rooms
      activeRooms.forEach(roomType => {
        socket.emit('session:closeRoom', { sessionCode, roomType });
      });
      
      socket.disconnect();
    }
    
    setSessionCode('');
    setActiveRooms([]);
    setParticipants([]);
    setParticipantCount(0);
  }, [socket, sessionCode, activeRooms]);

  // Ensure a session exists - create one if needed
  const ensureSession = useCallback(async (): Promise<string> => {
    // If we already have a session, return it
    if (sessionCode) {
      return sessionCode;
    }
    
    // Otherwise create a new session
    return createSession();
  }, [sessionCode, createSession]);

  return {
    socket,
    sessionCode,
    isConnecting,
    connectionError,
    isConnected,
    participantCount,
    participants,
    activeRooms,
    createSession,
    createRoom,
    closeRoom,
    cleanup,
    ensureSession
  };
}