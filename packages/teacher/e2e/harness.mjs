// Shared set-up for the teacher-app E2E checks: starts the real server, the
// teacher app and the student app on free ports, and gives each check an
// evidence directory and a step log.
//
// Needs a Chromium build that matches playwright-core. Install one with
// `pnpm --filter @classroom-widgets/teacher exec playwright-core install chromium`,
// or point PLAYWRIGHT_BROWSERS_PATH at an existing install.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const teacherDir = resolve(here, '..');
const studentDir = resolve(teacherDir, '../student');
const serverDir = resolve(teacherDir, '../server');

// Evidence goes to $CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR, or to
// <tmp>/classroom-widgets-test-evidence/<defaultSubdir>. Only the listed files
// from earlier runs are removed: the directory may be shared with other suites,
// so it is never wiped.
export function prepareEvidence(defaultSubdir, files) {
  const evidence = resolve(process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR
    || join(tmpdir(), 'classroom-widgets-test-evidence', defaultSubdir));
  mkdirSync(evidence, { recursive: true });
  for (const name of files) rmSync(join(evidence, name), { force: true });
  return evidence;
}

export function createStepLog(file) {
  const lines = [];
  return {
    step(message) {
      lines.push(message);
      console.log(message);
    },
    write() {
      writeFileSync(file, lines.join('\n') + '\n');
    },
  };
}

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

// Starts server, teacher app and student app. `stop()` is safe to call after a
// partial start.
export async function startStack() {
  const [teacherPort, serverPort, studentPort] = await Promise.all([freePort(), freePort(), freePort()]);
  const stack = {
    teacherUrl: `http://localhost:${teacherPort}`,
    serverUrl: `http://localhost:${serverPort}`,
    studentUrl: `http://localhost:${studentPort}/student/`,
    server: null,
    teacherVite: null,
    studentVite: null,
    async stop() {
      await stack.teacherVite?.close().catch(() => {});
      await stack.studentVite?.close().catch(() => {});
      stack.server?.kill();
    },
  };

  try {
    stack.server = spawn(process.execPath, ['src/server.js'], {
      cwd: serverDir,
      env: {
        ...process.env,
        PORT: String(serverPort),
        NODE_ENV: 'development',
        CORS_ORIGINS: [teacherPort, studentPort].map((port) => `http://localhost:${port}`).join(','),
      },
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    await waitForHttp(`${stack.serverUrl}/health`, 'Server');

    // Vite reads VITE_* variables from the environment at startup.
    process.env.VITE_SERVER_URL = stack.serverUrl;
    const { createServer: createVite } = await import('vite');
    stack.teacherVite = await createVite({
      root: teacherDir,
      configFile: join(teacherDir, 'vite.config.js'),
      logLevel: 'warn',
      server: { port: teacherPort, strictPort: true, open: false },
    });
    await stack.teacherVite.listen();
    stack.studentVite = await createVite({
      root: studentDir,
      configFile: join(studentDir, 'vite.config.dev.ts'),
      // Closing a student page resets its proxied socket, which Vite logs as an error.
      logLevel: 'silent',
      server: {
        port: studentPort,
        strictPort: true,
        proxy: {
          '/api': { target: stack.serverUrl, changeOrigin: true },
          '/socket.io': { target: stack.serverUrl, ws: true, changeOrigin: true },
        },
      },
    });
    await stack.studentVite.listen();
  } catch (error) {
    await stack.stop();
    throw error;
  }
  return stack;
}

// A teacher browser context that skips the one-time /about redirect
// (SEEN_LANDING_KEY in src/app/firstVisit.ts).
export async function newTeacherContext(browser, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, ...options });
  await context.addInitScript(() => localStorage.setItem('classroom-widgets:seen-landing', '1'));
  return context;
}

// Joins `code` from the student app as `name` and returns the page.
export async function joinAsStudent(browser, studentUrl, code, name) {
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  await page.goto(studentUrl);
  await page.locator('#name').fill(name);
  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: 'Join Session' }).click();
  return page;
}
