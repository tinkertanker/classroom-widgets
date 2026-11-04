// Real student UI and real server. Fault only packet delivery, not acceptance.
// Failure modes: unrelated-card success erases drafts; concurrent cards consume
// one reply; missing/late/duplicate/out-of-order replies; repeat submit; rejection;
// disconnect/offline buffering; abandoned attempts overwrite a newer draft.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { io } from 'socket.io-client';
import { createStepLog, prepareEvidence, startStack } from './harness.mjs';

const evidence = prepareEvidence('submission-recovery', ['submission-recovery.txt']);
const { step, write } = createStepLog(join(evidence, 'submission-recovery.txt'));
// Tailwind resolves its config/content from cwd. This check renders the student
// (not the teacher); keep its real styles when invoked from the repository root.
process.chdir(fileURLToPath(new URL('../../student', import.meta.url)));
let stack, browser, teacher, code;
const waitUntil = async (predicate, label) => {
  for (let i = 0; i < 150; i++) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail(`Timed out: ${label}`);
};
try {
  stack = await startStack();
  teacher = io(stack.serverUrl, { transports: ['websocket'] });
  await waitUntil(() => teacher.connected, 'teacher connect');
  const created = await teacher.timeout(5000).emitWithAck('session:create', {});
  assert.ok(created.success); code = created.code;
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
  for (const kind of (process.env.SUBMISSION_KIND ? [process.env.SUBMISSION_KIND] : ['questions', 'linkShare'])) {
    const ids = [`${kind}-a`, `${kind}-b`];
    for (const widgetId of ids) {
      assert.ok((await teacher.timeout(5000).emitWithAck('session:createRoom', { sessionCode: code, roomType: kind, widgetId })).success);
      teacher.emit('session:updateWidgetState', { sessionCode: code, roomType: kind, widgetId, isActive: true });
    }
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2, recordVideo: { dir: join(evidence, 'video') } });
    await context.addInitScript(() => {
      addEventListener('DOMContentLoaded', () => {
        const cursor = document.createElement('div');
        cursor.style.cssText = 'position:fixed;width:14px;height:14px;border:2px solid white;border-radius:50%;background:#334155;pointer-events:none;z-index:2147483647';
        document.body.append(cursor);
        addEventListener('pointermove', e => { cursor.style.left = `${e.clientX}px`; cursor.style.top = `${e.clientY}px`; });
      });
    });
    const student = await context.newPage();
    let transport, upstream, held = [], hold = false, sends = 0, joins = 0;
    const requests = new Map();
    const parse = message => String(message).match(/^42(\d*)(\[.*\])$/s);
    // Rejoin can complete over HTTP polling before WebSocket upgrades again.
    student.on('response', async response => {
      if (!response.url().includes('/socket.io/') || response.request().method() !== 'GET') return;
      for (const packet of (await response.text().catch(() => '')).split('\x1e')) {
        const match = parse(packet);
        if (match) {
          const [event, data] = JSON.parse(match[2]);
          if (event === 'session:joined' && data.success) joins++;
        }
      }
    });
    await student.routeWebSocket('**/socket.io/**', route => {
      transport = route; upstream = route.connectToServer();
      route.onMessage(message => {
        const match = parse(message);
        if (match) {
          const [event, data] = JSON.parse(match[2]);
          if (event === `session:${kind}:submit`) { sends++; requests.set(match[1], data.widgetId); }
        }
        upstream.send(message);
      });
      upstream.onMessage(message => {
        const ack = String(message).match(/^43(\d+)(\[.*\])$/s);
        const match = parse(message);
        const event = match && JSON.parse(match[2])[0];
        if (event === 'session:joined' && JSON.parse(match[2])[1].success) joins++;
        if (hold && ((ack && requests.has(ack[1])) || event === `session:${kind}:submitted`)) held.push(message);
        else route.send(message);
      });
    });
    await student.goto(stack.studentUrl);
    await student.locator('#name').fill(`Submission check ${kind}`);
    await student.locator('#code').fill(code);
    await student.getByRole('button', { name: 'Join Session' }).click();
    const cards = student.locator(`[data-room-type="${kind}"]`);
    const a = cards.nth(0), b = cards.nth(1);
    await b.locator('textarea').waitFor();
    await waitUntil(() => transport, 'WebSocket upgrade');
    // Fill the real class list: short examples cannot expose clipped recovery.
    const limit = kind === 'questions' ? 480 : 260;
    const firstDraft = ('A deliberately submitted. ' + 'A longer classroom question. '.repeat(14)).slice(0, limit);
    const nextDraft = ('A next attempt. ' + 'Another longer classroom question. '.repeat(13)).slice(0, limit);
    const unsentDraft = ('B unsent draft must remain. ' + 'A third longer classroom question. '.repeat(13)).slice(0, limit);
    await a.locator('textarea').fill(firstDraft);
    await b.locator('textarea').fill(unsentDraft);
    await student.screenshot({ path: join(evidence, `${kind}-ready.png`) });
    for (const target of [b.locator('textarea'), b.getByRole('button', { name: 'Submit', exact: true }), a.locator('textarea')]) {
      const box = await target.boundingBox();
      await student.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
    }
    await a.getByRole('button', { name: 'Submit', exact: true }).click();
    await waitUntil(async () => (await a.locator('textarea').inputValue()) === '', 'accepted card clears its own draft');
    assert.equal(await a.locator('textarea').inputValue(), '', 'accepted card clears its own draft');
    assert.equal(await b.locator('textarea').inputValue(), unsentDraft, 'another card must retain its unsent draft');
    assert.equal(await b.getByText('✓ Submitted successfully!', { exact: true }).count(), 0, 'unsent card must not claim success');
    const aWidgetId = requests.values().next().value;
    assert.ok(ids.includes(aWidgetId));
    step(`PASS ${kind}: one card's acceptance preserves another card's draft`);

    await student.waitForTimeout(3100); // Questions permits two submissions per three seconds.
    hold = true;
    await a.locator('textarea').fill(nextDraft);
    await a.getByRole('button', { name: 'Submit', exact: true }).click();
    await a.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await b.getByRole('button', { name: 'Submit', exact: true }).click();
    await waitUntil(() => held.length === 2, 'two independent replies');
    await student.screenshot({ path: join(evidence, `${kind}-sending.png`) });
    const [replyA, replyB] = held;
    held = [];
    transport.send(replyB);
    await waitUntil(async () => (await b.locator('textarea').inputValue()) === '', 'B accepted independently');
    assert.equal(await b.locator('textarea').inputValue(), '');
    assert.equal(await a.locator('textarea').inputValue(), nextDraft);
    await a.getByRole('status').filter({ hasText: /couldn’t confirm/ }).waitFor({ timeout: 15000 });
    const before = sends;
    await a.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    assert.equal(sends, before, 'uncertainty never resubmits');
    await student.screenshot({ path: join(evidence, `${kind}-uncertain.png`) });
    await student.setViewportSize({ width: 390, height: 844 });
    assert.equal(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'narrow feedback must not overflow');
    await a.screenshot({ path: join(evidence, `${kind}-uncertain-narrow.png`) });
    const recoveryClipped = await a.getByRole('button', { name: 'Teacher checked — write another' }).evaluate(button => {
      const bounds = button.getBoundingClientRect();
      for (let parent = button.parentElement; parent; parent = parent.parentElement) {
        if (!['hidden', 'clip'].includes(getComputedStyle(parent).overflowY)) continue;
        const clip = parent.getBoundingClientRect();
        if (bounds.top < clip.top || bounds.bottom > clip.bottom) return true;
      }
      return false;
    });
    assert.equal(recoveryClipped, false, 'recovery must be fully discoverable with a crowded class list, without scrolling a hidden ancestor');
    await student.setViewportSize({ width: 1100, height: 900 });
    transport.send(replyA);
    await a.getByRole('status').filter({ hasText: 'Submitted successfully' }).waitFor();
    await a.locator('textarea').fill('New draft after acknowledgment');
    transport.send(replyA);
    transport.send(`42${JSON.stringify([`session:${kind}:submitted`, { success: true }])}`);
    await student.waitForTimeout(150);
    assert.equal(await a.locator('textarea').inputValue(), 'New draft after acknowledgment');
    step(`PASS ${kind}: concurrent/out-of-order replies, timeout, delayed recovery, duplicate and legacy events, repeated actions`);

    // Exercise the real Socket.IO retention deadline, not a shortened test timer.
    await a.locator('textarea').fill('Keep this draft after callback expiry');
    await a.getByRole('button', { name: 'Submit', exact: true }).click();
    await waitUntil(() => held.length === 1, 'accepted reply held past callback expiry');
    const expiredReply = held.shift();
    await student.waitForTimeout(61000);
    transport.send(expiredReply);
    await student.waitForTimeout(150);
    assert.equal(await a.locator('textarea').inputValue(), 'Keep this draft after callback expiry');
    assert.equal(await a.locator('textarea').isDisabled(), true);
    assert.equal(await a.getByText('✓ Submitted successfully!', { exact: true }).count(), 0);
    await a.getByRole('status').filter({ hasText: /couldn’t confirm/ }).waitFor();
    await student.screenshot({ path: join(evidence, `${kind}-expired.png`) });
    await a.getByRole('button', { name: 'Teacher checked — write another' }).click();
    await a.locator('textarea').fill('New draft after acknowledgment');
    transport.send(expiredReply);
    await student.waitForTimeout(150);
    assert.equal(await a.locator('textarea').inputValue(), 'New draft after acknowledgment');
    step(`PASS ${kind}: real 60-second callback expiry retains uncertainty; expired success cannot clear this or a newer draft`);

    // Hold an actual success, lose the connection, then explicitly abandon it.
    await student.waitForTimeout(5100); // Separate rounds from real per-event budgets.
    await a.getByRole('button', { name: 'Submit', exact: true }).click();
    await waitUntil(() => held.length === 1, 'accepted reply before disconnect');
    const oldReply = held.shift();
    await context.setOffline(true);
    await transport.close({ code: 1001, reason: 'E2E connection loss' });
    await a.getByRole('status').filter({ hasText: /couldn’t confirm/ }).waitFor();
    await student.screenshot({ path: join(evidence, `${kind}-disconnected.png`) });
    const sentBefore = sends, joinsBefore = joins;
    await b.locator('textarea').fill('Keep this offline draft');
    assert.equal(await b.getByRole('button', { name: 'Submit', exact: true }).isDisabled(), true);
    await b.locator('form').evaluate(form => form.requestSubmit());
    await context.setOffline(false);
    await waitUntil(() => joins > joinsBefore, 'real session rejoin');
    await a.getByRole('status').filter({ hasText: 'Connection lost.' }).waitFor({ state: 'hidden' });
    await student.waitForTimeout(200);
    assert.equal(sends, sentBefore, 'no replay after reconnect');
    assert.equal(await b.locator('textarea').inputValue(), 'Keep this offline draft');
    await a.getByRole('button', { name: 'Teacher checked — write another' }).click();
    await a.locator('textarea').fill('Do not erase this newer draft');
    transport.send(oldReply);
    await student.waitForTimeout(150);
    assert.equal(await a.locator('textarea').inputValue(), 'Do not erase this newer draft');
    step(`PASS ${kind}: disconnect remains uncertain; explicit new attempt ignores abandoned reply`);

    // Pause on the server but withhold the state notification: a true rejection.
    const setActive = active => teacher.emit('session:updateWidgetState', { sessionCode: code, roomType: kind, widgetId: aWidgetId, isActive: active });
    let hideStateChanges = true;
    const normalSend = message => {
      const match = parse(message);
      if (hideStateChanges && match && JSON.parse(match[2])[0] === 'session:widgetStateChanged') return;
      const ack = String(message).match(/^43(\d+)(\[.*\])$/s);
      if (ack && requests.has(ack[1])) held.push(message); else transport.send(message);
    };
    upstream.onMessage(normalSend);
    setActive(false);
    await student.waitForTimeout(150);
    await a.getByRole('button', { name: 'Submit', exact: true }).click();
    await waitUntil(() => held.length === 1, 'rejected reply');
    transport.send(held.shift());
    await a.getByRole('alert').filter({ hasText: /paused/ }).waitFor();
    assert.equal(await a.locator('textarea').inputValue(), 'Do not erase this newer draft');
    await student.screenshot({ path: join(evidence, `${kind}-rejected.png`) });
    setActive(true);
    await student.waitForTimeout(150);
    await a.getByRole('button', { name: 'Submit', exact: true }).click();
    await waitUntil(() => held.length === 1, 'retry accepted');
    transport.send(held.shift());
    await a.getByRole('status').filter({ hasText: 'Submitted successfully' }).waitFor();
    await student.waitForTimeout(500);
    await student.screenshot({ path: join(evidence, `${kind}-acknowledged.png`) });
    step(`PASS ${kind}: definitive rejection retains text and permits deliberate retry`);
    hideStateChanges = false;

    await student.waitForTimeout(5100);
    await a.locator('textarea').fill('Accepted just before card removal');
    await a.getByRole('button', { name: 'Submit', exact: true }).click();
    await waitUntil(() => held.length === 1, 'reply before unmount');
    const removedReply = held.shift();
    teacher.emit('session:closeRoom', { sessionCode: code, roomType: kind, widgetId: aWidgetId });
    await waitUntil(async () => (await cards.count()) === 1, 'card unmounted');
    assert.ok((await teacher.timeout(5000).emitWithAck('session:createRoom', { sessionCode: code, roomType: kind, widgetId: aWidgetId })).success);
    setActive(true);
    await waitUntil(async () => (await cards.count()) === 2, 'replacement card mounted');
    await a.locator('textarea').waitFor();
    await a.locator('textarea').fill('Fresh card must keep this draft');
    transport.send(removedReply);
    await student.waitForTimeout(150);
    assert.equal(await a.locator('textarea').inputValue(), 'Fresh card must keep this draft');
    assert.equal(await a.getByText('✓ Submitted successfully!', { exact: true }).count(), 0);
    step(`PASS ${kind}: removed card's late acceptance cannot affect a new lifecycle`);

    // A sleeping tab can still report connected=true after its heartbeat expired.
    // Access the real socket through React only to inject that transport fault;
    // observe the public result: rejoin must not replay the attempted submission.
    const beforeExpiredHeartbeat = sends, joinsBeforeHeartbeat = joins;
    let heartbeatSubmissions = 0, preservedPackets = 0;
    // Outgoing observation also covers replay over HTTP polling, before upgrade.
    await student.exposeBinding('recordHeartbeatOutgoing', (_, event) => {
      if (event === `session:${kind}:submit`) heartbeatSubmissions++;
      if (event === 'e2e:unrelated-buffered-packet') preservedPackets++;
    });
    await a.locator('form').evaluate(form => {
      let fiber = form[Object.keys(form).find(key => key.startsWith('__reactFiber$'))];
      while (fiber && !fiber.memoizedProps?.socket) fiber = fiber.return;
      const socket = fiber?.memoizedProps.socket;
      if (!socket?.connected || !socket.io.engine?._pingTimeoutTime) throw new Error('Expected a live socket heartbeat');
      socket.onAnyOutgoing(event => window.recordHeartbeatOutgoing(event));
      // Cancellation must not clear packets owned by another socket consumer.
      socket.sendBuffer.push({ type: 2, data: ['e2e:unrelated-buffered-packet'] });
      socket.io.engine._pingTimeoutTime = Date.now() - 1;
      form.requestSubmit();
    });
    await waitUntil(() => joins > joinsBeforeHeartbeat, 'rejoin after expired heartbeat');
    await student.waitForTimeout(200);
    assert.equal(heartbeatSubmissions, 0, 'expired heartbeat must not replay a submission over either transport');
    assert.equal(preservedPackets, 1, 'cancel only the owned submission, not another consumer’s queued packet');
    assert.equal(sends, beforeExpiredHeartbeat, 'expired heartbeat must not buffer a submission for reconnect');
    assert.equal(await a.locator('textarea').inputValue(), 'Fresh card must keep this draft');
    assert.equal(await a.getByText('✓ Submitted successfully!', { exact: true }).count(), 0);
    step(`PASS ${kind}: expired heartbeat while connected does not queue or replay a submission`);

    if (kind === 'linkShare') {
      teacher.emit('session:linkShare:setAcceptMode', { sessionCode: code, widgetId: aWidgetId, acceptMode: 'links' });
      const input = a.getByRole('textbox', { name: 'Share a Link', exact: true });
      await input.waitFor();
      await input.fill('not a valid link');
      await a.getByRole('button', { name: 'Submit', exact: true }).click();
      await waitUntil(() => held.length === 1, 'link validation rejection');
      transport.send(held.shift());
      await a.getByRole('alert').waitFor();
      assert.equal(await input.inputValue(), 'not a valid link');
      await student.screenshot({ path: join(evidence, 'linkShare-links-rejected.png') });
      await input.fill('');
      await input.pressSequentially('example.com/recovery', { delay: 40 });
      await a.getByRole('button', { name: 'Submit', exact: true }).click();
      await waitUntil(() => held.length === 1, 'valid link acceptance');
      transport.send(held.shift());
      await a.getByRole('status').filter({ hasText: 'Submitted successfully' }).waitFor();
      assert.equal(await input.inputValue(), '');
      await student.screenshot({ path: join(evidence, 'linkShare-links-acknowledged.png') });
      step('PASS linkShare: links-only validation retains draft; corrected URL is acknowledged');
    }
    await student.waitForTimeout(1500); // Record the final settled state, not just its DOM assertion.
    assert.equal(sends, kind === 'linkShare' ? 10 : 8, 'only deliberate online submissions reach the server');
    step(`PASS ${kind}: ${sends} deliberate submissions; no repeated/offline/automatic resend`);
    await context.close();
    await student.video().saveAs(join(evidence, `${kind}.webm`));
    for (const widgetId of ids) teacher.emit('session:closeRoom', { sessionCode: code, roomType: kind, widgetId });
  }
} catch (error) {
  step(`FAIL ${error.stack || error}`); process.exitCode = 1;
} finally {
  if (code && teacher?.connected) teacher.emit('session:close', { sessionCode: code });
  teacher?.close(); await browser?.close(); await stack?.stop(); write();
}
