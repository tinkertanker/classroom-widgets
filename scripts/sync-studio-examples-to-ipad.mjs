import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const manifest = JSON.parse(
  await readFile(path.join(root, 'evals', 'widget-spec', 'corpus.json'), 'utf8'),
);
const familyMap = {
  'quiz-retrieval': 'quiz',
  'matching-sorting-sequencing': 'matching',
  'diagram-hotspots': 'diagram',
  'graph-simulation': 'simulation',
  'ready-tools': 'classroomTool',
};

const records = [];
for (const entry of manifest.cases) {
  const family = familyMap[entry.family];
  if (!family) continue;
  const spec = JSON.parse(await readFile(path.join(root, entry.file), 'utf8'));
  if (spec.assets.length > 0) continue;
  records.push({ family, spec });
}

if (records.length < 10) {
  throw new Error(`Expected at least 10 asset-free Studio examples; found ${records.length}.`);
}

const destination = path.join(
  root,
  'apps',
  'ipad',
  'Resources',
  'Fixtures',
  'sample-widgets.json',
);
await writeFile(destination, `${JSON.stringify(records, null, 2)}\n`);
process.stdout.write(`Synced ${records.length} validated Studio examples to the iPad gallery.\n`);
