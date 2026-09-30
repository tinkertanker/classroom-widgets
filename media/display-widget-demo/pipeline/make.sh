#!/usr/bin/env bash
# Full pipeline: narration -> timeline -> Timer capture -> audio mix -> frame render -> mux.
# Prereqs (see docs/display-widget-demo-video.md): ffmpeg, Node 22 + `npm ci` + `npx playwright install chromium`,
# Python 3 with `pip install kokoro-onnx soundfile numpy`, Kokoro model in $KOKORO_DIR
# (./fetch_tts.sh), and the teacher dev server on :3000 for the Timer capture.
#   SKIP_TTS=1      reuse audio/*.wav + audio/durations.json from an earlier run
#   SKIP_CAPTURE=1  reuse assets/timer/*.png from an earlier run
set -euo pipefail
cd "$(dirname "$0")"
KOKORO_DIR="${KOKORO_DIR:-tts}"
OUT=out/classroom-widgets-display-widget-demo-v4.mp4
./prepare_assets.sh
[ "${SKIP_TTS:-0}" = 1 ] || python3 tts.py "$KOKORO_DIR" 'bm_george:0.6+bm_fable:0.4' 1.1
node build_timeline.mjs
[ "${SKIP_CAPTURE:-0}" = 1 ] || RUN_SECONDS=34 node capture/capture_timer.mjs
python3 mix.py
node render.mjs --out out/video_noaudio.mp4
# two-pass loudnorm to -14 LUFS / -1.5 dBTP
M=$(ffmpeg -hide_banner -i out/mix.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$M" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -y -i out/mix.wav -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" -c:a pcm_s16le out/mix_norm.wav
ffmpeg -v error -y -i out/video_noaudio.mp4 -i out/mix_norm.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
# poster + cover art = frame 0 (the complete title card)
ffmpeg -v error -y -ss 0 -i out/video_noaudio.mp4 -frames:v 1 out/poster.png
ffmpeg -v error -y -i out/poster.png -q:v 2 out/poster.jpg
ffmpeg -v error -y -i "$OUT" -i out/poster.jpg -map 0 -map 1 -c copy -disposition:v:1 attached_pic -movflags +faststart "${OUT%.mp4}.tmp.mp4" && mv "${OUT%.mp4}.tmp.mp4" "$OUT"
echo "done: $OUT and out/poster.jpg (copy both to .. to publish)"
