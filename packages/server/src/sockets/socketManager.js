const { EVENTS } = require('../config/constants');
const {
  startHostDisconnectTimeout
} = require('./hostDisconnectTimeouts');
const { installSafeSocketEvents } = require('./safeSocketEvents');
const { closeRoomAndNotify } = require('./closeRoom');
const { logger } = require('../utils/logger');

// Import individual socket handlers
const sessionHandler = require('./handlers/sessionHandler');
const pollHandler = require('./handlers/pollHandler');
const linkShareHandler = require('./handlers/linkShareHandler');
const rtFeedbackHandler = require('./handlers/rtFeedbackHandler');
const questionsHandler = require('./handlers/questionsHandler');
const handoutHandler = require('./handlers/handoutHandler');
const activityHandler = require('./handlers/activityHandler');
const adminHandler = require('./handlers/adminHandler');

const SOCKET_DEBUG = process.env.SOCKET_DEBUG === 'true';

/**
 * Setup all socket handlers
 */
function setupSocketHandlers(io, sessionManager) {
  // Idle rooms are closed like any other: the teacher and students are told.
  sessionManager.setRoomExpiryHandler((session, roomType, widgetId) =>
    closeRoomAndNotify(io, session, roomType, widgetId));

  io.on('connection', (socket) => {
    if (SOCKET_DEBUG) {
      logger.info(`Socket connected: ${socket.id}`);
    }

    // All event payloads are client-controlled; make sure a handler that
    // throws on a malformed payload logs instead of crashing the process.
    installSafeSocketEvents(socket);

    // Only the join handler can establish a validated participant identity.
    const getCurrentSessionCode = () => socket.data.sessionCode;

    // Setup all handlers
    sessionHandler(io, socket, sessionManager, getCurrentSessionCode);
    pollHandler(io, socket, sessionManager, getCurrentSessionCode);
    linkShareHandler(io, socket, sessionManager, getCurrentSessionCode);
    rtFeedbackHandler(io, socket, sessionManager, getCurrentSessionCode);
    questionsHandler(io, socket, sessionManager, getCurrentSessionCode);
    handoutHandler(io, socket, sessionManager, getCurrentSessionCode);
    activityHandler(io, socket, sessionManager, getCurrentSessionCode);
    adminHandler(io, socket, sessionManager);

    // Handle disconnection
    socket.on('disconnect', () => {
      if (SOCKET_DEBUG) {
        logger.info(`Socket disconnected: ${socket.id}`);
      }

      // Hosts never emit session:join, so the tracked code is only set for
      // participants; fall back to the session this socket hosts so that
      // create-only connections are reaped too.
      const currentSessionCode = getCurrentSessionCode();
      const session = (currentSessionCode && sessionManager.getSession(currentSessionCode))
        || sessionManager.findSessionByHost(socket.id);

      if (session) {
        if (session.hostSocketId === socket.id) {
          logger.info(`Host disconnected from session ${session.code}`);

          // Mark host as disconnected
          session.hostDisconnectedAt = Date.now();

          // Notify all students that the teacher has disconnected
          io.to(`session:${session.code}`).emit(EVENTS.SESSION.HOST_DISCONNECTED);

          // Start timeout to close session if host doesn't reconnect
          startHostDisconnectTimeout(io, sessionManager, session.code);
        } else {
          // Remove participant from session
          session.removeParticipant(socket.id);
          
          // Notify host of participant disconnect
          if (session.hostSocketId) {
            io.to(session.hostSocketId).emit(EVENTS.SESSION.PARTICIPANT_UPDATE, {
              count: session.getParticipantCount()
            });
          }
          
          // Remove participant from all rooms they're in.
          // Snapshot first - room.removeParticipant may trigger cleanup that
          // mutates session.activeRooms during iteration on some code paths.
          const roomEntries = Array.from(session.activeRooms.entries());
          for (const [roomId, room] of roomEntries) {
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
          }
        }
      }
    });
  });
}

module.exports = {
  setupSocketHandlers
};
