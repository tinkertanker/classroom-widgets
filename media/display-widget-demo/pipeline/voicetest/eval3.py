import os, numpy as np, parselmouth
from kokoro_onnx import Kokoro
# Run from voicetest/. Model dir: $KOKORO_DIR, else ../tts (what fetch_tts.sh creates).
TTS = os.environ.get('KOKORO_DIR', '../tts')
k = Kokoro(f'{TTS}/kokoro-fp32.onnx', f'{TTS}/voices-gb.npz')
texts = ["Press Control, Option, Command and zero to open the Display widget.",
         "It shows a live view of the projector, so you can see what the class sees without turning round.",
         "You can send widgets between displays easily too.",
         "When it's ready, press Control, Option, Command and the right arrow to send it to the next screen.",
         "No more craning your neck to find your pointer on the other screen."]
V = lambda n: k.get_voice_style(n)
cands = {n: V(n) for n in ['bm_george', 'bm_fable', 'bm_lewis', 'bm_daniel']}
cands['george60+fable40'] = .6 * V('bm_george') + .4 * V('bm_fable')
cands['george50+lewis50'] = .5 * V('bm_george') + .5 * V('bm_lewis')
for name, sty in cands.items():
  for sp in [1.05, 1.1]:
    st = []; hz = []; hnr = []; jumps = 0; nfr = 0; dur = 0
    for t in texts:
        a, sr = k.create(t, voice=sty, speed=sp, lang='en-gb'); dur += len(a) / sr
        snd = parselmouth.Sound(a, sampling_frequency=sr)
        f0 = snd.to_pitch(pitch_floor=60, pitch_ceiling=300).selected_array['frequency']
        v = f0 > 0; f = f0[v]; hz += list(f); st += list(12 * np.log2(f / np.median(f)))
        d = np.abs(np.diff(12 * np.log2(np.where(v, f0, np.nan)))); d = d[~np.isnan(d)]; jumps += int((d > 5).sum()); nfr += len(d)
        h = snd.to_harmonicity().values; hnr.append(np.mean(h[h > -100]))
    st = np.array(st); q = np.percentile(st, [25, 75, 5, 95])
    print(f"{name:18s} sp {sp}  wpm {sum(len(t.split()) for t in texts)/dur*60:4.0f}  medianF0 {np.median(hz):5.1f}Hz  IQR {q[1]-q[0]:4.2f}st  5-95 {q[3]-q[2]:5.2f}st  jumps/1k {1000*jumps/nfr:4.1f}  HNR {np.mean(hnr):5.1f}", flush=True)
