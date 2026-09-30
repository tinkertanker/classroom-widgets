# Mixes narration chunks (placed per timeline.json), a soft synthesised music bed (ducked under
# the voice) and quiet synthesised UI sounds into out/mix.wav (48 kHz stereo). Loudness is
# normalised to -14 LUFS afterwards with ffmpeg loudnorm (see make.sh).
import json, subprocess, numpy as np, soundfile as sf, os
SR = 48000
tl = json.load(open('timeline.json')); E = tl['E']
N = int((tl['duration'] + 0.5) * SR)
voice = np.zeros(N); music = np.zeros((N, 2)); sfx = np.zeros(N)
os.makedirs('out/audio48', exist_ok=True)
for c in tl['chunks']:
    src, dst = f"audio/{c['name']}.wav", f"out/audio48/{c['name']}.wav"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', 'aresample=48000:resampler=soxr', dst], check=True)
    a, _ = sf.read(dst)
    i = int(c['start'] * SR); voice[i:i + len(a)] += a[:N - i]
voice *= 0.8 / np.abs(voice).max()

# ---- music bed (v2): bright, light pop pulse. 110 BPM, C major, C-G-Am-F, one chord per bar.
# Soft kick on 1 & 3, soft claps on 2 & 4, quiet shaker 8ths, bouncy octave bass, offbeat plucked
# chord stabs and a sparse bell motif. Everything is synthesised here (no samples).
rng = np.random.default_rng(7)
t = np.arange(N) / SR
BPM = 110; beat = 60 / BPM; barlen = 4 * beat
def midi(m): return 440 * 2 ** ((m - 69) / 12)
music = np.zeros((N, 2))
def put(at, sig, gl, gr):
    i = int(at * SR)
    if i >= N or i < 0: return
    n = min(len(sig), N - i); music[i:i + n, 0] += sig[:n] * gl; music[i:i + n, 1] += sig[:n] * gr
def tone(f, dur, harms=(1,), decay=6.0, attack=0.004):
    tt = np.arange(int(dur * SR)) / SR; w = np.zeros_like(tt)
    for k, h in enumerate(harms): w += h * np.sin(2 * np.pi * f * (k + 1) * tt)
    return w * np.exp(-tt * decay) * np.clip(tt / attack, 0, 1)
def kick():
    tt = np.arange(int(.32 * SR)) / SR; f = 45 + 75 * np.exp(-tt * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 11) * np.clip(tt / .002, 0, 1)
def bandnoise(dur, lo, hi, decay):
    n = int(dur * SR); x = rng.standard_normal(n)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); X[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(X, n); y /= np.abs(y).max() + 1e-9
    return y * np.exp(-np.arange(n) / SR * decay)
def clap():
    base = bandnoise(.18, 900, 3500, 30); out = np.zeros(len(base) + int(.03 * SR))
    for k, d in enumerate([0, .009, .018]): o = int(d * SR); out[o:o + len(base)] += base * (0.6 if k < 2 else 1)
    return out
def shaker(): return bandnoise(.06, 6000, 11000, 70)
chords = [[60, 64, 67, 72], [59, 62, 67, 71], [57, 60, 64, 69], [57, 60, 65, 69]]  # C, G/B, Am, F
roots = [36, 43, 45, 41]
motif = [(0, 76), (1.5, 79), (2, 77), (3, 76), (4.5, 74), (6, 72), (7, 74)]  # beats over two bars
K, C, S = kick(), clap(), shaker()
nbars = int(tl['duration'] / barlen) + 2
for bi in range(nbars):
    b0 = bi * barlen; ch = chords[bi % 4]; r = roots[bi % 4]
    for q in range(4):
        tq = b0 + q * beat
        if q in (0, 2): put(tq, K, .55, .55)
        if q in (1, 3): put(tq, C, .10, .12)
        for e in (0, .5): put(tq + e * beat, S, .035 if e == 0 else .06, .05 if e == 0 else .04)
        # bouncy bass: root / octave eighths
        for e, off in ((0, 0), (.5, 12)):
            put(tq + e * beat, tone(midi(r + off), .22, (1, .35, .12), decay=12), .20, .20)
        # offbeat plucked stabs
        for m in ch:
            put(tq + .5 * beat, tone(midi(m), .28, (1, .5, .3, .15, .08), decay=14), .030, .026)
    # soft sustained chord bed
    for m in ch:
        put(b0, tone(midi(m), barlen + .3, (1, .2), decay=.7, attack=.08), .018, .022)
    if bi % 2 == 0:
        for bt, m in motif: put(b0 + bt * beat, tone(midi(m), .9, (1, .6, .1), decay=4.5), .045, .055)
# music fades: in over intro, out at the end
fade = np.clip(t / 1.5, 0, 1) * np.clip((tl['duration'] - t) / 2.5, 0, 1)
music *= fade[:, None]
# duck under voice (smoothed envelope)
env = np.abs(voice); win = int(0.25 * SR)
env = np.convolve(env, np.ones(win) / win, mode='same')
duck = 1 - 0.6 * np.clip(env / 0.05, 0, 1)
music *= duck[:, None]
music *= 10 ** (-7 / 20) / max(1e-9, np.sqrt(np.mean(music ** 2)) / 10 ** (-24 / 20))  # ~ -31 dBFS RMS after ducking

# ---- UI sounds
def add(at, sig, gain):
    i = int(at * SR); n = min(len(sig), N - i)
    if n > 0: sfx[i:i + n] += sig[:n] * gain
def tick(freq=2400, dur=0.035, noise=0.6):
    tt = np.arange(int(dur * SR)) / SR
    return (np.sin(2 * np.pi * freq * tt) * (1 - noise) + rng.standard_normal(len(tt)) * noise) * np.exp(-tt * 140)
def layer(a, b, off):
    o = int(off * SR); n = max(len(a), o + len(b)); out = np.zeros(n); out[:len(a)] += a; out[o:o + len(b)] += b; return out
def key():
    return layer(tick(1500, 0.05, 0.75), 0.6 * tick(900, 0.04, 0.5), .012)
def mouse():
    return layer(tick(3200, 0.025, 0.5), 0.7 * tick(2600, 0.025, 0.5), .06)
def pop():
    tt = np.arange(int(0.18 * SR)) / SR; f = 520 + 380 * tt / 0.18
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 22)
def whoosh(dur):
    n = int(dur * SR); x = rng.standard_normal(n); tt = np.arange(n) / n
    out = np.empty(n); prev = 0.0
    for i in range(n):
        c = np.exp(-2 * np.pi * (300 + 2500 * np.sin(np.pi * tt[i])) / SR); prev = (1 - c) * x[i] + c * prev; out[i] = prev
    return out * np.sin(np.pi * tt) ** 2
for k in tl['keys']:
    for g, l, kt in k['keys']: add(kt, key(), 0.10)
for c in tl['clicks']: add(c['t'], mouse(), 0.10)
add(E['popupClick'], mouse(), 0.10); add(E['menuPick'], mouse(), 0.10)
for at in [E['displayOpen'], E['timerOpen']]: add(at, pop(), 0.06)
add(E['fly'][0], whoosh(E['fly'][1] - E['fly'][0]), 0.22)
add(E['cable'] - 0.05, tick(700, 0.08, 0.7), 0.12)

mix = np.zeros((N, 2)); mix += voice[:, None] + sfx[:, None] + music
mix /= max(1.0, np.abs(mix).max() / 0.95)
sf.write('out/music.wav', (music / max(1e-9, np.abs(music).max()) * .9).astype(np.float32), SR)
sf.write('out/mix.wav', mix.astype(np.float32), SR)
print('mix written', N / SR, 's; voice peak', np.abs(voice).max(), 'music rms dBFS', 20 * np.log10(np.sqrt(np.mean(music ** 2))))
