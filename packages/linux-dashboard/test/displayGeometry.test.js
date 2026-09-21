const test = require('node:test');
const assert = require('node:assert/strict');
const geometry = require('../out/main/displayGeometry.js');

test('aspectFit returns centered letterbox geometry and rejects invalid sizes', () => {
  assert.deepEqual(geometry.aspectFit({ width: 16, height: 9 }, { x: 0, y: 0, width: 100, height: 100 }), {
    x: 0, y: 21.875, width: 100, height: 56.25,
  });
  assert.equal(geometry.aspectFit({ width: 0, height: 1 }, { x: 0, y: 0, width: 1, height: 1 }), null);
});

test('mapPreviewPointToSource uses open right and bottom edges', () => {
  const image = { x: 10, y: 20, width: 100, height: 50 };
  const source = { x: 100, y: 200, width: 1920, height: 1080 };
  assert.deepEqual(geometry.mapPreviewPointToSource({ x: 10, y: 20 }, image, source), { x: 100, y: 200 });
  assert.deepEqual(geometry.mapPreviewPointToSource({ x: 109.999, y: 69.999 }, image, source), { x: 2019, y: 1279 });
  assert.equal(geometry.mapPreviewPointToSource({ x: 110, y: 30 }, image, source), null);
  assert.equal(geometry.mapPreviewPointToSource({ x: 9, y: 30 }, image, source), null);
});

test('aspectNormalizedWindowSize fits, honors minimum, and clamps maximum', () => {
  assert.deepEqual(geometry.aspectNormalizedWindowSize(16 / 9, { width: 800, height: 600 }, 40, { width: 320, height: 180 }, { width: 1000, height: 800 }), {
    width: 800, height: 490,
  });
  assert.deepEqual(geometry.aspectNormalizedWindowSize(16 / 9, { width: 100, height: 100 }, 40, { width: 320, height: 180 }, { width: 1000, height: 800 }), {
    width: 320, height: 220,
  });
  assert.deepEqual(geometry.aspectNormalizedWindowSize(16 / 9, { width: 2000, height: 1200 }, 40, { width: 320, height: 180 }, { width: 800, height: 600 }), {
    width: 800, height: 490,
  });
});

test('rectangle helpers use strict positive-area overlap', () => {
  assert.equal(geometry.rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 }), false);
  assert.equal(geometry.rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 9, y: 9, width: 10, height: 10 }), true);
  assert.equal(geometry.intersectionArea({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }), 25);
});

test('describePosition follows the requested priority', () => {
  assert.equal(geometry.describePosition({ x: -1, y: -1, width: 1, height: 1 }), 'left');
  assert.equal(geometry.describePosition({ x: 0, y: -1, width: 1, height: 1 }), 'above');
  assert.equal(geometry.describePosition({ x: 1, y: 0, width: 1, height: 1 }), 'right');
  assert.equal(geometry.describePosition({ x: 0, y: 1, width: 1, height: 1 }), 'below');
  assert.equal(geometry.describePosition({ x: 0, y: 0, width: 1, height: 1 }), 'main');
});
