const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // Allow localhost on any port
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow specific production domains if needed
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
// Only serve static files if they exist
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../public')));
}

// Serve student interface from root
if (process.env.NODE_ENV === 'production') {
  // In production, serve the built React app from root
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
  
  // Serve static files for any path not starting with /api
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    // Try to serve the static file, fall back to index.html for client-side routing
    const filePath = path.join(__dirname, '../public', req.path);
    res.sendFile(filePath, (err) => {
      if (err) {
        res.sendFile(path.join(__dirname, '../public/index.html'));
      }
    });
  });
} else {
  // In development, proxy to Vite dev server
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    // Proxy all non-API requests to Vite dev server
    res.redirect('http://localhost:3002' + req.path);
  });
}

// Store active rooms/sessions
const rooms = new Map();

// Store active sessions (new session-based architecture)
const sessions = new Map();

// Safe characters for room codes (excluding confusing ones like 0/O, 1/I/l, V/U)
const SAFE_CHARACTERS = '23456789ACDEFHJKMNPQRTUWXY';

// Generate random 5-character room code
function generateRoomCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < 5; i++) {
      code += SAFE_CHARACTERS[Math.floor(Math.random() * SAFE_CHARACTERS.length)];
    }
  } while (rooms.has(code));
  return code;
}

// Room class to manage poll sessions
class PollRoom {
  constructor(code) {
    this.code = code;
    this.hostSocketId = null;
    this.participants = new Map();
    this.pollData = {
      question: '',
      options: [],
      votes: {},
      isActive: false
    };
    this.createdAt = Date.now();
  }

  setPollData(data) {
    // Only reset votes if options changed or if votes don't exist
    const shouldResetVotes = !this.pollData.votes || 
                           (data.options && JSON.stringify(data.options) !== JSON.stringify(this.pollData.options));
    
    this.pollData = {
      ...this.pollData,
      ...data
    };
    
    // Initialize or reset vote counts if needed
    if (shouldResetVotes) {
      this.pollData.votes = {};
      if (this.pollData.options) {
        this.pollData.options.forEach((_, index) => {
          this.pollData.votes[index] = 0;
        });
      }
    }
  }

  vote(participantId, optionIndex) {
    if (!this.pollData.isActive) return false;
    
    // Check if participant already voted
    const participant = this.participants.get(participantId);
    if (!participant || participant.hasVoted) return false;

    // Record vote
    if (this.pollData.votes[optionIndex] !== undefined) {
      this.pollData.votes[optionIndex]++;
      participant.hasVoted = true;
      participant.vote = optionIndex;
      return true;
    }
    return false;
  }

  getResults() {
    return {
      question: this.pollData.question,
      options: this.pollData.options,
      votes: this.pollData.votes || {},
      totalVotes: Object.values(this.pollData.votes || {}).reduce((a, b) => a + b, 0),
      participantCount: this.participants.size
    };
  }
  
  getVoteCounts() {
    return this.pollData.votes || {};
  }
  
  getTotalVotes() {
    return Object.values(this.pollData.votes || {}).reduce((a, b) => a + b, 0);
  }
}

// Room class to manage link share sessions
class LinkShareRoom {
  constructor(code) {
    this.code = code;
    this.hostSocketId = null;
    this.submissions = [];
    this.createdAt = Date.now();
    this.isActive = false; // Link sharing starts paused by default
  }

  addSubmission(studentName, link) {
    const submission = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      studentName,
      link,
      timestamp: Date.now()
    };
    this.submissions.push(submission);
    return submission;
  }

  deleteSubmission(submissionId) {
    const index = this.submissions.findIndex(s => s.id === submissionId);
    if (index > -1) {
      this.submissions.splice(index, 1);
      return true;
    }
    return false;
  }

  clearAllSubmissions() {
    this.submissions = [];
  }
}

// Room class to manage questions submissions
class QuestionsRoom {
  constructor(code) {
    this.code = code;
    this.hostSocketId = null;
    this.questions = [];
    this.createdAt = Date.now();
    this.isActive = true; // Questions start active by default
  }

  addQuestion(studentId, text, studentName) {
    const question = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      studentId,
      studentName: studentName || 'Anonymous',
      text,
      timestamp: Date.now(),
      answered: false
    };
    this.questions.push(question);
    return question;
  }

  markAnswered(questionId) {
    const question = this.questions.find(q => q.id === questionId);
    if (question) {
      question.answered = true;
      return true;
    }
    return false;
  }

  deleteQuestion(questionId) {
    const index = this.questions.findIndex(q => q.id === questionId);
    if (index > -1) {
      this.questions.splice(index, 1);
      return true;
    }
    return false;
  }

  clearAllQuestions() {
    this.questions = [];
  }

  getQuestions() {
    return this.questions;
  }
}

// Room class to manage understanding feedback sessions
class RTFeedbackRoom {
  constructor(code) {
    this.code = code;
    this.hostSocketId = null;
    this.participants = new Map();
    this.feedbackData = new Map(); // Map of studentId -> feedback value (1-5)
    this.createdAt = Date.now();
    this.isActive = false; // RTFeedback starts paused by default
  }

  updateFeedback(studentId, value) {
    this.feedbackData.set(studentId, {
      value: value,
      timestamp: Date.now()
    });
  }

  removeFeedback(studentId) {
    this.feedbackData.delete(studentId);
  }

  getAllFeedback() {
    const feedback = [];
    this.feedbackData.forEach((data, studentId) => {
      feedback.push({
        studentId,
        value: data.value,
        timestamp: data.timestamp
      });
    });
    return feedback;
  }
  
  getAggregatedFeedback() {
    // Count how many students are at each level (1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5)
    const understanding = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // 9 buckets for 0.5 increments
    let totalResponses = 0;
    
    this.feedbackData.forEach((data) => {
      const value = data.value;
      if (value >= 1 && value <= 5) {
        // Round to nearest 0.5: 1.2->1, 1.3->1.5, 1.7->1.5, 1.8->2, etc.
        const roundedValue = Math.round(value * 2) / 2;
        // Convert to index: 1->0, 1.5->1, 2->2, etc.
        const index = (roundedValue - 1) * 2;
        if (index >= 0 && index < 9) {
          understanding[index]++;
          totalResponses++;
        }
      }
    });
    
    return {
      understanding,
      totalResponses
    };
  }
}

// Session class to manage multiple room types under one code
class Session {
  constructor(code) {
    this.code = code;
    this.hostSocketId = null;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.activeRooms = new Map(); // roomType -> room instance
    this.participants = new Map(); // socketId -> { name, studentId, joinedAt }
  }

  updateActivity() {
    this.lastActivity = Date.now();
  }

  addParticipant(socketId, name, studentId) {
    this.participants.set(socketId, {
      name,
      studentId,
      joinedAt: Date.now(),
      socketId
    });
    this.updateActivity();
  }

  removeParticipant(socketId) {
    this.participants.delete(socketId);
    // Also remove from all active rooms
    this.activeRooms.forEach(room => {
      if (room.participants && room.participants.has) {
        room.participants.delete(socketId);
      }
    });
    this.updateActivity();
  }

  createRoom(roomType, widgetId) {
    // Create room identifier
    const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
    
    let room;
    switch (roomType) {
      case 'poll':
        room = new PollRoom(this.code);
        break;
      case 'linkShare':
        room = new LinkShareRoom(this.code);
        break;
      case 'rtfeedback':
        room = new RTFeedbackRoom(this.code);
        break;
      case 'questions':
        room = new QuestionsRoom(this.code);
        break;
      default:
        throw new Error(`Unknown room type: ${roomType}`);
    }
    
    room.hostSocketId = this.hostSocketId;
    room.widgetId = widgetId;
    this.activeRooms.set(roomId, room);
    this.updateActivity();
    return room;
  }

  getRoom(roomType, widgetId) {
    const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
    return this.activeRooms.get(roomId);
  }

  closeRoom(roomType, widgetId) {
    const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
    this.activeRooms.delete(roomId);
    this.updateActivity();
  }

  hasActiveRooms() {
    return this.activeRooms.size > 0;
  }

  getParticipantCount() {
    return this.participants.size;
  }

  getActiveRoomTypes() {
    return Array.from(this.activeRooms.keys());
  }
}

// Generate session code (same as room code generation)
function generateSessionCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < 5; i++) {
      code += SAFE_CHARACTERS[Math.floor(Math.random() * SAFE_CHARACTERS.length)];
    }
  } while (sessions.has(code) || rooms.has(code)); // Check both to avoid conflicts
  return code;
}

// REST API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Session Management APIs
app.post('/api/sessions/create', (req, res) => {
  const code = generateSessionCode();
  const session = new Session(code);
  sessions.set(code, session);
  
  res.json({ code, success: true });
});

// Check if session exists and get active rooms
app.get('/api/sessions/:code/exists', (req, res) => {
  const { code } = req.params;
  const session = sessions.get(code);
  
  if (session) {
    res.json({ 
      exists: true, 
      activeRooms: session.getActiveRoomTypes(),
      participantCount: session.getParticipantCount()
    });
  } else {
    res.json({ exists: false });
  }
});

// Create new room (called by widget)
app.post('/api/rooms/create', (req, res) => {
  const code = generateRoomCode();
  const room = new PollRoom(code);
  rooms.set(code, room);
  
  res.json({ code, success: true });
});

// Check if room exists and get type (called by students)
app.get('/api/rooms/:code/exists', (req, res) => {
  const { code } = req.params;
  const exists = rooms.has(code);
  const room = rooms.get(code);
  let roomType = null;
  
  if (room) {
    // DEBUG: Log detailed room info
    
    if (room instanceof PollRoom) {
      roomType = 'poll';
    } else if (room instanceof LinkShareRoom) {
      roomType = 'linkShare';
    } else if (room instanceof RTFeedbackRoom) {
      roomType = 'rtfeedback';
    }
  }
  
  // DEBUG: Log room existence check
  res.json({ exists, roomType });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  
  // Track which session this socket belongs to
  let currentSessionCode = null;

  // SESSION-BASED HANDLERS
  /**
   * SESSION-BASED ARCHITECTURE
   * 
   * The session architecture allows one code to support multiple widget types.
   * A session contains:
   * - One host (teacher)
   * - Multiple participants (students)  
   * - Multiple room types (poll, linkShare, rtfeedback)
   * 
   * Benefits:
   * - Students enter one code and can access all activities
   * - Teacher can run multiple widgets simultaneously
   * - Simplified student experience
   * 
   * Room naming convention:
   * - Session room: `session:${code}`
   * - Activity rooms: `${code}:${roomType}` (e.g., "ABC123:poll")
   */
  
  // Host creates or gets existing session
  socket.on('session:create', (data, callback) => {
    // Handle both old format (just callback) and new format (data + callback)
    if (typeof data === 'function') {
      callback = data;
      data = {};
    }
    
    const { existingCode } = data;
    
    // Check if host already has a session (by socket.id)
    let existingSession = null;
    for (const [code, session] of sessions) {
      if (session.hostSocketId === socket.id) {
        existingSession = session;
        break;
      }
    }
    
    // If no session found by socket.id but existingCode is provided,
    // check if that session exists and update its hostSocketId
    if (!existingSession && existingCode) {
      existingSession = sessions.get(existingCode);
      if (existingSession) {
        // Update the hostSocketId to the new socket.id
        existingSession.hostSocketId = socket.id;
      }
    }
    
    if (existingSession) {
      currentSessionCode = existingSession.code;
      // Make sure host is in the session room
      socket.join(`session:${existingSession.code}`);
      
      // Rejoin all room namespaces for this session
      for (const [roomId, room] of existingSession.activeRooms) {
        socket.join(`${existingSession.code}:${roomId}`);
      }
      
      callback({ success: true, code: existingSession.code, isExisting: true });
    } else {
      const code = generateSessionCode();
      const session = new Session(code);
      session.hostSocketId = socket.id;
      sessions.set(code, session);
      currentSessionCode = code;
      
      socket.join(`session:${code}`);
      callback({ success: true, code, isExisting: false });
    }
  });
  
  // Student joins session
  socket.on('session:join', (data) => {
    const { code, name, studentId } = data;
    const session = sessions.get(code);
    
    if (!session) {
      socket.emit('session:joined', { 
        success: false, 
        error: 'Session not found' 
      });
      return;
    }
    
    // Add participant to session
    session.addParticipant(socket.id, name, studentId || socket.id);
    currentSessionCode = code;
    
    // Join session room only - don't auto-join widget rooms
    socket.join(`session:${code}`);
    
    // Get active rooms but don't join them
    const activeRooms = session.getActiveRoomTypes();
    
    // Send active rooms with both roomType and widgetId
    const activeRoomsData = activeRooms.map(roomId => {
      const [roomType, widgetId] = roomId.includes(':') ? roomId.split(':') : [roomId, undefined];
      return { roomType, widgetId, roomId };
    });
    
    socket.emit('session:joined', {
      success: true,
      activeRooms: activeRoomsData,
      participantId: socket.id
    });
    
    // Notify host of participant count
    if (session.hostSocketId) {
      io.to(session.hostSocketId).emit('session:participantUpdate', {
        count: session.getParticipantCount(),
        participants: Array.from(session.participants.values())
      });
    }
    
  });
  
  // Host creates a room within session
  socket.on('session:createRoom', (data, callback) => {
    const { sessionCode, roomType, widgetId } = data;
    const session = sessions.get(sessionCode || currentSessionCode);
    
    if (!session || session.hostSocketId !== socket.id) {
      callback({ success: false, error: 'Invalid session or not host' });
      return;
    }
    
    // Create room identifier (use widgetId if provided, otherwise just roomType)
    const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
    
    // Check if room already exists
    if (session.getRoom(roomType, widgetId)) {
      // Make sure host is in the room namespace
      socket.join(`${session.code}:${roomId}`);
      callback({ success: true, isExisting: true });
      return;
    }
    
    // Create new room (pass base roomType to createRoom, not the composite roomId)
    const room = session.createRoom(roomType, widgetId);
    socket.join(`${session.code}:${roomId}`);
    
    // Prepare room data based on type
    let roomData = {};
    if (roomType === 'poll' && room instanceof PollRoom) {
      roomData = room.pollData;
    } else if (roomType === 'rtfeedback' && room instanceof RTFeedbackRoom) {
      roomData = { isActive: room.isActive };
    } else if (roomType === 'questions' && room instanceof QuestionsRoom) {
      roomData = { isActive: room.isActive };
    }
    
    // Notify all session participants about new room
    io.to(`session:${session.code}`).emit('session:roomCreated', {
      roomType,
      widgetId,
      roomId,
      roomData
    });
    
    callback({ success: true, isExisting: false });
  });
  
  // Host closes a room within session
  socket.on('session:closeRoom', (data) => {
    const { sessionCode, roomType, widgetId } = data;
    const session = sessions.get(sessionCode || currentSessionCode);
    
    if (!session || session.hostSocketId !== socket.id) {
      return;
    }
    
    // Create room identifier
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
    
  });
  
  // Join a specific room (for widget instances)
  socket.on('session:joinRoom', (data) => {
    const { sessionCode, roomType, widgetId } = data;
    console.log('[Server] session:joinRoom:', data, 'socketId:', socket.id);
    const session = sessions.get(sessionCode || currentSessionCode);
    
    if (!session) return;
    
    const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
    const roomNamespace = `${session.code}:${roomId}`;
    
    console.log('[Server] Joining namespace:', roomNamespace);
    socket.join(roomNamespace);
    
    // Send current room state to the joining student
    const room = session.getRoom(roomType, widgetId);
    if (room) {
      // Add participant to room if they're a session participant
      const participant = session.participants.get(socket.id);
      if (participant && room.participants && !room.participants.has(socket.id)) {
        room.participants.set(socket.id, {
          id: socket.id,
          name: participant.name,
          studentId: participant.studentId,
          joinedAt: Date.now()
        });
        
        // Notify host of participant count update
        const participantCount = room.participants.size;
        if (room.hostSocketId) {
          io.to(room.hostSocketId).emit('session:participantUpdate', {
            count: participantCount,
            roomType: roomType,
            widgetId: widgetId
          });
        }
      }
      
      // Handle different room types and send initial state
      if (roomType === 'linkShare' && room instanceof LinkShareRoom) {
        // Send link share room state
        socket.emit('linkShare:stateChanged', { 
          isActive: room.isActive,
          widgetId: data.widgetId
        });
      } else if (roomType === 'rtfeedback' && room instanceof RTFeedbackRoom) {
        // Send RT feedback room state
        socket.emit('rtfeedback:stateChanged', { 
          isActive: room.isActive,
          widgetId: data.widgetId
        });
      } else if (roomType === 'questions' && room instanceof QuestionsRoom) {
        // Send questions room state
        socket.emit('questions:stateChanged', { 
          isActive: room.isActive,
          widgetId: data.widgetId
        });
      } else if (roomType === 'poll' && room instanceof PollRoom) {
        // Send poll room state
        socket.emit('poll:stateChanged', { 
          isActive: room.pollData.isActive,
          widgetId: data.widgetId
        });
      }
    }
  });
  
  // Leave a specific room (for widget instances)
  socket.on('session:leaveRoom', (data) => {
    const { sessionCode, roomType, widgetId } = data;
    const session = sessions.get(sessionCode || currentSessionCode);
    
    if (!session) return;
    
    const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
    const roomNamespace = `${session.code}:${roomId}`;
    
    socket.leave(roomNamespace);
    
    // Remove participant from room
    const room = session.getRoom(roomType, widgetId);
    if (room && room.participants && room.participants.has(socket.id)) {
      room.participants.delete(socket.id);
      
      // Notify host of participant count update
      const participantCount = room.participants.size;
      if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('session:participantUpdate', {
          count: participantCount,
          roomType: roomType,
          widgetId: widgetId
        });
      }
    }
  });
  
  // SESSION-BASED ROOM HANDLERS
  
  // Poll handlers for sessions
  socket.on('session:poll:update', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session) return;
    
    // Create room identifier
    const roomId = data.widgetId ? `poll:${data.widgetId}` : 'poll';
    
    const room = session.getRoom('poll', data.widgetId);
    if (!room || !(room instanceof PollRoom)) return;
    
    // Check if poll is being restarted (was inactive, now active)
    const wasInactive = !room.pollData.isActive;
    const nowActive = data.pollData.isActive;
    
    if (wasInactive && nowActive) {
      // Clear all votes when poll is restarted
      room.participants.forEach((participant, id) => {
        participant.hasVoted = false;
      });
      // Reset vote counts
      if (data.pollData.options) {
        // Ensure votes object exists
        if (!data.pollData.votes) {
          data.pollData.votes = {};
        }
        data.pollData.options.forEach((_, index) => {
          data.pollData.votes[index] = 0;
        });
      }
    }
    
    // Use setPollData to ensure proper initialization
    room.setPollData(data.pollData);
    
    // Emit harmonized events instead of legacy poll:updated
    io.to(`${session.code}:${roomId}`).emit('poll:dataUpdate', {
      pollData: room.pollData,
      results: room.getResults()
    });
    
    // If state changed, emit state change event
    if (wasInactive !== nowActive) {
      io.to(`${session.code}:${roomId}`).emit('poll:stateChanged', { 
        isActive: data.pollData.isActive,
        widgetId: data.widgetId
      });
    }
    
    session.updateActivity();
  });
  
  // Handle poll state request from students
  socket.on('poll:requestState', (data) => {
    const { code } = data;
    const session = sessions.get(code);
    
    if (session) {
      const room = session.getRoom('poll', data.widgetId);
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

  // Handle questions state request from students
  socket.on('questions:requestState', (data) => {
    const { code } = data;
    const session = sessions.get(code);
    
    if (session) {
      const room = session.getRoom('questions', data.widgetId);
      if (room && room instanceof QuestionsRoom) {
        socket.emit('questions:stateChanged', { isActive: room.isActive });
        socket.emit('questions:list', room.getQuestions());
      }
    }
  });

  // Handle rtfeedback state request from students
  socket.on('rtfeedback:requestState', (data) => {
    const { code } = data;
    const session = sessions.get(code);
    
    if (session) {
      const room = session.getRoom('rtfeedback', data.widgetId);
      if (room && room instanceof RTFeedbackRoom) {
        socket.emit('rtfeedback:stateChanged', { isActive: room.isActive });
        socket.emit('rtfeedback:update', room.getAggregatedFeedback());
      }
    }
  });

  socket.on('session:poll:vote', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session) return;
    
    const room = session.getRoom('poll', data.widgetId);
    if (!room || !(room instanceof PollRoom)) return;
    
    const participant = session.participants.get(socket.id);
    if (!participant) {
      socket.emit('vote:confirmed', { success: false, error: 'Not a participant' });
      return;
    }
    
    // Add participant to room if not already there
    if (!room.participants.has(socket.id)) {
      room.participants.set(socket.id, {
        id: socket.id,
        name: participant.name,
        hasVoted: false,
        joinedAt: Date.now()
      });
    }
    
    // Check if already voted
    if (room.participants.get(socket.id)?.hasVoted) {
      socket.emit('vote:confirmed', { success: false, error: 'Already voted' });
      return;
    }
    
    // Record vote
    const voteSuccess = room.vote(socket.id, data.option);
    
    if (voteSuccess) {
      socket.emit('vote:confirmed', { success: true });
    } else {
      socket.emit('vote:confirmed', { success: false, error: 'Vote failed' });
      return;
    }
    
    // Notify all participants about vote update
    const pollRoomId = data.widgetId ? `poll:${data.widgetId}` : 'poll';
    io.to(`${session.code}:${pollRoomId}`).emit('poll:voteUpdate', {
      votes: room.getVoteCounts(),
      totalVotes: room.getTotalVotes()
    });
    
    session.updateActivity();
  });
  
  // Data Share handlers for sessions
  socket.on('session:linkShare:submit', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session) {
      socket.emit('session:linkShare:submitted', { success: false, error: 'Session not found' });
      return;
    }
    
    const room = session.getRoom('linkShare', data.widgetId);
    if (!room || !(room instanceof LinkShareRoom)) {
      socket.emit('session:linkShare:submitted', { success: false, error: 'Link share room not found' });
      return;
    }
    
    const participant = session.participants.get(socket.id);
    if (!participant) {
      socket.emit('session:linkShare:submitted', { success: false, error: 'Not joined to session' });
      return;
    }
    
    // Check if link sharing is active
    if (!room.isActive) {
      socket.emit('session:linkShare:submitted', { success: false, error: 'Link sharing is not currently active' });
      return;
    }
    
    // Update participant name if provided
    if (data.studentName && data.studentName !== participant.name) {
      participant.name = data.studentName;
    }
    
    const submission = room.addSubmission(data.studentName || participant.name, data.link);
    
    // Notify all in the room
    const linkShareRoomId = data.widgetId ? `linkShare:${data.widgetId}` : 'linkShare';
    io.to(`${session.code}:${linkShareRoomId}`).emit('linkShare:newSubmission', submission);
    
    // Send confirmation to submitter
    socket.emit('session:linkShare:submitted', { success: true });
    
    session.updateActivity();
  });
  
  socket.on('session:linkShare:delete', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session) {
      return;
    }
    
    if (session.hostSocketId !== socket.id) {
      return;
    }
    
    const room = session.getRoom('linkShare', data.widgetId);
    if (!room || !(room instanceof LinkShareRoom)) {
      return;
    }
    
    const deleted = room.deleteSubmission(data.submissionId);
    if (deleted) {
      const linkShareRoomId = data.widgetId ? `linkShare:${data.widgetId}` : 'linkShare';
      io.to(`${session.code}:${linkShareRoomId}`).emit('linkShare:submissionDeleted', { submissionId: data.submissionId });
    }
    
    session.updateActivity();
  });
  
  // Link Share start/stop handlers
  socket.on('session:linkShare:start', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('linkShare', data.widgetId);
    if (!room || !(room instanceof LinkShareRoom)) return;
    
    room.isActive = true;
    
    // Notify students that link sharing is active
    const linkShareRoomId = data.widgetId ? `linkShare:${data.widgetId}` : 'linkShare';
    io.to(`${session.code}:${linkShareRoomId}`).emit('linkShare:stateChanged', { 
      isActive: true,
      widgetId: data.widgetId
    });
    
    session.updateActivity();
  });
  
  socket.on('session:linkShare:stop', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('linkShare', data.widgetId);
    if (!room || !(room instanceof LinkShareRoom)) return;
    
    room.isActive = false;
    
    // Notify students that link sharing is paused
    const linkShareRoomId = data.widgetId ? `linkShare:${data.widgetId}` : 'linkShare';
    io.to(`${session.code}:${linkShareRoomId}`).emit('linkShare:stateChanged', { 
      isActive: false,
      widgetId: data.widgetId
    });
    
    session.updateActivity();
  });
  
  // RT Feedback handlers for sessions
  socket.on('session:rtfeedback:update', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session) {
      return;
    }
    
    const room = session.getRoom('rtfeedback', data.widgetId);
    if (!room || !(room instanceof RTFeedbackRoom)) {
      return;
    }
    
    const participant = session.participants.get(socket.id);
    if (!participant) {
      return;
    }
    
    // Debug: Log the received value
    
    // Only update if room is active
    if (!room.isActive) {
      return;
    }
    
    // Store the raw value (1-5) without rounding
    // The aggregation function will handle rounding to nearest 0.5
    const clampedValue = Math.max(1, Math.min(5, data.value));
    
    room.updateFeedback(socket.id, clampedValue);
    
    // Calculate aggregate feedback
    const feedbackData = room.getAggregatedFeedback();
    
    // Notify all in the room (including host)
    const rtfeedbackRoomId = data.widgetId ? `rtfeedback:${data.widgetId}` : 'rtfeedback';
    io.to(`${session.code}:${rtfeedbackRoomId}`).emit('rtfeedback:update', {
      ...feedbackData,
      widgetId: data.widgetId
    });
    
    session.updateActivity();
  });
  
  socket.on('session:rtfeedback:reset', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('rtfeedback', data.widgetId);
    if (!room || !(room instanceof RTFeedbackRoom)) return;
    
    // Clear all feedback data
    room.feedbackData.clear();
    
    // Send updated (empty) feedback to all participants
    const rtfeedbackRoomId = data.widgetId ? `rtfeedback:${data.widgetId}` : 'rtfeedback';
    io.to(`${session.code}:${rtfeedbackRoomId}`).emit('rtfeedback:update', {
      ...room.getAggregatedFeedback(),
      widgetId: data.widgetId
    });
    
    session.updateActivity();
  });
  
  socket.on('session:rtfeedback:start', (data) => {
    console.log('[Server] session:rtfeedback:start received:', data);
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session || session.hostSocketId !== socket.id) {
      console.log('[Server] BLOCKED - session not found or not host. session:', !!session, 'isHost:', session?.hostSocketId === socket.id);
      return;
    }
    
    const room = session.getRoom('rtfeedback', data.widgetId);
    if (!room || !(room instanceof RTFeedbackRoom)) {
      console.log('[Server] BLOCKED - room not found or wrong type. room:', !!room, 'type:', room?.constructor.name);
      return;
    }
    
    room.isActive = true;
    
    // Notify all participants that feedback is now active
    const rtfeedbackRoomId = data.widgetId ? `rtfeedback:${data.widgetId}` : 'rtfeedback';
    const roomNamespace = `${session.code}:${rtfeedbackRoomId}`;
    
    // Check who's in the room
    const socketsInRoom = io.sockets.adapter.rooms.get(roomNamespace);
    console.log('[Server] Sockets in room', roomNamespace, ':', socketsInRoom ? Array.from(socketsInRoom) : 'NONE');
    console.log('[Server] Current socket.id:', socket.id);
    
    console.log('[Server] Emitting rtfeedback:stateChanged to room:', roomNamespace);
    io.to(roomNamespace).emit('rtfeedback:stateChanged', { 
      isActive: true,
      widgetId: data.widgetId
    });
    
    session.updateActivity();
  });
  
  socket.on('session:rtfeedback:stop', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
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

  // Questions handlers for sessions
  socket.on('session:questions:submit', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session) return;
    
    const room = session.getRoom('questions', data.widgetId);
    if (!room || !(room instanceof QuestionsRoom)) return;
    
    const participant = session.participants.get(socket.id);
    if (!participant) return;
    
    // Only accept questions if room is active
    if (!room.isActive) {
      socket.emit('questions:error', { error: 'Questions are not being accepted' });
      return;
    }
    
    // Update participant name if provided
    if (data.studentName && data.studentName !== participant.name) {
      participant.name = data.studentName;
    }
    
    // Add the question
    const question = room.addQuestion(participant.studentId, data.text, data.studentName || participant.name);
    
    // Notify host about new question
    if (session.hostSocketId) {
      io.to(session.hostSocketId).emit('newQuestion', {
        questionId: question.id,
        text: question.text,
        studentId: participant.studentId,
        studentName: question.studentName
      });
    }
    
    socket.emit('questions:submitted', { success: true });
    session.updateActivity();
  });
  
  socket.on('session:questions:markAnswered', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('questions', data.widgetId);
    if (!room || !(room instanceof QuestionsRoom)) return;
    
    if (room.markAnswered(data.questionId)) {
      // Notify students that question was answered
      const questionsRoomId = data.widgetId ? `questions:${data.widgetId}` : 'questions';
      io.to(`${session.code}:${questionsRoomId}`).emit('questionAnswered', {
        roomCode: session.code,
        questionId: data.questionId
      });
    }
    
    session.updateActivity();
  });
  
  socket.on('session:questions:delete', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('questions', data.widgetId);
    if (!room || !(room instanceof QuestionsRoom)) return;
    
    if (room.deleteQuestion(data.questionId)) {
      // Notify students that question was deleted
      const questionsRoomId = data.widgetId ? `questions:${data.widgetId}` : 'questions';
      io.to(`${session.code}:${questionsRoomId}`).emit('questionDeleted', {
        roomCode: session.code,
        questionId: data.questionId
      });
    }
    
    session.updateActivity();
  });
  
  socket.on('session:questions:clearAll', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session || session.hostSocketId !== socket.id) return;
    
    const room = session.getRoom('questions', data.widgetId);
    if (!room || !(room instanceof QuestionsRoom)) return;
    
    room.clearAllQuestions();
    
    // Notify all participants
    const questionsRoomId = data.widgetId ? `questions:${data.widgetId}` : 'questions';
    io.to(`${session.code}:${questionsRoomId}`).emit('allQuestionsCleared', {
      roomCode: session.code
    });
    
    session.updateActivity();
  });
  
  socket.on('session:questions:start', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
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
    const session = sessions.get(data.sessionCode || currentSessionCode);
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

  // Poll start/stop handlers
  socket.on('session:poll:start', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
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
    const session = sessions.get(data.sessionCode || currentSessionCode);
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


  // Host joins room (widget)




  // Data Share handlers






  /**
   * HARMONIZED EVENT HANDLERS
   * These handlers implement the standardized event architecture
   * for all networked widgets (Poll, DataShare, RTFeedback)
   */

  // Handle disconnection
  socket.on('disconnect', () => {
    
    // Handle session disconnect
    if (currentSessionCode) {
      const session = sessions.get(currentSessionCode);
      if (session) {
        if (session.hostSocketId === socket.id) {
          // Keep session alive for reconnection
        } else {
          // Remove participant from session
          session.removeParticipant(socket.id);
          
          // Notify host of participant disconnect
          if (session.hostSocketId) {
            io.to(session.hostSocketId).emit('session:participantUpdate', {
              count: session.getParticipantCount(),
              participants: Array.from(session.participants.values())
            });
          }
          
          // Remove participant from all rooms they're in
          session.activeRooms.forEach((room, roomId) => {
            if (room.participants && room.participants.has(socket.id)) {
              room.participants.delete(socket.id);
              
              // Parse room type from roomId (format: "roomType" or "roomType:widgetId")
              const [roomType] = roomId.split(':');
              
              // Notify host of room participant count update
              if (room.hostSocketId) {
                const participantCount = room.participants.size;
                io.to(room.hostSocketId).emit('session:participantUpdate', {
                  count: participantCount,
                  roomType: roomType,
                  widgetId: room.widgetId
                });
              }
            }
          });
        }
      }
    }
    
    // Check if disconnected client was a host (legacy room support)
    rooms.forEach((room, code) => {
      if (room.hostSocketId === socket.id) {
        // Keep room alive for reconnection
      } else if (room.participants && room.participants.has(socket.id)) {
        room.participants.delete(socket.id);
        
        // For RT feedback rooms, also remove feedback data
        // Emit harmonized participant left events based on room type
        if (room.hostSocketId) {
          const participantCount = room.participants.size;
          
          if (room instanceof PollRoom) {
            io.to(room.hostSocketId).emit('poll:participantLeft', {
              studentId: socket.id
            });
            io.to(room.hostSocketId).emit('poll:participantCount', {
              count: participantCount
            });
            // Also emit generic participantUpdate for new client code
            io.to(room.hostSocketId).emit('session:participantUpdate', {
              count: participantCount,
              roomType: 'poll',
              widgetId: room.widgetId
            });
          } else if (room instanceof LinkShareRoom) {
            io.to(room.hostSocketId).emit('linkShare:participantLeft', {
              studentId: socket.id
            });
            io.to(room.hostSocketId).emit('linkShare:participantCount', {
              count: participantCount
            });
            // Also emit generic participantUpdate for new client code
            io.to(room.hostSocketId).emit('session:participantUpdate', {
              count: participantCount,
              roomType: 'linkShare',
              widgetId: room.widgetId
            });
          } else if (room instanceof RTFeedbackRoom) {
            room.removeFeedback(socket.id);
            io.to(room.hostSocketId).emit('rtfeedback:participantLeft', {
              studentId: socket.id
            });
            io.to(room.hostSocketId).emit('rtfeedback:participantCount', {
              count: participantCount
            });
            // Also emit generic participantUpdate for new client code
            io.to(room.hostSocketId).emit('session:participantUpdate', {
              count: participantCount,
              roomType: 'rtfeedback',
              widgetId: room.widgetId
            });
          }
        }
      }
    });
  });
});

// Clean up old rooms and sessions
setInterval(() => {
  const now = Date.now();
  const maxAge = 12 * 60 * 60 * 1000; // 12 hours
  const inactivityTimeout = 2 * 60 * 60 * 1000; // 2 hours of inactivity
  
  // Clean up old sessions
  sessions.forEach((session, code) => {
    // Remove if too old OR inactive with no participants
    if (now - session.createdAt > maxAge || 
        (now - session.lastActivity > inactivityTimeout && session.getParticipantCount() === 0)) {
      sessions.delete(code);
    }
  });
  
  // Clean up old rooms (legacy support)
  rooms.forEach((room, code) => {
    if (now - room.createdAt > maxAge) {
      rooms.delete(code);
    }
  });
}, 60 * 60 * 1000); // Check every hour

// Start server
const PORT = 3001; // Always use port 3001 for this server
server.listen(PORT, () => {
});  console.log(`Server running on port ${PORT}`);
