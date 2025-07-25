import { Socket } from 'socket.io-client';
import { 
  PollInitialData, 
  LinkShareInitialData, 
  RTFeedbackInitialData, 
  QuestionsInitialData 
} from './session.types';

// Base props that all activity components receive
export interface BaseActivityProps {
  socket: Socket;
  sessionCode: string;
  widgetId?: string;
  studentName?: string;
  isSession?: boolean;
}

// Extended props for specific activities
export interface PollActivityProps extends BaseActivityProps {
  roomCode: string; // Alias for sessionCode
  initialPollData?: PollInitialData;
}

export interface LinkShareActivityProps extends BaseActivityProps {
  roomCode: string; // Alias for sessionCode
  studentName: string; // Required for link share
  initialIsActive?: boolean;
}

export interface RTFeedbackActivityProps extends BaseActivityProps {
  roomCode: string; // Alias for sessionCode
  studentName: string;
  initialIsActive?: boolean;
}

export interface QuestionsActivityProps extends BaseActivityProps {
  sessionCode: string; // Uses sessionCode directly
  studentId: string;
  studentName: string;
  initialIsActive?: boolean;
}

// Activity state types
export interface ActivityState {
  isActive: boolean;
  isConnected: boolean;
  error: string | null;
  isLoading: boolean;
}

// Activity configuration
export interface ActivityConfig {
  type: ActivityType;
  title: string;
  description: string;
  icon: React.ComponentType;
  component: React.ComponentType<any>;
  gradient: string;
  darkGradient: string;
}

// Activity types
export type ActivityType = 'poll' | 'linkShare' | 'rtfeedback' | 'questions';

// Activity registry type
export type ActivityRegistry = Record<ActivityType, ActivityConfig>;