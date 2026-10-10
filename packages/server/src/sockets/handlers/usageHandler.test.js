const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createEventRateLimiter, EVENT_RATE_LIMITS } = require('../../middleware/socketAuth');
const { usageLog } = require('../../services/usageLog');
const usageHandler = require('./usageHandler');

// Ways usage events can fail, written before the change:
// - a repeated app_open on one connection inflates the open count
// - a reconnect (new socket) is never counted as a teacher again
// - the reconnect notice is logged as a second open
// - reconnecting resets the rate limit, so a client can pad counts without end

const CLIENT = 'a1b2c3d4-e5f6';
const VISIT = 'f6e5d4c3-b2a1';

function connect(t, ip = '10.0.0.1') {
  const socket = new EventEmitter();
  socket.data = {};
  socket.clientIP = ip;
  socket.id = Math.random().toString(36);
  const recorded = [];
  t.mock.method(usageLog, 'record', (event) => recorded.push(event));
  usageHandler(null, socket);
  return { socket, recorded };
}

const track = (socket, event) => socket.emit('usage:track', { event, clientId: CLIENT, visitId: VISIT });

test('only the first app_open on a connection is recorded', (t) => {
  const { socket, recorded } = connect(t);
  track(socket, 'app_open');
  track(socket, 'app_open');
  assert.deepEqual(recorded.map((e) => e.e), ['app_open']);
});

test('app_resume identifies a new connection without recording an open', (t) => {
  const { socket, recorded } = connect(t);
  track(socket, 'app_resume');
  assert.equal(socket.data.usageClientId, CLIENT);
  assert.deepEqual(recorded, []);
});

test('usage events share one budget across reconnections from the same IP', () => {
  const limiter = createEventRateLimiter(EVENT_RATE_LIMITS);
  const max = EVENT_RATE_LIMITS['usage:track'].max;
  for (let i = 0; i < max; i++) {
    const socket = { id: `socket-${i}`, clientIP: '10.0.0.9' };
    assert.equal(limiter(socket, 'usage:track').allowed, true);
  }
  assert.equal(limiter({ id: 'fresh-socket', clientIP: '10.0.0.9' }, 'usage:track').allowed, false);
  assert.equal(limiter({ id: 'other-ip', clientIP: '10.0.0.10' }, 'usage:track').allowed, true);
});
