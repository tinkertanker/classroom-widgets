const { EVENTS, LIMITS } = require('../../config/constants');
const RTFeedbackRoom = require('../../models/RTFeedbackRoom');

/**
 * Handle real-time feedback related socket events
 */
module.exports = function rtFeedbackHandler(io, socket, sessionManager, getCurrentSessionCode) {
  

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

};