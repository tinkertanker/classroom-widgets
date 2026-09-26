#!/usr/bin/env node
// Generates every Classroom Widgets app icon, favicon and tray/menu-bar image
// from one parametric drawing: the Nibbled Timer. Run `pnpm generate:icons`
// after changing anything below, and commit the regenerated files.
//
// The mark is the timer widget's rainbow ring, die-cut like one of the app's
// stickers, with the time already spent cut out as a notch at upper left. The
// app's own hamster (creatures.tsx markup, verbatim) stands on the track in that
// notch, as if it has nibbled the spent time away. At 32px and below, and in the
// menu bar/tray glyph, the hamster simplifies to two circles (body and head).
// The macOS menu-bar glyph is drawn in code from the same numbers:
// DashboardMenuBarIcon.swift.
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

// The timer widget's ring gradient (timer.tsx: red → magenta across the dial), warmed.
const RAINBOW = ['#ec5a4b', '#f48d2f', '#f4c332', '#5cb866', '#2fb2ad', '#4a8ddf', '#9868d8'];

// Each ring: radius, band/track/sticker-border widths, and where the band ends (clockwise
// from 12, round caps included); bandEnd → 360° is the spent time, shown as the thin track.
// All in units of the 1024 canvas; the macOS plate is x/y 100–924, rx 185.
// The values were tuned by eye in the Nibbled Timer tuner.
const LARGE = {
  cx: 527, cy: 510, r: 267, band: 112, track: 49, dieCut: 43, bandEnd: 264,
  // Dark appearance: width of the beige ring between the band and the dark centre.
  darkRim: 40,
  // The app's hamster standing on the track: feet at the track's outer edge plus `lift`,
  // facing anticlockwise (towards the band's end), with its own sticker border.
  hamster: { angle: 310, lift: -39, scale: 17.5, tilt: 3, facing: 'ccw', outline: 40 },
};
// 16–32px master: the same drawing, flatter, with the hamster as two circles.
const SMALL = {
  cx: 593.8, cy: 534.4, r: 224.1, band: 94, track: 41.1, dieCut: 36.1, bandEnd: 264,
  dots: { angle: 310, lift: -32.7, body: 109.4, head: 88.6, spread: 0.7, headRise: 13, facing: 'ccw', outline: 36.1 },
};
// One-colour glyph; band and track are shares of the radius. The two circles are cut free
// of the ring by `gap`. Its centre is shifted so the whole mark sits centred on the canvas.
const GLYPH = {
  cx: 645.4, cy: 548.8, r: 382, band: 0.325, track: 0.18, bandEnd: 264,
  dots: { angle: 322, lift: -120, body: 166, head: 122, spread: 0.8, headRise: -6, facing: 'ccw', gap: 99 },
};

// The app's hamster, verbatim from creatures.tsx (viewBox -12..12).
const HAMSTER = '<ellipse cx="0" cy="0" rx="6" ry="4.5" fill="#D2691E" stroke="#8B4513" stroke-width="0.8"/><circle cx="-4" cy="-1.5" r="3.5" fill="#DEB887" stroke="#8B4513" stroke-width="0.8"/><circle cx="-5.5" cy="-3.5" r="1.3" fill="#D2691E"/><circle cx="-2.5" cy="-3.5" r="1.3" fill="#D2691E"/><circle cx="-5" cy="-1.5" r="0.7" fill="#000"/><circle cx="-3" cy="-1.5" r="0.7" fill="#000"/><circle cx="-4.8" cy="-1.8" r="0.3" fill="#fff"/><circle cx="-2.8" cy="-1.8" r="0.3" fill="#fff"/><circle cx="-6.5" cy="-0.5" r="0.4" fill="#8B4513"/><g><ellipse cx="-2.5" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" stroke-width="0.3"/><ellipse cx="-4" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" stroke-width="0.3"/><ellipse cx="1.5" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" stroke-width="0.3"/><ellipse cx="3" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" stroke-width="0.3"/></g><path d="M 4.5 0 Q 7 -1.5 8.5 1" stroke="#8B4513" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
// Its silhouette grown by `grow` local units on every side: the hamster's sticker border.
const hamsterSilhouette = (fill, grow) => `<g fill="${fill}" stroke="${fill}" stroke-width="${2 * grow}" stroke-linejoin="round"><ellipse cx="0" cy="0" rx="6" ry="4.5"/><circle cx="-4" cy="-1.5" r="3.5"/><circle cx="-5.5" cy="-3.5" r="1.3"/><circle cx="-2.5" cy="-3.5" r="1.3"/><ellipse cx="-3.25" cy="3.5" rx="1.9" ry="1.65"/><ellipse cx="2.25" cy="3.5" rx="1.9" ry="1.65"/></g>`
  + `<path d="M 4.5 0 Q 7 -1.5 8.5 1" fill="none" stroke="${fill}" stroke-width="${1.2 + 2 * grow}" stroke-linecap="round"/>`;
const hamsterTransform = (cx, cy, trackOuter, h) => {
  const [x, y] = point(cx, cy, trackOuter + h.lift + 5 * h.scale, h.angle);
  return `translate(${x} ${y}) rotate(${h.angle + h.tilt}) scale(${h.facing === 'cw' ? -h.scale : h.scale} ${h.scale})`;
};

// Two-circle hamster standing on the track: [x, y, r] for body and head. The head sits
// `spread` × (body + head) away along the direction it faces, raised by `headRise` degrees.
function hamsterDots(cx, cy, trackOuter, d) {
  const t = d.angle * Math.PI / 180;
  const [bx, by] = point(cx, cy, trackOuter + d.body + d.lift, d.angle);
  const dir = d.facing === 'cw' ? 1 : -1;
  const [tx, ty] = [Math.cos(t) * dir, Math.sin(t) * dir];
  const [nx, ny] = [Math.sin(t), -Math.cos(t)];
  const rise = d.headRise * Math.PI / 180, dist = d.spread * (d.body + d.head);
  return {
    body: [bx, by, d.body],
    head: [r1(bx + dist * (Math.cos(rise) * tx + Math.sin(rise) * nx)), r1(by + dist * (Math.cos(rise) * ty + Math.sin(rise) * ny)), d.head],
  };
}
const circle = ([x, y, r], fill, extra = '') => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${fill}"${extra}/>`;

const PALETTE = {
  light: { plate: ['#dfa85b', '#c8893f', '#a9692b'], facetHi: ['#fff3dc', 0.13], facetLo: ['#5a2c08', 0.1], rim: ['#fff3dd', 0.6], sticker: ['#ffffff', '#efe7da'], face: ['#fffdf8', '#f3ebdd'], track: '#e4d9c6', shadow: ['#3b2a14', 0.34] },
  // Dark: toned-down sticker, dark track and face, with a beige ring inside the band. The hamster is unchanged.
  dark: { plate: ['#7a5128', '#5a3718', '#3a220e'], facetHi: ['#ffe9c8', 0.07], facetLo: ['#000000', 0.14], rim: ['#f3d9ae', 0.22], sticker: ['#e9dfd0', '#cfc3b1'], face: ['#3a342e', '#2b2622'], track: '#4c443b', shadow: ['#000000', 0.5], faceRim: '#d9c6a3' },
};

// ---------- colour icon ----------
// variant: 'large' (64px and up) or 'small' (hand-tuned flat master for 16–32px)
// plate: true draws the macOS-style amber plate; false leaves only the sticker (Icon Composer layer, Linux tray)
function colourIcon({ id, variant = 'large', dark = false, plate = true }) {
  const small = variant === 'small';
  const ring = small ? SMALL : LARGE;
  const c = PALETTE[dark ? 'dark' : 'light'];
  const { cx, cy } = ring;
  const faceR = ring.r - ring.band;
  const trackOuter = faceR + ring.track;
  const mid = ring.r - ring.band / 2;
  const cap = capDegrees(ring.band, mid);
  const bandPath = arc(cx, cy, mid, cap, ring.bandEnd - cap);
  const dots = small && hamsterDots(cx, cy, trackOuter, ring.dots);
  const hT = !small && hamsterTransform(cx, cy, trackOuter, ring.hamster);
  const sticker = (fill, attrs = '') => `<g ${attrs}><circle cx="${cx}" cy="${cy}" r="${trackOuter + ring.dieCut}" fill="${fill}"/>`
    + `<path d="${bandPath}" fill="none" stroke="${fill}" stroke-width="${ring.band + 2 * ring.dieCut}" stroke-linecap="round"/>`
    + (small
      ? circle([dots.body[0], dots.body[1], dots.body[2] + ring.dots.outline], fill) + circle([dots.head[0], dots.head[1], dots.head[2] + ring.dots.outline], fill)
      : `<g transform="${hT}">${hamsterSilhouette(fill, ring.hamster.outline / ring.hamster.scale)}</g>`)
    + `</g>`;

  const plateSvg = !plate ? '' : small
    ? `<rect x="100" y="100" width="824" height="824" rx="185" fill="${c.plate[1]}"/>`
    : `<rect x="108" y="114" width="808" height="814" rx="182" fill="#3b2410" fill-opacity="0.3" filter="url(#${id}-drop)"/>`
      + `<g clip-path="url(#${id}-clip)"><rect x="100" y="100" width="824" height="824" fill="url(#${id}-plate)"/>`
      + `<path d="M470 100L924 100L924 600Z" fill="${c.facetHi[0]}" fill-opacity="${c.facetHi[1]}"/>`
      + `<path d="M100 470L100 924L660 924Z" fill="${c.facetLo[0]}" fill-opacity="${c.facetLo[1]}"/>`
      + sticker(c.shadow[0], `opacity="${c.shadow[1]}" transform="translate(10 18)" filter="url(#${id}-blur)"`)
      + `</g><rect x="104" y="104" width="816" height="816" rx="181" fill="none" stroke="${c.rim[0]}" stroke-opacity="${c.rim[1]}" stroke-width="8"/>`;

  const outline = ` stroke="#8B4513" stroke-width="${r1(ring.dots ? ring.dots.body * 0.14 : 0)}"`;
  const hamsterSvg = small
    ? circle(dots.body, '#D2691E', outline) + circle(dots.head, '#DEB887', outline)
    : `<g transform="${hT}"><g transform="translate(-0.25 0.4)" fill="#5b4a32" opacity="0.22" filter="url(#${id}-hsoft)"><ellipse cx="0" cy="0" rx="6.4" ry="4.9"/><circle cx="-4" cy="-1.5" r="3.9"/></g>${HAMSTER}</g>`;

  // Dark appearance: a beige ring inside the band around the dark face.
  const face = dark && !small
    ? `<circle cx="${cx}" cy="${cy}" r="${faceR}" fill="${c.faceRim}"/><circle cx="${cx}" cy="${cy}" r="${faceR - ring.darkRim}" fill="url(#${id}-face)"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${faceR}" fill="${small ? c.face[0] : `url(#${id}-face)`}"/>`;

  const stops = RAINBOW.map((col, i) => `<stop offset="${r1(i / (RAINBOW.length - 1) * 100)}%" stop-color="${col}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>`
    + `<linearGradient id="${id}-plate" x1="0.12" y1="0.02" x2="0.88" y2="0.98"><stop offset="0" stop-color="${c.plate[0]}"/><stop offset="0.55" stop-color="${c.plate[1]}"/><stop offset="1" stop-color="${c.plate[2]}"/></linearGradient>`
    + `<clipPath id="${id}-clip"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath>`
    + `<filter id="${id}-drop" x="-10%" y="-10%" width="120%" height="125%"><feGaussianBlur stdDeviation="14"/></filter>`
    + `<filter id="${id}-blur" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="16"/></filter>`
    + `<filter id="${id}-hsoft" x="-30%" y="-40%" width="160%" height="180%"><feGaussianBlur stdDeviation="0.45"/></filter>`
    + `<linearGradient id="${id}-sticker" x1="${cx - ring.r}" y1="${cy - ring.r}" x2="${cx + ring.r}" y2="${cy + ring.r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${c.sticker[0]}"/><stop offset="1" stop-color="${c.sticker[1]}"/></linearGradient>`
    + `<radialGradient id="${id}-face" cx="${r1(cx - faceR * 0.3)}" cy="${r1(cy - faceR * 0.35)}" r="${r1(faceR * 1.4)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${c.face[0]}"/><stop offset="1" stop-color="${c.face[1]}"/></radialGradient>`
    + `<linearGradient id="${id}-band" x1="${cx - ring.r}" y1="0" x2="${cx + ring.r}" y2="0" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`
    + `<linearGradient id="${id}-bandlit" x1="${cx - ring.r}" y1="${cy - ring.r}" x2="${cx + ring.r}" y2="${cy + ring.r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#2a1204" stop-opacity="0.12"/></linearGradient>`
    + `</defs>`
    + plateSvg
    + sticker(small ? c.sticker[0] : `url(#${id}-sticker)`)
    + `<circle cx="${cx}" cy="${cy}" r="${r1(faceR + ring.track / 2)}" fill="none" stroke="${c.track}" stroke-width="${ring.track}"/>`
    + face
    + (small ? '' : `<circle cx="${cx}" cy="${cy}" r="${faceR - 3}" fill="none" stroke="#6e4c2e" stroke-opacity="0.08" stroke-width="6"/>`)
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
// Geometry in canvas units: ring, two circles, and the offset that centres the whole mark.
function glyphGeometry() {
  const R = GLYPH.r, band = R * GLYPH.band, track = R * GLYPH.track;
  const faceR = R - band, trackOuter = faceR + track;
  const dots = hamsterDots(GLYPH.cx, GLYPH.cy, trackOuter, GLYPH.dots);
  const xs = [GLYPH.cx - R, GLYPH.cx + R, dots.body[0] - dots.body[2], dots.body[0] + dots.body[2], dots.head[0] - dots.head[2], dots.head[0] + dots.head[2]];
  const ys = [GLYPH.cy - R, GLYPH.cy + R, dots.body[1] - dots.body[2], dots.body[1] + dots.body[2], dots.head[1] - dots.head[2], dots.head[1] + dots.head[2]];
  const dx = r1(512 - (Math.min(...xs) + Math.max(...xs)) / 2), dy = r1(512 - (Math.min(...ys) + Math.max(...ys)) / 2);
  const shift = ([x, y, r]) => [r1(x + dx), r1(y + dy), r];
  return { cx: r1(GLYPH.cx + dx), cy: r1(GLYPH.cy + dy), R, band: r1(band), track: r1(track), faceR: r1(faceR), body: shift(dots.body), head: shift(dots.head) };
}
function glyph({ fill = '#000' } = {}) {
  const g = glyphGeometry(), gap = GLYPH.dots.gap;
  const mid = g.R - g.band / 2, cap = capDegrees(g.band, mid);
  const ring = `<circle cx="${g.cx}" cy="${g.cy}" r="${r1(g.faceR + g.track / 2)}" fill="none" stroke="${fill}" stroke-width="${g.track}"/>`
    + `<path d="${arc(g.cx, g.cy, r1(mid), cap, GLYPH.bandEnd - cap)}" fill="none" stroke="${fill}" stroke-width="${g.band}" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><mask id="gap" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">`
    + `<rect width="1024" height="1024" fill="#fff"/>${circle([g.body[0], g.body[1], g.body[2] + gap], '#000')}${circle([g.head[0], g.head[1], g.head[2] + gap], '#000')}</mask></defs>`
    + `<g mask="url(#gap)">${ring}</g>${circle(g.body, fill)}${circle(g.head, fill)}</svg>`;
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
svg.traySticker = enlarge(colourIcon({ id: 'cwt', variant: 'small', plate: false }), 1.4);
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
// DashboardMenuBarIcon.swift draws the menu-bar glyph from these numbers.
console.log('Menu-bar glyph geometry (1024 canvas):', JSON.stringify({ ...glyphGeometry(), gap: GLYPH.dots.gap, bandEnd: GLYPH.bandEnd }));
