#!/usr/bin/env python3
"""
تجهيز تلاوة الآية لإعلان سكينة ٣٠ ثانية: ﴿أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ﴾ (الرعد ٢٨)
بصوت الشيخ ماهر المعيقلي، من ملف الآية كاملة (cdn.islamic.network/quran/audio/128/ar.mahermuaiqly/1735.mp3).

    python3 scripts/ad30_quran.py 1735.mp3                      # يقصّ عند الوقف ويقدّر مواضع الكلمات
    python3 scripts/ad30_quran.py 1735.mp3 --words 0,0.9,1.6,2.6,3.9   # مواضع الكلمات يدويًا (ثوانٍ من بداية المقطع)

يكتب public/ad30/quran/13-28.mp3 (نسخة من الأصل كما هو) و13-28.json (حدود المقطع ومواضع الكلمات)،
ثم يُبنى الخط الزمني والمزج بـ scripts/ad30_build.py. المقطع يبدأ بعد الوقف على «بذكر الله ۗ»
وينتهي بانتهاء صوت «القلوب» مع ذيله الطبيعي، ولا يُغيَّر في التلاوة شيء غير القصّ والتلاشي.
"""
import json
import shutil
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.ndimage import uniform_filter1d

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "ad30" / "quran"


def envelope_db(x, sr, win=0.02):
    p = uniform_filter1d(x ** 2, max(1, int(win * sr)))
    return 10 * np.log10(p + 1e-12)


def segments(e, sr, thr, min_gap=0.18):
    """مقاطع الصوت المتصلة (فوق العتبة) بعد دمج الفجوات الأقصر من min_gap."""
    on = e > thr
    idx = np.flatnonzero(np.diff(on.astype(int)))
    edges = [0, *(idx + 1), len(on)]
    segs = [(edges[i], edges[i + 1]) for i in range(len(edges) - 1) if on[edges[i]]]
    merged = []
    for a, b in segs:
        if merged and (a - merged[-1][1]) / sr < min_gap:
            merged[-1] = (merged[-1][0], b)
        else:
            merged.append((a, b))
    return [(a / sr, b / sr) for a, b in merged if (b - a) / sr > 0.12]


def main():
    src = Path(sys.argv[1])
    words = None
    if "--words" in sys.argv:
        words = [float(v) for v in sys.argv[sys.argv.index("--words") + 1].split(",")]
    x, sr = sf.read(src, always_2d=True)
    m = x.mean(axis=1)
    e = envelope_db(m, sr)
    thr = e.max() - 38
    segs = segments(e, sr, thr)
    print(f"{src.name}: {len(m) / sr:.2f}s, {sr} Hz")
    for i, (a, b) in enumerate(segs):
        gap = a - segs[i - 1][1] if i else a
        print(f"  [{i}] {a:6.2f}–{b:6.2f}  ({b - a:4.2f}s)  وقفة قبلها {gap:4.2f}s")
    # بداية «ألا»: أطول وقفة في النصف الثاني من الآية
    cands = [(segs[i][0] - segs[i - 1][1], i) for i in range(1, len(segs)) if segs[i][0] > len(m) / sr * 0.35]
    if not cands:
        raise SystemExit("لم أجد الوقف قبل «ألا»؛ مرّر --cut يدويًا")
    _, k = max(cands)
    start = max(0.0, segs[k][0] - 0.06)
    end = min(len(m) / sr, segs[-1][1] + 0.45)
    print(f"المقطع: {start:.2f}–{end:.2f}s ({end - start:.2f}s)")
    if words is None:
        # تقدير أولي من انخفاضات الطاقة (إغلاق الباء والتاء والقاف)؛ يُراجَع بالأذن أو بالتفريغ
        from scipy.signal import find_peaks
        hop = int(0.01 * sr)
        seg_e = e[int(start * sr): int(end * sr): hop]
        dips, _ = find_peaks(-seg_e, prominence=6, distance=12)
        dips = [round(d * 0.01, 2) for d in dips if 0.15 < d * 0.01 < end - start - 0.5]
        print("  انخفاضات الطاقة (ث من بداية المقطع):", ", ".join(f"{d:.2f}" for d in dips))
        dur = end - start - 0.45
        words = [0.0, *(round(float(dur * r), 2) for r in (0.17, 0.33, 0.5, 0.72))]
        print("  مواضع تقديرية (راجعها):", words)
    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, OUT / "13-28.mp3")
    cfg = {
        "file": "13-28.mp3",
        "reciter": "ماهر المعيقلي",
        "ayah": "الرعد ٢٨ — أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ",
        "cut": [round(start, 3), round(end, 3)],
        "words": words,
        "fadeIn": 30,
        "fadeOut": 450,
        "level": -15.5,
    }
    (OUT / "13-28.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=1) + "\n")
    print("كُتب", OUT / "13-28.json")


if __name__ == "__main__":
    main()
