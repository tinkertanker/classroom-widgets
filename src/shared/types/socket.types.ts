/**
 * Socket Event Types
 *
 * Comprehensive TypeScript types for all Socket.IO events used in the application.
 * Follows the event naming convention: namespace:action
 *
 * @see docs/SOCKET_EVENTS.md for detailed event flow documentation
 */

// ============================================================================
// Session Management Events
// ============================================================================

export interface SessionCreateData {
  // No data required - server generates session code
}

export interface SessionCreatedResponse {
  success: boolean;
  code: string;
  isExisting?: boolean;
  activeRooms?: Array<{
    type: RoomType;
    widgetId: string;
    isActive: boolean;
  }>;
}

export interface SessionJoinData {
  code: string;
  name: string;
  studentId: string;
}

export interface SessionJoinedResponse {
  success: boolean;
  activeRooms: Array<{
    type: RoomType;
    widgetId: string;
    roomData: any; // Widget-specific room data
  }>;
  participantId: string;
  error?: string;
}

export interface SessionParticipantUpdateData {
  count: number;
  participants: Array<{
    id: string;
    name: string;
    joinedAt: number;
  }>;
}

export interface SessionCloseData {
  sessionCode: string;
}

// ============================================================================
// Room (Widget) Management Events
// ============================================================================

export type RoomType = 'poll' | 'linkShare' | 'rtfeedback' | 'questions';

export interface SessionCreateRoomData {
  sessionCode: string;
  roomType: RoomType;
  widgetId: string;
}

export interface SessionCreateRoomResponse {
  success: boolean;
  isExisting?: boolean;
  error?: string;
}

export interface SessionRoomCreatedData {
  roomType: RoomType;
  widgetId: string;
  roomData: any; // Widget-specific initial data
}

export interface SessionCloseRoomData {
  sessionCode: string;
  roomType: RoomType;
  widgetId: string;
}

export interface SessionRoomClosedData {
  roomType: RoomType;
  widgetId: string;
}

export interface SessionUpdateWidgetStateData {
  sessionCode: string;
  roomType: RoomType;
  widgetId: string;
  isActive: boolean;
}

export interface SessionWidgetStateChangedData {
  roomType: RoomType;
  widgetId: string;
  isActive: boolean;
}

// ============================================================================
// Poll Widget Events
// ============================================================================

export interface PollOption {
  text: string;
  votes: number;
}

export interface PollData {
  question: string;
  options: PollOption[];
  isActive: boolean;
}

export interface PollResults {
  votes: Record<number, number>; // optionIndex -> vote count
  totalVotes: number;
  participantCount: number;
}

export interface SessionPollUpdateData {
  sessionCode: string;
  widgetId: string;
  pollData: PollData;
}

export interface PollDataUpdateData {
  pollData: Omit<PollData, 'votes'>; // Votes excluded from pollData
  results: PollResults;
  widgetId: string;
}

export interface SessionPollVoteData {
  sessionCode: string;
  widgetId: string;
  optionIndex: number;
}

export interface SessionPollVoteConfirmedResponse {
  success: boolean;
  widgetId: string;
  error?: string;
}

export interface PollVoteUpdateData {
  votes: Record<number, number>;
  totalVotes: number;
  widgetId: string;
}

/**
 * Standardized request state data format
 * All widgets should use sessionCode (not code) for consistency
 */
export interface RequestStateData {
  sessionCode: string;
  widgetId: string;
}

export interface PollRequestStateData {
  sessionCode: string; // Standardized from 'code'
  widgetId: string;
  /** @deprecated Use sessionCode instead */
  code?: string;
}

// ============================================================================
// Link Share Widget Events
// ============================================================================

export interface LinkSubmission {
  id: string;
  studentName: string;
  link: string;
  timestamp: number;
}

export interface SessionLinkShareSubmitData {
  sessionCode: string;
  widgetId: string;
  studentName: string;
  link: string;
}

export interface SessionLinkShareSubmittedResponse {
  success: boolean;
  error?: string;
}

export interface LinkShareNewSubmissionData extends LinkSubmission {
  widgetId: string;
}

export interface SessionLinkShareDeleteData {
  sessionCode: string;
  widgetId: string;
  submissionId: string;
}

export interface SessionLinkShareSetAcceptModeData {
  sessionCode: string;
  widgetId: string;
  acceptMode: 'links' | 'all';
}

export interface LinkShareSubmissionDeletedData {
  submissionId: string;
  widgetId: string;
}

export interface LinkShareRequestStateData {
  sessionCode: string; // Standardized from 'code'
  widgetId: string;
  /** @deprecated Use sessionCode instead */
  code?: string;
}

export interface LinkShareStateChangedData {
  isActive: boolean;
  widgetId: string;
}

// ============================================================================
// RT Feedback Widget Events
// ============================================================================

export interface SessionRTFeedbackSubmitData {
  sessionCode: string;
  widgetId: string;
  value: number; // 1-5 scale
}

export interface SessionRTFeedbackSubmittedResponse {
  success: boolean;
  error?: string;
}

export interface RTFeedbackUpdateData {
  understanding: number; // Average feedback value
  totalResponses: number;
  widgetId: string;
}

export interface SessionRTFeedbackResetData {
  sessionCode: string;
  widgetId: string;
}

// ============================================================================
// Questions Widget Events
// ============================================================================

export interface Question {
  id: string;
  studentName: string;
  text: string;
  timestamp: number;
  answered: boolean;
}

export interface SessionQuestionsSubmitData {
  sessionCode: string;
  widgetId: string;
  question: string; // Note: field name is 'question' not 'text'
  studentName: string;
}

export interface SessionQuestionsSubmittedResponse {
  success: boolean;
  error?: string;
}

export interface QuestionsNewQuestionData extends Question {
  widgetId: string;
}

export interface SessionQuestionsMarkAnsweredData {
  sessionCode: string;
  widgetId: string;
  questionId: string;
}

export interface QuestionsQuestionAnsweredData {
  questionId: string;
  widgetId: string;
}

export interface SessionQuestionsDeleteData {
  sessionCode: string;
  widgetId: string;
  questionId: string;
}

export interface QuestionsQuestionDeletedData {
  questionId: string;
  widgetId: string;
}

export interface SessionQuestionsClearAllData {
  sessionCode: string;
  widgetId: string;
}

export interface QuestionsAllClearedData {
  widgetId: string;
}

// ============================================================================
// Generic Widget Events
// ============================================================================

export interface SessionResetData {
  sessionCode: string;
  widgetId: string;
}

// ============================================================================
// Socket Event Map (for type-safe event handling)
// ============================================================================

export interface ServerToClientEvents {
  // Session events
  'session:created': (data: SessionCreatedResponse) => void;
  'session:joined': (data: SessionJoinedResponse) => void;
  'session:participantUpdate': (data: SessionParticipantUpdateData) => void;
  'session:roomCreated': (data: SessionRoomCreatedData) => void;
  'session:roomClosed': (data: SessionRoomClosedData) => void;
  'session:widgetStateChanged': (data: SessionWidgetStateChangedData) => void;
  'session:closed': () => void;
  'session:hostDisconnected': () => void;
  'session:hostReconnected': () => void;

  // Poll events
  'poll:stateUpdate': (data: PollDataUpdateData) => void;
  'poll:voteUpdate': (data: PollVoteUpdateData) => void;
  'session:poll:voteConfirmed': (data: SessionPollVoteConfirmedResponse) => void;

  // Link Share events
  'linkShare:stateUpdate': (data: LinkShareStateChangedData) => void;
  'linkShare:submissionAdded': (data: LinkShareNewSubmissionData) => void;
  'linkShare:submissionDeleted': (data: LinkShareSubmissionDeletedData) => void;
  'session:linkShare:submitted': (data: SessionLinkShareSubmittedResponse) => void;

  // RT Feedback events
  'rtfeedback:stateUpdate': (data: LinkShareStateChangedData) => void;
  'rtfeedback:dataUpdate': (data: RTFeedbackUpdateData) => void;
  'session:rtfeedback:submitted': (data: SessionRTFeedbackSubmittedResponse) => void;

  // Questions events
  'questions:stateUpdate': (data: { isActive: boolean; questions: Question[]; widgetId: string }) => void;
  'questions:questionAdded': (data: QuestionsNewQuestionData) => void;
  'questions:questionAnswered': (data: QuestionsQuestionAnsweredData) => void;
  'questions:questionDeleted': (data: QuestionsQuestionDeletedData) => void;
  'questions:allCleared': (data: QuestionsAllClearedData) => void;
  'session:questions:submitted': (data: SessionQuestionsSubmittedResponse) => void;
}

/** Request state data for RT Feedback */
export interface RTFeedbackRequestStateData {
  sessionCode: string;
  widgetId: string;
}

/** Request state data for Questions */
export interface QuestionsRequestStateData {
  sessionCode: string;
  widgetId: string;
}

/** Data for session:cleanupRooms event */
export interface SessionCleanupRoomsData {
  sessionCode: string;
  activeWidgetIds: string[];
}

export interface ClientToServerEvents {
  // Session events
  'session:create': (data: SessionCreateData, callback: (response: SessionCreatedResponse) => void) => void;
  'session:join': (data: SessionJoinData, callback: (response: SessionJoinedResponse) => void) => void;
  'session:close': (data: SessionCloseData) => void;
  'session:createRoom': (data: SessionCreateRoomData, callback: (response: SessionCreateRoomResponse) => void) => void;
  'session:closeRoom': (data: SessionCloseRoomData) => void;
  'session:updateWidgetState': (data: SessionUpdateWidgetStateData) => void;
  'session:reset': (data: SessionResetData) => void;
  'session:cleanupRooms': (data: SessionCleanupRoomsData) => void;

  // Poll events
  'session:poll:update': (data: SessionPollUpdateData) => void;
  'session:poll:vote': (data: SessionPollVoteData, callback: (response: SessionPollVoteConfirmedResponse) => void) => void;
  'poll:requestState': (data: PollRequestStateData) => void;

  // Link Share events
  'session:linkShare:submit': (data: SessionLinkShareSubmitData, callback: (response: SessionLinkShareSubmittedResponse) => void) => void;
  'session:linkShare:delete': (data: SessionLinkShareDeleteData) => void;
  'session:linkShare:setAcceptMode': (data: SessionLinkShareSetAcceptModeData) => void;
  'linkShare:requestState': (data: LinkShareRequestStateData) => void;

  // RT Feedback events
  'session:rtfeedback:submit': (data: SessionRTFeedbackSubmitData, callback: (response: SessionRTFeedbackSubmittedResponse) => void) => void;
  'session:rtfeedback:reset': (data: SessionRTFeedbackResetData) => void;
  'rtfeedback:requestState': (data: RTFeedbackRequestStateData) => void;

  // Questions events
  'session:questions:submit': (data: SessionQuestionsSubmitData, callback: (response: SessionQuestionsSubmittedResponse) => void) => void;
  'session:questions:markAnswered': (data: SessionQuestionsMarkAnsweredData) => void;
  'session:questions:delete': (data: SessionQuestionsDeleteData) => void;
  'session:questions:clearAll': (data: SessionQuestionsClearAllData) => void;
  'questions:requestState': (data: QuestionsRequestStateData) => void;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Extract event names from event map
 */
export type ServerEventName = keyof ServerToClientEvents;
export type ClientEventName = keyof ClientToServerEvents;

/**
 * Get data type for a specific event
 */
export type ServerEventData<T extends ServerEventName> = Parameters<ServerToClientEvents[T]>[0];
export type ClientEventData<T extends ClientEventName> = Parameters<ClientToServerEvents[T]>[0];
