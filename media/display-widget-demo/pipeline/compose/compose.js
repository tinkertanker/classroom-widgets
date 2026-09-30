// Frame-deterministic composer for the "Using the desktop Display widget" demo.
// window.renderAt(t) paints the frame at time t (seconds). Timings come from ../timeline.json,
// which build_timeline.mjs derives from the narration audio durations.
(async function () {
const TL = await (await fetch('../timeline.json')).json();
const E = TL.E;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// ---------- helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, p) => a + (b - a) * p;
const ease = (p) => { p = clamp(p); return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
const easeOut = (p) => 1 - Math.pow(1 - clamp(p), 3);
const ramp = (t, a, b) => clamp((t - a) / (b - a));
// fade in over fi at a, fade out over fo ending at b
const win = (t, a, b, fi = .3, fo = .3) => Math.min(ease(ramp(t, a, a + fi)), 1 - ease(ramp(t, b - fo, b)));

// ---------- geometry ----------
const LAP = { x: 110, y: 250, w: 752, h: 470, lw: 1152, lh: 720 }; LAP.s = LAP.w / LAP.lw;
const PRJ = { x: 950, y: 235, w: 880, h: 495, lw: 1280, lh: 720 }; PRJ.s = PRJ.w / PRJ.lw;
const DISPW = { x: 336, y: 218, w: 480, pvTop: 38, pvH: 270 }; DISPW.ps = DISPW.w / PRJ.lw; // 0.375
const TIMER_LAP = { x: 12, y: 36 }, TIMER_PRJ = { x: 12, y: 80 }, TIMER_SIZE = { w: 350, h: 415 };
const START_BTN = { x: TIMER_LAP.x + 50, y: TIMER_LAP.y + 382 };

// ---------- DOM builders ----------
const CURSOR_SVG = `<svg class="cursor" viewBox="0 0 30 44"><path d="M3 2 L3 35 L11 27.5 L16.5 40 L22 37.6 L16.8 25.6 L27 25.6 Z" fill="#111" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/></svg>`;
const DOCK_COLOURS = ['#4a7ccc', '#67a47f', '#f5c536', '#e8784f', '#8b6fd6', '#39a0a8', '#cc7d4a', '#d6d2cc'];

function sysSettingsHTML() {
  const side = [['Wi-Fi', '#3478f6'], ['Bluetooth', '#3478f6'], ['Network', '#3478f6'], ['Displays', '#4a90e2'], ['Sound', '#e8505b'], ['Keyboard', '#8e8e93'], ['Desktop & Dock', '#1c1c1e']];
  return `<div class="win sysset" style="left:216px;top:92px;width:720px;height:470px">
    <div class="tb"><span class="lights"><i></i><i></i><i></i></span></div>
    <div class="cols"><div class="side"><div class="search">Search</div>
      ${side.map(([n, c]) => `<div class="si ${n === 'Displays' ? 'on' : ''}"><i style="background:${c}"></i>${n}</div>`).join('')}</div>
      <div class="main"><h2>Displays</h2>
        <div class="tiles"><div class="tile"><div class="scr" style="width:92px;height:58px"></div>Built-in Display</div>
          <div class="tile sel"><div class="scr" style="width:112px;height:63px"></div>Projector</div></div>
        <div class="rows">
          <div class="row"><span>Use as</span><span class="popup"><span class="pval">Mirror for Built-in Display</span>
            <div class="menu"><div class="mi" data-y="0">Main display</div><div class="mi" data-y="1">Extended display</div><div class="mi chk" data-y="2">Mirror for Built-in Display</div></div></span></div>
          <div class="row"><span>Resolution</span><span class="popup">Default for display</span></div>
          <div class="row"><span>Refresh rate</span><span class="popup">60 Hertz</span></div>
        </div></div></div></div>`;
}

let projN = 0;
function projectorExtHTML() {
  const gid = 'sea' + (projN++);
  let drops = '';
  for (let i = 0; i < 18; i++) drops += `<line class="drop" x1="0" y1="0" x2="-4" y2="20" stroke="#4a7ccc" stroke-width="4" stroke-linecap="round"/>`;
  return `<div class="ext">
    <div class="slide slide1">
      <svg width="1280" height="720" style="position:absolute;left:0;top:0">
        <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6da0db"/><stop offset="1" stop-color="#3865b8"/></linearGradient></defs>
        <circle cx="1130" cy="140" r="62" fill="#f5c536"/>
        <path d="M60 575 L260 360 L380 470 L470 390 L640 575 Z" fill="#8fbba0"/><path d="M260 360 L300 402 L230 392 Z" fill="#fff"/>
        <g fill="#fff" stroke="#d6d2cc" stroke-width="3"><circle cx="700" cy="300" r="52"/><circle cx="770" cy="270" r="66"/><circle cx="850" cy="300" r="50"/><rect x="680" y="300" width="190" height="52" rx="26"/></g>
        <g fill="#fff"><circle cx="700" cy="300" r="49"/><circle cx="770" cy="270" r="63"/><circle cx="850" cy="300" r="47"/><rect x="683" y="303" width="184" height="46" rx="23"/></g>
        <g class="rain">${drops}</g>
        <path d="M0 560 Q 80 545 160 560 T 320 560 T 480 560 T 640 560 T 800 560 T 960 560 T 1120 560 T 1280 560 L1280 720 L0 720 Z" fill="url(#${gid})"/>
        <g class="evap" fill="none" stroke="#99bce8" stroke-width="5" stroke-linecap="round" stroke-dasharray="14 12">
          <path d="M1000 540 q -16 -40 0 -80 q 16 -40 0 -80"/><path d="M1060 540 q -16 -40 0 -80 q 16 -40 0 -80"/><path d="M1120 540 q -16 -40 0 -80 q 16 -40 0 -80"/></g>
      </svg>
      <h1 style="left:80px;top:62px">The Water Cycle</h1>
      <div class="st" style="left:84px;top:162px">Evaporation · Condensation · Precipitation</div>
      <div class="foot">1 / 6</div>
      <div class="next">Next ›</div>
    </div>
    <div class="slide slide2">
      <h1 style="left:430px;top:62px">Your turn</h1>
      <div class="st" style="left:434px;top:162px">Label the water cycle diagram</div>
      <div class="body">Use these words:<br><span class="chipw">evaporation</span><span class="chipw">condensation</span><span class="chipw">precipitation</span><span class="chipw">collection</span><br><br>You have <b>5 minutes</b>.</div>
      <div class="foot" style="color:#948b7f">2 / 6</div>
      <div class="next">Next ›</div>
    </div>
  </div>`;
}

function projectorHTML(withCursor) {
  return `<div class="proj"><div class="mirror"></div>${projectorExtHTML()}${withCursor ? CURSOR_SVG + '<div class="ripple"></div>' : ''}</div>`;
}

function laptopHTML(withWidget) {
  return `<div class="desk">
    <div class="menubar"><span class="logo-dot"></span><b>Notes</b><span>File</span><span>Edit</span><span>View</span><span>Window</span>
      <span class="right"><span class="cw"></span><span class="batt"></span><span>Tue 9:41</span></span></div>
    <div class="win notes" style="left:520px;top:92px;width:560px;height:460px">
      <div class="tb"><span class="lights"><i></i><i></i><i></i></span>Lesson notes</div>
      <div class="body"><h3>Period 3 · Year 8 Science</h3><div class="sub">Room 2.14 · 32 students</div>
        <div class="item"><span class="box"></span>Water cycle intro (slides)</div>
        <div class="item"><span class="box"></span>Label the diagram · 5 min</div>
        <div class="item"><span class="box"></span>Exit ticket</div>
        <div class="line" style="width:88%"></div><div class="line" style="width:72%"></div><div class="line" style="width:80%"></div><div class="line" style="width:54%"></div></div></div>
    ${sysSettingsHTML()}
    ${withWidget ? `<div class="dispw"><div class="chrome"><span class="lights"><i></i><i></i><i></i></span><span class="btns">
        <span class="btn on"><svg width="13" height="13" viewBox="0 0 16 16"><path d="M8 1.5v6" stroke="#39744c" stroke-width="2" stroke-linecap="round"/><path d="M4.4 3.8a5.5 5.5 0 1 0 7.2 0" fill="none" stroke="#39744c" stroke-width="2" stroke-linecap="round"/></svg></span>
        <span class="btn"><svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.6" fill="none" stroke="#514b44" stroke-width="1.5"/><circle cx="5" cy="8" r="1.1" fill="#514b44"/><circle cx="8" cy="8" r="1.1" fill="#514b44"/><circle cx="11" cy="8" r="1.1" fill="#514b44"/></svg></span></span></div>
      <div class="pvglow"></div><div class="pv"><div class="screen">${projectorHTML(true)}</div></div></div>` : ''}
    <div class="dock">${DOCK_COLOURS.map(c => `<i style="background:${c}"></i>`).join('')}</div>
    ${CURSOR_SVG}<div class="ripple"></div>
  </div>`;
}

// Real laptop screen
const lapRoot = $('#lapRoot');
lapRoot.style.width = LAP.lw + 'px'; lapRoot.style.height = LAP.lh + 'px'; lapRoot.style.transform = `scale(${LAP.s})`;
lapRoot.innerHTML = laptopHTML(true);
// Projector screen (with a mirror clone of the laptop)
const projRoot = $('#projRoot');
projRoot.style.width = PRJ.lw + 'px'; projRoot.style.height = PRJ.lh + 'px'; projRoot.style.transform = `scale(${PRJ.s})`;
projRoot.innerHTML = projectorHTML(true);
$('.mirror', projRoot).innerHTML = `<div class="screen" style="width:1152px;height:720px">${laptopHTML(false)}</div>`;
const pvRoot = $('.dispw .pv .proj', lapRoot);
function logicalRect(el, rootEl, lw) { const d = rootEl.getBoundingClientRect(), r = el.getBoundingClientRect(), k = d.width / lw;
  return { x: (r.left - d.left) / k, y: (r.top - d.top) / k, w: r.width / k, h: r.height / k }; }
const M = {};
{ const desk = $('.desk', lapRoot); const pop = logicalRect($('.sysset .popup', desk), desk, 1152);
  M.popup = { x: pop.x + pop.w * .55, y: pop.y + pop.h / 2 };
  M.items = $$('.sysset .mi', desk).map(mi => logicalRect(mi, desk, 1152));
  const pr = $(':scope > .proj', projRoot); const nb = logicalRect($('.slide1 .next', pr), pr, 1280);
  M.next = { x: nb.x + nb.w * .45, y: nb.y + nb.h * .55 }; }
const mirrorLap = $('.mirror .desk', projRoot);
const lapDesk = $('.desk', lapRoot);
const extRoots = [$(':scope > .proj > .ext', projRoot) || $('.ext', projRoot), $('.ext', pvRoot)];

// Device labels (two per device, crossfaded)
const NEXT_BTN = M.next;
const PREVIEW_PT = { x: DISPW.x + NEXT_BTN.x * DISPW.ps, y: DISPW.y + DISPW.pvTop + NEXT_BTN.y * DISPW.ps };
const cam = $('#cam');
cam.insertBefore($('#cable'), cam.firstChild);
$$('.devlabel').forEach(e => e.remove());
function mkLabel(text, dot, left) {
  const d = document.createElement('div'); d.className = 'devlabel';
  d.innerHTML = `<span class="dot ${dot}"></span><span>${text}</span>`; d.style.left = left + 'px'; cam.appendChild(d); return d;
}
const labLapA = mkLabel('Laptop', 'sage', 486), labLapB = mkLabel('Laptop · your working screen', 'sage', 486);
const labPrjA = mkLabel('Projector', 'terra', 1390), labPrjB = mkLabel('Projector · what the class sees', 'terra', 1390);

// ---------- stickers ----------
const STICKERS = {
  star: { vb: '0 0 576 512', color: '#f5c536', body: `<path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" fill="url(#G)"/>`, grad: .7 },
  heart: { vb: '0 0 512 512', color: '#ec5b6e', body: `<path d="M47.6 300.4L228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z" fill="url(#G)"/>`, grad: .6 },
  smile: { vb: '0 0 512 512', color: '#4a8fe0', body: `<circle cx="256" cy="256" r="240" fill="url(#G)"/><ellipse cx="180" cy="200" rx="28" ry="42" fill="white"/><ellipse cx="332" cy="200" rx="28" ry="42" fill="white"/><path d="M180 320 Q256 380 332 320" stroke="white" stroke-width="36" fill="none" stroke-linecap="round"/>`, grad: .6 },
  rainbow: { vb: '0 60 512 360', color: '#000', body: `<g transform="translate(0, 60)"><path d="M256 80C362 80 448 166 448 272L448 320L416 320L416 272C416 183 343 112 256 112C169 112 96 183 96 272L96 320L64 320L64 272C64 166 150 80 256 80Z" fill="#ff4444"/><path d="M256 112C343 112 416 183 416 272L416 320L384 320L384 272C384 201 327 144 256 144C185 144 128 201 128 272L128 320L96 320L96 272C96 183 169 112 256 112Z" fill="#ff8800"/><path d="M256 144C327 144 384 201 384 272L384 320L352 320L352 272C352 219 309 176 256 176C203 176 160 219 160 272L160 320L128 320L128 272C128 201 185 144 256 144Z" fill="#ffdd00"/><path d="M256 176C309 176 352 219 352 272L352 320L320 320L320 272C320 237 291 208 256 208C221 208 192 237 192 272L192 320L160 320L160 272C160 219 203 176 256 176Z" fill="#44dd44"/><path d="M256 208C291 208 320 237 320 272L320 320L288 320L288 272C288 255 273 240 256 240C239 240 224 255 224 272L224 320L192 320L192 272C192 237 221 208 256 208Z" fill="#4488ff"/><path d="M256 240C273 240 288 255 288 272L288 320L224 320L224 272C224 255 239 240 256 240Z" fill="#8844ff"/></g>`, grad: 1 },
};
let sid = 0;
function stickerSVG(name, size) {
  const s = STICKERS[name]; const id = 'st' + (sid++); const R = 30;
  const [vx, vy, vw, vh] = s.vb.split(' ').map(Number);
  const h = size * vh / vw;
  return `<svg width="${size}" height="${h}" viewBox="${vx} ${vy} ${vw} ${vh}" style="color:${s.color}">
    <defs><radialGradient id="${id}g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="currentColor" stop-opacity="${s.grad}"/><stop offset="100%" stop-color="currentColor" stop-opacity="1"/></radialGradient>
    <filter id="${id}f" x="-40%" y="-40%" width="180%" height="180%">
      <feMorphology in="SourceAlpha" operator="dilate" radius="${R}" result="d"/>
      <feGaussianBlur in="d" stdDeviation="${R * .45}" result="db"/>
      <feComponentTransfer in="db" result="border"><feFuncA type="linear" slope="6" intercept="-2.2"/></feComponentTransfer>
      <feFlood flood-color="#fffdf8" result="w"/><feComposite in="w" in2="border" operator="in" result="wb"/>
      <feGaussianBlur in="border" stdDeviation="${R * .7}" result="sh"/><feOffset in="sh" dx="${R * .35}" dy="${R * .6}" result="sho"/>
      <feComponentTransfer in="sho" result="shadow"><feFuncA type="linear" slope=".38"/></feComponentTransfer>
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="wb"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <g filter="url(#${id}f)">${s.body.replaceAll('url(#G)', `url(#${id}g)`)}</g></svg>`;
}
function placeStickers(card, list) {
  const box = $('.stickers', card);
  for (const st of list) {
    const d = document.createElement('div'); d.className = 'sticker';
    d.style.left = st.x + 'px'; d.style.top = st.y + 'px'; d.innerHTML = stickerSVG(st.name, st.size);
    d.dataset.rot = st.rot; d.dataset.delay = st.delay; d.dataset.ph = st.ph; box.appendChild(d);
  }
}
const cardIntro = $('#cardIntro'), cardOutro = $('#cardOutro');
placeStickers(cardIntro, [
  { name: 'star', x: 250, y: 130, size: 170, rot: -12, delay: .7, ph: 0 },
  { name: 'heart', x: 130, y: 760, size: 165, rot: -10, delay: .95, ph: 1.3 },
  { name: 'rainbow', x: 1480, y: 690, size: 190, rot: 8, delay: 1.2, ph: 2.1 },
  { name: 'smile', x: 1660, y: 800, size: 150, rot: 10, delay: 1.45, ph: 3.2 }]);
placeStickers(cardOutro, [
  { name: 'star', x: 250, y: 110, size: 165, rot: -12, delay: .5, ph: .4 },
  { name: 'heart', x: 120, y: 740, size: 160, rot: -8, delay: .7, ph: 1.1 },
  { name: 'rainbow', x: 1475, y: 660, size: 180, rot: 6, delay: .9, ph: 2.3 },
  { name: 'smile', x: 1665, y: 760, size: 150, rot: 10, delay: 1.1, ph: 3.0 }]);
{ const names = ['Timer', 'Display', 'Text Banner', 'Traffic Light', 'Task Cue', 'Randomiser', 'List', 'QR Code', 'Sound Effects', 'Stickers', 'Poll', 'Questions'];
  const sp = '\u00a0\u00a0\u00a0•\u00a0\u00a0\u00a0'; const s = names.join(sp) + sp; $('.tick-inner', cardOutro).textContent = s + s + s; }
// card layout
Object.assign($('.logo', cardIntro).style, { top: '10px', width: '470px', height: '470px', marginLeft: '-235px' });
Object.assign($('.title', cardIntro).style, { top: '455px' });
Object.assign($('.subtitle', cardIntro).style, { top: '640px' });
Object.assign($('.small', cardIntro).style, { top: '742px' });
Object.assign($('.logo', cardOutro).style, { top: '-22px', width: '400px', height: '400px', marginLeft: '-200px' });
Object.assign($('.title', cardOutro).style, { top: '345px', fontSize: '120px' });
Object.assign($('.subtitle', cardOutro).style, { top: '520px', fontSize: '50px' });
Object.assign($('.link', cardOutro).style, { top: '625px' });
Object.assign($('.platforms', cardOutro).style, { top: '835px' });

// ---------- timer frames (real widget captures) ----------
const timerImgs = {};
const tnames = ['idle_chrome', 'idle_nochrome'];
for (let i = 0; i < 510; i++) tnames.push('run_' + String(i).padStart(4, '0'));
for (let i = 0; i < 60; i++) tnames.push('run_chrome_' + String(i).padStart(4, '0'));
await Promise.all(tnames.map(n => new Promise((res) => {
  const im = new Image(); im.onload = () => im.decode().then(res, res); im.onerror = res; im.src = `../assets/timer/${n}.png`; timerImgs[n] = im;
})));
function mkTimer(parent, cls, before) {
  const d = document.createElement('div'); d.className = 'timerwin ' + cls;
  d.innerHTML = '<canvas width="525" height="622"></canvas>';
  if (before) parent.insertBefore(d, before); else parent.appendChild(d); return d;
}
$('#timerWin').remove();
const lapTimer = mkTimer($('#lapWrap'), 'real'), prjTimer = mkTimer($('#projWrap'), 'real');
const ghostTimer = mkTimer($('#cam'), 'ghost', $('#laptop'));
const timerEls = [lapTimer, prjTimer, ghostTimer];
let lastTimerName = '';

// ---------- cursor path in virtual desktop coordinates (laptop 0..1152, projector 1152..2432) ----------
const VX = LAP.lw;
const path = [{ t: 0, x: 700, y: 560 }];
const moveTo = (a, b, x, y) => { path.push({ t: a, hold: true }); path.push({ t: b, x, y }); };
const findChunk = (n) => TL.chunks.find(c => c.name === n);
const roles = findChunk('roles_0'), ext0 = findChunk('extend_0');
moveTo(ext0.start + .8, E.popupClick - .15, M.popup.x, M.popup.y);
moveTo(E.popupClick + .35, E.menuPick - .2, M.items[1].x + 70, M.items[1].y + M.items[1].h / 2);
moveTo(roles.start + .4, roles.start + 1.6, 985, 610);
moveTo(E.notesClickMove[0], E.notesClickMove[1], 960, 470);
moveTo(E.previewMove[0], E.previewMove[1], PREVIEW_PT.x, PREVIEW_PT.y);
path.push({ t: E.jump - 1e-3, hold: true }); path.push({ t: E.jump, x: VX + NEXT_BTN.x, y: NEXT_BTN.y, jump: true });
moveTo(E.startMove[0], E.startMove[1], START_BTN.x, START_BTN.y);
moveTo(E.awayMove[0], E.awayMove[1], 600, 610);
// resolve holds
{ let last = path[0]; for (const p of path) { if (p.hold) { p.x = last.x; p.y = last.y; } last = p; } }
function cursorAt(t) {
  let i = 0; while (i < path.length - 1 && path[i + 1].t <= t) i++;
  const a = path[i], b = path[i + 1];
  if (!b) return { x: a.x, y: a.y };
  if (b.jump) return { x: a.x, y: a.y };
  const p = ease((t - a.t) / (b.t - a.t));
  return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) };
}
const onLaptop = (c) => c.x < VX;
const inRect = (c, x, y, w, h) => onLaptop(c) && c.x >= x && c.x <= x + w && c.y >= y && c.y <= y + h;

function placeCursor(root, show, x, y) {
  const el = $(':scope > .cursor', root); if (!el) return;
  el.style.display = show ? 'block' : 'none';
  if (show) el.style.transform = `translate(${x - 3}px, ${y - 2}px)`;
}
function placeRipple(root, t, screen) {
  const el = $(':scope > .ripple', root); if (!el) return;
  let shown = false;
  for (const c of TL.clicks) {
    const p = (t - c.t) / .5;
    if (c.screen === screen && p >= 0 && p <= 1) {
      const pos = cursorAt(c.t); const x = screen === 'laptop' ? pos.x : pos.x - VX; const y = pos.y;
      const r = 10 + 34 * easeOut(p);
      Object.assign(el.style, { display: 'block', left: (x - r) + 'px', top: (y - r) + 'px', width: 2 * r + 'px', height: 2 * r + 'px', opacity: 1 - p });
      shown = true;
    }
  }
  if (!shown) el.style.display = 'none';
}

// ---------- per-root updaters ----------
function updateLaptopDesk(desk, t, cur, isMirror) {
  // System Settings window
  const ss = $('.sysset', desk);
  const so = win(t, E.settingsOpen, E.settingsClose + .25, .3, .25);
  ss.style.opacity = so; ss.style.display = so > 0 ? 'flex' : 'none';
  ss.style.transform = `translateY(${(1 - ease(ramp(t, E.settingsOpen, E.settingsOpen + .35))) * 10}px)`;
  const menuOpen = t >= E.popupClick && t < E.menuPick;
  $('.menu', ss).style.display = menuOpen ? 'block' : 'none';
  const extended = t >= E.menuPick;
  $('.pval', ss).textContent = extended ? 'Extended display' : 'Mirror for Built-in Display';
  $$('.mi', ss).forEach((mi, i) => {
    // popup at y≈392 (row centre); items at 392+30+5+14+28*i
    const r = M.items[i];
    mi.classList.toggle('hov', menuOpen && onLaptop(cur) && cur.y >= r.y && cur.y < r.y + r.h && cur.x >= r.x && cur.x <= r.x + r.w);
  });
  // notes window focus: inactive while Settings or the Display widget took focus, active after the click
  const notes = $('.notes', desk);
  const notesActive = (t < E.settingsOpen) || (t >= E.settingsClose && t < E.displayOpen) || (t >= E.notesClick && t < E.timerOpen);
  notes.classList.toggle('inactive', !notesActive);
  ss.classList.toggle('inactive', false);
  // Display widget
  const dw = $('.dispw', desk);
  if (dw) {
    const o = Math.min(ease(ramp(t, E.displayOpen, E.displayOpen + .25)), 1 - ease(ramp(t, E.displayClose, E.displayClose + .2)));
    dw.style.display = o > 0 ? 'block' : 'none'; dw.style.opacity = o;
    const sc = lerp(.965, 1, ease(ramp(t, E.displayOpen, E.displayOpen + .25)));
    dw.style.transform = `scale(${sc})`; dw.style.transformOrigin = '50% 50%';
    // chrome: shown on open, while the pointer is over the panel, and for 2 s after it leaves (0.16 s fade)
    const vis = (s) => (s >= E.displayOpen && s <= E.displayOpen + 2) || inRect(cursorAt(s), DISPW.x, DISPW.y, DISPW.w, DISPW.pvTop + DISPW.pvH);
    let seen = -1; for (let s = t; s >= t - 2.16; s -= 1 / 60) { if (vis(s)) { seen = t - s; break; } }
    const ca = seen < 0 ? 0 : seen <= 2 ? 1 : 1 - (seen - 2) / .16;
    $('.chrome', dw).style.opacity = clamp(ca);
    $('.pvglow', dw).style.opacity = win(t, E.liveGlow[0], E.liveGlow[1], .4, .4);
  }
  placeCursor(desk, t >= E.scene && onLaptop(cur), cur.x, cur.y);
  placeRipple(desk, t, 'laptop');
}

function updateExt(ext, t, cur, root) {
  const s2 = ease(ramp(t, E.slide2, E.slide2 + .35));
  $('.slide1', ext).style.opacity = 1 - s2; $('.slide2', ext).style.opacity = s2;
  // rain
  $$('.drop', ext).forEach((d, i) => {
    const x0 = 690 + (i * 97) % 175, speed = 190 + (i * 37) % 70, off = (i * 53) % 220;
    const y = 345 + ((t * speed + off) % 215);
    d.setAttribute('transform', `translate(${x0 + (y - 345) * .08}, ${y})`);
    d.setAttribute('opacity', y > 540 ? Math.max(0, 1 - (y - 540) / 20) : 1);
  });
  $$('.evap path', ext).forEach((p, i) => p.setAttribute('stroke-dashoffset', String((t * 40 + i * 9) % 26)));
}

// ---------- overlays ----------
const kc = $('#keycaps');
let kcId = '';
function buildChips(el, keys) {
  el.innerHTML = keys.map(([g, l]) => `<div class="chip"><span class="g ${/[0-9]/.test(g) ? 'num' : ''}">${g}</span>${l ? `<span class="l">${l}</span>` : ''}</div>`).join('');
}
$('#backHint .chips').innerHTML = ['⌃', '⌥', '⌘', '←'].map(g => `<div class="chip"><span class="g">${g}</span></div>`).join('');

function card(el, t, a, b, fi = .6, fo = .6) { const o = win(t, a, b, fi, fo); el.style.opacity = o; el.style.display = o > 0 ? 'block' : 'none'; return o; }
function appear(el, t, at, dy = 14, dur = .7) { const p = ease(ramp(t, at, at + dur)); el.style.opacity = p; el.style.transform = (el.dataset.baseT || '') + ` translateY(${(1 - p) * dy}px)`; }

const capEl = $('#captions .cap');
let capText = '';

// ---------- main render ----------
window.renderAt = function (t) {
  // Title cards
  const ci = card(cardIntro, t, -1, E.introEnd + .4, .01, .8);
  if (ci > 0) {
    // v4: the title card is fully built from frame 0 (players use frame 0 as the thumbnail)
    appear($('.logo', cardIntro), t, -5);
    appear($('.title', cardIntro), t, -5);
    appear($('.subtitle', cardIntro), t, -5);
    appear($('.small', cardIntro), t, -5);
  }
  const co = card(cardOutro, t, E.outro, 1e9, .8, .01);
  if (co > 0) {
    const o0 = E.outro;
    appear($('.logo', cardOutro), t, o0 + .25); appear($('.title', cardOutro), t, o0 + .45);
    appear($('.subtitle', cardOutro), t, o0 + .7);
    const lk = $('.link', cardOutro); lk.dataset.baseT = 'translateX(-50%)'; appear(lk, t, o0 + .95);
    appear($('.platforms', cardOutro), t, o0 + 1.2);
    $('.tick-inner', cardOutro).style.transform = `translateX(${-((t - o0) * 38) % 2400}px)`;
  }
  for (const [cardEl, base] of [[cardIntro, -5], [cardOutro, E.outro]]) {
    $$('.sticker', cardEl).forEach(s => {
      const p = easeOut(ramp(t, base + Number(s.dataset.delay), base + Number(s.dataset.delay) + .6));
      const bob = Math.sin((t + Number(s.dataset.ph)) * 1.1) * 5;
      s.style.opacity = p; s.style.transform = `translateY(${bob + (1 - p) * 10}px) rotate(${s.dataset.rot}deg) scale(${lerp(.9, 1, p)})`;
    });
  }

  const cur = cursorAt(t);
  // Camera
  let s = 1, cx = 960, cy = 540;
  const zooms = [[E.camFloats, 1.45, 540, 470], [E.camTimer, 1.32, 430, 450]];
  for (const [[a, b], zs, zx, zy] of zooms) {
    const k = Math.min(ease(ramp(t, a, a + 1.1)), 1 - ease(ramp(t, b - 1.1, b)));
    if (k > 0) { s = lerp(1, zs, k); cx = lerp(960, zx, k); cy = lerp(540, zy, k); }
  }
  cam.style.transform = `translate(960px, 540px) scale(${s}) translate(${-cx}px, ${-cy}px)`;
  const labelK = 1 - clamp((s - 1) / .12);

  // Devices: laptop centred until the monitor arrives
  const lMove = ease(ramp(t, E.monitorIn, E.monitorIn + 1.1));
  const mIn = ease(ramp(t, E.monitorIn + .75, E.monitorIn + E.monitorInDur + .2));
  const dx = lerp(474, 0, lMove);
  $('#laptop').style.transform = `translateX(${dx}px)`;
  const mon = $('#monitor'); mon.style.opacity = mIn; mon.style.transform = `translateX(${(1 - mIn) * 50}px)`;
  // cable
  const cp = $('#cablePath');
  const x0 = 872 + dx;
  cp.setAttribute('d', `M${x0} 712 C ${x0 + 40} 800, 1230 842, 1352 772`);
  const cl = cp.getTotalLength(); const cr = ease(ramp(t, E.cable - .6, E.cable + .2));
  cp.style.strokeDasharray = `${cl * cr} ${cl}`; cp.style.opacity = cr > 0 ? 1 : 0;
  // labels
  labLapA.style.transform = `translateX(calc(-50% + ${dx}px))`; labLapB.style.transform = `translateX(calc(-50% + ${dx}px))`;
  const sceneIn = ease(ramp(t, E.scene - .2, E.scene + .6));
  const lb = ease(ramp(t, E.labelLaptop, E.labelLaptop + .5)), pb = ease(ramp(t, E.labelProj, E.labelProj + .5));
  labLapA.style.opacity = labelK * sceneIn * (1 - lb); labLapB.style.opacity = labelK * lb;
  labPrjA.style.opacity = labelK * mIn * (1 - pb); labPrjB.style.opacity = labelK * pb;
  const pulse = ramp(t, E.labelPulse, E.labelPulse + .9);
  const pk = pulse > 0 && pulse < 1 ? Math.sin(Math.PI * pulse) : 0;
  labLapB.style.transform = `translateX(-50%) scale(${1 + .08 * pk})`;
  labLapB.style.boxShadow = `0 6px 18px rgba(60,40,20,.12), 0 0 0 ${5 * pk}px rgba(74,143,95,.45)`;

  // Projector content: off -> mirror -> extended
  const mirrorO = ease(ramp(t, E.mirrorOn, E.mirrorOn + .4));
  const toExt = ramp(t, E.extendOn, E.extendOn + 1.0);
  const blackDip = toExt > 0 && toExt < 1 ? Math.sin(Math.PI * toExt) : 0;
  const mirrorEl = $(':scope > .proj > .mirror', projRoot), extEl = $(':scope > .proj > .ext', projRoot);
  mirrorEl.style.opacity = mirrorO * (toExt < .5 ? 1 : 0) * (1 - blackDip);
  extEl.style.opacity = toExt >= .5 ? (1 - blackDip) : 0;
  $('#projGlow').style.opacity = win(t, E.liveGlow[0], E.liveGlow[1], .4, .4);

  updateLaptopDesk(lapDesk, t, cur, false);
  if (mirrorO > 0 && toExt < .5) updateLaptopDesk(mirrorLap, t, cur, true);
  for (const ext of [extEl, $('.ext', pvRoot)]) updateExt(ext, t, cur);
  const projCur = !onLaptop(cur);
  for (const root of [$(':scope > .proj', projRoot), pvRoot]) {
    placeCursor(root, projCur && t >= E.extendOn, cur.x - VX, cur.y);
    placeRipple(root, t, 'projector');
  }

  // Jump arc (stage coordinates)
  const a1 = { x: LAP.x + PREVIEW_PT.x * LAP.s, y: LAP.y + PREVIEW_PT.y * LAP.s };
  const a2 = { x: PRJ.x + NEXT_BTN.x * PRJ.s, y: PRJ.y + NEXT_BTN.y * PRJ.s };
  const arc = $('#arcPath'), ring = $('#arcRing');
  const ap = ease(ramp(t, E.jump, E.jump + .5)), af = 1 - ease(ramp(t, E.jump + 1.3, E.jump + 1.9));
  if (t >= E.jump && af > 0) {
    arc.setAttribute('d', `M${a1.x} ${a1.y} Q ${(a1.x + a2.x) / 2} ${Math.min(a1.y, a2.y) - 190} ${a2.x - 14} ${a2.y - 18}`);
    const L = arc.getTotalLength(); arc.style.strokeDasharray = `${L * ap} ${L}`; arc.style.opacity = af;
    arc.setAttribute('marker-end', ap > .97 ? 'url(#ah)' : '');
    const rp = ramp(t, E.jump + .35, E.jump + 1.1);
    ring.setAttribute('cx', a2.x); ring.setAttribute('cy', a2.y); ring.setAttribute('r', 8 + 40 * easeOut(rp)); ring.style.opacity = rp > 0 && rp < 1 ? 1 - rp : 0;
  } else { arc.style.opacity = 0; ring.style.opacity = 0; }

  // Timer (real widget frames). The real widget is clipped to each screen (it slides out of the
  // laptop's edge and in from the projector's edge); a faint ghost crosses the desk gap.
  const to = ease(ramp(t, E.timerOpen, E.timerOpen + .25));
  for (const el of timerEls) el.style.display = to > 0 ? 'block' : 'none';
  if (to > 0) {
    const fp = ease(ramp(t, E.fly[0], E.fly[1]));
    const lx = LAP.x + TIMER_LAP.x * LAP.s, ly = LAP.y + TIMER_LAP.y * LAP.s;
    const px = PRJ.x + TIMER_PRJ.x * PRJ.s, py = PRJ.y + TIMER_PRJ.y * PRJ.s;
    const x = lerp(lx, px, fp), y = lerp(ly, py, fp), sc = lerp(LAP.s, PRJ.s, fp) * lerp(.97, 1, to);
    lapTimer.style.opacity = to; prjTimer.style.opacity = to;
    lapTimer.style.transform = `translate(${x - LAP.x}px, ${y - LAP.y}px) scale(${sc})`;
    prjTimer.style.transform = `translate(${x - PRJ.x}px, ${y - PRJ.y}px) scale(${sc})`;
    const flying = t > E.fly[0] && t < E.fly[1];
    ghostTimer.style.display = flying ? 'block' : 'none';
    ghostTimer.style.opacity = .3 * Math.min(1, ramp(t, E.fly[0], E.fly[0] + .12), 1 - ramp(t, E.fly[1] - .12, E.fly[1]));
    ghostTimer.style.transform = `translate(${x}px, ${y}px) scale(${sc})`;
    const hover = fp === 0 && inRect(cur, TIMER_LAP.x, TIMER_LAP.y, TIMER_SIZE.w, TIMER_SIZE.h);
    let name;
    if (t < E.startClick) name = hover ? 'idle_chrome' : 'idle_nochrome';
    else {
      const idx = Math.min(509, Math.floor((t - E.startClick) * 15));
      name = hover && idx < 60 ? 'run_chrome_' + String(idx).padStart(4, '0') : 'run_' + String(idx).padStart(4, '0');
    }
    if (name !== lastTimerName) {
      for (const el of timerEls) { const c = el.firstChild.getContext('2d'); c.clearRect(0, 0, 525, 622); c.drawImage(timerImgs[name], 0, 0, 525, 622); }
      lastTimerName = name;
    }
  }

  // Keycap overlay
  const K = TL.keys.find(k => t >= k.start - .01 && t <= k.end + .01);
  if (K) {
    if (kcId !== K.id) { buildChips($('.chips', kc), K.keys); $('.ktitle', kc).textContent = K.title; $('.knote', kc).textContent = K.note; kcId = K.id; }
    const o = win(t, K.start, K.end, .3, .35);
    kc.style.opacity = o; kc.style.transform = `translateX(-50%) translateY(${(1 - ease(ramp(t, K.start, K.start + .4))) * -10}px)`;
    $$('.chip', kc).forEach((c, i) => {
      const kt = K.keys[i][2];
      c.style.opacity = ease(ramp(t, kt - .18, kt));
      c.classList.toggle('down', t >= kt && t < K.release);
    });
    $('.knote2', kc).style.opacity = K.note2 ? win(t, K.note2[0], K.note2[1], .3, .3) : 0;
  } else kc.style.opacity = 0;
  for (const [id, [a, b]] of [['#winNote', E.winNote], ['#permNote', E.permNote], ['#backHint', E.backHint]]) {
    const el = $(id); const o = win(t, a, b, .3, .35); el.style.opacity = o;
    el.style.transform = `translateX(-50%) translateY(${(1 - ease(ramp(t, a, a + .4))) * -10}px)`;
  }
  // Recap
  const rc = $('#recap'); const ro = win(t, E.recap[0], E.recap[1], .45, .5);
  rc.style.opacity = ro; rc.style.display = ro > 0 ? 'block' : 'none';
  $('.swin', rc).style.transform = `translateX(-50%) translateY(${(1 - ease(ramp(t, E.recap[0], E.recap[0] + .5))) * 16}px)`;

  // Captions
  let cap = null, co2 = 0;
  TL.chunks.forEach((c, i) => {
    const next = TL.chunks[i + 1];
    const a = c.start - .15, b = Math.min(c.end + .4, next ? next.start - .08 : 1e9);
    if (t >= a && t <= b) { cap = c; co2 = win(t, a, b, .18, .18); }
  });
  if (cap) { if (capText !== cap.caption) { capEl.textContent = cap.caption; capText = cap.caption; }
    capEl.style.opacity = co2; capEl.style.transform = `translateY(${(1 - co2) * 8}px)`; }
  else capEl.style.opacity = 0;
};
await document.fonts.ready;
window.renderAt(0);
window.__ready = true;
})();
