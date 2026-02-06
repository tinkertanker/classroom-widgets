const { EVENTS } = require('../config/constants');

// Import individual socket handlers
const sessionHandler = require('./handlers/sessionHandler');
const pollHandler = require('./handlers/pollHandler');
const linkShareHandler = require('./handlers/linkShareHandler');
const rtFeedbackHandler = require('./handlers/rtFeedbackHandler');
const questionsHandler = require('./handlers/questionsHandler');
const handoutHandler = require('./handlers/handoutHandler');
const activityHandler = require('./handlers/activityHandler');
const adminHandler = require('./handlers/adminHandler');

// Track host disconnect timeouts (sessionCode -> timeoutId)
const hostDisconnectTimeouts = new Map();

// Time to wait before closing session after host disconnects (5 minutes)
const HOST_DISCONNECT_TIMEOUT = 5 * 60 * 1000;

/**
 * Start a timeout to close session if host doesn't reconnect
 */
function startHostDisconnectTimeout(io, sessionManager, sessionCode) {
  // Clear any existing timeout
  clearHostDisconnectTimeout(sessionCode);

  const timeoutId = setTimeout(() => {
    const session = sessionManager.getSession(sessionCode);
    if (session && session.isHostDisconnected()) {
      console.log(`Host reconnect timeout expired for session ${sessionCode}, closing session`);

      // Notify all students that session is closed
      io.to(`session:${sessionCode}`).emit(EVENTS.SESSION.CLOSED);

      // Clean up the session
      sessionManager.deleteSession(sessionCode);
    }
    hostDisconnectTimeouts.delete(sessionCode);
  }, HOST_DISCONNECT_TIMEOUT);

  hostDisconnectTimeouts.set(sessionCode, timeoutId);
  console.log(`Started ${HOST_DISCONNECT_TIMEOUT / 1000}s timeout for session ${sessionCode}`);
}

/**
 * Cancel host disconnect timeout (called when host reconnects)
 */
function clearHostDisconnectTimeout(sessionCode) {
  const timeoutId = hostDisconnectTimeouts.get(sessionCode);
  if (timeoutId) {
    clearTimeout(timeoutId);
    hostDisconnectTimeouts.delete(sessionCode);
    console.log(`Cleared host disconnect timeout for session ${sessionCode}`);
  }
}

/**
 * Setup all socket handlers
 */
function setupSocketHandlers(io, sessionManager) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    
    // Track which session this socket belongs to
    let currentSessionCode = null;

    // Attach session tracking to socket
    socket.on(EVENTS.SESSION.JOIN, (data) => {
      currentSessionCode = data.code;
    });

    // Setup all handlers
    sessionHandler(io, socket, sessionManager, () => currentSessionCode);
    pollHandler(io, socket, sessionManager, () => currentSessionCode);
    linkShareHandler(io, socket, sessionManager, () => currentSessionCode);
    rtFeedbackHandler(io, socket, sessionManager, () => currentSessionCode);
    questionsHandler(io, socket, sessionManager, () => currentSessionCode);
    handoutHandler(io, socket, sessionManager, () => currentSessionCode);
    activityHandler(io, socket, sessionManager, () => currentSessionCode);
    adminHandler(io, socket, sessionManager);

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      // Handle session disconnect
      if (currentSessionCode) {
        const session = sessionManager.getSession(currentSessionCode);
        if (session) {
          if (session.hostSocketId === socket.id) {
            console.log(`Host disconnected from session ${currentSessionCode}`);

            // Mark host as disconnected
            session.hostDisconnectedAt = Date.now();

            // Notify all students that the teacher has disconnected
            io.to(`session:${currentSessionCode}`).emit(EVENTS.SESSION.HOST_DISCONNECTED);

            // Start timeout to close session if host doesn't reconnect
            startHostDisconnectTimeout(io, sessionManager, currentSessionCode);
          } else {
            // Remove participant from session
            session.removeParticipant(socket.id);
            
            // Notify host of participant disconnect
            if (session.hostSocketId) {
              io.to(session.hostSocketId).emit(EVENTS.SESSION.PARTICIPANT_UPDATE, {
                count: session.getParticipantCount(),
                participants: session.getParticipants()
              });
            }
            
            // Remove participant from all rooms they're in
            session.activeRooms.forEach((room, roomId) => {
              if (room.participants && room.participants.has(socket.id)) {
                room.removeParticipant(socket.id);
                
                // Parse room type from roomId
                const [roomType] = roomId.split(':');
                
                // Notify host of room participant count update
                if (room.hostSocketId) {
                  io.to(room.hostSocketId).emit(EVENTS.SESSION.PARTICIPANT_UPDATE, {
                    count: room.getParticipantCount(),
                    roomType: roomType,
                    widgetId: room.widgetId
                  });
                }
              }
            });
          }
        }
      }
      
      // Legacy room handling is no longer needed since we moved to session-based architecture
      // All room management is now handled through sessions
    });
  });
}

module.exports = {
  setupSocketHandlers,
  clearHostDisconnectTimeout
};