"""قياس تقريبي للجهارة المتكاملة (ITU-R BS.1770، بوابة مطلقة ونسبية) لملف WAV."""
import sys, wave
import numpy as np
from scipy import signal

def lufs(path):
    w = wave.open(path); sr = w.getframerate(); ch = w.getnchannels()
    x = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, ch) / 32768.0
    return lufs_array(x, sr), 20 * np.log10(np.max(np.abs(x)))

def lufs_array(x, sr):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)
    blk, hop = int(0.4 * sr), int(0.1 * sr)
    ms = np.array([np.mean(y[i:i + blk] ** 2, axis=0).sum() for i in range(0, len(y) - blk, hop)])
    l = -0.691 + 10 * np.log10(ms + 1e-12)
    g = ms[l > -70]
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g2 = ms[(l > -70) & (l > rel)]
    return -0.691 + 10 * np.log10(g2.mean())

if __name__ == "__main__":
    L, pk = lufs(sys.argv[1])
    print(f"integrated ≈ {L:.1f} LUFS, sample peak {pk:.1f} dBFS")
