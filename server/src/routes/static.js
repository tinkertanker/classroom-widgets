const express = require('express');
const path = require('path');
const serverConfig = require('../config/server.config');

const router = express.Router();

// Static file serving for production
if (serverConfig.IS_PRODUCTION) {
  // Serve static files from the public directory
  const publicPath = path.join(__dirname, '..', serverConfig.STATIC.PUBLIC_PATH);
  
  router.use(express.static(publicPath, {
    maxAge: serverConfig.STATIC.MAX_AGE,
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Cache control for different file types
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else if (filePath.match(/\.(js|css)$/)) {
        res.setHeader('Cache-Control', `public, max-age=${30 * 24 * 60 * 60}`); // 30 days
      } else if (filePath.match(/\.(jpg|jpeg|png|gif|svg|ico)$/)) {
        res.setHeader('Cache-Control', `public, max-age=${365 * 24 * 60 * 60}`); // 1 year
      }
    }
  }));

  // Serve the student app
  router.get('/student', (req, res) => {
    res.sendFile(path.join(publicPath, 'student', 'index.html'));
  });

  // Serve the main app for all other routes (SPA)
  router.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
} else {
  // Development mode - just return a message
  router.get('*', (req, res) => {
    res.json({
      message: 'Static file serving is disabled in development mode',
      hint: 'Use the development servers for the frontend apps'
    });
  });
}

module.exports = router;