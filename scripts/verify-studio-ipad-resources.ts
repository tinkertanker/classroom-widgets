import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { validateWidgetSpec, type WidgetSpec } from '../packages/widget-spec/src/index.js';

const familyMap = {
  'quiz-retrieval': 'quiz',
  'matching-sorting-sequencing': 'matching',
  'diagram-hotspots': 'diagram',
  'graph-simulation': 'simulation',
  'ready-tools': 'classroomTool',
} as const;

type CorpusFamily = keyof typeof familyMap;

interface CorpusEntry {
  file: string;
  family: CorpusFamily;
}

interface SampleWidgetRecord {
  family: (typeof familyMap)[CorpusFamily];
  spec: WidgetSpec;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playerDirectory = path.join(repoRoot, 'apps', 'widget-player');
const bundledPlayerDirectory = path.join(repoRoot, 'apps', 'ipad', 'Resources', 'widget-player');
const bundledCataloguePath = path.join(
  repoRoot,
  'apps',
  'ipad',
  'Resources',
  'Fixtures',
  'sample-widgets.json',
);
const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'classroom-widgets-player-'));
  try {
    const temporaryBuildDirectory = path.join(temporaryDirectory, 'dist');
    await execFileAsync(
      path.join(repoRoot, 'node_modules', '.bin', 'vite'),
      ['build', '--outDir', temporaryBuildDirectory, '--emptyOutDir'],
      { cwd: playerDirectory },
    );
    await verifyDirectoryParity(temporaryBuildDirectory, bundledPlayerDirectory);

    const expectedCatalogue = await buildValidatedCatalogue();
    const bundledCatalogue = await readFile(bundledCataloguePath);
    if (!bundledCatalogue.equals(expectedCatalogue)) {
      throw new Error(
        'The bundled iPad example catalogue does not match the canonically validated Studio corpus.',
      );
    }

    process.stdout.write(
      'Studio iPad resources match the current widget-player build and validated example catalogue.\n',
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function buildValidatedCatalogue(): Promise<Buffer> {
  const manifestPath = path.join(repoRoot, 'evals', 'widget-spec', 'corpus.json');
  const manifest: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
  const entries = corpusEntries(manifest);
  const records: SampleWidgetRecord[] = [];

  for (const entry of entries) {
    const sourcePath = path.resolve(repoRoot, entry.file);
    if (!sourcePath.startsWith(`${repoRoot}${path.sep}`)) {
      throw new Error(`Corpus entry escapes the repository: ${entry.file}`);
    }
    const source: unknown = JSON.parse(await readFile(sourcePath, 'utf8'));
    const validation = validateWidgetSpec(source);
    if (!validation.valid) {
      const detail = validation.errors
        .map((issue) => `${issue.path} [${issue.code}] ${issue.message}`)
        .join('\n');
      throw new Error(`Cannot bundle invalid WidgetSpec ${entry.file}:\n${detail}`);
    }
    if (validation.value.assets.length > 0) continue;
    records.push({ family: familyMap[entry.family], spec: validation.value });
  }

  if (records.length < 10) {
    throw new Error(`Expected at least 10 validated asset-free Studio examples; found ${records.length}.`);
  }

  return Buffer.from(`${JSON.stringify(records, null, 2)}\n`);
}

function corpusEntries(manifest: unknown): CorpusEntry[] {
  if (!isRecord(manifest) || !Array.isArray(manifest.cases)) {
    throw new Error('The WidgetSpec corpus manifest must contain a cases array.');
  }
  return manifest.cases.map((candidate, index) => {
    if (
      !isRecord(candidate) ||
      typeof candidate.file !== 'string' ||
      typeof candidate.family !== 'string' ||
      !(candidate.family in familyMap)
    ) {
      throw new Error(`WidgetSpec corpus case ${index + 1} has an invalid file or family.`);
    }
    return { file: candidate.file, family: candidate.family as CorpusFamily };
  });
}

async function verifyDirectoryParity(expectedDirectory: string, actualDirectory: string): Promise<void> {
  const [expected, actual] = await Promise.all([
    directoryFiles(expectedDirectory),
    directoryFiles(actualDirectory),
  ]);
  const missing = [...expected.keys()].filter((file) => !actual.has(file));
  const unexpected = [...actual.keys()].filter((file) => !expected.has(file));
  const changed = [...expected].flatMap(([file, contents]) => {
    const bundled = actual.get(file);
    return bundled && !bundled.equals(contents) ? [file] : [];
  });
  if (missing.length === 0 && unexpected.length === 0 && changed.length === 0) return;

  const details = [
    ...missing.map((file) => `missing: ${file}`),
    ...unexpected.map((file) => `unexpected: ${file}`),
    ...changed.map((file) => `changed: ${file}`),
  ];
  throw new Error(
    `The bundled iPad widget player differs from the current source build:\n${details.join('\n')}`,
  );
}

async function directoryFiles(directory: string, prefix = ''): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  const entries = await readdir(path.join(directory, prefix), { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      const descendants = await directoryFiles(directory, relativePath);
      descendants.forEach((contents, file) => files.set(file, contents));
    } else if (entry.isFile()) {
      files.set(relativePath, await readFile(path.join(directory, relativePath)));
    } else {
      throw new Error(`Unsupported generated resource entry: ${relativePath}`);
    }
  }
  return files;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\nRun npm run ipad:prepare to refresh generated iPad resources.\n`);
  process.exitCode = 1;
});
