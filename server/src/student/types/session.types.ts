import { Socket } from 'socket.io-client';
import { ActivityType } from './socket.types';

// Session and room types
export interface Session {
  code: string;
  studentName: string;
  joinedAt: number;
}

export interface JoinedRoom {
  id: string;
  code: string;
  type: ActivityType;
  studentName: string;
  socket: Socket;
  joinedAt: number;
  initialData?: RoomInitialData;
  widgetId?: string;
}

export type RoomInitialData = 
  | PollInitialData 
  | LinkShareInitialData 
  | RTFeedbackInitialData 
  | QuestionsInitialData;

export interface PollInitialData {
  question: string;
  options: string[];
  isActive: boolean;
  votes?: Record<number, number>;
  allowMultiple?: boolean;
}

export interface LinkShareInitialData {
  isActive: boolean;
  submissions?: Array<{
    id: string;
    studentName: string;
    link: string;
    timestamp: number;
  }>;
}

export interface RTFeedbackInitialData {
  isActive: boolean;
  currentValue?: number;
}

export interface QuestionsInitialData {
  isActive: boolean;
  questions?: Array<{
    id: string;
    text: string;
    studentName: string;
    timestamp: Date;
    answered: boolean;
  }>;
}

// Activity-specific data types
export interface PollData {
  question: string;
  options: string[];
  isActive: boolean;
  allowMultiple: boolean;
  hasVoted: boolean;
  selectedOption: number | null;
  results?: {
    votes: Record<number, number>;
    totalVotes: number;
  };
}

export interface LinkShareData {
  isActive: boolean;
  submissions: Array<{
    id: string;
    studentName: string;
    link: string;
    timestamp: number;
  }>;
  hasSubmitted: boolean;
}

export interface RTFeedbackData {
  isActive: boolean;
  currentValue: number;
  lastSentValue: number;
  isSending: boolean;
}

export interface Question {
  id: string;
  text: string;
  studentName: string;
  timestamp: Date;
  answered: boolean;
}

export interface QuestionsData {
  isActive: boolean;
  questions: Question[];
  submittedQuestionIds: Set<string>;
}