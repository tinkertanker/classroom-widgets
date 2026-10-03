// #230: run against a disposable real server, e.g. node e2e/sessionIdentity.cjs
// http://localhost:3001. It also supports the authorized production probe:
// every session it creates is explicitly closed, even on assertion failure.
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { setTimeout: delay } = require('node:timers/promises');
const url = process.argv[2] || 'http://localhost:3001';
const evidence = process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR
  || join(tmpdir(), 'classroom-widgets-test-evidence/session-identity');
mkdirSync(evidence, { recursive: true });
const lines = [];
const step = message => { lines.push(message); console.log(message); };
const next = (socket, event) => new Promise((resolve, reject) => {
  const handler = data => { clearTimeout(timer); resolve(data); };
  const timer = setTimeout(() => {
    socket.off(event, handler);
    reject(new Error(`Timeout: ${event}`));
  }, 5000);
  socket.once(event, handler);
});
const connect = async () => {
  const socket = io(url, { transports: ['websocket'], reconnection: false, autoConnect: false });
  const connected = next(socket, 'connect');
  socket.connect();
  try { await connected; } catch (error) { socket.disconnect(); throw error; }
  return socket;
};
const joinSession = async (socket, code) => {
  const response = next(socket, 'session:joined');
  socket.emit('session:join', { code, name: 'Disposable identity check' });
  return response;
};
async function until(label, check) {
  for (let i = 0; i < 50; i++) {
    if (check()) return;
    await delay(50);
  }
  assert.fail(`Timed out: ${label}`);
}
const cases = [
  ['failed join keeps disconnect identity', async ({ a, students, connectStudent }) => {
    const student = await connectStudent();
    assert.equal((await joinSession(student, a.code)).success, true);
    await until('A count1', () => a.count === 1);
    assert.equal((await joinSession(student, 'INVALID-CODE')).success, false);
    students[0].disconnect();
    await until('A disconnect count0 after rejected join', () => a.count === 0);
  }],
  ['duplicates and rejected switching preserve membership; fresh socket can switch', async ({ a, b, connectStudent }) => {
    const student = await connectStudent();
    assert.equal((await joinSession(student, a.code)).success, true);
    assert.equal((await joinSession(student, a.code)).success, true);
    await until('duplicate stays count1', () => a.count === 1);
    assert.equal((await joinSession(student, b.code)).success, false);
    assert.equal(b.count, 0);
    const notifications = [];
    student.on('session:widgetStateChanged', data => notifications.push(data));
    const broadcast = next(b.socket, 'session:widgetStateChanged');
    b.socket.emit('session:updateWidgetState', { sessionCode: b.code, roomType: 'poll', widgetId: 'identity-room', isActive: true });
    assert.equal((await broadcast).isActive, true, 'B broadcast must actually execute');
    await delay(150);
    assert.equal(notifications.length, 0, 'rejected switch must not subscribe to B');
    student.disconnect();
    await until('A disconnect count0', () => a.count === 0);
    const fresh = await connectStudent();
    assert.equal((await joinSession(fresh, b.code)).success, true);
    await until('fresh socket B count1', () => b.count === 1);
    fresh.disconnect();
    await until('B disconnect count0', () => b.count === 0);
  }],
  ['host socket cannot acquire a student identity', async ({ a, b }) => {
    const repeated = await a.socket.timeout(5000).emitWithAck('session:create', {});
    assert.equal(repeated.code, a.code);
    assert.equal(repeated.isExisting, true);
    assert.equal((await joinSession(a.socket, b.code)).success, false);
    assert.equal(b.count, 0);
  }],
  ['student socket cannot acquire a host identity', async ({ a, sessions, connectStudent }) => {
    const student = await connectStudent();
    assert.equal((await joinSession(student, a.code)).success, true);
    await until('student A count1', () => a.count === 1);
    const response = await student.timeout(5000).emitWithAck('session:create', {});
    if (response.success) sessions.push({ socket: student, code: response.code });
    assert.equal(response.success, false);
    student.disconnect();
    await until('role-rejected student disconnect count0', () => a.count === 0);
  }]
];

(async () => {
  let failures = 0;
  for (const [label, run] of cases) {
    const sessions = [];
    const students = [];
    try {
      for (let i = 0; i < 2; i++) {
        const socket = await connect();
        const result = await socket.timeout(5000).emitWithAck('session:create', {});
        assert.equal(result.success, true);
        const session = { socket, code: result.code, count: 0 };
        sessions.push(session);
        socket.on('session:participantUpdate', data => { if (!data.roomType) session.count = data.count; });
        assert.equal((await socket.timeout(5000).emitWithAck('session:createRoom', {
          sessionCode: result.code, roomType: 'poll', widgetId: 'identity-room'
        })).success, true);
      }
      await run({ a: sessions[0], b: sessions[1], sessions, students,
        connectStudent: async () => { const socket = await connect(); students.push(socket); return socket; } });
      step(`PASS ${label}`);
    } catch (error) {
      failures++;
      step(`FAIL ${label}: ${error.stack || error}`);
    } finally {
      for (const { socket, code } of sessions.reverse()) {
        try {
          const closed = next(socket, 'session:closed');
          socket.emit('session:close', { sessionCode: code });
          await closed;
        } catch (error) { failures++; step(`FAIL cleanup: ${error.message}`); }
      }
      for (const socket of [...students, ...sessions.map(session => session.socket)]) socket.disconnect();
    }
  }
  step(`RESULT ${failures ? 'FAIL' : 'PASS'}: ${cases.length} identity scenarios; disposable sessions closed`);
  writeFileSync(join(evidence, 'session-identity.txt'), lines.join('\n') + '\n');
  process.exitCode = failures ? 1 : 0;
})().catch(error => { step(`FAIL ${error.stack}`); writeFileSync(join(evidence, 'session-identity.txt'), lines.join('\n')); process.exitCode = 1; });
