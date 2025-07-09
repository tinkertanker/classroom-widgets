# Comprehensive Deployment Guide for Classroom Widgets

This guide provides detailed instructions for deploying the Classroom Widgets application in various environments.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Options](#deployment-options)
4. [Environment Configuration](#environment-configuration)
5. [Docker Deployment](#docker-deployment)
6. [Traditional Deployment](#traditional-deployment)
7. [Cloud Platform Deployment](#cloud-platform-deployment)
8. [SSL/TLS Configuration](#ssltls-configuration)
9. [Monitoring and Maintenance](#monitoring-and-maintenance)
10. [Troubleshooting](#troubleshooting)
11. [Security Best Practices](#security-best-practices)

## Overview

Classroom Widgets consists of two main components:
- **Frontend**: React application served via Nginx (widgets.tk.sg)
- **Backend**: Node.js/Express server with Socket.io (go.tk.sg)

### Features Requiring Backend Server
- Poll Widget - Real-time voting system
- Data Share Widget - Collaborative link sharing

## Prerequisites

### System Requirements
- Node.js 18.x or higher
- npm 8.x or higher
- Docker 20.x (for containerized deployment)
- 2GB RAM minimum (4GB recommended)
- 10GB disk space

### Domain Setup
- Two domains/subdomains configured:
  - Frontend: widgets.tk.sg (or your domain)
  - Backend: go.tk.sg (or your domain)
- SSL certificates (Let's Encrypt recommended)
- DNS records pointing to your servers

## Deployment Options

### Option 1: Docker Deployment (Recommended)
Best for: Production environments, easy scaling, consistent deployments

### Option 2: Traditional Deployment
Best for: Shared hosting, budget VPS, manual control

### Option 3: Cloud Platform Deployment
Best for: Auto-scaling, managed infrastructure, high availability

## Environment Configuration

### Frontend Environment Variables

Create `.env.production` from `.env.production.example`:

```bash
# Frontend Configuration
REACT_APP_SERVER_URL=https://go.tk.sg

# Optional: Analytics, tracking, etc.
# REACT_APP_GA_ID=your-google-analytics-id
```

### Backend Environment Variables

Create `server/.env.production` from `server/.env.production.example`:

```bash
# Server Configuration
NODE_ENV=production
PORT=3001

# CORS Configuration
CORS_ORIGINS=https://widgets.tk.sg,https://go.tk.sg

# Optional: Database, Redis, etc.
# REDIS_URL=redis://localhost:6379
```

### Short.io API Key Setup

1. Copy the example file:
   ```bash
   cp src/secrets/shortioKey.example.js src/secrets/shortioKey.js
   ```

2. Add your Short.io API key:
   ```javascript
   const shortioKey = 'your-actual-api-key-here';
   export default shortioKey;
   ```

## Docker Deployment

### Quick Start with Docker Compose

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/classroom-widgets.git
   cd classroom-widgets
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env.production
   cp server/.env.example server/.env.production
   # Edit both files with production values
   ```

3. **Build and run for development**:
   ```bash
   docker-compose up --build
   ```

4. **Build and run for production**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

### Production Docker Deployment

#### Using Pre-built Images

1. **Pull images from Docker Hub**:
   ```bash
   docker pull yourusername/classroom-widgets-frontend:latest
   docker pull yourusername/classroom-widgets-backend:latest
   ```

2. **Run containers**:
   ```bash
   # Frontend
   docker run -d \
     --name classroom-widgets-frontend \
     -p 80:80 \
     --restart unless-stopped \
     yourusername/classroom-widgets-frontend:latest

   # Backend
   docker run -d \
     --name classroom-widgets-backend \
     -p 3001:3001 \
     -e NODE_ENV=production \
     -e PORT=3001 \
     -e CORS_ORIGINS=https://widgets.tk.sg \
     --restart unless-stopped \
     yourusername/classroom-widgets-backend:latest
   ```

#### Building Custom Images

1. **Build frontend image**:
   ```bash
   docker build \
     --build-arg REACT_APP_SERVER_URL=https://go.tk.sg \
     -t classroom-widgets-frontend:latest \
     .
   ```

2. **Build backend image**:
   ```bash
   cd server
   docker build -t classroom-widgets-backend:latest .
   cd ..
   ```

3. **Push to registry** (optional):
   ```bash
   docker tag classroom-widgets-frontend:latest yourusername/classroom-widgets-frontend:latest
   docker tag classroom-widgets-backend:latest yourusername/classroom-widgets-backend:latest
   
   docker push yourusername/classroom-widgets-frontend:latest
   docker push yourusername/classroom-widgets-backend:latest
   ```

### Docker Swarm Deployment

For high availability across multiple nodes:

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml classroom-widgets

# Scale services
docker service scale classroom-widgets_backend=3
```

## Traditional Deployment

### Frontend Deployment

1. **Build the application**:
   ```bash
   npm install
   npm run build
   ```

2. **Deploy to web server**:
   ```bash
   # Using rsync
   rsync -avz --delete build/ user@widgets.tk.sg:/var/www/widgets/

   # Using SCP
   scp -r build/* user@widgets.tk.sg:/var/www/widgets/
   ```

3. **Configure Nginx** (if not using Docker):
   ```nginx
   server {
       listen 80;
       server_name widgets.tk.sg;
       
       root /var/www/widgets;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
       
       # Gzip compression
       gzip on;
       gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
       
       # Security headers
       add_header X-Frame-Options "SAMEORIGIN" always;
       add_header X-Content-Type-Options "nosniff" always;
       add_header X-XSS-Protection "1; mode=block" always;
   }
   ```

### Backend Deployment

1. **Upload server files**:
   ```bash
   rsync -avz --exclude 'node_modules' server/ user@go.tk.sg:/var/www/api/
   ```

2. **Install dependencies**:
   ```bash
   ssh user@go.tk.sg
   cd /var/www/api
   npm install --production
   ```

3. **Setup PM2 process manager**:
   ```bash
   npm install -g pm2
   
   # Create ecosystem file
   cat > ecosystem.config.js << EOF
   module.exports = {
     apps: [{
       name: 'classroom-widgets-api',
       script: './src/index.js',
       instances: 'max',
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 3001
       },
       error_file: './logs/err.log',
       out_file: './logs/out.log',
       log_file: './logs/combined.log',
       time: true
     }]
   };
   EOF
   
   # Start application
   pm2 start ecosystem.config.js
   
   # Save PM2 configuration
   pm2 save
   pm2 startup
   ```

## Cloud Platform Deployment

### AWS Deployment

#### Using Elastic Beanstalk

1. **Install EB CLI**:
   ```bash
   pip install awsebcli
   ```

2. **Initialize EB**:
   ```bash
   eb init -p docker classroom-widgets
   ```

3. **Create environment**:
   ```bash
   eb create production
   ```

4. **Deploy**:
   ```bash
   eb deploy
   ```

#### Using ECS with Fargate

1. **Push images to ECR**:
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin [account-id].dkr.ecr.us-east-1.amazonaws.com
   
   docker tag classroom-widgets-frontend:latest [account-id].dkr.ecr.us-east-1.amazonaws.com/classroom-widgets-frontend:latest
   docker push [account-id].dkr.ecr.us-east-1.amazonaws.com/classroom-widgets-frontend:latest
   ```

2. **Create task definitions** and services through AWS Console or CLI

### Google Cloud Platform

#### Using Cloud Run

1. **Build and push to GCR**:
   ```bash
   gcloud builds submit --tag gcr.io/[PROJECT-ID]/classroom-widgets-frontend
   gcloud builds submit --tag gcr.io/[PROJECT-ID]/classroom-widgets-backend ./server
   ```

2. **Deploy services**:
   ```bash
   gcloud run deploy classroom-widgets-frontend \
     --image gcr.io/[PROJECT-ID]/classroom-widgets-frontend \
     --platform managed \
     --allow-unauthenticated
   
   gcloud run deploy classroom-widgets-backend \
     --image gcr.io/[PROJECT-ID]/classroom-widgets-backend \
     --platform managed \
     --allow-unauthenticated \
     --set-env-vars NODE_ENV=production,CORS_ORIGINS=https://widgets.tk.sg
   ```

### Heroku Deployment

1. **Create apps**:
   ```bash
   heroku create classroom-widgets-frontend
   heroku create classroom-widgets-backend
   ```

2. **Deploy using Heroku Container Registry**:
   ```bash
   # Frontend
   heroku container:push web -a classroom-widgets-frontend
   heroku container:release web -a classroom-widgets-frontend
   
   # Backend
   cd server
   heroku container:push web -a classroom-widgets-backend
   heroku container:release web -a classroom-widgets-backend
   ```

## SSL/TLS Configuration

### Using Let's Encrypt with Certbot

1. **Install Certbot**:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. **Obtain certificates**:
   ```bash
   sudo certbot --nginx -d widgets.tk.sg -d go.tk.sg
   ```

3. **Auto-renewal**:
   ```bash
   sudo systemctl enable certbot.timer
   ```

### Using Cloudflare

1. Enable "Full (strict)" SSL mode
2. Create origin certificates for your servers
3. Configure Nginx to use Cloudflare certificates

### Nginx SSL Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name widgets.tk.sg;
    
    ssl_certificate /etc/letsencrypt/live/widgets.tk.sg/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/widgets.tk.sg/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name widgets.tk.sg;
    return 301 https://$server_name$request_uri;
}
```

## Monitoring and Maintenance

### Health Checks

1. **Frontend health check**:
   ```bash
   curl -f https://widgets.tk.sg || exit 1
   ```

2. **Backend health check**:
   ```bash
   curl -f https://go.tk.sg/health || exit 1
   ```

3. **Automated monitoring** with UptimeRobot or Pingdom

### Logging

#### Docker Logs
```bash
# View logs
docker logs -f classroom-widgets-frontend
docker logs -f classroom-widgets-backend

# Save logs
docker logs classroom-widgets-backend > backend.log 2>&1
```

#### PM2 Logs
```bash
# View logs
pm2 logs classroom-widgets-api

# Clear logs
pm2 flush

# Log rotation
pm2 install pm2-logrotate
```

### Performance Monitoring

1. **Application Performance Monitoring (APM)**:
   - New Relic
   - DataDog
   - AppDynamics

2. **Error Tracking**:
   - Sentry
   - Rollbar
   - Bugsnag

3. **Basic monitoring script**:
   ```bash
   #!/bin/bash
   # monitor.sh
   
   # Check frontend
   if ! curl -f -s https://widgets.tk.sg > /dev/null; then
     echo "Frontend is down!"
     # Send alert
   fi
   
   # Check backend
   if ! curl -f -s https://go.tk.sg/health > /dev/null; then
     echo "Backend is down!"
     # Send alert
   fi
   
   # Check memory usage
   if [ $(free | grep Mem | awk '{print ($3/$2) * 100}' | cut -d. -f1) -gt 80 ]; then
     echo "High memory usage!"
     # Send alert
   fi
   ```

### Backup Strategy

1. **Application backups**:
   ```bash
   # Backup script
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   BACKUP_DIR="/backups"
   
   # Backup application files
   tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/widgets
   
   # Backup Docker volumes
   docker run --rm -v classroom-widgets_data:/data -v $BACKUP_DIR:/backup alpine tar -czf /backup/volume_$DATE.tar.gz /data
   
   # Keep only last 7 days
   find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
   ```

2. **Database backups** (if applicable)

### Updates and Maintenance

1. **Update dependencies**:
   ```bash
   # Check for updates
   npm outdated
   
   # Update dependencies
   npm update
   
   # Security audit
   npm audit
   npm audit fix
   ```

2. **Rolling updates with Docker**:
   ```bash
   # Pull latest images
   docker-compose -f docker-compose.prod.yml pull
   
   # Update services one by one
   docker-compose -f docker-compose.prod.yml up -d --no-deps backend
   docker-compose -f docker-compose.prod.yml up -d --no-deps frontend
   ```

## Troubleshooting

### Common Issues

#### Frontend not loading
1. Check build output for errors
2. Verify REACT_APP_SERVER_URL is set correctly
3. Check browser console for errors
4. Verify Nginx configuration

#### WebSocket connection failed
1. Ensure backend server is running
2. Check CORS configuration
3. Verify firewall allows WebSocket connections
4. Check proxy headers for WebSocket upgrade

#### Docker container crashes
```bash
# Check logs
docker logs classroom-widgets-backend

# Inspect container
docker inspect classroom-widgets-backend

# Check resource usage
docker stats

# Restart with increased memory
docker run -m 2g classroom-widgets-backend
```

#### PM2 process keeps restarting
```bash
# Check error logs
pm2 logs --err

# Increase memory limit
pm2 start app.js --max-memory-restart 1G

# Check for port conflicts
netstat -tulpn | grep 3001
```

### Debug Mode

1. **Enable debug logging**:
   ```bash
   # Backend
   DEBUG=* node src/index.js
   
   # Docker
   docker run -e DEBUG=* classroom-widgets-backend
   ```

2. **Frontend debugging**:
   ```javascript
   // Add to .env.development
   REACT_APP_DEBUG=true
   ```

### Performance Issues

1. **Enable caching**:
   ```nginx
   location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

2. **Optimize images**:
   ```bash
   # Install image optimization tools
   npm install -g imagemin-cli
   
   # Optimize images
   imagemin public/images/* --out-dir=public/images
   ```

3. **Enable Gzip compression** (see nginx.conf)

## Security Best Practices

### Application Security

1. **Environment Variables**:
   - Never commit `.env` files
   - Use secrets management (AWS Secrets Manager, HashiCorp Vault)
   - Rotate API keys regularly

2. **Dependencies**:
   ```bash
   # Regular security audits
   npm audit
   
   # Update vulnerable packages
   npm audit fix
   
   # Check for known vulnerabilities
   npx snyk test
   ```

3. **Input Validation**:
   - Sanitize all user inputs
   - Implement rate limiting
   - Use CSRF tokens for forms

### Infrastructure Security

1. **Firewall Configuration**:
   ```bash
   # UFW example
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow ssh
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 3001/tcp  # Only if needed externally
   sudo ufw enable
   ```

2. **SSH Hardening**:
   ```bash
   # Disable root login
   sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
   
   # Use SSH keys only
   sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
   
   sudo systemctl restart sshd
   ```

3. **Docker Security**:
   ```bash
   # Run containers as non-root user
   docker run --user 1000:1000 classroom-widgets-backend
   
   # Use read-only filesystem
   docker run --read-only classroom-widgets-frontend
   
   # Limit resources
   docker run --memory="1g" --cpus="1.0" classroom-widgets-backend
   ```

### SSL/TLS Best Practices

1. **Strong ciphers** (see SSL configuration above)
2. **HSTS headers**
3. **Regular certificate renewal**
4. **SSL monitoring and alerts**

### Monitoring for Security

1. **Log analysis**:
   ```bash
   # Monitor for suspicious activity
   grep -E "404|403|401|500" /var/log/nginx/access.log | tail -50
   
   # Check for brute force attempts
   grep "Failed password" /var/log/auth.log | tail -20
   ```

2. **Intrusion Detection**:
   - Fail2ban for brute force protection
   - OSSEC for host-based intrusion detection
   - CloudFlare or similar WAF

### Incident Response

1. **Backup before changes**
2. **Document all modifications**
3. **Have rollback procedures ready**
4. **Maintain incident response contacts**

## Conclusion

This deployment guide covers various deployment scenarios for the Classroom Widgets application. Choose the deployment method that best fits your infrastructure and requirements. Remember to:

1. Always test in a staging environment first
2. Monitor your deployment continuously
3. Keep dependencies updated
4. Follow security best practices
5. Maintain regular backups

For additional support or questions, please refer to the project documentation or open an issue on GitHub.