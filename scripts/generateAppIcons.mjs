#!/usr/bin/env node
// Generates every Classroom Widgets app icon, favicon and tray/menu-bar image
// from one parametric drawing: the Hamster Timer. Run `pnpm generate:icons`
// after changing anything below, and commit the regenerated files.
//
// The mark is the timer widget's rainbow ring, die-cut like one of the app's
// stickers, with the time already spent cut out as a notch at upper left. The
// app's own hamster (creatures.tsx markup, verbatim) sits in the face from 64px
// up; at 32px and below, and in the menu bar/tray glyph, it simplifies to two
// circles (body and head). The macOS menu-bar glyph is drawn in code with the
// same geometry: DashboardMenuBarIcon.swift.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- geometry ----------

const r1 = n => Math.round(n * 10) / 10;
// Angles are degrees clockwise from 12 o'clock.
const point = (cx, cy, r, deg) => {
  const t = deg * Math.PI / 180;
  return [r1(cx + r * Math.sin(t)), r1(cy - r * Math.cos(t))];
};
const arc = (cx, cy, r, from, to) => {
  const [x0, y0] = point(cx, cy, r, from);
  const [x1, y1] = point(cx, cy, r, to);
  return `M${x0} ${y0}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};
const capDegrees = (width, r) => (width / 2) / r * 180 / Math.PI;

// The band runs clockwise from 12 o'clock to BAND_END (round caps included);
// BAND_END → 360° is the spent time, shown as the thin track only.
const BAND_END = 250;

// The timer widget's ring gradient (timer.tsx: red → magenta across the dial), warmed.
const RAINBOW = ['#ec5a4b', '#f48d2f', '#f4c332', '#5cb866', '#2fb2ad', '#4a8ddf', '#9868d8'];

// Colour icon rings (1024 canvas; the macOS plate is x/y 100–924, rx 185).
const RING_LARGE = { r: 298, band: 96, track: 34, dieCut: 24 };
const RING_SMALL = { r: 352, band: 138, track: 50, dieCut: 40 };

// Monochrome glyph ring, as fractions of its outer radius.
const GLYPH = { r: 504, band: 0.365, track: 0.115 };

// Two-circle hamster, as fractions of the face (counter) radius; facing right.
const HAMSTER_DOTS = { body: { x: -0.17, y: 0.07, r: 0.44 }, head: { x: 0.37, y: -0.05, r: 0.29 } };

// The app's hamster, verbatim from creatures.tsx (viewBox -12..12). The dark
// appearance lightens the outline so the body edge still separates.
const hamster = dark => {
  const outline = dark ? '#e0b98a' : '#8B4513';
  return `<ellipse cx="0" cy="0" rx="6" ry="4.5" fill="#D2691E" stroke="${outline}" stroke-width="0.8"/><circle cx="-4" cy="-1.5" r="3.5" fill="#DEB887" stroke="${outline}" stroke-width="0.8"/><circle cx="-5.5" cy="-3.5" r="1.3" fill="#D2691E"/><circle cx="-2.5" cy="-3.5" r="1.3" fill="#D2691E"/><circle cx="-5" cy="-1.5" r="0.7" fill="#000"/><circle cx="-3" cy="-1.5" r="0.7" fill="#000"/><circle cx="-4.8" cy="-1.8" r="0.3" fill="#fff"/><circle cx="-2.8" cy="-1.8" r="0.3" fill="#fff"/><circle cx="-6.5" cy="-0.5" r="0.4" fill="#8B4513"/><g><ellipse cx="-2.5" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" stroke-width="0.3"/><ellipse cx="-4" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" stroke-width="0.3"/><ellipse cx="1.5" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" stroke-width="0.3"/><ellipse cx="3" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" stroke-width="0.3"/></g><path d="M 4.5 0 Q 7 -1.5 8.5 1" stroke="${outline}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
};
const HAMSTER_SHADOW = '<ellipse cx="0" cy="0" rx="6.4" ry="4.9"/><circle cx="-4" cy="-1.5" r="3.9"/><ellipse cx="-3.25" cy="3.5" rx="1.9" ry="1.65"/><ellipse cx="2.25" cy="3.5" rx="1.9" ry="1.65"/><path d="M 4.5 0 Q 7 -1.5 8.5 1" stroke="#5b4a32" stroke-width="1.2" fill="none" stroke-linecap="round"/>';

const hamsterDots = (cx, cy, faceR, body, head, stroke = '') => {
  const { body: b, head: h } = HAMSTER_DOTS;
  const outline = stroke ? ` stroke="${stroke}" stroke-width="${r1(faceR * 0.06)}"` : '';
  return `<circle cx="${r1(cx + b.x * faceR)}" cy="${r1(cy + b.y * faceR)}" r="${r1(b.r * faceR)}" fill="${body}"${outline}/>`
    + `<circle cx="${r1(cx + h.x * faceR)}" cy="${r1(cy + h.y * faceR)}" r="${r1(h.r * faceR)}" fill="${head}"${outline}/>`;
};

const PALETTE = {
  light: { plate: ['#dfa85b', '#c8893f', '#a9692b'], facetHi: ['#fff3dc', 0.13], facetLo: ['#5a2c08', 0.1], rim: ['#fff3dd', 0.6], sticker: ['#ffffff', '#efe7da'], face: ['#fffdf8', '#f3ebdd'], track: '#e4d9c6', shadow: ['#3b2a14', 0.34] },
  dark: { plate: ['#7a5128', '#5a3718', '#3a220e'], facetHi: ['#ffe9c8', 0.07], facetLo: ['#000000', 0.14], rim: ['#f3d9ae', 0.22], sticker: ['#e9dfd0', '#cfc3b1'], face: ['#3a342e', '#2b2622'], track: '#4c443b', shadow: ['#000000', 0.5] },
};

// ---------- colour icon ----------
// variant: 'large' (64px and up) or 'small' (hand-tuned flat master for 16–32px)
// plate: true draws the macOS-style amber plate; false leaves only the sticker (Icon Composer layer)
function colourIcon({ id, variant = 'large', dark = false, plate = true }) {
  const small = variant === 'small';
  const ring = small ? RING_SMALL : RING_LARGE;
  const c = PALETTE[dark ? 'dark' : 'light'];
  const cx = 512, cy = 512;
  const faceR = ring.r - ring.band;
  const mid = ring.r - ring.band / 2;
  const cap = capDegrees(ring.band, mid);
  const bandPath = arc(cx, cy, mid, cap, BAND_END - cap);
  const sticker = (fill, attrs = '') => `<g fill="${fill}" ${attrs}><circle cx="${cx}" cy="${cy}" r="${faceR + ring.track + ring.dieCut}"/><path d="${bandPath}" fill="none" stroke="${fill}" stroke-width="${ring.band + 2 * ring.dieCut}" stroke-linecap="round"/></g>`;

  const plateSvg = !plate ? '' : small
    ? `<rect x="100" y="100" width="824" height="824" rx="185" fill="${c.plate[1]}"/>`
    : `<rect x="108" y="114" width="808" height="814" rx="182" fill="#3b2410" fill-opacity="0.3" filter="url(#${id}-drop)"/>`
      + `<g clip-path="url(#${id}-clip)"><rect x="100" y="100" width="824" height="824" fill="url(#${id}-plate)"/>`
      + `<path d="M470 100L924 100L924 600Z" fill="${c.facetHi[0]}" fill-opacity="${c.facetHi[1]}"/>`
      + `<path d="M100 470L100 924L660 924Z" fill="${c.facetLo[0]}" fill-opacity="${c.facetLo[1]}"/>`
      + sticker(c.shadow[0], `opacity="${c.shadow[1]}" transform="translate(10 18)" filter="url(#${id}-blur)"`)
      + `</g><rect x="104" y="104" width="816" height="816" rx="181" fill="none" stroke="${c.rim[0]}" stroke-opacity="${c.rim[1]}" stroke-width="8"/>`;

  const hs = 18.5, hx = cx - 4, hy = cy + 8;
  const hamsterSvg = small
    ? hamsterDots(cx, cy, faceR, '#D2691E', '#DEB887', '#8B4513')
    : `<ellipse cx="${hx}" cy="${r1(hy + 5.2 * hs)}" rx="${r1(7.4 * hs)}" ry="${r1(1.3 * hs)}" fill="#6b4a26" fill-opacity="${dark ? 0.35 : 0.16}" filter="url(#${id}-soft)"/>`
      + `<g transform="translate(${hx} ${hy}) scale(${-hs} ${hs})">`
      + `<g transform="translate(-0.25 0.4)" fill="#5b4a32" opacity="${dark ? 0.4 : 0.22}" filter="url(#${id}-hsoft)">${HAMSTER_SHADOW}</g>`
      + `${hamster(dark)}</g>`;

  const stops = RAINBOW.map((col, i) => `<stop offset="${r1(i / (RAINBOW.length - 1) * 100)}%" stop-color="${col}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>`
    + `<linearGradient id="${id}-plate" x1="0.12" y1="0.02" x2="0.88" y2="0.98"><stop offset="0" stop-color="${c.plate[0]}"/><stop offset="0.55" stop-color="${c.plate[1]}"/><stop offset="1" stop-color="${c.plate[2]}"/></linearGradient>`
    + `<clipPath id="${id}-clip"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath>`
    + `<filter id="${id}-drop" x="-10%" y="-10%" width="120%" height="125%"><feGaussianBlur stdDeviation="14"/></filter>`
    + `<filter id="${id}-blur" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="16"/></filter>`
    + `<filter id="${id}-soft" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="9"/></filter>`
    + `<filter id="${id}-hsoft" x="-30%" y="-40%" width="160%" height="180%"><feGaussianBlur stdDeviation="0.45"/></filter>`
    + `<linearGradient id="${id}-sticker" x1="${cx - ring.r}" y1="${cy - ring.r}" x2="${cx + ring.r}" y2="${cy + ring.r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${c.sticker[0]}"/><stop offset="1" stop-color="${c.sticker[1]}"/></linearGradient>`
    + `<radialGradient id="${id}-face" cx="${r1(cx - faceR * 0.3)}" cy="${r1(cy - faceR * 0.35)}" r="${r1(faceR * 1.4)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${c.face[0]}"/><stop offset="1" stop-color="${c.face[1]}"/></radialGradient>`
    + `<linearGradient id="${id}-band" x1="${cx - ring.r}" y1="0" x2="${cx + ring.r}" y2="0" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`
    + `<linearGradient id="${id}-bandlit" x1="${cx - ring.r}" y1="${cy - ring.r}" x2="${cx + ring.r}" y2="${cy + ring.r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#2a1204" stop-opacity="0.12"/></linearGradient>`
    + `</defs>`
    + plateSvg
    + sticker(small ? c.sticker[0] : `url(#${id}-sticker)`)
    + `<circle cx="${cx}" cy="${cy}" r="${r1(faceR + ring.track / 2)}" fill="none" stroke="${c.track}" stroke-width="${ring.track}"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${faceR}" fill="${small ? c.face[0] : `url(#${id}-face)`}"/>`
    + (small ? '' : `<circle cx="${cx}" cy="${cy}" r="${faceR - 3}" fill="none" stroke="#6e4c2e" stroke-opacity="${dark ? 0.3 : 0.08}" stroke-width="6"/>`)
    + `<path d="${bandPath}" fill="none" stroke="url(#${id}-band)" stroke-width="${ring.band}" stroke-linecap="round"/>`
    + (small ? '' : `<path d="${bandPath}" fill="none" stroke="url(#${id}-bandlit)" stroke-width="${ring.band}" stroke-linecap="round"/>`)
    + hamsterSvg
    + `</svg>`;
}

// Scale the macOS plate (100–924) to fill the canvas: Windows/Linux-style
// full-bleed tiles, PWA maskable icons (the ring stays inside the 80% safe
// circle) and apple-touch-icon.
function fullBleed(svg, id) {
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><clipPath id="${id}-bleed"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath></defs>`
    + `<g transform="translate(-124.27 -124.27) scale(1.2427)"><g clip-path="url(#${id}-bleed)">${inner}</g></g></svg>`;
}

// ---------- monochrome glyph (menu bar, tray) ----------
function glyph({ fill = '#000' } = {}) {
  const cx = 512, cy = 512, R = GLYPH.r;
  const band = r1(R * GLYPH.band), track = r1(R * GLYPH.track);
  const faceR = R - band, mid = R - band / 2;
  const cap = capDegrees(band, mid);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">`
    + `<circle cx="${cx}" cy="${cy}" r="${r1(faceR + track / 2)}" fill="none" stroke="${fill}" stroke-width="${track}"/>`
    + `<path d="${arc(cx, cy, mid, cap, BAND_END - cap)}" fill="none" stroke="${fill}" stroke-width="${band}" stroke-linecap="round"/>`
    + hamsterDots(cx, cy, faceR, fill, fill)
    + `</svg>`;
}

// Scale a centred drawing up about the canvas centre (used to fill a tray slot with the plate-less sticker).
function enlarge(svg, factor) {
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const shift = r1(512 - 512 * factor);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g transform="translate(${shift} ${shift}) scale(${factor})">${inner}</g></svg>`;
}

// ---------- raster + container writers ----------

const png = (svg, px) => new Resvg(svg, { fitTo: { mode: 'width', value: px } }).render().asPng();

// Windows .ico with PNG-compressed entries.
function ico(entries) {
  const header = Buffer.alloc(6 + 16 * entries.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach(({ px, data }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(px >= 256 ? 0 : px, at);
    header.writeUInt8(px >= 256 ? 0 : px, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...entries.map(e => e.data)]);
}

// macOS .icns with PNG chunks.
function icns(chunks) {
  const parts = chunks.map(({ type, data }) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii');
    head.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([head, data]);
  });
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(8 + parts.reduce((n, p) => n + p.length, 0), 4);
  return Buffer.concat([head, ...parts]);
}

const written = [];
const write = (path, data) => {
  const full = join(ROOT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, data);
  written.push(path);
};

// ---------- build ----------

const svg = {
  icon: colourIcon({ id: 'cw' }),
  iconDark: colourIcon({ id: 'cwd', dark: true }),
  iconSmall: colourIcon({ id: 'cws', variant: 'small' }),
  layer: colourIcon({ id: 'cwl', plate: false }),
  glyph: glyph(),
};
// The small master without its plate, filling the canvas: a colour sticker that reads on light and dark Linux panels.
svg.traySticker = enlarge(colourIcon({ id: 'cwt', variant: 'small', plate: false }), 1.28);
svg.maskable = fullBleed(svg.icon, 'cwm');
svg.iconComposerLayer = fullBleed(svg.layer, 'cwic');

// Up to 32 physical pixels the flat two-circle master reads better than the full drawing.
const iconPng = px => png(px <= 32 ? svg.iconSmall : svg.icon, px);

// Sources, for design tools and docs.
write('assets/app-icon/app-icon.svg', svg.icon);
write('assets/app-icon/app-icon-dark.svg', svg.iconDark);
write('assets/app-icon/app-icon-small.svg', svg.iconSmall);
write('assets/app-icon/app-icon-maskable.svg', svg.maskable);
write('assets/app-icon/menu-bar-glyph.svg', svg.glyph);
write('assets/app-icon/preview.png', png(svg.icon, 512));

// macOS
const MAC = 'packages/macos-dashboard';
write(`${MAC}/Assets/AppIconSource.svg`, svg.icon);
write(`${MAC}/Assets/AppIconSource.png`, png(svg.icon, 1024));
const iconset = [[16, 1], [16, 2], [32, 1], [32, 2], [128, 1], [128, 2], [256, 1], [256, 2], [512, 1], [512, 2]];
for (const [pt, scale] of iconset) {
  write(`${MAC}/Assets/AppIcon.iconset/icon_${pt}x${pt}${scale === 2 ? '@2x' : ''}.png`, iconPng(pt * scale));
}
write(`${MAC}/Sources/ClassroomWidgetsDashboard/Resources/AppIcon.icns`, icns([
  ['icp4', 16], ['icp5', 32], ['ic11', 32], ['ic12', 64], ['ic07', 128], ['ic13', 256],
  ['ic08', 256], ['ic14', 512], ['ic09', 512], ['ic10', 1024],
].map(([type, px]) => ({ type, data: iconPng(px) }))));
// Icon Composer package: amber fill plus one full-bleed timer layer; Icon Composer adds the mask and glass.
rmSync(join(ROOT, `${MAC}/Assets/ClassroomWidgets.icon/Assets`), { recursive: true, force: true });
write(`${MAC}/Assets/ClassroomWidgets.icon/Assets/timer.png`, png(svg.iconComposerLayer, 1024));
write(`${MAC}/Assets/ClassroomWidgets.icon/icon.json`, `${JSON.stringify({
  fill: { solid: 'srgb:0.78431,0.53725,0.24706,1.00000' },
  groups: [{
    layers: [{ 'image-name': 'timer.png', name: 'Timer' }],
    shadow: { kind: 'neutral', opacity: 0.5 },
    specular: false,
    translucency: { enabled: false, value: 0 },
  }],
  'supported-platforms': { squares: ['macOS'] },
}, null, 2)}\n`);

// Windows: app/installer icon, plus monochrome tray glyphs for light and dark taskbars.
const WIN = 'packages/windows-dashboard/Assets';
write(`${WIN}/AppIcon.ico`, ico([16, 20, 24, 32, 40, 48, 64, 128, 256].map(px => ({ px, data: iconPng(px) }))));
const traySizes = [16, 20, 24, 32, 40, 48];
write(`${WIN}/TrayIcon-Black.ico`, ico(traySizes.map(px => ({ px, data: png(glyph({ fill: '#000000' }), px) }))));
write(`${WIN}/TrayIcon-White.ico`, ico(traySizes.map(px => ({ px, data: png(glyph({ fill: '#ffffff' }), px) }))));

// Linux: app icon (electron-builder makes the hicolor set) and tray icon. Linux panels can be light or
// dark and Electron cannot tell which, so the tray uses the colour sticker rather than a one-colour glyph.
const LINUX = 'packages/linux-dashboard/assets';
write(`${LINUX}/icon.png`, png(svg.icon, 512));
write(`${LINUX}/tray-icon.png`, png(svg.traySticker, 64));

// Web: teacher app (also bundled into every desktop app) and student app.
const favicon = ico([16, 32, 48].map(px => ({ px, data: png(svg.iconSmall, px) })));
const TEACHER = 'packages/teacher/public';
write(`${TEACHER}/logo.svg`, svg.icon);
write(`${TEACHER}/logo.png`, png(svg.icon, 512));
write(`${TEACHER}/favicon.svg`, svg.iconSmall);
write(`${TEACHER}/favicon.ico`, favicon);
write(`${TEACHER}/apple-touch-icon.png`, png(svg.maskable, 180));
write(`${TEACHER}/icon-192.png`, png(svg.icon, 192));
write(`${TEACHER}/icon-512.png`, png(svg.icon, 512));
write(`${TEACHER}/icon-maskable-512.png`, png(svg.maskable, 512));
// packages/server/public/student is the checked-in student build; the root copy is served at /.
for (const dir of ['packages/student/public', 'packages/server/public/student', 'packages/server/public']) {
  write(`${dir}/favicon.svg`, svg.iconSmall);
  write(`${dir}/favicon.ico`, favicon);
}

console.log(`Wrote ${written.length} files:\n  ${written.join('\n  ')}`);
