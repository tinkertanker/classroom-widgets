# Docker Deployment Guide

This guide covers deploying the Classroom Widgets application using Docker containers.

## Architecture

The application consists of two Docker containers:
1. **Frontend Container** (widgets.tk.sg) - Nginx serving the React build
2. **Backend Container** (go.tk.sg) - Node.js server with Socket.io

## Local Development with Docker

### Build and run both containers:
```bash
docker-compose up --build
```

This will:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### Stop containers:
```bash
docker-compose down
```

## Production Deployment

### Option 1: Using Docker Compose (Recommended for single server)

1. **Build production images**:
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```

2. **Run in production**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Option 2: Separate Deployments

#### Frontend (widgets.tk.sg)

1. **Build the image**:
   ```bash
   docker build \
     --build-arg REACT_APP_SERVER_URL=https://go.tk.sg \
     -t classroom-widgets-frontend:latest \
     .
   ```

2. **Run the container**:
   ```bash
   docker run -d \
     --name classroom-widgets-frontend \
     -p 80:80 \
     --restart unless-stopped \
     classroom-widgets-frontend:latest
   ```

#### Backend (go.tk.sg)

1. **Build the image**:
   ```bash
   cd server
   docker build -t classroom-widgets-backend:latest .
   ```

2. **Run the container**:
   ```bash
   docker run -d \
     --name classroom-widgets-backend \
     -p 3001:3001 \
     -e NODE_ENV=production \
     -e PORT=3001 \
     -e CORS_ORIGINS=https://widgets.tk.sg \
     --restart unless-stopped \
     classroom-widgets-backend:latest
   ```

## Docker Hub Deployment

### Push images to Docker Hub:

1. **Tag images**:
   ```bash
   docker tag classroom-widgets-frontend:latest yourusername/classroom-widgets-frontend:latest
   docker tag classroom-widgets-backend:latest yourusername/classroom-widgets-backend:latest
   ```

2. **Push to Docker Hub**:
   ```bash
   docker push yourusername/classroom-widgets-frontend:latest
   docker push yourusername/classroom-widgets-backend:latest
   ```

3. **Deploy on target servers**:
   ```bash
   # On widgets.tk.sg server
   docker pull yourusername/classroom-widgets-frontend:latest
   docker run -d --name frontend -p 80:80 yourusername/classroom-widgets-frontend:latest

   # On go.tk.sg server
   docker pull yourusername/classroom-widgets-backend:latest
   docker run -d --name backend -p 80:3001 \
     -e NODE_ENV=production \
     -e CORS_ORIGINS=https://widgets.tk.sg \
     yourusername/classroom-widgets-backend:latest
   ```

## Health Checks

### Frontend health check:
```bash
curl http://widgets.tk.sg
```

### Backend health check:
```bash
curl http://go.tk.sg/share
```

## Updating Containers

1. **Pull latest code**
2. **Rebuild images**:
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```
3. **Restart containers**:
   ```bash
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml up -d
   ```

## Monitoring

### View logs:
```bash
# All containers
docker-compose -f docker-compose.prod.yml logs -f

# Specific container
docker logs -f classroom-widgets-frontend
docker logs -f classroom-widgets-backend
```

### Check container status:
```bash
docker ps
```

## SSL/TLS Configuration

For production, you'll need to add SSL certificates. Options:

1. **Using a reverse proxy** (Recommended):
   - Deploy Nginx/Traefik as a reverse proxy
   - Configure SSL certificates (Let's Encrypt)
   - Proxy requests to Docker containers

2. **Modify Nginx config in frontend**:
   - Mount SSL certificates as volumes
   - Update nginx.conf for HTTPS

Example with reverse proxy:
```nginx
server {
    listen 443 ssl;
    server_name widgets.tk.sg;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Troubleshooting

### Container won't start:
```bash
docker logs container-name
```

### Network issues between containers:
```bash
docker network ls
docker network inspect classroom-widgets
```

### Rebuild from scratch:
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```