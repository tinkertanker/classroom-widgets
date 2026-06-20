const { LIMITS } = require('../config/constants');

// Tracks every setInterval created by rate limiters so server.js can clear
// them during graceful shutdown (prevents the event loop staying alive).
const pendingCleanupHandles = [];

/**
 * Cancel all rate-limiter cleanup timers. Called from graceful shutdown.
 */
const stopRateLimiterCleanup = () => {
  while (pendingCleanupHandles.length) {
    const handle = pendingCleanupHandles.pop();
    clearInterval(handle);
  }
};

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

  // Cleanup old entries every 5 minutes. Track handle so graceful shutdown can cancel it.
  const cleanupHandle = setInterval(() => {
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
  if (cleanupHandle.unref) cleanupHandle.unref();
  // Expose stop() so server.js can clear during shutdown.
  pendingCleanupHandles.push(cleanupHandle);

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

module.exports = {
  socketAuth,
  eventRateLimiter,
  EVENT_RATE_LIMITS,
  stopRateLimiterCleanup
};
