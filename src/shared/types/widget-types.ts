// Widget-specific type definitions

import { BaseWidgetProps, NetworkedWidgetProps } from './index';

// Randomiser Widget
export interface RandomiserProps extends BaseWidgetProps {
  toggleConfetti: (value: boolean) => void;
}

export interface RandomiserState {
  items: string[];
  removedItems: string[];
  currentItem: string | null;
  isSpinning: boolean;
}

// Timer Widget
export interface TimerProps extends BaseWidgetProps {}

export interface TimerState {
  mode: 'countdown' | 'stopwatch';
  duration: number;
  remaining: number;
  isRunning: boolean;
  isPaused: boolean;
}

// List Widget
export interface ListProps extends BaseWidgetProps {}

export interface ListItem {
  id: string;
  text: string;
  completed: boolean;
  timestamp: number;
}

export interface ListState {
  title: string;
  items: ListItem[];
  showCompleted: boolean;
}

// Task Cue Widget
export interface TaskCueProps extends BaseWidgetProps {
  isActive: boolean;
}

export interface TaskCueState {
  mode: 'working' | 'thinking' | 'discussing' | 'break';
  customText?: string;
}

// Traffic Light Widget
export interface TrafficLightProps extends BaseWidgetProps {}

export interface TrafficLightState {
  color: 'red' | 'yellow' | 'green';
  mode: 'manual' | 'timer';
  timerDuration?: number;
}

// Sound Monitor Widget
export interface SoundMonitorProps extends BaseWidgetProps {}

export interface SoundMonitorState {
  threshold: number;
  isMonitoring: boolean;
  currentLevel: number;
  sensitivity: number;
}

// Link Shortener Widget
export interface LinkShortenerProps extends BaseWidgetProps {}

export interface LinkShortenerState {
  originalUrl: string;
  shortUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

// Text Banner Widget
export interface TextBannerProps extends BaseWidgetProps {}

export interface TextBannerState {
  text: string;
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  scrollSpeed: number;
  isScrolling: boolean;
}

// Image Display Widget
export interface ImageDisplayProps extends BaseWidgetProps {}

export interface ImageDisplayState {
  imageUrl: string | null;
  imageData: string | null;
  fitMode: 'contain' | 'cover' | 'fill';
  caption?: string;
}

// Sound Effects Widget
export interface SoundEffectsProps extends BaseWidgetProps {
  isActive: boolean;
}

export interface SoundEffect {
  id: string;
  name: string;
  fileName: string;
  color: string;
  icon?: string;
}

export interface SoundEffectsState {
  selectedEffect: string | null;
  volume: number;
  customSounds: SoundEffect[];
}

// Sticker Widget
export interface StickerProps extends BaseWidgetProps {
  stickerType: string;
}

export interface StickerState {
  type: string;
  size: number;
  rotation: number;
}

// QR Code Widget
export interface QRCodeProps extends BaseWidgetProps {}

export interface QRCodeState {
  data: string;
  size: number;
  includeShortUrl: boolean;
  shortUrl?: string;
}

// =============================================================================
// NETWORKED WIDGETS
// All networked widgets follow these standards:
// - Use `isActive` (not `isPaused`) to control whether accepting student input
// - Default to `isActive: false` (start paused) to give teachers explicit control
// - Server-side room state matches client-side defaults
// =============================================================================

// Poll Widget (Networked)
export interface PollProps extends NetworkedWidgetProps {}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface PollState {
  question: string;
  options: PollOption[];
  isActive: boolean; // Controls whether accepting votes (default: false)
  allowMultiple: boolean;
  showResults: boolean;
  totalVotes: number;
  participants: Set<string>;
}

// Link Share Widget (Networked)
export interface LinkShareProps extends NetworkedWidgetProps {}

export interface SharedLink {
  id: string;
  url: string;
  studentName: string;
  studentId: string;
  timestamp: number;
}

export interface LinkShareState {
  links: SharedLink[];
  isActive: boolean; // Controls whether accepting links (default: false)
  requireName: boolean;
  maxLinks: number;
}

// RT Feedback Widget (Networked)
export interface RTFeedbackProps extends NetworkedWidgetProps {}

export interface FeedbackData {
  studentId: string;
  value: number;
  timestamp: number;
}

export interface RTFeedbackState {
  feedback: Map<string, FeedbackData>;
  isActive: boolean; // Controls whether accepting feedback (default: false)
  averageValue: number;
  distribution: number[];
}

// Questions Widget (Networked)
export interface QuestionsProps extends NetworkedWidgetProps {}

export interface Question {
  id: string;
  text: string;
  studentName: string;
  studentId: string;
  timestamp: number;
  isAnswered: boolean;
}

export interface QuestionsState {
  questions: Question[];
  isActive: boolean; // Controls whether accepting questions (default: false)
  requireName: boolean;
  maxQuestions: number;
}

// Tic Tac Toe Widget
export interface TicTacToeProps extends BaseWidgetProps {}

export type Player = 'X' | 'O';
export type Cell = Player | null;

export interface TicTacToeState {
  board: Cell[][];
  currentPlayer: Player;
  winner: Player | 'draw' | null;
  scores: {
    X: number;
    O: number;
    draws: number;
  };
}

// Visualiser Widget
export interface VisualiserProps extends BaseWidgetProps {}

export interface VisualiserState {
  mode: 'bars' | 'wave' | 'circular';
  color: string;
  sensitivity: number;
  isActive: boolean;
}

// Widget Registry Entry
export interface WidgetRegistryEntry<P = any, S = any> {
  type: number;
  name: string;
  component: React.ComponentType<P>;
  defaultState?: S;
  icon: React.ComponentType;
  category: 'interactive' | 'teaching' | 'fun' | 'networked';
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
  maintainAspectRatio?: boolean;
}