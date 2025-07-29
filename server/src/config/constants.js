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
  SAFE_CHARACTERS: '23456789ACDEFHJKMNPQRTUWXY',

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
      CREATE: 'session:create',
      JOIN: 'session:join',
      CREATE_ROOM: 'session:createRoom',
      CLOSE_ROOM: 'session:closeRoom',
      JOIN_ROOM: 'session:joinRoom',
      LEAVE_ROOM: 'session:leaveRoom',
      PARTICIPANT_UPDATE: 'session:participantUpdate'
    },
    POLL: {
      UPDATE: 'session:poll:update',
      VOTE: 'session:poll:vote',
      REQUEST_STATE: 'poll:requestState',
      DATA_UPDATE: 'poll:dataUpdate',
      STATE_CHANGED: 'poll:stateChanged',
      VOTE_UPDATE: 'poll:voteUpdate'
    },
    LINK_SHARE: {
      SUBMIT: 'session:linkShare:submit',
      DELETE: 'session:linkShare:delete',
      START: 'session:linkShare:start',
      STOP: 'session:linkShare:stop',
      NEW_SUBMISSION: 'linkShare:newSubmission',
      SUBMISSION_DELETED: 'linkShare:submissionDeleted',
      STATE_CHANGED: 'linkShare:roomStateChanged'
    },
    RT_FEEDBACK: {
      UPDATE: 'session:rtfeedback:update',
      RESET: 'session:rtfeedback:reset',
      START: 'session:rtfeedback:start',
      STOP: 'session:rtfeedback:stop',
      STATE_CHANGED: 'rtfeedback:stateChanged',
      DATA_UPDATE: 'rtfeedback:update'
    },
    QUESTIONS: {
      SUBMIT: 'session:questions:submit',
      MARK_ANSWERED: 'session:questions:markAnswered',
      DELETE: 'session:questions:delete',
      CLEAR_ALL: 'session:questions:clearAll',
      START: 'session:questions:start',
      STOP: 'session:questions:stop',
      STATE_CHANGED: 'questions:stateChanged',
      NEW_QUESTION: 'newQuestion',
      QUESTION_ANSWERED: 'questionAnswered',
      QUESTION_DELETED: 'questionDeleted',
      ALL_CLEARED: 'allQuestionsCleared'
    }
  }
};