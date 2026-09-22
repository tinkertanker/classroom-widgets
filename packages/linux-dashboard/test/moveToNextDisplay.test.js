const test = require('node:test');
const assert = require('node:assert/strict');
const { nextDisplayFrame } = require('../out/main/moveToNextDisplay.js');

const left = { x: 0, y: 0, width: 1920, height: 1080 };
const right = { x: 1920, y: 0, width: 1920, height: 1080 };

test('panel moves to the next display preserving its work-area offset', () => {
  assert.deepEqual(
    nextDisplayFrame({ x: 100, y: 50, width: 400, height: 300 }, [left, right]),
    { x: 2020, y: 50, width: 400, height: 300 });
});

test('panel wraps from the last display back to the first', () => {
  assert.deepEqual(
    nextDisplayFrame({ x: 2000, y: 80, width: 300, height: 200 }, [left, right]),
    { x: 80, y: 80, width: 300, height: 200 });
});

test('offset overflowing a smaller target work area is clamped', () => {
  const small = { x: 1920, y: 0, width: 800, height: 600 };
  assert.deepEqual(
    nextDisplayFrame({ x: 1500, y: 700, width: 400, height: 300 }, [left, small]),
    { x: 2320, y: 300, width: 400, height: 300 });
});

test('panel moves to the previous display preserving its work-area offset', () => {
  assert.deepEqual(
    nextDisplayFrame({ x: 2000, y: 80, width: 300, height: 200 }, [left, right], 'previous'),
    { x: 80, y: 80, width: 300, height: 200 });
});

test('panel wraps from the first display back to the last', () => {
  assert.deepEqual(
    nextDisplayFrame({ x: 100, y: 50, width: 400, height: 300 }, [left, right], 'previous'),
    { x: 2020, y: 50, width: 400, height: 300 });
});

test('fewer than two displays returns null', () => {
  assert.equal(nextDisplayFrame({ x: 100, y: 50, width: 400, height: 300 }, [left]), null);
  assert.equal(nextDisplayFrame({ x: 100, y: 50, width: 400, height: 300 }, []), null);
});

test('panel outside every work area returns null', () => {
  assert.equal(nextDisplayFrame({ x: 5000, y: 5000, width: 400, height: 300 }, [left, right]), null);
});
