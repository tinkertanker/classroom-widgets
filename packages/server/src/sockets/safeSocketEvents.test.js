process.env.LOG_LEVEL = 'error';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { installSafeSocketEvents } = require('./safeSocketEvents');

describe('installSafeSocketEvents', () => {
  let socket;

  beforeEach(() => {
    socket = new EventEmitter();
    socket.id = 'socket-1';
    installSafeSocketEvents(socket);
  });

  it('still delivers events and arguments to the handler', () => {
    const received = [];
    socket.on('custom:event', (a, b) => received.push([a, b]));

    socket.emit('custom:event', { x: 1 }, 'second');

    assert.deepEqual(received, [[{ x: 1 }, 'second']]);
  });

  it('swallows a synchronous throw instead of crashing the process', () => {
    socket.on('boom', () => {
      throw new Error('handler exploded');
    });

    // Without the wrapper this emit would throw straight through EventEmitter.
    socket.emit('boom', null);
  });

  it('answers the acknowledgement callback with INTERNAL_ERROR when a handler throws', () => {
    socket.on('boom', (_data, _callback) => {
      throw new Error('handler exploded');
    });

    let response;
    socket.emit('boom', { some: 'payload' }, (r) => {
      response = r;
    });

    assert.equal(response.success, false);
    assert.equal(response.error.code, 'INTERNAL_ERROR');
  });

  it('does not invoke a non-function trailing argument as a callback', () => {
    socket.on('boom', () => {
      throw new Error('handler exploded');
    });

    // Trailing arg is data, not an ack - must not be called or crash.
    socket.emit('boom', { notACallback: true });
  });

  it('survives an acknowledgement callback that itself throws', () => {
    socket.on('boom', () => {
      throw new Error('handler exploded');
    });

    socket.emit('boom', {}, () => {
      throw new Error('ack already consumed');
    });
  });

  it('catches rejections from async handlers', async () => {
    socket.on('boom', async () => {
      throw new Error('async handler exploded');
    });

    let response;
    socket.emit('boom', { some: 'payload' }, (r) => {
      response = r;
    });

    // Rejection surfaces on a later tick; an unhandled rejection here would
    // fail the test process.
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(response.success, false);
    assert.equal(response.error.code, 'INTERNAL_ERROR');
  });

  it('passes through resolved values from async handlers', async () => {
    const seen = [];
    socket.on('ok', async (data) => {
      seen.push(data);
    });

    socket.emit('ok', 42);
    await new Promise(resolve => setImmediate(resolve));

    assert.deepEqual(seen, [42]);
  });

  it('registers multiple handlers independently', () => {
    const seen = [];
    socket.on('multi', () => seen.push('a'));
    socket.on('multi', () => {
      throw new Error('b explodes');
    });
    socket.on('multi', () => seen.push('c'));

    socket.emit('multi');

    // The throwing handler must not prevent later handlers from running.
    assert.deepEqual(seen, ['a', 'c']);
  });
});
