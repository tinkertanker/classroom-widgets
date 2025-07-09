# Security Guidelines and Best Practices

This document outlines security considerations and best practices for deploying and maintaining the Classroom Widgets application.

## Table of Contents
1. [Security Overview](#security-overview)
2. [Application Security](#application-security)
3. [Infrastructure Security](#infrastructure-security)
4. [Data Protection](#data-protection)
5. [Authentication & Authorization](#authentication--authorization)
6. [Network Security](#network-security)
7. [Container Security](#container-security)
8. [Monitoring & Incident Response](#monitoring--incident-response)
9. [Security Checklist](#security-checklist)
10. [Vulnerability Disclosure](#vulnerability-disclosure)

## Security Overview

### Security Principles

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Minimal permissions for all components
3. **Zero Trust**: Verify everything, trust nothing
4. **Security by Design**: Built-in security, not bolted on

### Current Security Features

- CORS protection for API endpoints
- Input validation on all user inputs
- No persistent data storage (privacy by design)
- Secure WebSocket connections
- Content Security Policy headers
- HTTPS enforcement in production

## Application Security

### Frontend Security

#### 1. Content Security Policy (CSP)

Add to your nginx configuration or HTML headers:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https://go.tk.sg; font-src 'self';" always;
```

#### 2. XSS Prevention

```javascript
// Always sanitize user input
import DOMPurify from 'dompurify';

const sanitizedInput = DOMPurify.sanitize(userInput);
```

#### 3. Dependency Security

```bash
# Regular security audits
npm audit
npm audit fix

# Check for known vulnerabilities
npx snyk test

# Update dependencies
npm update --save
```

#### 4. Environment Variables

```javascript
// Never expose sensitive data in frontend code
if (process.env.NODE_ENV === 'production') {
  // Disable React DevTools
  if (typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ === 'object') {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.inject = function() {};
  }
}
```

### Backend Security

#### 1. Input Validation

```javascript
// Validate all inputs
const validateRoomCode = (code) => {
  if (!/^\d{4}$/.test(code)) {
    throw new Error('Invalid room code');
  }
  return code;
};

// Sanitize user-submitted content
const sanitizeLink = (link) => {
  // URL validation
  try {
    const url = new URL(link);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
    return url.href;
  } catch {
    throw new Error('Invalid URL');
  }
};
```

#### 2. Rate Limiting

```javascript
// Implement rate limiting
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);

// Socket.io rate limiting
io.use((socket, next) => {
  const clientIP = socket.handshake.address;
  if (isRateLimited(clientIP)) {
    return next(new Error('Rate limit exceeded'));
  }
  next();
});
```

#### 3. Security Headers

```javascript
// Security middleware
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

#### 4. Session Security

```javascript
// Secure session configuration
const session = require('express-session');

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only
    httpOnly: true, // Prevent XSS
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    sameSite: 'strict' // CSRF protection
  }
}));
```

## Infrastructure Security

### Server Hardening

#### 1. Operating System Security

```bash
# Keep system updated
sudo apt update && sudo apt upgrade -y

# Enable automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Disable unnecessary services
sudo systemctl disable bluetooth
sudo systemctl disable cups
```

#### 2. SSH Security

```bash
# /etc/ssh/sshd_config
Port 2222  # Change default port
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
AllowUsers your-username

# Restart SSH
sudo systemctl restart sshd
```

#### 3. Firewall Configuration

```bash
# UFW (Uncomplicated Firewall)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 2222/tcp  # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 3001/tcp # Backend (if needed externally)
sudo ufw enable

# iptables alternative
sudo iptables -A INPUT -p tcp --dport 22 -j DROP
sudo iptables -A INPUT -p tcp --dport 2222 -j ACCEPT
```

### SSL/TLS Configuration

#### 1. Strong SSL Configuration

```nginx
# /etc/nginx/sites-available/widgets.tk.sg
server {
    listen 443 ssl http2;
    server_name widgets.tk.sg;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/widgets.tk.sg/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/widgets.tk.sg/privkey.pem;
    
    # Strong SSL Protocols
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # SSL Optimizations
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/widgets.tk.sg/chain.pem;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 2. Certificate Management

```bash
# Auto-renewal with Certbot
sudo certbot renew --dry-run

# Add to crontab
0 0,12 * * * python -c 'import random; import time; time.sleep(random.random() * 3600)' && certbot renew --quiet
```

## Data Protection

### Privacy by Design

1. **No Persistent Storage**: 
   - Room data expires after 12 hours
   - No user accounts or profiles
   - No tracking or analytics by default

2. **Data Minimization**:
   - Only collect necessary data
   - Anonymous participation
   - No personally identifiable information

### Local Storage Security

```javascript
// Encrypt sensitive data in localStorage
const crypto = require('crypto-js');

const encryptData = (data, key) => {
  return crypto.AES.encrypt(JSON.stringify(data), key).toString();
};

const decryptData = (encryptedData, key) => {
  const bytes = crypto.AES.decrypt(encryptedData, key);
  return JSON.parse(bytes.toString(crypto.enc.Utf8));
};
```

## Authentication & Authorization

### Future Authentication Implementation

If adding authentication in the future:

```javascript
// JWT implementation
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

## Network Security

### CORS Configuration

```javascript
// Strict CORS policy
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGINS.split(',');
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### API Security

```javascript
// API key authentication for external services
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// Use for protected endpoints
app.use('/api/admin', apiKeyAuth);
```

## Container Security

### Docker Security

#### 1. Dockerfile Best Practices

```dockerfile
# Use specific versions
FROM node:18.19.0-alpine

# Run as non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy only necessary files
COPY --chown=nodejs:nodejs package*.json ./
RUN npm ci --only=production

# Switch to non-root user
USER nodejs

# Security scanning
RUN npm audit --production
```

#### 2. Docker Compose Security

```yaml
version: '3.8'

services:
  backend:
    image: classroom-widgets-backend:latest
    read_only: true  # Read-only filesystem
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    networks:
      - internal
    restart: unless-stopped

networks:
  internal:
    driver: bridge
    internal: true  # No external access
```

#### 3. Image Scanning

```bash
# Scan for vulnerabilities
docker scan classroom-widgets-frontend:latest
trivy image classroom-widgets-backend:latest

# Use Snyk
snyk container test classroom-widgets-frontend:latest
```

## Monitoring & Incident Response

### Security Monitoring

#### 1. Log Analysis

```bash
# Monitor for suspicious activity
tail -f /var/log/nginx/access.log | grep -E "404|403|401|500"

# Failed SSH attempts
grep "Failed password" /var/log/auth.log | tail -20

# Monitor application logs
pm2 logs --err | grep -i "error\|warning\|critical"
```

#### 2. Intrusion Detection

```bash
# Install Fail2ban
sudo apt install fail2ban

# Configure for Nginx
# /etc/fail2ban/jail.local
[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
filter = nginx-noscript
logpath = /var/log/nginx/access.log
maxretry = 6
```

#### 3. Automated Alerts

```bash
#!/bin/bash
# security-monitor.sh

# Check for high CPU usage (possible DDoS)
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    echo "High CPU usage detected: $CPU_USAGE%" | mail -s "Security Alert" admin@example.com
fi

# Check for unusual network connections
CONNECTIONS=$(netstat -an | grep ESTABLISHED | wc -l)
if [ $CONNECTIONS -gt 1000 ]; then
    echo "High number of connections: $CONNECTIONS" | mail -s "Security Alert" admin@example.com
fi
```

### Incident Response Plan

#### 1. Detection & Analysis

```bash
# Quick incident checklist
echo "=== Incident Response Checklist ==="
echo "1. Identify the issue"
echo "2. Contain the threat"
echo "3. Investigate root cause"
echo "4. Eradicate the threat"
echo "5. Recover systems"
echo "6. Document lessons learned"
```

#### 2. Containment

```bash
# Emergency shutdown
docker-compose down
sudo ufw deny from $ATTACKER_IP
sudo systemctl stop nginx

# Backup current state
tar -czf incident-backup-$(date +%Y%m%d-%H%M%S).tar.gz /var/log /etc
```

#### 3. Recovery

```bash
# Restore from clean backup
docker-compose down -v
git checkout last-known-good-commit
docker-compose build --no-cache
docker-compose up -d
```

## Security Checklist

### Pre-Deployment

- [ ] Run security audit: `npm audit`
- [ ] Update all dependencies
- [ ] Review environment variables
- [ ] Test CSP headers
- [ ] Scan Docker images
- [ ] Review firewall rules
- [ ] Enable HTTPS
- [ ] Configure security headers
- [ ] Set up monitoring
- [ ] Create incident response plan

### Regular Maintenance

- [ ] Weekly dependency updates
- [ ] Monthly security audits
- [ ] Quarterly penetration testing
- [ ] Annual security review
- [ ] Regular backup testing
- [ ] Log rotation setup
- [ ] Certificate renewal monitoring
- [ ] Access control review
- [ ] Firewall rule audit
- [ ] Container image updates

### Production Hardening

- [ ] Disable debug mode
- [ ] Remove development dependencies
- [ ] Enable rate limiting
- [ ] Configure WAF (if available)
- [ ] Set up DDoS protection
- [ ] Enable intrusion detection
- [ ] Configure log shipping
- [ ] Set up alerting
- [ ] Document security procedures
- [ ] Train team on security

## Vulnerability Disclosure

### Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. Email security details to: security@yourdomain.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 5 business days
- **Resolution Target**: Within 30 days for critical issues

### Security Updates

Subscribe to security updates:
- GitHub Security Advisories
- NPM Security Advisories
- Docker Security Updates

## Additional Resources

### Security Tools

1. **Dependency Scanning**:
   - npm audit
   - Snyk
   - WhiteSource
   - OWASP Dependency Check

2. **Container Scanning**:
   - Trivy
   - Clair
   - Anchore
   - Docker Scan

3. **Monitoring**:
   - Fail2ban
   - OSSEC
   - Prometheus + Grafana
   - ELK Stack

### Security Standards

- OWASP Top 10
- CIS Docker Benchmark
- NIST Cybersecurity Framework
- PCI DSS (if handling payments)

### Continuous Improvement

1. Regular security training
2. Security-focused code reviews
3. Automated security testing
4. Incident post-mortems
5. Security metrics tracking

Remember: Security is not a one-time task but an ongoing process. Stay informed about new threats and continuously improve your security posture.