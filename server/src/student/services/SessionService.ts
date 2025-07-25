import { SocketService } from './SocketService';
import { useSessionStore } from '../store/sessionStore';
import { useConnectionStore } from '../store/connectionStore';
import { useActivityStore } from '../store/activityStore';
import { useUIStore } from '../store/uiStore';
import { JoinedRoom } from '../types/session.types';
import { ActivityType } from '../types/socket.types';

export class SessionService {
  private socketService: SocketService;
  
  constructor(socketService: SocketService) {
    this.socketService = socketService;
    this.setupEventHandlers();
  }
  
  // Join a session
  async joinSession(code: string, name: string): Promise<void> {
    const sessionStore = useSessionStore.getState();
    const uiStore = useUIStore.getState();
    
    // Validate inputs
    if (!code || !/^[23456789ACDEFHJKMNPQRTUWXY]{5}$/i.test(code)) {
      throw new Error('Invalid session code');
    }
    
    if (!name.trim()) {
      throw new Error('Name is required');
    }
    
    // Check if already in a session
    if (sessionStore.currentSession) {
      throw new Error('Already in a session. Leave current session first.');
    }
    
    // Check if session exists via API
    try {
      const response = await fetch(`/api/sessions/${code}/exists`);
      if (!response.ok) {
        throw new Error('Failed to check session');
      }
      const data = await response.json();
      
      if (!data.exists) {
        throw new Error('Session not found');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Session not found') {
        throw error;
      }
      throw new Error('Unable to verify session. Please check your connection.');
    }
    
    // Connect to socket if not connected
    if (!this.socketService.isConnected()) {
      await this.socketService.connect();
    }
    
    // Join session
    return new Promise((resolve, reject) => {
      const socketId = this.socketService.getSocketId();
      if (!socketId) {
        reject(new Error('Socket not connected'));
        return;
      }
      
      this.socketService.emit('session:join', {
        code,
        name,
        studentId: socketId
      });
      
      // Set up one-time listener for join response
      this.socketService.once('session:joined', (response) => {
        if (response.success) {
          // Update session store
          sessionStore.joinSession({
            code,
            studentName: name,
            joinedAt: Date.now()
          });
          
          // Process active rooms
          if (response.activeRooms) {
            response.activeRooms.forEach(roomData => {
              const roomId = `${code}-${roomData.roomId}-${Date.now()}`;
              const room: JoinedRoom = {
                id: roomId,
                code,
                type: roomData.roomType,
                studentName: name,
                socket: this.socketService.getRawSocket()!,
                joinedAt: Date.now(),
                initialData: roomData.roomData,
                widgetId: roomData.widgetId
              };
              
              sessionStore.addRoom(room);
              uiStore.addEnteringRoom(roomId);
            });
          }
          
          resolve();
        } else {
          reject(new Error(response.error || 'Failed to join session'));
        }
      });
    });
  }
  
  // Leave current session
  leaveSession(): void {
    const sessionStore = useSessionStore.getState();
    const connectionStore = useConnectionStore.getState();
    const activityStore = useActivityStore.getState();
    const uiStore = useUIStore.getState();
    
    if (!sessionStore.currentSession) {
      return;
    }
    
    // Animate rooms leaving
    sessionStore.joinedRooms.forEach(room => {
      uiStore.addLeavingRoom(room.id);
    });
    
    // Disconnect socket
    this.socketService.disconnect();
    connectionStore.clearAllSockets();
    
    // Clear all state
    setTimeout(() => {
      sessionStore.leaveSession();
      activityStore.clearAllActivities();
    }, 300); // After animation
  }
  
  // Set up event handlers
  private setupEventHandlers(): void {
    // Handle new room creation
    this.socketService.on('session:roomCreated', (data) => {
      const sessionStore = useSessionStore.getState();
      const uiStore = useUIStore.getState();
      const session = sessionStore.currentSession;
      
      if (!session) return;
      
      const roomId = `${session.code}-${data.roomId}-${Date.now()}`;
      const room: JoinedRoom = {
        id: roomId,
        code: session.code,
        type: data.roomType,
        studentName: session.studentName,
        socket: this.socketService.getRawSocket()!,
        joinedAt: Date.now(),
        initialData: data.roomData,
        widgetId: data.widgetId
      };
      
      // Check if room already exists
      const existingRoom = sessionStore.getRoomByType(data.roomType, data.widgetId);
      if (!existingRoom) {
        sessionStore.addRoom(room);
        uiStore.addEnteringRoom(roomId);
        
        uiStore.addToast({
          type: 'info',
          message: `New ${this.getActivityName(data.roomType)} activity started`
        });
      }
    });
    
    // Handle room closure
    this.socketService.on('session:roomClosed', (data) => {
      const sessionStore = useSessionStore.getState();
      const uiStore = useUIStore.getState();
      
      const room = sessionStore.getRoomByType(data.roomType, data.widgetId);
      if (room) {
        uiStore.addLeavingRoom(room.id);
        
        setTimeout(() => {
          sessionStore.removeRoom(room.id);
        }, 300);
        
        uiStore.addToast({
          type: 'info',
          message: `${this.getActivityName(data.roomType)} activity ended`
        });
      }
    });
    
    // Handle disconnection
    this.socketService.on('disconnect', () => {
      const sessionStore = useSessionStore.getState();
      const uiStore = useUIStore.getState();
      
      if (sessionStore.currentSession) {
        uiStore.addToast({
          type: 'error',
          message: 'Disconnected from session'
        });
      }
    });
    
    // Handle reconnection
    this.socketService.on('connect', () => {
      const sessionStore = useSessionStore.getState();
      const uiStore = useUIStore.getState();
      
      if (sessionStore.currentSession) {
        // Rejoin session
        this.socketService.emit('session:join', {
          code: sessionStore.currentSession.code,
          name: sessionStore.currentSession.studentName,
          studentId: this.socketService.getSocketId()!
        });
        
        uiStore.addToast({
          type: 'success',
          message: 'Reconnected to session'
        });
      }
    });
  }
  
  // Helper to get activity display name
  private getActivityName(type: ActivityType): string {
    const names: Record<ActivityType, string> = {
      poll: 'Poll',
      linkShare: 'Link Share',
      rtfeedback: 'Feedback',
      questions: 'Questions'
    };
    return names[type] || type;
  }
}

// Singleton instance
let sessionServiceInstance: SessionService | null = null;

export const getSessionService = (socketService: SocketService): SessionService => {
  if (!sessionServiceInstance) {
    sessionServiceInstance = new SessionService(socketService);
  }
  return sessionServiceInstance;
};