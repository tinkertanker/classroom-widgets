// Aggregate evaluator results: node aggregate.mjs evalN.json roundN.json
import fs from 'fs';
const [,, evalPath, roundPath] = process.argv;
const evals = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
const concepts = JSON.parse(fs.readFileSync(roundPath, 'utf8'));
const crit = ['distinctiveness', 'brandFit', 'glyphLegibility', 'smallSize', 'crossPlatform', 'originality', 'overall'];

const table = concepts.map(c => {
  const rows = evals.map(e => e.evaluations.find(x => x.slug === c.slug)).filter(Boolean);
  const avg = k => rows.length ? rows.reduce((s, r) => s + r[k], 0) / rows.length : 0;
  const top3 = evals.filter(e => e.top3.includes(c.slug)).length;
  const firsts = evals.filter(e => e.top3[0] === c.slug).length;
  return { slug: c.slug, name: c.name, n: rows.length, top3, firsts, ...Object.fromEntries(crit.map(k => [k, +avg(k).toFixed(2)])) };
}).sort((a, b) => b.overall - a.overall);

console.log('slug'.padEnd(9) + 'name'.padEnd(26) + crit.map(k => k.slice(0, 7).padEnd(8)).join('') + 'top3 firsts');
for (const t of table) console.log(t.slug.padEnd(9) + t.name.slice(0, 25).padEnd(26) + crit.map(k => String(t[k]).padEnd(8)).join('') + `${t.top3}    ${t.firsts}`);

console.log('\n=== GENERAL NOTES ===');
for (const e of evals) console.log(`[${e.lens}] top3=${e.top3.join(',')}\n  ${e.general}\n`);

console.log('=== PER-CONCEPT VERDICTS & RIFFS ===');
for (const t of table) {
  console.log(`\n## ${t.slug} — ${t.name} (overall ${t.overall})`);
  for (const e of evals) {
    const r = e.evaluations.find(x => x.slug === t.slug);
    if (r) console.log(`  [${e.lens} ${r.overall}] ${r.verdict}\n     ↳ riff: ${r.riff}`);
  }
}
fs.writeFileSync(evalPath.replace('.json', '-table.json'), JSON.stringify(table, null, 2));
