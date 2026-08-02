import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateHtmlArtifact,
  validateSeedManifest,
} from './lib/studio-html-artifact.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(repoRoot, 'examples', 'studio-html');
const destinationDirectory = path.join(repoRoot, 'apps', 'ipad', 'Resources', 'Examples');
const manifest = JSON.parse(
  await readFile(path.join(sourceDirectory, 'manifest.json'), 'utf8'),
);

const manifestIssues = validateSeedManifest(manifest, { expectedCount: 14 });
if (manifestIssues.length > 0) {
  throw new Error(
    `Cannot bundle invalid Studio seed manifest:\n${manifestIssues
      .map((issue) => `- ${issue.message}`)
      .join('\n')}`,
  );
}

await mkdir(destinationDirectory, { recursive: true });
const expectedFiles = new Set(['manifest.json']);
const records = [];

for (const seed of manifest.seeds) {
  const sourcePath = path.resolve(sourceDirectory, seed.filename);
  if (path.dirname(sourcePath) !== sourceDirectory) {
    throw new Error(`Studio seed filename escapes its source directory: ${seed.filename}`);
  }
  const html = await readFile(sourcePath, 'utf8');
  const validation = validateHtmlArtifact(html);
  if (!validation.valid) {
    throw new Error(
      `Cannot bundle invalid Studio HTML seed ${seed.id}:\n${validation.issues
        .map((issue) => `- [${issue.code}] ${issue.message}`)
        .join('\n')}`,
    );
  }

  expectedFiles.add(seed.filename);
  await copyFile(sourcePath, path.join(destinationDirectory, seed.filename));
  records.push({
    id: seed.id,
    title: seed.title,
    summary: seed.summary,
    subject: seed.subject,
    level: seed.level,
    locale: seed.locale,
    learningObjective: seed.learningObjective,
    tags: seed.tags,
    htmlFile: seed.filename,
  });
}

for (const entry of await readdir(destinationDirectory, { withFileTypes: true })) {
  if (entry.isFile() && !expectedFiles.has(entry.name)) {
    await rm(path.join(destinationDirectory, entry.name));
  }
}

await writeFile(
  path.join(destinationDirectory, 'manifest.json'),
  `${JSON.stringify(records, null, 2)}\n`,
);
process.stdout.write(`Synced ${records.length} Studio HTML examples to the iPad gallery.\n`);
