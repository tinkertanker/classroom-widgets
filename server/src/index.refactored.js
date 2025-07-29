const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

// Import configurations
const serverConfig = require('./config/server.config');
const { TIME, LIMITS } = require('./config/constants');

// Import models
const Session = require('./models/Session');
const PollRoom = require('./models/PollRoom');
const LinkShareRoom = require('./models/LinkShareRoom');
const RTFeedbackRoom = require('./models/RTFeedbackRoom');
const QuestionsRoom = require('./models/QuestionsRoom');

// Import utilities
const { generateSessionCode, generateRoomCode } = require('./utils/codeGenerator');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with configuration
const io = new Server(server, {
  cors: {
    origin: serverConfig.CORS.ALLOWED_ORIGINS,
    methods: serverConfig.CORS.METHODS,
    credentials: serverConfig.CORS.CREDENTIALS
  },
  pingTimeout: serverConfig.SOCKET_IO.PING_TIMEOUT,
  pingInterval: serverConfig.SOCKET_IO.PING_INTERVAL,
  maxHttpBufferSize: serverConfig.SOCKET_IO.MAX_HTTP_BUFFER_SIZE
});

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // Check against allowed origins
    if (serverConfig.CORS.ALLOWED_ORIGINS.some(allowed => 
      origin.includes(allowed) || allowed === '*'
    )) {
      return callback(null, true);
    }
    
    // In development, allow localhost on any port
    if (!serverConfig.IS_PRODUCTION && 
        (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: serverConfig.CORS.CREDENTIALS,
  methods: serverConfig.CORS.METHODS,
  allowedHeaders: serverConfig.CORS.ALLOWED_HEADERS
}));

app.use(express.json({ limit: '10mb' }));

// Static file serving
if (serverConfig.IS_PRODUCTION) {
  const publicPath = path.join(__dirname, serverConfig.STATIC.PUBLIC_PATH);
  app.use(express.static(publicPath, {
    maxAge: serverConfig.STATIC.MAX_AGE
  }));
}

// Store active rooms/sessions
const rooms = new Map(); // Legacy room support
const sessions = new Map();

// Session Manager
class SessionManager {
  constructor() {
    this.sessions = sessions;
    this.rooms = rooms;
  }

  createSession(existingCode = null) {
    if (existingCode && this.sessions.has(existingCode)) {
      return this.sessions.get(existingCode);
    }

    const code = generateSessionCode(this.sessions, this.rooms);
    const session = new Session(code);
    this.sessions.set(code, session);
    return session;
  }

  getSession(code) {
    return this.sessions.get(code);
  }

  deleteSession(code) {
    return this.sessions.delete(code);
  }

  findSessionByHost(hostSocketId) {
    for (const [code, session] of this.sessions) {
      if (session.hostSocketId === hostSocketId) {
        return session;
      }
    }
    return null;
  }
}

const sessionManager = new SessionManager();

// Import and setup routes
require('./routes/api')(app, sessionManager);
require('./routes/static')(app, serverConfig);

// Import and setup socket handlers
const { setupSocketHandlers } = require('./sockets/socketManager');
setupSocketHandlers(io, sessionManager);

// Cleanup service
class CleanupService {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.cleanupInterval = null;
  }

  start() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, TIME.CLEANUP_INTERVAL);
  }

  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  cleanup() {
    const now = Date.now();
    let sessionsDeleted = 0;
    let roomsDeleted = 0;

    // Clean up old sessions
    this.sessionManager.sessions.forEach((session, code) => {
      if (session.isExpired(TIME.SESSION_MAX_AGE) || 
          session.isInactive(TIME.INACTIVITY_TIMEOUT)) {
        this.sessionManager.deleteSession(code);
        sessionsDeleted++;
      }
    });

    // Clean up old rooms (legacy support)
    this.sessionManager.rooms.forEach((room, code) => {
      if (room.isExpired && room.isExpired(TIME.SESSION_MAX_AGE)) {
        this.sessionManager.rooms.delete(code);
        roomsDeleted++;
      }
    });

    if (sessionsDeleted > 0 || roomsDeleted > 0) {
      console.log(`Cleanup: Deleted ${sessionsDeleted} sessions and ${roomsDeleted} legacy rooms`);
    }
  }
}

const cleanupService = new CleanupService(sessionManager);
cleanupService.start();

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: serverConfig.IS_PRODUCTION ? 'Internal server error' : err.message,
      ...(serverConfig.IS_PRODUCTION ? {} : { stack: err.stack })
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
  console.log('Received shutdown signal, closing server gracefully...');
  
  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');
    
    // Stop cleanup service
    cleanupService.stop();
    
    // Close all socket connections
    io.close(() => {
      console.log('All socket connections closed');
      process.exit(0);
    });
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

// Start server
server.listen(serverConfig.PORT, () => {
  console.log(`🚀 Server running on port ${serverConfig.PORT}`);
  console.log(`📝 Environment: ${serverConfig.NODE_ENV}`);
  console.log(`🔗 CORS origins: ${serverConfig.CORS.ALLOWED_ORIGINS.join(', ')}`);
});