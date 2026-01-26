# Deployment Guide

Complete guide for deploying Classroom Widgets to production.

## Table of Contents
- [Quick Deploy](#quick-deploy)
- [Docker Deployment](#docker-deployment)
- [Environment Variables](#environment-variables)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Troubleshooting](#troubleshooting)

## Quick Deploy

### Prerequisites
- Docker and Docker Compose
- Domain/subdomain pointing to your server
- SSL certificates (recommended: Let's Encrypt)

### Deployment Steps

1. **Clone and configure**:
```bash
git clone https://github.com/yourusername/classroom-widgets.git
cd classroom-widgets

# Copy environment files
cp .env.production.example .env.production
cp server/.env.production.example server/.env.production
```

2. **Edit environment variables**:

`.env.production`:
```env
VITE_SERVER_URL=https://your-backend-domain.com
```

`server/.env.production`:
```env
PORT=3001
CORS_ORIGINS=https://your-frontend-domain.com
```

3. **Build and deploy**:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

4. **Verify**:
- Teacher App: https://your-frontend-domain.com
- Student App: https://your-backend-domain.com/student
- API Health: https://your-backend-domain.com/api/health

## Docker Deployment

### Architecture

Core services run in Docker:
- **`frontend`**: Teacher App (React + Vite) served by Nginx
- **`backend`**: Express server (API + WebSocket + serves Student App)

Optional services:
- **`umami`**: Privacy-focused analytics dashboard
- **`umami-db`**: PostgreSQL database for Umami

See [Analytics Setup](./ANALYTICS.md) for Umami configuration.

### Production Deployment

```bash
# Build and start containers
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop services
docker compose -f docker-compose.prod.yml down

# Update deployment
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### Local Testing (Staging)

Test the Docker setup locally before production:

```bash
# Copy staging environment file
cp .env.staging.example .env.staging

# Edit .env.staging to set:
# VITE_SERVER_URL=http://localhost:3001
# CORS_ORIGINS=http://localhost:3000,http://localhost

# Build and run staging environment
docker compose -f docker-compose.staging.yml up --build

# Or use the test script
./docker-test-local.sh
```

Access staging:
- Teacher App: http://localhost:3000
- Student App: http://localhost:3000/student
- Backend: http://localhost:3001

**Staging Testing Checklist:**
- [ ] Teacher can create a session
- [ ] Student can join via session code
- [ ] All widgets work (Poll, Timer, Questions, etc.)
- [ ] WebSocket connections are stable
- [ ] Dark mode works correctly
- [ ] No console errors

## Environment Variables

### Teacher App (`/.env.production`)

All variables must be prefixed with `VITE_`:

```env
# Required: Backend server URL
VITE_SERVER_URL=https://your-backend-domain.com

# Optional: Link Shortener widget API key
VITE_SHORTIO_API_KEY=your_api_key

# Optional: Umami Analytics (see docs/ANALYTICS.md)
VITE_UMAMI_SCRIPT_URL=https://your-umami-domain.com/script.js
VITE_UMAMI_WEBSITE_ID=your-website-id
```

### Backend Server (`server/.env.production`)

```env
# Required: Server port
PORT=3001

# Required: Allowed CORS origins (comma-separated)
CORS_ORIGINS=https://teacher-app.com,https://student-app.com

# Optional: Logging level (error|warn|info|debug)
LOG_LEVEL=info

# Optional: Room cleanup settings
MAX_ROOM_AGE=43200000      # 12 hours in milliseconds
CLEANUP_INTERVAL=3600000   # 1 hour in milliseconds
```

### Variable Reference

**`VITE_SERVER_URL`** (Required)
- Backend server URL for WebSocket connections
- Development: `http://localhost:3001`
- Production: `https://api.your-domain.com`

**`PORT`** (Required)
- Port for Express server
- Default: `3001`

**`CORS_ORIGINS`** (Required)
- Comma-separated allowed origins
- Must match your frontend URLs exactly
- No trailing slashes

**`LOG_LEVEL`** (Optional)
- Controls logging verbosity
- Values: `error`, `warn`, `info`, `debug`
- Default: `info`

**`MAX_ROOM_AGE`** (Optional)
- Maximum age of rooms before cleanup (milliseconds)
- Default: `43200000` (12 hours)

**`CLEANUP_INTERVAL`** (Optional)
- Interval for room cleanup (milliseconds)
- Default: `3600000` (1 hour)

### Best Practices

1. **Never commit sensitive data**:
```bash
# .gitignore already includes
.env
.env.local
.env.production
.env.*.local
```

2. **Use example files** for documentation:
```bash
# Always provide .env.example
cp .env.production .env.production.example
# Then remove sensitive values from .example file
```

3. **Validate required variables** on startup.

4. **Set restrictive permissions**:
```bash
chmod 600 .env.production
```

## SSL/TLS Configuration

### Using Nginx Reverse Proxy (Recommended)

Install Nginx and Certbot on your host:

```bash
# Install
sudo apt install nginx certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-frontend-domain.com
sudo certbot --nginx -d your-backend-domain.com
```

### Frontend Nginx Configuration

`/etc/nginx/sites-available/frontend.conf`:

```nginx
server {
    server_name your-frontend-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/your-frontend-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-frontend-domain.com/privkey.pem;

    # Strong SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your-frontend-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### Backend Nginx Configuration

`/etc/nginx/sites-available/backend.conf`:

```nginx
server {
    server_name your-backend-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Standard headers
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/your-backend-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-backend-domain.com/privkey.pem;

    # Strong SSL configuration (same as frontend)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your-backend-domain.com;
    return 301 https://$server_name$request_uri;
}
```

Enable sites and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/frontend.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/backend.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically sets up cron job
# Verify: sudo systemctl status certbot.timer
```

## Troubleshooting

### Container Issues

**Container won't start:**
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Check specific service
docker compose -f docker-compose.prod.yml logs backend

# Rebuild without cache
docker compose -f docker-compose.prod.yml build --no-cache

# Check resources
docker system df
docker stats
```

**Permission issues:**
```bash
# Ensure proper ownership
sudo chown -R $USER:$USER .
```

**Port conflicts:**
```bash
# Find process using port
lsof -i :3001
netstat -tulpn | grep 3001

# Kill process
kill -9 <PID>

# Or change ports in docker-compose.prod.yml
```

### Network Issues

**CORS errors:**
1. Verify `CORS_ORIGINS` includes your frontend URL
2. Check for trailing slashes (shouldn't have them)
3. Ensure protocol matches (http vs https)

```env
# Correct
CORS_ORIGINS=https://widgets.tk.sg,https://go.tk.sg

# Incorrect (trailing slashes)
CORS_ORIGINS=https://widgets.tk.sg/,https://go.tk.sg/
```

**WebSocket connection failed:**
1. Check Nginx WebSocket configuration
2. Verify firewall allows WebSocket port
3. Test connection:
```bash
curl http://localhost:3001/health
```

**Student app not loading:**
1. Check backend build completed successfully
2. Verify student app built to `server/public/`
3. Check backend logs for errors

### Build Issues

**Build fails:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npm run build:all

# Check Node version (should be 18+)
node --version
```

**TypeScript errors:**
```bash
# Check for issues
npx tsc --noEmit
```

**Missing environment variables:**
```bash
# Ensure production env files exist
ls -la .env.production server/.env.production

# Debug: Print environment in container
docker exec classroom-widgets-backend env | grep -E "PORT|CORS"
```

### Application Issues

**Blank white page:**
1. Check browser console (F12) for errors
2. Verify build output exists:
```bash
ls -la build/
# Should contain index.html and static/ folder
```
3. Check Nginx configuration:
```nginx
try_files $uri $uri/ /index.html;
```

**Widgets not working:**
1. Check server connection indicator in UI
2. Verify WebSocket connection in browser console
3. Check server logs:
```bash
docker logs classroom-widgets-backend --tail 100
```

**High memory usage:**
```bash
# Set memory limits in docker-compose.prod.yml
services:
  backend:
    mem_limit: 1g

# Monitor usage
docker stats
```

### Health Check Script

Create `health-check.sh`:

```bash
#!/bin/bash
echo "=== Classroom Widgets Health Check ==="

# Check frontend
echo -n "Frontend: "
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 | grep -q "200"; then
    echo "✓ OK"
else
    echo "✗ FAILED"
fi

# Check backend
echo -n "Backend: "
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health | grep -q "200"; then
    echo "✓ OK"
else
    echo "✗ FAILED"
fi

# Check Docker containers
echo -n "Docker: "
if docker ps | grep -q "classroom-widgets"; then
    echo "✓ Running"
else
    echo "✗ Not running"
fi
```

### Emergency Recovery

**Complete system down:**
```bash
# Quick restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Rollback to previous version
git checkout <last-working-commit>
docker compose -f docker-compose.prod.yml up -d --build
```

**Clear all data and restart:**
```bash
docker compose -f docker-compose.prod.yml down -v
docker system prune -a
docker compose -f docker-compose.prod.yml up -d --build
```

## Managing the Deployment

### Viewing Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service with tail
docker compose -f docker-compose.prod.yml logs -f --tail 100 backend

# Save logs to file
docker compose -f docker-compose.prod.yml logs > deployment.log
```

### Updating

```bash
# Standard update
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Zero-downtime update (requires setup)
docker compose -f docker-compose.prod.yml up -d --no-deps --build backend
```

### Monitoring

```bash
# Container stats
docker stats

# Check disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

## Security Checklist

### Pre-Deployment
- [ ] Run security audit: `npm audit`
- [ ] Update all dependencies
- [ ] Review environment variables
- [ ] Scan Docker images for vulnerabilities
- [ ] Configure firewall rules
- [ ] Enable HTTPS
- [ ] Set up monitoring

### Production
- [ ] Disable debug mode
- [ ] Remove development dependencies
- [ ] Configure strong SSL/TLS
- [ ] Set up log rotation
- [ ] Enable auto-renewal for SSL certificates
- [ ] Restrict file permissions (chmod 600 .env)
- [ ] Configure CORS properly
- [ ] Set up automated backups

## Performance Optimization

### Nginx

```nginx
# Enable compression
gzip on;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
gzip_min_length 1000;

# Enable caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Docker

```yaml
# Resource limits in docker-compose.prod.yml
services:
  backend:
    mem_limit: 1g
    cpus: 1.0
```

## Platform-Specific Notes

### AWS
- Use ECS/Fargate for container hosting
- CloudFront for CDN
- Route53 for DNS
- Certificate Manager for SSL

### DigitalOcean
- Use App Platform or Droplets
- Spaces for static assets
- Load Balancer for scaling

### Heroku
```bash
heroku config:set VITE_SERVER_URL=https://your-app.herokuapp.com
heroku config:set NODE_ENV=production
```

## Getting Help

When reporting issues, include:
1. Docker logs: `docker compose logs`
2. System info: `node --version`, `docker --version`
3. Environment (sanitized, no secrets)
4. Steps to reproduce
5. Error messages from browser console

For more help, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) or open an issue on GitHub.
