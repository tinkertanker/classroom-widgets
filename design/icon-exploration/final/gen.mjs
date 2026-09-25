// Final icon system generator: one notched countdown ring shared by every option.
// node gen.mjs  -> final.json (render.mjs format) + svg/ files
import fs from 'fs';

const r1 = n => Math.round(n * 10) / 10;
const P = (cx, cy, r, deg) => { const t = deg * Math.PI / 180; return [r1(cx + r * Math.sin(t)), r1(cy - r * Math.cos(t))]; };
// clockwise arc from a to b (degrees clockwise from 12 o'clock)
const arc = (cx, cy, r, a, b) => { const [x0, y0] = P(cx, cy, r, a), [x1, y1] = P(cx, cy, r, b); return `M${x0} ${y0}A${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x1} ${y1}`; };
const capDeg = (w, r) => (w / 2) / r * 180 / Math.PI;

// Band covers 0° → END (clockwise from 12) including its round caps; spent time is END → 360°.
const END = 250;

// The app's own ring gradient (timer.tsx runs red→magenta across the dial), warmed and de-neoned.
const RAINBOW = ['#ec5a4b', '#f48d2f', '#f4c332', '#5cb866', '#2fb2ad', '#4a8ddf', '#9868d8'];
const stops = (list) => list.map((c, i) => `<stop offset="${r1(i / (list.length - 1) * 100)}%" stop-color="${c}"/>`).join('');

// ---------- star (drawn fresh, rounded 5-point) ----------
const starPath = (cx, cy, R, rot = 0, inner = 0.5, round = 0.18) => {
  const pts = [];
  for (let i = 0; i < 10; i++) { const r = i % 2 ? R * inner : R; pts.push(P(cx, cy, r, rot + i * 36)); }
  // rounded corners with quadratic curves
  const lerp = (a, b, t) => [r1(a[0] + (b[0] - a[0]) * t), r1(a[1] + (b[1] - a[1]) * t)];
  let d = '';
  for (let i = 0; i < 10; i++) {
    const prev = pts[(i + 9) % 10], cur = pts[i], next = pts[(i + 1) % 10];
    const k = i % 2 ? round * 0.6 : round;
    const a = lerp(cur, prev, k), b = lerp(cur, next, k);
    d += (i ? 'L' : 'M') + a.join(' ') + 'Q' + cur.join(' ') + ' ' + b.join(' ');
  }
  return d + 'Z';
};

// ---------- the app's hamster (verbatim creatures.tsx markup) ----------
const HAMSTER = (dark) => `<ellipse cx="0" cy="0" rx="6" ry="4.5" fill="#D2691E" stroke="${dark ? '#e0b98a' : '#8B4513'}" stroke-width="0.8"/><circle cx="-4" cy="-1.5" r="3.5" fill="#DEB887" stroke="${dark ? '#e0b98a' : '#8B4513'}" stroke-width="0.8"/><circle cx="-5.5" cy="-3.5" r="1.3" fill="#D2691E"/><circle cx="-2.5" cy="-3.5" r="1.3" fill="#D2691E"/><circle cx="-5" cy="-1.5" r="0.7" fill="#000"/><circle cx="-3" cy="-1.5" r="0.7" fill="#000"/><circle cx="-4.8" cy="-1.8" r="0.3" fill="#fff"/><circle cx="-2.8" cy="-1.8" r="0.3" fill="#fff"/><circle cx="-6.5" cy="-0.5" r="0.4" fill="#8B4513"/><g><ellipse cx="-2.5" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" stroke-width="0.3"/><ellipse cx="-4" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" stroke-width="0.3"/><ellipse cx="1.5" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" stroke-width="0.3"/><ellipse cx="3" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" stroke-width="0.3"/></g><path d="M 4.5 0 Q 7 -1.5 8.5 1" stroke="${dark ? '#e0b98a' : '#8B4513'}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
const HAMSTER_SHADOW = `<ellipse cx="0" cy="0" rx="6.4" ry="4.9"/><circle cx="-4" cy="-1.5" r="3.9"/><ellipse cx="-3.25" cy="3.5" rx="1.9" ry="1.65"/><ellipse cx="2.25" cy="3.5" rx="1.9" ry="1.65"/>`;

// ---------- colour icon ----------
// o: { id, dark, small, extra: 'none'|'hamster'|'star', cx, cy, Rb, band, track, d }
function icon(o) {
  const { id, dark, small, extra } = o;
  const cx = o.cx ?? 512, cy = o.cy ?? 512;
  const Rb = o.Rb, band = o.band, track = o.track, d = o.d;
  const faceR = Rb - band, trackOuter = faceR + track, mid = Rb - band / 2;
  const cap = capDeg(band, mid);
  const bandD = arc(cx, cy, mid, cap, END - cap);
  const cutW = band + 2 * d;
  const C = dark
    ? { p0: '#7a5128', p1: '#5a3718', p2: '#3a220e', hi: '#ffe9c8', hiO: 0.07, lo: '#000', loO: 0.14, out: '#f3d9ae', outO: 0.22, stick: '#e9dfd0', stick2: '#cfc3b1', face0: '#3a342e', face1: '#2b2622', track: '#4c443b', shadow: '#000', shadowO: 0.5 }
    : { p0: '#dfa85b', p1: '#c8893f', p2: '#a9692b', hi: '#fff3dc', hiO: 0.13, lo: '#5a2c08', loO: 0.1, out: '#fff3dd', outO: 0.6, stick: '#ffffff', stick2: '#efe7da', face0: '#fffdf8', face1: '#f3ebdd', track: '#e4d9c6', shadow: '#3b2a14', shadowO: 0.34 };
  const rainbow = dark ? RAINBOW.map(c => c) : RAINBOW;
  const sticker = (fill, extraAttr = '') => `<g fill="${fill}" stroke="none" ${extraAttr}><circle cx="${cx}" cy="${cy}" r="${trackOuter + d}"/><path d="${bandD}" fill="none" stroke="${fill}" stroke-width="${cutW}" stroke-linecap="round"/></g>`;

  // star geometry (in the spent sector, upper-left)
  let starSvg = '', starCut = '';
  if (extra === 'star') {
    const sa = END + (360 - END) * 0.5; // middle of the spent sector
    const [sx, sy] = P(cx, cy, o.starOrbit, sa);
    const sp = starPath(sx, sy, o.starR, -14);
    const border = small ? o.starR * 0.2 : o.starR * 0.17;
    starCut = `<path d="${sp}" fill="${C.stick}" stroke="${C.stick}" stroke-width="${r1(border * 2)}" stroke-linejoin="round"/>`;
    const sg = `${id}-star`;
    starSvg = `
      ${small ? '' : `<path d="${sp}" fill="${C.shadow}" fill-opacity="${C.shadowO}" stroke="${C.shadow}" stroke-opacity="${C.shadowO}" stroke-width="${r1(border * 2)}" stroke-linejoin="round" transform="translate(8 14)" filter="url(#${id}-blur)"/>`}
      ${starCut}
      <path d="${sp}" fill="url(#${sg})"/>
      ${small ? '' : `<path d="${starPath(sx - o.starR * 0.08, sy - o.starR * 0.1, o.starR * 0.55, -14)}" fill="#fff6d8" fill-opacity="0.35"/>`}`;
  }

  let hamsterSvg = '';
  if (extra === 'ham2') hamsterSvg = ham2(cx, cy, faceR, '#D2691E', '#DEB887', '#8B4513', r1(faceR * 0.06));
  if (extra === 'hamster') {
    const hs = o.hamScale, hx = cx + (o.hamDx ?? 0), hy = cy + (o.hamDy ?? 0);
    hamsterSvg = `
      <ellipse cx="${hx}" cy="${r1(hy + 5.2 * hs)}" rx="${r1(7.4 * hs)}" ry="${r1(1.3 * hs)}" fill="#6b4a26" fill-opacity="${dark ? 0.35 : 0.16}" filter="url(#${id}-soft)"/>
      <g transform="translate(${hx} ${hy}) scale(${-hs} ${hs})">
        <g transform="translate(-0.25 0.4)" fill="#5b4a32" opacity="${dark ? 0.4 : 0.22}" filter="url(#${id}-hsoft)">${HAMSTER_SHADOW}<path d="M 4.5 0 Q 7 -1.5 8.5 1" stroke="#5b4a32" stroke-width="1.2" fill="none" stroke-linecap="round"/></g>
        ${HAMSTER(dark)}
      </g>`;
  }

  const plate = small
    ? `<rect x="100" y="100" width="824" height="824" rx="185" fill="${dark ? C.p1 : C.p1}"/>`
    : `<rect x="108" y="114" width="808" height="814" rx="182" fill="#3b2410" fill-opacity="0.3" filter="url(#${id}-drop)"/>
       <g clip-path="url(#${id}-clip)">
         <rect x="100" y="100" width="824" height="824" fill="url(#${id}-plate)"/>
         <path d="M470 100L924 100L924 600Z" fill="${C.hi}" fill-opacity="${C.hiO}"/>
         <path d="M100 470L100 924L660 924Z" fill="${C.lo}" fill-opacity="${C.loO}"/>
         ${sticker(C.shadow, `opacity="${C.shadowO}" transform="translate(10 18)" filter="url(#${id}-blur)"`)}
       </g>
       <rect x="104" y="104" width="816" height="816" rx="181" fill="none" stroke="${C.out}" stroke-opacity="${C.outO}" stroke-width="8"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>
    <linearGradient id="${id}-plate" x1="0.12" y1="0.02" x2="0.88" y2="0.98"><stop offset="0" stop-color="${C.p0}"/><stop offset="0.55" stop-color="${C.p1}"/><stop offset="1" stop-color="${C.p2}"/></linearGradient>
    <clipPath id="${id}-clip"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath>
    <filter id="${id}-drop" x="-10%" y="-10%" width="120%" height="125%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id="${id}-blur" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="16"/></filter>
    <filter id="${id}-soft" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="${id}-hsoft" x="-30%" y="-40%" width="160%" height="180%"><feGaussianBlur stdDeviation="0.45"/></filter>
    <linearGradient id="${id}-stick" x1="${cx - Rb}" y1="${cy - Rb}" x2="${cx + Rb}" y2="${cy + Rb}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.stick}"/><stop offset="1" stop-color="${C.stick2}"/></linearGradient>
    <radialGradient id="${id}-face" cx="${cx - faceR * 0.3}" cy="${cy - faceR * 0.35}" r="${faceR * 1.4}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.face0}"/><stop offset="1" stop-color="${C.face1}"/></radialGradient>
    <linearGradient id="${id}-band" x1="${cx - Rb}" y1="0" x2="${cx + Rb}" y2="0" gradientUnits="userSpaceOnUse">${stops(rainbow)}</linearGradient>
    <linearGradient id="${id}-bandlit" x1="${cx - Rb}" y1="${cy - Rb}" x2="${cx + Rb}" y2="${cy + Rb}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#2a1204" stop-opacity="0.12"/></linearGradient>
    <linearGradient id="${id}-star" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc53d"/><stop offset="1" stop-color="#f7892a"/></linearGradient>
  </defs>
  ${plate}
  ${sticker(small ? C.stick : `url(#${id}-stick)`)}
  <circle cx="${cx}" cy="${cy}" r="${r1(faceR + track / 2)}" fill="none" stroke="${C.track}" stroke-width="${track}"/>
  <circle cx="${cx}" cy="${cy}" r="${faceR}" fill="${small ? C.face0 : `url(#${id}-face)`}"/>
  ${small ? '' : `<circle cx="${cx}" cy="${cy}" r="${faceR - 3}" fill="none" stroke="#6e4c2e" stroke-opacity="${dark ? 0.3 : 0.08}" stroke-width="6"/>`}
  <path d="${bandD}" fill="none" stroke="url(#${id}-band)" stroke-width="${band}" stroke-linecap="round"/>
  ${small ? '' : `<path d="${bandD}" fill="none" stroke="url(#${id}-bandlit)" stroke-width="${band}" stroke-linecap="round"/>`}
  ${hamsterSvg}
  ${starSvg}
</svg>`.replace(/\n\s*/g, '');
}

// ---------- two-circle hamster (body + head), facing right like the colour icon ----------
// positions/radii are fractions of the face (counter) radius
const HAM2 = { body: { x: -0.15, y: 0.13, r: 0.44 }, head: { x: 0.38, y: -0.2, r: 0.29 } };
const ham2 = (cx, cy, faceR, fillBody, fillHead, stroke = '', sw = 0) => {
  const b = HAM2.body, h = HAM2.head;
  const st = stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : '';
  return `<circle cx="${r1(cx + b.x * faceR)}" cy="${r1(cy + b.y * faceR)}" r="${r1(b.r * faceR)}" fill="${fillBody}"${st}/><circle cx="${r1(cx + h.x * faceR)}" cy="${r1(cy + h.y * faceR)}" r="${r1(h.r * faceR)}" fill="${fillHead}"${st}/>`;
};

// ---------- monochrome glyph ----------
// f = fraction of the dial still to run (idle mark uses END/360)
function glyph(id, { f = END / 360, star = false, hamster = false } = {}) {
  const cx = star ? 604 : 512, cy = star ? 604 : 512, R = star ? 404 : 504;
  const band = r1(R * 0.365), track = r1(R * 0.115);
  const faceR = R - band, mid = R - band / 2;
  const cap = capDeg(band, mid);
  const endDeg = 360 * f;
  let bandEl = '';
  if (endDeg >= 359.9) bandEl = `<circle cx="${cx}" cy="${cy}" r="${mid}" fill="none" stroke="#000" stroke-width="${band}"/>`;
  else if (endDeg > 2 * cap + 1) bandEl = `<path d="${arc(cx, cy, mid, cap, endDeg - cap)}" fill="none" stroke="#000" stroke-width="${band}" stroke-linecap="round"/>`;
  else if (endDeg > 0) { const [x, y] = P(cx, cy, mid, endDeg / 2); bandEl = `<circle cx="${x}" cy="${y}" r="${band / 2}" fill="#000"/>`; }
  const ring = `<circle cx="${cx}" cy="${cy}" r="${r1(faceR + track / 2)}" fill="none" stroke="#000" stroke-width="${track}"/>${bandEl}`;
  if (!star) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${ring}${hamster ? ham2(cx, cy, faceR, '#000', '#000') : ''}</svg>`;
  const sa = END + (360 - END) * 0.5;
  const [sx, sy] = P(cx, cy, R * 1.2, sa);
  const sp = starPath(sx, sy, 176, -14, 0.5, 0.16);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><mask id="${id}-m" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="#fff"/><path d="${sp}" fill="#000" stroke="#000" stroke-width="140" stroke-linejoin="round"/></mask></defs><g mask="url(#${id}-m)">${ring}</g><path d="${sp}" fill="#000"/></svg>`;
}

// ---------- the three options ----------
const RING_BIG = { Rb: 298, band: 96, track: 34, d: 24 };
const RING_SMALL = { Rb: 352, band: 138, track: 50, d: 40 };
const STAR_BIG = { ...RING_BIG, cx: 548, cy: 548, Rb: 272, band: 88, track: 31, d: 22, starOrbit: 262, starR: 118 };
const STAR_SMALL = { ...RING_SMALL, cx: 556, cy: 556, Rb: 318, band: 124, track: 46, d: 36, starOrbit: 300, starR: 150 };

const out = [];
const add = (slug, name, tagline, concept, glyphNotes, big, small, extra, gl) => {
  const c = {
    slug, name, tagline, concept, glyphNotes, direction: 'Final system',
    icon: icon({ id: slug, ...big, extra }),
    iconDark: icon({ id: slug + 'd', dark: true, ...big, extra }),
    iconSmall: icon({ id: slug + 's', small: true, ...small, extra: extra === 'star' ? 'star' : extra === 'hamster' ? 'ham2' : 'none' }),
    glyph: gl,
  };
  out.push(c);
};

add('countdown', 'Countdown Sticker',
  'The app\'s rainbow timer as one of its own die-cut stickers, with the time already spent cut out.',
  'The timer teachers watch all lesson, cut out as a sticker. The spent time is missing from the sticker itself, so one silhouette works as the app icon, the favicon and the menu-bar item, and it can count down live.',
  'Thick band, thin track on the band\'s inner edge, true-circle counter. The notch widens while a timer runs; at time\'s up only the thin track is left.',
  RING_BIG, RING_SMALL, 'none', glyph('countdowng'));

add('hamster', 'Hamster Timer',
  'The app\'s own hamster sitting in the countdown sticker. At small sizes and in the menu bar it becomes two circles: a big body and a smaller head.',
  'A responsive mark. Large sizes (Dock, Start, app grid, PWA) show the hamster at home in the timer. At 32px and below, and in the menu bar/tray, it simplifies to two circles (body and head, facing right like the full hamster) inside the same notched ring.',
  'The notched ring with a two-circle hamster silhouette in its hole, clear of the ring by at least 1.2px at 16px. The ring counts down; the hamster stays put.',
  { ...RING_BIG, extra: 'hamster', hamScale: 18.5, hamDx: -4, hamDy: 8 }, RING_SMALL, 'hamster', glyph('hamsterg', { hamster: true }));

add('goldstar', 'Gold Star Timer',
  'The client\'s pick: the app\'s gold star sticker slapped into the spent part of the countdown ring.',
  'The countdown sticker with a chunky gold star, slapped over the spent notch at upper left. The star fills the gap where the time has gone, like a reward stuck on the timer. The star is drawn fresh rather than taken from an icon font.',
  'The notched ring plus a solid star in the spent sector, cut free by a wide knockout. At 16px it reads as ring + star; it keeps the same live countdown behaviour.',
  STAR_BIG, STAR_SMALL, 'star', glyph('goldstarg', { star: true }));

// icons with hamster need the scale passed through
out[1].icon = icon({ id: 'hamster', ...RING_BIG, extra: 'hamster', hamScale: 18.5, hamDx: -4, hamDy: 8 });
out[1].iconDark = icon({ id: 'hamsterd', dark: true, ...RING_BIG, extra: 'hamster', hamScale: 18.5, hamDx: -4, hamDy: 8 });

fs.writeFileSync(new URL('./final.json', import.meta.url), JSON.stringify(out, null, 1));
fs.mkdirSync(new URL('./svg/', import.meta.url), { recursive: true });
for (const c of out) for (const k of ['icon', 'iconDark', 'iconSmall', 'glyph']) fs.writeFileSync(new URL(`./svg/${c.slug}-${k}.svg`, import.meta.url), c[k]);
// live states for the ring glyph
const states = [1, 0.75, 0.5, 0.25, 0.08, 0].map(f => ({ f, svg: glyph('liveg' + Math.round(f * 100), { f, hamster: true }) }));
fs.writeFileSync(new URL('./live.json', import.meta.url), JSON.stringify(states));
console.log('ok', out.map(c => c.slug).join(', '));
