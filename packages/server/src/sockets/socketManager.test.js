process.env.LOG_LEVEL = 'error';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupSocketHandlers } = require('./socketManager');
const { clearHostDisconnectTimeout } = require('./hostDisconnectTimeouts');
const { eventRateLimiter, EVENT_RATE_LIMITS } = require('../middleware/socketAuth');
const SessionManager = require('../services/SessionManager');
const { EVENTS } = require('../config/constants');

function createMockSocket(id) {
  const handlers = {};
  return {
    id,
    clientIP: `10.2.0.${id.length}`,
    handshake: { headers: {}, secure: false },
    on: (event, handler) => { handlers[event] = handler; },
    emit: () => {},
    join: () => {},
    leave: () => {},
    to: () => ({ emit: () => {} }),
    trigger: (event, ...args) => handlers[event] && handlers[event](...args)
  };
}

function createMockIO() {
  let connectionHandler;
  const emitted = [];
  return {
    on: (event, handler) => { if (event === 'connection') connectionHandler = handler; },
    to: () => ({ emit: (...args) => emitted.push(args) }),
    emitted,
    connect: (socket) => connectionHandler(socket)
  };
}

function setup(sessionManager) {
  const io = createMockIO();
  setupSocketHandlers(io, sessionManager);
  return io;
}

describe('socketManager disconnect', () => {
  let sessionManager;

  afterEach(() => {
    if (sessionManager) {
      for (const code of sessionManager.sessions.keys()) clearHostDisconnectTimeout(code);
      sessionManager.sessions.clear();
    }
  });

  it('marks a create-only host session as host-disconnected on disconnect', async () => {
    sessionManager = new SessionManager();
    const io = setup(sessionManager);
    const hostSocket = createMockSocket('host-only');
    io.connect(hostSocket);

    const result = await new Promise(resolve => {
      hostSocket.trigger(EVENTS.SESSION.CREATE, {}, resolve);
    });
    assert.equal(result.success, true);
    const session = sessionManager.getSession(result.code);
    assert.equal(session.hostSocketId, hostSocket.id);
    assert.equal(session.hostDisconnectedAt, null);

    hostSocket.trigger('disconnect');

    assert.ok(session.hostDisconnectedAt, 'host-only session should be marked disconnected');
    assert.ok(
      io.emitted.some(args => args[0] === EVENTS.SESSION.HOST_DISCONNECTED),
      'students should be notified'
    );
  });

  it('rate limits session:create per client IP', async () => {
    sessionManager = new SessionManager();
    const io = setup(sessionManager);
    const ip = '10.3.0.1';
    const { max } = EVENT_RATE_LIMITS[EVENTS.SESSION.CREATE];

    let lastResult;
    for (let i = 0; i <= max; i++) {
      const socket = createMockSocket(`flood-${i}`);
      socket.clientIP = ip;
      io.connect(socket);
      lastResult = await new Promise(resolve => socket.trigger(EVENTS.SESSION.CREATE, {}, resolve));
    }

    assert.equal(lastResult.success, false);
    assert.match(lastResult.error, /Too many session requests/);
    assert.ok(lastResult.retryAfter > 0);
    assert.equal(sessionManager.sessions.size, max);
  });
});

describe('session:join rate limiting', () => {
  it('rejects a burst of join attempts beyond the per-connection limit', async () => {
    const io = setup(new SessionManager());
    const socket = createMockSocket('guesser');
    const emitted = [];
    socket.emit = (...args) => emitted.push(args);
    io.connect(socket);

    const { max } = EVENT_RATE_LIMITS[EVENTS.SESSION.JOIN];
    for (let i = 0; i <= max; i++) {
      socket.trigger(EVENTS.SESSION.JOIN, { code: 'ZZZZZZ', name: 'Guess' });
    }
    await new Promise(resolve => setImmediate(resolve));

    const responses = emitted.filter(a => a[0] === EVENTS.SESSION.JOINED).map(a => a[1]);
    assert.equal(responses.length, max + 1);
    assert.match(responses[max].error, /Too many join attempts/);
    assert.equal(eventRateLimiter(socket, EVENTS.SESSION.JOIN).allowed, false);
  });

  it('caps failed joins per client IP across reconnects, without charging successful joins', async () => {
    const sessionManager = new SessionManager();
    const io = setup(sessionManager);
    const ip = '10.4.0.1';
    const { max: missMax } = EVENT_RATE_LIMITS['session:join:miss'];
    const { max: perConnMax } = EVENT_RATE_LIMITS[EVENTS.SESSION.JOIN];
    const session = sessionManager.createSession();

    const joinOnce = async (id, code) => {
      const socket = createMockSocket(id);
      socket.clientIP = ip;
      const emitted = [];
      socket.emit = (...args) => emitted.push(args);
      io.connect(socket);
      socket.trigger(EVENTS.SESSION.JOIN, { code, name: 'Student' });
      await new Promise(resolve => setImmediate(resolve));
      return emitted.find(a => a[0] === EVENTS.SESSION.JOINED)[1];
    };

    // Valid joins never consume the miss budget
    for (let i = 0; i < perConnMax * 2; i++) {
      assert.equal((await joinOnce(`ok-${i}`, session.code)).success, true);
    }

    // Reconnecting per guess sidesteps the per-connection limit, but not the per-IP miss budget
    for (let i = 0; i < missMax; i++) {
      const res = await joinOnce(`miss-${i}`, 'ZZZZZZ');
      assert.equal(res.error, 'Session not found', `miss ${i + 1} should reach lookup`);
    }
    const blocked = await joinOnce('miss-final', 'ZZZZZZ');
    assert.match(blocked.error, /Too many join attempts/);
    assert.ok(blocked.retryAfter > 0);

    // A different IP is unaffected
    const other = createMockSocket('elsewhere');
    other.clientIP = '10.4.0.2';
    const emitted = [];
    other.emit = (...args) => emitted.push(args);
    io.connect(other);
    other.trigger(EVENTS.SESSION.JOIN, { code: 'ZZZZZZ', name: 'Student' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(emitted.find(a => a[0] === EVENTS.SESSION.JOINED)[1].error, 'Session not found');
  });
});
