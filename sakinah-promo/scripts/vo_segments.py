"""يقسّم تسجيل التعليق الصوتي إلى جمل عند فترات الصمت الطويلة، ويطبع مدة كل جملة."""
import sys, wave, json
import numpy as np

def load(path):
    w = wave.open(path)
    x = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float32) / 32768.0
    if w.getnchannels() > 1:
        x = x.reshape(-1, w.getnchannels()).mean(axis=1)
    return x, w.getframerate()

def segments(x, sr, gap=0.6, thr_db=-38, pad=0.06):
    hop = int(0.01 * sr)
    rms = np.sqrt(np.convolve(x ** 2, np.ones(hop * 2) / (hop * 2), mode="same")[::hop] + 1e-12)
    db = 20 * np.log10(rms / rms.max())
    voiced = db > thr_db
    segs, start, last = [], None, None
    for i, v in enumerate(voiced):
        t = i * hop / sr
        if v:
            if start is None:
                start = t
            elif t - last > gap:
                segs.append((start, last))
                start = t
            last = t
    if start is not None:
        segs.append((start, last))
    segs = [(max(0, a - pad), b + pad) for a, b in segs if b - a > 0.25]
    return segs

if __name__ == "__main__":
    for p in sys.argv[1:]:
        x, sr = load(p)
        s = segments(x, sr)
        print(p.split("/")[-1], len(s), json.dumps([round(b - a, 2) for a, b in s]), "speech", round(sum(b - a for a, b in s), 2))
