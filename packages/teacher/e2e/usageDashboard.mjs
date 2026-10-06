// End-to-end check of the admin usage dashboard.
//
// Starts the real server (with usage logging on), teacher app and student
// app. Teacher device A opens the app, adds a Timer and starts a Poll; a
// student joins; A reloads (a second visit from the same device). Teacher
// device B opens the app and adds a Timer. Then an admin opens <server>/admin,
// is refused with a wrong token, signs in with ADMIN_TOKEN, and must see
// 2 devices, 3 visits, 1 session, 1 student join, Timer added twice on two
// devices and Poll once. The raw log must hold no student name. Google
// sign-in needs a real Google account, so it is covered by the server's
// route tests rather than here. From the repository root:
//
//   pnpm --filter @classroom-widgets/teacher e2e:usage
//
// Evidence goes to $CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR (default: the system
// temp directory's classroom-widgets-test-evidence/usage-dashboard):
// usage-dashboard.txt (every step and what it observed), usage-log.jsonl (the
// raw events the server wrote) and screenshots 1-sign-in.png,
// 2-wrong-token.png, 3-dashboard.png, 4-dashboard-dark.png, 5-dashboard-mobile.png
// (failure.png if a step fails).
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createStepLog, joinAsStudent, newTeacherContext, prepareEvidence, startStack } from './harness.mjs';

const evidence = prepareEvidence('usage-dashboard', ['usage-dashboard.txt', 'usage-log.jsonl', '1-sign-in.png',
  '2-wrong-token.png', '3-dashboard.png', '4-dashboard-dark.png', '5-dashboard-mobile.png', 'failure.png']);
const { step, write: writeLog } = createStepLog(join(evidence, 'usage-dashboard.txt'));

const ADMIN_TOKEN = 'e2e-admin-token';
const STUDENT_NAME = 'Ada Lovelace';
const usageDir = mkdtempSync(join(tmpdir(), 'usage-dashboard-e2e-'));

let stack;
let browser;
let activePage;
let failed = false;

async function addWidget(page, name) {
  await page.getByTitle('More widgets (⌘K)').click();
  // The picker is a full-screen overlay; the toolbar behind it repeats some names.
  await page.locator('div.fixed.inset-0').getByText(name, { exact: true }).first().click();
}

async function usage(serverUrl) {
  const response = await fetch(`${serverUrl}/admin/api/usage?days=7`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function waitForUsage(serverUrl, label, check) {
  let last;
  for (let i = 0; i < 60; i++) {
    last = await usage(serverUrl);
    if (check(last.totals)) return last;
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`Timed out waiting for ${label}; last totals ${JSON.stringify(last.totals)}`);
}

try {
  step(`# Usage dashboard E2E, ${new Date().toISOString()}`);
  stack = await startStack({
    serverEnv: { USAGE_LOG_DIR: usageDir, USAGE_TIMEZONE: 'Asia/Singapore', ADMIN_TOKEN }
  });
  const { teacherUrl, serverUrl, studentUrl } = stack;
  step(`teacher ${teacherUrl}, server ${serverUrl}, student ${studentUrl}`);

  const unauthenticated = await fetch(`${serverUrl}/admin/api/usage`);
  assert.equal(unauthenticated.status, 401);
  step('PASS usage data without sign-in is refused (401)');

  browser = await chromium.launch();

  // Device A: Timer, then a Poll with a student, then a reload.
  const deviceA = await newTeacherContext(browser);
  const teacherA = await deviceA.newPage();
  activePage = teacherA;
  await teacherA.goto(teacherUrl);
  await addWidget(teacherA, 'Timer');
  await addWidget(teacherA, 'Poll');
  await teacherA.getByRole('button', { name: /Start Poll/ }).click();
  const code = (await teacherA.locator('code').filter({ hasText: /^[A-Z0-9]{6}$/ }).first().textContent()).trim();
  step(`PASS device A added Timer and Poll and started session ${code}`);

  const student = await joinAsStudent(browser, studentUrl, code, STUDENT_NAME);
  await student.getByText('Way too fast', { exact: true }).waitFor();
  step(`PASS student "${STUDENT_NAME}" joined and sees the poll`);

  await waitForUsage(serverUrl, 'device A events', (t) => t.widgetAdds === 2 && t.studentJoins === 1);
  await teacherA.reload();
  await waitForUsage(serverUrl, 'device A reload', (t) => t.appOpens === 2);
  step('PASS device A reloaded (second visit)');

  // Device B: a separate browser profile adds a Timer.
  const deviceB = await newTeacherContext(browser);
  const teacherB = await deviceB.newPage();
  activePage = teacherB;
  await teacherB.goto(teacherUrl);
  await addWidget(teacherB, 'Timer');
  const totals = (await waitForUsage(serverUrl, 'device B events', (t) => t.appOpens === 3 && t.widgetAdds === 3)).totals;
  step(`PASS device B added a Timer; server totals ${JSON.stringify(totals)}`);

  // Admin dashboard.
  const adminContext = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
  const admin = await adminContext.newPage();
  activePage = admin;
  admin.on('pageerror', (error) => step(`admin page error: ${error.message}`));
  await admin.goto(`${serverUrl}/admin`);
  await admin.getByPlaceholder('ADMIN_TOKEN').waitFor();
  await admin.screenshot({ path: join(evidence, '1-sign-in.png') });
  step('PASS dashboard shows the sign-in form');

  await admin.getByPlaceholder('ADMIN_TOKEN').fill('wrong-token');
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await admin.getByText('That token is not valid.').waitFor();
  await admin.screenshot({ path: join(evidence, '2-wrong-token.png') });
  step('PASS a wrong token is refused');

  await admin.getByPlaceholder('ADMIN_TOKEN').fill(ADMIN_TOKEN);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await admin.getByRole('heading', { name: 'Classroom Widgets usage' }).waitFor();
  await admin.locator('#tiles .tile').first().waitFor();

  const tiles = Object.fromEntries(await admin.locator('#tiles .tile').evaluateAll((nodes) =>
    nodes.map((node) => [node.querySelector('.label').textContent, node.querySelector('.value').textContent])));
  step(`dashboard tiles ${JSON.stringify(tiles)}`);
  assert.deepEqual(tiles, {
    'Unique devices': '2',
    Visits: '3',
    'Classroom sessions': '1',
    'Student joins': '1',
    'Widgets added': '3'
  });

  const widgetRows = await admin.locator('#widgetTable tr').evaluateAll((rows) =>
    rows.map((row) => Array.from(row.querySelectorAll('td'), (td) => td.textContent).filter(Boolean)));
  step(`dashboard widget rows ${JSON.stringify(widgetRows)}`);
  assert.deepEqual(widgetRows, [['Timer', '2', '2'], ['Poll', '1', '1']]);
  assert.equal(await admin.locator('#chartSvg path.bar[d^="M"]').count(), 1);
  await admin.screenshot({ path: join(evidence, '3-dashboard.png'), fullPage: true });
  step('PASS dashboard shows 2 devices, 3 visits, 1 session, 1 join; Timer 2 on 2 devices, Poll 1');

  await admin.emulateMedia({ colorScheme: 'dark' });
  await admin.screenshot({ path: join(evidence, '4-dashboard-dark.png'), fullPage: true });
  await admin.emulateMedia({ colorScheme: 'light' });
  await admin.setViewportSize({ width: 390, height: 844 });
  await admin.screenshot({ path: join(evidence, '5-dashboard-mobile.png'), fullPage: true });
  const overflow = await admin.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `page scrolls sideways by ${overflow}px at phone width`);
  step('PASS dark-mode and phone-width screenshots taken; no sideways scroll at 390px');

  await admin.getByRole('button', { name: 'Sign out' }).click();
  await admin.getByPlaceholder('ADMIN_TOKEN').waitFor();
  step('PASS sign-out returns to the sign-in form');

  const files = readdirSync(usageDir);
  const raw = files.map((name) => readFileSync(join(usageDir, name), 'utf8')).join('');
  writeFileSync(join(evidence, 'usage-log.jsonl'), raw);
  assert.ok(!raw.includes('Ada'), 'student name found in usage log');
  assert.ok(!raw.includes(code), 'session code found in usage log');
  step(`PASS raw log (${files.join(', ')}, ${raw.trim().split('\n').length} events) holds no student name or session code`);
} catch (error) {
  failed = true;
  step(`FAIL ${error.stack || error.message}`);
  await activePage?.screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => {});
} finally {
  writeLog();
  await browser?.close().catch(() => {});
  await stack?.stop();
  rmSync(usageDir, { recursive: true, force: true });
  console.log(`Evidence: ${evidence}`);
  process.exit(failed ? 1 : 0);
}
