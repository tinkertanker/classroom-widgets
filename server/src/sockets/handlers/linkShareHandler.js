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
    io.to(`${session.code}:${linkShareRoomId}`).emit('linkShare:newSubmission', submission);
    
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
        submissionId: data.submissionId 
      });
    }
    
    session.updateActivity();
  });

  // Link Share start/stop handlers
  socket.on('session:linkShare:start', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('linkShare', data.widgetId);
    if (!room || !(room instanceof LinkShareRoom)) return;
    
    room.isActive = true;
    
    // Notify students that link sharing is active
    const linkShareRoomId = data.widgetId ? `linkShare:${data.widgetId}` : 'linkShare';
    io.to(`${session.code}:${linkShareRoomId}`).emit('linkShare:stateChanged', { 
      isActive: true,
      widgetId: data.widgetId
    });
    
    session.updateActivity();
  });
  
  socket.on('session:linkShare:stop', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('linkShare', data.widgetId);
    if (!room || !(room instanceof LinkShareRoom)) return;
    
    room.isActive = false;
    
    // Notify students that link sharing is paused
    const linkShareRoomId = data.widgetId ? `linkShare:${data.widgetId}` : 'linkShare';
    io.to(`${session.code}:${linkShareRoomId}`).emit('linkShare:stateChanged', { 
      isActive: false,
      widgetId: data.widgetId
    });
    
    session.updateActivity();
  });

  // Handle legacy link share events (backward compatibility)
  socket.on('linkShare:submit', (data) => {
    console.log('[Legacy] LinkShare submit event');
    
    // Find room by code
    const room = sessionManager.rooms.get(data.code);
    if (!room || !(room instanceof LinkShareRoom)) {
      socket.emit('linkShare:submitted', { success: false, error: 'Room not found' });
      return;
    }
    
    // Check if participant is in room
    if (!room.participants || !room.participants.has(socket.id)) {
      socket.emit('linkShare:submitted', { success: false, error: 'Not in room' });
      return;
    }
    
    const participant = room.participants.get(socket.id);
    const submission = room.addSubmission(data.studentName || participant.name, data.link);
    
    // Notify all in room
    io.to(`room:${data.code}`).emit('linkShare:newSubmission', submission);
    socket.emit('linkShare:submitted', { success: true });
  });

  socket.on('linkShare:delete', (data) => {
    console.log('[Legacy] LinkShare delete event');
    
    const room = sessionManager.rooms.get(data.code);
    if (!room || !(room instanceof LinkShareRoom)) return;
    if (room.hostSocketId !== socket.id) return;
    
    if (room.deleteSubmission(data.submissionId)) {
      io.to(`room:${data.code}`).emit('linkShare:submissionDeleted', { 
        submissionId: data.submissionId 
      });
    }
  });

  socket.on('linkShare:create', (data, callback) => {
    console.log('[Legacy] LinkShare create event - redirecting to session-based approach');
    
    // Create a legacy session for backward compatibility
    let session = sessionManager.findSessionByHost(socket.id);
    if (!session) {
      session = sessionManager.createSession();
      session.hostSocketId = socket.id;
    }
    
    // Create linkShare room
    const room = session.createRoom('linkShare', null);
    socket.join(`${session.code}:linkShare`);
    
    callback({ success: true, code: session.code });
  });
};