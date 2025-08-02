const { EVENTS, LIMITS } = require('../../config/constants');
const LinkShareRoom = require('../../models/LinkShareRoom');

/**
 * Handle link share related socket events
 */
module.exports = function linkShareHandler(io, socket, sessionManager, getCurrentSessionCode) {
  
  // Handle link submission
  socket.on('session:linkShare:submit', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session) {
      socket.emit('session:linkShare:submitted', { success: false, error: 'Session not found' });
      return;
    }
    
    const room = session.getRoom('linkShare', data.widgetId);
    if (!room || !(room instanceof LinkShareRoom)) {
      socket.emit('session:linkShare:submitted', { success: false, error: 'Link share room not found' });
      return;
    }
    
    const participant = session.participants.get(socket.id);
    if (!participant) {
      socket.emit('session:linkShare:submitted', { success: false, error: 'Not joined to session' });
      return;
    }
    
    // Check if link sharing is active
    if (!room.isActive) {
      socket.emit('session:linkShare:submitted', { success: false, error: 'Link sharing is not currently active' });
      return;
    }
    
    // Update participant name if provided
    if (data.studentName && data.studentName !== participant.name) {
      participant.name = data.studentName;
    }
    
    const submission = room.addSubmission(data.studentName || participant.name, data.link);
    
    // Notify all in the room
    const linkShareRoomId = data.widgetId ? `linkShare:${data.widgetId}` : 'linkShare';
    io.to(`${session.code}:${linkShareRoomId}`).emit('linkShare:newSubmission', {
      ...submission,
      widgetId: data.widgetId
    });
    
    // Send confirmation to submitter
    socket.emit('session:linkShare:submitted', { success: true });
    
    session.updateActivity();
  });

  // Handle submission deletion
  socket.on('session:linkShare:delete', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('linkShare', data.widgetId);
    if (!room || !(room instanceof LinkShareRoom)) return;
    
    if (room.deleteSubmission(data.submissionId)) {
      const linkShareRoomId = data.widgetId ? `linkShare:${data.widgetId}` : 'linkShare';
      io.to(`${session.code}:${linkShareRoomId}`).emit('linkShare:submissionDeleted', { 
        submissionId: data.submissionId,
        widgetId: data.widgetId
      });
    }
    
    session.updateActivity();
  });

  // Student requests linkShare state (on join/refresh)
  socket.on('linkShare:requestState', (data) => {
    const { code, widgetId } = data;
    const session = sessionManager.getSession(code);
    
    if (session) {
      const room = session.getRoom('linkShare', widgetId);
      if (room && room instanceof LinkShareRoom) {
        socket.emit(EVENTS.LINK_SHARE.STATE_CHANGED, { 
          isActive: room.isActive,
          widgetId: data.widgetId
        });
      }
    }
  });


};