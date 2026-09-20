const test = require('node:test');
const assert = require('node:assert/strict');
const { DisplayCatalog } = require('../out/main/displayCatalog.js');

function display(id, label, x = 0, y = 0) {
  return { id, label, bounds: { x, y, width: 1920, height: 1080 }, scaleFactor: 1, internal: id === 1 };
}

test('catalog names displays, filters host, and formats logical labels', () => {
  const source = { getAllDisplays: () => [display(1, ''), display(2, 'Projector', -1920, 0)] };
  const catalog = new DisplayCatalog(source);
  assert.deepEqual(catalog.eligibleSources(1).map((item) => item.id), [2]);
  assert.equal(catalog.displays()[0].name, 'Display 1');
  assert.equal(catalog.sourceLabel(catalog.displays()[1]), 'Projector — 1920 × 1080, left');
});

test('catalog resolves remembered, sole, and absent sources', () => {
  const candidates = [display(2, 'Projector'), display(3, 'Wall')];
  const catalog = new DisplayCatalog({ getAllDisplays: () => candidates });
  assert.equal(catalog.resolveSource(3, candidates).id, 3);
  assert.equal(catalog.resolveSource(null, [candidates[0]]).id, 2);
  assert.equal(catalog.resolveSource(null, candidates), null);
});

test('currentMatching refreshes a descriptor by id', () => {
  let current = [display(2, 'Old')];
  const catalog = new DisplayCatalog({ getAllDisplays: () => current });
  const old = catalog.displays()[0];
  current = [display(2, 'New', 100, 50)];
  assert.equal(catalog.currentMatching(old).name, 'New');
  assert.equal(catalog.currentMatching({ ...old, id: 8 }), null);
});
