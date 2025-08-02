const { EVENTS, LIMITS } = require('../../config/constants');
const PollRoom = require('../../models/PollRoom');

/**
 * Handle poll-related socket events
 */
module.exports = function pollHandler(io, socket, sessionManager, getCurrentSessionCode) {
  
  // Poll update handler
  socket.on('session:poll:update', (data) => {
    console.log('[pollHandler] Received session:poll:update:', {
      sessionCode: data.sessionCode,
      widgetId: data.widgetId,
      pollData: data.pollData
    });
    
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) {
      console.log('[pollHandler] Ignoring poll:update - not from host');
      return;
    }
    
    const room = session.getRoom('poll', data.widgetId);
    if (!room || !(room instanceof PollRoom)) {
      console.log('[pollHandler] Poll room not found for widget:', data.widgetId);
      return;
    }
    
    console.log('[pollHandler] Setting poll data for room:', data.widgetId);
    // Use setPollData to ensure proper initialization
    room.setPollData(data.pollData);
    
    // Don't clear votes when reactivating - preserve voting data during pause/resume
    // This allows teachers to pause polls temporarily without losing data
    
    // Emit harmonized events
    const roomId = data.widgetId ? `poll:${data.widgetId}` : 'poll';
    // Don't send votes in pollData - they belong in results
    const { votes, ...pollDataWithoutVotes } = room.pollData;
    
    console.log('[pollHandler] Broadcasting poll data to room:', `${session.code}:${roomId}`);
    io.to(`${session.code}:${roomId}`).emit('poll:dataUpdate', {
      pollData: pollDataWithoutVotes,
      results: room.getResults(),
      widgetId: data.widgetId
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
        // Don't send votes in pollData - they belong in results
        const { votes, ...pollDataWithoutVotes } = room.pollData;
        socket.emit('poll:dataUpdate', {
          pollData: pollDataWithoutVotes,
          results: room.getResults(),
          widgetId: widgetId
        });
        
        // Also emit the widget's active state
        socket.emit('session:widgetStateChanged', {
          roomType: 'poll',
          widgetId: widgetId,
          isActive: room.isActive
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
    if (!room.isActive) {
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
    console.log(`[pollHandler] Received session:poll:vote for session: ${sessionCode}, widget: ${widgetId}, option: ${optionIndex}`);
    const session = sessionManager.getSession(sessionCode || getCurrentSessionCode());
    
    if (!session) {
      console.log(`[pollHandler] Session not found: ${sessionCode}`);
      socket.emit('session:poll:voteConfirmed', { success: false, error: 'Session not found', widgetId });
      return;
    }
    
    const room = session.getRoom('poll', widgetId);
    if (!room || !(room instanceof PollRoom)) {
      console.log(`[pollHandler] Poll room not found for widget: ${widgetId}`);
      socket.emit('session:poll:voteConfirmed', { success: false, error: 'Poll not found', widgetId });
      return;
    }
    
    // Check if poll is active
    if (!room.isActive) {
      console.log(`[pollHandler] Poll is not active for widget: ${widgetId}`);
      socket.emit('session:poll:voteConfirmed', { success: false, error: 'Poll is not active', widgetId });
      return;
    }
    
    // Check if participant has already voted
    const participant = session.getParticipant(socket.id);
    if (!participant) {
      console.log(`[pollHandler] Participant not found: ${socket.id}`);
      socket.emit('session:poll:voteConfirmed', { success: false, error: 'Not a valid participant', widgetId });
      return;
    }
    
    // Record vote
    if (room.vote(socket.id, optionIndex)) {
      console.log(`[pollHandler] Vote recorded for participant: ${socket.id}`);
      socket.emit('session:poll:voteConfirmed', { success: true, widgetId });
      
      // Emit updated results to all in the room
      const pollRoomId = widgetId ? `poll:${widgetId}` : 'poll';
      const voteUpdateData = {
        votes: room.getVoteCounts(),
        totalVotes: room.getTotalVotes(),
        widgetId: widgetId
      };
      console.log(`[pollHandler] Emitting poll:voteUpdate to room ${session.code}:${pollRoomId} with data:`, voteUpdateData);
      io.to(`${session.code}:${pollRoomId}`).emit('poll:voteUpdate', voteUpdateData);
    } else {
      console.log(`[pollHandler] Participant already voted: ${socket.id}`);
      socket.emit('session:poll:voteConfirmed', { success: false, error: 'Already voted', widgetId });
    }
    
    session.updateActivity();
  });

  // Handle poll reset (clear all votes)

};