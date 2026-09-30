# Packs kokoro-js voices/*.bin (510x1x256 float32 style vectors) into voices-gb.npz for kokoro-onnx.
# Run inside $KOKORO_DIR (fetch_tts.sh does this).
import numpy as np, glob, os
d={}
for f in sorted(glob.glob('voices/*.bin')):
    a=np.fromfile(f,dtype=np.float32).reshape(-1,1,256)
    d[os.path.basename(f)[:-4]]=a
np.savez('voices-gb.npz',**d)
print({k:v.shape for k,v in d.items()})
