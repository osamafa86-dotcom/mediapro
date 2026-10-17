#!/usr/bin/env python3
"""
إعلان سكينة ٣٠ ثانية (SakinahAd30): يبني الخط الزمني من مدد التعليق والتلاوة، ثم يمزج الصوت.

    python3 scripts/ad30_build.py          # الخط الزمني + المزج
    python3 scripts/ad30_build.py --plan   # الخط الزمني فقط

المدخلات (public/ad30):
    vo/take.flac       تعليق «مازن» الكامل (ElevenLabs، eleven_v4)، يُقطع إلى ١٢ عبارة حسب PHRASES
    quran/13-28.json   مقطع التلاوة ومواضع كلماتها (يكتبه scripts/ad30_quran.py من ملف المعيقلي)
    sfx/*.flac         مؤثرات ElevenLabs المختارة: لا موسيقى ولا آلات
المخرجات:
    src/ad30/timeline.json       حدود المشاهد بالإطارات، ومواضع كلمات الآية، ومواضع العبارات
    src/ad30/cues.json           نقاط التزامن ومسار الصوت
    public/ad30/soundtrack.wav   المزج: −14 LUFS، قمة حقيقية ≤ −1 dBTP، ‏48 كيلوهرتز ستيريو

قاعدة ثابتة: لا شيء فوق التلاوة. لا مؤثر ولا تعليق بين أول صوت فيها وآخره.
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.signal import butter, lfilter, resample_poly, sosfiltfilt

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "public" / "ad30"
FPS, TOTAL, SR = 30, 900, 48000

# ───────── التعليق: (المعرّف، النص، بداية، نهاية بالثواني في take، تلاشي دخول/خروج ms، تعديل dB) ─────────
PHRASES = [
    ("p01", "فِي عَالَمٍ لَا يَهْدَأْ…", 0.066, 1.487, 8, 25, 0.0),
    ("p02", "سَكِينَة", 1.754, 2.474, 8, 25, 0.5),
    ("p03", "صَلَاتُكَ", 2.656, 3.230, 8, 25, 0.0),
    ("p04", "وَقِبْلَتُكَ", 3.369, 4.221, 8, 25, 0.0),
    ("p05", "وَقُرْآنُكَ", 4.480, 5.368, 8, 35, 0.0),
    ("p06", "وَأَذْكَارُكَ", 5.362, 6.070, 22, 25, 0.0),
    ("p07", "فِي مَكَانٍ وَاحِدْ", 6.178, 7.588, 8, 25, 0.0),
    ("p08", "بِلَا إِعْلَانَاتْ", 7.966, 8.830, 8, 25, 0.0),
    ("p09", "بِلَا تَتَبُّعْ", 9.108, 10.088, 8, 25, 0.0),
    ("p10", "أَنْتَ وَذِكْرُ اللهِ فَقَطْ", 10.494, 12.226, 8, 30, -0.8),
    ("p11", "سَكِينَة", 12.741, 13.466, 8, 25, 0.8),
    ("p12", "حَمِّلْهُ الآنَ مَجَّانًا", 13.592, 15.429, 8, 40, 0.5),
]
VO_TARGET = -16.0  # مستوى الكلام (K-weighted، الأجزاء الناطقة) قبل الضبط النهائي

# ───────── أدوات ─────────

def load(path: Path, mono=False) -> np.ndarray:
    x, sr = sf.read(path, always_2d=True)
    x = x.astype(np.float64)
    if sr != SR:
        g = np.gcd(SR, sr)
        x = resample_poly(x, SR // g, sr // g, axis=0)
    if mono:
        return x.mean(axis=1)
    return np.repeat(x, 2, axis=1) if x.shape[1] == 1 else x[:, :2]


def kweight(x: np.ndarray) -> np.ndarray:
    """مرشّح K لـ BS.1770 عند 48 كيلوهرتز."""
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621]
    return lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)


def _ms_blocks(x, blk=0.4, hop=0.1):
    y = kweight(x if x.ndim == 2 else x[:, None])
    b, h = int(blk * SR), int(hop * SR)
    if len(y) < b:
        y = np.pad(y, ((0, b - len(y)), (0, 0)))
    return np.array([np.mean(y[i:i + b] ** 2, axis=0).sum() for i in range(0, len(y) - b + 1, h)])


def integrated(x) -> float:
    ms = _ms_blocks(x)
    lv = -0.691 + 10 * np.log10(ms + 1e-15)
    g = ms[lv > -70]
    if not len(g):
        return -99.0
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g2 = ms[(lv > -70) & (lv > rel)]
    return float(-0.691 + 10 * np.log10(g2.mean()))


def momentary_max(x) -> float:
    return float(-0.691 + 10 * np.log10(_ms_blocks(x).max() + 1e-15))


def speech_level(x) -> float:
    """مستوى الكلام: متوسط K-weighted للأجزاء التي تعلو −45 dB (كبديل قصير لـ P.56)."""
    y = kweight(x if x.ndim == 2 else x[:, None])
    w = int(0.02 * SR)
    p = uniform_filter1d((y ** 2).sum(axis=1), w)
    act = p > 10 ** (-45 / 10)
    return float(-0.691 + 10 * np.log10(p[act].mean() + 1e-15)) if act.any() else -99.0


def db(v):
    return 10 ** (v / 20)


def hpf(x, fc, order=2):
    return sosfiltfilt(butter(order, fc, btype="highpass", fs=SR, output="sos"), x, axis=0)


def fade(x, fin_ms, fout_ms):
    x = x.copy()
    n1, n2 = int(fin_ms / 1000 * SR), int(fout_ms / 1000 * SR)
    if n1:
        x[:n1] *= (np.sin(np.linspace(0, np.pi / 2, n1)) ** 2).reshape(-1, *([1] * (x.ndim - 1)))
    if n2:
        x[-n2:] *= (np.cos(np.linspace(0, np.pi / 2, n2)) ** 2).reshape(-1, *([1] * (x.ndim - 1)))
    return x


def env_db(x, win=0.01):
    m = x if x.ndim == 1 else x.mean(axis=1)
    p = uniform_filter1d(m ** 2, max(1, int(win * SR)))
    return 10 * np.log10(p + 1e-15)


def sync_offset(x, mode: str) -> int:
    """موضع نقطة التزامن داخل المؤثر بالعيّنات: start | peak | last (آخر نقرة)."""
    if mode == "start":
        return 0
    e = env_db(x, 0.01)
    if mode == "peak":
        return int(np.argmax(e))
    if mode == "last":
        on = np.where(e > e.max() - 14)[0]
        return int(on[-1]) if len(on) else 0
    raise ValueError(mode)


def true_peak(x) -> float:
    up = resample_poly(x, 4, 1, axis=0)
    return float(20 * np.log10(np.max(np.abs(up)) + 1e-15))


def limiter(x, ceiling_db=-1.0, look=0.002, release=0.09):
    """محدِّد بنظرة مسبقة على القمة الحقيقية (أخذ عينات ×٤)."""
    c = db(ceiling_db)
    up = np.abs(resample_poly(x, 4, 1, axis=0)).max(axis=1)
    n = len(x)
    tp = up[: n * 4].reshape(n, 4).max(axis=1) if len(up) >= n * 4 else np.pad(up, (0, n * 4 - len(up))).reshape(n, 4).max(axis=1)
    need = np.minimum(1.0, c / np.maximum(tp, 1e-12))
    L = int(look * SR)
    g = minimum_filter1d(need, 2 * L + 1, mode="nearest")
    g = uniform_filter1d(g, L + 1, mode="nearest")
    g = np.minimum(g, need)
    a = np.exp(-1.0 / (release * SR))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(n):
        v = g[i]
        cur = v if v < cur else v + (cur - v) * a
        out[i] = cur
    return x * out[:, None]


# ───────── التعليق ─────────

def vo_phrases():
    take = load(PUB / "vo" / "take.flac", mono=True)
    take = hpf(take, 75)
    out = {}
    for pid, text, a, b, fi, fo, adj in PHRASES:
        seg = fade(take[int(a * SR): int(b * SR)], fi, fo)
        lvl = speech_level(seg)
        # تقريب كل عبارة ٦٠٪ نحو الهدف حتى تبقى ديناميكية الأداء
        g = (VO_TARGET - lvl) * 0.6 + adj
        seg = seg * db(g)
        out[pid] = {"text": text, "x": seg, "frames": int(np.ceil(len(seg) / SR * FPS)), "level": lvl}
    # كسب موحّد بعد التقريب
    allv = np.concatenate([p["x"] for p in out.values()])
    k = db(VO_TARGET - speech_level(allv))
    for p in out.values():
        p["x"] = p["x"] * k
    return out


# ───────── التلاوة ─────────

def quran():
    cfg_path = PUB / "quran" / "13-28.json"
    if not cfg_path.exists():
        # مكان محجوز حتى يصل ملف التلاوة: مدة تقديرية ومواضع كلمات تقريبية
        return {"x": None, "frames": 168, "words": [0.0, 0.95, 1.7, 2.75, 4.0], "placeholder": True}
    cfg = json.loads(cfg_path.read_text())
    x = load(PUB / "quran" / cfg["file"], mono=True)
    a, b = cfg["cut"]
    seg = x[int(a * SR): int(b * SR)]
    seg = hpf(seg, 55)
    seg = fade(seg, cfg.get("fadeIn", 30), cfg.get("fadeOut", 450))
    seg = seg * db(cfg.get("level", -15.5) - speech_level(seg))
    return {"x": seg, "frames": int(np.ceil(len(seg) / SR * FPS)), "words": cfg["words"], "placeholder": False}


# ───────── الخط الزمني ─────────

def plan(vo, rec):
    d = {k: v["frames"] for k, v in vo.items()}
    fr = lambda s: int(round(s * FPS))
    GAP, REC_LEAD = 8, 8
    # العبارات ٨ و٩ و١٠ ثم ١١ و١٢ بفواصلها الطبيعية في التسجيل
    g89 = fr(PHRASES[8][2] - PHRASES[7][2])
    g910 = fr(PHRASES[9][2] - PHRASES[8][2])
    g1112 = fr(PHRASES[11][2] - PHRASES[10][2])
    promise_len = 8 + g89 + g910 + d["p10"] + 1
    end_vo = 6 + g1112 + d["p12"]
    R = rec["frames"]

    # ما يمكن أن ينكمش إذا طالت التلاوة، بالترتيب: (المعامل، أدنى قيمة)
    p = {"day": 66, "logo": 100, "tail": 20, "oneLead": 10, "noise": 52, "hold": 14}
    steps = [("day", 62), ("logo", 96), ("tail", 16), ("day", 60), ("oneLead", 8), ("logo", 94),
             ("tail", 14), ("day", 58), ("noise", 48), ("day", 56), ("oneLead", 6), ("noise", 46), ("hold", 12)]

    def total(q):
        one_len = q["oneLead"] + d["p07"] + 3
        return q["noise"] + GAP + REC_LEAD + R + q["tail"] + q["logo"] + 4 * q["day"] + one_len + promise_len + end_vo + q["hold"]

    for key, lo in steps:
        while total(p) > TOTAL and p[key] > lo:
            p[key] -= 1
    if total(p) > TOTAL:
        raise SystemExit(f"التلاوة أطول من المتاح ({R} إطارًا): قصّر مقطعها أو زد مدة الإعلان")
    p["hold"] += TOTAL - total(p)  # الفائض وقفة أطول على شاشة الختام

    NOISE_END, VERSE_TAIL, logo_len, day, one_len = p["noise"], p["tail"], p["logo"], p["day"], p["oneLead"] + d["p07"] + 3
    V0 = NOISE_END + GAP
    REC = V0 + REC_LEAD
    REC_END = REC + R
    L0 = REC_END + VERSE_TAIL
    F0 = L0 + logo_len
    D0, A0, M0, O0 = F0 + day, F0 + 2 * day, F0 + 3 * day, F0 + 4 * day
    P0 = O0 + one_len
    E0 = P0 + promise_len
    beats = {
        "noise": [0, NOISE_END],
        "verse": [V0, L0],
        "logo": [L0, F0],
        "fajr": [F0, D0],
        "dhuhr": [D0, A0],
        "asr": [A0, M0],
        "maghrib": [M0, O0],
        "one": [O0, P0],
        "promise": [P0, E0],
        "end": [E0, TOTAL],
    }
    at = {
        "p01": L0 + 4,
        "p02": L0 + 62,
        "p03": F0 + 12,
        "p04": D0 + 8,
        "p05": A0 + 8,
        "p06": M0 + 8,
        "p07": O0 + p["oneLead"],
        "p08": P0 + 8,
        "p09": P0 + 8 + g89,
        "p10": P0 + 8 + g89 + g910,
        "p11": E0 + 6,
        "p12": E0 + 6 + g1112,
    }
    words = [REC + fr(w) - 3 for w in rec["words"]]
    cues = {
        "logoName": at["p02"],
        "logoHit": L0 + 54,
        "promise": {"ads": at["p08"] - 3, "track": at["p09"] - 3, "only": at["p10"] - 3},
        "verse": {"rec": REC, "recEnd": REC_END},
        "soundtrack": "ad30/soundtrack.wav",
    }
    return beats, at, words, cues, {"day": day, "logo": logo_len, "hold": TOTAL - (at["p12"] + d["p12"]), "params": p}


# ───────── المؤثرات ─────────

def sfx_list(B, at, cues):
    """كل مؤثر: الملف، إطار التزامن، نمطه (start | peak | last)، أعلى جهارة لحظية LUFS قبل الضبط النهائي،
    وللأسرّة: مدة بالإطارات وتلاشٍ (ms) وتخفيض تحت الكلام."""
    F0, D0, A0, M0, O0 = B["fajr"][0], B["dhuhr"][0], B["asr"][0], B["maghrib"][0], B["one"][0]
    L0, E0 = B["logo"][0], B["end"][0]
    bed = lambda name, a, b, lvl: dict(name=name, at=a, mode="start", lufs=lvl, frames=b - a, fade=(320, 420), duck=True)
    hit = lambda name, at, mode, lvl: dict(name=name, at=at, mode=mode, lufs=lvl)
    return [
        dict(name="noise", at=0, mode="start", lufs=-12.5, frames=B["noise"][1], fade=(2, 3)),  # يُقطع قطعًا حادًّا
        hit("sparkle", L0 - 4, "start", -29.0),          # النقطة الذهبية تنطلق
        hit("logo_boom", cues["logoHit"], "peak", -18.5),  # اكتمال الأيقونة
        hit("whoosh3", F0 - 2, "peak", -25.0),           # صعود الهاتف
        bed("dawn", F0 - 10, D0 + 10, -34.0),            # طيور الفجر
        hit("buzz", F0 + 8, "start", -30.0),             # إشعار الأذان
        hit("whoosh2", D0 + 1, "peak", -25.0),
        bed("day", D0 - 4, M0 + 10, -37.0),              # هواء الظهيرة
        hit("compass", D0 + 42, "last", -30.0),          # البوصلة تستقر على القبلة
        hit("whoosh4", A0 + 1, "peak", -25.0),
        hit("page", A0 + 4, "peak", -29.0),              # صفحة المصحف
        hit("whoosh1", M0 + 1, "peak", -26.0),
        bed("evening", M0 - 4, O0 + 34, -36.0),          # صراصير الغروب
        hit("beads", M0 + 4, "start", -30.0),            # حبّات المسبحة مع العدّاد
        hit("fan", O0 + 19, "peak", -26.0),              # الشاشات الأربع تنفتح
        hit("glitch1", at["p08"] - 16, "start", -23.0),  # الإعلان يتبدّد
        hit("glitch2", at["p09"] - 18, "start", -24.0),  # نافذة التتبّع تتبدّد
        hit("sparkle", at["p10"] - 2, "start", -31.0),   # السطر الذهبي
        hit("end_boom", E0, "peak", -18.5),              # الختام
    ]


def room_tone(n, rng):
    """هواء خافت جدًا بين الجمل (ضجيج وردي مرشَّح، مستقل في القناتين)."""
    out = []
    for ch in range(2):
        w = rng.standard_normal(n)
        b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
        a = [1, -2.494956002, 2.017265875, -0.522189400]
        p = lfilter(b, a, w)
        p = sosfiltfilt(butter(2, [140, 3500], btype="band", fs=SR, output="sos"), p)
        out.append(p)
    x = np.stack(out, axis=1)
    return x / np.sqrt(np.mean(x ** 2))


def mix(B, at, cues, vo, rec):
    N = int(TOTAL / FPS * SR)
    speech = np.zeros((N, 2))
    fx = np.zeros((N, 2))
    duckable = np.zeros((N, 2))
    s = lambda f: int(round(f / FPS * SR))

    def put(buf, x, i):
        if i < 0:
            x, i = x[-i:], 0
        n = min(len(x), N - i)
        if n > 0:
            buf[i:i + n] += x[:n] if x.ndim == 2 else np.repeat(x[:n, None], 2, axis=1)

    for pid, p in vo.items():
        put(speech, p["x"], s(at[pid]))

    rec_a, rec_b = s(cues["verse"]["rec"]), s(cues["verse"]["recEnd"])
    if rec["x"] is not None:
        put(speech, rec["x"], rec_a)

    for e in sfx_list(B, at, cues):
        x = load(PUB / "sfx" / f"{e['name']}.flac")
        if e.get("frames"):
            n = min(len(x), s(e["frames"]))
            x = fade(x[:n], *e.get("fade", (120, 220)))
        x = x * db(e["lufs"] - momentary_max(x))
        i = s(e["at"]) - sync_offset(x, e["mode"])
        # لا شيء فوق التلاوة
        if i < rec_b + int(0.25 * SR) and i + len(x) > rec_a:
            raise SystemExit(f"المؤثر {e['name']} يتداخل مع التلاوة")
        put(duckable if e.get("duck") else fx, x, i)

    # هواء خافت من بعد التلاوة حتى النهاية
    rng = np.random.default_rng(28)
    a = rec_b + int(0.5 * SR)
    room = room_tone(N - a, rng)
    room = fade(room * db(-54.0 - momentary_max(room[: SR * 4])), 900, 700)
    duckable[a:] += room

    # تخفيض الأسرّة تحت الكلام (٦ dB)
    env = uniform_filter1d(np.abs(speech).max(axis=1), int(0.05 * SR))
    on = (env > db(-40)).astype(float)
    sm = lfilter([1 - np.exp(-1 / (0.12 * SR))], [1, -np.exp(-1 / (0.12 * SR))], on)
    duck = 1 - 0.5 * np.clip(sm, 0, 1)
    out = speech + fx + duckable * duck[:, None]

    # الضبط النهائي: −14 LUFS ثم محدّد −1 dBTP (مرّتان لتعويض ما يأخذه المحدّد)
    for _ in range(3):
        out = out * db(-14.0 - integrated(out))
        out = limiter(out, -1.2)
    return out, speech, fx + duckable * duck[:, None]


def main():
    vo = vo_phrases()
    rec = quran()
    B, at, words, cues, info = plan(vo, rec)
    tl = {
        "fps": FPS,
        "total": TOTAL,
        "beats": B,
        "verseWords": words,
        "vo": [{"id": k, "at": at[k], "frames": vo[k]["frames"], "text": vo[k]["text"]} for k in at],
    }
    (ROOT / "src" / "ad30" / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False, indent=1) + "\n")
    (ROOT / "src" / "ad30" / "cues.json").write_text(json.dumps(cues, ensure_ascii=False, indent=1) + "\n")
    print("beats:", " ".join(f"{k}={v[0]}–{v[1]}" for k, v in B.items()))
    print(f"day={info['day']}f logo={info['logo']}f hold={info['hold']}f  recitation={rec['frames']}f{' (مؤقت)' if rec['placeholder'] else ''}")
    for k in at:
        print(f"  {k} @{at[k]:4d} +{vo[k]['frames']:3d}  {vo[k]['text']}")
    if "--plan" in sys.argv:
        return
    out, speech, fx = mix(B, at, cues, vo, rec)
    sf.write(PUB / "soundtrack.wav", out.astype(np.float32), SR, subtype="PCM_16")
    print(f"soundtrack: {integrated(out):.1f} LUFS, true peak {true_peak(out):.1f} dBTP, {len(out) / SR:.2f}s")
    if "--stems" in sys.argv:
        sf.write(PUB / "stem-speech.wav", speech.astype(np.float32), SR, subtype="PCM_16")
        sf.write(PUB / "stem-fx.wav", fx.astype(np.float32), SR, subtype="PCM_16")


if __name__ == "__main__":
    main()
