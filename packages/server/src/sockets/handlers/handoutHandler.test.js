// Silence handler warn/debug noise; must be set before the logger is required.
process.env.LOG_LEVEL = 'error';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const handoutHandler = require('./handoutHandler');
const Session = require('../../models/Session');
const { EVENTS } = require('../../config/constants');

/**
 * Handouts carry both links and plain text, so link detection must use the
 * same Links + Text rules as Drop Box. Failure modes covered:
 * - a teacher's dotted name ("Mr.Tan") or word ("John.Doe") is turned into a
 *   broken https:// link;
 * - a real bare domain stops being turned into a clickable link;
 * - a URL that already has a protocol is altered or loses its link flag.
 */

function createMockSocket(id) {
  const handlers = {};
  return {
    id,
    on: (event, handler) => { handlers[event] = handler; },
    emit: () => {},
    join: () => {},
    leave: () => {},
    trigger: (event, data) => handlers[event]?.(data)
  };
}

describe('handout:add link detection', () => {
  const SESSION_CODE = 'TEST12';
  const WIDGET_ID = 'widget-123';
  const HOST_SOCKET_ID = 'host-socket-id';
  let session;
  let hostSocket;

  beforeEach(() => {
    session = new Session(SESSION_CODE);
    session.hostSocketId = HOST_SOCKET_ID;
    session.createRoom('handout', WIDGET_ID);
    hostSocket = createMockSocket(HOST_SOCKET_ID);
    const io = { to: () => ({ emit: () => {} }) };
    const sessionManager = { getSession: (code) => (code === SESSION_CODE ? session : undefined) };
    handoutHandler(io, hostSocket, sessionManager, () => SESSION_CODE);
  });

  function addItem(content) {
    hostSocket.trigger(EVENTS.HANDOUT.ADD, { sessionCode: SESSION_CODE, widgetId: WIDGET_ID, content });
    const items = session.getRoom('handout', WIDGET_ID).getItems();
    return items[items.length - 1];
  }

  it('keeps dotted names and words as text', () => {
    for (const text of ['Mr.Tan', 'John.Doe', 'Ms.Ng']) {
      const item = addItem(text);
      assert.equal(item.content, text);
      assert.equal(item.isLink, false);
    }
  });

  it('still turns bare domains into links', () => {
    for (const [input, expected] of [
      ['example.com', 'https://example.com'],
      ['kahoot.it/abc', 'https://kahoot.it/abc'],
      ['ms.office.com', 'https://ms.office.com']
    ]) {
      const item = addItem(input);
      assert.equal(item.content, expected);
      assert.equal(item.isLink, true);
    }
  });

  it('keeps URLs that already have a protocol as links', () => {
    const item = addItem('https://Mr.Tan');
    assert.equal(item.content, 'https://Mr.Tan');
    assert.equal(item.isLink, true);
  });
});
