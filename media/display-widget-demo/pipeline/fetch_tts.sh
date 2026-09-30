#!/usr/bin/env bash
# Downloads Kokoro-82M v1.0 (fp32 ONNX, ~325 MB) and the British voices into $KOKORO_DIR
# (default ./tts, git-ignored). Both come from the npm registry because huggingface.co and
# GitHub release downloads were blocked where this was built:
#   model:  kokoro-fp32{a,b,c}-shards@1.0.0 (19 shards, concatenated in numeric order)
#   voices: kokoro-js@1.2.1 voices/b*.bin -> voices-gb.npz (see build_voices.py)
set -euo pipefail
cd "$(dirname "$0")"
PIPELINE="$(pwd)"
KOKORO_DIR="${KOKORO_DIR:-tts}"
mkdir -p "$KOKORO_DIR" && cd "$KOKORO_DIR"
for p in kokoro-fp32a-shards@1.0.0 kokoro-fp32b-shards@1.0.0 kokoro-fp32c-shards@1.0.0 kokoro-js@1.2.1; do
  npm pack --silent "$p" >/dev/null
done
mkdir -p fp32 voices
for t in kokoro-fp32?-shards-1.0.0.tgz; do tar xzf "$t" -C fp32 --strip-components=1 --wildcards 'package/kokoro-fp32.part*.bin'; done
ls fp32/kokoro-fp32.part*.bin | sort -V | xargs cat > kokoro-fp32.onnx
echo "8fbea51ea711f2af382e88c833d9e288c6dc82ce5e98421ea61c058ce21a34cb  kokoro-fp32.onnx" | sha256sum -c -
tar xzf kokoro-js-1.2.1.tgz -C voices --strip-components=2 --wildcards 'package/voices/b*.bin'
python3 "$PIPELINE/build_voices.py"
rm -rf fp32 voices ./*.tgz
echo "Kokoro ready in $(pwd)"
