// Builds the final presentation page: node build-page.mjs -> icon-finals.html
import fs from 'fs';
const here = p => new URL(p, import.meta.url);
const S = '/tmp/claude-0/-home-user-classroom-widgets/1019d9be-4c14-5465-b2e2-1ffcd8946341/scratchpad';
const final = JSON.parse(fs.readFileSync(here('./final.json'), 'utf8'));
const r4 = JSON.parse(fs.readFileSync(`${S}/round4.json`, 'utf8'));
const table = JSON.parse(fs.readFileSync(`${S}/eval4-table.json`, 'utf8'));
const by = Object.fromEntries(final.map(c => [c.slug, c]));
const r4by = Object.fromEntries(r4.map(c => [c.slug, c]));
const tb = Object.fromEntries(table.map(t => [t.slug, t]));

const uri = s => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;
const fullBleed = (svg, slug) => {
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><clipPath id="${slug}-fbclip"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath></defs><g transform="translate(-124.27 -124.27) scale(1.2427)"><g clip-path="url(#${slug}-fbclip)">${inner}</g></g></svg>`;
};
// inline glyph that follows the text colour; ids re-prefixed per use so masks never collide
let gcount = 0;
const glyph = (c, size, cls = '') => {
  const n = ++gcount;
  const svg = c.glyph.replaceAll('#000', 'currentColor').replace(/id="([^"]+)"/g, `id="$1-${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-${n})`);
  return svg.replace('<svg ', `<svg class="gl ${cls}" width="${size}" height="${size}" aria-hidden="true" `);
};
const img = (svg, size, alt, cls = '') => `<img class="${cls}" src="${uri(svg)}" width="${size}" height="${size}" alt="${alt}">`;

const menubar = (c, mode) => `<div class="bar mac ${mode}"><span class="apple"></span><b>Finder</b><span>File</span><span>Edit</span><span>View</span><span class="rt">${glyph(c, 18)}<span class="sys wifi"></span><span class="sys batt"></span><span>Tue 9:41</span></span></div>`;
const taskbar = c => `<div class="bar win"><span class="rt"><span class="caret">⌃</span>${glyph(c, 16)}<span>ENG</span><span>9:41 AM</span></span></div>`;
const gnome = c => `<div class="bar gnome"><span>Activities</span><span class="mid">Tue 9:41</span><span class="rt">${glyph(c, 16)}<span class="sys wifi"></span></span></div>`;

const options = [
  {
    c: by.hamster, rank: 'Recommended', from: 'Hamster at Home + Countdown Sticker',
    scores: [['mascot4', 'Hamster at Home'], ['notch4', 'Countdown Sticker']],
    why: [
      'Most of the panel landed on this pairing on their own. The Mac, art-director, brand and system reviewers all asked for the hamster as the big icon and the plain notched ring for small sizes and the menu bar.',
      'The hamster is the one thing no competitor can claim. It is the app\'s own drawing, copied exactly from creatures.tsx, so teachers see the same character in the Dock and on the board.',
      'Below 64px the hamster becomes two circles, a big orange body and a smaller tan head, facing right like the full drawing. The menu-bar item is the same two circles as a silhouette inside the notched ring, so the hamster is there at every size.',
    ],
    quote: ['“The best colour icon here. The app\'s exact hamster, large and calm in the face of a warm notched rainbow sticker, reads instantly as ‘the hamster timer’.”', 'macOS reviewer'],
    watch: 'At a true 16px on a non-retina screen the two circles merge into one rounded shape; the body-and-head silhouette shows from 20px and on every retina menu bar. Some reviewers also felt a big hamster tips it towards “kids’ pet game”, so the ring stays thick and the notch visible.',
  },
  {
    c: by.countdown, rank: 'Highest scored', from: 'Countdown Sticker',
    scores: [['notch4', 'Countdown Sticker']],
    why: [
      'Top score in the final (7.0) and first choice for four of nine reviewers. It is the most accessible and the most “Apple-grade” system: one object, one idea.',
      'The time already spent is cut out of the sticker, so the silhouette carries the meaning with no colour at all. That matters in macOS 26 tinted and clear modes and in colour-blind simulation.',
      'The menu-bar item can count down live: the notch widens while a timer runs and only the thin track is left at time’s up.',
    ],
    quote: ['“This is the only concept whose silhouette carries an idea: the spent time is literally cut out.”', 'art-director reviewer (round 3)'],
    watch: 'It has no character, and a bare rainbow ring can be mistaken for a colour picker or an AI gradient. Using the app’s own left-to-right ring gradient instead of a colour wheel helps.',
  },
  {
    c: by.goldstar, rank: 'Your pick, refined', from: 'Gold Star Timer',
    scores: [['star3', 'Gold Star Timer']],
    why: [
      'Second in the final (6.7) and in eight of nine reviewers’ top three, tied with Countdown Sticker. The star is the most “classroom” thing in the set: a reward slapped on the timer.',
      'Following the Mac reviewer’s note, the star now sits in the spent part of the ring at upper left. It fills the gap where the time has gone and stays out of the Dock’s badge corner.',
      'The star is drawn fresh. The old one came from an icon font, which the risk reviewer flagged before any trademark filing.',
    ],
    quote: ['“The star is the only add-on that survives as a 16px white tray glyph.”', 'Windows/Linux reviewer'],
    watch: 'At a true 16px the star becomes a small spark next to the ring. In the round-4 version it read as a refresh arrow, so the ring now stays closed and the star sits clear of it.',
  },
];

const scoreRow = t => `<span class="score"><b>${t.overall.toFixed(1)}</b><small>/10 · top 3 for ${t.top3} of 9</small></span>`;

const card = (o, i) => {
  const c = o.c;
  return `<section class="opt" id="${c.slug}">
  <header class="opt-h">
    <span class="tag ${i === 0 ? 'hot' : ''}">${o.rank}</span>
    <h2>${c.name}</h2>
    <p class="lede">${c.tagline}</p>
  </header>
  <div class="spec">
    <figure class="hero">${img(c.icon, 280, `${c.name} app icon`)}<figcaption>macOS app icon</figcaption></figure>
    <div class="surfaces">
      <figure class="tile dk">${img(c.iconDark, 112, 'dark appearance')}<figcaption>Dark</figcaption></figure>
      <figure class="tile">${img(fullBleed(c.icon, c.slug), 104, 'full-bleed', 'fb')}<figcaption>Windows · Linux · PWA</figcaption></figure>
      <figure class="tile glyphbig">${glyph(c, 104)}<figcaption>Menu-bar glyph</figcaption></figure>
      <figure class="tile ladder"><div>${img(c.icon, 64, '64px')}${img(c.iconSmall, 32, '32px')}${img(c.iconSmall, 16, '16px')}</div><figcaption>64 · 32 · 16</figcaption></figure>
      <figure class="tile tabs"><div class="tabbar"><span class="t on">${img(c.iconSmall, 16, 'favicon')}Classroom Widgets</span><span class="t">Google Classroom</span><span class="t">Slides</span></div><figcaption>Favicon</figcaption></figure>
      <figure class="tile bars">${menubar(c, 'light')}${menubar(c, 'dark')}${taskbar(c)}${gnome(c)}<figcaption>Menu bar · Windows tray · GNOME</figcaption></figure>
    </div>
  </div>
  <div class="notes">
    <div class="why">
      <h3>Why it made the final three</h3>
      <ul>${o.why.map(w => `<li>${w}</li>`).join('')}</ul>
      <p class="watch"><b>Watch for:</b> ${o.watch}</p>
    </div>
    <aside class="panel">
      <h3>Panel</h3>
      ${o.scores.map(([s, n]) => `<div class="srow"><span>${n}</span>${scoreRow(tb[s])}</div>`).join('')}
      <blockquote>${o.quote[0]}<cite>${o.quote[1]}</cite></blockquote>
    </aside>
  </div>
</section>`;
};

const also = [
  ['hamnotch4', 'Liked for putting the hamster where it runs in the app, on the ring. Teacher, system and risk reviewers ranked it first. It lost on size: the hamster crowds the corner, falls outside the circular PWA crop and turns into a lump in the menu bar. Its idea lives on in option 1’s animation: the hamster can run the ring while a timer counts down.'],
  ['board3', 'Your other pick. It had the highest app-recognition score of any finalist (9.0), because it really is a thumbnail of the board. But four objects turn to colour noise at 16px, and its glyph read as a camera or screen-record icon. It would make a good onboarding or empty-state illustration.'],
];

const liveGlyph = by.countdown.glyph; // for reference only; the live demo draws its own

const html = `<title>Classroom Widgets Icon Finals</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
:root{
  --ground:#f1ede7; --paper:#fbf9f6; --ink:#231d17; --muted:#6c6258; --rule:#ddd5ca;
  --amber:#b06c28; --amber-soft:#f3e2cc; --desk:#e6dfd5; --dk:#221e1a; --dk-ink:#e8e1d8;
  --bar-light:#f4f3f1; --bar-dark:#2b2926;
  --display:'Bricolage Grotesque', 'Avenir Next', system-ui, sans-serif;
  --body:'Atkinson Hyperlegible', 'Segoe UI', system-ui, sans-serif;
  --mono:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  color-scheme:dark; --ground:#16130f; --paper:#1f1b17; --ink:#efe8df; --muted:#a79c90; --rule:#342d26;
  --amber:#e3a45e; --amber-soft:#3a2a19; --desk:#2a241e;
}}
:root[data-theme="dark"]{
  color-scheme:dark; --ground:#16130f; --paper:#1f1b17; --ink:#efe8df; --muted:#a79c90; --rule:#342d26;
  --amber:#e3a45e; --amber-soft:#3a2a19; --desk:#2a241e;
}
*{box-sizing:border-box}
body{background:var(--ground);color:var(--ink);font:16px/1.55 var(--body);padding-inline:20px;padding-block:0 64px}
.wrap{max-width:1120px;margin:0 auto;display:flex;flex-direction:column;gap:56px}
h1,h2,h3{font-family:var(--display);text-wrap:balance;margin:0}
.intro{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:40px;align-items:end;padding-top:48px}
.eyebrow{font:600 12px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--amber)}
h1{font-size:clamp(38px,6vw,64px);line-height:.98;font-weight:800;letter-spacing:-.02em;margin-top:14px}
.intro p{margin:14px 0 0;max-width:60ch;color:var(--muted)}
.trio{display:flex;gap:18px;justify-content:flex-end;align-items:flex-end}
.trio a{display:flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none;color:var(--muted);font:12px/1.2 var(--mono)}
.trio a:focus-visible{outline:2px solid var(--amber);outline-offset:4px;border-radius:12px}
.trio img{width:clamp(76px,11vw,120px);height:auto}
.trio a:first-child img{width:clamp(96px,14vw,150px)}
.process{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.process div{padding:18px 18px 18px 0;display:flex;flex-direction:column;gap:4px}
.process div+div{padding-left:18px;border-left:1px solid var(--rule)}
.process b{font:700 26px/1 var(--display)}
.process span{color:var(--muted);font-size:14px}
.opt{display:flex;flex-direction:column;gap:22px}
.opt-h{display:flex;flex-direction:column;gap:6px}
.tag{align-self:flex-start;font:600 11px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);border:1px solid var(--rule);border-radius:999px;padding:6px 10px}
.tag.hot{background:var(--amber);color:var(--paper);border-color:var(--amber)}
h2{font-size:clamp(30px,4vw,42px);font-weight:700;letter-spacing:-.015em;margin-top:6px}
.lede{margin:0;color:var(--muted);max-width:70ch}
.spec{display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:18px;background:var(--desk);border-radius:22px;padding:18px}
figure{margin:0}
figcaption{font:11px/1.2 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);text-align:center}
.hero{background:var(--paper);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px 12px}
.hero img{width:min(280px,100%);height:auto}
.surfaces{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.tile{background:var(--paper);border-radius:14px;padding:14px 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-width:0}
.tile.dk{background:var(--dk)} .tile.dk figcaption{color:#9d948a}
.fb{border-radius:22%}
.ladder div{display:flex;align-items:flex-end;gap:12px}
.tabs .tabbar{background:#dee1e6;border-radius:8px 8px 0 0;padding:7px 7px 0;display:flex;gap:4px;max-width:100%;overflow:hidden}
.tabs .t{display:flex;align-items:center;gap:6px;background:#eef0f3;color:#777;font:12px/1 system-ui,sans-serif;padding:7px 9px;border-radius:7px 7px 0 0;white-space:nowrap}
.tabs .t.on{background:#fff;color:#222}
.tabs{grid-column:span 2}
.bars{grid-column:1 / -1;align-items:stretch}
.glyphbig{color:var(--ink)}
.bar{height:26px;display:flex;align-items:center;gap:12px;padding:0 10px;border-radius:6px;font:13px/1 -apple-system,'Segoe UI',system-ui,sans-serif;overflow:hidden;white-space:nowrap}
.bar .rt{margin-left:auto;display:flex;align-items:center;gap:11px}
.bar.mac.light{background:var(--bar-light);color:#1b1b1b;box-shadow:inset 0 -1px 0 #d5d5d5}
.bar.mac.dark{background:var(--bar-dark);color:#f2f2f2}
.bar.mac .rt .gl{opacity:.9}
.bar.win{background:#1f1f1f;color:#e6e6e6;height:34px;font-size:11.5px}
.bar.gnome{background:#000;color:#fff;font-weight:700;font-size:12px}
.bar.gnome .mid{margin-left:auto;margin-right:auto;transform:translateX(24px)}
.bar.gnome .rt{margin-left:0}
.apple{width:11px;height:13px;border-radius:50% 50% 45% 45%;background:currentColor;opacity:.85}
.sys{display:inline-block;background:currentColor;opacity:.8}
.sys.wifi{width:15px;height:11px;clip-path:polygon(50% 100%,0 30%,18% 12%,50% 0,82% 12%,100% 30%)}
.sys.batt{width:22px;height:10px;border-radius:3px;opacity:.7}
.caret{opacity:.8}
.notes{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:28px}
h3{font-size:18px;font-weight:700;margin-bottom:10px}
.why ul{margin:0;padding-left:1.1em;display:flex;flex-direction:column;gap:8px;max-width:68ch}
.watch{margin:14px 0 0;padding:12px 14px;border-radius:10px;background:var(--amber-soft);max-width:68ch;font-size:15px}
.panel{border-left:1px solid var(--rule);padding-left:22px;display:flex;flex-direction:column;gap:12px}
.panel h3{margin-bottom:0}
.srow{display:flex;flex-direction:column;gap:2px}
.srow>span:first-child{font-size:14px;color:var(--muted)}
.score b{font:800 30px/1 var(--display);font-variant-numeric:tabular-nums}
.score small{font:12px/1 var(--mono);color:var(--muted);margin-left:4px}
blockquote{margin:4px 0 0;font-style:italic;font-size:15px}
cite{display:block;font:normal 12px/1.3 var(--mono);color:var(--muted);margin-top:6px}
.live{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:28px;align-items:center;background:var(--paper);border:1px solid var(--rule);border-radius:22px;padding:26px}
.live p{margin:8px 0 0;color:var(--muted);max-width:52ch}
.stage{display:flex;flex-direction:column;gap:12px}
.stage .bigring{display:flex;align-items:center;gap:22px;color:var(--ink)}
.stage .bigring output{font:600 13px/1.4 var(--mono);color:var(--muted)}
.stage .bar{max-width:520px}
.ctl{display:flex;gap:10px}
.ctl button{font:600 13px/1 var(--mono);padding:9px 14px;border-radius:999px;border:1px solid var(--rule);background:var(--ground);color:var(--ink);cursor:pointer}
.ctl button:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
.also{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.also article{display:grid;grid-template-columns:88px minmax(0,1fr);gap:16px;align-items:start;padding:18px;border:1px solid var(--rule);border-radius:16px}
.also h3{font-size:17px;margin-bottom:4px}
.also p{margin:0;font-size:14.5px;color:var(--muted)}
.also .s{font:12px/1 var(--mono);color:var(--muted);display:block;margin-bottom:6px}
.table-wrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:14px;font-variant-numeric:tabular-nums}
th,td{padding:9px 10px;border-bottom:1px solid var(--rule);text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left}
th{font:600 11px/1.2 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
td b{font-weight:700}
.next ol{margin:0;padding-left:1.2em;display:flex;flex-direction:column;gap:8px;max-width:75ch}
.next code{font:13px var(--mono);background:var(--desk);padding:1px 5px;border-radius:4px}
@media (max-width:900px){
  .intro,.notes,.live,.also{grid-template-columns:minmax(0,1fr)}
  .trio{justify-content:flex-start}
  .spec{grid-template-columns:minmax(0,1fr)}
  .panel{border-left:0;padding-left:0;border-top:1px solid var(--rule);padding-top:16px}
}
@media (max-width:620px){
  .surfaces{grid-template-columns:repeat(2,minmax(0,1fr))}
  .tabs{grid-column:auto}
  .process{grid-template-columns:repeat(2,minmax(0,1fr))}
  .process div:nth-child(3){padding-left:0;border-left:0}
  .process div:nth-child(n+3){border-top:1px solid var(--rule)}
  .bar.mac span:nth-child(n+4):not(.rt){display:none}
}
@media (prefers-reduced-motion: reduce){ *{scroll-behavior:auto} }
</style>
<div class="wrap">
  <header class="intro">
    <div>
      <span class="eyebrow">Classroom Widgets · icon system</span>
      <h1>Three icons, one ring</h1>
      <p>Each option is a complete system: a macOS icon with a dark variant, a full-bleed version for Windows, Linux and the PWA, hand-tuned 32 and 16px icons, and a one-colour glyph that replaces the 3×3 dot grid in the menu bar and tray. None of them has a number in the timer, and the hamster is the app's own drawing.</p>
    </div>
    <nav class="trio" aria-label="The three options">
      ${options.map(o => `<a href="#${o.c.slug}">${img(o.c.icon, 150, o.c.name)}<span>${o.c.name}</span></a>`).join('')}
    </nav>
  </header>

  <div class="process" role="list">
    <div role="listitem"><b>4 rounds</b><span>abstract, then grounded in real screenshots of the app, then the no-numeral round, then finals</span></div>
    <div role="listitem"><b>9 × 9</b><span>nine designers and nine specialist reviewers each round</span></div>
    <div role="listitem"><b>280+ verdicts</b><span>macOS, Windows/Linux, tray, brand, teacher, accessibility, art direction, system, risk</span></div>
    <div role="listitem"><b>1 shared ring</b><span>every finalist converged on the notched rainbow countdown</span></div>
  </div>

  ${options.map(card).join('\n')}

  <section class="live" aria-labelledby="live-h">
    <div>
      <span class="eyebrow">Hamster Timer · menu bar</span>
      <h2 id="live-h" style="font-size:30px;margin-top:10px">The menu-bar item counts down</h2>
      <p>The resting mark shows the ring with a slice of time already spent. While a timer runs, the notch widens with it; at time's up only the thin track is left, which blinks three times. The hamster stays put in the middle, and the ring never spins, so it can't be mistaken for the macOS spinning-wheel cursor. Countdown Sticker and Gold Star Timer behave the same way.</p>
    </div>
    <div class="stage">
      <div class="bigring"><svg id="liveBig" width="112" height="112" viewBox="0 0 1024 1024" aria-label="Countdown glyph, animated"></svg><output id="liveOut">Resting</output></div>
      <div class="bar mac light"><span class="apple"></span><b>Finder</b><span>File</span><span>Edit</span><span class="rt"><svg id="liveL" width="18" height="18" viewBox="0 0 1024 1024" aria-hidden="true"></svg><span class="sys wifi"></span><span class="sys batt"></span><span>Tue 9:41</span></span></div>
      <div class="bar mac dark"><span class="apple"></span><b>Finder</b><span>File</span><span>Edit</span><span class="rt"><svg id="liveD" width="18" height="18" viewBox="0 0 1024 1024" aria-hidden="true"></svg><span class="sys wifi"></span><span class="sys batt"></span><span>Tue 9:41</span></span></div>
      <div class="ctl"><button id="play" type="button">Run a 10-second timer</button><button id="rest" type="button">Show resting mark</button></div>
    </div>
  </section>

  <section aria-labelledby="also-h">
    <h2 id="also-h" style="font-size:28px;margin-bottom:16px">Also in the final</h2>
    <div class="also">
      ${also.map(([s, t]) => `<article>${img(r4by[s].icon, 88, r4by[s].name)}<div><span class="s">${tb[s].overall.toFixed(1)}/10 · top 3 for ${tb[s].top3} of 9</span><h3>${r4by[s].name}</h3><p>${t}</p></div></article>`).join('')}
    </div>
  </section>

  <section aria-labelledby="score-h">
    <h2 id="score-h" style="font-size:28px;margin-bottom:6px">Final-round scores</h2>
    <p style="margin:0 0 14px;color:var(--muted)">Averages from the nine reviewers, 1–10. The three options above are refinements of these finalists that fix what the reviewers flagged.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Finalist</th><th>Overall</th><th>App recognition</th><th>Menu-bar glyph</th><th>At 16–32px</th><th>Cross-platform</th><th>Originality</th><th>Top 3</th></tr></thead>
      <tbody>${table.map(t => `<tr><td>${t.name}</td><td><b>${t.overall.toFixed(1)}</b></td><td>${t.appRecognition.toFixed(1)}</td><td>${t.glyphLegibility.toFixed(1)}</td><td>${t.smallSize.toFixed(1)}</td><td>${t.crossPlatform.toFixed(1)}</td><td>${t.originality.toFixed(1)}</td><td>${t.top3}/9</td></tr>`).join('')}</tbody>
    </table></div>
  </section>

  <section class="next" aria-labelledby="next-h">
    <h2 id="next-h" style="font-size:28px;margin-bottom:12px">What changed after the final round, and what happens next</h2>
    <ol>
      <li>The Hamster Timer's menu-bar glyph and 32/16px icons now carry the hamster too, simplified to two circles: a body and a head.</li>
      <li>All three options share one ring. The glyph's inner hole is now a true circle, the spent track runs along the band's inner edge, and the band is lighter, closer to menu-bar weight.</li>
      <li>The ring uses the timer widget's own left-to-right gradient (red at 9 o'clock, green at 12 and 6, violet at 3), warmed a little. It no longer reads as a colour wheel and has no banding.</li>
      <li>When you pick one, I'll wire it in everywhere: <code>DashboardMenuBarIcon.swift</code> (drawn in code as a template image, with the live countdown), <code>AppIconSource.svg</code> for the macOS app, <code>AppIcon.ico</code> and the tray icon for Windows, <code>tray-icon.png</code> for Linux, and the web <code>favicon.svg</code>, <code>logo.svg</code> and manifest icons.</li>
      <li>Before shipping, the glyph gets hand-hinted 16/18/20/22/24px masters, and the macOS icon gets built as layers in Icon Composer so tinted and clear modes can be checked for real.</li>
    </ol>
  </section>
</div>
<script>
(function(){
  var END = 250, R = 504, C = 512, BAND = R * 0.365, TRACK = R * 0.115;
  var face = R - BAND, mid = R - BAND / 2, cap = (BAND / 2) / mid * 180 / Math.PI;
  var HAM = '<circle cx="' + (C - 0.15 * face) + '" cy="' + (C + 0.13 * face) + '" r="' + 0.44 * face + '" fill="currentColor"/><circle cx="' + (C + 0.38 * face) + '" cy="' + (C - 0.2 * face) + '" r="' + 0.29 * face + '" fill="currentColor"/>';
  function P(r, d){ var t = d * Math.PI / 180; return [(C + r * Math.sin(t)).toFixed(1), (C - r * Math.cos(t)).toFixed(1)]; }
  function draw(svg, f, showBand){
    var end = 360 * f, band = '';
    if (showBand !== false) {
      if (end >= 359.9) band = '<circle cx="512" cy="512" r="' + mid + '" fill="none" stroke="currentColor" stroke-width="' + BAND + '"/>';
      else if (end > 2 * cap + 1) { var a = P(mid, cap), b = P(mid, end - cap); band = '<path d="M' + a[0] + ' ' + a[1] + 'A' + mid + ' ' + mid + ' 0 ' + (end - 2 * cap > 180 ? 1 : 0) + ' 1 ' + b[0] + ' ' + b[1] + '" fill="none" stroke="currentColor" stroke-width="' + BAND + '" stroke-linecap="round"/>'; }
      else if (end > 0) { var p = P(mid, end / 2); band = '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (BAND / 2) * Math.max(0.35, end / (2 * cap)) + '" fill="currentColor"/>'; }
    }
    svg.innerHTML = '<circle cx="512" cy="512" r="' + (face + TRACK / 2) + '" fill="none" stroke="currentColor" stroke-width="' + TRACK + '"/>' + band + HAM;
  }
  var ids = ['liveBig', 'liveL', 'liveD'].map(function(id){ return document.getElementById(id); });
  var out = document.getElementById('liveOut');
  function all(f, show){ ids.forEach(function(s){ draw(s, f, show); }); }
  var raf = 0, timers = [];
  function stop(){ cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers = []; }
  function rest(){ stop(); all(END / 360); out.textContent = 'Resting'; }
  function run(){
    stop();
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var dur = 10000, t0 = performance.now();
    if (reduce) {
      [1, .75, .5, .25, 0].forEach(function(f, i){ timers.push(setTimeout(function(){ all(f); out.textContent = f ? Math.round(f * 10) + ' s left' : "Time's up"; }, i * 2000)); });
      return;
    }
    (function tick(now){
      var f = Math.max(0, 1 - (now - t0) / dur);
      all(f); out.textContent = Math.ceil(f * 10) + ' s left';
      if (f > 0) raf = requestAnimationFrame(tick);
      else {
        out.textContent = "Time's up";
        for (var i = 0; i < 6; i++) (function(i){ timers.push(setTimeout(function(){ all(i % 2 ? 0 : 1, true); }, 300 * (i + 1))); })(i);
        timers.push(setTimeout(function(){ all(0); }, 2100));
      }
    })(t0);
  }
  document.getElementById('play').addEventListener('click', run);
  document.getElementById('rest').addEventListener('click', rest);
  rest();
})();
</script>`;

fs.writeFileSync(here('./icon-finals.html'), html);
console.log('wrote', (html.length / 1024).toFixed(0), 'KB');
