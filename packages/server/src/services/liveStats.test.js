const test = require('node:test');
const assert = require('node:assert/strict');
const { LiveHistory } = require('./liveStats');

// Ways the last-hour live history can fail, written before the implementation:
// - it grows without bound on a server that runs for months
// - samples come back out of order, or an old sample survives past the hour
// - a second sample in the same minute adds a duplicate point
// - a teacher online for only part of a minute vanishes from the trend
// - a long pause (server asleep) leaves stale points that look recent

const MINUTE = 60_000;

test('keeps one sample per minute for the last hour, oldest first', () => {
  const clock = { now: Date.parse('2026-10-06T08:00:10Z') };
  const history = new LiveHistory({ minutes: 60, now: () => clock.now });

  for (let i = 0; i < 90; i++) {
    if (i > 0) clock.now += MINUTE;
    history.sample({ teachersOnline: i, studentsConnected: i * 2 });
  }
  const points = history.points();
  assert.equal(points.length, 60);
  assert.equal(points[0].teachersOnline, 30);
  assert.equal(points.at(-1).teachersOnline, 89);
  assert.ok(points.every((p, i) => i === 0 || p.t - points[i - 1].t === MINUTE));
});

test('each minute keeps the most seen at once during that minute', () => {
  const clock = { now: Date.parse('2026-10-06T08:00:05Z') };
  const history = new LiveHistory({ minutes: 60, now: () => clock.now });
  history.sample({ teachersOnline: 1, studentsConnected: 9 });
  clock.now += 20_000;
  history.sample({ teachersOnline: 3, studentsConnected: 2 });
  clock.now += 20_000;
  history.sample({ teachersOnline: 2, studentsConnected: 4 });
  assert.deepEqual(history.points(), [
    { t: Date.parse('2026-10-06T08:00:00Z'), teachersOnline: 3, studentsConnected: 9 }
  ]);
});

test('points older than the window are dropped even after a long gap', () => {
  const clock = { now: Date.parse('2026-10-06T08:00:00Z') };
  const history = new LiveHistory({ minutes: 60, now: () => clock.now });
  history.sample({ teachersOnline: 5, studentsConnected: 5 });
  clock.now += 3 * 60 * MINUTE;
  assert.deepEqual(history.points(), []);
  history.sample({ teachersOnline: 1, studentsConnected: 0 });
  assert.equal(history.points().length, 1);
});
