"""
يبني التعليق الصوتي على الخط الزمني: يقطع تسجيل ElevenLabs (public/audio/vo/take.mp3) عند فترات الصمت،
يضع كل جملة في مشهدها، ويعيد ضبط مدد المشاهد في src/timeline.json لتتسع للصوت (الصورة تتبع الصوت).
الناتج: public/audio/vo/<id>.wav وsrc/vo.json (موضع كل مقطع بالإطار داخل مشهده).
تشغيل: python3 scripts/vo_build.py   (يحتاج numpy وscipy، وnpx remotion ffmpeg لفكّ mp3)
"""
import json, pathlib, subprocess, sys, wave
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from vo_segments import segments  # noqa: E402

FPS, SR = 30, 48000
TAKE = ROOT / "public" / "audio" / "vo" / "take.mp3"
TMP = ROOT / "public" / "audio" / "vo" / "_take.wav"

# النص المقروء (للتوثيق):
# سكينة. صلاتك وقرآنك وأذكارك… في مكان واحد. | مواقيت صلاتك بدقة، وتنبيه الأذان يصلك حتى والتطبيق مغلق. |
# مصحف المدينة كاملًا، بتلاوات عشرين قارئًا، وتفسير الميسّر دون اتصال. | والقبلة… أينما كنت. |
# أذكار الصباح والمساء، وحصن المسلم كاملًا. | بلا إعلانات، بلا تتبّع، ويعمل دون اتصال. | سكينة… حمّله مجانًا الآن.
# كل مقطع: (اسم، أرقام قطع الصمت، المشهد، الإطار داخل المشهد أو None = بعد المقطع السابق بفاصل)
CLIPS = [
    ("logo-name", [0], "Logo", 52),         # «سكينة» مع ظهور الاسم
    ("logo-line", [1], "Logo", None),       # صلاتك وقرآنك وأذكارك في مكان واحد
    ("prayer", [2], "Prayer", 12),
    ("mushaf", [3, 4], "Mushaf", 12),
    ("qibla", [5], "Qibla", 12),
    ("adhkar", [6], "Adhkar", 12),
    ("promise", [7], "Promise", 14),
    ("end-name", [8], "End", 14),           # «سكينة» مع ظهور الاسم في الختام
    ("end-cta", [9], "End", 46),            # حمّله مجانًا الآن مع ظهور الدعوة
]
GAP_AFTER = 12   # فاصل بين مقطعين في المشهد نفسه
TAIL = 14        # نفَس بعد آخر جملة قبل بدء الانتقال
MIN = {"Verse": 150, "Logo": 135, "Prayer": 150, "Mushaf": 170, "Qibla": 115, "Adhkar": 135, "Promise": 125, "End": 175}

subprocess.run(["npx", "remotion", "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(TAKE), "-ac", "1", "-ar", str(SR), str(TMP)], cwd=ROOT, check=True)
w = wave.open(str(TMP))
x = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float32) / 32768.0
TMP.unlink()
segs = segments(x, SR)
need = max(i for _, idx, _, _ in CLIPS for i in idx) + 1
if len(segs) != need:
    sys.exit(f"توقّعت {need} قطعة صوتية ووجدت {len(segs)}: {segs}")

T = json.loads((ROOT / "src" / "timeline.json").read_text())
trans = [t["frames"] for t in T["transitions"]]
order = [s["id"] for s in T["scenes"]]
out, cursor, end_of = [], {}, {}
for name, idx, scene, at in CLIPS:
    a, b = segs[idx[0]][0], segs[idx[-1]][1]
    clip = x[int(a * SR):int(b * SR)].copy()
    f = int(0.015 * SR)
    clip[:f] *= np.linspace(0, 1, f)
    clip[-f:] *= np.linspace(1, 0, f)
    path = ROOT / "public" / "audio" / "vo" / f"{name}.wav"
    with wave.open(str(path), "wb") as o:
        o.setnchannels(1); o.setsampwidth(2); o.setframerate(SR)
        o.writeframes((np.clip(clip, -1, 1) * 32767).astype("<i2").tobytes())
    frames = int(np.ceil((b - a) * FPS))
    start = at if at is not None else cursor[scene] + GAP_AFTER
    cursor[scene] = start + frames
    end_of[scene] = max(end_of.get(scene, 0), start + frames)
    out.append({"id": name, "scene": scene, "at": start, "frames": frames, "file": f"audio/vo/{name}.wav"})

for i, sid in enumerate(order):
    t_out = trans[i] if i < len(trans) else 0
    need_frames = end_of.get(sid, 0) + TAIL + t_out if sid in end_of else 0
    T["scenes"][i]["frames"] = max(MIN[sid], need_frames)

(ROOT / "src" / "timeline.json").write_text(json.dumps(T, indent=2, ensure_ascii=False) + "\n")
# مواعيد البطاقات: تظهر متتابعة خلال الجملة؛ ولقطة التظليل في المصحف مع «بتلاوات عشرين قارئًا»
CHIPS = {"Prayer": 3, "Mushaf": 3, "Qibla": 2, "Adhkar": 3}
cues = {}
for c in out:
    if c["scene"] in CHIPS:
        n = CHIPS[c["scene"]]
        cues[c["scene"]] = {"chipStart": c["at"] + round(0.2 * c["frames"]), "chipGap": round(0.55 * c["frames"] / max(n - 1, 1)), "chips": n}
mus = next(c for c in out if c["scene"] == "Mushaf")
cues["Mushaf"]["swap"] = mus["at"] + 50
(ROOT / "src" / "vo.json").write_text(json.dumps({"clips": out, "cues": cues}, indent=2, ensure_ascii=False) + "\n")
total = sum(s["frames"] for s in T["scenes"]) - sum(trans)
print({s["id"]: s["frames"] for s in T["scenes"]}, f"total {total} frames = {total / FPS:.1f}s")
for c in out:
    print(c)
