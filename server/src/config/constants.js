/**
 * Application constants
 */
module.exports = {
  // Time constants
  TIME: {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    SESSION_MAX_AGE: 12 * 60 * 60 * 1000, // 12 hours
    INACTIVITY_TIMEOUT: 2 * 60 * 60 * 1000, // 2 hours
    CLEANUP_INTERVAL: 60 * 60 * 1000 // 1 hour
  },

  // Limits
  LIMITS: {
    MAX_SESSIONS: 1000,
    MAX_ROOMS_PER_SESSION: 10,
    MAX_PARTICIPANTS_PER_ROOM: 500,
    MAX_SUBMISSIONS_PER_ROOM: 1000,
    MAX_QUESTIONS_PER_ROOM: 500,
    ROOM_CODE_LENGTH: 5,
    MAX_QUESTION_LENGTH: 1000,
    MAX_LINK_LENGTH: 2000,
    MAX_POLL_QUESTION_LENGTH: 500,
    MAX_POLL_OPTION_LENGTH: 200,
    MIN_POLL_OPTIONS: 2,
    MAX_POLL_OPTIONS: 10
  },

  // Safe characters for room codes (excluding confusing ones like 0/O, 1/I/l, V/U)
  SAFE_CHARACTERS: '23456789ACDEFHJKNPQRTUWY',

  // Room types
  ROOM_TYPES: {
    POLL: 'poll',
    LINK_SHARE: 'linkShare',
    RT_FEEDBACK: 'rtfeedback',
    QUESTIONS: 'questions'
  },

  // Socket event namespaces
  EVENTS: {
    SESSION: {
      // Client -> Server events
      CREATE: 'session:create',
      JOIN: 'session:join',
      CLOSE: 'session:close',
      CREATE_ROOM: 'session:createRoom',
      CLOSE_ROOM: 'session:closeRoom',
      UPDATE_WIDGET_STATE: 'session:updateWidgetState',
      // Server -> Client events
      CREATED: 'session:created',
      JOINED: 'session:joined',
      CLOSED: 'session:closed',
      ROOM_CREATED: 'session:roomCreated',
      ROOM_CLOSED: 'session:roomClosed',
      PARTICIPANT_UPDATE: 'session:participantUpdate',
      WIDGET_STATE_CHANGED: 'session:widgetStateChanged',
      HOST_DISCONNECTED: 'session:hostDisconnected',
      HOST_RECONNECTED: 'session:hostReconnected'
    },
    POLL: {
      // Client -> Server events
      UPDATE: 'session:poll:update',
      VOTE: 'session:poll:vote',
      REQUEST_STATE: 'poll:requestState',
      // Server -> Client events
      VOTE_CONFIRMED: 'session:poll:voteConfirmed',
      DATA_UPDATE: 'poll:dataUpdate',
      STATE_CHANGED: 'poll:stateChanged',
      VOTE_UPDATE: 'poll:voteUpdate'
    },
    LINK_SHARE: {
      // Client -> Server events
      SUBMIT: 'session:linkShare:submit',
      DELETE: 'session:linkShare:delete',
      REQUEST_STATE: 'linkShare:requestState',
      // Server -> Client events
      SUBMITTED: 'session:linkShare:submitted',
      NEW_SUBMISSION: 'linkShare:newSubmission',
      SUBMISSION_DELETED: 'linkShare:submissionDeleted',
      STATE_CHANGED: 'linkShare:stateChanged'
    },
    RT_FEEDBACK: {
      // Client -> Server events
      SUBMIT: 'session:rtfeedback:submit',
      RESET: 'session:rtfeedback:reset',
      REQUEST_STATE: 'rtfeedback:requestState',
      // Server -> Client events
      SUBMITTED: 'session:rtfeedback:submitted',
      STATE_CHANGED: 'rtfeedback:stateChanged',
      DATA_UPDATE: 'rtfeedback:update'
    },
    QUESTIONS: {
      // Client -> Server events
      SUBMIT: 'session:questions:submit',
      MARK_ANSWERED: 'session:questions:markAnswered',
      DELETE: 'session:questions:delete',
      CLEAR_ALL: 'session:questions:clearAll',
      REQUEST_STATE: 'questions:requestState',
      // Server -> Client events
      SUBMITTED: 'session:questions:submitted',
      STATE_CHANGED: 'questions:stateChanged',
      LIST: 'questions:list',
      NEW_QUESTION: 'questions:newQuestion',
      QUESTION_ANSWERED: 'questions:questionAnswered',
      QUESTION_DELETED: 'questions:questionDeleted',
      ALL_CLEARED: 'questions:allCleared'
    }
  }
};