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
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Serve unified student interface at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Store active rooms/sessions
const rooms = new Map();

// Generate random 4-digit room code
function generateRoomCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
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

// REST API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
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
    if (room instanceof PollRoom) {
      roomType = 'poll';
    } else if (room instanceof DataShareRoom) {
      roomType = 'dataShare';
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

  // Unified room join handler
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

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Check if disconnected client was a host
    rooms.forEach((room, code) => {
      if (room.hostSocketId === socket.id) {
        console.log(`Host disconnected from room ${code}`);
        // Keep room alive for reconnection
      } else if (room.participants && room.participants.has(socket.id)) {
        room.participants.delete(socket.id);
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

// Clean up old rooms (12 hours)
setInterval(() => {
  const now = Date.now();
  const maxAge = 12 * 60 * 60 * 1000; // 12 hours
  
  rooms.forEach((room, code) => {
    if (now - room.createdAt > maxAge) {
      rooms.delete(code);
      console.log(`Cleaned up old room ${code}`);
    }
  });
}, 60 * 60 * 1000); // Check every hour

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});