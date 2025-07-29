const { EVENTS, LIMITS } = require('../../config/constants');
const PollRoom = require('../../models/PollRoom');

/**
 * Handle poll-related socket events
 */
module.exports = function pollHandler(io, socket, sessionManager, getCurrentSessionCode) {
  
  // Poll update handler
  socket.on('session:poll:update', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('poll', data.widgetId);
    if (!room || !(room instanceof PollRoom)) return;
    
    // Track previous active state
    const wasInactive = !room.pollData.isActive;
    
    // Use setPollData to ensure proper initialization
    room.setPollData(data.pollData);
    
    // Emit harmonized events
    const roomId = data.widgetId ? `poll:${data.widgetId}` : 'poll';
    io.to(`${session.code}:${roomId}`).emit('poll:dataUpdate', {
      pollData: room.pollData,
      results: room.getResults()
    });
    
    // If state changed, emit state change event
    const nowActive = room.pollData.isActive;
    if (wasInactive !== nowActive) {
      io.to(`${session.code}:${roomId}`).emit('poll:stateChanged', { 
        isActive: data.pollData.isActive,
        widgetId: data.widgetId
      });
    }
    
    session.updateActivity();
  });

  // Poll start handler
  socket.on('session:poll:start', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('poll', data.widgetId);
    if (!room || !(room instanceof PollRoom)) return;
    
    // Update poll data to set isActive
    room.pollData.isActive = true;
    
    // Notify all participants
    const pollRoomId = data.widgetId ? `poll:${data.widgetId}` : 'poll';
    io.to(`${session.code}:${pollRoomId}`).emit('poll:stateChanged', { 
      isActive: true,
      widgetId: data.widgetId
    });
    
    // Also emit dataUpdate for backward compatibility
    io.to(`${session.code}:${pollRoomId}`).emit('poll:dataUpdate', {
      pollData: room.pollData,
      results: room.getResults()
    });
    
    session.updateActivity();
  });
  
  socket.on('session:poll:stop', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('poll', data.widgetId);
    if (!room || !(room instanceof PollRoom)) return;
    
    // Update poll data to set isActive
    room.pollData.isActive = false;
    
    // Notify all participants
    const pollRoomId = data.widgetId ? `poll:${data.widgetId}` : 'poll';
    io.to(`${session.code}:${pollRoomId}`).emit('poll:stateChanged', { 
      isActive: false,
      widgetId: data.widgetId
    });
    
    // Also emit dataUpdate for backward compatibility
    io.to(`${session.code}:${pollRoomId}`).emit('poll:dataUpdate', {
      pollData: room.pollData,
      results: room.getResults()
    });
    
    session.updateActivity();
  });

  // Student requests poll state (on join/refresh)
  socket.on('poll:requestState', (data) => {
    const { code, widgetId } = data;
    const session = sessionManager.getSession(code);
    
    if (session) {
      const room = session.getRoom('poll', widgetId);
      if (room && room instanceof PollRoom) {
        socket.emit('poll:dataUpdate', {
          pollData: room.pollData,
          results: room.getResults()
        });
        socket.emit('poll:stateChanged', { 
          isActive: room.pollData.isActive,
          widgetId: data.widgetId
        });
      }
    }
  });

  // Handle student vote submission
  socket.on('poll:vote', (data) => {
    const { code, widgetId, optionIndex } = data;
    const session = sessionManager.getSession(code);
    
    if (!session) {
      socket.emit('vote:confirmed', { success: false, error: 'Session not found' });
      return;
    }
    
    const room = session.getRoom('poll', widgetId);
    if (!room || !(room instanceof PollRoom)) {
      socket.emit('vote:confirmed', { success: false, error: 'Poll not found' });
      return;
    }
    
    // Check if poll is active
    if (!room.pollData.isActive) {
      socket.emit('vote:confirmed', { success: false, error: 'Poll is not active' });
      return;
    }
    
    // Check if participant has already voted
    const participant = session.getParticipant(socket.id);
    if (!participant) {
      socket.emit('vote:confirmed', { success: false, error: 'Not a valid participant' });
      return;
    }
    
    // Record vote
    if (room.vote(socket.id, optionIndex)) {
      socket.emit('vote:confirmed', { success: true });
      
      // Emit updated vote counts to all in the room
      const pollRoomId = widgetId ? `poll:${widgetId}` : 'poll';
      io.to(`${session.code}:${pollRoomId}`).emit('poll:voteUpdate', {
        votes: room.getVoteCounts(),
        totalVotes: room.getTotalVotes()
      });
    } else {
      socket.emit('vote:confirmed', { success: false, error: 'Already voted' });
    }
    
    session.updateActivity();
  });

  // Handle session-based poll events
  socket.on('session:poll:vote', (data) => {
    const { sessionCode, widgetId, optionIndex } = data;
    const session = sessionManager.getSession(sessionCode || getCurrentSessionCode());
    
    if (!session) {
      socket.emit('session:poll:voteConfirmed', { success: false, error: 'Session not found' });
      return;
    }
    
    const room = session.getRoom('poll', widgetId);
    if (!room || !(room instanceof PollRoom)) {
      socket.emit('session:poll:voteConfirmed', { success: false, error: 'Poll not found' });
      return;
    }
    
    // Check if poll is active
    if (!room.pollData.isActive) {
      socket.emit('session:poll:voteConfirmed', { success: false, error: 'Poll is not active' });
      return;
    }
    
    // Check if participant has already voted
    const participant = session.getParticipant(socket.id);
    if (!participant) {
      socket.emit('session:poll:voteConfirmed', { success: false, error: 'Not a valid participant' });
      return;
    }
    
    // Record vote
    if (room.vote(socket.id, optionIndex)) {
      socket.emit('session:poll:voteConfirmed', { success: true });
      
      // Emit updated results to all in the room
      const pollRoomId = widgetId ? `poll:${widgetId}` : 'poll';
      io.to(`${session.code}:${pollRoomId}`).emit('poll:voteUpdate', {
        votes: room.getVoteCounts(),
        totalVotes: room.getTotalVotes()
      });
    } else {
      socket.emit('session:poll:voteConfirmed', { success: false, error: 'Already voted' });
    }
    
    session.updateActivity();
  });

  // Handle legacy poll events (backward compatibility)
  socket.on('poll:create', (data, callback) => {
    console.log('[Legacy] Poll create event - redirecting to session-based approach');
    
    // Create a legacy session for backward compatibility
    let session = sessionManager.findSessionByHost(socket.id);
    if (!session) {
      session = sessionManager.createSession();
      session.hostSocketId = socket.id;
    }
    
    // Create poll room
    const room = session.createRoom('poll', null);
    room.setPollData(data);
    
    socket.join(`${session.code}:poll`);
    
    callback({ success: true, code: session.code });
  });

  socket.on('poll:update', (data) => {
    console.log('[Legacy] Poll update event');
    const session = sessionManager.findSessionByHost(socket.id);
    if (!session) return;
    
    const room = session.getRoom('poll', null);
    if (!room || !(room instanceof PollRoom)) return;
    
    room.setPollData(data.pollData);
    
    io.to(`${session.code}:poll`).emit('poll:updated', room.pollData);
    io.to(`${session.code}:poll`).emit('poll:voteUpdate', {
      votes: room.getVoteCounts(),
      totalVotes: room.getTotalVotes()
    });
  });
};