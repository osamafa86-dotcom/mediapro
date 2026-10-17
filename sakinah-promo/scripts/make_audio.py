"""
مؤثرات صوت الإعلان (بلا موسيقى ولا آلات): هواء خافت، «ووش» من اليمين إلى اليسار عند كل انتقال،
ضربة منخفضة تحت ظهور الشعار، ورنّات قصيرة كأصوات الإشعار، ونقرات ناعمة لظهور البطاقات.
التوقيتات من src/timeline.json لتطابق المشاهد تمامًا. الناتج: public/audio/soundtrack.wav
"""
import json, pathlib, wave
import numpy as np
from scipy import signal

ROOT = pathlib.Path(__file__).resolve().parent.parent
T = json.loads((ROOT / "src" / "timeline.json").read_text())
FPS = T["fps"]
SR = 48000
rng = np.random.default_rng(7)

# بدايات المشاهد بالإطارات (الانتقال يتداخل مع آخر المشهد السابق)
starts, t = {}, 0
for i, s in enumerate(T["scenes"]):
    starts[s["id"]] = t
    t += s["frames"] - (T["transitions"][i]["frames"] if i < len(T["transitions"]) else 0)
total_frames = t
N = int(total_frames / FPS * SR) + SR // 2
mix = np.zeros((N, 2))

def at(frame):
    return int(frame / FPS * SR)

def add(buf, frame, gain=1.0):
    i = at(frame)
    n = min(len(buf), N - i)
    if n > 0:
        mix[i:i + n] += buf[:n] * gain

def pan(mono, p):
    # p من -1 (يسار) إلى 1 (يمين)، مصفوفة أو قيمة
    p = np.broadcast_to(p, mono.shape)
    a = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], axis=1)

# ١) سرير هواء: ضجيج وردي مرشَّح منخفض مع تموّج بطيء، مستقل في القناتين
def air(n):
    out = []
    for ch in range(2):
        w = rng.standard_normal(n)
        sos = signal.butter(2, [120, 900], btype="band", fs=SR, output="sos")
        x = signal.sosfilt(sos, w)
        lfo = 0.75 + 0.25 * np.sin(2 * np.pi * (0.06 + ch * 0.013) * np.arange(n) / SR + ch)
        out.append(x * lfo)
    x = np.stack(out, axis=1)
    return x / np.max(np.abs(x))

bed = air(N) * 0.05
fade_in, fade_out = int(1.6 * SR), int(2.4 * SR)
env = np.ones(N)
env[:fade_in] = np.linspace(0, 1, fade_in) ** 2
env[-fade_out:] = np.linspace(1, 0, fade_out) ** 2
mix += bed * env[:, None]

# ٢) «ووش»: ضجيج يمرّ بمرشّح نطاق يكنس صعودًا ثم هبوطًا، وينتقل من اليمين إلى اليسار
def whoosh(dur=0.9, f0=250, f1=3200, f2=500, p0=0.8, p1=-0.8):
    n = int(dur * SR)
    noise = rng.standard_normal(n + 2048)
    f, tt, Z = signal.stft(noise, fs=SR, nperseg=1024)
    prog = np.linspace(0, 1, Z.shape[1])
    fc = np.where(prog < 0.55, f0 * (f1 / f0) ** (prog / 0.55), f1 * (f2 / f1) ** ((prog - 0.55) / 0.45))
    bw = fc * 0.9
    mask = np.exp(-0.5 * ((f[:, None] - fc[None, :]) / bw[None, :]) ** 2)
    _, y = signal.istft(Z * mask, fs=SR, nperseg=1024)
    y = y[:n]
    e = np.sin(np.pi * np.clip(np.arange(n) / n, 0, 1)) ** 2.2
    e *= np.exp(-1.2 * np.arange(n) / n)
    y = y * e
    y /= np.max(np.abs(y))
    return pan(y, np.linspace(p0, p1, n))

# ٣) ضربة منخفضة: جيب ينزلق 95→38 هرتز مع نبضة ضجيج قصيرة
def impact(dur=1.4):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    fr = 38 + 57 * np.exp(-tt * 9)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    body = np.sin(ph) * np.exp(-tt * 3.2)
    click = signal.sosfilt(signal.butter(2, 1800, fs=SR, output="sos"), rng.standard_normal(n)) * np.exp(-tt * 60) * 0.35
    y = body + click
    y /= np.max(np.abs(y))
    return pan(y, 0.0)

# ٤) رنّة إشعار قصيرة (ليست لحنًا): نغمة مع توافقيات تخبو سريعًا، وصدى خفيف
def ding(freq=1318.5, dur=1.6, p=0.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = np.zeros(n)
    for k, (r, a, d) in enumerate([(1, 1.0, 3.2), (2.0, 0.35, 5.5), (3.01, 0.18, 8.0), (4.2, 0.08, 11.0)]):
        y += a * np.sin(2 * np.pi * freq * r * tt + k) * np.exp(-tt * d)
    y *= 1 - np.exp(-tt * 400)
    # صدى بسيط
    for delay, g in [(0.11, 0.35), (0.23, 0.18), (0.37, 0.09)]:
        dly = int(delay * SR)
        y[dly:] += y[:-dly] * g
    y /= np.max(np.abs(y))
    return pan(y, p)

# ٥) نقرة ناعمة لظهور البطاقة
def tick(p=0.0):
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    y = np.sin(2 * np.pi * 2350 * tt) * np.exp(-tt * 70) + 0.4 * signal.sosfilt(signal.butter(2, 3000, btype="high", fs=SR, output="sos"), rng.standard_normal(n)) * np.exp(-tt * 180)
    y /= np.max(np.abs(y))
    return pan(y, p)

# --- التوزيع على الخط الزمني ---
# انتقالات: الووش يبلغ ذروته في منتصف الانتقال
for i, s in enumerate(T["scenes"][1:]):
    tr = T["transitions"][i]
    center = starts[s["id"]] + tr["frames"] / 2
    if tr["kind"] == "push":
        # الصفحة تُدفع يمينًا فيتبعها الصوت من اليسار إلى اليمين
        add(whoosh(0.8, 300, 3400, 600, -0.85, 0.85), center - 0.45 * FPS, 0.24)
    else:
        add(whoosh(1.1, 200, 1800, 400, 0.2, -0.2), center - 0.6 * FPS, 0.16)

# تنفّس افتتاحي تحت الآية
add(impact(2.2), 2, 0.18)

L = starts["Logo"]
add(impact(), L + 44, 0.5)          # اكتمال رسم الأيقونة
add(ding(1318.5, p=0.3), L + 46, 0.16)  # النقطة الذهبية
add(whoosh(0.7, 400, 2600, 700), L + 50, 0.12)  # صعود الاسم

# بطاقات المزايا
chips = {"Prayer": (34, 3), "Mushaf": (34, 3), "Qibla": (30, 2), "Adhkar": (34, 3)}
for sid, (c0, n) in chips.items():
    for k in range(n):
        add(tick(p=0.4 if k % 2 == 0 else -0.4), starts[sid] + c0 + k * 13 + 3, 0.09)
# تبديل لقطة المصحف إلى التظليل
add(ding(1760.0, 1.2, p=-0.2), starts["Mushaf"] + 78, 0.07)

# صفوف «بلا مشتّتات»
for k in range(3):
    add(tick(p=0.2), starts["Promise"] + 28 + k * 14, 0.1)

E = starts["End"]
add(impact(), E + 2, 0.42)
add(ding(1318.5, 2.0, p=0.0), E + 4, 0.15)
add(tick(0.3), E + 55, 0.09)
add(tick(-0.3), E + 63, 0.09)
add(ding(1975.5, 1.6, p=0.0), E + 72, 0.06)  # لمعة الأيقونة

# جهارة مستهدفة نحو -18 LUFS مع محدِّد ناعم يبقي القمم دون -1 dBFS
import sys
sys.path.insert(0, str(ROOT / "scripts"))
from lufs import lufs_array
TARGET, CEIL = -18.0, 10 ** (-1 / 20)
raw = mix / np.max(np.abs(mix))
g = 1.0
for _ in range(12):
    out_ = np.tanh(raw * g) * CEIL
    L = lufs_array(out_, SR)
    g *= 10 ** ((TARGET - L) / 20)
mix = np.tanh(raw * g) * CEIL
print(f"gain {g:.2f}, loudness ≈ {lufs_array(mix, SR):.1f} LUFS")
pcm = (mix * 32767).astype("<i2")
out = ROOT / "public" / "audio" / "soundtrack.wav"
with wave.open(str(out), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(out, f"{N / SR:.2f}s", {k: v for k, v in starts.items()}, "total", total_frames)
