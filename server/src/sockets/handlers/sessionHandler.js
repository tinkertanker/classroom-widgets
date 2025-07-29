const { EVENTS, LIMITS } = require('../../config/constants');

/**
 * Handle session-related socket events
 */
module.exports = function sessionHandler(io, socket, sessionManager, getCurrentSessionCode) {
  
  // Host creates or gets existing session
  socket.on(EVENTS.SESSION.CREATE, async (data, callback) => {
    try {
      // Handle both old format (just callback) and new format (data + callback)
      if (typeof data === 'function') {
        callback = data;
        data = {};
      }
      
      const { existingCode } = data;
      
      // Check if host already has a session
      let existingSession = sessionManager.findSessionByHost(socket.id);
      
      // If no session found by socket.id but existingCode provided, check that
      if (!existingSession && existingCode) {
        existingSession = sessionManager.getSession(existingCode);
        if (existingSession) {
          // Update the hostSocketId to the new socket.id
          existingSession.hostSocketId = socket.id;
        }
      }
      
      if (existingSession) {
        // Rejoin session
        socket.join(`session:${existingSession.code}`);
        
        // Rejoin all room namespaces
        existingSession.activeRooms.forEach((room, roomId) => {
          socket.join(`${existingSession.code}:${roomId}`);
        });
        
        callback({ 
          success: true, 
          code: existingSession.code, 
          isExisting: true,
          activeRooms: existingSession.getActiveRooms()
        });
      } else {
        // Create new session
        const session = sessionManager.createSession();
        session.hostSocketId = socket.id;
        
        socket.join(`session:${session.code}`);
        callback({ 
          success: true, 
          code: session.code, 
          isExisting: false 
        });
      }
    } catch (error) {
      console.error('Error creating session:', error);
      callback({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  // Student joins session
  socket.on(EVENTS.SESSION.JOIN, async (data) => {
    try {
      const { code, name, studentId } = data;
      
      if (!code || !name) {
        socket.emit('session:joined', { 
          success: false, 
          error: 'Code and name are required' 
        });
        return;
      }
      
      const session = sessionManager.getSession(code);
      
      if (!session) {
        socket.emit('session:joined', { 
          success: false, 
          error: 'Session not found' 
        });
        return;
      }
      
      // Check participant limit
      if (session.getParticipantCount() >= LIMITS.MAX_PARTICIPANTS_PER_ROOM) {
        socket.emit('session:joined', { 
          success: false, 
          error: 'Session is full' 
        });
        return;
      }
      
      // Add participant to session
      session.addParticipant(socket.id, name, studentId || socket.id);
      
      // Join session room
      socket.join(`session:${code}`);
      
      // Get active rooms data
      const activeRoomsData = session.getActiveRooms();
      
      socket.emit('session:joined', {
        success: true,
        activeRooms: activeRoomsData,
        participantId: socket.id
      });
      
      // Notify host of participant count
      if (session.hostSocketId) {
        io.to(session.hostSocketId).emit(EVENTS.SESSION.PARTICIPANT_UPDATE, {
          count: session.getParticipantCount(),
          participants: session.getParticipants()
        });
      }
    } catch (error) {
      console.error('Error joining session:', error);
      socket.emit('session:joined', { 
        success: false, 
        error: 'Failed to join session' 
      });
    }
  });
  
  // Host creates a room within session
  socket.on(EVENTS.SESSION.CREATE_ROOM, async (data, callback) => {
    try {
      const { sessionCode, roomType, widgetId } = data;
      const session = sessionManager.getSession(sessionCode || getCurrentSessionCode());
      
      if (!session || !session.isHost(socket.id)) {
        callback({ success: false, error: 'Invalid session or not host' });
        return;
      }
      
      // Check room limit
      if (session.activeRooms.size >= LIMITS.MAX_ROOMS_PER_SESSION) {
        callback({ success: false, error: 'Maximum rooms limit reached' });
        return;
      }
      
      // Check if room already exists
      const existingRoom = session.getRoom(roomType, widgetId);
      if (existingRoom) {
        // Rejoin the room
        const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
        socket.join(`${session.code}:${roomId}`);
        callback({ success: true, isExisting: true });
        return;
      }
      
      // Create new room
      const room = session.createRoom(roomType, widgetId);
      const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
      socket.join(`${session.code}:${roomId}`);
      
      // Notify all session participants about new room
      io.to(`session:${session.code}`).emit('session:roomCreated', {
        roomType,
        widgetId,
        roomId,
        roomData: room.toJSON()
      });
      
      callback({ success: true, isExisting: false });
    } catch (error) {
      console.error('Error creating room:', error);
      callback({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  // Host closes a room within session
  socket.on(EVENTS.SESSION.CLOSE_ROOM, async (data) => {
    try {
      const { sessionCode, roomType, widgetId } = data;
      const session = sessionManager.getSession(sessionCode || getCurrentSessionCode());
      
      if (!session || !session.isHost(socket.id)) {
        return;
      }
      
      const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
      session.closeRoom(roomType, widgetId);
      
      // Notify all participants
      io.to(`session:${session.code}`).emit('session:roomClosed', { 
        roomType, 
        widgetId,
        roomId 
      });
      
      // Clear the room namespace
      const roomNamespace = `${session.code}:${roomId}`;
      const socketsInRoom = io.sockets.adapter.rooms.get(roomNamespace);
      if (socketsInRoom) {
        socketsInRoom.forEach(socketId => {
          const s = io.sockets.sockets.get(socketId);
          if (s) s.leave(roomNamespace);
        });
      }
    } catch (error) {
      console.error('Error closing room:', error);
    }
  });
  
  // Join a specific room
  socket.on(EVENTS.SESSION.JOIN_ROOM, async (data) => {
    try {
      const { sessionCode, roomType, widgetId } = data;
      const session = sessionManager.getSession(sessionCode || getCurrentSessionCode());
      
      if (!session) return;
      
      const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
      const roomNamespace = `${session.code}:${roomId}`;
      
      socket.join(roomNamespace);
      
      // Send current room state to the joining student
      const room = session.getRoom(roomType, widgetId);
      if (room) {
        // Add participant to room if they're a session participant
        const participant = session.getParticipant(socket.id);
        if (participant) {
          room.addParticipant(socket.id, {
            name: participant.name,
            studentId: participant.studentId
          });
          
          // Notify host of participant count update
          if (room.hostSocketId) {
            io.to(room.hostSocketId).emit(EVENTS.SESSION.PARTICIPANT_UPDATE, {
              count: room.getParticipantCount(),
              roomType: roomType,
              widgetId: widgetId
            });
          }
        }
        
        // Send room-specific initial state
        socket.emit(`${roomType}:roomJoined`, {
          roomData: room.toJSON(),
          isActive: room.isActive
        });
      }
    } catch (error) {
      console.error('Error joining room:', error);
    }
  });
  
  // Leave a specific room
  socket.on(EVENTS.SESSION.LEAVE_ROOM, async (data) => {
    try {
      const { sessionCode, roomType, widgetId } = data;
      const session = sessionManager.getSession(sessionCode || getCurrentSessionCode());
      
      if (!session) return;
      
      const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
      const roomNamespace = `${session.code}:${roomId}`;
      
      socket.leave(roomNamespace);
      
      // Remove participant from room
      const room = session.getRoom(roomType, widgetId);
      if (room) {
        room.removeParticipant(socket.id);
        
        // Notify host of participant count update
        if (room.hostSocketId) {
          io.to(room.hostSocketId).emit(EVENTS.SESSION.PARTICIPANT_UPDATE, {
            count: room.getParticipantCount(),
            roomType: roomType,
            widgetId: widgetId
          });
        }
      }
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });
};