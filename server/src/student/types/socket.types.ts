import { Socket } from 'socket.io-client';

// Comprehensive socket event typing
export interface SocketEventMap {
  // Session Events
  'session:join': { code: string; name: string; studentId: string };
  'session:joined': { 
    success: boolean; 
    activeRooms: Array<{
      roomType: ActivityType;
      roomId: string;
      widgetId?: string;
      roomData?: unknown;
    }>;
    error?: string;
  };
  'session:joinRoom': { 
    sessionCode: string; 
    roomType: ActivityType; 
    widgetId?: string;
  };
  'session:leaveRoom': { 
    sessionCode: string; 
    roomType: ActivityType; 
    widgetId?: string;
  };
  'session:roomCreated': {
    roomType: ActivityType;
    roomId: string;
    widgetId?: string;
    roomData?: unknown;
  };
  'session:roomClosed': {
    roomType: ActivityType;
    widgetId?: string;
  };
  
  // Poll Events
  'poll:updated': {
    question: string;
    options: string[];
    isActive: boolean;
    allowMultiple: boolean;
  };
  'poll:stateChanged': { 
    isActive: boolean; 
    widgetId?: string;
  };
  'poll:results': {
    votes: Record<number, number>;
    totalVotes: number;
  };
  'vote:confirmed': { 
    success: boolean; 
    error?: string;
  };
  'session:poll:vote': {
    sessionCode: string;
    optionIndex: number;
    widgetId?: string;
  };
  
  // Link Share Events
  'linkShare:roomStateChanged': { 
    isActive: boolean; 
    widgetId?: string;
  };
  'session:linkShare:submit': {
    sessionCode: string;
    studentName: string;
    link: string;
    widgetId?: string;
  };
  'session:linkShare:submitted': { 
    success: boolean; 
    error?: string;
  };
  'linkShare:submissionRemoved': {
    submissionId: string;
    widgetId?: string;
  };
  'linkShare:allCleared': {
    widgetId?: string;
  };
  
  // Questions Events
  'questions:stateChanged': { 
    isActive: boolean; 
    widgetId?: string;
  };
  'questions:requestState': {
    code: string;
    widgetId?: string;
  };
  'questions:list': Array<{
    id: string;
    text: string;
    studentName: string;
    timestamp: Date;
    answered: boolean;
  }>;
  'session:questions:submit': {
    sessionCode: string;
    text: string;
    studentName: string;
    widgetId?: string;
  };
  'questions:submitted': { 
    success: boolean;
  };
  'questions:error': { 
    error: string;
  };
  'questionAnswered': { 
    questionId: string;
  };
  'questionDeleted': { 
    questionId: string;
  };
  'allQuestionsCleared': {
    widgetId?: string;
  };
  
  // RT Feedback Events
  'rtfeedback:stateChanged': { 
    isActive: boolean; 
    widgetId?: string;
  };
  'rtfeedback:requestState': {
    code: string;
    widgetId?: string;
  };
  'session:rtfeedback:update': {
    sessionCode: string;
    value: number;
    widgetId?: string;
  };
  
  // Connection Events
  'connect': void;
  'disconnect': void;
  'connect_error': Error;
  'reconnect': number;
  'reconnect_attempt': number;
  'reconnect_error': Error;
  'reconnect_failed': void;
}

// Activity types
export type ActivityType = 'poll' | 'linkShare' | 'rtfeedback' | 'questions';

// Typed socket interface
export interface TypedSocket extends Omit<Socket, 'emit' | 'on' | 'off'> {
  emit<K extends keyof SocketEventMap>(
    event: K,
    data: SocketEventMap[K],
    callback?: (response: any) => void
  ): void;
  
  on<K extends keyof SocketEventMap>(
    event: K,
    handler: (data: SocketEventMap[K]) => void
  ): void;
  
  off<K extends keyof SocketEventMap>(
    event: K,
    handler?: (data: SocketEventMap[K]) => void
  ): void;
  
  once<K extends keyof SocketEventMap>(
    event: K,
    handler: (data: SocketEventMap[K]) => void
  ): void;
}