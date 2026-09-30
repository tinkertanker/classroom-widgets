# Objective proxies for "liveliness": words per minute, F0 range/variability (semitones), and speech-rate.
import os, json, numpy as np, soundfile as sf, parselmouth
from kokoro_onnx import Kokoro
# Run from voicetest/. Model dir: $KOKORO_DIR, else ../tts (what fetch_tts.sh creates).
TTS = os.environ.get('KOKORO_DIR', '../tts')
k = Kokoro(f'{TTS}/kokoro-fp32.onnx', f'{TTS}/voices-gb.npz')
texts = ["Press Control, Option, Command and zero to open the Display widget.",
         "It shows a live view of the projector, so you can see what the class sees without turning round.",
         "Click anywhere in the preview, and your pointer jumps to that spot on the projector.",
         "When it's ready, press Control, Option, Command and the right arrow to send it to the next screen."]
words = sum(len(t.split()) for t in texts)
res = []
for v in ['bf_emma', 'bf_isabella', 'bf_alice', 'bf_lily', 'bm_george', 'bm_fable', 'bm_lewis', 'bm_daniel']:
    for sp in [0.95, 1.05, 1.1]:
        dur = 0; st = []
        for i, t in enumerate(texts):
            a, sr = k.create(t, voice=v, speed=sp, lang='en-gb'); dur += len(a) / sr
            snd = parselmouth.Sound(a, sampling_frequency=sr)
            f0 = snd.to_pitch(pitch_floor=65, pitch_ceiling=450).selected_array['frequency']; f0 = f0[f0 > 0]
            st.extend(list(12 * np.log2(f0 / np.median(f0))))
            if sp == 1.1: sf.write(f'{v}_{i}.wav', a, sr)
        st = np.array(st)
        res.append(dict(voice=v, speed=sp, wpm=round(words / dur * 60), f0_sd_st=round(float(st.std()), 2), f0_range_st=round(float(np.percentile(st, 95) - np.percentile(st, 5)), 2)))
        print(res[-1], flush=True)
json.dump(res, open('results.json', 'w'), indent=1)
