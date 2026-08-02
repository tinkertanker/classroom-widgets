import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import {
  seedApiRecord,
  serializeSeedFixtures,
  validateHtmlArtifact,
  validateSeedManifest,
} from './lib/studio-html-artifact.mjs';

const validHtml = '<!doctype html><html lang="en-SG"><head><meta name="viewport" content="width=device-width"><title>Test</title><style>button{min-height:44px}</style></head><body><button>Try</button><script>document.querySelector("button").onclick=()=>{}</script></body></html>';

test('validates a complete self-contained artifact', () => {
  assert.deepEqual(validateHtmlArtifact(validHtml).issues, []);
  assert.deepEqual(
    validateHtmlArtifact(validHtml.replace('</body>', '<img src="assets/image-1" alt="Diagram"></body>')).issues,
    [],
    'managed teacher images are valid relative resources',
  );
});

test('rejects external dependencies, network calls, and invalid JavaScript', () => {
  const html = validHtml
    .replace('<body>', '<body><script src="https://cdn.example/a.js"></script>')
    .replace('document.querySelector("button").onclick=()=>{}', 'fetch("/data")\nlet =');
  const codes = validateHtmlArtifact(html).issues.map((issue) => issue.code);
  assert.ok(codes.includes('external-script'));
  assert.ok(codes.includes('network'));
  assert.ok(codes.includes('javascript-syntax'));
});

test('allows comments but rejects overlooked network and resource paths', () => {
  assert.equal(validateHtmlArtifact(validHtml.replace('document.', '// local interaction\ndocument.')).valid, true);
  for (const snippet of [
    '<form action="/collect"></form>',
    '<img srcset="small.png 1x, large.png 2x">',
    '<style>.hero{background:url(/image.png)}</style>',
    '<script>navigator.sendBeacon("/collect")</script>',
  ]) {
    const result = validateHtmlArtifact(validHtml.replace('</body>', `${snippet}</body>`));
    assert.equal(result.valid, false, snippet);
  }
});

test('validates manifest uniqueness and required metadata', () => {
  const seed = { id: 'stable-id', filename: 'stable-id.html', title: 'Title', summary: 'Summary', subject: 'science', level: 'secondary', locale: 'en-SG', learningObjective: 'Learn', tags: ['a', 'b', 'c'], interactionPattern: 'quiz', descriptor: 'Card', designCard: { layout: 'one screen' } };
  assert.deepEqual(validateSeedManifest({ schemaVersion: '1.0', seeds: [seed] }), []);
  const issues = validateSeedManifest({ schemaVersion: '1.0', seeds: [seed, { ...seed }] });
  assert.equal(issues.filter((issue) => issue.code === 'duplicate').length, 3);
  assert.equal(validateSeedManifest({ schemaVersion: '1.0', seeds: [seed] }, { expectedCount: 14 })[0].code, 'seed-count');
  assert.equal(validateSeedManifest({ schemaVersion: '1.0', seeds: [{ ...seed, tags: Array(21).fill('tag') }] })[0].code, 'tags');
  assert.equal(validateSeedManifest({ schemaVersion: '1.0', seeds: [{ ...seed, tags: ['a', 'b', 'x'.repeat(51)] }] })[0].code, 'tags');
});

test('builds a backend-neutral API record', () => {
  const record = seedApiRecord({ id: 'seed', title: 'Title', summary: 'Summary', subject: 'science', level: 'secondary', locale: 'en-SG', learningObjective: 'Learn', tags: ['one'], interactionPattern: 'quiz', descriptor: 'Compact', designCard: { accent: 'blue' } }, validHtml);
  assert.equal(record.seedId, 'seed');
  assert.equal(record.artifact.html, validHtml);
  assert.deepEqual(record.artifact.designCard, { accent: 'blue' });
  const fixtures = serializeSeedFixtures([record]);
  assert.equal(JSON.parse(fixtures.catalogue).seeds[0].seedId, 'seed');
  assert.equal(JSON.parse(fixtures.ndjson).seedId, 'seed');
});

test('all curated seeds initialise without browser errors', async () => {
  const directory = path.resolve('examples/studio-html');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.html'));
  assert.equal(files.length, 14);
  for (const file of files) {
    const errors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', (error) => errors.push(error));
    virtualConsole.on('error', (error) => errors.push(error));
    const dom = new JSDOM(await readFile(path.join(directory, file), 'utf8'), {
      runScripts: 'dangerously',
      url: 'https://artifact.invalid/',
      virtualConsole,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    dom.window.close();
    assert.deepEqual(errors, [], file);
  }
});
