const { EVENTS, LIMITS } = require('../../config/constants');
const RTFeedbackRoom = require('../../models/RTFeedbackRoom');

/**
 * Handle real-time feedback related socket events
 */
module.exports = function rtFeedbackHandler(io, socket, sessionManager, getCurrentSessionCode) {
  
  // RT Feedback handlers for sessions
  socket.on('session:rtfeedback:start', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('rtfeedback', data.widgetId);
    if (!room || !(room instanceof RTFeedbackRoom)) {
      console.log('[Server] Room not found or not RTFeedbackRoom instance');
      return;
    }
    
    room.isActive = true;
    
    // Notify all participants that feedback is now active
    const rtfeedbackRoomId = data.widgetId ? `rtfeedback:${data.widgetId}` : 'rtfeedback';
    const roomNamespace = `${session.code}:${rtfeedbackRoomId}`;
    
    console.log('[Server] Current room participants:', room.participants ? room.participants.size : 0);
    console.log('[Server] Current socket.id:', socket.id);
    
    console.log('[Server] Emitting rtfeedback:stateChanged to room:', roomNamespace);
    io.to(roomNamespace).emit('rtfeedback:stateChanged', { 
      isActive: true,
      widgetId: data.widgetId
    });
    
    session.updateActivity();
  });
  
  socket.on('session:rtfeedback:stop', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('rtfeedback', data.widgetId);
    if (!room || !(room instanceof RTFeedbackRoom)) return;
    
    room.isActive = false;
    
    // Notify all participants that feedback is now inactive
    const rtfeedbackRoomId = data.widgetId ? `rtfeedback:${data.widgetId}` : 'rtfeedback';
    io.to(`${session.code}:${rtfeedbackRoomId}`).emit('rtfeedback:stateChanged', { 
      isActive: false,
      widgetId: data.widgetId
    });
    
    session.updateActivity();
  });

  // Handle student feedback submission
  socket.on('session:rtfeedback:submit', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session) {
      socket.emit('session:rtfeedback:submitted', { success: false, error: 'Session not found' });
      return;
    }
    
    const room = session.getRoom('rtfeedback', data.widgetId);
    if (!room || !(room instanceof RTFeedbackRoom)) {
      socket.emit('session:rtfeedback:submitted', { success: false, error: 'Feedback room not found' });
      return;
    }
    
    // Check if feedback is active
    if (!room.isActive) {
      socket.emit('session:rtfeedback:submitted', { success: false, error: 'Feedback is not active' });
      return;
    }
    
    // Check if student is a participant
    const participant = session.participants.get(socket.id);
    if (!participant) {
      socket.emit('session:rtfeedback:submitted', { success: false, error: 'Not a valid participant' });
      return;
    }
    
    // Submit feedback
    room.updateFeedback(socket.id, data.value);
    
    // Send confirmation
    socket.emit('session:rtfeedback:submitted', { success: true });
    
    // Emit updated aggregated feedback to all in the room
    const rtfeedbackRoomId = data.widgetId ? `rtfeedback:${data.widgetId}` : 'rtfeedback';
    io.to(`${session.code}:${rtfeedbackRoomId}`).emit('rtfeedback:update', {
      ...room.getAggregatedFeedback(),
      widgetId: data.widgetId
    });
    
    session.updateActivity();
  });

  // Student requests rtfeedback state (on join/refresh)
  socket.on('rtfeedback:requestState', (data) => {
    const { code, widgetId } = data;
    const session = sessionManager.getSession(code);
    
    if (session) {
      const room = session.getRoom('rtfeedback', widgetId);
      if (room && room instanceof RTFeedbackRoom) {
        socket.emit('rtfeedback:stateChanged', { 
          isActive: room.isActive,
          widgetId: data.widgetId
        });
      }
    }
  });

  // Handle reset request
  socket.on('session:rtfeedback:reset', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('rtfeedback', data.widgetId);
    if (!room || !(room instanceof RTFeedbackRoom)) return;
    
    room.clearAllFeedback();
    
    // Emit updated state to all in the room
    const rtfeedbackRoomId = data.widgetId ? `rtfeedback:${data.widgetId}` : 'rtfeedback';
    io.to(`${session.code}:${rtfeedbackRoomId}`).emit('rtfeedback:update', {
      ...room.getAggregatedFeedback(),
      widgetId: data.widgetId
    });
    
    session.updateActivity();
  });

  // Handle legacy RT feedback events (backward compatibility)
  socket.on('rtfeedback:create', (data, callback) => {
    console.log('[Legacy] RTFeedback create event - redirecting to session-based approach');
    
    // Create a legacy session for backward compatibility
    let session = sessionManager.findSessionByHost(socket.id);
    if (!session) {
      session = sessionManager.createSession();
      session.hostSocketId = socket.id;
    }
    
    // Create rtfeedback room
    const room = session.createRoom('rtfeedback', null);
    socket.join(`${session.code}:rtfeedback`);
    
    callback({ success: true, code: session.code });
  });

  socket.on('rtfeedback:submit', (data) => {
    console.log('[Legacy] RTFeedback submit event');
    
    const room = sessionManager.rooms.get(data.code);
    if (!room || !(room instanceof RTFeedbackRoom)) {
      socket.emit('rtfeedback:error', { error: 'Room not found' });
      return;
    }
    
    if (!room.participants.has(socket.id)) {
      socket.emit('rtfeedback:error', { error: 'Not in room' });
      return;
    }
    
    room.updateFeedback(socket.id, data.value);
    
    io.to(`room:${data.code}`).emit('rtfeedback:update', room.getAggregatedFeedback());
  });

  socket.on('rtfeedback:reset', (data) => {
    console.log('[Legacy] RTFeedback reset event');
    
    const room = sessionManager.rooms.get(data.code);
    if (!room || !(room instanceof RTFeedbackRoom)) return;
    if (room.hostSocketId !== socket.id) return;
    
    room.clearAllFeedback();
    io.to(`room:${data.code}`).emit('rtfeedback:update', room.getAggregatedFeedback());
  });
};