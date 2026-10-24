const test = require('node:test');
const assert = require('node:assert/strict');
const { snapWindowFrame, WINDOW_SNAP_PRESETS } = require('../out/main/windowSnap.js');

// Failure modes this guards:
// - a half or quarter leaves its edge, or overlaps its neighbour
// - the title bar and control bar are left out, so the frame spills past the region
// - the preview loses the source aspect ratio
// - a work area with a non-zero origin (second screen, top panel) is ignored
// - the minimum size pushes the frame off the work area
// - bad aspect or work-area values crash or produce NaN frames
// - fractional bounds reach Electron, which needs whole pixels
// - a widget's maximum size is ignored, or a capped window drifts off its edge
// - a fixed-size widget is resized instead of only moved

const work = { x: 0, y: 0, width: 1920, height: 1080 };
const chrome = { width: 0, height: 72 };
const base = { aspect: 16 / 9, chrome, minimumFrame: { width: 320, height: 312 }, margin: 12, currentFrame: { x: 100, y: 100, width: 480, height: 360 } };
const area = { x: 12, y: 12, width: 1896, height: 1056 };
const right = (r) => r.x + r.width;
const bottom = (r) => r.y + r.height;
const overlaps = (a, b) => Math.min(right(a), right(b)) > Math.max(a.x, b.x) && Math.min(bottom(a), bottom(b)) > Math.max(a.y, b.y);
const inside = (r, outer) => r.x >= outer.x && r.y >= outer.y && right(r) <= right(outer) && bottom(r) <= bottom(outer);
const previewAspect = (r) => (r.width - chrome.width) / (r.height - chrome.height);

test('every preset stays inside the inset work area with whole-pixel bounds', () => {
  for (const preset of WINDOW_SNAP_PRESETS) {
    const frame = snapWindowFrame(preset, work, base);
    assert.ok(frame, preset);
    assert.ok(inside(frame, area), `${preset} ${JSON.stringify(frame)}`);
    for (const value of [frame.x, frame.y, frame.width, frame.height]) assert.ok(Number.isInteger(value), `${preset} ${value}`);
  }
});

test('halves touch their own edge and are centred on the other axis', () => {
  const left = snapWindowFrame('left-half', work, base);
  const rightHalf = snapWindowFrame('right-half', work, base);
  const top = snapWindowFrame('top-half', work, base);
  const bottomHalf = snapWindowFrame('bottom-half', work, base);
  assert.equal(left.x, area.x);
  assert.equal(right(rightHalf), right(area));
  assert.equal(top.y, area.y);
  assert.equal(bottom(bottomHalf), bottom(area));
  assert.ok(Math.abs(left.y + left.height / 2 - (area.y + area.height / 2)) <= 1);
  assert.ok(Math.abs(top.x + top.width / 2 - (area.x + area.width / 2)) <= 1);
  assert.equal(overlaps(left, rightHalf), false);
  assert.equal(overlaps(top, bottomHalf), false);
});

test('a half uses the whole half width when the aspect allows it', () => {
  const left = snapWindowFrame('left-half', work, base);
  assert.equal(left.width, 942);
  assert.ok(left.width <= (area.width - 12) / 2);
});

test('quarters sit in their corners without overlapping each other', () => {
  const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((preset) => snapWindowFrame(preset, work, base));
  const [tl, tr, bl, br] = corners;
  assert.deepEqual([tl.x, tl.y], [area.x, area.y]);
  assert.deepEqual([right(tr), tr.y], [right(area), area.y]);
  assert.deepEqual([bl.x, bottom(bl)], [area.x, bottom(area)]);
  assert.deepEqual([right(br), bottom(br)], [right(area), bottom(area)]);
  for (let i = 0; i < corners.length; i += 1) {
    for (let j = i + 1; j < corners.length; j += 1) assert.equal(overlaps(corners[i], corners[j]), false, `${i} ${j}`);
  }
});

test('the preview keeps the source aspect, with the chrome added on top', () => {
  for (const aspect of [16 / 9, 4 / 3, 16 / 10, 21 / 9, 9 / 16]) {
    for (const preset of WINDOW_SNAP_PRESETS.filter((name) => name !== 'centre')) {
      const frame = snapWindowFrame(preset, work, { ...base, aspect });
      assert.ok(Math.abs(previewAspect(frame) - aspect) / aspect < 0.01, `${preset} ${aspect} ${JSON.stringify(frame)}`);
    }
  }
});

test('a 4:3 source in the left half is limited by width, a portrait one by height', () => {
  const wide = snapWindowFrame('left-half', work, { ...base, aspect: 4 / 3 });
  assert.equal(wide.width, 942);
  const tall = snapWindowFrame('left-half', work, { ...base, aspect: 9 / 16 });
  assert.equal(tall.height, area.height);
  assert.equal(tall.x, area.x);
});

test('without a source aspect the frame fills its region exactly', () => {
  const options = { ...base, aspect: null };
  assert.deepEqual(snapWindowFrame('left-half', work, options), { x: 12, y: 12, width: 942, height: 1056 });
  assert.deepEqual(snapWindowFrame('bottom-right', work, options), { x: 966, y: 546, width: 942, height: 522 });
  assert.deepEqual(snapWindowFrame('fill', work, options), area);
  for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(snapWindowFrame('left-half', work, { ...base, aspect }), { x: 12, y: 12, width: 942, height: 1056 });
  }
});

test('fill is the largest aspect fit, centred', () => {
  const frame = snapWindowFrame('fill', work, base);
  assert.ok(frame.height === area.height || frame.width === area.width);
  assert.ok(Math.abs(frame.x + frame.width / 2 - (area.x + area.width / 2)) <= 1);
  assert.ok(Math.abs(frame.y + frame.height / 2 - (area.y + area.height / 2)) <= 1);
});

test('centre keeps the current size and only moves the window', () => {
  const frame = snapWindowFrame('centre', work, base);
  assert.equal(frame.width, 480);
  assert.equal(frame.height, 360);
  assert.equal(frame.x, 12 + (1896 - 480) / 2);
  assert.equal(frame.y, 12 + (1056 - 360) / 2);
  const huge = snapWindowFrame('centre', work, { ...base, currentFrame: { x: 0, y: 0, width: 4000, height: 3000 } });
  assert.deepEqual(huge, area);
});

test('a work area with a non-zero origin is respected', () => {
  const second = { x: -1440, y: 28, width: 1440, height: 872 };
  const secondArea = { x: -1428, y: 40, width: 1416, height: 848 };
  for (const preset of WINDOW_SNAP_PRESETS) {
    const frame = snapWindowFrame(preset, second, base);
    assert.ok(inside(frame, secondArea), `${preset} ${JSON.stringify(frame)}`);
  }
  assert.equal(snapWindowFrame('top-left', second, base).x, -1428);
  assert.equal(snapWindowFrame('top-left', second, base).y, 40);
});

test('the minimum size wins over a tiny region but stays on the work area', () => {
  const small = { x: 100, y: 50, width: 700, height: 500 };
  const smallArea = { x: 112, y: 62, width: 676, height: 476 };
  for (const preset of WINDOW_SNAP_PRESETS) {
    const frame = snapWindowFrame(preset, small, base);
    assert.ok(frame.width >= 320 && frame.height >= 312, `${preset} ${JSON.stringify(frame)}`);
    assert.ok(inside(frame, smallArea), `${preset} ${JSON.stringify(frame)}`);
  }
  // Grown to the minimum, the right-hand quarter still keeps to the right edge.
  const br = snapWindowFrame('bottom-right', small, base);
  assert.equal(right(br), right(smallArea));
  assert.equal(bottom(br), bottom(smallArea));
});

test('a work area smaller than the minimum is used whole rather than overflowed', () => {
  const tiny = { x: 0, y: 0, width: 300, height: 200 };
  const frame = snapWindowFrame('left-half', tiny, base);
  assert.ok(inside(frame, tiny), JSON.stringify(frame));
});

test('unusable input returns null instead of a broken frame', () => {
  assert.equal(snapWindowFrame('left-half', { x: 0, y: 0, width: 0, height: 1080 }, base), null);
  assert.equal(snapWindowFrame('left-half', { x: Number.NaN, y: 0, width: 1920, height: 1080 }, base), null);
  assert.equal(snapWindowFrame('somewhere', work, base), null);
  assert.equal(snapWindowFrame('centre', work, { ...base, currentFrame: { x: 0, y: 0, width: Number.NaN, height: 10 } }), null);
});

test('a maximum size caps the frame, keeps the aspect and keeps it on its edge', () => {
  const capped = { ...base, maximumFrame: { width: 500, height: 600 } };
  const rightHalf = snapWindowFrame('right-half', work, capped);
  assert.ok(rightHalf.width <= 500 && rightHalf.height <= 600, JSON.stringify(rightHalf));
  assert.ok(Math.abs(previewAspect(rightHalf) - 16 / 9) < 0.02);
  assert.equal(right(rightHalf), right(area));
  const free = snapWindowFrame('bottom-left', work, { ...capped, aspect: null });
  assert.deepEqual([free.width, free.height], [500, 522]);
  assert.deepEqual([free.x, bottom(free)], [area.x, bottom(area)]);
});

test('a fixed-size widget is only moved', () => {
  const fixed = { ...base, aspect: null, minimumFrame: { width: 300, height: 200 }, maximumFrame: { width: 300, height: 200 } };
  for (const preset of WINDOW_SNAP_PRESETS) {
    const frame = snapWindowFrame(preset, work, fixed);
    assert.deepEqual([frame.width, frame.height], [300, 200], preset);
    assert.ok(inside(frame, area), preset);
  }
  assert.deepEqual(snapWindowFrame('top-right', work, fixed), { x: 1608, y: 12, width: 300, height: 200 });
  assert.deepEqual(snapWindowFrame('left-half', work, fixed), { x: 12, y: 440, width: 300, height: 200 });
});

test('the minimum wins when it is above a broken maximum', () => {
  const frame = snapWindowFrame('fill', work, { ...base, aspect: null, maximumFrame: { width: 100, height: 100 } });
  assert.deepEqual([frame.width, frame.height], [320, 312]);
});
