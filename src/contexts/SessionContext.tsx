import React, { createContext, useContext, ReactNode } from 'react';
import { useSession, RoomType } from '../hooks/useSession';
import { Socket } from 'socket.io-client';

interface SessionParticipant {
  name: string;
  studentId: string;
  joinedAt: number;
  socketId: string;
}

interface SessionContextType {
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
}

const SessionContext = createContext<SessionContextType | null>(null);

export const useSessionContext = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
};

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const session = useSession({
    onSessionCreated: (code) => {
      console.log('Session created:', code);
      // Could show a toast notification here
    },
    onParticipantUpdate: (count, participants) => {
      console.log('Participants updated:', count);
    },
    onRoomCreated: (roomType) => {
      console.log('Room created:', roomType);
    },
    onRoomClosed: (roomType) => {
      console.log('Room closed:', roomType);
    }
  });

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
};