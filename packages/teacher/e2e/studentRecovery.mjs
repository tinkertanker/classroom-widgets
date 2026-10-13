// Real student UI + server regression for PR #267. Run from the repository:
// CHROME_BIN=/path/to/chrome pnpm --filter @classroom-widgets/teacher exec node e2e/studentRecovery.mjs
// Evidence: $CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR/student-recovery.txt.
// Failure modes: an acknowledgment from another feedback card changes its
// reset epoch; reconnect resurrects cleared feedback or drops valid feedback;
// an activity card retains a score/reveal/reset it missed while disconnected.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { io } from 'socket.io-client';
import { chromium } from 'playwright-core';
import { createStepLog, prepareEvidence, startStack } from './harness.mjs';

const evidence = prepareEvidence('student-recovery', ['student-recovery.txt']);
const { step, write } = createStepLog(join(evidence, 'student-recovery.txt'));
let stack, browser, host;
const failures = [];
const latest = new Map();
async function until(predicate, label) {
  for (let i = 0; i < 150; i++) {
    if (await predicate()) return;
    await delay(100);
  }
  assert.fail(label);
}
async function check(label, run) {
  try { await run(); step(`PASS ${label}`); }
  catch (error) { failures.push(label); step(`FAIL ${label}: ${error.message}`); }
}

try {
  stack = await startStack();
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
  host = io(stack.serverUrl, { transports: ['websocket'] });
  await new Promise(resolve => host.once('connect', resolve));
  host.on('rtfeedback:dataUpdate', data => latest.set(data.widgetId, data));
  const session = await host.timeout(5000).emitWithAck('session:create', {});
  assert.equal(session.success, true);
  const sessionCode = session.code;
  const send = (event, widgetId, data = {}) => host.emit(event, { sessionCode, widgetId, ...data });
  const room = async (roomType, widgetId) => {
    const result = await host.timeout(5000).emitWithAck('session:createRoom', { sessionCode, roomType, widgetId });
    assert.equal(result.success, true);
    send('session:updateWidgetState', widgetId, { roomType, isActive: true });
  };
  await room('rtfeedback', 'feedback-a');
  await room('rtfeedback', 'feedback-b');
  // Distinct epochs expose cross-card acknowledgments; identical epochs hide it.
  send('session:rtfeedback:reset', 'feedback-b');
  await room('activity', 'activity-a');
  send('session:activity:update', 'activity-a', { activity: {
    type: 'code-fill-blank', title: 'Recovery activity',
    items: [{ id: 'item-0', content: 'moon' }],
    targets: [{ id: 'blank-0', accepts: ['item-0'] }],
    uiRecipe: [{ id: 'input', type: 'text-input', props: { targetId: 'blank-0', placeholder: 'Recovery answer' } }]
  } });
  const context = await browser.newContext();
  // Chromium's offline emulation does not close an already-open WebSocket.
  // Close the real transport too, as a broken network connection would.
  await context.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    const sockets = [];
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args) {
        super(...args);
        if (String(args[0]).includes('/socket.io/')) sockets.push(this);
      }
    };
    window.dropTransports = () => sockets.forEach(socket => socket.close());
  });
  const student = await context.newPage();
  await student.goto(stack.studentUrl);
  await student.locator('#name').fill('Ada');
  await student.locator('#code').fill(sessionCode);
  await student.getByRole('button', { name: 'Join Session' }).click();
  await until(async () => await student.getByRole('slider').count() === 2, 'two feedback cards appear');
  await student.getByPlaceholder('Recovery answer').waitFor();
  step('Student joined with two feedback cards and an editable activity');
  // Cards are newest first: B then A.
  const submit = async (index, value) => {
    const slider = student.getByRole('slider').nth(index);
    await slider.scrollIntoViewIfNeeded();
    const box = await slider.boundingBox();
    await student.mouse.click(box.x + (value === 1 ? 2 : box.width - 2), box.y + box.height / 2);
    assert.equal(await slider.inputValue(), String(value));
    await delay(200);
  };
  await submit(1, 1);
  await submit(0, 5);
  await until(() => latest.get('feedback-a')?.totalResponses === 1 && latest.get('feedback-b')?.totalResponses === 1,
    'both feedback submissions accepted');
  await context.setOffline(true);
  await student.evaluate(() => window.dropTransports());
  await until(() => latest.get('feedback-a')?.totalResponses === 0 && latest.get('feedback-b')?.totalResponses === 0,
    'disconnect removes both feedback values and notifies teacher');
  await context.setOffline(false);
  await check('two feedback cards replay their own confirmed values after reconnect', async () => {
    await until(() => latest.get('feedback-a')?.totalResponses === 1 && latest.get('feedback-b')?.totalResponses === 1,
      'both feedback values should be replayed');
    assert.deepEqual(latest.get('feedback-a').understanding, [1, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(latest.get('feedback-b').understanding, [0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });

  await student.getByPlaceholder('Recovery answer').fill('wrong');
  await student.getByRole('button', { name: 'Check Answers' }).click();
  await student.getByText('Score: 0 / 1', { exact: true }).waitFor();
  send('session:activity:reveal', 'activity-a', { reveal: true });
  await student.getByText('Correct answer: moon', { exact: true }).waitFor();
  await context.setOffline(true);
  await student.evaluate(() => window.dropTransports());
  await delay(500);
  send('session:activity:reset', 'activity-a');
  send('session:rtfeedback:reset', 'feedback-b');
  await context.setOffline(false);
  await check('reconnect clears activity results and reveal after a missed teacher reset', async () => {
    await until(async () => await student.getByText('Score: 0 / 1', { exact: true }).count() === 0,
      'stale score should disappear');
    assert.equal(await student.getByText('Correct answer: moon', { exact: true }).count(), 0);
    assert.equal(await student.getByPlaceholder('Recovery answer').isEnabled(), true);
    await student.getByPlaceholder('Recovery answer').fill('moon');
    await student.getByRole('button', { name: 'Check Answers' }).click();
    await student.getByText('Score: 1 / 1', { exact: true }).waitFor();
  });
  await check('feedback cleared while offline is not resurrected', async () => {
    await delay(1000);
    assert.equal(latest.get('feedback-b').totalResponses, 0);
  });
  await room('poll', 'poll-a');
  send('session:poll:update', 'poll-a', { pollData: { question: 'Original poll', options: ['Old A', 'Old B'] } });
  await student.getByText('Old A', { exact: true }).click();
  await student.getByText('Your choice', { exact: true }).waitFor();
  await context.setOffline(true);
  await student.evaluate(() => window.dropTransports());
  send('session:poll:update', 'poll-a', { pollData: { question: 'New poll', options: ['New A', 'New B'] } });
  const voter = io(stack.serverUrl, { transports: ['websocket'] });
  try {
    await new Promise(resolve => voter.once('connect', resolve));
    voter.emit('session:join', { code: sessionCode, name: 'Ben' });
    await new Promise(resolve => voter.once('session:joined', resolve));
    voter.emit('session:poll:vote', { sessionCode, widgetId: 'poll-a', optionIndex: 1 });
    const confirmed = await new Promise(resolve => voter.once('session:poll:voteConfirmed', resolve));
    assert.equal(confirmed.success, true);
  } finally { voter.disconnect(); }
  await context.setOffline(false);
  await check('changed poll allows another vote even when someone voted before reconnect', async () => {
    await student.getByText('New A', { exact: true }).waitFor();
    assert.equal(await student.getByText('Your choice', { exact: true }).count(), 0);
    await student.getByText('New A', { exact: true }).click();
    await student.getByText('Your choice', { exact: true }).waitFor();
    await student.getByText('50%', { exact: true }).first().waitFor();
  });
  await check('online option changes unlock voting, while unchanged options preserve the vote', async () => {
    send('session:poll:update', 'poll-a', { pollData: { question: 'Same options', options: ['New A', 'New B'] } });
    await student.getByText('Same options', { exact: true }).waitFor();
    assert.equal(await student.getByText('Your choice', { exact: true }).count(), 1);
    send('session:poll:update', 'poll-a', { pollData: { question: 'Third poll', options: ['Third A', 'Third B'] } });
    await student.getByText('Third A', { exact: true }).click();
    await student.getByText('Your choice', { exact: true }).waitFor();
    await student.getByText('100%', { exact: true }).waitFor();
  });
  assert.deepEqual(failures, []);
} catch (error) {
  step(`FAIL ${error.stack || error}`);
  process.exitCode = 1;
} finally {
  host?.disconnect();
  await browser?.close();
  await stack?.stop();
  write();
}
