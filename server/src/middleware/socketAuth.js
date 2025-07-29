const { LIMITS } = require('../config/constants');

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
 * Rate limiting middleware
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

module.exports = {
  socketAuth,
  validateSession,
  requireHost,
  requireParticipant,
  rateLimiter
};