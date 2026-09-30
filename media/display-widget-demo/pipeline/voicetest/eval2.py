import os, numpy as np, parselmouth
from kokoro_onnx import Kokoro
# Run from voicetest/. Model dir: $KOKORO_DIR, else ../tts (what fetch_tts.sh creates).
TTS = os.environ.get('KOKORO_DIR', '../tts')
k = Kokoro(f'{TTS}/kokoro-fp32.onnx', f'{TTS}/voices-gb.npz')
texts = ["Press Control, Option, Command and zero to open the Display widget.",
         "It shows a live view of the projector, so you can see what the class sees without turning round.",
         "Click anywhere in the preview, and your pointer jumps to that spot on the projector.",
         "When it's ready, press Control, Option, Command and the right arrow to send it to the next screen.",
         "No more craning your neck to find your pointer on the other screen."]
V = lambda n: k.get_voice_style(n)
cands = {'bf_emma': V('bf_emma'), 'bf_isabella': V('bf_isabella'), 'bf_alice': V('bf_alice'), 'bf_lily': V('bf_lily'),
  'bm_george': V('bm_george'), 'bm_fable': V('bm_fable'),
  'emma60+alice40': .6*V('bf_emma')+.4*V('bf_alice'), 'emma50+lily50': .5*V('bf_emma')+.5*V('bf_lily'),
  'isabella60+alice40': .6*V('bf_isabella')+.4*V('bf_alice'), 'emma50+isabella50': .5*V('bf_emma')+.5*V('bf_isabella')}
for name, sty in cands.items():
    st = []; hnr = []; jumps = 0; nfr = 0; dur = 0
    for t in texts:
        a, sr = k.create(t, voice=sty, speed=1.06, lang='en-gb'); dur += len(a)/sr
        snd = parselmouth.Sound(a, sampling_frequency=sr)
        f0 = snd.to_pitch(pitch_floor=65, pitch_ceiling=450).selected_array['frequency']
        v = f0 > 0; f = f0[v]; s = 12*np.log2(f/np.median(f)); st += list(s)
        d = np.abs(np.diff(12*np.log2(np.where(v, f0, np.nan)))); d = d[~np.isnan(d)]; jumps += int((d > 5).sum()); nfr += len(d)
        h = snd.to_harmonicity().values; hnr.append(np.mean(h[h > -100]))
    st = np.array(st); q = np.percentile(st, [25, 75, 5, 95])
    print(f"{name:20s} wpm {sum(len(t.split()) for t in texts)/dur*60:5.0f}  f0 IQR {q[1]-q[0]:4.2f}st  5-95 {q[3]-q[2]:5.2f}st  jumps/1k {1000*jumps/nfr:5.1f}  HNR {np.mean(hnr):5.1f}dB", flush=True)
