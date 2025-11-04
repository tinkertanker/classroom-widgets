// Load environment variables FIRST before anything else
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

// Import configurations
const serverConfig = require('./config/server.config');

// Import middleware
const { socketAuth, socketErrorHandler } = require('./middleware/socketAuth');
const { expressErrorHandler, setupGlobalErrorHandlers } = require('./middleware/errorHandler');

// Import services
const SessionManager = require('./services/SessionManager');

// Import socket manager
const { setupSocketHandlers } = require('./sockets/socketManager');

// Import routes
const apiRoutes = require('./routes/api');
const staticRoutes = require('./routes/static');

/**
 * Initialize and configure the server
 */
class AppServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = null;
    this.sessionManager = new SessionManager();
    
    // Setup global error handlers
    setupGlobalErrorHandlers();
  }

  /**
   * Configure Express middleware
   */
  configureMiddleware() {
    // Static file serving should come BEFORE CORS in production
    // This prevents CORS checks on static assets served from the same domain
    if (serverConfig.IS_PRODUCTION) {
      this.app.use(staticRoutes);
    }

    // CORS configuration
    this.app.use(cors({
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

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging in development
    if (!serverConfig.IS_PRODUCTION) {
      this.app.use((req, res, next) => {
        console.log(`${req.method} ${req.path}`);
        next();
      });
    }
  }

  /**
   * Configure Socket.IO
   */
  configureSocketIO() {
    this.io = new Server(this.server, {
      cors: {
        origin: serverConfig.CORS.ALLOWED_ORIGINS,
        methods: serverConfig.CORS.METHODS,
        credentials: serverConfig.CORS.CREDENTIALS
      },
      pingTimeout: serverConfig.SOCKET_IO.PING_TIMEOUT,
      pingInterval: serverConfig.SOCKET_IO.PING_INTERVAL,
      maxHttpBufferSize: serverConfig.SOCKET_IO.MAX_HTTP_BUFFER_SIZE
    });

    // Socket.IO middleware
    this.io.use(socketAuth(this.sessionManager));

    // Setup socket handlers
    setupSocketHandlers(this.io, this.sessionManager);
  }

  /**
   * Configure routes
   */
  configureRoutes() {
    // API routes
    this.app.use('/api', apiRoutes(this.sessionManager));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const stats = this.sessionManager.getStats();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        stats,
        uptime: process.uptime()
      });
    });

    // Static file serving moved to configureMiddleware() to avoid CORS issues

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Not found'
      });
    });

    // Error handling middleware (must be last)
    this.app.use(expressErrorHandler);
  }

  /**
   * Start the server
   */
  async start() {
    try {
      // Configure everything
      this.configureMiddleware();
      this.configureSocketIO();
      this.configureRoutes();

      // Start listening
      const port = serverConfig.PORT;
      this.server.listen(port, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Classroom Widgets Server Started Successfully! 🚀    ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   Environment: ${serverConfig.IS_PRODUCTION ? 'Production' : 'Development'}                              ║
║   Port: ${port}                                          ║
║   CORS: ${serverConfig.CORS.ALLOWED_ORIGINS.join(', ')}                     ║
║                                                           ║
║   API Endpoints:                                          ║
║   - Health Check: http://localhost:${port}/health         ║
║   - API Base: http://localhost:${port}/api                ║
║   - Socket.IO: ws://localhost:${port}                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
        `);
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);
      
      try {
        // Stop accepting new connections
        this.server.close(() => {
          console.log('HTTP server closed');
        });

        // Close all socket connections
        if (this.io) {
          this.io.close(() => {
            console.log('Socket.IO server closed');
          });
        }

        // Wait a bit for connections to close
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Listen for termination signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Create and start the server
if (require.main === module) {
  const server = new AppServer();
  server.start().catch(error => {
    console.error('Server startup failed:', error);
    process.exit(1);
  });
}

module.exports = AppServer;