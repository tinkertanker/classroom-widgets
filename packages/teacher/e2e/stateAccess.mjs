// Real student UI + server check for #231: widget state is read only by
// members, within a per-room budget, and the student app still loads every
// card after a join, a page reload and a Wi-Fi drop. From the repository:
//
//   pnpm --filter @classroom-widgets/teacher exec node e2e/stateAccess.mjs
//
// The teacher side is a host socket that drives all six networked room types
// (Poll, Drop Box, Feedback, Questions, Handout, Fill in the Blanks).
// Evidence: $CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR/state-access-ui.txt and
// screenshots 1-joined.png, 2-after-drop.png, 3-after-reload.png.
// Failure modes:
// - a card is left with stale or missing state after a Wi-Fi drop, because
//   its state request went out before the socket rejoined and was refused;
// - a reloaded page's cards do not load;
// - the student app sends more reads per card than the server budget allows;
// - a socket that never joined is answered, or a burst is answered in full.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { io } from 'socket.io-client';
import { chromium } from 'playwright-core';
import { createStepLog, prepareEvidence, startStack } from './harness.mjs';

const evidence = prepareEvidence('state-access-ui', ['state-access-ui.txt', '1-joined.png', '2-after-drop.png',
  '3-after-reload.png', 'failure.png']);
const { step, write } = createStepLog(join(evidence, 'state-access-ui.txt'));
const failures = [];
async function check(label, run) {
  try { await run(); step(`PASS ${label}`); }
  catch (error) { failures.push(label); step(`FAIL ${label}: ${error.message}`); }
}
async function until(predicate, label, tries = 100) {
  for (let i = 0; i < tries; i++) {
    if (await predicate()) return;
    await delay(100);
  }
  assert.fail(label);
}

const ROOMS = [
  ['poll', 'poll-a'], ['linkShare', 'drop-a'], ['rtfeedback', 'feedback-a'],
  ['questions', 'questions-a'], ['handout', 'handout-a'], ['activity', 'activity-a']
];
const fillBlank = (title, placeholder) => ({
  type: 'code-fill-blank', title,
  items: [{ id: 'item-0', content: 'moon' }],
  targets: [{ id: 'blank-0', accepts: ['item-0'] }],
  uiRecipe: [{ id: 'input', type: 'text-input', props: { targetId: 'blank-0', placeholder } }]
});

let stack, browser, host, student;
try {
  stack = await startStack();
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
  host = io(stack.serverUrl, { transports: ['websocket'] });
  await new Promise(resolve => host.once('connect', resolve));
  const session = await host.timeout(5000).emitWithAck('session:create', {});
  assert.equal(session.success, true);
  const code = session.code;
  const send = (event, widgetId, data = {}) => host.emit(event, { sessionCode: code, widgetId, ...data });
  for (const [roomType, widgetId] of ROOMS) {
    const result = await host.timeout(5000).emitWithAck('session:createRoom', { sessionCode: code, roomType, widgetId });
    assert.equal(result.success, true);
    send('session:updateWidgetState', widgetId, { roomType, isActive: true });
  }
  send('session:poll:update', 'poll-a', { pollData: { question: 'Poll before drop', options: ['Red', 'Blue'] } });
  send('session:handout:add', 'handout-a', { content: 'Handout before drop' });
  send('session:activity:update', 'activity-a', { activity: fillBlank('Before', 'Answer before drop') });
  await delay(200);
  step(`Teacher session ${code} with Poll, Drop Box, Feedback, Questions, Handout and Fill in the Blanks running`);

  const context = await browser.newContext({ viewport: { width: 900, height: 2400 } });
  // Chromium's offline mode does not close an open WebSocket; close the
  // transport too, as a dropped Wi-Fi connection would.
  // Offline emulation does not stop new WebSockets either, so while the
  // network is "down" every new socket.io WebSocket is closed at once.
  await context.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    const sockets = [];
    let down = false;
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args) {
        super(...args);
        if (!String(args[0]).includes('/socket.io/')) return;
        sockets.push(this);
        if (down) this.addEventListener('open', () => this.close());
      }
    };
    window.networkDown = () => { down = true; sockets.forEach(socket => socket.close()); };
    window.networkUp = () => { down = false; };
  });
  student = await context.newPage();
  // Every state read the page sends and every state reply it receives
  const frames = [];
  student.on('websocket', ws => {
    const record = (direction) => ({ payload }) => {
      const match = typeof payload === 'string' && payload.match(/^42(\[.*\])$/s);
      if (!match) return;
      const [event, data] = JSON.parse(match[1]);
      if (/:(requestState|stateUpdate)$/.test(event) || event === 'session:joined') {
        frames.push({ direction, event, widgetId: data?.widgetId, at: Date.now() });
      }
    };
    ws.on('framesent', record('sent'));
    ws.on('framereceived', record('received'));
  });
  const readsSince = (since) => {
    const counts = {};
    for (const f of frames) if (f.direction === 'sent' && f.at >= since && f.event.endsWith(':requestState')) {
      counts[f.widgetId] = (counts[f.widgetId] || 0) + 1;
    }
    return counts;
  };
  const repliesSince = (since, widgetId) => frames.filter(f => f.direction === 'received' && f.at >= since
    && f.event.endsWith(':stateUpdate') && f.widgetId === widgetId).length;

  const joinFromForm = async () => {
    await student.locator('#name').fill('Ada');
    await student.locator('#code').fill(code);
    await student.getByRole('button', { name: 'Join Session' }).click();
  };
  const cardsShow = async (label, { poll, handout, placeholder, dropPlaceholder, questionsPaused, feedbackPaused }) => {
    await student.getByText(poll, { exact: true }).waitFor({ timeout: 10000 });
    await student.getByText(handout, { exact: true }).waitFor({ timeout: 10000 });
    await student.getByPlaceholder(placeholder).waitFor({ timeout: 10000 });
    await student.getByPlaceholder(dropPlaceholder).waitFor({ timeout: 10000 });
    if (questionsPaused) await student.getByText('Submissions Paused').waitFor({ timeout: 10000 });
    else await student.getByPlaceholder('Ask a question or share a comment...').waitFor({ timeout: 10000 });
    if (feedbackPaused) await student.getByText('Feedback Paused').waitFor({ timeout: 10000 });
    else await student.getByRole('slider').waitFor({ timeout: 10000 });
    step(`  ${label}: all six cards show the teacher's current state`);
  };

  let mark = Date.now();
  await student.goto(stack.studentUrl);
  await joinFromForm();
  await check('a student who joins sees all six cards loaded', async () => {
    await cardsShow('joined', {
      poll: 'Poll before drop', handout: 'Handout before drop', placeholder: 'Answer before drop',
      dropPlaceholder: 'Paste a link or type a short message...'
    });
    await student.screenshot({ path: join(evidence, '1-joined.png'), fullPage: true });
  });
  await delay(1000);
  step(`  reads per card on join: ${JSON.stringify(readsSince(mark))}`);

  await check('after a Wi-Fi drop, every card catches up on changes made while offline', async () => {
    await context.setOffline(true);
    await student.evaluate(() => window.networkDown());
    await delay(500);
    send('session:poll:update', 'poll-a', { pollData: { question: 'Poll after drop', options: ['Green', 'Gold'] } });
    send('session:handout:add', 'handout-a', { content: 'Handout after drop' });
    send('session:activity:update', 'activity-a', { activity: fillBlank('After', 'Answer after drop') });
    send('session:linkShare:setAcceptMode', 'drop-a', { acceptMode: 'links' });
    send('session:updateWidgetState', 'questions-a', { roomType: 'questions', isActive: false });
    send('session:updateWidgetState', 'feedback-a', { roomType: 'rtfeedback', isActive: false });
    await delay(1500);
    // Nothing reached the student while it was offline
    assert.equal(await student.getByText('Poll after drop', { exact: true }).count(), 0, 'student was not offline');
    mark = Date.now();
    await context.setOffline(false);
    await student.evaluate(() => window.networkUp());
    await cardsShow('after drop', {
      poll: 'Poll after drop', handout: 'Handout after drop', placeholder: 'Answer after drop',
      dropPlaceholder: 'example.com or https://example.com', questionsPaused: true, feedbackPaused: true
    });
    await student.screenshot({ path: join(evidence, '2-after-drop.png'), fullPage: true });
    await delay(1500);
    const reads = readsSince(mark);
    step(`  reads per card after the drop: ${JSON.stringify(reads)}`);
    for (const [, widgetId] of ROOMS) {
      assert.ok((reads[widgetId] || 0) >= 1, `${widgetId} sent no state read after rejoining`);
      assert.ok((reads[widgetId] || 0) <= 10, `${widgetId} sent ${reads[widgetId]} reads, over the server budget`);
      assert.ok(repliesSince(mark, widgetId) >= 1, `${widgetId} got no state reply after rejoining`);
    }
  });

  await check('after a page reload and rejoin, every card loads', async () => {
    mark = Date.now();
    send('session:updateWidgetState', 'questions-a', { roomType: 'questions', isActive: true });
    send('session:updateWidgetState', 'feedback-a', { roomType: 'rtfeedback', isActive: true });
    await student.reload();
    await joinFromForm();
    await cardsShow('reloaded', {
      poll: 'Poll after drop', handout: 'Handout after drop', placeholder: 'Answer after drop',
      dropPlaceholder: 'example.com or https://example.com'
    });
    await student.screenshot({ path: join(evidence, '3-after-reload.png'), fullPage: true });
    await delay(1000);
    step(`  reads per card after reload: ${JSON.stringify(readsSince(mark))}`);
  });

  await check('a socket that never joined gets no state, and a member burst is throttled', async () => {
    const outsider = io(stack.serverUrl, { transports: ['websocket'] });
    try {
      await new Promise(resolve => outsider.once('connect', resolve));
      const replies = [];
      outsider.onAny((event, data) => { if (event.endsWith(':stateUpdate')) replies.push(data?.widgetId); });
      for (const [roomType, widgetId] of ROOMS) outsider.emit(`${roomType}:requestState`, { sessionCode: code, widgetId });
      await delay(800);
      assert.deepEqual(replies, [], 'outsider was answered');
      step('  never-joined socket: 0 of 6 reads answered');
      outsider.emit('session:join', { code, name: 'Burst' });
      await new Promise(resolve => outsider.once('session:joined', resolve));
      for (let i = 0; i < 200; i++) outsider.emit('questions:requestState', { sessionCode: code, widgetId: 'questions-a' });
      await delay(800);
      const answered = replies.filter(id => id === 'questions-a').length;
      step(`  joined socket, 200 back-to-back Questions reads: ${answered} answered`);
      assert.ok(answered > 0 && answered <= 10, `burst answered ${answered}`);
    } finally { outsider.disconnect(); }
  });

  assert.deepEqual(failures, []);
  step('RESULT PASS');
} catch (error) {
  step(`FAIL ${error.stack || error}`);
  await student?.screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  host?.disconnect();
  await browser?.close();
  await stack?.stop();
  write();
}
