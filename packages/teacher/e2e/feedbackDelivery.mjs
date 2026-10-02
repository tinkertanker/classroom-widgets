// #227: only the teacher consumes aggregate feedback; students still need
// submission acknowledgments and genuine pause/resume notifications.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';
import { createStepLog, newTeacherContext, prepareEvidence, startStack } from './harness.mjs';

const evidence = prepareEvidence('feedback-delivery', ['feedback-delivery.txt']);
const { step, write } = createStepLog(join(evidence, 'feedback-delivery.txt'));
let stack;
let browser;

function observe(page) {
  const events = [];
  const record = payload => {
    for (const packet of String(payload).split('\x1e')) {
      const match = packet.match(/^42\d*(\[.*\])$/s);
      if (match) events.push(JSON.parse(match[1]));
    }
  };
  // Keep one log for the entire page lifetime, including teacher reconnection.
  page.on('websocket', ws => ws.on('framereceived', ({ payload }) => record(payload)));
  page.on('response', async response => {
    if (response.url().includes('/socket.io/') && response.url().includes('transport=polling')
      && response.request().method() === 'GET') {
      record(await response.text().catch(() => ''));
    }
  });
  return events;
}

async function waitUntil(predicate, label) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await delay(50);
  }
  assert.fail(`Timed out: ${label}`);
}

try {
  stack = await startStack();
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
  const teacherContext = await newTeacherContext(browser);
  const teacher = await teacherContext.newPage();
  const teacherEvents = observe(teacher);
  await teacher.goto(stack.teacherUrl);
  await teacher.getByTitle('More widgets (⌘K)').click();
  await teacher.getByPlaceholder('Search widgets...').fill('RT Feedback');
  await teacher.getByRole('dialog').getByText('RT Feedback', { exact: true }).click();
  await teacher.getByRole('button', { name: 'Start RT Feedback' }).click();
  await teacher.getByTitle('Pause feedback').waitFor();
  const code = (await teacher.locator('code').filter({ hasText: /^[A-Z0-9]{6}$/ }).first().textContent()).trim();
  const students = [];
  for (const name of ['Ada', 'Ben', 'Cy']) {
    const page = await browser.newPage();
    const events = observe(page);
    await page.goto(stack.studentUrl);
    await page.locator('#name').fill(name);
    await page.locator('#code').fill(code);
    await page.getByRole('button', { name: 'Join Session' }).click();
    await page.getByRole('slider').waitFor();
    students.push({ page, events });
  }
  const aggregates = () => teacherEvents.filter(([event]) => event === 'rtfeedback:dataUpdate');
  const acknowledgments = student => student.events.filter(([event]) => event === 'session:rtfeedback:submitted');
  const studentDeliveries = () => students.reduce((count, student) =>
    count + student.events.filter(([event]) => event === 'rtfeedback:dataUpdate').length, 0);
  const expectAggregate = async (index, histogram, count) => {
    await waitUntil(() => aggregates().length >= index, `teacher aggregate ${index}`);
    const data = aggregates()[index - 1][1];
    assert.equal(data.totalResponses, count);
    assert.deepEqual(data.understanding, histogram);
    await teacher.getByText(new RegExp(`^RT Feedback\\s*·\\s*${count} responses?$`)).waitFor();
  };
  const submit = async (student, value) => {
    const before = acknowledgments(student).length;
    const slider = student.page.getByRole('slider');
    const box = await slider.boundingBox();
    // Click the track's endpoints, driving the real input/change/mouseup path.
    await student.page.mouse.click(box.x + (value === 1 ? 2 : box.width - 2), box.y + box.height / 2);
    assert.equal(await slider.inputValue(), String(value));
    await waitUntil(() => acknowledgments(student).length === before + 1, 'submission acknowledgment');
    assert.equal(acknowledgments(student).at(-1)[1].success, true);
  };

  await submit(students[0], 1);
  await expectAggregate(1, [1, 0, 0, 0, 0, 0, 0, 0, 0], 1);
  await submit(students[1], 5);
  await expectAggregate(2, [1, 0, 0, 0, 0, 0, 0, 0, 1], 2);
  await submit(students[2], 5);
  await expectAggregate(3, [1, 0, 0, 0, 0, 0, 0, 0, 2], 3);
  step(`Three submissions: teacher aggregates=${aggregates().length}, unused student aggregates=${studentDeliveries()}`);

  await teacher.reload();
  await teacher.getByText(/^RT Feedback\s*·\s*3 responses$/).waitFor();
  await submit(students[0], 5);
  await expectAggregate(4, [0, 0, 0, 0, 0, 0, 0, 0, 3], 3);
  step('PASS reconnected teacher receives replacement score without increasing participant count');

  await teacher.getByText('RT Feedback ·', { exact: true }).hover();
  await teacher.getByTitle('Clear all').click();
  await expectAggregate(5, [0, 0, 0, 0, 0, 0, 0, 0, 0], 0);
  await submit(students[1], 1);
  await expectAggregate(6, [1, 0, 0, 0, 0, 0, 0, 0, 0], 1);
  step('PASS clear and subsequent submission reach the teacher');

  await teacher.getByText('RT Feedback ·', { exact: true }).hover();
  await teacher.getByTitle('Pause feedback').click();
  for (const { page } of students) {
    await page.getByRole('heading', { name: 'Feedback Paused' }).waitFor();
    assert.equal(await page.getByRole('slider').count(), 0);
  }
  await teacher.getByText('RT Feedback ·', { exact: true }).hover();
  await teacher.getByTitle('Start feedback').click();
  for (const { page } of students) await page.getByRole('slider').waitFor();
  await submit(students[0], 1);
  await expectAggregate(7, [2, 0, 0, 0, 0, 0, 0, 0, 0], 2);
  await delay(1000);
  assert.equal(aggregates().length, 7);
  assert.deepEqual(students.map(student => acknowledgments(student).length), [3, 2, 1]);
  step(`Final deliveries: teacher=${aggregates().length}, student acknowledgments=6, unused student aggregates=${studentDeliveries()}`);
  assert.equal(studentDeliveries(), 0, 'students must not receive unused teacher aggregates');
  step('PASS host-only aggregates, student acknowledgments, replacement, reconnect, reset and pause/resume');
} catch (error) {
  step(`FAIL: ${error.stack || error}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await stack?.stop();
  write();
}
