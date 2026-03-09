const path = require('path');
const { spawnSync } = require('child_process');

const serverRoot = path.resolve(__dirname, '..');
const probeScript = "require('./src/sockets/socketManager');process.exit(0);";

const result = spawnSync(process.execPath, ['--trace-warnings', '-e', probeScript], {
  cwd: serverRoot,
  encoding: 'utf8',
  timeout: 5000
});

const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();

if (result.error) {
  console.error('Startup smoke check failed to execute:', result.error.message);
  process.exit(1);
}

if (result.signal === 'SIGTERM') {
  console.error('Startup smoke check timed out while probing socket startup.');
  if (output) {
    console.error(output);
  }
  process.exit(1);
}

if (result.status !== 0) {
  console.error('Startup smoke check exited with a non-zero status.');
  if (output) {
    console.error(output);
  }
  process.exit(result.status || 1);
}

if (/inside circular dependency/i.test(output)) {
  console.error('Startup smoke check detected a circular dependency warning:');
  console.error(output);
  process.exit(1);
}

console.log('Startup smoke check passed: no circular dependency warnings detected.');
