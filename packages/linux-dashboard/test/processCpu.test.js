// Process CPU accounting for the launch benchmark (tests/perf/processCpu.cjs).
// Ways it can fail, each checked below against getrusage (process.cpuUsage),
// which counts every thread of this process, live or exited, in microseconds:
// 1. Only the thread-group leader is counted (/proc/<pid>/schedstat), so a
//    busy worker thread's CPU is missing while the main thread idles.
// 2. Only live threads are counted (/proc/<pid>/task/*/schedstat), so the
//    CPU of a thread that has exited disappears from a reading and from a
//    difference taken across its exit.
// 3. Units are wrong: clock ticks read as milliseconds, CLK_TCK assumed, or
//    nanoseconds and milliseconds mixed up.
// 4. Work is counted twice, for example the leader through both
//    /proc/<pid>/stat and its own task entry.
// 5. Only /proc/<pid>/stat is used, whose 10 ms clock ticks swamp the short,
//    nearly idle windows the benchmark measures.
// 6. A process that exits between listing and reading throws instead of
//    reading as gone, or a process with no earlier reading is not counted.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { Worker } = require('node:worker_threads');

const linuxOnly = { skip: process.platform !== 'linux' && 'reads Linux /proc' };
const { readProcessCpu, cpuNsBetween } = process.platform === 'linux' ? require('../tests/perf/processCpu.cjs') : {};

const rusageMs = () => {
  const usage = process.cpuUsage();
  return (usage.user + usage.system) / 1000;
};
// Spins for `ms` of wall time per request, then stays alive until told to exit.
const SPINNER = `
const { parentPort } = require('node:worker_threads');
parentPort.on('message', (message) => {
  if (message === 'exit') process.exit(0);
  const end = performance.now() + message;
  while (performance.now() < end) {}
  parentPort.postMessage('done');
});`;
function spinner() {
  const worker = new Worker(SPINNER, { eval: true });
  const spin = (ms) => new Promise((done) => {
    worker.once('message', done);
    worker.postMessage(ms);
  });
  const exit = () => new Promise((done) => {
    worker.once('exit', done);
    worker.postMessage('exit');
  });
  return { spin, exit };
}
// CPU this process used between two readings, next to getrusage over the same span.
async function measure(during) {
  const usageBefore = rusageMs();
  const before = readProcessCpu(process.pid);
  await during();
  const after = readProcessCpu(process.pid);
  return { readerMs: cpuNsBetween(before, after) / 1e6, rusageMs: rusageMs() - usageBefore, before, after };
}

test('counts a busy worker thread while the main thread idles', linuxOnly, async () => {
  const worker = spinner();
  await worker.spin(1); // let the thread start before the first reading
  const { readerMs, rusageMs: expected, before, after } = await measure(() => worker.spin(200));
  await worker.exit();
  assert.ok(expected > 100, `the worker should have used CPU (getrusage ${expected} ms)`);
  assert.ok(Math.abs(readerMs - expected) < 5, `difference ${readerMs} ms, getrusage ${expected} ms`);
  assert.ok(Math.abs((after.ns - before.ns) / 1e6 - expected) < 25, `reading totals ${before.ns} -> ${after.ns} ns, getrusage ${expected} ms`);
});

test('keeps the CPU of a worker thread that has exited', linuxOnly, async () => {
  const { readerMs, rusageMs: expected, before, after } = await measure(async () => {
    const worker = spinner();
    await worker.spin(200);
    await worker.exit();
  });
  assert.ok(expected > 100, `the worker should have used CPU (getrusage ${expected} ms)`);
  // Exited threads are only in /proc/<pid>/stat, which counts 10 ms clock ticks.
  assert.ok(Math.abs(readerMs - expected) < 25, `difference ${readerMs} ms, getrusage ${expected} ms`);
  assert.ok((after.ns - before.ns) / 1e6 > expected - 25, `reading totals ${before.ns} -> ${after.ns} ns, getrusage ${expected} ms`);
});

test('measures short intervals well inside a clock tick', linuxOnly, async () => {
  const worker = spinner();
  await worker.spin(1);
  // 15 ms sits between two 10 ms ticks, where /proc/<pid>/stat alone is ~5 ms out.
  const errors = [];
  for (let i = 0; i < 9; i++) {
    const { readerMs, rusageMs: expected } = await measure(() => worker.spin(15));
    errors.push(Math.abs(readerMs - expected));
  }
  await worker.exit();
  errors.sort((a, b) => a - b);
  assert.ok(errors[4] < 1.5, `median error ${errors[4]} ms over 15 ms intervals (errors ${errors.map((e) => e.toFixed(2)).join(', ')})`);
});

test('reads a process that has exited as gone and counts a new process from zero', linuxOnly, () => {
  const child = spawnSync(process.execPath, ['-e', '']);
  assert.equal(child.status, 0);
  assert.equal(readProcessCpu(child.pid), null);
  const current = readProcessCpu(process.pid);
  assert.equal(cpuNsBetween(undefined, current), current.ns);
});
