const { EVENTS } = require('../config/constants');

// Import individual socket handlers
const sessionHandler = require('./handlers/sessionHandler');
const pollHandler = require('./handlers/pollHandler');
const linkShareHandler = require('./handlers/linkShareHandler');
const rtFeedbackHandler = require('./handlers/rtFeedbackHandler');
const questionsHandler = require('./handlers/questionsHandler');

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

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      // Handle session disconnect
      if (currentSessionCode) {
        const session = sessionManager.getSession(currentSessionCode);
        if (session) {
          if (session.hostSocketId === socket.id) {
            console.log(`Host disconnected from session ${currentSessionCode}`);
            // Keep session alive for reconnection
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
      
      // Handle legacy room disconnect
      sessionManager.rooms.forEach((room, code) => {
        if (room.hostSocketId === socket.id) {
          console.log(`Host disconnected from legacy room ${code}`);
          // Keep room alive for reconnection
        } else if (room.participants && room.participants.has(socket.id)) {
          room.removeParticipant(socket.id);
          
          // Notify host
          if (room.hostSocketId) {
            const roomType = room.getType ? room.getType() : 'unknown';
            io.to(room.hostSocketId).emit(EVENTS.SESSION.PARTICIPANT_UPDATE, {
              count: room.getParticipantCount(),
              roomType: roomType,
              widgetId: room.widgetId
            });
          }
        }
      });
    });
  });
}

module.exports = {
  setupSocketHandlers
};