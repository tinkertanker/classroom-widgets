import fs from 'fs';
const S = '/tmp/claude-0/-home-user-classroom-widgets/1019d9be-4c14-5465-b2e2-1ffcd8946341/scratchpad';
const r3b = JSON.parse(fs.readFileSync(`${S}/r3b-args.json`, 'utf8'));
const base = r3b.brief.split('## ROUND 3')[0];
const hamRule = r3b.brief.slice(r3b.brief.indexOf('- THE HAMSTER MUST BE'), r3b.brief.indexOf('- Optional but valued'));

const brief = `${base}## FINALS (round 4) — what 243 evaluator verdicts converged on (binding)
Round-3 results (nine evaluators, no numerals anywhere): 1st "Rainbow Countdown Sticker" (slug master, 7.2) — the rainbow ring as a die-cut sticker with the SPENT TIME CUT OUT of the sticker as a notch/bite at upper-left, so the silhouette stays closed and the notch can widen live in the menu bar. 2nd "Hamster at Home" (mascot, 6.7) — the app's own hamster big on the cream face inside the ring: the most ownable and loved, but its glyph failed. Read their sheets: ${S}/sheets/r3-master.png, ${S}/sheets/r3-mascot.png, ${S}/sheets/r3-hamcap.png and the overview ${S}/sheets/r3-overview.png. Their SVG source is in ${S}/round3.json (array of {slug, icon, iconDark, iconSmall, glyph}) — extract with node and build on it rather than starting from zero.
What every evaluator asked for:
- COLOUR: the six hard-jointed flat bands read as a donut chart, colour picker, Google One / Google G, or Pride flag. Replace with a WARM CONTINUOUS SWEEP derived from the app's real ring (timer.tsx uses a red→orange→yellow→green→cyan→blue→magenta gradient) but warmed and de-neoned: coral → tangerine → marigold → leaf → teal/sky → violet, blended smoothly with no hard joins, never Google primaries, never a glowing halo. The white die-cut rim is load-bearing for colour-blind users (red/green vs amber is only ΔE 4 under deutan) — keep it at every size including 16px.
- SILHOUETTE: the notch is the idea. Make it a clear, deliberate, squarer wedge (≈100–120°) bridged by a thin closing track so the outline stays closed (no C, spinner, refresh arrow). Draw the die-cut as a constant-width offset with no pinch where it wraps the round caps. No cool mint track in the notch — use pale cream/warm grey.
- GLYPH, pixel-fitted: in round 3 the glyphs were too heavy (a lumpy donut outweighing Wi-Fi/battery) or too detailed (eyes, feet, tails). Draw the glyph for a 16px grid (1 px = 64 units): band ≈ 3 px (≈190 units) — SF Symbols regular weight, roughly 12% of the diameter, clearly lighter than round 3; notch step ≥ 3 px deep; closing bridge a full 2 px (128 units) so it never greys out; interior counter ≥ 6 px; snap major edges to multiples of 64 units. Closed outer outline. Nothing smaller than 2 px. One solid tone.
- HAMSTER in glyphs: never a head-with-two-round-ears (reads as Mickey Mouse) and never knocked-out dot eyes (read as a skull/ghost). Use a purpose-built SIDE PROFILE silhouette: rounded body, big round head at the front, ONE ear bump, stubby feet fused into the base, and the CURLY TAIL as the signature. Colour icons still embed the app's exact hamster markup.
- PER-SIZE ART is allowed and expected (.ico/.icns frames hold different drawings): full art at 64px+, the SMALL master (16–32) simplified and flat.
- Live menu-bar state: describe how the glyph behaves while a timer runs (notch widening) and at time's up.
- macOS 26 tinted/clear appearances strip colour: the silhouette alone must carry identity.
${hamRule}
## Non-negotiables
- Colour icon, dark icon, small master and glyph are ONE mark. Glyph: viewBox 0 0 1024 1024, #000 fills only, one solid tone, no gradients/filters/opacity; strokes only as stroke="#000" fill="none".
- Icons: viewBox 0 0 1024 1024, self-contained, no text and no numerals. Hero inside the 80% maskable circle.
- CRITICAL: prefix ids — icon "{{SLUG}}-", iconDark "{{SLUG}}d-", iconSmall "{{SLUG}}s-", glyph "{{SLUG}}g-".`;

const directions = [
  { slug: 'notch4', title: 'Countdown Sticker — the panel winner, final', brief: `Take "master" to final, pure ring, no creature: the notched die-cut rainbow sticker with an empty cream face on the amber plate (≤2 flat facets, cream outline so it separates on the app's own amber canvas). Apply every note above: warm continuous sweep, constant-width die-cut, deeper squarer bite with a closing track, pixel-fitted glyph at SF Symbols regular weight that reads as "a ring with time cut out of it" at true 16px, and a flat small master. This is the "impeccable and safe" finalist — it must be the best-crafted ring anyone has seen.` },
  { slug: 'hamnotch4', title: 'The hamster ate the spent time', brief: `The panel's favourite merge: master's notched die-cut sticker, with the app's own hamster (embedded markup, big enough to read at 64px — roughly a quarter of the ring's diameter) running along the thin closing track inside the bite, heading toward the leading cap as if it has just run (or nibbled) the spent time away. The hamster breaks the sticker's outer silhouette slightly, so the character is part of the outline. Empty cream face. Glyph: the notched ring with the purpose-built side-profile hamster (one ear, curly tail, no eyes) sitting in the bite on the closing track, separated from the ring's caps by ≥100-unit knockouts — it must read as a timer ring first and a hamster second at 16px, and never as a ring with a lump. Small master: ring + a flat simplified hamster (or ring alone at 16 if the hamster turns to mush — say which).` },
  { slug: 'mascot4', title: 'Hamster at Home — final', brief: `Take "mascot" to final: the app's exact hamster (embedded markup) sitting large and centred on the cream face, about 10% smaller than round 3 so it has breathing room, inside master's CLOSED notched die-cut ring (no open arc). Drop the heavy cream halo around the plate. It should read "the timer with the hamster", not "pet app": the ring must be substantial and clearly a countdown (the notch). Small master: ring + a flat, simplified hamster (no feet/eye glints, 2px features). Glyph: the closed notched ring with the purpose-built side-profile hamster knocked out of (or sitting solid inside) the face — one ear, curly tail, no eyes — with ≥2px separation from the ring at 16px.` },
];

let s = fs.readFileSync(`${S}/design-workflow.js`, 'utf8').replace(/\bargs\./g, 'A.');
const i = s.indexOf('\n', s.indexOf('}\n', s.indexOf('export const meta')));
s = s.slice(0, i + 1) + 'const A = ' + JSON.stringify({ round: 4, brief, directions }) + ';\n' + s.slice(i + 1);
s = s.replace("name: 'icon-system-round'", "name: 'icon-system-finals'").replace('Nine designers each craft one universal icon-system concept', 'Three finalist designers refine the panel-winning icon systems');
fs.writeFileSync(`${S}/design-r4.js`, s);
console.log(brief.length, hamRule.length);
