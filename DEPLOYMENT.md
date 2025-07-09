# Deployment Guide

This guide covers deploying the Classroom Widgets application to production.

## Production URLs
- Frontend: https://widgets.tk.sg
- Backend Server: https://go.tk.sg

## Frontend Deployment

1. **Create production environment file**:
   ```bash
   cp .env.production.example .env.production
   ```

2. **Build the production bundle**:
   ```bash
   npm run build
   ```

3. **Deploy the build folder** to your hosting service at widgets.tk.sg

## Backend Server Deployment

1. **Navigate to server directory**:
   ```bash
   cd server
   ```

2. **Create production environment file**:
   ```bash
   cp .env.production.example .env.production
   ```

3. **Install dependencies**:
   ```bash
   npm install --production
   ```

4. **Start the server** (consider using PM2 or similar process manager):
   ```bash
   NODE_ENV=production node src/index.js
   ```

## Important Notes

1. **HTTPS**: Ensure both domains are configured with SSL certificates
2. **CORS**: The server is configured to accept requests from widgets.tk.sg
3. **WebSockets**: Ensure your hosting supports WebSocket connections for real-time features
4. **Environment Variables**: Never commit `.env` files with production secrets

## Features Requiring Server

The following widgets require the backend server to be running:
- Poll Widget
- Data Share Widget

These widgets will show a network indicator icon in the toolbar to indicate server requirement.