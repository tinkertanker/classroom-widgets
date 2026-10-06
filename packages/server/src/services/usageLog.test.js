const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { UsageLog, normaliseClientEvent } = require('./usageLog');

// Ways the usage log can fail, written before the implementation:
// - a client payload smuggles extra fields (names, free text) into the log
// - a client string breaks out of its JSON line or bloats the file
// - unknown events or widget names pollute the counts
// - with no directory configured it still writes files somewhere
// - events either side of local midnight land in the wrong day's file
// - a line truncated by a crash makes the whole day unreadable
// - a device seen on several days counts as several unique devices
// - a cached past day hides events, or today's numbers go stale
// - retention deletes unrelated files, or keeps expired days forever
// - a write failure throws into the socket handler

const CLIENT = '0f8c2a52-2f38-4f6b-9d1e-3b7f2b9d6a10';
const VISIT = 'b1f1c6f4-7f39-4a1e-8d0c-2a1b3c4d5e6f';

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-log-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function createLog(dir, clock, options = {}) {
  return new UsageLog({
    dir: path.join(dir, 'usage'),
    timeZone: 'Asia/Singapore',
    retentionDays: 30,
    now: () => clock.now,
    ...options
  });
}

test('client payloads keep only known fields with safe values', () => {
  assert.deepEqual(
    normaliseClientEvent({ event: 'widget_add', clientId: CLIENT, visitId: VISIT, widget: 'POLL', surface: 'desktop', name: 'Alice' }),
    { e: 'widget_add', c: CLIENT, v: VISIT, w: 'POLL', s: 'desktop' }
  );
  assert.deepEqual(
    normaliseClientEvent({ event: 'app_open', clientId: CLIENT, visitId: VISIT, surface: 'smart-fridge' }),
    { e: 'app_open', c: CLIENT, v: VISIT }
  );
});

test('malformed client payloads are dropped', () => {
  const base = { event: 'app_open', clientId: CLIENT, visitId: VISIT };
  const rejected = [
    null,
    undefined,
    'app_open',
    [base],
    { ...base, event: 'delete_everything' },
    { ...base, event: '__proto__' },
    { ...base, clientId: undefined },
    { ...base, clientId: 'short' },
    { ...base, clientId: 'x'.repeat(65) },
    { ...base, clientId: `${CLIENT}"}\n{"e":"app_open` },
    { ...base, visitId: 42 },
    { ...base, event: 'widget_add' },
    { ...base, event: 'widget_add', widget: 'poll; drop' },
    { ...base, event: 'widget_add', widget: 'A'.repeat(41) },
    { ...base, event: 'widget_add', widget: 11 }
  ];
  for (const payload of rejected) {
    assert.equal(normaliseClientEvent(payload), null, JSON.stringify(payload));
  }
});

test('with no directory configured nothing is written and the summary says so', async (t) => {
  const dir = tempDir(t);
  const log = new UsageLog({ dir: '', now: () => Date.now() });
  log.record({ e: 'app_open', c: CLIENT, v: VISIT });
  const summary = await log.summarise({ days: 7 });
  assert.equal(log.enabled, false);
  assert.equal(summary.enabled, false);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('events are filed under the configured time zone day', async (t) => {
  const dir = tempDir(t);
  const clock = { now: Date.parse('2026-10-05T15:59:59Z') }; // 23:59:59 in Singapore
  const log = createLog(dir, clock);

  log.record({ e: 'app_open', c: CLIENT, v: VISIT });
  clock.now = Date.parse('2026-10-05T16:00:01Z'); // 00:00:01 on the 6th
  log.record({ e: 'app_open', c: CLIENT, v: VISIT });
  await log.flush();

  assert.deepEqual(fs.readdirSync(path.join(dir, 'usage')).sort(), ['2026-10-05.jsonl', '2026-10-06.jsonl']);
  const summary = await log.summarise({ days: 2 });
  assert.deepEqual(summary.days.map(d => [d.date, d.appOpens]), [['2026-10-05', 1], ['2026-10-06', 1]]);
});

test('a truncated line is skipped and the rest of the day still counts', async (t) => {
  const dir = tempDir(t);
  const clock = { now: Date.parse('2026-10-06T04:00:00Z') };
  const log = createLog(dir, clock);
  log.record({ e: 'app_open', c: CLIENT, v: VISIT });
  await log.flush();
  fs.appendFileSync(path.join(dir, 'usage', '2026-10-06.jsonl'), '{"t":1,"e":"app_op');
  fs.appendFileSync(path.join(dir, 'usage', '2026-10-06.jsonl'), '\n["not","an","event"]\nnull\n');
  log.record({ e: 'widget_add', c: CLIENT, v: VISIT, w: 'TIMER' });

  const summary = await log.summarise({ days: 1 });
  assert.equal(summary.totals.appOpens, 1);
  assert.equal(summary.totals.widgetAdds, 1);
});

test('unique devices and visits are counted once across the whole range', async (t) => {
  const dir = tempDir(t);
  const clock = { now: Date.parse('2026-10-04T02:00:00Z') };
  const log = createLog(dir, clock);
  const other = '7d3a1c9e-0000-4000-8000-000000000001';

  log.record({ e: 'app_open', c: CLIENT, v: VISIT, s: 'web' });
  log.record({ e: 'widget_add', c: CLIENT, v: VISIT, w: 'POLL' });
  log.record({ e: 'session_start' });
  log.record({ e: 'student_join' });
  log.record({ e: 'student_join' });
  clock.now = Date.parse('2026-10-06T02:00:00Z');
  log.record({ e: 'app_open', c: CLIENT, v: 'visit-two-00000000', s: 'web' });
  log.record({ e: 'widget_add', c: CLIENT, v: 'visit-two-00000000', w: 'POLL' });
  log.record({ e: 'app_open', c: other, v: 'visit-three-000000', s: 'desktop' });
  log.record({ e: 'widget_add', c: other, v: 'visit-three-000000', w: 'TIMER' });

  const summary = await log.summarise({ days: 3 });
  assert.deepEqual(summary.days.map(d => d.date), ['2026-10-04', '2026-10-05', '2026-10-06']);
  assert.deepEqual(summary.days.map(d => d.uniqueClients), [1, 0, 2]);
  assert.deepEqual(summary.totals, {
    appOpens: 3,
    visits: 3,
    uniqueClients: 2,
    webClients: 1,
    desktopClients: 1,
    widgetAdds: 3,
    sessions: 1,
    studentJoins: 2
  });
  assert.deepEqual(summary.widgets, [
    { widget: 'POLL', adds: 2, uniqueClients: 1 },
    { widget: 'TIMER', adds: 1, uniqueClients: 1 }
  ]);

  const lastDayOnly = await log.summarise({ days: 1 });
  assert.equal(lastDayOnly.totals.uniqueClients, 2);
  assert.equal(lastDayOnly.totals.sessions, 0);
});

test('past days are read once while today keeps updating', async (t) => {
  const dir = tempDir(t);
  const clock = { now: Date.parse('2026-10-05T02:00:00Z') };
  const log = createLog(dir, clock);
  log.record({ e: 'app_open', c: CLIENT, v: VISIT });
  clock.now = Date.parse('2026-10-06T02:00:00Z');
  log.record({ e: 'app_open', c: CLIENT, v: VISIT });

  assert.equal((await log.summarise({ days: 2 })).totals.appOpens, 2);
  log.record({ e: 'app_open', c: CLIENT, v: VISIT });
  assert.equal((await log.summarise({ days: 2 })).totals.appOpens, 3);

  // A past day's file is not re-read once summarised.
  fs.writeFileSync(path.join(dir, 'usage', '2026-10-05.jsonl'), '');
  assert.equal((await log.summarise({ days: 2 })).totals.appOpens, 3);
});

test('the requested range is clamped to the retention window', async (t) => {
  const dir = tempDir(t);
  const clock = { now: Date.parse('2026-10-06T02:00:00Z') };
  const log = createLog(dir, clock);
  assert.equal((await log.summarise({ days: 10_000 })).days.length, 30);
  assert.equal((await log.summarise({ days: -5 })).days.length, 1);
  assert.equal((await log.summarise({ days: 'abc' })).days.length, 30);
});

test('pruning removes only expired day files', async (t) => {
  const dir = tempDir(t);
  const usageDir = path.join(dir, 'usage');
  fs.mkdirSync(usageDir);
  for (const name of ['2026-09-06.jsonl', '2026-09-07.jsonl', '2026-10-06.jsonl', 'notes.txt', '2020-01-01.backup']) {
    fs.writeFileSync(path.join(usageDir, name), '');
  }
  const clock = { now: Date.parse('2026-10-06T02:00:00Z') };
  await createLog(dir, clock).prune();
  assert.deepEqual(fs.readdirSync(usageDir).sort(), ['2020-01-01.backup', '2026-09-07.jsonl', '2026-10-06.jsonl', 'notes.txt']);
});

test('a write failure is logged, not thrown', async (t) => {
  const dir = tempDir(t);
  const blocker = path.join(dir, 'not-a-dir');
  fs.writeFileSync(blocker, '');
  const log = new UsageLog({ dir: path.join(blocker, 'usage'), now: () => Date.now() });
  assert.doesNotThrow(() => log.record({ e: 'app_open', c: CLIENT, v: VISIT }));
  await assert.doesNotReject(log.flush());
});
