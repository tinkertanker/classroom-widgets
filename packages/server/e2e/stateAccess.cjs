// #231, #229 and security finding 9: who may read widget state and submit
// answers, and how much a single socket can take. Starts the real AppServer
// in-process on a free port and drives it with real socket.io-client sockets
// over WebSocket, so it can also read the server's room state (idle timers,
// stored responses). Run with `node e2e/stateAccess.cjs` (run-e2e.js does).
// Evidence: $CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR/state-access.txt.
//
// Failure modes, written before the fix:
// - A socket that never joined, or a student of another session, is answered
//   by any of the six requestState handlers.
// - A non-member read refreshes the room's idle timer, keeping it alive.
// - The host or a joined student is refused a read it needs.
// - A burst of reads from one joined socket is answered in full.
// - The read budget is so tight that a join plus a reconnect, or reading
//   every room at once, is refused; or one room's burst starves another.
// - A submit from a non-member tells an unknown code apart from a real one,
//   so submits work as a code-guessing oracle; or submits to a dead code
//   (taps buffered across a restart) spend the per-IP join budget a school
//   shares.
// - A joined student's submit is refused after the guard is added, or a
//   student's submit names another session than the one it joined.
// - Reconnect-and-resubmit churn grows an activity room's responses without
//   limit; or the cap drops a present student's answer, or locks out new
//   students while departed students' answers fill it.
// - A host cycling through rooms grows the read budgets without limit.
// - A long whitespace-flexible answer typed with extra indentation is cut
//   before whitespace is collapsed and graded wrong; or an exact-mode answer
//   escapes the length cap.
const assert = require('node:assert/strict');
const path = require('node:path');
const net = require('node:net');
const { mkdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { setTimeout: delay } = require('node:timers/promises');
const { io: ioClient } = require('socket.io-client');

const evidence = process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR
  || path.join(tmpdir(), 'classroom-widgets-test-evidence/state-access');
mkdirSync(evidence, { recursive: true });
const lines = [];
const step = message => { lines.push(message); console.log(message); };
const failures = [];
async function check(label, run) {
  try { await run(); step(`PASS ${label}`); }
  catch (error) { failures.push(label); step(`FAIL ${label}: ${error.message}`); }
}

const READS = [
  ['poll', 'poll-1', 'poll:requestState', 'poll:stateUpdate'],
  ['linkShare', 'ls-1', 'linkShare:requestState', 'linkShare:stateUpdate'],
  ['rtfeedback', 'fb-1', 'rtfeedback:requestState', 'rtfeedback:stateUpdate'],
  ['questions', 'q-1', 'questions:requestState', 'questions:stateUpdate'],
  ['handout', 'h-1', 'handout:requestState', 'handout:stateUpdate'],
  ['activity', 'act-1', 'activity:requestState', 'activity:stateUpdate']
];

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function waitFor(socket, event, predicate = () => true, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const handler = data => {
      if (!predicate(data)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeout);
    socket.on(event, handler);
  });
}
const maybe = (promise) => promise.catch(() => null);

let url;
const sockets = [];
async function connect() {
  const socket = ioClient(url, { transports: ['websocket'], reconnection: false, forceNew: true });
  socket.inbox = [];
  socket.onAny((event, data) => socket.inbox.push([event, data]));
  sockets.push(socket);
  await waitFor(socket, 'connect');
  return socket;
}
const errorOf = (reply) => JSON.stringify(reply?.error);
const received = (socket, event, widgetId) => socket.inbox.filter(([e, d]) => e === event && d?.widgetId === widgetId).length;

async function host() {
  const socket = await connect();
  const result = await socket.timeout(3000).emitWithAck('session:create', {});
  assert.equal(result.success, true, `session:create: ${result.error}`);
  socket.code = result.code;
  return socket;
}
async function room(hostSocket, roomType, widgetId) {
  const result = await hostSocket.timeout(3000).emitWithAck('session:createRoom', {
    sessionCode: hostSocket.code, roomType, widgetId
  });
  assert.equal(result.success, true, `createRoom ${roomType}: ${result.error}`);
  const changed = waitFor(hostSocket, 'session:widgetStateChanged', d => d.widgetId === widgetId && d.isActive);
  hostSocket.emit('session:updateWidgetState', { sessionCode: hostSocket.code, roomType, widgetId, isActive: true });
  await changed;
}
async function join(code, name) {
  const socket = await connect();
  const joined = waitFor(socket, 'session:joined');
  socket.emit('session:join', { code, name, studentId: socket.id });
  const data = await joined;
  assert.equal(data.success, true, `join: ${data.error}`);
  return socket;
}

(async () => {
  const port = await freePort();
  process.env.PORT = String(port);
  process.env.NODE_ENV = 'development';
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
  const AppServer = require('../src/server.js');
  const app = new AppServer();
  const originalLog = console.log;
  console.log = () => {}; // start-up banner
  await app.start();
  console.log = originalLog;
  console.warn = () => {};
  url = `http://127.0.0.1:${port}`;
  const { sessionManager } = app;

  try {
    const teacher = await host();
    const code = teacher.code;
    for (const [type, id] of READS) await room(teacher, type, id);
    teacher.emit('session:poll:update', { sessionCode: code, widgetId: 'poll-1', pollData: { question: 'Q', options: ['Yes', 'No'] } });
    const longAnswer = Array.from({ length: 100 }, (_, i) => `const value${i} = compute(${i});`).join('\n');
    assert.ok(longAnswer.length > 2000);
    teacher.emit('session:activity:update', { sessionCode: code, widgetId: 'act-1', activity: {
      type: 'code-fill-blank', title: 'Long code',
      items: [{ id: 'i1', content: longAnswer }, { id: 'i2', content: 'exact answer' }],
      targets: [{ id: 't1', accepts: ['i1'] }, { id: 't2', accepts: ['i2'], evaluationMode: 'exact' }],
      uiRecipe: []
    } });
    teacher.emit('session:handout:add', { sessionCode: code, widgetId: 'h-1', content: 'Reading list' });
    await delay(150);
    step(`setup: session ${code} with all six room types active`);

    const alice = await join(code, 'Alice Tan');
    const outsider = await connect();
    const otherTeacher = await host();
    const mallory = await join(otherTeacher.code, 'Mallory');

    await check('a socket that never joined gets no state from any of the six rooms', async () => {
      for (const [, id, request, reply] of READS) {
        const got = maybe(waitFor(outsider, reply, d => d.widgetId === id, 1000));
        outsider.emit(request, { sessionCode: code, widgetId: id });
        assert.equal(await got, null, `${request} answered a socket that never joined`);
      }
    });

    await check('a student of another session gets no state from this session', async () => {
      for (const [, id, request, reply] of READS) {
        const got = maybe(waitFor(mallory, reply, d => d.widgetId === id, 1000));
        mallory.emit(request, { sessionCode: code, widgetId: id });
        assert.equal(await got, null, `${request} answered a student of another session`);
      }
    });

    await check('a non-member read does not refresh the room idle timer', async () => {
      const session = sessionManager.getSession(code);
      const questions = session.getRoom('questions', 'q-1');
      questions.lastActivity = Date.now() - 60_000;
      const before = questions.lastActivity;
      outsider.emit('questions:requestState', { sessionCode: code, widgetId: 'q-1' });
      mallory.emit('questions:requestState', { sessionCode: code, widgetId: 'q-1' });
      await delay(300);
      assert.equal(questions.lastActivity, before);
    });

    await check('a joined student reads all six rooms, and the host reads its own', async () => {
      for (const reader of [alice, teacher]) {
        for (const [, id, request, reply] of READS) {
          const got = waitFor(reader, reply, d => d.widgetId === id, 1500);
          reader.emit(request, { sessionCode: code, widgetId: id });
          await got;
        }
      }
    });

    await check('six back-to-back reads of every room from one socket are all answered', async () => {
      // The student app sends at most three reads of a card per connection
      // (mount, then one after each of the two rejoins on a reconnect), and
      // a reconnect is a new socket with a fresh budget. Six rounds within
      // a second leave twice that headroom.
      const student = await join(code, 'Reconnecting student');
      for (let round = 0; round < 6; round++) {
        for (const [, id, request] of READS) student.emit(request, { sessionCode: code, widgetId: id });
      }
      const allIn = () => READS.every(([, id, , reply]) => received(student, reply, id) >= 6);
      for (let i = 0; i < 50 && !allIn(); i++) await delay(100);
      await delay(200);
      for (const [, id, , reply] of READS) {
        assert.equal(received(student, reply, id), 6, `${reply} answered ${received(student, reply, id)} of 6`);
      }
    });

    await check('a burst of 200 reads from one joined socket is throttled, per room', async () => {
      const reader = await join(code, 'Burst reader');
      for (let i = 0; i < 200; i++) reader.emit('questions:requestState', { sessionCode: code, widgetId: 'q-1' });
      await delay(500);
      const answered = received(reader, 'questions:stateUpdate', 'q-1');
      step(`  200 questions reads answered: ${answered}`);
      assert.ok(answered >= 6 && answered <= 10, `answered ${answered}`);
      // Another room is unaffected by the exhausted one
      const other = waitFor(reader, 'handout:stateUpdate', d => d.widgetId === 'h-1', 1000);
      reader.emit('handout:requestState', { sessionCode: code, widgetId: 'h-1' });
      await other;
    });

    await check('the host is budgeted like everyone else but still answered', async () => {
      await delay(5100); // let the earlier host reads' window close
      const before = received(teacher, 'poll:stateUpdate', 'poll-1');
      for (let i = 0; i < 50; i++) teacher.emit('poll:requestState', { sessionCode: code, widgetId: 'poll-1' });
      for (let i = 0; i < 50 && received(teacher, 'poll:stateUpdate', 'poll-1') - before < 10; i++) await delay(100);
      await delay(300);
      assert.equal(received(teacher, 'poll:stateUpdate', 'poll-1') - before, 10);
    });

    await check('read budgets cannot grow by creating and closing rooms', async () => {
      // Each budget lives on its socket and at most 2 x MAX_ROOMS_PER_SESSION
      // are kept, however many rooms a host cycles through. The first 21
      // cycles fit in one 5 s window, so the 21st room's read is refused.
      const cycler = await host();
      let answered = 0;
      const started = Date.now();
      for (let i = 0; i < 60; i++) {
        const widgetId = `cycle-${i}`;
        const created = await cycler.timeout(3000).emitWithAck('session:createRoom', { sessionCode: cycler.code, roomType: 'handout', widgetId });
        assert.equal(created.success, true, `createRoom ${widgetId}: ${created.error}`);
        const got = maybe(waitFor(cycler, 'handout:stateUpdate', d => d.widgetId === widgetId, i < 20 ? 1500 : 300));
        cycler.emit('handout:requestState', { sessionCode: cycler.code, widgetId });
        if (await got) answered++;
        cycler.emit('session:closeRoom', { sessionCode: cycler.code, roomType: 'handout', widgetId });
      }
      const serverSocket = app.io.sockets.sockets.get(cycler.id);
      const { LIMITS } = require('../src/config/constants');
      step(`  host cycling 60 rooms in ${Date.now() - started} ms: ${answered} reads answered, ${serverSocket.data.stateReads.size} budgets held`);
      assert.ok(serverSocket.data.stateReads.size <= 2 * LIMITS.MAX_ROOMS_PER_SESSION);
      // Reads of further rooms are refused while the 20 windows are live,
      // not answered by evicting (and so resetting) another room's budget
      assert.ok(answered >= 2 * LIMITS.MAX_ROOMS_PER_SESSION && answered < 60, `answered ${answered}`);
    });

    const SUBMITS = [
      ['session:poll:vote', 'session:poll:voteConfirmed', { widgetId: 'poll-1', optionIndex: 0 }],
      ['session:linkShare:submit', 'session:linkShare:submitted', { widgetId: 'ls-1', content: 'https://example.com' }],
      ['session:rtfeedback:submit', 'session:rtfeedback:submitted', { widgetId: 'fb-1', value: 3 }],
      ['session:questions:submit', 'session:questions:submitted', { widgetId: 'q-1', question: 'Why?' }]
    ];
    const submitReply = async (socket, event, reply, payload) => {
      const got = waitFor(socket, reply, () => true, 1500);
      socket.emit(event, payload);
      return got;
    };
    const ackReply = (socket, event, payload) => socket.timeout(1500).emitWithAck(event, payload);

    await check('a non-member submit gets the same answer for a real and an unknown code', async () => {
      const guesser = await connect();
      for (const [event, reply, data] of SUBMITS) {
        const real = await submitReply(guesser, event, reply, { sessionCode: code, ...data });
        await delay(event === 'session:questions:submit' ? 1600 : 600);
        const fake = await submitReply(guesser, event, reply, { sessionCode: 'ZZZZZ9', ...data });
        assert.equal(real.success, false, `${event} accepted from a non-member`);
        assert.equal(errorOf(real), errorOf(fake), `${event}: real code ${errorOf(real)} vs unknown ${errorOf(fake)}`);
        await delay(event === 'session:questions:submit' ? 1600 : 600);
      }
      for (const event of ['session:activity:submit', 'session:activity:retry']) {
        const real = await ackReply(guesser, event, { sessionCode: code, widgetId: 'act-1', answers: {} });
        const fake = await ackReply(guesser, event, { sessionCode: 'ZZZZZ9', widgetId: 'act-1', answers: {} });
        assert.equal(real.success, false, `${event} accepted from a non-member`);
        assert.equal(errorOf(real), errorOf(fake), `${event}: real code ${errorOf(real)} vs unknown ${errorOf(fake)}`);
        await delay(1100);
      }
      // A student of another session is refused the same way
      const cross = await submitReply(mallory, 'session:poll:vote', 'session:poll:voteConfirmed', { sessionCode: code, widgetId: 'poll-1', optionIndex: 0 });
      assert.equal(cross.success, false);
    });

    await check('a joined student can still submit to every room type', async () => {
      const student = await join(code, 'Submitting student');
      for (const [event, reply, data] of SUBMITS) {
        const result = await submitReply(student, event, reply, { sessionCode: code, ...data });
        assert.equal(result.success, true, `${event}: ${errorOf(result)}`);
      }
      const submitted = await ackReply(student, 'session:activity:submit', { sessionCode: code, widgetId: 'act-1', answers: { textInputs: { t1: longAnswer, t2: 'exact answer' } } });
      assert.equal(submitted.success, true, errorOf(submitted));
      const retried = await ackReply(student, 'session:activity:retry', { sessionCode: code, widgetId: 'act-1' });
      assert.equal(retried.success, true, errorOf(retried));
      // Without a sessionCode the joined session is used, as before
      const vote = await submitReply(await join(code, 'No code'), 'session:poll:vote', 'session:poll:voteConfirmed', { widgetId: 'poll-1', optionIndex: 1 });
      assert.equal(vote.success, true, errorOf(vote));
    });

    await check('a long code answer with extra indentation is graded right; exact answers stay capped', async () => {
      const student = await join(code, 'Indenting student');
      const indented = longAnswer.split('\n').map(line => `        ${line}`).join('\n');
      const exactLong = 'x'.repeat(longAnswer.length + 5000);
      const result = await ackReply(student, 'session:activity:submit', { sessionCode: code, widgetId: 'act-1', answers: { textInputs: { t1: indented, t2: exactLong } } });
      assert.equal(result.success, true, errorOf(result));
      assert.deepEqual(result.results.correct, ['t1']);
      const stored = sessionManager.getSession(code).getRoom('activity', 'act-1').responses.get(student.id);
      assert.ok(stored.answers.textInputs.t1.length <= longAnswer.length, `t1 stored ${stored.answers.textInputs.t1.length}`);
      assert.ok(stored.answers.textInputs.t2.length <= longAnswer.length, `t2 stored ${stored.answers.textInputs.t2.length}`);
    });

    await check('at the response cap, a departed student\'s answer makes room; stored answers of present students stay', async () => {
      const session = sessionManager.getSession(code);
      const activity = session.getRoom('activity', 'act-1');
      const { LIMITS } = require('../src/config/constants');
      const cap = LIMITS.MAX_SUBMISSIONS_PER_ROOM;
      const kept = [...activity.responses.keys()].filter(id => session.getParticipant(id));
      assert.ok(kept.length > 0);
      // Fill to the cap with answers of students who have left (reconnect churn)
      for (let i = 0; activity.responses.size < cap; i++) {
        activity.responses.set(`departed-${i}`, { answers: { placements: [], textInputs: {} }, results: {}, submittedAt: Date.now() });
      }
      const late = await join(code, 'Late student');
      const result = await ackReply(late, 'session:activity:submit', { sessionCode: code, widgetId: 'act-1', answers: { textInputs: { t2: 'exact answer' } } });
      assert.equal(result.success, true, errorOf(result));
      assert.equal(activity.responses.size, cap);
      assert.ok(activity.responses.has(late.id));
      for (const id of kept) assert.ok(activity.responses.has(id), 'a present student\'s answer was dropped');
    });

    await check('when every stored answer belongs to a present student, the cap refuses with a clear error', async () => {
      const session = sessionManager.getSession(code);
      const activity = session.getRoom('activity', 'act-1');
      const { LIMITS } = require('../src/config/constants');
      // Only possible past the session's participant cap, which is the same
      // number, so join first and then mark every filler as still present.
      const late = await join(code, 'Later student');
      const fakes = [...activity.responses.keys()].filter(id => !session.getParticipant(id));
      for (const id of fakes) session.participants.set(id, { name: 'Present', studentId: id, joinedAt: Date.now(), socketId: id });
      try {
        const result = await ackReply(late, 'session:activity:submit', { sessionCode: code, widgetId: 'act-1', answers: { textInputs: { t2: 'exact answer' } } });
        assert.equal(result.success, false);
        assert.match(errorOf(result), /full/i);
        assert.equal(activity.responses.size, LIMITS.MAX_SUBMISSIONS_PER_ROOM);
      } finally {
        for (const id of fakes) session.participants.delete(id);
      }
    });

    await check('submits naming a dead session do not stop a class behind one address from joining', async () => {
      // After a restart, taps buffered while offline reach the server before
      // each student's rejoin. They must not spend the per-IP join budget.
      const guesser = await connect();
      for (let i = 0; i < 75; i++) {
        guesser.emit('session:rtfeedback:submit', { sessionCode: `GS${String(i).padStart(4, '0')}`, widgetId: 'fb-1', value: 3 });
        if (i % 4 === 3) await delay(510);
      }
      await delay(300);
      const joiner = await connect();
      const joined = waitFor(joiner, 'session:joined');
      joiner.emit('session:join', { code, name: 'After the restart' });
      const data = await joined;
      assert.equal(data.success, true, `join refused: ${data.error}`);
    });
  } catch (error) {
    failures.push('setup');
    step(`FAIL ${error.stack || error}`);
  } finally {
    step(failures.length ? `RESULT FAIL: ${failures.join('; ')}` : 'RESULT PASS: state access, budgets, submit guard and activity caps');
    writeFileSync(path.join(evidence, 'state-access.txt'), lines.join('\n') + '\n');
    for (const socket of sockets) socket.disconnect();
    process.exit(failures.length ? 1 : 0);
  }
})();
