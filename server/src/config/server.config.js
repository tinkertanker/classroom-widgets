/**
 * Server configuration
 */
module.exports = {
  // Server port
  PORT: process.env.PORT || 3001,

  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging',

  // CORS configuration
  CORS: {
    // Allowed origins - can be set via environment variable
    ALLOWED_ORIGINS: process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',') 
      : [
          'http://localhost:3000',
          'http://localhost:3001', 
          'http://localhost:3002',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
          'http://127.0.0.1:3002'
        ],
    CREDENTIALS: true,
    METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization']
  },

  // Socket.IO configuration
  SOCKET_IO: {
    // Path for socket.io
    PATH: '/socket.io/',
    
    // Transports
    TRANSPORTS: ['websocket', 'polling'],
    
    // Ping timeout and interval
    PING_TIMEOUT: 60000,
    PING_INTERVAL: 25000,
    
    // Max HTTP buffer size
    MAX_HTTP_BUFFER_SIZE: 1e6 // 1MB
  },

  // Static file serving
  STATIC: {
    // Path to static files
    PUBLIC_PATH: '../public',
    
    // Cache control
    MAX_AGE: process.env.NODE_ENV === 'production' ? 86400000 : 0 // 1 day in production, no cache in dev
  },

  // Development settings
  DEV: {
    // Vite dev server URL
    VITE_URL: 'http://localhost:3002'
  },

  // Logging
  LOG: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    // Whether to log socket events
    LOG_SOCKET_EVENTS: process.env.LOG_SOCKET_EVENTS === 'true'
  },

  // Security
  SECURITY: {
    // Rate limiting
    RATE_LIMIT: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 100 // limit each IP to 100 requests per windowMs
    },
    
    // Session security
    SESSION: {
      // Maximum session age
      MAX_AGE: 12 * 60 * 60 * 1000, // 12 hours
      
      // Session secret (should be set via environment variable in production)
      SECRET: process.env.SESSION_SECRET || 'development-secret-change-in-production'
    }
  }
};