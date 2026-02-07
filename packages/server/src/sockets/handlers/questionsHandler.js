const { EVENTS, LIMITS } = require('../../config/constants');
const QuestionsRoom = require('../../models/QuestionsRoom');
const { validators } = require('../../utils/validation');
const { logger } = require('../../utils/logger');
const { createErrorResponse, createSuccessResponse, createRateLimitResponse, ERROR_CODES } = require('../../utils/errors');
const { eventRateLimiter } = require('../../middleware/socketAuth');

/**
 * Handle questions related socket events
 */
module.exports = function questionsHandler(io, socket, sessionManager, getCurrentSessionCode) {

  // Student submits a question
  socket.on(EVENTS.QUESTIONS.SUBMIT, (data) => {
    // Check rate limit
    const rateLimitResult = eventRateLimiter(socket, EVENTS.QUESTIONS.SUBMIT);
    if (!rateLimitResult.allowed) {
      socket.emit(EVENTS.QUESTIONS.SUBMITTED, createRateLimitResponse(rateLimitResult.retryAfter));
      return;
    }

    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session) {
      socket.emit(EVENTS.QUESTIONS.SUBMITTED, createErrorResponse('INVALID_SESSION'));
      return;
    }

    // Validate widget ID
    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      socket.emit(EVENTS.QUESTIONS.SUBMITTED, createErrorResponse('INVALID_INPUT', widgetValidation.error));
      return;
    }

    const room = session.getRoom('questions', data.widgetId);
    if (!room || !(room instanceof QuestionsRoom)) {
      socket.emit(EVENTS.QUESTIONS.SUBMITTED, createErrorResponse('ROOM_NOT_FOUND'));
      return;
    }

    // Check if questions are being accepted
    if (!room.isActive) {
      socket.emit(EVENTS.QUESTIONS.SUBMITTED, createErrorResponse('WIDGET_PAUSED'));
      return;
    }

    // Validate question text
    const questionValidation = validators.question(data.question);
    if (!questionValidation.valid) {
      socket.emit(EVENTS.QUESTIONS.SUBMITTED, createErrorResponse('INVALID_INPUT', questionValidation.error));
      return;
    }

    const participant = session.participants.get(socket.id);
    if (!participant) {
      socket.emit(EVENTS.QUESTIONS.SUBMITTED, createErrorResponse('NOT_PARTICIPANT'));
      return;
    }

    // Validate student name if provided
    const studentName = data.studentName || participant.name;
    if (data.studentName) {
      const nameValidation = validators.studentName(data.studentName);
      if (!nameValidation.valid) {
        socket.emit(EVENTS.QUESTIONS.SUBMITTED, createErrorResponse('INVALID_INPUT', nameValidation.error));
        return;
      }
    }

    // Add the question
    const question = room.addQuestion(
      socket.id,
      data.question,
      studentName
    );

    // Send confirmation to student
    socket.emit(EVENTS.QUESTIONS.SUBMITTED, createSuccessResponse({ questionId: question.id }));

    // Notify all in the room
    const questionsRoomId = data.widgetId ? `questions:${data.widgetId}` : 'questions';
    const questionData = {
      id: question.id,
      text: question.text,
      studentId: question.studentId,
      studentName: question.studentName,
      timestamp: question.timestamp,
      answered: question.answered,
      widgetId: data.widgetId
    };

    io.to(`${session.code}:${questionsRoomId}`).emit(EVENTS.QUESTIONS.QUESTION_ADDED, questionData);

    session.updateActivity();
  });

  // Host marks question as answered
  socket.on(EVENTS.QUESTIONS.MARK_ANSWERED, (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) {
      logger.warn('questions:markAnswered', 'Unauthorized attempt');
      return;
    }

    // Validate widget ID
    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      logger.warn('questions:markAnswered', widgetValidation.error);
      return;
    }

    const room = session.getRoom('questions', data.widgetId);
    if (!room || !(room instanceof QuestionsRoom)) {
      logger.warn('questions:markAnswered', 'Room not found', { widgetId: data.widgetId });
      return;
    }

    if (room.markAnswered(data.questionId)) {
      const questionsRoomId = data.widgetId ? `questions:${data.widgetId}` : 'questions';
      io.to(`${session.code}:${questionsRoomId}`).emit(EVENTS.QUESTIONS.QUESTION_ANSWERED, {
        questionId: data.questionId,
        widgetId: data.widgetId
      });
    }

    session.updateActivity();
  });

  // Host deletes a question
  socket.on(EVENTS.QUESTIONS.DELETE, (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) {
      logger.warn('questions:delete', 'Unauthorized attempt');
      return;
    }

    // Validate widget ID
    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      logger.warn('questions:delete', widgetValidation.error);
      return;
    }

    const room = session.getRoom('questions', data.widgetId);
    if (!room || !(room instanceof QuestionsRoom)) {
      logger.warn('questions:delete', 'Room not found', { widgetId: data.widgetId });
      return;
    }

    if (room.deleteQuestion(data.questionId)) {
      const questionsRoomId = data.widgetId ? `questions:${data.widgetId}` : 'questions';
      io.to(`${session.code}:${questionsRoomId}`).emit(EVENTS.QUESTIONS.QUESTION_DELETED, {
        questionId: data.questionId,
        widgetId: data.widgetId
      });
    }

    session.updateActivity();
  });

  // Host clears all questions
  socket.on(EVENTS.QUESTIONS.CLEAR_ALL, (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) {
      logger.warn('questions:clearAll', 'Unauthorized attempt');
      return;
    }

    // Validate widget ID
    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      logger.warn('questions:clearAll', widgetValidation.error);
      return;
    }

    const room = session.getRoom('questions', data.widgetId);
    if (!room || !(room instanceof QuestionsRoom)) {
      logger.warn('questions:clearAll', 'Room not found', { widgetId: data.widgetId });
      return;
    }

    room.clearAllQuestions();

    const questionsRoomId = data.widgetId ? `questions:${data.widgetId}` : 'questions';
    io.to(`${session.code}:${questionsRoomId}`).emit(EVENTS.QUESTIONS.ALL_CLEARED, {
      widgetId: data.widgetId
    });

    session.updateActivity();
  });

  // Student requests questions state (on join/refresh)
  socket.on(EVENTS.QUESTIONS.REQUEST_STATE, (data) => {
    const { sessionCode, widgetId } = data;

    // Validate input
    const sessionValidation = validators.sessionCode(sessionCode);
    if (!sessionValidation.valid) {
      logger.warn('questions:requestState', sessionValidation.error);
      return;
    }

    const widgetValidation = validators.widgetId(widgetId);
    if (!widgetValidation.valid) {
      logger.warn('questions:requestState', widgetValidation.error);
      return;
    }

    const session = sessionManager.getSession(sessionCode);

    if (session) {
      const room = session.getRoom('questions', widgetId);
      if (room && room instanceof QuestionsRoom) {
        socket.emit(EVENTS.QUESTIONS.STATE_UPDATE, {
          isActive: room.isActive,
          questions: room.getQuestions(),
          widgetId: widgetId
        });
      }
    }
  });

};
