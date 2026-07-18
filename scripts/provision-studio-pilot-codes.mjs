import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serviceDirectory = resolve(repositoryRoot, 'services/studio-api');
const outputPath = resolve(repositoryRoot, '.studio-pilot-codes.txt');
const requestedCount = Number.parseInt(process.argv[2] ?? '25', 10);
const expiresAt = process.argv[3] ?? '2026-09-30T15:59:59.000Z';

if (!Number.isSafeInteger(requestedCount) || requestedCount < 1 || requestedCount > 100) {
  throw new Error('Usage: npm run provision:studio-pilot -- [1-100] [ISO expiry]');
}
if (existsSync(outputPath)) {
  throw new Error(`${outputPath} already exists. Preserve it, or move it to the Trash before provisioning a replacement set.`);
}
if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
  throw new Error('The pilot-code expiry must be a future ISO-8601 date.');
}

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function codePart(length) {
  const bytes = randomBytes(length);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}
function makeCode() {
  return `CW-AUG26-${codePart(4)}-${codePart(4)}`;
}
function codeHash(code) {
  return createHash('sha256').update(`pilot-code:${code}`).digest('hex');
}
function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const teacherCodes = Array.from({ length: requestedCount }, (_, index) => ({
  code: makeCode(),
  label: `August pilot teacher ${String(index + 1).padStart(2, '0')}`,
  maximumUses: 1,
}));
const smokeCode = {
  code: makeCode(),
  label: 'Automated live verification',
  maximumUses: 100,
};
const allCodes = [...teacherCodes, smokeCode];
const createdAt = new Date().toISOString();
const statements = allCodes.map(({ code, label, maximumUses }) =>
  `INSERT INTO pilot_codes (code_hash, label, maximum_uses, expires_at, created_at) VALUES (` +
  `${sqlString(codeHash(code))}, ${sqlString(label)}, ${maximumUses}, ${sqlString(expiresAt)}, ${sqlString(createdAt)});`,
);

const contents = [
  '# Classroom Widgets Studio — August 2026 pilot access codes',
  `# Expires: ${expiresAt}`,
  '# Give each teacher one unused code. The final code is reserved for live verification.',
  '',
  ...teacherCodes.map(({ code }, index) => `${String(index + 1).padStart(2, '0')}. ${code}`),
  '',
  `SMOKE. ${smokeCode.code}`,
  '',
].join('\n');
writeFileSync(outputPath, contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' });

const result = spawnSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'DB', '--remote', '--profile', 'default', '--command', statements.join('\n')],
  { cwd: serviceDirectory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);
if (result.status !== 0) {
  throw new Error(
    `Could not provision remote pilot codes. The unprovisioned codes remain protected at ${outputPath}.\n` +
    `${result.stderr || result.stdout}`,
  );
}
console.log(`Provisioned ${teacherCodes.length} one-use pilot codes and one smoke-test code.`);
console.log(`Codes were written with owner-only permissions to ${outputPath}`);
