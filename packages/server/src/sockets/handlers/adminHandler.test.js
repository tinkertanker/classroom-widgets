process.env.LOG_LEVEL = 'error';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const adminHandler = require('./adminHandler');
const Session = require('../../models/Session');

function mockFn() {
  const fn = (...args) => {
    fn.calls.push(args);
  };
  fn.calls = [];
  return fn;
}

function createMockSocket(id) {
  const handlers = {};
  return {
    id,
    on: (event, handler) => {
      handlers[event] = handler;
    },
    emit: mockFn(),
    trigger: (event, data, callback) => handlers[event] && handlers[event](data, callback)
  };
}

describe('adminHandler: admin:getSessions', () => {
  const SESSION_CODE = 'TEST1';
  let socket;
  let session;
  let sessionManager;
  let previousAdminToken;

  beforeEach((t) => {
    previousAdminToken = process.env.ADMIN_TOKEN;
    t.after(() => {
      if (previousAdminToken === undefined) {
        delete process.env.ADMIN_TOKEN;
      } else {
        process.env.ADMIN_TOKEN = previousAdminToken;
      }
    });

    socket = createMockSocket('admin-1');
    session = new Session(SESSION_CODE);
    sessionManager = {
      sessions: new Map([[SESSION_CODE, session]]),
      getStats: () => ({ activeSessions: 1 })
    };
    adminHandler({}, socket, sessionManager);
  });

  function getSessions(data) {
    let response;
    socket.trigger('admin:getSessions', data, (r) => { response = r; });
    return response;
  }

  it('rejects all tokens when ADMIN_TOKEN is unset', (t) => {
    delete process.env.ADMIN_TOKEN;

    for (const token of [undefined, 'undefined', 'anything']) {
      const response = getSessions(token === undefined ? {} : { token });
      assert.equal(response.success, false, JSON.stringify(token));
      assert.equal(response.error, 'Unauthorized');
      assert.equal(response.sessions, undefined);
    }
  });

  it('rejects a wrong token without leaking session data', () => {
    process.env.ADMIN_TOKEN = 'test-admin-token';

    const response = getSessions({ token: 'wrong-token' });

    assert.equal(response.success, false);
    assert.equal(response.error, 'Unauthorized');
    assert.equal(response.sessions, undefined);
  });

  it('returns sessions for the configured ADMIN_TOKEN', () => {
    process.env.ADMIN_TOKEN = 'test-admin-token';

    const response = getSessions({ token: 'test-admin-token' });

    assert.equal(response.success, true);
    assert.equal(response.sessions.length, 1);
    assert.equal(response.sessions[0].code, SESSION_CODE);
    assert.deepEqual(response.stats, { activeSessions: 1 });
  });
});
