// Builds timeline.json from script.json + audio/durations.json.
// Every scene event is placed relative to the narration so re-generated TTS re-times the video.
import fs from 'fs';
const script = JSON.parse(fs.readFileSync('script.json', 'utf8'));
const durs = JSON.parse(fs.readFileSync('audio/durations.json', 'utf8'));
const chunks = []; // {name, start, end, caption}
const C = {};
function say(id, i, start) {
  const name = `${id}_${i}`; const d = durs[name].dur;
  const line = script.find(l => l.id === id);
  const c = { name, start, end: start + d, dur: d, caption: line.chunks[i][1], phonemes: durs[name].phonemes };
  chunks.push(c); C[name] = c; return c;
}
// time at which a phoneme substring is spoken (proportional estimate within the chunk)
function at(c, sub, nth = 0) {
  let idx = -1; for (let k = 0; k <= nth; k++) idx = c.phonemes.indexOf(sub, idx + 1);
  if (idx < 0) throw new Error(`no ${sub} in ${c.name}`);
  return c.start + c.dur * (idx / c.phonemes.length);
}
const E = {}; // named event times
const keys = []; // keycap overlays
const clicks = [];
const r = (x) => Math.round(x * 1000) / 1000;
const GAP = 0.5; // tightened pacing (v2): scales every pause after a line
const g = (x) => x * GAP;

// ---- Intro card
let t = 0;
const intro = say('intro', 0, 1.1);
E.introEnd = intro.end + g(1.0);
// ---- Scene 1: plug in and extend
E.scene = E.introEnd;
const plug = say('plug', 0, E.scene + 0.9);
E.monitorIn = plug.start + 0.5; E.monitorInDur = 1.5;
E.cable = plug.start + 1.9; E.mirrorOn = plug.start + 2.4;
const ext0 = say('extend', 0, plug.end + g(1.3));
E.settingsOpen = ext0.start - 0.3;
E.popupClick = ext0.start + 2.1;
E.menuPick = ext0.start + 3.5;
E.extendOn = E.menuPick + 0.15;
const ext1 = say('extend', 1, ext0.end + g(0.35));
E.winNote = [ext1.start - 0.2, ext1.end + g(0.8)];
E.settingsClose = ext1.end + g(0.6);
const roles = say('roles', 0, ext1.end + g(1.0));
E.labelLaptop = at(roles, 'wˈɜːkɪŋ') - 0.2;
E.labelProj = at(roles, 'wɒt') - 0.2;
// ---- Scene 2: Display widget
const disp0 = say('display', 0, roles.end + g(1.1));
const k1 = { id: 'display', title: 'Show / hide the Display widget', note: 'Windows: Ctrl + Alt + Shift + 0',
  keys: [['⌃', 'control', at(disp0, 'kəntɹˈəʊl')], ['⌥', 'option', at(disp0, 'ˈɒpʃən')], ['⌘', 'command', at(disp0, 'kəmˈand')], ['0', '', at(disp0, 'zˈiəɹəʊ')]] };
E.displayOpen = k1.keys[3][2] + 0.35;
const disp1 = say('display', 1, disp0.end + g(0.3));
k1.start = k1.keys[0][2] - 0.35; k1.end = disp1.end + g(0.5); k1.release = k1.keys[3][2] + 0.9;
k1.note2 = [disp1.start - 0.1, k1.end]; // "Change it in Settings" tag
keys.push(k1);
const live = say('live', 0, disp1.end + g(0.7));
E.liveGlow = [live.start + 0.3, live.end + g(0.2)];
E.permNote = [live.start + 0.2, live.end + g(0.4)];
const floats = say('floats', 0, live.end + g(0.6));
E.camFloats = [floats.start - 0.7, floats.end + g(0.5)];
E.notesClickMove = [floats.start + 0.2, floats.start + 1.3];
E.notesClick = floats.start + 1.5; clicks.push({ t: E.notesClick, screen: 'laptop' });
const click0 = say('click', 0, floats.end + g(1.2));
E.previewMove = [click0.start + 0.1, click0.start + 1.4];
E.previewClick = click0.start + 1.7; clicks.push({ t: E.previewClick, screen: 'laptop' });
E.jump = E.previewClick + 0.12;
const click1 = say('click', 1, click0.end + g(0.35));
E.projClick = click1.start + 0.8; clicks.push({ t: E.projClick, screen: 'projector' });
E.slide2 = E.projClick + 0.1;
const hide = say('hide', 0, click1.end + g(1.2));
const k2 = { id: 'hide', title: 'Same shortcut hides it', note: 'Windows: Ctrl + Alt + Shift + 0', keys: [] };
{ const s = hide.start + 0.25; k2.keys = [['⌃', 'control', s], ['⌥', 'option', s + 0.14], ['⌘', 'command', s + 0.28], ['0', '', s + 0.45]]; }
k2.start = k2.keys[0][2] - 0.35; k2.release = k2.keys[3][2] + 0.9; k2.end = hide.end + g(0.9); keys.push(k2);
E.displayClose = k2.keys[3][2] + 0.3;
// ---- Scene 3: Timer and send to next screen
const tim0 = say('timer', 0, hide.end + g(1.1));
const tim1 = say('timer', 1, tim0.end + g(0.25));
const k3 = { id: 'timer', title: 'Open a Timer', note: 'Windows: Ctrl + Alt + Shift + 1',
  keys: [['⌃', 'control', at(tim1, 'kəntɹˈəʊl')], ['⌥', 'option', at(tim1, 'ˈɒpʃən')], ['⌘', 'command', at(tim1, 'kəmˈand')], ['1', '', at(tim1, 'wˈʌn')]] };
k3.start = k3.keys[0][2] - 0.35; k3.release = k3.keys[3][2] + 0.9; k3.end = tim1.end + g(0.4); keys.push(k3);
E.timerOpen = k3.keys[3][2] + 0.35;
E.labelPulse = at(tim1, 'wˈɜːkɪŋ') - 0.1;
E.camTimer = [E.timerOpen - 0.2, tim1.end + g(2.6)];
E.startMove = [tim1.end + g(0.25), tim1.end + g(1.45)];
E.startClick = tim1.end + g(1.7); clicks.push({ t: E.startClick, screen: 'laptop' });
E.awayMove = [E.startClick + 0.5, E.startClick + 1.4];
const send = say('send', 0, E.startClick + 0.8);
const k4 = { id: 'send', title: 'Move widget to next display', note: 'Windows: Ctrl + Alt + Shift + →',
  keys: [['⌃', 'control', at(send, 'kəntɹˈəʊl')], ['⌥', 'option', at(send, 'ˈɒpʃən')], ['⌘', 'command', at(send, 'kəmˈand')], ['→', 'right', at(send, 'ˈaɹəʊ')]] };
E.fly = [send.end + 0.1, send.end + 1.4];
k4.start = k4.keys[0][2] - 0.35; k4.release = E.fly[0] + 0.1; k4.end = E.fly[1] + 0.5; keys.push(k4);
const over0 = say('over', 0, E.fly[0] + 0.25);
const over1 = say('over', 1, over0.end + g(0.5));
E.backHint = [over1.start - 0.1, over1.end + g(0.7)];
const custom = say('custom', 0, over1.end + g(1.0));
E.recap = [custom.start - 0.4, custom.end + 1.3];
// ---- Ending lines play over the desk scene (captions stay readable), then the outro card
const out0 = say('outro', 0, E.recap[1] + 0.1);
const out1 = say('outro', 1, out0.end + 0.25);
const out2 = say('outro', 2, out1.end + 0.35);
E.outro = out2.end + 0.4;
E.end = E.outro + 3.8;
const tl = { fps: 30, duration: r(E.end), E, chunks: chunks.map(c => ({ ...c, phonemes: undefined })), keys, clicks };
fs.writeFileSync('timeline.json', JSON.stringify(tl, (k, v) => typeof v === 'number' ? r(v) : v, 1));
console.log('duration', r(E.end));
for (const c of chunks) console.log(c.name.padEnd(10), r(c.start), r(c.end));
