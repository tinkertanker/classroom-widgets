/**
 * Student app configuration
 * Centralized settings for the student application
 */

export const studentAppConfig = {
  // Animation timings (ms)
  animations: {
    roomEnter: 50,
    roomLeave: 300,
    fadeIn: 200,
    scrollThreshold: 100,
    headerTransition: 300
  },

  // UI constants
  ui: {
    headerHeights: {
      normal: 80,
      compact: 40,
      mobile: 40
    },
    maxContentWidth: 800,
    defaultPadding: {
      mobile: 8,
      desktop: 12
    }
  },

  // Socket configuration
  socket: {
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    requestStateDelay: 100 // Delay before requesting initial state
  },

  // Local storage keys
  storage: {
    studentName: 'studentName',
    darkMode: 'darkMode',
    minimizedRooms: 'minimizedRooms'
  },

  // Activity-specific settings
  activities: {
    poll: {
      animationDuration: 300,
      resultBarAnimation: 300
    },
    dataShare: {
      maxLinkLength: 500,
      submitCooldown: 1000
    },
    rtfeedback: {
      sliderStep: 0.2,
      sliderMin: 1,
      sliderMax: 5,
      updateDebounce: 100
    },
    questions: {
      maxQuestionLength: 500,
      successMessageDuration: 3000
    }
  },

  // Error messages
  errors: {
    sessionNotFound: 'Invalid session code',
    alreadyJoined: 'Already joined this session',
    connectionFailed: 'Failed to connect to server',
    submitFailed: 'Failed to submit. Please try again.',
    networkError: 'Network error. Please check your connection.'
  },

  // Success messages
  messages: {
    voteSubmitted: 'Vote submitted successfully!',
    linkSubmitted: 'Link submitted successfully!',
    questionSubmitted: 'Question submitted successfully!',
    connected: 'Connected',
    connecting: 'Connecting...',
    updating: 'Updating...'
  }
};

// Helper function to get animation duration
export const getAnimationDuration = (animationType: keyof typeof studentAppConfig.animations): number => {
  return studentAppConfig.animations[animationType] || 200;
};

// Helper function to get error message
export const getErrorMessage = (errorType: keyof typeof studentAppConfig.errors): string => {
  return studentAppConfig.errors[errorType] || 'An error occurred';
};

// Helper function to get success message
export const getMessage = (messageType: keyof typeof studentAppConfig.messages): string => {
  return studentAppConfig.messages[messageType] || '';
};