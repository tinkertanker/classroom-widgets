const test = require('node:test');
const assert = require('node:assert/strict');
const apiRoutes = require('./api');

function dispatchCleanupRequest(sessionManager, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method: 'POST',
      url: '/admin/cleanup',
      headers
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
