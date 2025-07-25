import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { JoinedRoom, Session } from '../types/session.types';
import { ActivityType } from '../types/socket.types';

interface SessionState {
  // State
  currentSession: Session | null;
  joinedRooms: JoinedRoom[];
  studentName: string;
  
  // Actions
  setStudentName: (name: string) => void;
  joinSession: (session: Session) => void;
  leaveSession: () => void;
  addRoom: (room: JoinedRoom) => void;
  removeRoom: (roomId: string) => void;
  updateRoom: (roomId: string, updates: Partial<JoinedRoom>) => void;
  getRoomByType: (type: ActivityType, widgetId?: string) => JoinedRoom | undefined;
  getRoomById: (roomId: string) => JoinedRoom | undefined;
  clearRooms: () => void;
}

export const useSessionStore = create<SessionState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        currentSession: null,
        joinedRooms: [],
        studentName: localStorage.getItem('studentName') || '',
        
        // Actions
        setStudentName: (name) => {
          localStorage.setItem('studentName', name);
          set({ studentName: name });
        },
        
        joinSession: (session) => {
          set({ currentSession: session, joinedRooms: [] });
        },
        
        leaveSession: () => {
          set({ currentSession: null, joinedRooms: [] });
        },
        
        addRoom: (room) => {
          set((state) => ({
            joinedRooms: [room, ...state.joinedRooms]
          }));
        },
        
        removeRoom: (roomId) => {
          set((state) => ({
            joinedRooms: state.joinedRooms.filter(r => r.id !== roomId)
          }));
        },
        
        updateRoom: (roomId, updates) => {
          set((state) => ({
            joinedRooms: state.joinedRooms.map(room =>
              room.id === roomId ? { ...room, ...updates } : room
            )
          }));
        },
        
        getRoomByType: (type, widgetId) => {
          const { joinedRooms } = get();
          return joinedRooms.find(r => 
            r.type === type && 
            (widgetId ? r.widgetId === widgetId : true)
          );
        },
        
        getRoomById: (roomId) => {
          const { joinedRooms } = get();
          return joinedRooms.find(r => r.id === roomId);
        },
        
        clearRooms: () => {
          set({ joinedRooms: [] });
        }
      }),
      {
        name: 'session-store',
        partialize: (state) => ({ 
          studentName: state.studentName 
        })
      }
    )
  )
);