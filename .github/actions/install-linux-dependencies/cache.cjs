// Cache the tree npm ci actually produces, not Electron's lazily downloaded dist.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const tree = path.resolve('node_modules');
const marker = '.classroom-npm-cache.json';
const output = (name, value) => fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
const npm = (...args) => execFileSync('npm', args, { encoding: 'utf8' }).trim();

function identity() {
  const hash = createHash('sha256');
  const add = (name, value) => hash.update(JSON.stringify([name, value]));
  add('runtime', [process.version, process.versions.modules, npm('--version'), os.platform(), os.arch()]);
  add('image', process.env.ImageOS || fs.readFileSync('/etc/os-release', 'utf8'));
  add('policy', ['npm ci', process.env.ALLOW_INSTALL_FALLBACK === 'true' ? 'npm install fallback' : 'frozen only']);
  // Effective config includes defaults, CLI environment and project/user config.
  // Also hash the raw files: npm masks protected settings in config-list output.
  const config = JSON.parse(npm('config', 'list', '--json'));
  for (const file of ['package.json', 'package-lock.json', '.npmrc', '../../.npmrc', config.userconfig, config.globalconfig,
    path.join(__dirname, 'action.yml'), __filename]) {
    add(file === __filename ? 'implementation' : path.basename(file), fs.existsSync(file) ? fs.readFileSync(file).toString('base64') : null);
  }
  // Locations are not install policy and vary between equivalent checkouts.
  for (const name of ['cache', 'prefix', 'userconfig', 'globalconfig']) delete config[name];
  add('config', Object.keys(config).sort().map(name => [name, config[name]]));
  add('environment', Object.keys(process.env).filter(name => /^(npm_config_|ELECTRON_)/i.test(name)
    || ['NODE_OPTIONS', 'CC', 'CXX', 'CFLAGS', 'CPPFLAGS', 'LDFLAGS', 'PYTHON'].includes(name))
    .sort().map(name => [name, process.env[name]]));
  return `linux-npm-tree-v1-${os.platform()}-${os.arch()}-${hash.digest('hex')}`;
}

function treeDigest() {
  const hash = createHash('sha256');
  let files = 0;
  function visit(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name);
      if (file === path.join(tree, marker)) continue;
      const stat = fs.lstatSync(file);
      hash.update(JSON.stringify([path.relative(tree, file), stat.mode & 0o777]));
      if (stat.isDirectory()) visit(file);
      else if (stat.isSymbolicLink()) { hash.update(fs.readlinkSync(file)); files++; }
      else if (stat.isFile()) { hash.update(createHash('sha256').update(fs.readFileSync(file)).digest()); files++; }
      else throw new Error(`Unsupported cache entry: ${file}`);
    }
  }
  visit(tree);
  if (!files) throw new Error('Empty dependency tree');
  return hash.digest('hex');
}

switch (process.argv[2]) {
  case 'key':
    output('key', identity());
    break;
  case 'seal':
    // A lifecycle script may mutate inputs even after npm ci succeeds.
    if (identity() !== process.env.CACHE_KEY) {
      console.log('Install inputs changed; not saving this tree.');
      output('frozen', 'false');
      break;
    }
    fs.writeFileSync(path.join(tree, marker), JSON.stringify({ key: process.env.CACHE_KEY, digest: treeDigest() }));
    output('frozen', 'true');
    break;
  case 'validate': {
    let valid = false;
    try {
      const saved = JSON.parse(fs.readFileSync(path.join(tree, marker), 'utf8'));
      valid = saved.key === process.env.CACHE_KEY && saved.digest === treeDigest();
    } catch { /* Missing, truncated or incomplete archives must reinstall. */ }
    output('valid', String(valid));
    console.log(valid ? 'Exact dependency tree validated; skipping npm ci.' : 'No valid completed tree; running a clean install.');
    break;
  }
  default:
    throw new Error('Expected key, seal or validate');
}
