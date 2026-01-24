# Analytics Setup Guide

This guide explains how to set up Umami, a privacy-focused analytics solution for Classroom Widgets.

## Why Umami?

- **Privacy-focused**: No cookies, no personal data collection
- **GDPR compliant**: No consent banners needed
- **Self-hosted**: Your data stays on your server
- **Lightweight**: ~1KB tracking script
- **Open source**: Full transparency

## Quick Start (Local Development)

### 1. Start Umami Services

```bash
# Start Umami and its PostgreSQL database
docker-compose up -d umami umami-db

# Check they're running
docker-compose ps
```

### 2. Access Umami Dashboard

- **URL**: http://localhost:3003
- **Default login**: `admin` / `umami`
- **Change your password immediately** after first login

### 3. Create a Website

1. Go to **Settings** → **Websites**
2. Click **Add website**
3. Enter:
   - **Name**: `Classroom Widgets (Dev)`
   - **Domain**: `localhost`
4. Click **Save**
5. Copy the **Website ID** (a UUID like `a1b2c3d4-...`)

### 4. Configure Environment

Add to your `.env` file:

```bash
VITE_UMAMI_SCRIPT_URL=http://localhost:3003/script.js
VITE_UMAMI_WEBSITE_ID=your-website-id-here
```

### 5. Restart Dev Server

```bash
# Restart to pick up env changes
npm run dev
```

### 6. Verify Tracking

1. Open http://localhost:3000 (Teacher app)
2. Check browser DevTools → Network tab
3. Look for requests to `localhost:3003/script.js`
4. Check Umami dashboard → should show a visit

## Production Deployment

### 1. Configure Environment Variables

Add to `.env.production`:

```bash
# Umami tracking
VITE_UMAMI_SCRIPT_URL=https://analytics.yourdomain.com/script.js
VITE_UMAMI_WEBSITE_ID=your-production-website-id

# Umami server
UMAMI_DOMAIN=analytics.yourdomain.com
UMAMI_EMAIL=admin@yourdomain.com

# Database credentials (use strong passwords!)
UMAMI_DB_USER=umami
UMAMI_DB_PASSWORD=your-secure-password-here

# App secret (generate with: openssl rand -base64 32)
UMAMI_APP_SECRET=your-secret-key-here
```

### 2. Deploy with Docker Compose

```bash
docker-compose -f docker-compose.prod.yml up -d
```

This starts:
- `classroom-widgets-umami` - Analytics dashboard
- `classroom-widgets-umami-db` - PostgreSQL database

### 3. Create Production Website

1. Access Umami at `https://analytics.yourdomain.com`
2. Login and change default password
3. Create a website for your production domain
4. Update `VITE_UMAMI_WEBSITE_ID` with the new ID
5. Rebuild frontend: `docker-compose -f docker-compose.prod.yml up -d --build frontend`

## What's Tracked

Umami collects aggregate, anonymous data:

| Metric | Description |
|--------|-------------|
| Page views | Which pages are visited |
| Unique visitors | Count of distinct visitors (no personal ID) |
| Referrers | Where traffic comes from |
| Browsers | Chrome, Firefox, Safari, etc. |
| Operating systems | Windows, macOS, iOS, Android, etc. |
| Countries | Geographic distribution |
| Screen sizes | Desktop vs mobile usage |

**Not tracked:**
- Personal information
- IP addresses (not stored)
- Cookies
- Cross-site tracking

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Teacher App   │────▶│                 │
│  localhost:3000 │     │     Umami       │
└─────────────────┘     │  localhost:3003 │
                        │                 │
┌─────────────────┐     │   (Analytics)   │
│   Student App   │────▶│                 │
│  localhost:3002 │     └────────┬────────┘
└─────────────────┘              │
                                 ▼
                        ┌─────────────────┐
                        │   PostgreSQL    │
                        │   (umami-db)    │
                        └─────────────────┘
```

## Tracking Both Apps

The tracking script is added to both:
- `index.html` (Teacher app)
- `server/src/student/index.html` (Student app)

Both use the same Website ID, so you see combined analytics. If you want separate tracking:
1. Create two websites in Umami
2. Use different `VITE_UMAMI_WEBSITE_ID` values for each build

## Disabling Tracking

To disable analytics:

```bash
# Leave the website ID empty
VITE_UMAMI_WEBSITE_ID=
```

The tracking script won't load without a valid website ID.

## Troubleshooting

### "Script not loading"

Check browser console for errors:
```bash
# Verify Umami is running
curl http://localhost:3003/script.js
```

### "No data in dashboard"

1. Ensure Website ID matches exactly
2. Check domain matches (localhost vs 127.0.0.1)
3. Disable ad blockers temporarily

### "Database connection failed"

```bash
# Check database is healthy
docker-compose logs umami-db

# Restart services
docker-compose restart umami umami-db
```

### "Can't access Umami dashboard"

```bash
# Check container is running
docker-compose ps

# View logs
docker-compose logs umami
```

## Data Retention

By default, Umami keeps all data. To manage storage:

1. Go to **Settings** → **Websites**
2. Click on your website
3. Use **Clear data** to delete old data

For automatic cleanup, consider setting up a cron job or using Umami's API.

## Resources

- [Umami Documentation](https://umami.is/docs)
- [Umami GitHub](https://github.com/umami-software/umami)
- [Self-hosting Guide](https://umami.is/docs/install)
