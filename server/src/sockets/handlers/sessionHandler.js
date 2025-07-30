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
          // Notify students that host has reconnected
          io.to(`session:${existingSession.code}`).emit(EVENTS.SESSION.HOST_RECONNECTED);
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
      
      // Join all active widget rooms
      activeRoomsData.forEach(roomData => {
        const roomId = roomData.widgetId ? `${roomData.roomType}:${roomData.widgetId}` : roomData.roomType;
        socket.join(`${code}:${roomId}`);
      });
      
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
  
  // Host recovers a session after disconnect/reload
  socket.on('session:recover', async (data, callback) => {
    try {
      const { sessionCode } = data;
      const session = sessionManager.getSession(sessionCode);
      
      if (!session) {
        console.log('[SessionRecovery] Session not found:', sessionCode);
        callback({ success: false, error: 'Session not found' });
        return;
      }
      
      // For recovery after page reload
      // The old socket might still appear connected briefly
      const oldHostId = session.hostSocketId;
      
      // Log the recovery attempt
      console.log('[SessionRecovery] Recovery attempt:', {
        sessionCode,
        oldHostId,
        newSocketId: socket.id,
        isSameSocket: oldHostId === socket.id
      });
      
      // Update the host socket ID to the new one
      session.hostSocketId = socket.id;
      
      // Join session room
      socket.join(`session:${session.code}`);
      
      // Get active rooms data
      const activeRoomsData = session.getActiveRooms();
      
      // Join all active room channels
      activeRoomsData.forEach(roomData => {
        const roomId = roomData.widgetId ? `${roomData.roomType}:${roomData.widgetId}` : roomData.roomType;
        socket.join(`${session.code}:${roomId}`);
      });
      
      callback({ 
        success: true,
        sessionCode: session.code,
        rooms: activeRoomsData
      });
      
      // Emit recovery event
      socket.emit('session:recovered', {
        sessionCode: session.code,
        rooms: activeRoomsData
      });
      
      console.log(`[SessionRecovery] Host recovered session ${session.code} (old socket: ${oldHostId}, new socket: ${socket.id})`);
    } catch (error) {
      console.error('Error recovering session:', error);
      callback({ success: false, error: error.message || 'Failed to recover session' });
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
        callback({ 
          success: true, 
          isExisting: true,
          roomData: existingRoom.toJSON()
        });
        return;
      }
      
      // Create new room
      const room = session.createRoom(roomType, widgetId);
      const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
      socket.join(`${session.code}:${roomId}`);
      
      // Make all session participants join the widget room
      const socketIds = [];
      io.sockets.adapter.rooms.get(`session:${session.code}`)?.forEach(socketId => {
        socketIds.push(socketId);
      });
      
      socketIds.forEach(socketId => {
        const participantSocket = io.sockets.sockets.get(socketId);
        if (participantSocket) {
          participantSocket.join(`${session.code}:${roomId}`);
        }
      });
      
      // Notify all session participants about new room
      io.to(`session:${session.code}`).emit('session:roomCreated', {
        roomType,
        widgetId,
        roomData: room.toJSON()
      });
      
      // Send initial state to all participants
      const roomNamespace = `${session.code}:${roomId}`;
      io.to(roomNamespace).emit(`${roomType}:stateChanged`, {
        isActive: room.isActive,
        widgetId
      });
      
      // Return room data to the teacher
      callback({ 
        success: true, 
        isExisting: false,
        roomData: room.toJSON()
      });
    } catch (error) {
      console.error('Error creating room:', error);
      callback({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  // Host closes entire session
  socket.on(EVENTS.SESSION.CLOSE, async (data) => {
    try {
      const { sessionCode } = data;
      const session = sessionManager.getSession(sessionCode || getCurrentSessionCode());
      
      if (!session || !session.isHost(socket.id)) {
        return;
      }
      
      // Notify all participants that session is closing
      io.to(`session:${session.code}`).emit('session:closed');
      
      // Remove all participants from session rooms
      session.activeRooms.forEach((room, roomId) => {
        const roomNamespace = `${session.code}:${roomId}`;
        const socketsInRoom = io.sockets.adapter.rooms.get(roomNamespace);
        if (socketsInRoom) {
          socketsInRoom.forEach(socketId => {
            const s = io.sockets.sockets.get(socketId);
            if (s) s.leave(roomNamespace);
          });
        }
      });
      
      // Remove all participants from session
      const sessionNamespace = `session:${session.code}`;
      const socketsInSession = io.sockets.adapter.rooms.get(sessionNamespace);
      if (socketsInSession) {
        socketsInSession.forEach(socketId => {
          const s = io.sockets.sockets.get(socketId);
          if (s) s.leave(sessionNamespace);
        });
      }
      
      // Delete the session
      sessionManager.deleteSession(session.code);
    } catch (error) {
      console.error('Error closing session:', error);
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
        widgetId
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
  
  // Unified widget state update handler
  socket.on(EVENTS.SESSION.UPDATE_WIDGET_STATE, async (data) => {
    try {
      const { sessionCode, roomType, widgetId, isActive } = data;
      const session = sessionManager.getSession(sessionCode || getCurrentSessionCode());
      
      if (!session || session.hostSocketId !== socket.id) {
        return;
      }
      
      const room = session.getRoom(roomType, widgetId);
      if (!room) {
        return;
      }
      
      // Update room state
      if (roomType === 'poll' && room.pollData) {
        room.pollData.isActive = isActive;
      } else {
        room.isActive = isActive;
      }
      
      // Broadcast unified state change to all participants
      io.to(`session:${session.code}`).emit(EVENTS.SESSION.WIDGET_STATE_CHANGED, {
        roomType,
        widgetId,
        isActive
      });
      
      // Also emit widget-specific event for backward compatibility
      const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
      io.to(`${session.code}:${roomId}`).emit(`${roomType}:stateChanged`, {
        isActive,
        widgetId
      });
      
      session.updateActivity();
    } catch (error) {
      console.error('Error updating widget state:', error);
    }
  });
  
};