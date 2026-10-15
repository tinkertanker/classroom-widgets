// A real server holding a classroom session with history, for the scenarios
// that need one: the student app (studentScenarios.mjs) and a teacher
// reloading mid-lesson (board-history in scenarios.mjs).
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const defaultServerDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../server');

export function freePort() {
  return new Promise((done, fail) => {
    const probe = createNetServer();
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });
}

export const once = (socket, event, ms = 10000) => new Promise((done, fail) => {
  const timer = setTimeout(() => fail(new Error(`timed out waiting for ${event}`)), ms);
  socket.once(event, (data) => {
    clearTimeout(timer);
    done(data);
  });
});

export async function connect(url) {
  const socket = io(url, { transports: ['websocket'], reconnection: false });
  await once(socket, 'connect');
  return socket;
}

export async function join(url, code, name) {
  const socket = await connect(url);
  const joined = once(socket, 'session:joined');
  socket.emit('session:join', { code, name, studentId: `perf-${name}` });
  const data = await joined;
  if (!data.success) throw new Error(`join failed: ${data.error}`);
  return { socket, data };
}

// Server CPU time (user + system) in ms, from /proc (Linux).
export function processCpuMs(pid) {
  try {
    const fields = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
    return ((Number(fields[11]) + Number(fields[12])) * 1000) / 100;
  } catch {
    return null;
  }
}

// Starts packages/server (or a copy of it in `dir`) on `port`.
export async function startServer({ dir, port, corsOrigins }) {
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: resolve(dir || defaultServerDir),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'development', CORS_ORIGINS: corsOrigins.join(',') },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const stop = () => server.kill();
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${url}/health`)).ok) break;
    } catch {
      // not listening yet
    }
    if (server.exitCode !== null || i > 120) {
      stop();
      throw new Error(`server in ${dir || defaultServerDir} did not start on port ${port}`);
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  return { url, pid: server.pid, stop };
}

// Hosts a session with an open Drop Box and Questions room, then fills them
// with `submissions` entries and `questions` questions from helper students,
// who leave again (their entries stay). Returns the host socket.
export async function hostSession(serverUrl, { dropBox, questionsRoom, submissions, questions }) {
  const teacher = await connect(serverUrl);
  const created = await teacher.timeout(5000).emitWithAck('session:create', {});
  const { code, hostToken } = created;
  for (const [roomType, widgetId] of [['linkShare', dropBox], ['questions', questionsRoom]]) {
    await teacher.timeout(5000).emitWithAck('session:createRoom', { sessionCode: code, roomType, widgetId });
    teacher.emit('session:updateWidgetState', { sessionCode: code, roomType, widgetId, isActive: true });
  }
  await new Promise((done) => setTimeout(done, 200));
  // Per-socket rate limits allow 3 Drop Box and 2 Questions submissions in a burst.
  const helpers = Math.max(Math.ceil(submissions / 3), Math.ceil(questions / 2));
  let links = 0;
  let asked = 0;
  for (let start = 0; start < helpers; start += 25) {
    await Promise.all(Array.from({ length: Math.min(25, helpers - start) }, async (_, offset) => {
      const index = start + offset;
      const { socket } = await join(serverUrl, code, `Student ${index + 1}`);
      // Claim each slot before awaiting, so helpers running at the same time
      // cannot all pass the check and overshoot the configured totals.
      for (let k = 0; k < 3 && links < submissions; k++) {
        links++;
        const submitted = once(socket, 'session:linkShare:submitted');
        socket.emit('session:linkShare:submit', { sessionCode: code, widgetId: dropBox, content: `https://example.com/lesson/notes/${index}-${k}?ref=student-${index + 1}&topic=photosynthesis-and-respiration` });
        await submitted;
      }
      for (let k = 0; k < 2 && asked < questions; k++) {
        asked++;
        const submitted = once(socket, 'session:questions:submitted');
        socket.emit('session:questions:submit', { sessionCode: code, widgetId: questionsRoom, question: `Question ${index}-${k}: why does the light-dependent stage need water, and where does the oxygen we breathe come from?` });
        await submitted;
      }
      socket.disconnect();
    }));
  }
  return { teacher, code, hostToken, createdAt: Date.now() };
}
