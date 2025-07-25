# Docker Deployment Quick Reference

This is a quick reference guide for deploying Classroom Widgets with Docker.

## Development Setup

```bash
# Start both frontend and backend
docker compose up --build

# Access:
# - Frontend: http://localhost:3000
# - Backend: http://localhost:3001
```

## Production Deployment

### 1. Initial Setup

```bash
# Clone repository on your server
git clone https://github.com/yourusername/classroom-widgets.git
cd classroom-widgets

# Configure environment
cp .env.production.example .env.production
cp server/.env.production.example server/.env.production

# Add Short.io API key (optional - for Link Shortener widget)
cp .env.example .env
# Edit .env and set VITE_SHORTIO_API_KEY to your API key
```

### 2. Deploy

```bash
# Build and start in detached mode
docker compose -f docker compose.prod.yml up -d --build

# Verify containers are running
docker ps
```

### 3. Container Management

```bash
# View logs
docker compose -f docker compose.prod.yml logs -f

# Stop containers
docker compose -f docker compose.prod.yml down

# Restart containers
docker compose -f docker compose.prod.yml restart

# Update deployment
git pull
docker compose -f docker compose.prod.yml down
docker compose -f docker compose.prod.yml up -d --build
```

## SSL Configuration

### Using Nginx Reverse Proxy

1. Install Nginx on host:
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
```

2. Create Nginx config for frontend (`/etc/nginx/sites-available/widgets.tk.sg`):
```nginx
server {
    server_name widgets.tk.sg;
    
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

3. Create Nginx config for backend (`/etc/nginx/sites-available/go.tk.sg`):
```nginx
server {
    server_name go.tk.sg;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

4. Enable sites and get SSL certificates:
```bash
sudo ln -s /etc/nginx/sites-available/widgets.tk.sg /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/go.tk.sg /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d widgets.tk.sg -d go.tk.sg
```

## Health Checks

```bash
# Check frontend
curl -I http://localhost:80

# Check backend
curl http://localhost:3001/health

# Check container status
docker compose -f docker compose.prod.yml ps
```

## Troubleshooting

```bash
# View container logs
docker logs classroom-widgets-frontend
docker logs classroom-widgets-backend

# Enter container for debugging
docker exec -it classroom-widgets-backend sh

# Check resource usage
docker stats

# Clean rebuild
docker compose -f docker compose.prod.yml down -v
docker system prune -a
docker compose -f docker compose.prod.yml up -d --build
```

## Backup Script

Create `/opt/backup-classroom-widgets.sh`:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/classroom-widgets"
mkdir -p $BACKUP_DIR

cd /path/to/classroom-widgets
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz \
  docker compose*.yml \
  .env.production \
  server/.env.production \
  .env

find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

Add to crontab:
```bash
0 2 * * * /opt/backup-classroom-widgets.sh
```