# Server Migration Plan: Monolithic to Modular

## Overview
This document outlines the migration strategy from the current monolithic `index.js` (1400+ lines) to the new modular architecture.

## Current State
- **Monolithic Server**: `server/src/index.js`
- **Size**: ~1400 lines
- **Issues**: 
  - All logic in one file
  - Difficult to maintain and test
  - No separation of concerns
  - Hard to add new features

## Target State
- **Modular Architecture**:
  ```
  server/src/
  ├── server.js              # Main entry point
  ├── config/               # Configuration files
  ├── middleware/           # Express & Socket middleware
  ├── models/              # Data models
  ├── routes/              # REST API routes
  ├── services/            # Business logic
  ├── sockets/             # Socket.IO handlers
  └── utils/               # Utilities
  ```

## Migration Phases

### Phase 1: Parallel Development ✅ COMPLETED
- Created new modular structure alongside existing code
- No breaking changes
- Both systems can run independently

### Phase 2: Integration Testing (Current)
1. **Create test environment**
   - Copy `index.js` to `index.legacy.js`
   - Update `package.json` to have two start scripts:
     ```json
     "start:legacy": "node src/index.legacy.js",
     "start:new": "node src/server.js"
     ```

2. **Test new server**
   - Start with `npm run start:new`
   - Test all widget functionality
   - Verify backward compatibility
   - Check performance

### Phase 3: Gradual Migration
1. **Update package.json**
   ```json
   {
     "scripts": {
       "start": "node src/server.js",
       "start:legacy": "node src/index.legacy.js"
     }
   }
   ```

2. **Environment-based switching**
   ```javascript
   // In package.json or startup script
   const useNewServer = process.env.USE_NEW_SERVER === 'true';
   const serverFile = useNewServer ? './src/server.js' : './src/index.js';
   ```

3. **Feature flag approach**
   - Add feature flags for new functionality
   - Gradually enable features in production

### Phase 4: Production Deployment
1. **Canary deployment**
   - Deploy new server to subset of users
   - Monitor for issues
   - Gradually increase traffic

2. **Rollback plan**
   - Keep legacy server available
   - Quick switch via environment variable
   - Database/state compatibility ensured

### Phase 5: Cleanup
1. **Remove legacy code**
   - Delete `index.js` after stable period
   - Remove legacy support from new code
   - Update documentation

2. **Optimize new structure**
   - Remove backward compatibility layers
   - Optimize performance
   - Add more features

## Testing Checklist

### Functionality Tests
- [ ] Session creation and joining
- [ ] All widget types (Poll, LinkShare, RTFeedback, Questions)
- [ ] Real-time updates
- [ ] Multiple concurrent sessions
- [ ] Participant limits
- [ ] Error handling
- [ ] Reconnection logic

### Performance Tests
- [ ] Response time comparison
- [ ] Memory usage
- [ ] CPU usage
- [ ] Concurrent connection handling
- [ ] WebSocket stability

### Compatibility Tests
- [ ] Legacy room codes
- [ ] Existing client apps
- [ ] API endpoints
- [ ] Socket event names

## Rollback Procedure
1. **Immediate rollback**
   ```bash
   # Change start script in package.json
   npm run start:legacy
   ```

2. **Environment variable**
   ```bash
   USE_NEW_SERVER=false npm start
   ```

3. **Load balancer switch**
   - Update load balancer to route to legacy server
   - No code deployment needed

## Monitoring
- **Metrics to track**:
  - Error rates
  - Response times
  - Active sessions
  - Memory usage
  - Socket disconnections

- **Alerts**:
  - Error rate > 5%
  - Response time > 200ms
  - Memory usage > 80%
  - Unexpected disconnections

## Benefits of Migration
1. **Maintainability**: Modular code is easier to understand and modify
2. **Testability**: Individual modules can be unit tested
3. **Scalability**: Easy to add new features and widgets
4. **Performance**: Better resource management
5. **Developer Experience**: Clear structure and separation of concerns

## Risk Mitigation
- **Parallel running**: Both servers can run simultaneously
- **Gradual migration**: No big-bang deployment
- **Comprehensive testing**: All features tested before migration
- **Easy rollback**: Quick switch back to legacy
- **Monitoring**: Real-time visibility into system health

## Timeline
- Week 1: Integration testing
- Week 2: Staging deployment
- Week 3: Canary deployment (10% traffic)
- Week 4: Full deployment
- Week 5: Legacy cleanup

## Success Criteria
- Zero downtime during migration
- No degradation in performance
- All features working correctly
- Positive developer feedback
- Successful load testing