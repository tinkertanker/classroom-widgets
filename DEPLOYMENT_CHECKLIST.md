# Deployment Checklist

## Before Deployment

### Frontend (widgets.tk.sg)
1. [ ] Create `.env.production` file from `.env.production.example`
2. [ ] Verify `REACT_APP_SERVER_URL=https://go.tk.sg`
3. [ ] Run `npm run build`
4. [ ] Test the build locally: `npx serve -s build`

### Backend Server (go.tk.sg)
1. [ ] Navigate to `server/` directory
2. [ ] Create `.env.production` file from `.env.production.example`
3. [ ] Verify settings:
   - `PORT=3001` (or your preferred port)
   - `CORS_ORIGINS=https://widgets.tk.sg,http://localhost:3000`
4. [ ] Install production dependencies: `npm install --production`

## Deployment Steps

### Deploy Frontend
1. [ ] Upload contents of `build/` folder to widgets.tk.sg
2. [ ] Ensure HTTPS is configured
3. [ ] Test basic functionality

### Deploy Backend
1. [ ] Upload server files to go.tk.sg
2. [ ] Ensure HTTPS is configured
3. [ ] Start server with: `NODE_ENV=production node src/index.js`
4. [ ] Consider using PM2 for process management:
   ```bash
   npm install -g pm2
   NODE_ENV=production pm2 start src/index.js --name classroom-widgets-server
   pm2 save
   pm2 startup
   ```

## Post-Deployment Testing

1. [ ] Test Poll widget:
   - Create a poll
   - Visit student URL
   - Submit a vote
   - Verify real-time updates

2. [ ] Test Data Share widget:
   - Create a share room
   - Visit student URL at https://go.tk.sg/share
   - Submit a link
   - Verify real-time updates

3. [ ] Test all other widgets for basic functionality

## Monitoring

1. [ ] Set up server monitoring (e.g., with PM2)
2. [ ] Configure error logging
3. [ ] Set up uptime monitoring for both domains

## Security Considerations

1. [ ] Ensure all environment variables are properly set
2. [ ] Never commit `.env` files to version control
3. [ ] Regularly update dependencies
4. [ ] Monitor server logs for suspicious activity