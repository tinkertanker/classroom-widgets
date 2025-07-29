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
    
    // If poll is being activated after being inactive, clear previous votes
    if (wasInactive && data.pollData.isActive) {
      room.clearVotes();
    }
    
    // Emit harmonized events
    const roomId = data.widgetId ? `poll:${data.widgetId}` : 'poll';
    io.to(`${session.code}:${roomId}`).emit('poll:dataUpdate', {
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
        totalVotes: room.getTotalVotes(),
        widgetId: widgetId
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
        totalVotes: room.getTotalVotes(),
        widgetId: widgetId
      });
    } else {
      socket.emit('session:poll:voteConfirmed', { success: false, error: 'Already voted' });
    }
    
    session.updateActivity();
  });

};