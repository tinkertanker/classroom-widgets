const express = require('express');
const path = require('path');
const { ipMissRateLimit } = require('../middleware/rateLimit');
const { asyncHandler } = require('../middleware/errorHandler');
const { isValidAdminToken } = require('../utils/adminToken');
const { SESSION_COOKIE } = require('../services/adminAuth');

const DASHBOARD_PAGE = path.join(__dirname, '..', 'admin', 'dashboard.html');
// The app icon, shared with the student app.
const LOGO = path.join(__dirname, '..', '..', 'public', 'favicon.svg');

const bearerToken = (req) => {
  const header = req.headers.authorization;
  return typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : undefined;
};

// The dashboard only ever posts to its own origin. Refusing other origins
// stops another site signing an admin in or out behind their back.
const sameOriginOnly = (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = null;
  }
  const hosts = [req.headers.host, req.headers['x-forwarded-host']].filter(Boolean);
  if (originHost && hosts.includes(originHost)) return next();
  res.status(403).json({ success: false, error: 'Forbidden' });
};

/**
 * Admin usage dashboard, served at /admin by the backend.
 *
 * GET  /admin              dashboard page
 * GET  /admin/session      sign-in state and which sign-in methods are on
 * POST /admin/auth/google  { credential } from Google Identity Services
 * POST /admin/auth/token   { token } matching ADMIN_TOKEN
 * POST /admin/auth/logout
 * GET  /admin/api/usage    ?days=N; session cookie or `Authorization: Bearer <ADMIN_TOKEN>`
 * GET  /admin/api/live     what is happening right now; same authorisation
 */
function createAdminRouter({
  adminAuth,
  usageLog,
  getLiveStats,
  secureCookies = false,
  loginRateLimit = { windowMs: 15 * 60 * 1000, max: 10 }
}) {
  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: secureCookies,
    path: '/admin'
  };

  const currentAdmin = (req) => {
    if (isValidAdminToken(bearerToken(req))) return { email: 'admin-token' };
    return adminAuth.readSession(req.headers.cookie);
  };

  const requireAdmin = (req, res, next) => {
    const admin = currentAdmin(req);
    if (!admin) return res.status(401).json({ success: false, error: 'Unauthorized' });
    req.admin = admin;
    next();
  };

  const signIn = (req, res, identity) => {
    if (!identity) {
      req.rateLimitMiss();
      return res.status(401).json({ success: false, error: 'Not authorised' });
    }
    res.cookie(SESSION_COOKIE, adminAuth.issueSessionCookie(identity), {
      ...cookieOptions,
      maxAge: adminAuth.sessionMaxAgeMs
    });
    res.json({ success: true, email: identity.email });
  };

  const limitFailedSignIns = ipMissRateLimit(loginRateLimit);

  router.get('/', (req, res) => {
    res.set({
      'Cache-Control': 'no-store',
      // Google's sign-in popup needs to report back to this window.
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    res.sendFile(DASHBOARD_PAGE);
  });

  router.get('/logo.svg', (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(LOGO);
  });

  router.get('/session', (req, res) => {
    const admin = currentAdmin(req);
    res.set('Cache-Control', 'no-store');
    res.json({
      authenticated: Boolean(admin),
      email: admin?.email || null,
      googleClientId: adminAuth.googleClientId,
      tokenLoginEnabled: adminAuth.tokenLoginEnabled(),
      usageLoggingEnabled: usageLog.enabled
    });
  });

  router.post('/auth/google', sameOriginOnly, limitFailedSignIns, asyncHandler(async (req, res) => {
    signIn(req, res, await adminAuth.loginWithGoogle(req.body?.credential));
  }));

  router.post('/auth/token', sameOriginOnly, limitFailedSignIns, (req, res) => {
    signIn(req, res, adminAuth.loginWithToken(req.body?.token));
  });

  router.post('/auth/logout', sameOriginOnly, (req, res) => {
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.json({ success: true });
  });

  router.get('/api/usage', requireAdmin, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await usageLog.summarise({ days: req.query.days ?? 30 }));
  }));

  router.get('/api/live', requireAdmin, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(getLiveStats());
  });

  return router;
}

module.exports = { createAdminRouter };
