const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const script = path.join(__dirname, 'cache.cjs');

// Failure modes: incomplete/modified archive, wrong identity, lost executable
// bits, fallback-policy mixing, and unchanged keys after install inputs change.
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'linux-cache-test-'));
  const project = path.join(root, 'packages/linux-dashboard');
  fs.mkdirSync(path.join(project, 'node_modules/.bin'), { recursive: true });
  fs.writeFileSync(path.join(project, 'package.json'), '{"name":"fixture"}');
  fs.writeFileSync(path.join(project, 'package-lock.json'), '{"lockfileVersion":3}');
  fs.writeFileSync(path.join(project, 'node_modules/tool.js'), 'console.log("tool");');
  fs.chmodSync(path.join(project, 'node_modules/tool.js'), 0o755);
  fs.symlinkSync('../tool.js', path.join(project, 'node_modules/.bin/tool'));
  const f = { root, project };
  f.key = run(f, 'key').key;
  return f;
}
function run(f, command, extra = {}) {
  const output = path.join(f.root, 'outputs');
  fs.writeFileSync(output, '');
  const result = spawnSync(process.execPath, [script, command], {
    cwd: f.project, encoding: 'utf8',
    env: { ...process.env, GITHUB_OUTPUT: output, CACHE_KEY: f.key || '', ALLOW_INSTALL_FALLBACK: 'false', ...extra },
  });
  assert.equal(result.status, 0, result.stderr);
  return Object.fromEntries(fs.readFileSync(output, 'utf8').trim().split('\n').map(line => line.split('=')));
}
test('sealed tree is reusable without Electron dist; incomplete or altered trees fail closed', () => {
  const f = fixture();
  try {
    assert.equal(run(f, 'validate').valid, 'false');
    run(f, 'seal');
    assert.equal(run(f, 'validate').valid, 'true');
    assert.equal(run(f, 'validate', { CACHE_KEY: 'different-key' }).valid, 'false');
    fs.chmodSync(path.join(f.project, 'node_modules/tool.js'), 0o644);
    assert.equal(run(f, 'validate').valid, 'false');
    fs.chmodSync(path.join(f.project, 'node_modules/tool.js'), 0o755);
    fs.writeFileSync(path.join(f.project, 'node_modules/tool.js'), 'broken');
    assert.equal(run(f, 'validate').valid, 'false');
    run(f, 'seal');
    fs.unlinkSync(path.join(f.project, 'node_modules/.bin/tool'));
    assert.equal(run(f, 'validate').valid, 'false');
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});
test('exact identity invalidates manifests, lockfile, config, policy, and image; changed inputs cannot be sealed', () => {
  const f = fixture();
  try {
    const original = run(f, 'key').key;
    assert.equal(run(f, 'key').key, original);
    for (const file of ['package.json', 'package-lock.json', '.npmrc', '../../.npmrc']) {
      const target = path.join(f.project, file);
      const previous = fs.existsSync(target) ? fs.readFileSync(target) : null;
      fs.writeFileSync(target, file.endsWith('.npmrc') ? 'audit=false\n' : '{}');
      assert.notEqual(run(f, 'key').key, original, file);
      assert.equal(run(f, 'seal').frozen, 'false');
      if (previous) fs.writeFileSync(target, previous); else fs.unlinkSync(target);
    }
    assert.notEqual(run(f, 'key', { ALLOW_INSTALL_FALLBACK: 'true' }).key, original);
    assert.notEqual(run(f, 'key', { ImageOS: 'different-image' }).key, original);
    assert.notEqual(run(f, 'key', { npm_config_ignore_scripts: 'true' }).key, original);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});
