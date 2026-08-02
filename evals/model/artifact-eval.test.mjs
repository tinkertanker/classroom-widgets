import assert from 'node:assert/strict';
import test from 'node:test';
import { assessArtifact, parseProviderArtifact } from './artifact-eval.mjs';

const html = '<!doctype html><html lang="ms-SG"><head><meta name="viewport" content="width=device-width"><title>Kosa kata</title><style>button{min-height:44px}</style></head><body><p>buku dan meja</p><select><option>Padan</option></select><button id="reset">Tetapkan semula</button><script>reset.onclick=()=>{}</script></body></html>';

test('parses plain and fenced provider JSON', () => {
  assert.equal(parseProviderArtifact(JSON.stringify({ html })).html, html);
  assert.deepEqual(parseProviderArtifact(`\`\`\`json\n${JSON.stringify({ html, designCard: { layout: 'cards' } })}\n\`\`\``).designCard, { layout: 'cards' });
});

test('runs basic, locale, content, and interaction checks together', () => {
  const result = assessArtifact({ html }, { locale: 'ms-SG', contentTerms: ['buku', 'meja'], expectedInteractions: ['matching', 'reset'] });
  assert.equal(result.valid, true);
  assert.equal(result.checks.length, 5);
});

test('reports malformed output and absent requested behavior', () => {
  assert.equal(assessArtifact('not json').issues[0].code, 'provider-output');
  const result = assessArtifact({ html }, { expectedInteractions: ['timer', 'pause'] });
  assert.deepEqual(result.issues.map((issue) => issue.code), ['missing-interaction', 'missing-interaction']);
});
