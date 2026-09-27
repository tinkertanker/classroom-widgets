// End-to-end check that a live widget room belongs to the widget on the board,
// not to the React component that happens to be mounted (issue #78).
//
// Starts the real server, teacher app and student app, starts a Poll, and has
// a student vote. Then the teacher switches to column layout and back, shrinks
// the window past the narrow breakpoint and back, and reloads the page. After
// each (and after a layout switch that follows the reload), the first student
// must still see the same poll and a newly joined
// student must be able to vote in it, and a paused poll must stay paused
// across a layout switch and a reload.
// Finally the teacher deletes the Poll and
// the student's poll card must disappear. From the repository root:
//
//   pnpm --filter @classroom-widgets/teacher e2e:rooms
//
// Evidence goes to $CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR (default: the system
// temp directory's classroom-widgets-test-evidence/room-lifecycle):
// room-lifecycle.txt (every step and what it observed) and screenshots
// 1-live.png, 2-column.png, 2b-canvas.png, 3-narrow.png, 4-reloaded.png,
// 4b-column-after-reload.png, 5-deleted.png
// (failure.png if a step fails).
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createStepLog, joinAsStudent, newTeacherContext, prepareEvidence, startStack } from './harness.mjs';

const evidence = prepareEvidence('room-lifecycle', ['room-lifecycle.txt', '1-live.png', '2-column.png',
  '2b-canvas.png', '3-narrow.png', '4-reloaded.png', '4b-column-after-reload.png', '5-deleted.png', 'failure.png']);
const { step, write: writeLog } = createStepLog(join(evidence, 'room-lifecycle.txt'));

const QUESTION = 'How is the lesson for you right now?';
const OPTIONS = ['Way too fast', 'Too fast', 'Just right', 'Too slow', 'Way too slow'];
// The old unmount cleanup closed rooms 100ms after a layout switch. Waiting
// well past that makes sure a surviving room is not just a slow close.
const SETTLE_MS = 1500;
const settle = () => new Promise((done) => setTimeout(done, SETTLE_MS));

let stack;
let browser;
let teacherPage;
let failed = false;

try {
  step(`# Room lifecycle E2E, ${new Date().toISOString()}`);
  stack = await startStack();
  const { teacherUrl, serverUrl, studentUrl } = stack;
  step(`teacher ${teacherUrl}, server ${serverUrl}, student ${studentUrl}`);
  step('PASS server, teacher app and student app started');

  browser = await chromium.launch();
  const teacherContext = await newTeacherContext(browser);
  teacherPage = await teacherContext.newPage();
  teacherPage.on('pageerror', (error) => step(`teacher page error: ${error.message}`));
  // Every close request the teacher app sends: session:closeRoom, and
  // session:cleanupRooms (closes each room whose widget is not listed).
  const closeRequests = [];
  teacherPage.on('websocket', (ws) => ws.on('framesent', ({ payload }) => {
    const match = typeof payload === 'string' && payload.match(/^42(\[.*\])$/s);
    if (!match) return;
    const [event, data] = JSON.parse(match[1]);
    if (event === 'session:closeRoom' || event === 'session:cleanupRooms') closeRequests.push({ event, data });
  }));

  await teacherPage.goto(teacherUrl);
  await teacherPage.getByTitle('More widgets (⌘K)').click();
  await teacherPage.getByText('Poll', { exact: true }).first().click();
  await teacherPage.getByRole('button', { name: /Start Poll/ }).click();
  const teacherQuestion = teacherPage.getByRole('heading', { name: QUESTION });
  await teacherQuestion.waitFor();
  const code = (await teacherPage.locator('code').filter({ hasText: /^[A-Z0-9]{6}$/ }).first().textContent()).trim();
  step(`PASS teacher started a Poll in session ${code}`);

  // The Poll's stats header reads "Poll · 1 vote".
  const teacherVotes = (count) => teacherPage.getByText(new RegExp(`^Poll\\s*·\\s*${count} votes?$`));
  const studentPoll = (page) => page.getByText(QUESTION, { exact: true });
  const vote = async (page, option) => {
    await page.getByText(option, { exact: true }).click();
  };

  const ada = await joinAsStudent(browser, studentUrl, code, 'Ada');
  await studentPoll(ada).waitFor();
  await vote(ada, OPTIONS[2]);
  await teacherVotes(1).waitFor();
  await teacherPage.screenshot({ path: join(evidence, '1-live.png') });
  step('PASS student Ada joined, sees the poll and voted; teacher shows 1 vote (1-live.png)');

  // Each disruption must leave: the teacher's poll live with its votes, Ada
  // still holding the poll card, and the same room open to a new student.
  let voters = 1;
  const assertSameRoomSurvived = async (label, screenshot) => {
    await settle();
    await teacherQuestion.waitFor();
    assert.equal(await teacherPage.getByRole('button', { name: /Start Poll/ }).count(), 0,
      `${label}: teacher widget went back to its start state`);
    await teacherVotes(voters).waitFor();
    assert.equal(await studentPoll(ada).isVisible(), true, `${label}: Ada lost the poll card`);
    const newcomer = await joinAsStudent(browser, studentUrl, code, `Student after ${label}`);
    await studentPoll(newcomer).waitFor();
    await vote(newcomer, OPTIONS[voters % OPTIONS.length]);
    voters += 1;
    await teacherVotes(voters).waitFor();
    await newcomer.close();
    await teacherPage.mouse.move(700, 450);
    await teacherPage.screenshot({ path: join(evidence, screenshot) });
    step(`PASS after ${label} (waited ${SETTLE_MS}ms): teacher poll still live, Ada still sees it, a new student voted in the same room; teacher shows ${voters} votes (${screenshot})`);
  };

  const toggleColumnLayout = async () => {
    await teacherPage.getByTitle('Menu').click();
    await teacherPage.getByText('Column Layout', { exact: true }).click();
    await teacherPage.keyboard.press('Escape');
  };
  await toggleColumnLayout();
  await assertSameRoomSurvived('switching to column layout', '2-column.png');
  await toggleColumnLayout();
  await assertSameRoomSurvived('switching back to canvas layout', '2b-canvas.png');

  await teacherPage.setViewportSize({ width: 500, height: 900 });
  await settle();
  await teacherPage.setViewportSize({ width: 1400, height: 900 });
  await assertSameRoomSurvived('shrinking the window below the narrow breakpoint and back', '3-narrow.png');

  // A paused poll must stay paused across a remount or a reload, not
  // auto-start again.
  const assertStillPaused = async (label) => {
    await teacherPage.getByText('Poll is paused', { exact: true }).waitFor();
    const paused = await joinAsStudent(browser, studentUrl, code, `Student while paused after ${label}`);
    await paused.getByText('Waiting for teacher to start the poll...').waitFor();
    await paused.close();
    step(`PASS a paused poll stayed paused after ${label} (teacher shows "Poll is paused", a new student saw "Waiting for teacher to start the poll...")`);
  };
  await teacherPage.getByTitle('Pause poll').click();
  await teacherPage.getByText('Poll is paused', { exact: true }).waitFor();
  await toggleColumnLayout();
  await settle();
  await toggleColumnLayout();
  await settle();
  await assertStillPaused('a layout round trip');

  await teacherPage.reload();
  await settle();
  await assertStillPaused('reloading the teacher page');
  // The control bar only shows while the pointer is over the widget.
  await teacherPage.getByText('Poll is paused', { exact: true }).hover();
  await teacherPage.getByTitle('Start poll').click();
  await teacherPage.getByText('Poll is paused', { exact: true }).waitFor({ state: 'detached' });
  step('PASS teacher resumed the poll');
  await assertSameRoomSurvived('reloading the teacher page', '4-reloaded.png');
  // After a reload the widget was restored from the server's snapshot. A later
  // remount must show the live counts, not that older snapshot.
  await toggleColumnLayout();
  await assertSameRoomSurvived('switching to column layout after the reload', '4b-column-after-reload.png');

  // The Poll is the only widget, so a request that spares it lists one widget.
  const closingRequests = closeRequests.filter(({ event, data }) =>
    event === 'session:closeRoom' || data.activeWidgetIds.length !== 1);
  assert.deepEqual(closingRequests, [], 'teacher asked to close the Poll\'s room before deleting it');
  step(`PASS teacher never asked to close the Poll's room while it was on the board (${closeRequests.length} orphan cleanups sent, each listing the Poll)`);

  const teacherCode = (await teacherPage.locator('code').filter({ hasText: /^[A-Z0-9]{6}$/ }).first().textContent()).trim();
  assert.equal(teacherCode, code, 'the session code never changed');
  step(`PASS the session code is still ${code}`);

  await teacherQuestion.hover();
  const requestsBeforeDelete = closeRequests.length;
  await teacherPage.getByRole('button', { name: 'Delete widget' }).click();
  await studentPoll(ada).waitFor({ state: 'detached', timeout: 5000 });
  const late = await joinAsStudent(browser, studentUrl, code, 'Late student');
  await settle();
  assert.equal(await studentPoll(late).count(), 0, 'a student joining after the delete gets no poll');
  await late.close();
  assert.deepEqual(closeRequests.slice(requestsBeforeDelete).map(({ event, data }) => [event, data.activeWidgetIds]),
    [['session:cleanupRooms', []]], 'deleting the Poll sent one cleanup listing no widgets');
  await ada.screenshot({ path: join(evidence, '5-deleted.png') });
  step('PASS teacher deleted the Poll: it sent one session:cleanupRooms listing no widgets, Ada\'s poll card disappeared and a student joining afterwards gets no poll (5-deleted.png, Ada\'s view)');
  step('RESULT: PASS');
} catch (error) {
  failed = true;
  step(`FAIL ${error.message}`);
  step('RESULT: FAIL');
  if (teacherPage) await teacherPage.screenshot({ path: join(evidence, 'failure.png') }).catch(() => {});
} finally {
  writeLog();
  console.log(`Evidence: ${evidence}`);
  await browser?.close().catch(() => {});
  await stack?.stop();
}

process.exit(failed ? 1 : 0);
