const { LIMITS } = require('../config/constants');
const { createRateLimitResponse } = require('../utils/errors');

/**
 * Socket authentication middleware
 */
const socketAuth = (sessionManager) => {
  return (socket, next) => {
    // Add session manager reference to socket
    socket.sessionManager = sessionManager;

    // Check for rate limiting info
    const clientIP = socket.handshake.address;
    socket.clientIP = clientIP;

    // Initialize socket metadata
    socket.metadata = {
      joinedAt: Date.now(),
      sessionCode: null,
      isHost: false,
      participantInfo: null
    };

    // Validate connection limits
    const currentStats = sessionManager.getStats();
    if (currentStats.totalParticipants >= LIMITS.MAX_TOTAL_PARTICIPANTS) {
      return next(new Error('Server is at capacity. Please try again later.'));
    }

    next();
  };
};

/**
 * Session validation middleware
 */
const validateSession = (sessionManager) => {
  return (eventName, ...args) => {
    const socket = this;
    const callback = args[args.length - 1];
    const data = args[0];

    // Events that don't require session validation
    const publicEvents = [
      'session:create',
      'session:join',
      'poll:join',
      'linkShare:join',
      'rtfeedback:join',
      'questions:join'
    ];

    if (publicEvents.includes(eventName)) {
      return true;
    }

    // Extract session code from data
    const sessionCode = data?.sessionCode || socket.metadata?.sessionCode;

    if (!sessionCode) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Session code required' });
      }
      return false;
    }

    const session = sessionManager.getSession(sessionCode);
    if (!session) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Session not found' });
      }
      return false;
    }

    // Check if socket is authorized for this session
    const isHost = session.hostSocketId === socket.id;
    const isParticipant = session.participants.has(socket.id);

    if (!isHost && !isParticipant) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Not authorized for this session' });
      }
      return false;
    }

    // Add session info to socket metadata
    socket.metadata.sessionCode = sessionCode;
    socket.metadata.isHost = isHost;

    return true;
  };
};

/**
 * Host-only action validation
 */
const requireHost = (socket, session) => {
  if (!session || session.hostSocketId !== socket.id) {
    return { valid: false, error: 'Only the host can perform this action' };
  }
  return { valid: true };
};

/**
 * Participant validation
 */
const requireParticipant = (socket, session) => {
  if (!session || !session.participants.has(socket.id)) {
    return { valid: false, error: 'Must be a session participant' };
  }
  return { valid: true };
};

/**
 * Event-specific rate limits
 * Defines limits per event type to prevent abuse
 */
const EVENT_RATE_LIMITS = {
  // Poll voting - 2 requests per second (prevent rapid vote changes)
  'session:poll:vote': { windowMs: 1000, max: 2 },

  // Link submissions - 3 requests per 5 seconds
  'session:linkShare:submit': { windowMs: 5000, max: 3 },

  // RT Feedback - 5 requests per 500ms (allow smooth slider updates)
  'session:rtfeedback:submit': { windowMs: 500, max: 5 },

  // Question submissions - 2 requests per 3 seconds
  'session:questions:submit': { windowMs: 3000, max: 2 }
};

/**
 * Rate limiting middleware factory
 * Creates a per-event rate limiter that tracks requests per client
 */
const createEventRateLimiter = () => {
  // Map of clientKey -> Map of eventName -> { count, windowStart }
  const eventRequests = new Map();

  // Cleanup old entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    eventRequests.forEach((events, clientKey) => {
      events.forEach((data, eventName) => {
        const limit = EVENT_RATE_LIMITS[eventName];
        if (limit && now - data.windowStart > limit.windowMs * 2) {
          events.delete(eventName);
        }
      });
      if (events.size === 0) {
        eventRequests.delete(clientKey);
      }
    });
  }, 5 * 60 * 1000);

  /**
   * Check if a request should be rate limited
   * @param {Socket} socket - The socket making the request
   * @param {string} eventName - The event name being requested
   * @returns {{ allowed: boolean, retryAfter?: number }} - Whether request is allowed
   */
  return (socket, eventName) => {
    // Get rate limit config for this event
    const limit = EVENT_RATE_LIMITS[eventName];
    if (!limit) {
      // No rate limit defined for this event
      return { allowed: true };
    }

    const now = Date.now();
    const clientKey = `${socket.clientIP}-${socket.id}`;

    // Initialize client's event map if needed
    if (!eventRequests.has(clientKey)) {
      eventRequests.set(clientKey, new Map());
    }

    const clientEvents = eventRequests.get(clientKey);

    // Initialize event tracking if needed
    if (!clientEvents.has(eventName)) {
      clientEvents.set(eventName, { count: 1, windowStart: now });
      return { allowed: true };
    }

    const eventData = clientEvents.get(eventName);

    // Reset window if expired
    if (now - eventData.windowStart > limit.windowMs) {
      eventData.count = 1;
      eventData.windowStart = now;
      return { allowed: true };
    }

    // Check rate limit
    eventData.count++;
    if (eventData.count > limit.max) {
      const retryAfter = limit.windowMs - (now - eventData.windowStart);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  };
};

// Create singleton rate limiter instance
const eventRateLimiter = createEventRateLimiter();

/**
 * Legacy global rate limiter (kept for backwards compatibility)
 */
const rateLimiter = (() => {
  const requests = new Map();
  const WINDOW_MS = 60000; // 1 minute
  const MAX_REQUESTS = 100; // 100 requests per minute

  return (socket) => {
    const now = Date.now();
    const clientKey = `${socket.clientIP}-${socket.id}`;

    if (!requests.has(clientKey)) {
      requests.set(clientKey, { count: 1, windowStart: now });
      return true;
    }

    const clientData = requests.get(clientKey);

    // Reset window if expired
    if (now - clientData.windowStart > WINDOW_MS) {
      clientData.count = 1;
      clientData.windowStart = now;
      return true;
    }

    // Check rate limit
    clientData.count++;
    if (clientData.count > MAX_REQUESTS) {
      return false;
    }

    return true;
  };
})();

/**
 * Create rate limit middleware for socket handlers
 * Wraps a handler function with rate limiting
 *
 * @param {string} eventName - The event name for rate limiting
 * @param {Function} handler - The original handler function
 * @returns {Function} - Wrapped handler with rate limiting
 */
const withRateLimit = (eventName, handler) => {
  return (socket, data, callback) => {
    const result = eventRateLimiter(socket, eventName);

    if (!result.allowed) {
      // Rate limited - send error response
      const response = createRateLimitResponse(result.retryAfter);

      if (typeof callback === 'function') {
        callback(response);
      } else {
        // Find the appropriate response event
        const responseEvent = eventName.replace(':submit', ':submitted')
          .replace(':vote', ':voteConfirmed');
        socket.emit(responseEvent, response);
      }
      return;
    }

    // Call the original handler
    return handler(socket, data, callback);
  };
};

module.exports = {
  socketAuth,
  validateSession,
  requireHost,
  requireParticipant,
  rateLimiter,
  eventRateLimiter,
  withRateLimit,
  EVENT_RATE_LIMITS
};
