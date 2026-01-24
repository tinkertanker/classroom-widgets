# Environment Setup Guide

This guide explains how to configure environment variables for different environments.

## 🎯 Overview

**We use environment variables for configuration** to keep secrets out of git and support multiple environments.

### File Structure

```
Root directory:
├── .env.example              # ✓ Development template (git committed)
├── .env.production.example   # ✓ Production template (git committed)
├── .env                      # ✗ Your local secrets (NOT in git)
├── .env.production           # ✗ Production secrets (NOT in git)
└── ENV_SETUP.md             # ✓ This guide
```

**Golden Rule:** Only `.example` files are committed to git. Real `.env` files with secrets are gitignored!

## 🚀 Quick Start

### For Local Development

```bash
# 1. Copy the example file
cp .env.example .env

# 2. Edit .env and add your secrets
nano .env

# 3. Update VITE_SHORTIO_API_KEY if using Link Shortener
# That's it! Run: npm run dev
```

### For Production Deployment

```bash
# 1. Copy the production example
cp .env.production.example .env.production

# 2. Edit and fill in ALL variables
nano .env.production

# Required changes:
# - VITE_SERVER_URL (your backend URL)
# - CORS_ORIGINS (your frontend URL)
# - FRONTEND_DOMAIN (your domain)
# - BACKEND_DOMAIN (your domain)
# - Email addresses for Let's Encrypt

# 3. Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

## 📝 Environment Variables Explained

### Development Variables (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SERVER_URL` | Backend server URL | `http://localhost:3001` |
| `VITE_SHORTIO_API_KEY` | Short.io API key (optional) | `pk_abc123...` |
| `VITE_SHORTIO_BASE_URL` | Short.io base URL | `https://api.short.io/links` |
| `VITE_UMAMI_SCRIPT_URL` | Umami tracking script URL | `http://localhost:3003/script.js` |
| `VITE_UMAMI_WEBSITE_ID` | Umami website ID (leave empty to disable) | `a1b2c3d4-...` |
| `UMAMI_APP_SECRET` | Secret for Umami (docker-compose) | `random-string` |

### Production Variables (.env.production)

All development variables PLUS:

| Variable | Description | Example |
|----------|-------------|---------|
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `https://app.example.com,https://api.example.com` |
| `FRONTEND_DOMAIN` | Frontend domain for nginx-proxy | `app.example.com` |
| `BACKEND_DOMAIN` | Backend domain for nginx-proxy | `api.example.com` |
| `FRONTEND_EMAIL` | Email for SSL cert (Let's Encrypt) | `admin@example.com` |
| `BACKEND_EMAIL` | Email for SSL cert (Let's Encrypt) | `admin@example.com` |
| `UMAMI_DOMAIN` | Umami analytics domain | `analytics.example.com` |
| `UMAMI_EMAIL` | Email for Umami SSL cert | `admin@example.com` |
| `UMAMI_DB_USER` | Umami database username | `umami` |
| `UMAMI_DB_PASSWORD` | Umami database password | `secure-password` |

## 🔒 Security Best Practices

### What to NEVER Commit

❌ **DO NOT** commit these files:
- `.env`
- `.env.production`
- `.env.staging`
- Any file with real API keys or secrets

✅ **DO** commit these files:
- `.env.example`
- `.env.production.example`

### How to Handle Secrets

**Option 1: Local .env files** (Current approach)
```bash
# Create .env.production on your server
# Add secrets manually
# Deploy with docker-compose
```

**Option 2: Environment variables** (Recommended for CI/CD)
```bash
# Pass secrets at runtime
VITE_SHORTIO_API_KEY=secret123 docker-compose up
```

**Option 3: Secrets manager** (Best for production)
```bash
# Use AWS Secrets Manager, Vault, etc.
# Example with AWS:
aws secretsmanager get-secret-value --secret-id prod/shortio-key
```

**Option 4: Docker secrets** (For Docker Swarm)
```yaml
# docker-compose.prod.yml
secrets:
  shortio_key:
    external: true
```

## 🏗️ Different Environments

### Local Development (npm run dev)

```bash
# Uses .env file
# Default: http://localhost:3001
npm run dev
```

### Docker Local Testing

```bash
# Uses docker-compose.yml
# Defaults from .env.example
docker-compose up
```

### Production (Docker)

```bash
# Uses docker-compose.prod.yml
# Requires .env.production file
docker-compose -f docker-compose.prod.yml up -d
```

### Production (Manual nginx)

```bash
# 1. Build apps
npm run build:all

# 2. Configure nginx (see nginx.conf)
sudo cp nginx.conf /etc/nginx/sites-available/classroom-widgets
sudo ln -s /etc/nginx/sites-available/classroom-widgets /etc/nginx/sites-enabled/

# 3. Set environment variables
export VITE_SERVER_URL=https://api.example.com

# 4. Start server
cd server && NODE_ENV=production npm start
```

## 🔍 Troubleshooting

### "Environment variable not working"

**For Vite (Frontend):**
- Must be prefixed with `VITE_`
- Rebuild after changing: `npm run build`
- In development, restart dev server

**For Express (Backend):**
- No prefix needed
- Restart server after changing

**For Docker:**
```bash
# Check if variables are passed
docker exec classroom-widgets-frontend env | grep VITE
docker exec classroom-widgets-backend env | grep CORS
```

### "CORS errors in production"

Make sure `CORS_ORIGINS` in `.env.production` matches your frontend URL **exactly**:

```bash
# ✓ Correct
CORS_ORIGINS=https://app.example.com,https://api.example.com

# ✗ Wrong (trailing slash)
CORS_ORIGINS=https://app.example.com/

# ✗ Wrong (http instead of https)
CORS_ORIGINS=http://app.example.com
```

### "API key not found"

Check that:
1. Variable name is correct (including `VITE_` prefix for frontend)
2. No quotes around the value
3. No spaces around the `=` sign
4. Rebuilt the app after changing

```bash
# ✓ Correct
VITE_SHORTIO_API_KEY=pk_abc123xyz

# ✗ Wrong (quotes)
VITE_SHORTIO_API_KEY="pk_abc123xyz"

# ✗ Wrong (spaces)
VITE_SHORTIO_API_KEY = pk_abc123xyz
```

## 📚 Additional Resources

- [Deployment Guide](./docs/DEPLOYMENT.md) - Full deployment instructions
- [Getting Started](./docs/GETTING_STARTED.md) - Development setup
- [Architecture](./docs/ARCHITECTURE.md) - System overview

## ✅ Checklist

### Before Committing
- [ ] No `.env` files with secrets
- [ ] Only `.env.example` files committed
- [ ] `.gitignore` includes all `.env` variants
- [ ] Documentation updated if new variables added

### Before Deploying
- [ ] `.env.production` created from example
- [ ] All variables filled with production values
- [ ] Secrets are NOT in git
- [ ] CORS_ORIGINS matches your domains exactly
- [ ] SSL domains configured correctly
