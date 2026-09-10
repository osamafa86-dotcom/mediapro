#!/usr/bin/env python3
"""خطوط المصحف للتطبيق الأصلي: تنزيل خطوط صفحات QCF v1 الـ604 وخط أسماء السور (WOFF2) من CDN مرة واحدة إلى الكاش المشترك،
تحويلها إلى TTF (CoreText لا يقرأ WOFF2)، وضغطها raw-deflate (يفكّها إطار Compression على iOS) إلى App/Fonts/*.ttf.z
مع 4 بايتات في البداية تحمل الحجم الأصلي. الاعتماديات: pip3 install fonttools brotli
التشغيل: python3 sakinah-native/tools/build-fonts.py [--pages 1-604]
"""
import io, os, sys, struct, zlib, subprocess, pathlib
from fontTools.ttLib import TTFont

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
FONT_BASE = 'https://cdn.jsdelivr.net/gh/quran/quran.com-frontend-next@aff1a035b09b66f28047b3216edcae4c5c949a49/public/fonts/quran/'
# خط حفص (مجمع الملك فهد، الإصدار 18) لوضع النص المتدفق — اسمه في CoreText: KFGQPCHAFSUthmanicScript-Regula
HAFS_URL = 'https://cdn.jsdelivr.net/gh/quran/quran.com-frontend-next@master/public/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2'
CACHE = (ROOT.parent / 'sakinah' / '.cache' / 'fonts-qcf')  # الكاش نفسه الذي يستخدمه build-www.mjs
OUT = ROOT / 'App' / 'Fonts'
AMIRI = ROOT.parent / 'sakinah' / 'assets' / 'fonts' / 'AmiriQuran.woff2'

def fetch(rel: str, url: str | None = None) -> pathlib.Path:
    dst = CACHE / rel
    if dst.exists() and dst.stat().st_size > 1000: return dst
    dst.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        r = subprocess.run(['curl', '-sS', '-f', '-L', '-m', '60', '-o', str(dst), url or (FONT_BASE + rel)])
        if r.returncode == 0 and dst.exists() and dst.stat().st_size > 1000: return dst
    raise SystemExit(f'تعذّر جلب {rel}')

def convert(src: pathlib.Path, name: str) -> int:
    f = TTFont(str(src)); f.flavor = None
    buf = io.BytesIO(); f.save(buf); ttf = buf.getvalue()
    c = zlib.compressobj(9, zlib.DEFLATED, -15)  # raw deflate بلا ترويسة zlib (COMPRESSION_ZLIB في Apple)
    z = c.compress(ttf) + c.flush()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f'{name}.ttf.z').write_bytes(struct.pack('<I', len(ttf)) + z)
    return len(z)

def main():
    pages = range(1, 605)
    if len(sys.argv) > 2 and sys.argv[1] == '--pages':
        a, b = sys.argv[2].split('-'); pages = range(int(a), int(b) + 1)
    total = 0
    for p in pages:
        total += convert(fetch(f'hafs/v1/woff2/p{p}.woff2'), f'p{p}')
    total += convert(fetch('surah-names/v1/sura_names.woff2'), 'sura_names')
    total += convert(fetch('UthmanicHafs1Ver18.woff2', HAFS_URL), 'hafs')
    if AMIRI.exists(): total += convert(AMIRI, 'AmiriQuran')
    print(f'خطوط المصحف: {len(list(pages))} صفحة + أسماء السور + حفص + أميري قرآن → {OUT} ({total // 1024 // 1024} م.ب مضغوطة)')

if __name__ == '__main__': main()
