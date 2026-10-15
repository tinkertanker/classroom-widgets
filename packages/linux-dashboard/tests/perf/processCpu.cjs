// Process-wide CPU time of a Linux process, for the launch benchmark.
//
// /proc/<pid>/schedstat covers only the thread-group leader, so it misses the
// compositor, raster, V8 worker and IO threads that do much of Chromium's work.
// Two process-wide sources remain, and each misses something:
// - /proc/<pid>/task/*/schedstat: nanoseconds, but only for threads still alive.
// - /proc/<pid>/stat utime + stime: every thread, exited ones included, but in
//   clock ticks (10 ms at CLK_TCK 100), each truncated, so it reads up to two
//   ticks low.
// Both are lower bounds, so a reading takes the larger of the two. A difference
// uses the per-thread sums, which are exact to the nanosecond while no thread
// exits, and switches to the stat difference (within two ticks) only when that
// shows exited threads held more than two ticks of CPU in the window. In the
// benchmark's renderers exited threads held none; in the browser, under 20 ms
// over a whole run. Checked against getrusage in test/processCpu.test.js.
const { readdirSync, readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');

const clockTicks = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim());
if (!(clockTicks > 0)) throw new Error(`getconf CLK_TCK returned ${clockTicks}`);
const TICK_NS = 1e9 / clockTicks;

// One reading of a process, or null when it has gone.
// { pid, startTime, statNs, threads: Map<tid, ns>, ns }
function readProcessCpu(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    // Field 2 (comm) is in parentheses and may contain spaces or ')'.
    const fields = stat.slice(stat.lastIndexOf(') ') + 2).split(' ');
    const statNs = (Number(fields[11]) + Number(fields[12])) * TICK_NS; // fields 14, 15
    const startTime = fields[19]; // field 22, tells a reused pid apart
    const threads = new Map();
    let threadNs = 0;
    for (const tid of readdirSync(`/proc/${pid}/task`)) {
      try {
        const ns = Number(readFileSync(`/proc/${pid}/task/${tid}/schedstat`, 'utf8').split(' ')[0]);
        threads.set(tid, ns);
        threadNs += ns;
      } catch {
        // The thread exited while listing; stat still counts it.
      }
    }
    return { pid, startTime, statNs, threads, ns: Math.max(threadNs, statNs) };
  } catch {
    return null;
  }
}

// CPU nanoseconds a process used between two readings. With no earlier
// reading, or one of a different process on a reused pid, all of it counts.
function cpuNsBetween(before, after) {
  if (!after) return 0;
  if (!before || before.startTime !== after.startTime) return after.ns;
  let threadNs = 0;
  for (const [tid, end] of after.threads) {
    const start = before.threads.get(tid);
    // A new thread, or a tid reused by one, counts from zero.
    threadNs += start === undefined || end < start ? end : end - start;
  }
  // The stat difference is within two ticks of the truth either way. Only when
  // it beats the per-thread difference by more than that have threads that
  // exited held CPU in the window, and then it is the better estimate.
  const statNs = after.statNs - before.statNs;
  return statNs - 2 * TICK_NS > threadNs ? statNs : threadNs;
}

module.exports = { readProcessCpu, cpuNsBetween, TICK_NS };
