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
    this.pollData = {
      ...this.pollData,
      ...data,
      votes: {}
    };
    // Initialize vote counts
    if (data.options) {
      data.options.forEach((option, index) => {
        this.pollData.votes[index] = 0;
      });
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
      votes: this.pollData.votes,
      totalVotes: Object.values(this.pollData.votes).reduce((a, b) => a + b, 0),
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

// Room class to manage data share sessions
class DataShareRoom {
  constructor(code) {
    this.code = code;
    this.hostSocketId = null;
    this.submissions = [];
    this.createdAt = Date.now();
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

// Room class to manage understanding feedback sessions
class RTFeedbackRoom {
  constructor(code) {
    this.code = code;
    this.hostSocketId = null;
    this.participants = new Map();
    this.feedbackData = new Map(); // Map of studentId -> feedback value (1-5)
    this.createdAt = Date.now();
    this.isActive = false; // Start inactive until teacher starts it
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
    // Count how many students are at each level (1-5)
    const understanding = [0, 0, 0, 0, 0];
    let totalResponses = 0;
    
    this.feedbackData.forEach((data) => {
      const value = data.value;
      if (value >= 1 && value <= 5) {
        understanding[value - 1]++;
        totalResponses++;
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

  createRoom(roomType) {
    let room;
    switch (roomType) {
      case 'poll':
        room = new PollRoom(this.code);
        break;
      case 'dataShare':
        room = new DataShareRoom(this.code);
        break;
      case 'rtfeedback':
        room = new RTFeedbackRoom(this.code);
        break;
      default:
        throw new Error(`Unknown room type: ${roomType}`);
    }
    
    room.hostSocketId = this.hostSocketId;
    this.activeRooms.set(roomType, room);
    this.updateActivity();
    return room;
  }

  getRoom(roomType) {
    return this.activeRooms.get(roomType);
  }

  closeRoom(roomType) {
    this.activeRooms.delete(roomType);
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
    console.log(`API: Room object found:`, room);
    console.log(`API: Room constructor name:`, room.constructor.name);
    console.log(`API: Is PollRoom?`, room instanceof PollRoom);
    console.log(`API: Is DataShareRoom?`, room instanceof DataShareRoom);
    console.log(`API: Is RTFeedbackRoom?`, room instanceof RTFeedbackRoom);
    
    if (room instanceof PollRoom) {
      roomType = 'poll';
    } else if (room instanceof DataShareRoom) {
      roomType = 'dataShare';
    } else if (room instanceof RTFeedbackRoom) {
      roomType = 'rtfeedback';
    }
  }
  
  // DEBUG: Log room existence check
  console.log(`API: Checking if room ${code} exists: ${exists}`);
  console.log(`API: Room type: ${roomType}`);
  console.log(`API: All rooms: ${Array.from(rooms.keys())}`);
  res.json({ exists, roomType });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Track which session this socket belongs to
  let currentSessionCode = null;

  // SESSION-BASED HANDLERS
  
  // Host creates or gets existing session
  socket.on('session:create', (callback) => {
    // Check if host already has a session
    let existingSession = null;
    for (const [code, session] of sessions) {
      if (session.hostSocketId === socket.id) {
        existingSession = session;
        break;
      }
    }
    
    if (existingSession) {
      currentSessionCode = existingSession.code;
      callback({ success: true, code: existingSession.code, isExisting: true });
    } else {
      const code = generateSessionCode();
      const session = new Session(code);
      session.hostSocketId = socket.id;
      sessions.set(code, session);
      currentSessionCode = code;
      
      socket.join(`session:${code}`);
      callback({ success: true, code, isExisting: false });
      console.log(`Created new session: ${code}`);
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
    
    // Join session room
    socket.join(`session:${code}`);
    
    // Join all active room types and send initial data
    const activeRooms = session.getActiveRoomTypes();
    activeRooms.forEach(roomType => {
      socket.join(`${code}:${roomType}`);
      
      // Send initial room data
      const room = session.getRoom(roomType);
      if (room) {
        if (roomType === 'poll' && room instanceof PollRoom) {
          socket.emit('poll:updated', room.pollData);
        } else if (roomType === 'rtfeedback' && room instanceof RTFeedbackRoom) {
          socket.emit('rtfeedback:update', room.getAggregatedFeedback());
        }
      }
    });
    
    socket.emit('session:joined', {
      success: true,
      activeRooms,
      participantId: socket.id
    });
    
    // Notify host of participant count
    if (session.hostSocketId) {
      io.to(session.hostSocketId).emit('session:participantUpdate', {
        count: session.getParticipantCount(),
        participants: Array.from(session.participants.values())
      });
    }
    
    console.log(`Student ${name} joined session ${code}`);
  });
  
  // Host creates a room within session
  socket.on('session:createRoom', (data, callback) => {
    const { sessionCode, roomType } = data;
    const session = sessions.get(sessionCode || currentSessionCode);
    
    if (!session || session.hostSocketId !== socket.id) {
      callback({ success: false, error: 'Invalid session or not host' });
      return;
    }
    
    // Check if room already exists
    if (session.getRoom(roomType)) {
      callback({ success: true, isExisting: true });
      return;
    }
    
    // Create new room
    const room = session.createRoom(roomType);
    socket.join(`${session.code}:${roomType}`);
    
    // Prepare room data based on type
    let roomData = {};
    if (roomType === 'poll' && room instanceof PollRoom) {
      roomData = room.pollData;
    } else if (roomType === 'rtfeedback' && room instanceof RTFeedbackRoom) {
      roomData = { isActive: room.isActive };
    }
    
    // Notify all session participants about new room
    io.to(`session:${session.code}`).emit('session:roomCreated', {
      roomType,
      roomData
    });
    
    callback({ success: true, isExisting: false });
    console.log(`Created ${roomType} room in session ${session.code}`);
  });
  
  // Host closes a room within session
  socket.on('session:closeRoom', (data) => {
    const { sessionCode, roomType } = data;
    const session = sessions.get(sessionCode || currentSessionCode);
    
    if (!session || session.hostSocketId !== socket.id) {
      return;
    }
    
    session.closeRoom(roomType);
    
    // Notify all participants
    io.to(`session:${session.code}`).emit('session:roomClosed', { roomType });
    
    // Clear the room namespace
    const roomNamespace = `${session.code}:${roomType}`;
    const socketsInRoom = io.sockets.adapter.rooms.get(roomNamespace);
    if (socketsInRoom) {
      socketsInRoom.forEach(socketId => {
        const s = io.sockets.sockets.get(socketId);
        if (s) s.leave(roomNamespace);
      });
    }
    
    console.log(`Closed ${roomType} room in session ${session.code}`);
  });
  
  // SESSION-BASED ROOM HANDLERS
  
  // Poll handlers for sessions
  socket.on('session:poll:update', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session) return;
    
    const room = session.getRoom('poll');
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
    
    room.pollData = data.pollData;
    io.to(`${session.code}:poll`).emit('poll:updated', data.pollData);
    session.updateActivity();
  });
  
  socket.on('session:poll:vote', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session) return;
    
    const room = session.getRoom('poll');
    if (!room || !(room instanceof PollRoom)) return;
    
    const participant = session.participants.get(socket.id);
    if (!participant || room.participants.get(socket.id)?.hasVoted) {
      socket.emit('vote:result', { success: false, error: 'Already voted or not a participant' });
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
    io.to(`${session.code}:poll`).emit('poll:voteUpdate', {
      votes: room.getVoteCounts(),
      totalVotes: room.getTotalVotes()
    });
    
    session.updateActivity();
  });
  
  // Data Share handlers for sessions
  socket.on('session:dataShare:submit', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session) {
      socket.emit('session:dataShare:submitted', { success: false, error: 'Session not found' });
      return;
    }
    
    const room = session.getRoom('dataShare');
    if (!room || !(room instanceof DataShareRoom)) {
      socket.emit('session:dataShare:submitted', { success: false, error: 'Data share room not found' });
      return;
    }
    
    const participant = session.participants.get(socket.id);
    if (!participant) {
      socket.emit('session:dataShare:submitted', { success: false, error: 'Not joined to session' });
      return;
    }
    
    const submission = room.addSubmission(participant.name || data.studentName, data.link);
    
    // Notify all in the room
    io.to(`${session.code}:dataShare`).emit('dataShare:newSubmission', submission);
    
    // Send confirmation to submitter
    socket.emit('session:dataShare:submitted', { success: true });
    
    session.updateActivity();
  });
  
  // RT Feedback handlers for sessions
  socket.on('session:rtfeedback:update', (data) => {
    const session = sessions.get(data.sessionCode || currentSessionCode);
    if (!session) return;
    
    const room = session.getRoom('rtfeedback');
    if (!room || !(room instanceof RTFeedbackRoom)) return;
    
    const participant = session.participants.get(socket.id);
    if (!participant) return;
    
    room.updateFeedback(socket.id, data.value);
    
    // Calculate aggregate feedback
    const feedbackData = room.getAggregatedFeedback();
    
    // Notify all in the room (including host)
    io.to(`${session.code}:rtfeedback`).emit('rtfeedback:update', feedbackData);
    
    session.updateActivity();
  });

  // Unified room join handler (legacy support)
  socket.on('room:join', (data) => {
    // DEBUG: Log unified join attempt
    console.log('Received room:join request:', data);
    const { code, name, type } = data;
    const room = rooms.get(code);
    
    if (!room) {
      // DEBUG: Room not found
      console.log(`Room ${code} not found`);
      socket.emit('room:joined', {
        success: false,
        error: 'Room not found'
      });
      return;
    }

    // Handle based on room type
    if (room instanceof PollRoom && type === 'poll') {
      // Join as poll participant
      room.participants.set(socket.id, {
        id: socket.id,
        name: name || `Student ${room.participants.size + 1}`,
        hasVoted: false,
        joinedAt: Date.now()
      });
      
      socket.join(code);
      socket.emit('room:joined', {
        success: true,
        type: 'poll',
        pollData: room.pollData,
        participantId: socket.id
      });
      
      // Notify host of new participant
      if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('participant:count', {
          count: room.participants.size
        });
      }
      
      // DEBUG: Log successful poll join
      console.log(`Participant joined poll room ${code}`);
    } else if (room instanceof DataShareRoom && type === 'dataShare') {
      // Join data share room
      socket.join(code);
      socket.emit('room:joined', {
        success: true,
        type: 'dataShare'
      });
      
      // DEBUG: Log successful data share join
      console.log(`Student joined data share room ${code}`);
    } else if (room instanceof RTFeedbackRoom && type === 'rtfeedback') {
      // Join RT feedback room
      socket.join(code);
      room.participants.set(socket.id, {
        id: socket.id,
        name: name || 'Student',
        joinedAt: Date.now()
      });
      
      socket.emit('room:joined', {
        success: true,
        type: 'rtfeedback',
        studentId: socket.id,
        isActive: room.isActive  // Include current state in join response
      });
      
      // Notify host of new participant
      if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('participant:joined', {
          studentId: socket.id,
          count: room.participants.size
        });
      }
      
      console.log(`Student joined RT feedback room ${code}`);
    } else {
      // Type mismatch
      // DEBUG: Log type mismatch
      console.log(`Room type mismatch: requested ${type} but room is ${room.constructor.name}`);
      socket.emit('room:joined', {
        success: false,
        error: 'Room type mismatch'
      });
    }
  });

  // Host joins room (widget)
  socket.on('host:join', (code) => {
    const room = rooms.get(code);
    if (room) {
      room.hostSocketId = socket.id;
      socket.join(code);
      socket.emit('host:joined', { success: true, code });
      console.log(`Host joined room ${code}`);
    } else {
      socket.emit('host:joined', { success: false, error: 'Room not found' });
    }
  });

  // Host updates poll data
  socket.on('poll:update', (data) => {
    const { code, pollData } = data;
    const room = rooms.get(code);
    
    if (room && room.hostSocketId === socket.id) {
      room.setPollData(pollData);
      // Notify all participants of the update
      io.to(code).emit('poll:updated', room.pollData);
      console.log(`Poll updated in room ${code}`);
    }
  });

  // Host starts/stops poll
  socket.on('poll:toggle', (data) => {
    const { code, isActive } = data;
    const room = rooms.get(code);
    
    if (room && room.hostSocketId === socket.id) {
      room.pollData.isActive = isActive;
      // Send full poll data when status changes
      io.to(code).emit('poll:updated', room.pollData);
      console.log(`Poll ${isActive ? 'started' : 'stopped'} in room ${code}`);
    }
  });


  // Participant votes
  socket.on('vote:submit', (data) => {
    const { code, optionIndex } = data;
    const room = rooms.get(code);
    
    if (room && room instanceof PollRoom && room.vote(socket.id, optionIndex)) {
      // Send confirmation to voter
      socket.emit('vote:confirmed', { success: true });
      
      // Update all clients with new results
      const results = room.getResults();
      io.to(code).emit('results:update', results);
      
      console.log(`Vote recorded in room ${code}`);
    } else {
      socket.emit('vote:confirmed', { 
        success: false, 
        error: 'Unable to record vote' 
      });
    }
  });

  // Data Share handlers
  socket.on('host:createDataShareRoom', () => {
    const code = generateRoomCode();
    const room = new DataShareRoom(code);
    room.hostSocketId = socket.id;
    rooms.set(code, room);
    
    socket.join(code);
    socket.emit('room:created', code);
    console.log(`Data share room created: ${code}`);
  });


  socket.on('dataShare:submit', (data) => {
    const { code, studentName, link } = data;
    const room = rooms.get(code);
    
    if (room && room instanceof DataShareRoom) {
      const submission = room.addSubmission(studentName, link);
      
      // Notify host
      if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('dataShare:newSubmission', submission);
      }
      
      socket.emit('dataShare:submitted', { success: true });
      console.log(`New submission in room ${code}`);
    } else {
      socket.emit('dataShare:submitted', { 
        success: false, 
        error: 'Room not found' 
      });
    }
  });

  socket.on('host:deleteSubmission', (data) => {
    const { roomCode, submissionId } = data;
    const room = rooms.get(roomCode);
    
    if (room && room instanceof DataShareRoom && room.hostSocketId === socket.id) {
      if (room.deleteSubmission(submissionId)) {
        io.to(roomCode).emit('dataShare:submissionDeleted', submissionId);
        console.log(`Submission deleted in room ${roomCode}`);
      }
    }
  });

  socket.on('host:clearAllSubmissions', (roomCode) => {
    const room = rooms.get(roomCode);
    
    if (room && room instanceof DataShareRoom && room.hostSocketId === socket.id) {
      room.clearAllSubmissions();
      io.to(roomCode).emit('dataShare:allCleared');
      console.log(`All submissions cleared in room ${roomCode}`);
    }
  });

  // Handle host closing room (widget deleted)
  socket.on('host:closeRoom', (data) => {
    const { code, type } = data;
    console.log(`Received host:closeRoom for room ${code}, type: ${type} from socket ${socket.id}`);
    const room = rooms.get(code);
    
    if (room && room.hostSocketId === socket.id) {
      console.log(`Host verified for room ${code}, sending room:closed to participants`);
      console.log(`Participants in room ${code}:`, room.participants);
      
      // Get all sockets in the room before cleanup
      const socketsInRoom = io.sockets.adapter.rooms.get(code);
      console.log(`Sockets in room ${code}:`, socketsInRoom ? Array.from(socketsInRoom) : 'none');
      
      // Notify all participants that the room is closing
      socket.to(code).emit('room:closed', { 
        code, 
        type,
        message: 'The host has closed this activity' 
      });
      
      // Leave all participants from the room
      if (socketsInRoom) {
        socketsInRoom.forEach(socketId => {
          const participantSocket = io.sockets.sockets.get(socketId);
          if (participantSocket) {
            participantSocket.leave(code);
          }
        });
      }
      
      // Remove the room
      rooms.delete(code);
      console.log(`Host closed room ${code} (${type}) - room deleted`);
    } else {
      console.log(`Failed to close room ${code} - room not found or socket ${socket.id} is not host`);
      if (room) {
        console.log(`Room host is ${room.hostSocketId}, requesting socket is ${socket.id}`);
      }
    }
  });

  // RT Feedback handlers
  socket.on('rtfeedback:update', (data) => {
    const { code, value } = data;
    const room = rooms.get(code);
    
    if (room && room instanceof RTFeedbackRoom && room.isActive) {
      // Update feedback value only if room is active
      room.updateFeedback(socket.id, value);
      
      // Notify host of updated feedback
      if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('feedback', {
          studentId: socket.id,
          value: value
        });
      }
    }
  });

  // Host starts/stops understanding feedback
  socket.on('rtfeedback:toggle', (data) => {
    const { code, isActive } = data;
    const room = rooms.get(code);
    
    if (room && room instanceof RTFeedbackRoom && room.hostSocketId === socket.id) {
      room.isActive = isActive;
      
      // Broadcast state change to all participants
      io.to(code).emit('rtfeedback:stateChanged', { isActive });
      
      console.log(`Understanding feedback ${isActive ? 'started' : 'stopped'} in room ${code}`);
      
      // If stopping, optionally clear feedback data
      if (!isActive) {
        room.feedbackData.clear();
      }
    }
  });

  // Host creates RT feedback room
  socket.on('rtfeedback:create', () => {
    const code = generateRoomCode();
    const room = new RTFeedbackRoom(code);
    room.hostSocketId = socket.id;
    rooms.set(code, room);
    socket.join(code);
    
    socket.emit('rtfeedback:created', { code, success: true });
    console.log(`Created RT feedback room ${code}`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Handle session disconnect
    if (currentSessionCode) {
      const session = sessions.get(currentSessionCode);
      if (session) {
        if (session.hostSocketId === socket.id) {
          console.log(`Host disconnected from session ${currentSessionCode}`);
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
        }
      }
    }
    
    // Check if disconnected client was a host (legacy room support)
    rooms.forEach((room, code) => {
      if (room.hostSocketId === socket.id) {
        console.log(`Host disconnected from room ${code}`);
        // Keep room alive for reconnection
      } else if (room.participants && room.participants.has(socket.id)) {
        room.participants.delete(socket.id);
        
        // For RT feedback rooms, also remove feedback data
        if (room instanceof RTFeedbackRoom) {
          room.removeFeedback(socket.id);
          // Notify host of student disconnect
          if (room.hostSocketId) {
            io.to(room.hostSocketId).emit('studentDisconnected', {
              studentId: socket.id
            });
          }
        }
        
        // Notify host of updated count
        if (room.hostSocketId) {
          io.to(room.hostSocketId).emit('participant:count', {
            count: room.participants.size
          });
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
      console.log(`Cleaned up old session ${code}`);
    }
  });
  
  // Clean up old rooms (legacy support)
  rooms.forEach((room, code) => {
    if (now - room.createdAt > maxAge) {
      rooms.delete(code);
      console.log(`Cleaned up old room ${code}`);
    }
  });
}, 60 * 60 * 1000); // Check every hour

// Start server
const PORT = 3001; // Always use port 3001 for this server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});