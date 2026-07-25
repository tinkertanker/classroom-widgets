import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createClassCode,
  parseClassNumber,
  parseMaximumUses,
} from './studio-class-code.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serviceDirectory = resolve(repositoryRoot, 'services/studio-api');
const outputDirectory = resolve(repositoryRoot, '.studio-class-codes');
const usage = 'Usage: npm run provision:studio-class -- <4-digit class number> <maximum uses 1-100> [ISO expiry]';
const classNumber = parseClassNumber(process.argv[2], usage);
const maximumUses = parseMaximumUses(process.argv[3], usage);
const expiresAt = process.argv[4] ?? '2026-09-30T15:59:59.000Z';
const outputPath = resolve(outputDirectory, `${classNumber}.txt`);

if (existsSync(outputPath)) {
  throw new Error(`${outputPath} already exists. Preserve it, or move it to the Trash before rotating this class code.`);
}
if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
  throw new Error('The class-code expiry must be a future ISO-8601 date.');
}

function codeHash(code) {
  return createHash('sha256').update(`class-code:${code}`).digest('hex');
}
function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const code = createClassCode(classNumber);
const label = `Class ${classNumber}`;
const createdAt = new Date().toISOString();
const statement =
  `INSERT INTO class_codes (code_hash, label, maximum_uses, expires_at, created_at) VALUES (` +
  `${sqlString(codeHash(code))}, ${sqlString(label)}, ${maximumUses}, ${sqlString(expiresAt)}, ${sqlString(createdAt)});`;

const contents = [
  '# Classroom Widgets Studio class code',
  `# Class: ${classNumber}`,
  `# Maximum activations: ${maximumUses}`,
  `# Expires: ${expiresAt}`,
  '# Share only with this class. Each iPad activation consumes one use.',
  '',
  code,
  '',
].join('\n');

mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
writeFileSync(outputPath, contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' });

const result = spawnSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'DB', '--remote', '--profile', 'tinkertanker', '--command', statement],
  { cwd: serviceDirectory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);
if (result.status !== 0) {
  throw new Error(
    `Could not provision the remote class code. The unprovisioned code remains protected at ${outputPath}.\n` +
    `${result.stderr || result.stdout}`,
  );
}
console.log(`Provisioned class ${classNumber} with a maximum of ${maximumUses} activations.`);
console.log(`The code was written with owner-only permissions to ${outputPath}`);
