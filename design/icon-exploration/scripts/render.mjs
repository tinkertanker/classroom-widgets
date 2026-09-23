// Render contact sheets for an icon-system round.
// usage: node render.mjs round1.json sheets/r1
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const [,, jsonPath, outPrefix] = process.argv;
const concepts = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const outDir = path.dirname(outPrefix);
fs.mkdirSync(outDir, { recursive: true });

const b64 = s => Buffer.from(s).toString('base64');
const uri = s => `data:image/svg+xml;base64,${b64(s)}`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Full-bleed (Windows/Linux/PWA) derivation: scale the squircle plate (100..924) to fill the canvas, clipped to the plate.
const fullBleed = (svg, slug) => {
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><clipPath id="${slug}-fbclip"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath></defs><g transform="translate(-124.27 -124.27) scale(1.2427)"><g clip-path="url(#${slug}-fbclip)">${inner}</g></g></svg>`;
};

const CHROME = '/opt/pw-browsers/chromium';

const sheetHtml = c => {
  const icon = uri(c.icon), full = uri(fullBleed(c.icon, c.slug)), glyph = uri(c.glyph);
  const mask = (size, color, extra = '') => `<span class="g" style="width:${size}px;height:${size}px;background:${color};-webkit-mask-image:url('${glyph}');mask-image:url('${glyph}');${extra}"></span>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#e9e7e2;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#222;width:1400px}
  .wrap{padding:22px 28px}
  h1{font-size:22px;margin:0 0 2px}
  .sub{font-size:13px;color:#666;margin:0 0 14px}
  .row{display:flex;gap:16px;align-items:flex-start;margin-bottom:14px}
  .card{background:#fff;border-radius:12px;padding:12px;display:flex;flex-direction:column;align-items:center;gap:6px}
  .card.dark{background:#232323;color:#bbb}
  .lab{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#888}
  .card.dark .lab{color:#8a8a8a}
  .ladder{display:flex;align-items:flex-end;gap:14px}
  .g{display:inline-block;-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center}
  .bar{width:640px;height:24px;display:flex;align-items:center;gap:14px;padding:0 12px;font-size:13px;border-radius:6px}
  .bar.light{background:rgba(246,246,246,.96);color:#111;box-shadow:0 1px 0 #ccc}
  .bar.dark{background:rgba(40,40,40,.96);color:#eee;box-shadow:0 1px 0 #000}
  .bar .right{margin-left:auto;display:flex;align-items:center;gap:12px}
  .bar b{font-weight:600}
  .win{width:640px;height:40px;background:#202020;display:flex;align-items:center;justify-content:flex-end;gap:12px;padding:0 12px;border-radius:6px;color:#ddd;font-size:11px}
  .gnome{width:640px;height:26px;background:#000;display:flex;align-items:center;gap:12px;padding:0 12px;border-radius:6px;color:#fff;font-size:12px;font-weight:700}
  .stack{display:flex;flex-direction:column;gap:8px}
  .tab{display:flex;align-items:center;gap:6px;background:#fff;border:1px solid #cfcfcf;border-bottom:none;border-radius:8px 8px 0 0;padding:6px 10px;font-size:12px;color:#333;width:150px}
  .tabbar{background:#dee1e6;padding:8px 8px 0;border-radius:8px 8px 0 0;display:flex;gap:6px}
  canvas{image-rendering:pixelated;background:#fff;border:1px solid #ddd}
  .zoomrow{display:flex;gap:10px;align-items:flex-end}
  </style></head><body><div class="wrap">
  <h1>${esc(c.name)} <span style="font-weight:400;color:#777;font-size:15px">— ${esc(c.direction || '')}</span></h1>
  <p class="sub">${esc(c.tagline)}</p>
  <div class="row">
    <div class="card"><img src="${icon}" width="200" height="200"><span class="lab">macOS · light desktop</span></div>
    <div class="card dark"><img src="${icon}" width="200" height="200"><span class="lab">macOS · dark desktop</span></div>
    <div class="card"><img src="${full}" width="160" height="160" style="border-radius:36px"><span class="lab">Windows / Linux / PWA (full-bleed)</span></div>
    <div class="card dark"><img src="${full}" width="160" height="160" style="border-radius:36px"><span class="lab">full-bleed on dark</span></div>
    <div class="card"><div class="ladder"><img src="${icon}" width="64" height="64"><img src="${icon}" width="32" height="32"><img src="${full}" width="16" height="16"></div><span class="lab">64 · 32 · favicon 16</span></div>
    <div class="card"><div class="tabbar"><div class="tab"><img src="${full}" width="16" height="16" style="border-radius:3px">Classroom Widgets</div><div class="tab" style="background:#eef0f3;color:#888">Google Classroom</div></div><span class="lab">browser tab (favicon 16)</span></div>
  </div>
  <div class="row">
    <div class="stack">
      <div class="bar light"><b></b><b>Finder</b><span>File</span><span>Edit</span><span>View</span><span>Go</span><span>Window</span><span>Help</span><div class="right">${mask(18, 'rgba(0,0,0,.85)')}<span style="font-size:11px">◐</span><span style="font-size:11px">⌃</span><span>Tue 9:41 AM</span></div></div>
      <div class="bar dark"><b></b><b>Finder</b><span>File</span><span>Edit</span><span>View</span><span>Go</span><span>Window</span><span>Help</span><div class="right">${mask(18, 'rgba(255,255,255,.85)')}<span style="font-size:11px">◐</span><span style="font-size:11px">⌃</span><span>Tue 9:41 AM</span></div></div>
      <div class="win"><span>^</span>${mask(16, '#fff')}<span>ENG</span><span>9:41 AM</span></div>
      <div class="gnome"><span>Activities</span><span style="margin-left:auto">Tue 9:41</span>${mask(16, '#fff')}<span>◐</span></div>
      <span class="lab" style="color:#666">macOS menu bar (light/dark, 18pt template) · Windows taskbar (16px white) · GNOME top bar (16px symbolic)</span>
    </div>
    <div class="card"><span class="g" style="width:150px;height:150px;background:#000;-webkit-mask-image:url('${glyph}');mask-image:url('${glyph}')"></span><span class="lab">glyph at 150 px</span></div>
    <div class="card"><div class="zoomrow"><canvas id="z1" width="36" height="36" style="width:144px;height:144px"></canvas><canvas id="z2" width="18" height="18" style="width:144px;height:144px"></canvas></div><span class="lab">pixel zoom: 18pt @2x (36px) · @1x (18px)</span></div>
  </div>
  <script>
    const img = new Image(); img.src = '${glyph}';
    img.onload = () => { for (const [id, s] of [['z1',36],['z2',18]]) { const c = document.getElementById(id).getContext('2d'); c.imageSmoothingEnabled = true; c.drawImage(img, 0, 0, s, s); } };
  </script>
  </div></body></html>`;
};

const overviewHtml = () => `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#e9e7e2;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;width:1400px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:22px 28px}
  .c{background:#fff;border-radius:12px;padding:12px;display:flex;gap:12px;align-items:center}
  .c .meta{display:flex;flex-direction:column;gap:6px;font-size:12px;color:#333;flex:1}
  .c b{font-size:14px}
  .bars{display:flex;flex-direction:column;gap:4px}
  .bar{width:150px;height:22px;display:flex;align-items:center;justify-content:flex-end;padding:0 8px;border-radius:5px;gap:8px;font-size:10px}
  .bar.light{background:#f4f4f4;color:#111;box-shadow:0 1px 0 #ccc}
  .bar.dark{background:#2a2a2a;color:#ddd}
  .g{display:inline-block;-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center}
  </style></head><body><div class="grid">
  ${concepts.map((c, i) => {
    const icon = uri(c.icon), glyph = uri(c.glyph);
    const mask = (size, color) => `<span class="g" style="width:${size}px;height:${size}px;background:${color};-webkit-mask-image:url('${glyph}');mask-image:url('${glyph}')"></span>`;
    return `<div class="c"><img src="${icon}" width="112" height="112"><div class="meta"><b>${i + 1}. ${esc(c.name)}</b><span style="color:#777">${esc(c.slug)}</span><div class="bars"><div class="bar light">${mask(18, 'rgba(0,0,0,.85)')}<span>9:41</span></div><div class="bar dark">${mask(18, 'rgba(255,255,255,.85)')}<span>9:41</span></div></div></div><img src="${icon}" width="32" height="32" style="align-self:flex-end"></div>`;
  }).join('\n')}
  </div></body></html>`;

const shoot = (html, png, h) => {
  const tmp = png.replace(/\.png$/, '.html');
  fs.writeFileSync(tmp, html);
  execSync(`${CHROME} --headless --disable-gpu --no-sandbox --hide-scrollbars --force-device-scale-factor=2 --virtual-time-budget=4000 --window-size=1400,${h} --screenshot=${png} "file://${path.resolve(tmp)}"`, { stdio: 'ignore' });
};

for (const c of concepts) shoot(sheetHtml(c), `${outPrefix}-${c.slug}.png`, 620);
shoot(overviewHtml(), `${outPrefix}-overview.png`, 560);
console.log('rendered', concepts.length, 'sheets + overview to', outDir);
