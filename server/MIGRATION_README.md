# Server Migration: Environment-Based Switching

## Overview
The server now supports running either the legacy monolithic server or the new modular server based on environment configuration.

## How to Use

### Default Behavior
By default, the server runs in **legacy mode** for safety:
```bash
npm start  # Runs legacy server
```

### Using Environment Variables
Control which server runs using the `USE_NEW_SERVER` environment variable:

```bash
# Run new modular server
USE_NEW_SERVER=true npm start

# Explicitly run legacy server
USE_NEW_SERVER=false npm start
```

### Using Command Line Flags
Force a specific server using command line flags:

```bash
# Force new server
npm start -- --new

# Force legacy server  
npm start -- --legacy
```

### Using npm Scripts
Direct scripts are available for each server:

```bash
# Legacy server
npm run start:legacy
npm run dev:legacy

# New modular server
npm run start:new
npm run dev:new
```

## Configuration Priority
The server selection follows this priority order:
1. Command line flags (`--new` or `--legacy`)
2. `USE_NEW_SERVER` environment variable
3. `NODE_ENV=production` (automatically uses new server)
4. Default: legacy server (in development)

## Environment Configuration
Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Key configuration:
```env
# Use new modular server
USE_NEW_SERVER=true

# Or keep legacy (default in dev)
USE_NEW_SERVER=false
```

## Testing
Run tests against the new server:
```bash
npm test  # Run test suite
npm run test:integration  # Full integration test
```

## Monitoring the Migration
The console output clearly shows which server is running:
- 🔧 Legacy server: `Using LEGACY server`
- 🚀 New server: `Using NEW server`

## Rollback
If issues arise with the new server:

1. **Immediate rollback via environment:**
   ```bash
   USE_NEW_SERVER=false npm start
   ```

2. **Rollback via flag:**
   ```bash
   npm start -- --legacy
   ```

3. **Direct legacy script:**
   ```bash
   npm run start:legacy
   ```

## Production Deployment
In production (`NODE_ENV=production`), the new server is used by default. Override if needed:
```bash
NODE_ENV=production USE_NEW_SERVER=false npm start
```

## Feature Comparison

| Feature | Legacy | New Modular |
|---------|--------|-------------|
| Session Management | ✅ | ✅ Enhanced |
| All Widgets | ✅ | ✅ |
| Error Handling | Basic | ✅ Comprehensive |
| Logging | Console only | ✅ File + Console |
| Rate Limiting | ❌ | ✅ |
| Input Validation | Basic | ✅ Comprehensive |
| API Documentation | ❌ | ✅ |
| Memory Management | ⚠️ | ✅ Improved |
| Code Structure | Monolithic | ✅ Modular |

## Next Steps
1. Run in development with `USE_NEW_SERVER=true` for testing
2. Monitor logs and performance
3. Gradually increase usage of new server
4. Eventually make new server the default