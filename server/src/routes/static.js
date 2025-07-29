const path = require('path');

/**
 * Setup static file serving routes
 */
module.exports = function setupStaticRoutes(app, config) {
  if (config.IS_PRODUCTION) {
    // In production, serve the built React app from root
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '..', config.STATIC.PUBLIC_PATH, 'index.html'));
    });
    
    // Serve static files for any path not starting with /api
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      
      // Try to serve the static file, fall back to index.html for client-side routing
      const filePath = path.join(__dirname, '..', config.STATIC.PUBLIC_PATH, req.path);
      res.sendFile(filePath, (err) => {
        if (err) {
          res.sendFile(path.join(__dirname, '..', config.STATIC.PUBLIC_PATH, 'index.html'));
        }
      });
    });
  } else {
    // In development, proxy to Vite dev server
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      
      // Proxy all non-API requests to Vite dev server
      res.redirect(config.DEV.VITE_URL + req.path);
    });
  }
};