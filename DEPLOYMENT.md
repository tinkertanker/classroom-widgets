# Docker Deployment Guide

This guide covers deploying the Classroom Widgets application on your own server using Docker.

## Overview

The application consists of two Docker containers:
- **Frontend**: React app served by Nginx (widgets.tk.sg)
- **Backend**: Node.js server with Socket.io (go.tk.sg)

### Architecture Details

This is a **2-server architecture**, not 3:

1. **Frontend Container (Teacher App)**
   - Main React application for classroom widgets
   - Built with Create React App
   - Served by Nginx in production
   - Teachers access this at widgets.tk.sg

2. **Backend Container (Dual Purpose)**
   - Express server that handles:
     - **API & WebSocket**: Real-time features for Poll and DataShare widgets
     - **Student App Hosting**: Serves the student React app at `/student`
   - The student app is built separately (with Vite) but served by Express
   - Students access at go.tk.sg/student
   - **No separate Nginx for student app**

This efficient design means:
- Only 2 containers to deploy and manage
- Student app and API share the same origin (no CORS issues)
- Simpler SSL certificate configuration
- Unified logging and monitoring

## Prerequisites

- Docker 20.x or higher installed on your server
- Docker Compose installed
- Two domains/subdomains configured pointing to your server
- SSL certificates (recommended: Let's Encrypt)

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/classroom-widgets.git
cd classroom-widgets
```

### 2. Configure Environment

Create production environment files:
```bash
# Frontend environment
cp .env.production.example .env.production

# Backend environment
cd server
cp .env.production.example .env.production
cd ..
```

Edit `.env.production` to set your server URL:
```
REACT_APP_SERVER_URL=https://go.tk.sg
```

Edit `server/.env.production`:
```
NODE_ENV=production
PORT=3001
CORS_ORIGINS=https://widgets.tk.sg
```

### 3. Configure Short.io API Key (Optional)
```bash
# Copy environment template
cp .env.example .env
# Edit .env and set VITE_SHORTIO_API_KEY to your API key
```

### 4. Deploy with Docker Compose

Build and start the containers:
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

This will:
- Build both frontend and backend images
- Start containers with automatic restart
- Frontend accessible on port 80
- Backend accessible on port 3001

## SSL/TLS Setup

### Option 1: Reverse Proxy (Recommended)

Use Nginx as a reverse proxy with Let's Encrypt:

1. Install Nginx and Certbot on your server
2. Configure Nginx sites for both domains
3. Obtain SSL certificates:
```bash
sudo certbot --nginx -d widgets.tk.sg -d go.tk.sg
```

Example Nginx configuration for frontend:
```nginx
server {
    server_name widgets.tk.sg;
    
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/widgets.tk.sg/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/widgets.tk.sg/privkey.pem;
}
```

Example Nginx configuration for backend:
```nginx
server {
    server_name go.tk.sg;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/go.tk.sg/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/go.tk.sg/privkey.pem;
}
```

### Option 2: Docker with SSL

Modify `docker-compose.prod.yml` to mount certificates and use `docker-compose.nginx.yml` configuration.

## Management Commands

### View logs
```bash
# All containers
docker-compose -f docker-compose.prod.yml logs -f

# Specific container
docker logs -f classroom-widgets-frontend
docker logs -f classroom-widgets-backend
```

### Restart containers
```bash
docker-compose -f docker-compose.prod.yml restart
```

### Stop containers
```bash
docker-compose -f docker-compose.prod.yml down
```

### Update deployment
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

## Health Checks

Verify deployment:
```bash
# Frontend
curl http://localhost:80

# Backend
curl http://localhost:3001/health
```

## Backup

Create a backup script:
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"

# Backup application
tar -czf $BACKUP_DIR/classroom-widgets_$DATE.tar.gz \
  docker-compose.yml \
  docker-compose.prod.yml \
  .env.production \
  server/.env.production

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

## Monitoring

Basic monitoring script:
```bash
#!/bin/bash
# monitor.sh

# Check if containers are running
if ! docker ps | grep -q classroom-widgets-frontend; then
    echo "Frontend container is down!"
    # Send alert or restart
fi

if ! docker ps | grep -q classroom-widgets-backend; then
    echo "Backend container is down!"
    # Send alert or restart
fi
```

## Troubleshooting

### Container won't start
```bash
docker logs classroom-widgets-frontend
docker logs classroom-widgets-backend
```

### Permission issues
```bash
# Fix ownership
sudo chown -R $USER:$USER .
```

### Network issues
```bash
# Check if ports are available
sudo netstat -tlnp | grep -E ':(80|3001)'

# Inspect network
docker network inspect classroom-widgets
```

### Rebuild from scratch
```bash
docker-compose -f docker-compose.prod.yml down -v
docker system prune -a
docker-compose -f docker-compose.prod.yml up -d --build
```

## Features Requiring Backend

The following widgets require the backend server:
- Poll Widget - Real-time voting
- Data Share Widget - Collaborative link sharing

These widgets show a network indicator icon when the backend is required.