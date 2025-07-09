# Troubleshooting Guide

This guide helps diagnose and resolve common issues with the Classroom Widgets application.

## Table of Contents
1. [Quick Diagnostics](#quick-diagnostics)
2. [Frontend Issues](#frontend-issues)
3. [Backend Issues](#backend-issues)
4. [Widget-Specific Issues](#widget-specific-issues)
5. [Docker Issues](#docker-issues)
6. [Network and Connectivity](#network-and-connectivity)
7. [Performance Issues](#performance-issues)
8. [Development Issues](#development-issues)
9. [Deployment Issues](#deployment-issues)
10. [Emergency Procedures](#emergency-procedures)

## Quick Diagnostics

### Health Check Script

Create this script to quickly diagnose common issues:

```bash
#!/bin/bash
# health-check.sh

echo "=== Classroom Widgets Health Check ==="
echo

# Check if frontend is accessible
echo -n "Frontend Status: "
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    echo "✓ OK"
else
    echo "✗ FAILED"
fi

# Check if backend is accessible
echo -n "Backend Status: "
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health | grep -q "200"; then
    echo "✓ OK"
else
    echo "✗ FAILED"
fi

# Check Node version
echo -n "Node Version: "
node --version

# Check npm version
echo -n "NPM Version: "
npm --version

# Check for required files
echo -n "Short.io Key: "
if [ -f "src/secrets/shortioKey.js" ]; then
    echo "✓ Found"
else
    echo "✗ Missing"
fi

# Check environment files
echo -n "Frontend .env: "
if [ -f ".env.production" ]; then
    echo "✓ Found"
else
    echo "✗ Missing"
fi

echo -n "Backend .env: "
if [ -f "server/.env.production" ]; then
    echo "✓ Found"
else
    echo "✗ Missing"
fi

# Check Docker (if applicable)
if command -v docker &> /dev/null; then
    echo -n "Docker Status: "
    if docker ps &> /dev/null; then
        echo "✓ Running"
    else
        echo "✗ Not running"
    fi
fi
```

## Frontend Issues

### Build Failures

#### Issue: `npm run build` fails

**Symptoms:**
- Build process exits with error
- Missing dependencies errors
- TypeScript errors

**Solutions:**

1. **Clear cache and reinstall**:
   ```bash
   rm -rf node_modules package-lock.json
   npm cache clean --force
   npm install
   npm run build
   ```

2. **Check Node version**:
   ```bash
   node --version  # Should be 18.x or higher
   ```

3. **Fix TypeScript errors**:
   ```bash
   # Check for TypeScript issues
   npx tsc --noEmit
   ```

4. **Environment variables**:
   ```bash
   # Ensure production env file exists
   cp .env.example .env.production
   # Edit and add required values
   ```

### Page Not Loading

#### Issue: Blank white page

**Symptoms:**
- Browser shows white screen
- No error messages visible
- Network tab shows 404 errors

**Solutions:**

1. **Check browser console**:
   - Press F12 to open developer tools
   - Look for red error messages
   - Common: "Failed to load resource"

2. **Verify build output**:
   ```bash
   ls -la build/
   # Should contain index.html and static/ folder
   ```

3. **Check server configuration**:
   ```nginx
   # nginx.conf should have:
   try_files $uri $uri/ /index.html;
   ```

4. **React Router issues**:
   ```javascript
   // Ensure basename is set if not serving from root
   <BrowserRouter basename="/app">
   ```

### Styling Issues

#### Issue: Broken layouts or missing styles

**Solutions:**

1. **Rebuild Tailwind CSS**:
   ```bash
   npm run build:css
   ```

2. **Check Tailwind config**:
   ```javascript
   // tailwind.config.js
   content: [
     "./src/**/*.{js,jsx,ts,tsx}",
   ],
   ```

3. **Clear browser cache**:
   - Ctrl+Shift+R (Windows/Linux)
   - Cmd+Shift+R (Mac)

## Backend Issues

### Server Won't Start

#### Issue: `node src/index.js` fails

**Symptoms:**
- "Port already in use" error
- Module not found errors
- Connection refused errors

**Solutions:**

1. **Port conflict**:
   ```bash
   # Find process using port 3001
   lsof -i :3001
   # or
   netstat -tulpn | grep 3001
   
   # Kill the process
   kill -9 <PID>
   ```

2. **Missing dependencies**:
   ```bash
   cd server
   npm install --production
   ```

3. **Environment variables**:
   ```bash
   # Check if .env file exists
   ls -la server/.env*
   
   # Create from example
   cp server/.env.example server/.env.production
   ```

### WebSocket Connection Failed

#### Issue: Real-time features not working

**Symptoms:**
- Poll votes not updating
- "WebSocket connection failed" in console
- Socket.io reconnecting messages

**Solutions:**

1. **Check CORS configuration**:
   ```javascript
   // server/.env
   CORS_ORIGINS=http://localhost:3000,https://widgets.tk.sg
   ```

2. **Verify WebSocket support**:
   ```nginx
   # Add to nginx config
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   ```

3. **Firewall settings**:
   ```bash
   # Allow WebSocket port
   sudo ufw allow 3001/tcp
   ```

4. **Test WebSocket connection**:
   ```javascript
   // Browser console test
   const socket = io('http://localhost:3001');
   socket.on('connect', () => console.log('Connected!'));
   ```

## Widget-Specific Issues

### Poll Widget

#### Issue: Can't create or join rooms

**Solutions:**

1. **Check server connection**:
   ```bash
   curl http://localhost:3001/health
   ```

2. **Verify room code generation**:
   ```javascript
   // Should be 4 digits
   console.log('Room code:', roomCode);
   ```

3. **Clear expired rooms**:
   ```bash
   # Restart server to clear all rooms
   pm2 restart classroom-widgets-api
   ```

### Link Shortener Widget

#### Issue: URL shortening fails

**Solutions:**

1. **Verify API key**:
   ```javascript
   // src/secrets/shortioKey.js
   const shortioKey = 'your-actual-key';
   export default shortioKey;
   ```

2. **CORS issues** (production only):
   - Short.io API doesn't support browser CORS
   - Consider proxy solution or server-side implementation

### Data Share Widget

#### Issue: Links not appearing

**Solutions:**

1. **Check server logs**:
   ```bash
   docker logs classroom-widgets-backend
   # or
   pm2 logs classroom-widgets-api
   ```

2. **Verify socket events**:
   ```javascript
   // Browser console
   socket.on('linkUpdate', (data) => console.log('Received:', data));
   ```

## Docker Issues

### Container Won't Start

#### Issue: Docker containers exit immediately

**Solutions:**

1. **Check logs**:
   ```bash
   docker-compose logs -f
   docker logs classroom-widgets-frontend
   docker logs classroom-widgets-backend
   ```

2. **Resource constraints**:
   ```bash
   # Check available resources
   docker system df
   docker stats
   
   # Clean up
   docker system prune -a
   ```

3. **Build issues**:
   ```bash
   # Rebuild without cache
   docker-compose build --no-cache
   ```

### Network Issues Between Containers

#### Issue: Frontend can't reach backend

**Solutions:**

1. **Check network**:
   ```bash
   docker network ls
   docker network inspect classroom-widgets
   ```

2. **Use container names**:
   ```yaml
   # docker-compose.yml
   environment:
     - REACT_APP_SERVER_URL=http://backend:3001
   ```

3. **Verify connectivity**:
   ```bash
   # From frontend container
   docker exec -it classroom-widgets-frontend ping backend
   ```

## Network and Connectivity

### CORS Errors

#### Issue: "Access blocked by CORS policy"

**Solutions:**

1. **Backend configuration**:
   ```javascript
   // Ensure origins match exactly
   const corsOrigins = process.env.CORS_ORIGINS.split(',');
   ```

2. **Include credentials**:
   ```javascript
   // Frontend
   const socket = io(SERVER_URL, {
     withCredentials: true
   });
   ```

3. **Proxy configuration**:
   ```json
   // package.json (development)
   "proxy": "http://localhost:3001"
   ```

### SSL/HTTPS Issues

#### Issue: "Mixed content" warnings

**Solutions:**

1. **Force HTTPS**:
   ```javascript
   // Ensure all URLs use https://
   const SERVER_URL = 'https://go.tk.sg';
   ```

2. **Update nginx**:
   ```nginx
   # Redirect HTTP to HTTPS
   if ($scheme != "https") {
     return 301 https://$server_name$request_uri;
   }
   ```

## Performance Issues

### Slow Loading Times

**Solutions:**

1. **Enable compression**:
   ```nginx
   gzip on;
   gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
   gzip_min_length 1000;
   ```

2. **Optimize images**:
   ```bash
   # Install image optimizer
   npm install -g imagemin-cli
   imagemin public/images/* --out-dir=public/images
   ```

3. **Check bundle size**:
   ```bash
   npm run build
   # Check build/static/js/*.js sizes
   ```

### High Memory Usage

**Solutions:**

1. **Limit Node.js memory**:
   ```bash
   node --max-old-space-size=1024 src/index.js
   ```

2. **PM2 memory limit**:
   ```bash
   pm2 start src/index.js --max-memory-restart 1G
   ```

3. **Docker memory limit**:
   ```yaml
   services:
     backend:
       mem_limit: 1g
   ```

## Development Issues

### Hot Reload Not Working

**Solutions:**

1. **Check file watchers**:
   ```bash
   # Linux: Increase watchers
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

2. **Clear React cache**:
   ```bash
   rm -rf node_modules/.cache
   npm start
   ```

### TypeScript Errors

**Solutions:**

1. **Missing types**:
   ```bash
   npm install --save-dev @types/react @types/react-dom
   ```

2. **Config issues**:
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "jsx": "react-jsx",
       "allowJs": true
     }
   }
   ```

## Deployment Issues

### Build Artifacts Too Large

**Solutions:**

1. **Optimize build**:
   ```bash
   # Production build with optimizations
   NODE_ENV=production npm run build
   ```

2. **Remove source maps**:
   ```bash
   # .env.production
   GENERATE_SOURCEMAP=false
   ```

### Environment Variable Not Working

**Solutions:**

1. **Frontend variables**:
   - Must start with `REACT_APP_`
   - Rebuild after changes

2. **Backend variables**:
   ```bash
   # Debug: Print all env vars
   node -e "console.log(process.env)"
   ```

3. **Docker variables**:
   ```bash
   # Check container environment
   docker exec classroom-widgets-backend env
   ```

## Emergency Procedures

### Complete System Down

1. **Quick recovery**:
   ```bash
   # Docker
   docker-compose down
   docker-compose up -d
   
   # PM2
   pm2 restart all
   
   # Systemd
   sudo systemctl restart classroom-widgets
   ```

2. **Rollback deployment**:
   ```bash
   # Git rollback
   git checkout <last-working-commit>
   npm install
   npm run build
   
   # Docker rollback
   docker-compose down
   docker-compose up -d --force-recreate
   ```

### Data Recovery

1. **Backup locations**:
   - Widget states: Browser localStorage
   - Server data: In-memory (no persistence by default)

2. **Export localStorage**:
   ```javascript
   // Browser console
   const backup = {};
   for (let i = 0; i < localStorage.length; i++) {
     const key = localStorage.key(i);
     backup[key] = localStorage.getItem(key);
   }
   console.log(JSON.stringify(backup));
   ```

### Debug Mode

Enable comprehensive logging:

```bash
# Frontend
REACT_APP_DEBUG=true npm start

# Backend
DEBUG=* node src/index.js

# Docker
docker-compose up  # No -d flag to see logs
```

## Getting Help

### Collect Diagnostic Information

When reporting issues, include:

1. **System info**:
   ```bash
   node --version
   npm --version
   docker --version
   uname -a
   ```

2. **Error logs**:
   ```bash
   # Last 100 lines of logs
   docker logs --tail 100 classroom-widgets-backend
   pm2 logs --lines 100
   ```

3. **Browser info**:
   - Browser version
   - Console errors (F12)
   - Network tab failures

4. **Steps to reproduce**

### Support Channels

1. **GitHub Issues**: Report bugs and feature requests
2. **Documentation**: Check CLAUDE.md and README.md
3. **Community**: Discord or Slack channels (if available)

## Preventive Measures

### Monitoring Setup

1. **Health checks**:
   ```bash
   # Cron job for monitoring
   */5 * * * * /path/to/health-check.sh || alert-admin.sh
   ```

2. **Log rotation**:
   ```bash
   # PM2 log rotation
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 100M
   ```

3. **Backup script**:
   ```bash
   #!/bin/bash
   # Daily backup
   tar -czf backup-$(date +%Y%m%d).tar.gz build/ server/
   ```

Remember: Most issues can be resolved by:
1. Checking logs
2. Verifying configuration
3. Restarting services
4. Clearing caches