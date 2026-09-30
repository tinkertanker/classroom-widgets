# Narration: Kokoro-82M v1.0 (fp32 ONNX) via kokoro-onnx, British voice (default: blend 60% bm_george + 40% bm_fable @ 1.1; chosen by pitch/clarity proxies, see voicetest/eval3.py), lang en-gb.
# Model: npm kokoro-fp32{a,b,c}-shards concatenated; voices: npm kokoro-js voices/b*.bin -> voices-gb.npz
# (fetch_tts.sh downloads both; huggingface.co was blocked where this was built). One wav per caption chunk -> exact caption timing.
# Usage: python3 tts.py [KOKORO_DIR] [VOICE] [SPEED]   (KOKORO_DIR defaults to $KOKORO_DIR, then ./tts)
import json, os, sys, soundfile as sf
from kokoro_onnx import Kokoro
TTS = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('KOKORO_DIR', 'tts')
VOICE = sys.argv[2] if len(sys.argv) > 2 else 'bm_george:0.6+bm_fable:0.4'
SPEED = float(sys.argv[3]) if len(sys.argv) > 3 else 1.1
FIXES = [('wˈɒn ', 'wˈʌn ')]  # "one" -> /wʌn/
k = Kokoro(f'{TTS}/kokoro-fp32.onnx', f'{TTS}/voices-gb.npz')
# VOICE may be a blend such as 'bm_george:0.6+bm_fable:0.4' (weighted average of style vectors)
if '+' in VOICE or ':' in VOICE:
    VOICE = sum(float(w) * k.get_voice_style(n) for n, w in (p.split(':') for p in VOICE.split('+')))
out = {}
os.makedirs('audio', exist_ok=True)
for l in json.load(open('script.json')):
    for i, (spoken, _cap) in enumerate(l['chunks']):
        ph = k.tokenizer.phonemize(spoken, 'en-gb')
        for a, b in FIXES: ph = ph.replace(a, b)
        a, sr = k.create(ph, voice=VOICE, speed=SPEED, is_phonemes=True)
        name = f"{l['id']}_{i}"
        sf.write(f"audio/{name}.wav", a, sr)
        out[name] = {'dur': len(a) / sr, 'phonemes': ph}
        print(name, round(len(a) / sr, 2), flush=True)
json.dump(out, open('audio/durations.json', 'w'), indent=1, ensure_ascii=False)
