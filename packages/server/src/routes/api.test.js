const test = require('node:test');
const assert = require('node:assert/strict');
const apiRoutes = require('./api');
const SessionManager = require('../services/SessionManager');
const { stopRateLimiterCleanup } = require('../middleware/rateLimit');

function dispatchRequest(sessionManager, method, url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method,
      url,
      headers,
      socket: { remoteAddress: '127.0.0.1' }
    };
    const res = {
      statusCode: 200,
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(body) {
        resolve({ statusCode: this.statusCode, body });
      }
    };

    apiRoutes(sessionManager).handle(req, res, reject);
  });
}

function dispatchCleanupRequest(sessionManager, headers = {}) {
  return dispatchRequest(sessionManager, 'POST', '/admin/cleanup', headers);
}

function createSessionManager() {
  return {
    cleanupCalls: 0,
    cleanupInactiveSessions() {
      this.cleanupCalls += 1;
    },
    getStats() {
      return { activeSessions: 0 };
    }
  };
}

test('POST /api/admin/cleanup rejects forged Bearer undefined when ADMIN_TOKEN is unset', async (t) => {
  const previousAdminToken = process.env.ADMIN_TOKEN;
  t.after(() => {
    if (previousAdminToken === undefined) {
      delete process.env.ADMIN_TOKEN;
    } else {
      process.env.ADMIN_TOKEN = previousAdminToken;
    }
  });

  delete process.env.ADMIN_TOKEN;
  const sessionManager = createSessionManager();

  const response = await dispatchCleanupRequest(sessionManager, {
    authorization: 'Bearer undefined'
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.success, false);
  assert.equal(sessionManager.cleanupCalls, 0);
});

test('POST /api/admin/cleanup accepts a configured ADMIN_TOKEN', async (t) => {
  const previousAdminToken = process.env.ADMIN_TOKEN;
  t.after(() => {
    if (previousAdminToken === undefined) {
      delete process.env.ADMIN_TOKEN;
    } else {
      process.env.ADMIN_TOKEN = previousAdminToken;
    }
  });

  process.env.ADMIN_TOKEN = 'test-admin-token';
  const sessionManager = createSessionManager();

  const response = await dispatchCleanupRequest(sessionManager, {
    authorization: 'Bearer test-admin-token'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(sessionManager.cleanupCalls, 1);
});

test('GET /api/sessions/:code/exists reports live sessions only', async (t) => {
  const sessionManager = new SessionManager();
  t.after(() => {
    sessionManager.stopCleanupInterval();
    stopRateLimiterCleanup();
  });

  const session = sessionManager.createSession();
  const live = await dispatchRequest(sessionManager, 'GET', `/sessions/${session.code}/exists`);
  assert.equal(live.statusCode, 200);
  assert.equal(live.body.exists, true);

  sessionManager.deleteSession(session.code);
  const gone = await dispatchRequest(sessionManager, 'GET', `/sessions/${session.code}/exists`);
  assert.equal(gone.body.exists, false);
});
