#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  seedApiRecord,
  serializeSeedFixtures,
  validateHtmlArtifact,
  validateSeedManifest,
} from './lib/studio-html-artifact.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seedDirectory = path.join(repoRoot, 'examples', 'studio-html');
const manifestPath = path.join(seedDirectory, 'manifest.json');
const fixtureDirectory = path.join(seedDirectory, 'fixtures');

async function loadValidatedSeeds() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const manifestFailures = validateSeedManifest(manifest, { expectedCount: 14 });
  if (manifestFailures.length) throw new Error(`Studio HTML seed validation failed:\n- ${manifestFailures.map((issue) => `manifest: ${issue.message}`).join('\n- ')}`);
  const failures = [];
  const records = [];
  const listedFiles = new Set();
  for (const seed of manifest.seeds ?? []) {
    const sourcePath = path.resolve(seedDirectory, seed.filename ?? '');
    if (path.dirname(sourcePath) !== seedDirectory) {
      failures.push(`${seed.id ?? 'unknown'}: filename escapes examples/studio-html.`);
      continue;
    }
    listedFiles.add(seed.filename);
    let html;
    try {
      html = await readFile(sourcePath, 'utf8');
    } catch {
      failures.push(`${seed.id}: missing source file ${seed.filename}.`);
      continue;
    }
    const result = validateHtmlArtifact(html);
    result.issues.forEach((issue) => failures.push(`${seed.id} [${issue.code}]: ${issue.message}`));
    const title = /<title\b[^>]*>([^<]+)<\/title>/i.exec(html)?.[1].trim();
    const locale = /<html\b[^>]*\blang=["']([^"']+)["']/i.exec(html)?.[1];
    if (title !== seed.title) failures.push(`${seed.id}: manifest title does not match <title>.`);
    if (locale !== seed.locale) failures.push(`${seed.id}: manifest locale does not match <html lang>.`);
    records.push(seedApiRecord(seed, html));
  }
  const sourceFiles = (await readdir(seedDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name);
  sourceFiles.filter((file) => !listedFiles.has(file)).forEach((file) => failures.push(`${file}: HTML source is not listed in the manifest.`));
  if (failures.length) throw new Error(`Studio HTML seed validation failed:\n- ${failures.join('\n- ')}`);
  return { manifest, records };
}

async function packageFixtures() {
  const { manifest, records } = await loadValidatedSeeds();
  await mkdir(fixtureDirectory, { recursive: true });
  const fixtures = serializeSeedFixtures(records);
  await writeFile(path.join(fixtureDirectory, 'ipad-seeds.json'), fixtures.catalogue);
  await writeFile(path.join(fixtureDirectory, 'api-import.ndjson'), fixtures.ndjson);
  console.log(`Packaged ${manifest.seeds.length} seeds for iPad fixtures and generic API import.`);
}

async function verifyFixtures(records) {
  const expected = serializeSeedFixtures(records);
  const [catalogue, ndjson] = await Promise.all([
    readFile(path.join(fixtureDirectory, 'ipad-seeds.json'), 'utf8'),
    readFile(path.join(fixtureDirectory, 'api-import.ndjson'), 'utf8'),
  ]).catch(() => { throw new Error('Packaged fixtures are missing; run the package command.'); });
  if (catalogue !== expected.catalogue || ndjson !== expected.ndjson) {
    throw new Error('Packaged fixtures are stale; run the package command.');
  }
}

async function importSeeds() {
  const endpoint = option('--endpoint') ?? process.env.STUDIO_HTML_IMPORT_ENDPOINT;
  if (!endpoint) throw new Error('Provide --endpoint URL or STUDIO_HTML_IMPORT_ENDPOINT.');
  const { records } = await loadValidatedSeeds();
  const token = process.env.STUDIO_HTML_IMPORT_TOKEN;
  for (const record of records) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(record),
    });
    if (!response.ok) throw new Error(`Import failed for ${record.seedId}: HTTP ${response.status}.`);
    console.log(`Imported ${record.seedId}.`);
  }
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const command = process.argv[2] ?? 'validate';
try {
  if (command === 'validate') {
    const { manifest, records } = await loadValidatedSeeds();
    await verifyFixtures(records);
    console.log(`Validated ${manifest.seeds.length} self-contained Studio HTML seeds.`);
  } else if (command === 'package') await packageFixtures();
  else if (command === 'import') await importSeeds();
  else throw new Error('Usage: node scripts/studio-html-seeds.mjs validate|package|import [--endpoint URL]');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
