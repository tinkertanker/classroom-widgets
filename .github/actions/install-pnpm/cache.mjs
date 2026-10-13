import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Repository-specific pnpm 11 installs; Windows keeps the download store because
// rebuilding links measured faster than extracting a completed tree there.
const action = dirname(fileURLToPath(import.meta.url));
const repo = realpathSync(process.env.GITHUB_WORKSPACE || process.cwd());
const directory = process.env.INSTALL_DIRECTORY || '.';
const filter = process.env.INSTALL_FILTER || '';
const cache = process.env.INSTALL_CACHE || 'tree';
if (!['.', 'deploy/cloudflare'].includes(directory) ||
    !['tree', 'store'].includes(cache) ||
    !['', '@classroom-widgets/teacher...'].includes(filter) || (directory !== '.' && filter)) {
  throw new Error('Supported installs: root (optionally teacher...) or deploy/cloudflare; cache must be tree or store');
}
const cwd = join(repo, directory);
const projects = directory !== '.' ? [directory] : filter
  ? ['.', 'packages/shared', 'packages/teacher']
  : ['.', 'packages/shared', 'packages/teacher', 'packages/student', 'packages/server'];
const trees = projects.map(project => join(repo, project, 'node_modules'));
const receipt = join(cwd, 'node_modules', '.classroom-pnpm-cache.json');
const hash = value => createHash('sha256').update(value).digest('hex');
const output = (name, value) => appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<PNPM_CACHE_OUTPUT\n${value}\nPNPM_CACHE_OUTPUT\n`);
// pnpm/action-setup exposes a .cmd shim on Windows. All arguments here are fixed.
const pnpm = (args, options = {}) => execFileSync('pnpm', args, { cwd, shell: process.platform === 'win32', ...options });

function identity() {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repo, encoding: 'utf8' }).split('\0').filter(Boolean);
  const inputs = tracked.filter(path => {
    const inProject = directory === '.' ? !path.startsWith('deploy/') : path.startsWith(`${directory}/`);
    return (inProject && (/(^|\/)(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.npmrc|\.?pnpmfile\.[cm]?js)$/.test(path) ||
      /(^|\/)(patches|hooks)\//.test(path) || path.startsWith('scripts/'))) || path === '.npmrc';
  });
  // Hash contents on disk, not index blobs: a modified manifest must not reuse a hit.
  const files = [...new Set([...inputs.map(path => join(repo, path)), join(action, 'action.yml'), join(action, 'cache.mjs')])].sort();
  const inputHash = createHash('sha256');
  for (const file of files) {
    inputHash.update(relative(repo, file));
    inputHash.update('\0');
    inputHash.update(existsSync(file) ? readFileSync(file) : '<deleted>');
    inputHash.update('\0');
  }
  const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    /^(npm_config_|pnpm_|PNPM_)/.test(name) || ['NODE_ENV', 'CI', 'NODE_OPTIONS'].includes(name)).sort());
  return `pnpm-${cache}-v1-${process.platform}-${process.arch}-${hash(JSON.stringify({
    directory, filter, checkout: repo, node: process.version, abi: process.versions.modules,
    pnpm: pnpm(['--version'], { encoding: 'utf8' }).trim(),
    image: process.env.ImageOS || os.platform(),
    // Effective config is hashed only, never printed or saved.
    config: pnpm(['config', 'list', '--json'], { encoding: 'utf8' }),
    environment, inputs: inputHash.digest('hex'),
  }))}`;
}

// Trust actions/cache's archive integrity; check completion, layout and the direct
// links/shims callers actually use, without walking/hashing every package byte.
function installationLock() {
  const modulesRoot = join(cwd, 'node_modules');
  const modules = JSON.parse(readFileSync(join(modulesRoot, '.modules.yaml'), 'utf8'));
  if (modules.nodeLinker !== 'isolated' || modules.virtualStoreDir !== '.pnpm' || modules.layoutVersion !== 5) {
    throw new Error('Unexpected pnpm layout; refusing completed-install cache');
  }
  for (const metadata of ['.package-map.json', '.pnpm-workspace-state-v1.json']) {
    JSON.parse(readFileSync(join(modulesRoot, metadata), 'utf8'));
  }
  for (const project of projects) {
    const root = join(repo, project);
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    for (const kind of ['dependencies', 'devDependencies']) {
      if (!modules.included[kind]) continue;
      for (const [name, specifier] of Object.entries(manifest[kind] || {})) {
        const dependency = join(root, 'node_modules', name);
        const installed = JSON.parse(readFileSync(join(dependency, 'package.json'), 'utf8'));
        if (specifier.startsWith('workspace:') && realpathSync(dependency) !== realpathSync(join(repo, 'packages/shared'))) {
          throw new Error('Broken shared workspace link');
        }
        const bins = typeof installed.bin === 'string' ? { [basename(name)]: installed.bin } : installed.bin || {};
        for (const [bin, target] of Object.entries(bins)) {
          if (!existsSync(join(dependency, target)) || !existsSync(join(root, 'node_modules', '.bin', bin + (process.platform === 'win32' ? '.cmd' : '')))) {
            throw new Error(`Missing executable: ${bin}`);
          }
        }
      }
    }
  }
  // Exercise the native esbuild output of the allowed install script, not pnpm.
  const consumer = directory === '.' ? 'packages/teacher/node_modules/vite/package.json' : 'deploy/cloudflare/node_modules/wrangler/package.json';
  createRequire(realpathSync(join(repo, consumer)))('esbuild').transformSync('let n: number = 1', { loader: 'ts' });
  return hash(readFileSync(join(modulesRoot, '.pnpm', 'lock.yaml')));
}

const mode = process.argv[2];
if (mode === 'prepare') {
  output('key', identity());
  output('paths', cache === 'store' ? pnpm(['store', 'path'], { encoding: 'utf8' }).trim() : trees.join('\n'));
} else if (mode === 'validate') {
  let valid = false;
  try {
    if (cache === 'tree') {
      const saved = JSON.parse(readFileSync(receipt, 'utf8'));
      valid = saved.key === process.env.INSTALL_KEY && saved.lock === installationLock();
    }
  } catch {
    // An exact service hit is not sufficient evidence of a complete installation.
  }
  output('valid', String(valid));
  console.log(valid ? 'Validated completed pnpm installation; skipping install.' : 'Frozen install required (store cache or incomplete tree).');
} else if (mode === 'install') {
  if (identity() !== process.env.INSTALL_KEY) throw new Error('Install inputs changed before install');
  // Do not let an incomplete restore mask files missing from the new installation.
  for (const tree of trees) rmSync(tree, { recursive: true, force: true });
  pnpm(['install', '--frozen-lockfile', ...(filter ? ['--filter', filter] : [])], { stdio: 'inherit' });
  const lock = cache === 'tree' ? installationLock() : undefined;
  if (identity() !== process.env.INSTALL_KEY) throw new Error('Install inputs changed during install; refusing cache save');
  if (cache === 'tree') writeFileSync(receipt, JSON.stringify({ key: process.env.INSTALL_KEY, lock }));
  output('save', 'true');
} else {
  throw new Error('Expected prepare, validate, or install');
}
