// Student-app scenarios, run by `bench.mjs --app student`. Each build is a
// student production build (base /student/) served next to its own real
// server, which already holds a session whose Drop Box and Questions rooms
// carry a history (older content), the way a lesson looks an hour in.
import { serveBuild } from './staticServer.mjs';
import { connect, freePort, hostSession, once, processCpuMs, startServer } from './liveSession.mjs';
import { cdpMetrics, delta, longTaskStats, measureLoad, openPage, readPerf, reloadWarm, waitForMark } from './scenarios.mjs';

const VIEWPORT = { width: 412, height: 860 };

// Starts the server, serves the student build through it, and fills a
// session (see hostSession).
export async function startStudentTarget(build, { compress, submissions, questions }) {
  const serverPort = await freePort();
  const serverUrl = `http://127.0.0.1:${serverPort}`;
  const site = await serveBuild(build.dir, { compress, base: '/student/', proxy: serverUrl });
  let server = null;
  const stop = async () => {
    server?.stop();
    await site.close();
  };
  try {
    server = await startServer({ dir: build.serverDir, port: serverPort, corsOrigins: [site.url] });
    const { teacher, code } = await hostSession(serverUrl, { dropBox: 'perf-dropbox', questionsRoom: 'perf-questions', submissions, questions });
    return { url: `${site.url}/student/`, serverUrl, code, pid: server.pid, teacher, stop: async () => { teacher.disconnect(); await stop(); } };
  } catch (error) {
    await stop();
    throw error;
  }
}

const formReady = `() => document.querySelector('#name') && document.querySelector('#code') && [...document.querySelectorAll('button')].some((b) => /Join Session/.test(b.textContent))`;
const roomsReady = () => document.querySelector('textarea#question')
  && [...document.querySelectorAll('textarea, input')].some((field) => /Paste a link/.test(field.placeholder || ''));

async function studentLoad(env) {
  const session = await openPage(env, { viewport: VIEWPORT, probe: { watch: [{ name: 'form', test: formReady }] } });
  try {
    const { result } = await measureLoad(env, session, env.baseUrl, 'form');
    const warm = await reloadWarm(env, session, 'form');
    return { ...result, ...warm };
  } finally {
    await session.context.close();
  }
}

// Join click to both rooms' inputs on screen. The click starts the socket
// connection, so this includes the Socket.IO handshake and the join reply.
async function studentJoin(env) {
  const session = await openPage(env, { viewport: VIEWPORT, probe: { watch: [{ name: 'form', test: formReady }] } });
  const { page, cdp } = session;
  try {
    await page.goto(env.baseUrl, { waitUntil: 'commit' });
    await waitForMark(page, 'form');
    await page.waitForTimeout(env.settleMs);
    await page.locator('#name').fill('Perf Student');
    await page.locator('#code').fill(env.target.code);
    const before = await cdpMetrics(cdp);
    const timing = await page.evaluate((test) => {
      // eslint-disable-next-line no-new-func
      const ready = new Function(`return (${test})`)();
      const button = () => [...document.querySelectorAll('button')].find((b) => /Join Session/.test(b.textContent));
      return window.__perf.clickAndWait(button, 'joined', ready);
    }, roomsReady.toString());
    await page.waitForTimeout(500);
    const after = await cdpMetrics(cdp);
    const perf = await readPerf(page);
    return {
      joinMs: timing.painted - timing.start,
      joinDomMs: timing.dom - timing.start,
      ...delta(after, before, 'join_'),
      ...longTaskStats(perf.longTasks, timing.start, timing.painted + 500, 'join_'),
    };
  } finally {
    await session.context.close();
  }
}

// What one more student joining costs: the session:joined payload and the
// server's CPU time, over `joins` sequential joins from Node.
async function serverJoin(env) {
  const joins = env.joins;
  const cpuBefore = processCpuMs(env.target.pid);
  const sizes = [];
  const times = [];
  for (let i = 0; i < joins; i++) {
    const socket = await connect(env.target.serverUrl);
    const started = performance.now();
    const joined = once(socket, 'session:joined');
    socket.emit('session:join', { code: env.target.code, name: `Joiner ${i}`, studentId: `perf-joiner-${i}` });
    const data = await joined;
    times.push(performance.now() - started);
    sizes.push(JSON.stringify(data).length);
    socket.disconnect();
  }
  const cpuAfter = processCpuMs(env.target.pid);
  times.sort((a, b) => a - b);
  return {
    joinReplyKB: sizes[0] / 1024,
    joinRoundTripMs: times[Math.floor(times.length / 2)],
    serverCpuMsPerJoin: cpuBefore === null ? null : (cpuAfter - cpuBefore) / joins,
  };
}

export const STUDENT_SCENARIOS = {
  'student-load': studentLoad,
  'student-join': studentJoin,
  'server-join': serverJoin,
};
export const STUDENT_DEFAULT = ['student-load', 'student-join', 'server-join'];
