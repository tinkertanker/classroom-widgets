import { Socket } from 'socket.io-client';

// Base props that all activity components receive
export interface BaseActivityProps {
  socket: Socket;
  sessionCode: string;
  widgetId?: string;
  studentName?: string;
  initialData?: any;
}

// Extended props for specific activities
export interface PollActivityProps extends BaseActivityProps {
  initialPollData?: {
    question: string;
    options: string[];
    isActive: boolean;
    votes?: Record<number, number>;
  };
}

export interface LinkShareActivityProps extends BaseActivityProps {
  studentName: string; // Required for link share
}

export interface RTFeedbackActivityProps extends BaseActivityProps {
  studentName: string;
  initialIsActive?: boolean;
}

export interface QuestionsActivityProps extends BaseActivityProps {
  studentId: string;
  initialIsActive?: boolean;
}

// Activity state types
export interface ActivityState {
  isActive: boolean;
  isConnected: boolean;
  error: string | null;
}

// Socket event types
export interface SocketEventMap {
  // State changes
  'poll:stateChanged': { isActive: boolean };
  'rtfeedback:stateChanged': { isActive: boolean };
  'questions:stateChanged': { isActive: boolean };
  
  // Data updates
  'poll:dataUpdate': { pollData: any; results?: any };
  'poll:resultsUpdate': any;
  
  // Confirmations
  'vote:confirmed': { success: boolean; error?: string };
  'session:linkShare:submitted': { success: boolean; error?: string };
  'questions:submitted': { success: boolean };
  
  // Lists
  'questions:list': any[];
  
  // Specific events
  'newQuestion': any;
  'questionAnswered': { questionId: string };
  'questionDeleted': { questionId: string };
  'allQuestionsCleared': { widgetId: string };
  'linkShare:newSubmission': any;
}

// Room type from widget registry
export type ActivityRoomType = 'poll' | 'linkShare' | 'rtfeedback' | 'questions';