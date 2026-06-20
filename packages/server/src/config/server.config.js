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
    // Allowed origins - can be set via environment variable.
    // Wildcards are rejected at startup to prevent accidental "*" in prod.
    ALLOWED_ORIGINS: (() => {
      const raw = process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
        : [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:3002'
          ];
      const hasWildcard = raw.some(o => o === '*');
      if (hasWildcard) {
        if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
          throw new Error('[server.config] CORS_ORIGINS contains "*" - wildcard origins are not permitted in production.');
        }
        // In dev we strip the "*" but warn so it doesn't quietly mask real values.
        console.warn('[server.config] CORS_ORIGINS contains "*" - stripped in development.');
        return raw.filter(o => o !== '*');
      }
      return raw;
    })(),
    CREDENTIALS: true,
    METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization']
  },

  // Socket.IO configuration
  SOCKET_IO: {
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
    // Vite dev server URL (where student app runs in dev)
    VITE_URL: 'http://localhost:3002'
  },

  // Student app URL - where students should connect
  // In development: the Vite dev server for student app
  // In production: derived from server origin + '/student' path
  getStudentAppUrl: function(serverOrigin) {
    if (process.env.STUDENT_APP_URL) {
      return process.env.STUDENT_APP_URL;
    }
    if (this.IS_PRODUCTION) {
      return serverOrigin || '/';
    } else {
      return this.DEV.VITE_URL;
    }
  },

};
