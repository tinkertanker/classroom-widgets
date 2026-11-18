// Run: CHROME_BIN=/path/to/chrome pnpm --filter @classroom-widgets/teacher e2e:background-music
// Failure modes: Play makes no sound or plays another mood; a mood change while
// playing keeps the old music or stops; a mood change while paused starts
// playback or is ignored by the next Play; a track ending stops the music,
// leaves a silent gap or jumps in loudness instead of crossfading into the
// next; Pause does not resume where it stopped; the app's
// master volume is ignored; the mood is lost on reload; a deleted widget keeps
// playing.
// Evidence: steps.txt, 1-playing.png, 2-upbeat.png, 3-dark.png (failure.png on failure)
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createStepLog, newTeacherContext, prepareEvidence, startStack } from './harness.mjs';

const evidence = prepareEvidence('background-music', ['steps.txt', '1-playing.png', '2-upbeat.png', '3-dark.png', 'failure.png']);
let page;
const { step, write } = createStepLog(join(evidence, 'steps.txt'));
let stack;
let browser;

try {
  stack = await startStack();
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
  const context = await newTeacherContext(browser, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  // The widget's audio element is never in the DOM, so record every element
  // that is asked to play.
  await context.addInitScript(() => {
    window.__media = new Set();
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.__media.add(this);
      window.__lastPlayed = this;
      return play.call(this);
    };
  });
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(stack.teacherUrl);

  const music = () => page.evaluate(() => [...window.__media]
    .filter(e => e.src.includes('/tracks/'))
    .map(e => ({ paused: e.paused, time: e.currentTime, volume: e.volume })));
  // The track the widget most recently started: during a crossfade, the incoming one.
  const playing = async () => {
    assert.ok((await music()).length <= 2, 'the widget uses at most two audio elements');
    return page.evaluate(() => {
      const e = window.__lastPlayed;
      return { paused: e.paused, time: e.currentTime, volume: e.volume };
    });
  };
  const waitForPlayback = async (file) => {
    await page.waitForFunction(name => [...window.__media].some(e => e.src.includes(name) && !e.paused && e.currentTime > 0.3), file, { timeout: 15000 });
  };
  const nowPlaying = () => page.getByText(/^(Now playing|Up next):/).textContent();
  const mood = name => page.getByRole('button', { name: new RegExp(`^${name}`) });
  // Widget controls show only while the pointer is over the board.
  const press = async name => {
    await page.getByText(/^(Now playing|Up next):/).hover();
    await page.getByRole('button', { name, exact: true }).click();
  };

  await page.getByTitle('More widgets (⌘K)').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Background Music', exact: true }).click();
  await mood('Chill').waitFor();
  assert.equal(await mood('Chill').getAttribute('aria-pressed'), 'true', 'Chill is the default mood');
  assert.deepEqual(await music(), [], 'nothing loads or plays before Play');
  assert.match(await nowPlaying(), /Up next: Study and Relax · Kevin MacLeod/);
  step('PASS: added from the chooser; Chill selected, nothing playing, first Chill track shown as up next');

  await press('Play');
  await waitForPlayback('study-and-relax');
  assert.match(await nowPlaying(), /Now playing: Study and Relax/);
  await page.screenshot({ path: join(evidence, '1-playing.png') });
  step(`PASS: Play starts "Study and Relax" (currentTime ${(await playing()).time.toFixed(2)}s)`);

  await press('Pause');
  const pausedAt = (await playing()).time;
  await page.waitForTimeout(600);
  assert.ok((await playing()).paused && (await playing()).time === pausedAt, 'Pause stops playback');
  await press('Play');
  await page.waitForFunction(t => [...window.__media].some(e => !e.paused && e.currentTime > t + 0.2), pausedAt);
  assert.ok((await playing()).time >= pausedAt, 'Play resumes where Pause stopped');
  step(`PASS: Pause holds at ${pausedAt.toFixed(2)}s and Play resumes from there`);

  await page.evaluate(() => window.classroomAudio.setVolume(0.3));
  await page.waitForFunction(() => [...window.__media].some(e => Math.abs(e.volume - 0.3) < 0.001));
  step('PASS: changing the app volume to 30% sets the music to 0.3');

  await mood('Upbeat').click();
  await waitForPlayback('funshine');
  assert.equal(await mood('Upbeat').getAttribute('aria-pressed'), 'true');
  assert.equal(await mood('Chill').getAttribute('aria-pressed'), 'false');
  assert.equal((await playing()).volume.toFixed(2), '0.30', 'a new track keeps the app volume');
  assert.match(await nowPlaying(), /Now playing: Funshine/);
  await page.screenshot({ path: join(evidence, '2-upbeat.png') });
  step('PASS: choosing Upbeat while playing switches straight to "Funshine" at the same volume');

  // Jump to 8 s before the end and sample both players every 100 ms until the
  // handover is over: the next track must fade in while this one fades out,
  // with music playing at every sample.
  const handover = await page.evaluate(async () => {
    const tracks = () => [...window.__media].filter(e => e.src.includes('/tracks/'));
    const outgoing = window.__lastPlayed;
    outgoing.currentTime = outgoing.duration - 8;
    const samples = [];
    for (let i = 0; i < 110; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const playingNow = tracks().filter(e => !e.paused);
      samples.push({ playing: playingNow.length, audible: playingNow.reduce((sum, e) => sum + e.volume, 0) });
    }
    const incoming = window.__lastPlayed;
    return {
      samples,
      outgoingPaused: outgoing.paused,
      incoming: incoming === outgoing ? null : { src: incoming.src, paused: incoming.paused, time: incoming.currentTime, volume: incoming.volume },
    };
  });
  assert.ok(handover.incoming?.src.includes('fresh-focus'), 'the next Upbeat track starts');
  assert.ok(handover.samples.every(sample => sample.playing >= 1), 'music plays at every sample through the handover');
  const overlap = handover.samples.filter(sample => sample.playing === 2).length;
  assert.ok(overlap >= 40, `both tracks play together for most of the 6 s fade (${overlap} samples)`);
  // Equal-power fade at 30% app volume: the summed gains stay between 0.3 and 0.3·√2.
  assert.ok(handover.samples.every(sample => sample.audible >= 0.29 && sample.audible <= 0.43), 'loudness holds through the fade');
  assert.ok(handover.outgoingPaused, 'the finished track stops after the fade');
  assert.ok(!handover.incoming.paused && handover.incoming.time > 4, 'the next track keeps playing from its start');
  assert.equal(handover.incoming.volume.toFixed(2), '0.30', 'the next track ends the fade at the app volume');
  assert.match(await nowPlaying(), /Now playing: Fresh Focus/);
  step(`PASS: "Funshine" crossfades into "Fresh Focus": music in all ${handover.samples.length} samples, both playing in ${overlap}, summed gain ${Math.min(...handover.samples.map(s => s.audible)).toFixed(2)}–${Math.max(...handover.samples.map(s => s.audible)).toFixed(2)}`);
  await page.evaluate(() => { for (const e of window.__media) if (!e.paused) e.currentTime = e.duration - 0.5; });
  await waitForPlayback('funshine');
  step('PASS: after the last Upbeat track the first one follows again');

  await press('Next');
  await waitForPlayback('fresh-focus');
  step('PASS: Next skips to "Fresh Focus"');

  await press('Pause');
  await mood('Calm').click();
  await page.waitForTimeout(600);
  assert.ok((await playing()).paused, 'choosing a mood while paused does not start the music');
  assert.match(await nowPlaying(), /Up next: Wisdom in the Sun/);
  await press('Play');
  await waitForPlayback('wisdom-in-the-sun');
  step('PASS: choosing Calm while paused stays silent; Play then starts "Wisdom in the Sun"');

  await page.getByTitle('Menu', { exact: true }).click();
  await page.getByRole('button', { name: 'Dark Mode' }).click();
  await page.keyboard.press('Escape');
  await page.getByText(/^(Now playing|Up next):/).hover();
  await page.screenshot({ path: join(evidence, '3-dark.png') });

  await page.reload();
  await mood('Calm').waitFor();
  assert.equal(await mood('Calm').getAttribute('aria-pressed'), 'true', 'mood survives a reload');
  assert.deepEqual(await music(), [], 'nothing plays by itself after a reload');
  step('PASS: after a reload Calm is still selected and nothing plays until Play');

  await press('Play');
  await waitForPlayback('wisdom-in-the-sun');
  // Deleting plays the app's own trash sound, so watch only the music element.
  await page.evaluate(() => { window.__music = [...window.__media].find(e => e.src.includes('/tracks/')); });
  await mood('Calm').hover();
  await page.getByRole('button', { name: 'Delete widget' }).click();
  await mood('Calm').waitFor({ state: 'detached' });
  await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => window.__music.paused), 'deleting the widget stops the music');
  step('PASS: deleting the widget while playing stops the music');

  assert.deepEqual(errors, [], 'no browser errors');
} catch (error) {
  step(`FAIL: ${error.stack || error.message}`);
  await page?.screenshot({ path: join(evidence, 'failure.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser?.close();
  await stack?.stop();
  write();
}
