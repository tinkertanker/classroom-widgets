// Drive the real poll UI/server, faulting only delivery of Socket.IO packets.
// Failure modes: lost/delayed confirmation, duplicate clicks/events, rejection,
// pause, disconnect, reset during flight, stale confirmation, widget isolation.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createStepLog, newTeacherContext, prepareEvidence, startStack } from './harness.mjs';

const evidence = prepareEvidence('poll-submission', ['poll-submission.txt']);
const { step, write } = createStepLog(join(evidence, 'poll-submission.txt'));
let stack;
let browser;
try {
  stack = await startStack();
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
  const teacher = await (await newTeacherContext(browser)).newPage();
  await teacher.goto(stack.teacherUrl);
  await teacher.getByTitle('More widgets (⌘K)').click();
  await teacher.getByRole('textbox', { name: 'Search widgets' }).fill('Poll');
  await teacher.getByRole('dialog').getByText('Poll', { exact: true }).click();
  await teacher.getByRole('button', { name: 'Start Poll' }).click();
  await teacher.getByTitle('Pause poll').waitFor();
  const code = (await teacher.locator('code').filter({ hasText: /^[A-Z0-9]{6}$/ }).first().textContent()).trim();
  const context = await browser.newContext({
    viewport: { width: 900, height: 800 }, deviceScaleFactor: 2,
    recordVideo: { dir: join(evidence, 'video'), size: { width: 900, height: 800 } }
  });
  // Show the real moving pointer in the repeatable evidence recording.
  await context.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const pointer = document.createElement('div');
      pointer.style.cssText = 'position:fixed;left:-30px;top:-30px;width:14px;height:14px;border:2px solid white;border-radius:50%;background:#334155;pointer-events:none;z-index:2147483647;box-shadow:0 0 2px black';
      document.body.append(pointer);
      addEventListener('pointermove', event => {
        pointer.style.left = `${event.clientX}px`;
        pointer.style.top = `${event.clientY}px`;
      });
    });
  });
  const student = await context.newPage();
  let transport;
  let upstream;
  let hold = true;
  let held = [];
  let sent = 0;
  let joins = 0;
  let widgetId;
  const parse = message => {
    const match = String(message).match(/^42(\[.*\])$/s);
    return match ? JSON.parse(match[1]) : [];
  };
  student.on('response', async response => {
    if (!response.url().includes('/socket.io/') || response.request().method() !== 'GET') return;
    for (const packet of (await response.text().catch(() => '')).split('\x1e')) {
      const [event, data] = parse(packet);
      if (event === 'session:joined' && data.success) joins++;
    }
  });
  await student.routeWebSocket('**/socket.io/**', route => {
    transport = route;
    const server = route.connectToServer();
    upstream = server;
    route.onMessage(message => {
      const [event, data] = parse(message);
      if (event === 'session:poll:vote') { sent++; widgetId = data.widgetId; }
      server.send(message);
    });
    server.onMessage(message => {
      const [event, data] = parse(message);
      if (event === 'session:joined' && data.success) joins++;
      if (parse(message)[0] === 'session:poll:voteConfirmed' && hold) held.push(message);
      else route.send(message);
    });
  });
  const inject = (event, data) => transport.send(`42${JSON.stringify([event, { widgetId, ...data }])}`);
  const capture = name => student.screenshot({ path: join(evidence, `${name}.png`) });
  const reset = async () => {
    await teacher.getByRole('heading', { level: 3 }).first().hover();
    await teacher.getByTitle('Reset votes').click();
    await student.getByRole('button', { name: options[0], exact: true }).waitFor();
    // The real server allows two poll submissions per second. Separate rounds
    // so a reset race does not accidentally test rate limiting instead.
    await student.waitForTimeout(1100);
  };
  await student.goto(stack.studentUrl);
  await student.locator('#name').fill('Ada');
  await student.locator('#code').fill(code);
  await student.getByRole('button', { name: 'Join Session' }).click();
  // The options are teacher-generated; read their labels, not their styles.
  await student.locator('[data-room-type="poll"] .border-2.cursor-pointer').first().waitFor();
  const options = await student.locator('[data-room-type="poll"] .border-2.cursor-pointer').allTextContents();
  for (let i = 0; i < 100 && !transport; i++) await student.waitForTimeout(50);
  assert.ok(transport, 'Socket.IO upgraded so faults cover the vote packets');
  await student.waitForTimeout(400); // Finish the existing card-entry fade before capture.
  await capture('ready');
  for (const option of options.slice(0, 3).reverse()) {
    const box = await student.getByText(option, { exact: true }).boundingBox();
    await student.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
  }
  await student.getByText(options[0], { exact: true }).click();
  await student.getByText('Sending your vote…', { exact: true }).waitFor();
  await capture('sending');
  await student.getByText(options[1], { exact: true }).click();
  await student.getByText(/We couldn’t confirm your vote/).waitFor({ timeout: 12000 });
  assert.equal(sent, 1, 'repeated action while sending never resubmits');
  assert.equal(held.length, 1);
  await capture('uncertain');
  inject('session:poll:voteConfirmed', { success: true, widgetId: 'another-widget' });
  await student.getByText(/We couldn’t confirm your vote/).waitFor();
  transport.send(held.shift());
  await student.getByText('Your choice', { exact: true }).waitFor();
  await capture('acknowledged');
  inject('session:poll:voteConfirmed', { success: false });
  await student.waitForTimeout(100); // Let an erroneous duplicate change render.
  assert.equal(await student.getByText('Your choice', { exact: true }).count(), 1);
  step('PASS timeout is uncertain, aggregate results are not acknowledgment, delayed success recovers, repeated actions/widget mismatch/duplicate rejection are ignored');

  // A genuinely rejected vote permits retry, unlike a missing confirmation.
  await reset();
  inject('session:poll:voteConfirmed', { success: true });
  await student.waitForTimeout(100);
  await student.getByRole('button', { name: options[0], exact: true }).waitFor();
  // Pause server-side but hold that notification so the student's click races it.
  const original = upstream;
  original.onMessage(message => {
    const [event] = parse(message);
    if (event !== 'session:widgetStateChanged' && event !== 'poll:stateUpdate') transport.send(message);
  });
  await teacher.getByRole('heading', { level: 3 }).first().hover();
  await teacher.getByTitle('Pause poll').click();
  await teacher.getByTitle('Start poll').waitFor();
  await student.getByRole('button', { name: options[1], exact: true }).click();
  await student.getByRole('alert').filter({ hasText: "Your vote didn't go through" }).waitFor();
  await capture('rejected');
  hold = false;
  original.onMessage(message => transport.send(message));
  await teacher.getByTitle('Start poll').click();
  await student.getByRole('button', { name: options[1], exact: true }).click();
  await student.getByText('Your choice', { exact: true }).waitFor();
  await teacher.getByRole('heading', { level: 3 }).first().hover();
  await teacher.getByTitle('Pause poll').click();
  await teacher.getByTitle('Start poll').waitFor();
  assert.equal(await student.getByText('Your choice', { exact: true }).count(), 1);
  await teacher.getByTitle('Start poll').click();
  step('PASS pause-race rejection is retryable; acknowledged choice survives pause/resume; stale success while idle is ignored');
  await teacher.reload();
  await teacher.getByTitle('Pause poll').waitFor();
  await teacher.getByText(/^Poll\s*·\s*1 vote$/).waitFor();
  await student.getByText('Your choice', { exact: true }).waitFor();
  step('PASS teacher reload recovers the authoritative vote count and preserves the student acknowledgment');

  await teacher.getByRole('heading', { level: 3 }).first().hover();
  await teacher.getByTitle('Settings', { exact: true }).click();
  await teacher.getByPlaceholder("What's your poll question?").fill('Same options, updated question');
  await teacher.getByRole('button', { name: 'Save Changes' }).click();
  await student.getByText('Same options, updated question', { exact: true }).waitFor();
  await student.getByText('Your choice', { exact: true }).waitFor();
  await teacher.getByRole('heading', { level: 3 }).first().hover();
  await teacher.getByTitle('Settings', { exact: true }).click();
  options[0] = 'New first choice';
  await teacher.getByPlaceholder('Option 1', { exact: true }).fill(options[0]);
  await teacher.getByRole('button', { name: 'Save Changes' }).click();
  await student.getByRole('button', { name: options[0], exact: true }).waitFor();
  assert.equal(await student.getByText('Your choice', { exact: true }).count(), 0);
  await student.waitForTimeout(1100);
  await student.getByRole('button', { name: options[0], exact: true }).press('Enter');
  await student.getByText('Your choice', { exact: true }).waitFor();
  step('PASS question-only edits preserve acknowledgment; changed options reset eligibility and keyboard voting confirms');

  await reset();
  hold = true;
  upstream.onMessage(message => {
    if (parse(message)[0] === 'session:poll:voteConfirmed' && hold) held.push(message);
    else transport.send(message);
  });
  await student.getByRole('button', { name: options[0], exact: true }).click();
  await student.getByText('Sending your vote…', { exact: true }).waitFor();
  await reset();
  await student.getByRole('button', { name: options[1], exact: true }).click();
  for (let i = 0; i < 100 && held.length < 2; i++) await student.waitForTimeout(50);
  assert.equal(held.length, 2);
  transport.send(held.shift());
  await student.getByText(/We couldn’t confirm your vote/).waitFor();
  transport.send(held.shift());
  await student.waitForTimeout(100);
  assert.equal(await student.getByText('Your choice', { exact: true }).count(), 0,
    'untagged old/new acknowledgments cannot establish current-generation success');
  step('PASS reset during flight allows a new choice but uncorrelated acknowledgments never claim success');
  await capture('reset-uncertain');

  // Disconnect must not silently queue another vote or turn uncertainty into success.
  await reset();
  await student.getByRole('button', { name: options[0], exact: true }).click();
  await student.getByText('Sending your vote…', { exact: true }).waitFor();
  for (let i = 0; i < 100 && held.length < 1; i++) await student.waitForTimeout(50);
  assert.equal(held.length, 1);
  assert.equal(parse(held[0])[1].success, true, 'server accepted the vote before connection loss');
  await teacher.getByText(/^Poll\s*·\s*1 vote$/).waitFor();
  const joinsBefore = joins;
  await context.setOffline(true);
  await transport.close({ code: 1001, reason: 'E2E connection loss' });
  await student.getByText('Connection lost. Waiting to reconnect…', { exact: true }).waitFor();
  await student.getByText(/We couldn’t confirm your vote/).waitFor();
  await capture('disconnected');
  const sentBefore = sent;
  await context.setOffline(false);
  for (let i = 0; i < 200 && joins === joinsBefore; i++) await student.waitForTimeout(50);
  assert.ok(joins > joinsBefore, 'actual successful session rejoin, not just toggled network');
  await student.getByText('Connection lost. Waiting to reconnect…', { exact: true }).waitFor({ state: 'hidden' });
  await student.getByText(/We couldn’t confirm your vote/).waitFor();
  assert.equal(await student.getByText('Your choice', { exact: true }).count(), 0);
  assert.equal(sent, sentBefore, 'reconnect never automatically resubmits');
  await student.getByRole('heading', { name: `Connected to session ${code}`, exact: true }).waitFor();
  await student.waitForTimeout(400); // Include the settled recovered surface in the video.
  step('PASS lost acknowledgment remains uncertain across disconnect/reconnect; no automatic retry');
  await context.close();
  await student.video().saveAs(join(evidence, 'poll-submission.webm'));
  step(`PASS poll submission pilot (${sent} deliberate submissions); screenshots in ${evidence}`);
} catch (error) {
  step(`FAIL: ${error.stack || error}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await stack?.stop();
  write();
}
