const { EVENTS, LIMITS } = require('../../config/constants');
const { validators } = require('../../utils/validation');
const { logger } = require('../../utils/logger');
const { createErrorResponse, createSuccessResponse, ERROR_CODES } = require('../../utils/errors');
const { clearHostDisconnectTimeout } = require('../socketManager');

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

          // Clear host disconnected state and cancel timeout
          if (existingSession.hostDisconnectedAt) {
            existingSession.hostDisconnectedAt = null;
            clearHostDisconnectTimeout(existingCode);
          }

          // Notify students that host has reconnected
          io.to(`session:${existingSession.code}`).emit(EVENTS.SESSION.HOST_RECONNECTED);
        }
      }
      
      if (existingSession) {
        // Rejoin session room
        socket.join(`session:${existingSession.code}`);
        
        // Rejoin all active widget rooms for the host
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
    console.log('[sessionHandler] Student joining session:', {
      code: data.code,
      name: data.name,
      studentId: data.studentId,
      socketId: socket.id
    });
    
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
        console.log('[sessionHandler] Session not found:', code);
        socket.emit('session:joined', { 
          success: false, 
          error: 'Session not found' 
        });
        return;
      }
      
      // Check session-level participant limit
      if (session.getParticipantCount() >= LIMITS.MAX_PARTICIPANTS_PER_SESSION) {
        socket.emit('session:joined', {
          success: false,
          error: 'SESSION_FULL',
          message: 'Session has reached maximum participants'
        });
        return;
      }
      
      // Add participant to session
      session.addParticipant(socket.id, name, studentId || socket.id);
      
      // Join session room
      socket.join(`session:${code}`);
      
      // Get active rooms data
      const activeRoomsData = session.getActiveRooms();
      console.log('[sessionHandler] Active rooms for session:', code, activeRoomsData.map(r => ({
        type: r.roomType,
        widgetId: r.widgetId,
        hasPollData: r.roomType === 'poll' ? !!r.room?.pollData?.question : 'N/A'
      })));
      
      // Join all active widget rooms
      activeRoomsData.forEach(roomData => {
        const roomId = roomData.widgetId ? `${roomData.roomType}:${roomData.widgetId}` : roomData.roomType;
        socket.join(`${code}:${roomId}`);
        console.log('[sessionHandler] Student joined room:', `${code}:${roomId}`);
      });
      
      console.log('[sessionHandler] Sending session:joined response with', activeRoomsData.length, 'active rooms');
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
  // RECOVERY DISABLED TEMPORARILY
  /*
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
  */
  
  // Host creates a room within session
  socket.on(EVENTS.SESSION.CREATE_ROOM, async (data, callback) => {
    try {
      const { sessionCode, roomType, widgetId } = data;
      console.log('[SessionHandler] CREATE_ROOM received:', { sessionCode, roomType, widgetId, socketId: socket.id });
      const actualSessionCode = sessionCode || getCurrentSessionCode();
      console.log('[SessionHandler] Looking up session:', actualSessionCode);
      const session = sessionManager.getSession(actualSessionCode);

      if (!session || !session.isHost(socket.id)) {
        console.log('[SessionHandler] CREATE_ROOM failed: session not found or not host', {
          sessionExists: !!session,
          isHost: session ? session.isHost(socket.id) : false,
          hostSocketId: session ? session.hostSocketId : null,
          requestingSocketId: socket.id
        });
        callback({ success: false, error: 'Session not found' });
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
      console.log('[SessionHandler] Creating new room:', { roomType, widgetId });
      const room = session.createRoom(roomType, widgetId);
      console.log('[SessionHandler] Room created successfully:', { roomType: room.getType(), widgetId: room.widgetId });
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
      const sessionRoomName = `session:${session.code}`;
      const socketsInRoom = io.sockets.adapter.rooms.get(sessionRoomName);
      console.log('[SessionHandler] Emitting session:roomCreated to:', sessionRoomName);
      console.log('[SessionHandler] Sockets in session room:', socketsInRoom ? Array.from(socketsInRoom) : 'none');
      console.log('[SessionHandler] Current socket ID:', socket.id);
      console.log('[SessionHandler] Is current socket in session room?', socketsInRoom?.has(socket.id));

      io.to(sessionRoomName).emit('session:roomCreated', {
        roomType,
        widgetId,
        roomData: room.toJSON()
      });
      console.log('[SessionHandler] Room creation complete, returning success');
      
      // Send initial state to all participants using the unified event
      io.to(`session:${session.code}`).emit(EVENTS.SESSION.WIDGET_STATE_CHANGED, {
        roomType,
        widgetId,
        isActive: room.isActive
      });
      
      // Return room data to the teacher
      console.log('[SessionHandler] Calling callback with success');
      if (typeof callback === 'function') {
        callback({
          success: true,
          isExisting: false,
          roomData: room.toJSON()
        });
        console.log('[SessionHandler] Callback called successfully');
      } else {
        console.error('[SessionHandler] callback is not a function:', typeof callback);
      }
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
    console.log('[SessionHandler] Received session:closeRoom:', data);
    try {
      const { sessionCode, roomType, widgetId } = data;
      const session = sessionManager.getSession(sessionCode || getCurrentSessionCode());
      
      if (!session || !session.isHost(socket.id)) {
        console.log('[SessionHandler] Cannot close room - invalid session or not host');
        return;
      }
      
      const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
      console.log('[SessionHandler] Closing room:', roomId);
      session.closeRoom(roomType, widgetId);
      
      console.log('[SessionHandler] Broadcasting room closed to all participants');
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
    console.log('[server] Received session:updateWidgetState:', data);
    try {
      const { sessionCode, roomType, widgetId, isActive } = data;
      console.log('[server] Getting session for code:', sessionCode);
      const session = sessionManager.getSession(sessionCode || getCurrentSessionCode());
      
      if (!session) {
        console.log('[server] updateWidgetState - No session found for code:', sessionCode);
        return;
      }
      
      if (session.hostSocketId !== socket.id) {
        console.log('[server] updateWidgetState - Not host:', {
          hostSocketId: session.hostSocketId,
          currentSocketId: socket.id
        });
        return;
      }
      
      console.log('[server] Session and host validated');
      
      const room = session.getRoom(roomType, widgetId);
      if (!room) {
        console.log('[server] updateWidgetState - Room not found:', { roomType, widgetId });
        return;
      }
      
      console.log('[server] Found room, updating state');
      
      // Update room state
      console.log('[server] Updating room isActive from', room.isActive, 'to', isActive);
      room.isActive = isActive;
      
      // Check what rooms this socket is in
      const socketRooms = Array.from(socket.rooms);
      console.log('[server] Current socket rooms:', socketRooms);
      
      const sessionRoom = `session:${session.code}`;
      
      // Ensure the host is in the session room
      if (!socket.rooms.has(sessionRoom)) {
        console.log('[server] Host socket not in session room, joining now');
        socket.join(sessionRoom);
      }
      
      console.log('[server] Broadcasting state change to session:', sessionRoom);
      
      // Check if anyone is in the session room
      const roomSockets = io.sockets.adapter.rooms.get(sessionRoom);
      console.log('[server] Sockets in session room:', roomSockets ? Array.from(roomSockets) : 'No room exists');
      
      // Broadcast unified state change to all participants
      const eventData = {
        roomType,
        widgetId,
        isActive
      };
      console.log('[server] Emitting WIDGET_STATE_CHANGED with data:', eventData);
      io.to(sessionRoom).emit(EVENTS.SESSION.WIDGET_STATE_CHANGED, eventData);
      
      console.log('[server] State change broadcast complete');
      
      session.updateActivity();
    } catch (error) {
      console.error('Error updating widget state:', error);
    }
  });
  
  // Unified reset handler for all widget types
  socket.on('session:reset', async (data) => {
    console.log('[server] Received session:reset:', data);
    try {
      const { sessionCode, widgetId } = data;
      const session = sessionManager.getSession(sessionCode || getCurrentSessionCode());
      
      if (!session || session.hostSocketId !== socket.id) {
        console.log('[server] Unauthorized reset attempt');
        return;
      }
      
      // Find the room by widgetId
      let room = null;
      let roomType = null;
      
      // Search through all active rooms to find the one with this widgetId
      for (const [roomKey, roomInstance] of session.activeRooms) {
        if (roomKey.includes(widgetId) || (roomInstance.widgetId === widgetId)) {
          room = roomInstance;
          roomType = roomInstance.getType();
          break;
        }
      }
      
      if (!room) {
        console.log('[server] Room not found for reset with widgetId:', widgetId);
        return;
      }
      
      // Call the room's reset method if it exists
      if (typeof room.reset === 'function') {
        console.log('[server] Calling reset on room:', roomType);
        room.reset();
        
        // Emit appropriate update event based on room type
        const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
        const roomNamespace = `${session.code}:${roomId}`;
        
        // Get the updated state after reset
        const updateData = room.getUpdateData ? room.getUpdateData() : {};
        updateData.widgetId = widgetId;
        
        // Emit room-specific update event
        // For poll, use voteUpdate, for others use update
        const eventName = roomType === 'poll' ? 'poll:voteUpdate' : `${roomType}:update`;
        io.to(roomNamespace).emit(eventName, updateData);
        
        console.log('[server] Reset complete, update emitted');
      } else {
        console.log('[server] Room type does not support reset:', roomType);
      }
      
      session.updateActivity();
    } catch (error) {
      console.error('Error handling reset:', error);
    }
  });

  // Handle orphaned room cleanup (host only)
  // Called after recovery to clean up rooms for widgets that no longer exist
  socket.on(EVENTS.SESSION.CLEANUP_ROOMS, async (data) => {
    logger.info('session:cleanupRooms', 'Received cleanup request', {
      sessionCode: data.sessionCode,
      activeWidgetIds: data.activeWidgetIds?.length
    });

    try {
      const { sessionCode, activeWidgetIds } = data;

      // Validate input
      const sessionValidation = validators.sessionCode(sessionCode);
      if (!sessionValidation.valid) {
        logger.warn('session:cleanupRooms', sessionValidation.error);
        return;
      }

      if (!Array.isArray(activeWidgetIds)) {
        logger.warn('session:cleanupRooms', 'activeWidgetIds must be an array');
        return;
      }

      const session = sessionManager.getSession(sessionCode || getCurrentSessionCode());

      if (!session || session.hostSocketId !== socket.id) {
        logger.warn('session:cleanupRooms', 'Unauthorized cleanup attempt');
        return;
      }

      // Find rooms to close (rooms not in activeWidgetIds list)
      const roomsToClose = [];
      session.activeRooms.forEach((room, roomKey) => {
        // Extract widgetId from room key or room instance
        const widgetId = room.widgetId || roomKey.split(':')[1];
        if (widgetId && !activeWidgetIds.includes(widgetId)) {
          roomsToClose.push({
            roomKey,
            widgetId,
            roomType: room.getType ? room.getType() : roomKey.split(':')[0]
          });
        }
      });

      // Close orphaned rooms
      for (const roomInfo of roomsToClose) {
        logger.info('session:cleanupRooms', 'Closing orphaned room', {
          widgetId: roomInfo.widgetId,
          roomType: roomInfo.roomType
        });

        session.closeRoom(roomInfo.roomType, roomInfo.widgetId);

        // Notify all participants
        io.to(`session:${session.code}`).emit('session:roomClosed', {
          roomType: roomInfo.roomType,
          widgetId: roomInfo.widgetId
        });

        // Clear the room namespace
        const roomNamespace = `${session.code}:${roomInfo.roomKey}`;
        const socketsInRoom = io.sockets.adapter.rooms.get(roomNamespace);
        if (socketsInRoom) {
          socketsInRoom.forEach(socketId => {
            const s = io.sockets.sockets.get(socketId);
            if (s) s.leave(roomNamespace);
          });
        }
      }

      logger.info('session:cleanupRooms', 'Cleanup complete', {
        closedRooms: roomsToClose.length
      });

      session.updateActivity();
    } catch (error) {
      logger.error('session:cleanupRooms', error);
    }
  });

};