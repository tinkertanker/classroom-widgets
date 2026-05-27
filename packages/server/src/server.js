// Load environment variables FIRST before anything else
require('dotenv').config({ override: true });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

// Import configurations
const serverConfig = require('./config/server.config');

// Import middleware
const { socketAuth, socketErrorHandler, stopRateLimiterCleanup } = require('./middleware/socketAuth');
const { expressErrorHandler, setupGlobalErrorHandlers } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');

// Import services
const SessionManager = require('./services/SessionManager');

// Import socket manager
const { setupSocketHandlers } = require('./sockets/socketManager');

// Import routes
const apiRoutes = require('./routes/api');
const staticRoutes = require('./routes/static');

const normaliseOrigin = (value) => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const isLocalDevelopmentOrigin = (origin) => {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
  } catch {
    return false;
  }
};

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

  static isOriginAllowed(origin) {
    // Allow requests with no origin (like mobile apps or Postman).
    if (!origin) return true;

    const requestOrigin = normaliseOrigin(origin);
    if (!requestOrigin) return false;

    const allowedOrigins = serverConfig.CORS.ALLOWED_ORIGINS
      .map(normaliseOrigin)
      .filter(Boolean);

    if (allowedOrigins.includes(requestOrigin)) {
      return true;
    }

    // In development, allow localhost on any port.
    return !serverConfig.IS_PRODUCTION && isLocalDevelopmentOrigin(requestOrigin);
  }

  static corsOriginDelegate(origin, callback) {
    if (AppServer.isOriginAllowed(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  }

  /**
   * Configure Express middleware
   */
  configureMiddleware() {
    // Security headers. CSP off here because static student bundle inlines styles
    // and the CSP would need a per-deployment policy; revisit when ready.
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));

    // Gzip responses (skip websocket upgrade frames automatically).
    this.app.use(compression());

    // Static file serving should come BEFORE CORS in production
    // This prevents CORS checks on static assets served from the same domain
    if (serverConfig.IS_PRODUCTION) {
      this.app.use(staticRoutes);
    }

    // CORS configuration
    this.app.use(cors({
      origin: AppServer.corsOriginDelegate,
      credentials: serverConfig.CORS.CREDENTIALS,
      methods: serverConfig.CORS.METHODS,
      allowedHeaders: serverConfig.CORS.ALLOWED_HEADERS
    }));

    // Voice command context can contain legacy image widget data URLs. Keep
    // that endpoint on the old larger limit while tightening the rest.
    this.app.use('/api/voice-command', express.json({ limit: '10mb' }));

    // Body parsing. Typical poll/activity payloads are tiny; tight limits
    // prevent trivial memory-DoS from oversized POSTs.
    this.app.use(express.json({ limit: '256kb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '256kb' }));

    // Request logging in development (opt-in to avoid per-request hot-path noise).
    // Uses logger.info so it's not gated by LOG_LEVEL - the env flag is the only gate.
    if (!serverConfig.IS_PRODUCTION && process.env.HTTP_DEBUG === 'true') {
      this.app.use((req, res, next) => {
        logger.info(`${req.method} ${req.path}`);
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
        origin: AppServer.corsOriginDelegate,
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
        // Cancel background timers so the event loop can quiesce.
        if (this.sessionManager && typeof this.sessionManager.stopCleanupInterval === 'function') {
          this.sessionManager.stopCleanupInterval();
        }
        stopRateLimiterCleanup();

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
