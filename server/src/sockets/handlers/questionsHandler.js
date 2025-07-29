const { EVENTS, LIMITS } = require('../../config/constants');
const QuestionsRoom = require('../../models/QuestionsRoom');

/**
 * Handle questions related socket events
 */
module.exports = function questionsHandler(io, socket, sessionManager, getCurrentSessionCode) {
  
  // Student submits a question
  socket.on('session:questions:submit', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session) {
      socket.emit('session:questions:submitted', { success: false, error: 'Session not found' });
      return;
    }
    
    const room = session.getRoom('questions', data.widgetId);
    if (!room || !(room instanceof QuestionsRoom)) {
      socket.emit('session:questions:submitted', { success: false, error: 'Questions room not found' });
      return;
    }
    
    // Check if questions are being accepted
    if (!room.isActive) {
      socket.emit('session:questions:submitted', { success: false, error: 'Not accepting questions at this time' });
      return;
    }
    
    const participant = session.participants.get(socket.id);
    if (!participant) {
      socket.emit('session:questions:submitted', { success: false, error: 'Not a valid participant' });
      return;
    }
    
    // Add the question
    const question = room.addQuestion(
      socket.id,
      data.question, 
      data.studentName || participant.name
    );
    
    // Send confirmation to student
    socket.emit('session:questions:submitted', { 
      success: true, 
      questionId: question.id 
    });
    
    // Notify all in the room
    const questionsRoomId = data.widgetId ? `questions:${data.widgetId}` : 'questions';
    io.to(`${session.code}:${questionsRoomId}`).emit(EVENTS.QUESTIONS.NEW_QUESTION, {
      id: question.id,
      questionId: question.id,  // Keep for compatibility
      text: question.text,
      studentId: question.studentId,
      studentName: question.studentName,
      timestamp: question.timestamp,
      answered: question.answered,
      widgetId: data.widgetId
    });
    
    session.updateActivity();
  });

  // Host marks question as answered
  socket.on('session:questions:markAnswered', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('questions', data.widgetId);
    if (!room || !(room instanceof QuestionsRoom)) return;
    
    if (room.markAnswered(data.questionId)) {
      const questionsRoomId = data.widgetId ? `questions:${data.widgetId}` : 'questions';
      io.to(`${session.code}:${questionsRoomId}`).emit('questions:questionAnswered', { 
        questionId: data.questionId 
      });
    }
    
    session.updateActivity();
  });

  // Host deletes a question
  socket.on('session:questions:delete', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('questions', data.widgetId);
    if (!room || !(room instanceof QuestionsRoom)) return;
    
    if (room.deleteQuestion(data.questionId)) {
      const questionsRoomId = data.widgetId ? `questions:${data.widgetId}` : 'questions';
      io.to(`${session.code}:${questionsRoomId}`).emit('questions:questionDeleted', { 
        questionId: data.questionId 
      });
    }
    
    session.updateActivity();
  });

  // Host clears all questions
  socket.on('session:questions:clearAll', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('questions', data.widgetId);
    if (!room || !(room instanceof QuestionsRoom)) return;
    
    room.clearAllQuestions();
    
    const questionsRoomId = data.widgetId ? `questions:${data.widgetId}` : 'questions';
    io.to(`${session.code}:${questionsRoomId}`).emit('questions:allQuestionsCleared');
    
    session.updateActivity();
  });

  // Student requests questions state (on join/refresh)
  socket.on('questions:requestState', (data) => {
    const { code, widgetId } = data;
    const session = sessionManager.getSession(code);
    
    if (session) {
      const room = session.getRoom('questions', widgetId);
      if (room && room instanceof QuestionsRoom) {
        socket.emit(EVENTS.QUESTIONS.STATE_CHANGED, { 
          isActive: room.isActive,
          widgetId: data.widgetId
        });
        
        // Also send the current questions list
        socket.emit('questions:list', {
          questions: room.getQuestions(),
          widgetId: data.widgetId
        });
      }
    }
  });

  // Questions start/stop handlers
  socket.on('session:questions:start', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('questions', data.widgetId);
    if (!room || !(room instanceof QuestionsRoom)) return;
    
    room.isActive = true;
    
    // Notify all participants
    const questionsRoomId = data.widgetId ? `questions:${data.widgetId}` : 'questions';
    io.to(`${session.code}:${questionsRoomId}`).emit('questions:stateChanged', { 
      isActive: true,
      widgetId: data.widgetId
    });
    
    session.updateActivity();
  });
  
  socket.on('session:questions:stop', (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('questions', data.widgetId);
    if (!room || !(room instanceof QuestionsRoom)) return;
    
    room.isActive = false;
    
    // Notify all participants
    const questionsRoomId = data.widgetId ? `questions:${data.widgetId}` : 'questions';
    io.to(`${session.code}:${questionsRoomId}`).emit('questions:stateChanged', { 
      isActive: false,
      widgetId: data.widgetId
    });
    
    session.updateActivity();
  });

  // Student requests questions state (on join/refresh)
  socket.on('questions:requestState', (data) => {
    const { sessionCode, widgetId } = data;
    const session = sessionManager.getSession(sessionCode);
    
    if (session) {
      const room = session.getRoom('questions', widgetId);
      if (room && room instanceof QuestionsRoom) {
        socket.emit('questions:stateChanged', { 
          isActive: room.isActive,
          widgetId: widgetId
        });
        socket.emit('questions:list', room.getQuestions());
      }
    }
  });

  // Handle legacy questions events (backward compatibility)
  socket.on('questions:create', (data, callback) => {
    console.log('[Legacy] Questions create event - redirecting to session-based approach');
    
    // Create a legacy session for backward compatibility
    let session = sessionManager.findSessionByHost(socket.id);
    if (!session) {
      session = sessionManager.createSession();
      session.hostSocketId = socket.id;
    }
    
    // Create questions room
    const room = session.createRoom('questions', null);
    socket.join(`${session.code}:questions`);
    
    callback({ success: true, code: session.code });
  });

  socket.on('questions:submit', (data) => {
    console.log('[Legacy] Questions submit event');
    
    const room = sessionManager.rooms.get(data.code);
    if (!room || !(room instanceof QuestionsRoom)) {
      socket.emit('questions:submitted', { success: false, error: 'Room not found' });
      return;
    }
    
    if (!room.participants.has(socket.id)) {
      socket.emit('questions:submitted', { success: false, error: 'Not in room' });
      return;
    }
    
    const participant = room.participants.get(socket.id);
    const question = room.addQuestion(
      socket.id,
      data.question,
      data.studentName || participant.name
    );
    
    socket.emit('questions:submitted', { 
      success: true, 
      questionId: question.id 
    });
    
    io.to(`room:${data.code}`).emit('questions:new', {
      questionId: question.id,
      text: question.text,
      studentId: question.studentId,
      studentName: question.studentName
    });
  });
};