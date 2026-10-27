// Runs the Socket.IO end-to-end checks in e2e/ against a disposable server
// started in a child process on a free port, so `pnpm test` needs nothing
// running beforehand. Evidence lands under CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR
// (or the system temp directory) as the E2E script documents.
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const serverRoot = path.resolve(__dirname, '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForHealth(url, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`server exited early with status ${child.exitCode}`);
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`server did not answer /health at ${url}`);
}

function run(file, args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file, ...args], { cwd: serverRoot, stdio: 'inherit', env });
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

(async () => {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const env = { ...process.env, PORT: String(port), LOG_LEVEL: process.env.LOG_LEVEL || 'error' };
  const server = spawn(process.execPath, ['src/server.js'], { cwd: serverRoot, stdio: ['ignore', 'ignore', 'inherit'], env });
  try {
    await waitForHealth(url, server);
    const identity = await run('e2e/sessionIdentity.cjs', [url], env);
    // stateAccess starts its own in-process server so it can read room state.
    const stateAccess = await run('e2e/stateAccess.cjs', [], env);
    const voiceLogging = await run('e2e/voiceLogging.cjs', [], env);
    process.exitCode = identity || stateAccess || voiceLogging;
  } catch (error) {
    console.error(`E2E run failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    // The server's graceful shutdown sleeps five seconds; nothing is left to drain.
    server.kill('SIGKILL');
  }
})();
