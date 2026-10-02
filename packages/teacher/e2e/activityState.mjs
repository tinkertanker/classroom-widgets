// Real teacher/student regression for #222: a state reply must not announce a
// new activation and trigger another request. Host pause/resume still must work.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createStepLog, newTeacherContext, prepareEvidence, startStack } from './harness.mjs';

const evidence = prepareEvidence('activity-state', ['activity-state.txt']);
const { step, write } = createStepLog(join(evidence, 'activity-state.txt'));
const violations = [];
const pausedText = 'Activity is paused. Please wait for your teacher.';
let stack;
let browser;

function observe(page) {
  const events = [];
  const record = (direction, payload) => {
    for (const packet of String(payload).split('\x1e')) {
      const match = packet.match(/^42\d*(\[.*\])$/s);
      if (!match) continue;
      const [event, data] = JSON.parse(match[1]);
      if (event.startsWith('activity:') || event === 'session:widgetStateChanged') {
        events.push({ direction, event, data });
      }
    }
  };
  // Socket.IO can send the first state request before upgrading from polling.
  const isPolling = url => url.includes('/socket.io/') && url.includes('transport=polling');
  page.on('request', request => {
    if (isPolling(request.url()) && request.method() === 'POST') {
      record('framesent', request.postData());
    }
  });
  page.on('response', async response => {
    if (isPolling(response.url()) && response.request().method() === 'GET') {
      // Reloading aborts an outstanding long poll; it has no completed payload.
      const body = await response.text().catch(() => '');
      record('framereceived', body);
    }
  });
  page.on('websocket', ws => {
    for (const direction of ['framesent', 'framereceived']) {
      ws.on(direction, ({ payload }) => record(direction, payload));
    }
  });
  return events;
}

async function checkTraffic(page, events, label, requests, changes, active) {
  // Allow the old feedback loop to exhaust its five-per-second rate limit.
  await page.waitForTimeout(1200);
  const sent = events.filter(e => e.direction === 'framesent' && e.event === 'activity:requestState');
  const replies = events.filter(e => e.direction === 'framereceived' && e.event === 'activity:stateUpdate');
  const notifications = events.filter(e => e.direction === 'framereceived' && e.event === 'session:widgetStateChanged');
  step(`${label}: requests=${sent.length}, replies=${replies.length}, state changes=${notifications.length}`);
  if (sent.length !== requests || replies.length !== requests || notifications.length !== changes) {
    violations.push(`${label}: expected ${requests} requests/replies and ${changes} state changes`);
  }
  for (const reply of replies) {
    assert.equal(reply.data.isActive, active, `${label}: state response carries active status`);
    assert.ok(reply.data.activity.targets.length > 0, `${label}: full activity is present`);
    assert.equal(reply.data.actions.find(a => a.type === 'submit')?.enabled, active,
      `${label}: actions reflect the current active status`);
  }
}

try {
  stack = await startStack();
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
  for (const [name, template] of [
    ['Fill in the Blanks', 'The {{moon}} orbits Earth.'],
    ['Code Fill-in-the-Blanks', 'print({{42}})']
  ]) {
    const teacherContext = await newTeacherContext(browser);
    const teacher = await teacherContext.newPage();
    await teacher.goto(stack.teacherUrl);
    await teacher.getByTitle('More widgets (⌘K)').click();
    await teacher.getByPlaceholder('Search widgets...').fill(name);
    await teacher.getByRole('dialog').getByText(name, { exact: true }).click();
    await teacher.getByRole('button', { name: 'Create Activity' }).click();
    await teacher.getByTitle('Settings', { exact: true }).click();
    await teacher.getByRole('dialog').locator('textarea').fill(template);
    await teacher.getByRole('button', { name: 'Save Activity' }).click();
    await teacher.getByTitle('Pause activity').waitFor();
    const code = (await teacher.locator('code').filter({ hasText: /^[A-Z0-9]{6}$/ }).first().textContent()).trim();

    const studentContext = await browser.newContext();
    const student = await studentContext.newPage();
    const events = observe(student);
    await student.goto(stack.studentUrl);
    await student.locator('#name').fill('Ada');
    await student.locator('#code').fill(code);
    await student.getByRole('button', { name: 'Join Session' }).click();
    await student.getByRole('button', { name: 'Check Answers' }).waitFor();
    // startStack uses Vite dev: React StrictMode mounts the request effect twice.
    // Each mount gets one reply, never another activation notification.
    await checkTraffic(student, events, `${name}: join`, 2, 0, true);

    events.length = 0;
    await student.reload();
    await student.locator('#code').fill(code);
    await student.getByRole('button', { name: 'Join Session' }).click();
    await student.getByRole('button', { name: 'Check Answers' }).waitFor();
    await checkTraffic(student, events, `${name}: reload`, 2, 0, true);

    events.length = 0;
    await teacher.getByText(`${name} ·`, { exact: true }).hover();
    await teacher.getByTitle('Pause activity').click();
    await student.getByText(pausedText, { exact: true }).waitFor();
    assert.equal(await student.getByRole('button', { name: 'Check Answers' }).count(), 0);
    await checkTraffic(student, events, `${name}: pause`, 0, 1, false);

    events.length = 0;
    await student.reload();
    await student.locator('#code').fill(code);
    await student.getByRole('button', { name: 'Join Session' }).click();
    await student.getByText(pausedText, { exact: true }).waitFor();
    assert.equal(await student.getByRole('button', { name: 'Check Answers' }).count(), 0);
    await checkTraffic(student, events, `${name}: paused reload`, 2, 0, false);

    events.length = 0;
    await teacher.getByText(`${name} ·`, { exact: true }).hover();
    await teacher.getByTitle('Start activity').click();
    await student.getByRole('button', { name: 'Check Answers' }).waitFor();
    await student.getByText(pausedText, { exact: true }).waitFor({ state: 'hidden' });
    await checkTraffic(student, events, `${name}: resume`, 1, 1, true);
    await studentContext.close();
    await teacherContext.close();
  }
  assert.deepEqual(violations, [], 'state replies do not trigger fresh requests');
  step('PASS: both activity types join/reload without a feedback loop; host pause/resume updates state and actions');
} catch (error) {
  step(`FAIL: ${error.stack || error}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await stack?.stop();
  write();
}
