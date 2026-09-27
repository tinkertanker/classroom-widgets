// End-to-end check for the Drop Box "Copy all" and "Download CSV" buttons.
//
// Starts the real server, teacher app and student app on free ports, starts a
// Drop Box in the teacher app, joins it from four student pages that submit
// through the student UI, then copies and downloads the submissions and checks
// what the teacher gets. From the repository root:
//
//   pnpm --filter @classroom-widgets/teacher e2e:dropbox
//
// It needs a Chromium build that matches playwright-core. Install one with
// `pnpm --filter @classroom-widgets/teacher exec playwright-core install chromium`,
// or point PLAYWRIGHT_BROWSERS_PATH at an existing install.
//
// Evidence goes to $CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR (default: the system
// temp directory's classroom-widgets-test-evidence/dropbox-export):
// dropbox-export.txt (every step and what it observed), clipboard.txt,
// download.csv (the downloaded file, byte for byte), and screenshots
// 1-empty.png, 2-submissions.png and 3-copied.png (failure.png if a step fails).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const teacherDir = resolve(here, '..');
const studentDir = resolve(teacherDir, '../student');
const serverDir = resolve(teacherDir, '../server');
const evidence = resolve(process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR
  || join(tmpdir(), 'classroom-widgets-test-evidence', 'dropbox-export'));
mkdirSync(evidence, { recursive: true });

const STUDENTS = [
  { name: 'Ada Lim', content: 'example.com/ada-project', expected: 'https://example.com/ada-project', type: 'Link' },
  { name: 'Ben "BT" Tan', content: 'Our group, the Otters, picked option B', type: 'Text' },
  { name: '陈小明', content: 'Line one\nline two', type: 'Text' },
  { name: 'Dee', content: '=1+1', type: 'Text' },
];

const log = [];
const step = (message) => {
  log.push(message);
  console.log(message);
};
const writeLog = () => writeFileSync(join(evidence, 'dropbox-export.txt'), log.join('\n') + '\n');

function freePort() {
  return new Promise((done, fail) => {
    const probe = createNetServer();
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });
}

async function waitForHttp(url, what) {
  for (let i = 0; i < 120; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`${what} did not answer at ${url}`);
}

// Parses RFC 4180 CSV (quoted fields may hold commas, quotes and line breaks).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\r' && text[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
    else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const localDate = (date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()]
  .map((part, index) => (index ? String(part).padStart(2, '0') : String(part))).join('-');

const [teacherPort, serverPort, studentPort] = await Promise.all([freePort(), freePort(), freePort()]);
const teacherUrl = `http://localhost:${teacherPort}`;
const serverUrl = `http://localhost:${serverPort}`;
const studentUrl = `http://localhost:${studentPort}/student/`;

let server;
let teacherVite;
let studentVite;
let browser;
let teacherPage;
let failed = false;

try {
  step(`# Drop Box export E2E, ${new Date().toISOString()}`);
  step(`teacher ${teacherUrl}, server ${serverUrl}, student ${studentUrl}`);

  server = spawn(process.execPath, ['src/server.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(serverPort),
      NODE_ENV: 'development',
      CORS_ORIGINS: [teacherPort, studentPort].map((port) => `http://localhost:${port}`).join(','),
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  await waitForHttp(`${serverUrl}/health`, 'Server');

  // Vite reads VITE_* variables from the environment at startup.
  process.env.VITE_SERVER_URL = serverUrl;
  const { createServer: createVite } = await import('vite');
  teacherVite = await createVite({
    root: teacherDir,
    configFile: join(teacherDir, 'vite.config.js'),
    logLevel: 'warn',
    server: { port: teacherPort, strictPort: true, open: false },
  });
  await teacherVite.listen();
  studentVite = await createVite({
    root: studentDir,
    configFile: join(studentDir, 'vite.config.dev.ts'),
    // Closing a student page resets its proxied socket, which Vite logs as an error.
    logLevel: 'silent',
    server: {
      port: studentPort,
      strictPort: true,
      proxy: {
        '/api': { target: serverUrl, changeOrigin: true },
        '/socket.io': { target: serverUrl, ws: true, changeOrigin: true },
      },
    },
  });
  await studentVite.listen();
  step('PASS server, teacher app and student app started');

  browser = await chromium.launch();
  const teacherContext = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  await teacherContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: teacherUrl });
  teacherPage = await teacherContext.newPage();
  teacherPage.on('pageerror', (error) => step(`teacher page error: ${error.message}`));

  await teacherPage.goto(teacherUrl);
  await teacherPage.getByTitle('More widgets (⌘K)').click();
  await teacherPage.getByText('Drop Box', { exact: true }).first().click();
  await teacherPage.getByRole('button', { name: /Start Drop Box/ }).click();
  const copyButton = teacherPage.getByRole('button', { name: 'Copy all submissions' });
  const downloadButton = teacherPage.getByRole('button', { name: 'Download submissions as CSV' });
  await copyButton.waitFor();
  const code = (await teacherPage.locator('code').filter({ hasText: /^[A-Z0-9]{6}$/ }).first().textContent()).trim();
  step(`PASS teacher started a Drop Box in session ${code}`);

  assert.equal(await copyButton.isDisabled(), true, 'Copy all is disabled with no submissions');
  assert.equal(await downloadButton.isDisabled(), true, 'Download CSV is disabled with no submissions');
  await teacherPage.screenshot({ path: join(evidence, '1-empty.png') });
  step('PASS Copy all and Download CSV are disabled with no submissions (1-empty.png)');

  for (const student of STUDENTS) {
    const studentPage = await browser.newPage({ viewport: { width: 900, height: 800 } });
    await studentPage.goto(studentUrl);
    await studentPage.locator('#name').fill(student.name);
    await studentPage.locator('#code').fill(code);
    await studentPage.getByRole('button', { name: 'Join Session' }).click();
    await studentPage.locator('#shareContent').fill(student.content);
    await studentPage.getByRole('button', { name: 'Submit' }).click();
    await studentPage.getByText('Submitted successfully!').waitFor();
    await studentPage.close();
    step(`PASS student ${JSON.stringify(student.name)} submitted ${JSON.stringify(student.content)} from the student app`);
  }

  await teacherPage.getByText(`${STUDENTS.length} submissions`).waitFor();
  assert.equal(await copyButton.isDisabled(), false, 'Copy all is enabled once submissions arrive');
  assert.equal(await downloadButton.isDisabled(), false, 'Download CSV is enabled once submissions arrive');
  await teacherPage.mouse.move(700, 450);
  await teacherPage.screenshot({ path: join(evidence, '2-submissions.png') });
  step(`PASS teacher sees ${STUDENTS.length} submissions and both buttons are enabled (2-submissions.png)`);

  await copyButton.click();
  await teacherPage.getByRole('status').filter({ hasText: 'Copied all submissions' }).waitFor({ state: 'attached' });
  const clipboard = await teacherPage.evaluate(() => navigator.clipboard.readText());
  writeFileSync(join(evidence, 'clipboard.txt'), clipboard);
  const expectedClipboard = STUDENTS
    .map((student) => `${student.name}: ${(student.expected ?? student.content).replace(/\n/g, ' ')}`)
    .join('\n');
  assert.equal(clipboard, expectedClipboard, 'clipboard holds one "Name: content" line per submission');
  assert.equal(await copyButton.getAttribute('aria-label'), 'Copy all submissions', 'the button label stays fixed');
  await teacherPage.screenshot({ path: join(evidence, '3-copied.png') });
  step('PASS Copy all put one line per submission on the clipboard and announced "Copied all submissions" (clipboard.txt, 3-copied.png)');

  const [download] = await Promise.all([teacherPage.waitForEvent('download'), downloadButton.click()]);
  const downloadPath = join(evidence, 'download.csv');
  await download.saveAs(downloadPath);
  assert.equal(download.suggestedFilename(), `drop-box-${localDate(new Date())}.csv`, 'filename carries today\'s local date');
  const bytes = readFileSync(downloadPath);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'file starts with a UTF-8 BOM');
  const rows = parseCsv(bytes.subarray(3).toString('utf8'));
  assert.deepEqual(rows[0], ['Name', 'Content', 'Type', 'Submitted at']);
  assert.equal(rows.length, STUDENTS.length + 1, 'one row per submission');
  STUDENTS.forEach((student, index) => {
    const [name, content, type, submittedAt] = rows[index + 1];
    const expectedContent = student.expected ?? student.content;
    assert.equal(name, student.name);
    assert.equal(content, expectedContent.startsWith('=') ? `'${expectedContent}` : expectedContent);
    assert.equal(type, student.type);
    assert.match(submittedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
  step(`PASS Download CSV saved ${download.suggestedFilename()} with a BOM, a header and ${STUDENTS.length} rows that parse back to the submitted values, "=1+1" exported as "'=1+1" (download.csv)`);
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
  await teacherVite?.close().catch(() => {});
  await studentVite?.close().catch(() => {});
  server?.kill();
}

process.exit(failed ? 1 : 0);
