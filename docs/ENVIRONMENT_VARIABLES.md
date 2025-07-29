# Environment Variables Configuration Guide

This document provides a comprehensive reference for all environment variables used in the Classroom Widgets application.
It's recommended to copy the `.env.example` files in each sub-project (`/`, `server/`, `server/src/student/`) to `.env` to get started.

---

## Teacher App (`/`)

These variables are used by the main teacher-facing application (the root Vite project). They must be prefixed with `VITE_` and configured in the root `.env` file.

### `VITE_SERVER_URL` (Required)
- **Description**: The public URL of the backend server for WebSocket connections.
- **Default**: `http://localhost:3001`
- **Production Example**: `https://api.your-domain.com`

### `VITE_SHORTIO_API_KEY` (Optional)
- **Description**: API key for the Short.io service, used by the "Link Shortener" widget.
- **Default**: None

### `VITE_GA_ID` (Optional)
- **Description**: Google Analytics Tracking ID for analytics.
- **Default**: None

### `VITE_SENTRY_DSN` (Optional)
- **Description**: Sentry DSN for client-side error tracking.
- **Default**: None

---

## Student App (`server/src/student`)

These variables are used by the student-facing application. They must be prefixed with `VITE_` and configured in `server/src/student/.env`.

### `VITE_SERVER_URL` (Required)
- **Description**: The public URL of the backend server for the student app to connect to.
- **Default**: `http://localhost:3001`
- **Production Example**: `https://api.your-domain.com`

---

## Backend Server (`server/`)

These variables are used by the Express.js backend server. They are configured in `server/.env` and do not use a prefix.

### `PORT` (Required)
- **Description**: Port for the server to listen on.
- **Default**: `3001`

### `CORS_ORIGINS` (Required)
- **Description**: Comma-separated list of allowed origins for CORS. This should include the URLs for your teacher and student apps.
- **Default**: `http://localhost:3000`
- **Production Example**: `https://teacher-app.com,https://student-app.com`
- **Example**:
  ```bash
  CORS_ORIGINS=https://widgets.tk.sg,https://go.tk.sg
  ```

### Optional Variables

#### `LOG_LEVEL`
- **Description**: Logging verbosity level
- **Default**: `info`
- **Values**: `error` | `warn` | `info` | `debug`
- **Example**:
  ```bash
  LOG_LEVEL=debug
  ```

#### `MAX_ROOM_AGE`
- **Description**: Maximum age of rooms before cleanup (in milliseconds)
- **Default**: `43200000` (12 hours)
- **Example**:
  ```bash
  MAX_ROOM_AGE=86400000  # 24 hours
  ```

#### `CLEANUP_INTERVAL`
- **Description**: Interval for running room cleanup (in milliseconds)
- **Default**: `3600000` (1 hour)
- **Example**:
  ```bash
  CLEANUP_INTERVAL=1800000  # 30 minutes
  ```

#### `REDIS_URL`
- **Description**: Redis connection URL for session storage (optional)
- **Default**: None
- **Example**:
  ```bash
  REDIS_URL=redis://localhost:6379
  ```

#### `DATABASE_URL`
- **Description**: Database connection URL (if using persistent storage)
- **Default**: None
- **Example**:
  ```bash
  DATABASE_URL=postgres://user:pass@localhost:5432/classroom_widgets
  ```

## Docker Environment Variables

### Build Arguments

#### Frontend Build Args

```dockerfile
ARG REACT_APP_SERVER_URL=http://localhost:3001
```

### Runtime Environment

#### Frontend Container
```yaml
environment:
  - REACT_APP_SERVER_URL=https://go.tk.sg
```

#### Backend Container
```yaml
environment:
  - NODE_ENV=production
  - PORT=3001
  - CORS_ORIGINS=https://widgets.tk.sg,https://go.tk.sg
```

## Environment Files Structure

### Development Setup

1. **Frontend** (`.env.development`):
   ```bash
   REACT_APP_SERVER_URL=http://localhost:3001
   REACT_APP_DEBUG=true
   ```

2. **Backend** (`server/.env.development`):
   ```bash
   NODE_ENV=development
   PORT=3001
   CORS_ORIGINS=http://localhost:3000,http://localhost:3001
   LOG_LEVEL=debug
   ```

### Production Setup

1. **Frontend** (`.env.production`):
   ```bash
   REACT_APP_SERVER_URL=https://go.tk.sg
   REACT_APP_GA_ID=UA-123456789-1
   REACT_APP_SENTRY_DSN=https://example@sentry.io/123456
   ```

2. **Backend** (`server/.env.production`):
   ```bash
   NODE_ENV=production
   PORT=3001
   CORS_ORIGINS=https://widgets.tk.sg,https://go.tk.sg
   LOG_LEVEL=info
   REDIS_URL=redis://redis:6379
   ```

## Loading Environment Variables

### React Application

React automatically loads environment variables prefixed with `REACT_APP_`:

```javascript
// Access in code
const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';
```

### Node.js Server

The server uses dotenv to load environment variables:

```javascript
// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Access in code
const port = process.env.PORT || 3001;
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
```

## Best Practices

### 1. Never Commit Sensitive Data
```bash
# .gitignore
.env
.env.local
.env.production
.env.*.local
```

### 2. Use Example Files
Always provide `.env.example` files:

```bash
# .env.example
REACT_APP_SERVER_URL=http://localhost:3001
# Add your API keys below
# REACT_APP_API_KEY=your-api-key-here
```

### 3. Validate Required Variables

```javascript
// server/src/config.js
const requiredEnvVars = ['PORT', 'CORS_ORIGINS'];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});
```

### 4. Use Type Coercion

```javascript
// Convert string to number
const port = parseInt(process.env.PORT, 10) || 3001;

// Convert string to boolean
const debug = process.env.DEBUG === 'true';

// Parse comma-separated values
const origins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || [];
```

### 5. Environment-Specific Defaults

```javascript
const config = {
  port: process.env.PORT || 3001,
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || 
    (process.env.NODE_ENV === 'production' 
      ? ['https://widgets.tk.sg'] 
      : ['http://localhost:3000']),
  logLevel: process.env.LOG_LEVEL || 
    (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
};
```

## Security Considerations

### 1. Use Secrets Management

For production, consider using:
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Google Secret Manager

### 2. Rotate Credentials Regularly

```bash
# Script to rotate API keys
#!/bin/bash
OLD_KEY=$REACT_APP_API_KEY
NEW_KEY=$(openssl rand -hex 32)

# Update application
sed -i "s/$OLD_KEY/$NEW_KEY/g" .env.production

# Restart application
pm2 restart all
```

### 3. Limit Access

```bash
# Set restrictive permissions
chmod 600 .env.production
chown appuser:appuser .env.production
```

### 4. Audit Environment Variables

```bash
# List all environment variables (careful in production!)
printenv | grep -E "^(REACT_APP_|NODE_|PORT|CORS)" | sort
```

## Troubleshooting

### Variable Not Loading

1. **Check variable name**:
   - Frontend: Must start with `REACT_APP_`
   - Backend: Any name is allowed

2. **Restart required**:
   - Frontend: Restart development server
   - Backend: Restart Node.js process

3. **Check file location**:
   ```bash
   # Frontend variables
   ls -la .env*
   
   # Backend variables
   ls -la server/.env*
   ```

### CORS Issues

If experiencing CORS errors:

1. Verify `CORS_ORIGINS` includes your frontend URL
2. Check for trailing slashes
3. Ensure protocol matches (http vs https)

```bash
# Correct
CORS_ORIGINS=https://widgets.tk.sg,https://go.tk.sg

# Incorrect (trailing slash)
CORS_ORIGINS=https://widgets.tk.sg/,https://go.tk.sg/
```

### Port Conflicts

```bash
# Check what's using the port
lsof -i :3001
netstat -tulpn | grep 3001

# Kill process using the port
kill -9 $(lsof -t -i :3001)
```

## Platform-Specific Configuration

### Heroku

```bash
# Set environment variables
heroku config:set REACT_APP_SERVER_URL=https://go.tk.sg -a your-app-name
heroku config:set NODE_ENV=production -a your-app-name
```

### Docker

```bash
# Pass environment variables
docker run -e NODE_ENV=production -e PORT=3001 classroom-widgets-backend

# Use env file
docker run --env-file .env.production classroom-widgets-backend
```

### PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'classroom-widgets-api',
    script: './src/index.js',
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      CORS_ORIGINS: 'https://widgets.tk.sg'
    }
  }]
};
```

### Kubernetes

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: classroom-widgets-config
data:
  NODE_ENV: "production"
  PORT: "3001"
  CORS_ORIGINS: "https://widgets.tk.sg"
```

## Testing Environment Variables

### Unit Tests

```javascript
// Mock environment variables
describe('Config', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  test('uses custom port', () => {
    process.env.PORT = '4000';
    const config = require('./config');
    expect(config.port).toBe(4000);
  });
});
```

### Integration Tests

```bash
# Test with different environments
NODE_ENV=test PORT=3002 npm test
```

## Migration Guide

When adding new environment variables:

1. **Update example files**:
   ```bash
   echo "NEW_VARIABLE=default_value" >> .env.example
   ```

2. **Document in this guide**

3. **Add validation**:
   ```javascript
   if (!process.env.NEW_VARIABLE) {
     console.warn('NEW_VARIABLE not set, using default');
   }
   ```

4. **Update deployment scripts**

5. **Notify team members**

## Conclusion

Proper environment variable management is crucial for:
- Security (keeping secrets out of code)
- Flexibility (different configs for different environments)
- Portability (easy deployment across platforms)

Always follow the principle of least privilege and never expose sensitive configuration in logs or error messages.