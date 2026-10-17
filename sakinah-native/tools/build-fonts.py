#!/usr/bin/env python3
"""خطوط المصحف للتطبيق الأصلي: تنزيل خطوط صفحات QCF v2 (خطّ طبعة المدينة الأحدث) الـ604 وخط أسماء السور (WOFF2) من CDN مرة واحدة إلى الكاش المشترك،
تحويلها إلى TTF (CoreText لا يقرأ WOFF2)، وضغطها raw-deflate (يفكّها إطار Compression على iOS) إلى App/Fonts/*.ttf.z
مع 4 بايتات في البداية تحمل الحجم الأصلي. الاعتماديات: pip3 install fonttools brotli
التشغيل: python3 sakinah-native/tools/build-fonts.py [--pages 1-604]

منذ 5.1.1 لا يضمّ تطبيق iOS إلا صفحات قليلة (BUNDLED_PAGES)؛ البقية حزمة واحدة تُنزَّل بعد التثبيت:
  python3 sakinah-native/tools/build-fonts.py --pack out.pack   ← يبنيها سير mushaf-fonts.yml وينشرها إصدارًا على GitHub
صيغة الحزمة (little-endian): "SKMP" | u16 الإصدار=1 | u16 العدد=604 | العدد × (u32 الإزاحة من أول الملف، u32 الطول) | الكتل
وكل كتلة هي محتوى p<N>.ttf.z نفسه (4 بايتات الحجم الأصلي + raw deflate)، فيقرؤها التطبيق من الملف مباشرة دون فكّ أرشيف.
"""
import io
import time, os, sys, struct, zlib, subprocess, pathlib
from fontTools.ttLib import TTFont

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
FONT_BASE = 'https://cdn.jsdelivr.net/gh/quran/quran.com-frontend-next@aff1a035b09b66f28047b3216edcae4c5c949a49/public/fonts/quran/'
# خط حفص (مجمع الملك فهد، الإصدار 18) لوضع النص المتدفق — اسمه في CoreText: KFGQPCHAFSUthmanicScript-Regula
HAFS_URL = 'https://cdn.jsdelivr.net/gh/quran/quran.com-frontend-next@master/public/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2'
CACHE = (ROOT.parent / 'sakinah' / '.cache' / 'fonts-qcf')  # الكاش نفسه الذي يستخدمه build-www.mjs
OUT = ROOT / 'App' / 'Fonts'
AMIRI = ROOT.parent / 'sakinah' / 'assets' / 'fonts' / 'AmiriQuran.woff2'

# مصدر بديل لخطوط quran.com حين يضغط jsDelivr (قِيس: 503 متتالية في CI بلا كاش) — الملفات نفسها من GitHub مباشرة
FONT_BASE_ALT = FONT_BASE.replace('https://cdn.jsdelivr.net/gh/', 'https://raw.githubusercontent.com/').replace('@', '/', 1)

def fetch(rel: str, url: str | None = None) -> pathlib.Path:
    dst = CACHE / rel
    if dst.exists() and dst.stat().st_size > 1000: return dst
    dst.parent.mkdir(parents=True, exist_ok=True)
    urls = [url] if url else [FONT_BASE + rel, FONT_BASE_ALT + rel]
    for attempt in range(6):
        u = urls[attempt % len(urls)]
        r = subprocess.run(['curl', '-sS', '-f', '-L', '-m', '60', '--retry', '2', '--retry-delay', '2', '-o', str(dst), u], capture_output=True, text=True)
        if r.returncode == 0 and dst.exists() and dst.stat().st_size > 1000: return dst
        time.sleep(min(2 ** attempt, 20))
    raise SystemExit(f'تعذّر جلب {rel}: {r.stderr.strip()[-200:]}')

def ttf_z(src: pathlib.Path) -> bytes:
    """TTF مضغوط raw deflate بلا ترويسة zlib (COMPRESSION_ZLIB في Apple) مسبوقًا بحجمه الأصلي"""
    f = TTFont(str(src)); f.flavor = None
    buf = io.BytesIO(); f.save(buf); ttf = buf.getvalue()
    c = zlib.compressobj(9, zlib.DEFLATED, -15)
    return struct.pack('<I', len(ttf)) + c.compress(ttf) + c.flush()

def convert(src: pathlib.Path, name: str) -> int:
    blob = ttf_z(src)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f'{name}.ttf.z').write_bytes(blob)
    return len(blob)

# صفحات تبقى داخل تطبيق iOS ليُفتح المصحف بخطه قبل تنزيل الحزمة: الفاتحة وأول البقرة وجزء عمّ
BUNDLED_PAGES = [1, 2] + list(range(582, 605))
PACK_MAGIC, PACK_VERSION, PACK_PAGES = b'SKMP', 1, 604

def build_pack(dst: pathlib.Path) -> None:
    blobs = [ttf_z(fetch(f'hafs/v2/woff2/p{p}.woff2')) for p in range(1, PACK_PAGES + 1)]
    head = 8 + 8 * PACK_PAGES
    index, off = [], head
    for b in blobs:
        index.append(struct.pack('<II', off, len(b))); off += len(b)
    dst.parent.mkdir(parents=True, exist_ok=True)
    with open(dst, 'wb') as f:
        f.write(PACK_MAGIC + struct.pack('<HH', PACK_VERSION, PACK_PAGES))
        f.write(b''.join(index))
        for b in blobs: f.write(b)
    print(f'حزمة خطوط الصفحات: {PACK_PAGES} صفحة → {dst} ({off / 1e6:.1f} م.ب)')

ANDROID_OUT = ROOT.parent / 'sakinah-android' / 'app' / 'src' / 'main' / 'assets' / 'fonts'
# خطوط الصفحات الـ604 في حزمة أصول Play منفصلة (fast-follow) كي لا تُحتسب في حجم المتجر؛ الصغيرة تبقى في الأساس
ANDROID_PACK_OUT = ROOT.parent / 'sakinah-android' / 'mushaf_fonts' / 'src' / 'main' / 'assets' / 'fonts'

# ---- خطوط الواجهة (نظام التصميم): Readex Pro للواجهة والأرقام، Reem Kufi للعناوين، Amiri للقراءة — كلها برخصة OFL من مستودع Google Fonts
GF = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'
UI_VARIABLE = {
    # (ملف الخط المتغيّر، محاور ثابتة، [(اسم النمط، الوزن)])
    'ReadexPro': ('readexpro/ReadexPro%5BHEXP%2Cwght%5D.ttf', {'HEXP': 0}, [('Light', 300), ('Regular', 400), ('Medium', 500), ('SemiBold', 600), ('Bold', 700)]),
    'ReemKufi': ('reemkufi/ReemKufi%5Bwght%5D.ttf', {}, [('Regular', 400), ('SemiBold', 600), ('Bold', 700)]),
}
UI_STATIC = {'Amiri-Regular': 'amiri/Amiri-Regular.ttf', 'Amiri-Bold': 'amiri/Amiri-Bold.ttf'}
UI_OUT = OUT / 'ui'
ANDROID_UI_OUT = ANDROID_OUT / 'ui'

def build_ui_fonts(android: bool) -> int:
    """يولّد نسخًا ثابتة (static instances) من الخطوط المتغيّرة بأسماء PostScript على شكل Family-Style، غير مضغوطة (تُسجَّل عبر CoreText/AssetManager)"""
    from fontTools.varLib import instancer
    out = ANDROID_UI_OUT if android else UI_OUT
    out.mkdir(parents=True, exist_ok=True)
    total = 0
    for fam, (rel, fixed, styles) in UI_VARIABLE.items():
        src = fetch('ui/' + rel.split('/')[-1].replace('%5B', '[').replace('%5D', ']').replace('%2C', ','), GF + rel)
        for style, wght in styles:
            vf = TTFont(str(src))
            axes = dict(fixed); axes['wght'] = wght
            inst = instancer.instantiateVariableFont(vf, axes, inplace=True, updateFontNames=True)
            ps = f'{fam}-{style}'
            name = inst['name']
            # ثبّت الأسماء كي تكون متوقعة على كل المنصات: العائلة + النمط + PostScript
            for rec in name.names:
                if rec.nameID == 1: rec.string = fam if style in ('Regular', 'Bold') else f'{fam} {style}'
                elif rec.nameID == 2: rec.string = style if style in ('Regular', 'Bold') else 'Regular'
                elif rec.nameID == 4: rec.string = f'{fam} {style}'
                elif rec.nameID == 6: rec.string = ps
                elif rec.nameID == 16: rec.string = fam
                elif rec.nameID == 17: rec.string = style
            buf = io.BytesIO(); inst.save(buf); data = buf.getvalue()
            (out / f'{ps}.ttf').write_bytes(data); total += len(data)
    for ps, rel in UI_STATIC.items():
        src = fetch('ui/' + rel.split('/')[-1], GF + rel)
        data = src.read_bytes(); (out / f'{ps}.ttf').write_bytes(data); total += len(data)
    print(f'خطوط الواجهة: {len(list(out.glob("*.ttf")))} ملفًا → {out} ({total // 1024} ك.ب)')
    return total
def convert_raw(src: pathlib.Path, name: str, out: pathlib.Path = ANDROID_OUT) -> int:
    """TTF غير مضغوط لتطبيق Android (تُضغط داخل APK/AAB تلقائيًا)"""
    f = TTFont(str(src)); f.flavor = None
    buf = io.BytesIO(); f.save(buf); ttf = buf.getvalue()
    out.mkdir(parents=True, exist_ok=True); (out / f'{name}.ttf').write_bytes(ttf); return len(ttf)

def main():
    pages = range(1, 605)
    args = sys.argv[1:]
    if len(args) == 2 and args[0] == '--pack':
        build_pack(pathlib.Path(args[1])); return
    android = '--android' in args
    if android: args.remove('--android')
    ui_only = '--ui-only' in args
    if ui_only: args.remove('--ui-only')
    build_ui_fonts(android)
    if ui_only: return
    explicit = len(args) > 1 and args[0] == '--pages'
    if explicit:
        a, b = args[1].split('-'); pages = range(int(a), int(b) + 1)
    if android:
        total = 0
        for p in pages: total += convert_raw(fetch(f'hafs/v2/woff2/p{p}.woff2'), f'p{p}', ANDROID_PACK_OUT)
        # ما كان في app/assets من خطوط صفحات (قبل حزمة الأصول) يُزال كي لا يُضمَّن مرتين
        for old in ANDROID_OUT.glob('p[0-9]*.ttf'): old.unlink()
        total += convert_raw(fetch('surah-names/v1/sura_names.woff2'), 'sura_names')
        total += convert_raw(fetch('UthmanicHafs1Ver18.woff2', HAFS_URL), 'hafs')
        if AMIRI.exists(): total += convert_raw(AMIRI, 'AmiriQuran')
        print(f'خطوط Android: {len(list(pages))} صفحة → {ANDROID_PACK_OUT} (حزمة أصول)؛ أسماء السور + حفص + أميري قرآن → {ANDROID_OUT} ({total // 1024 // 1024} م.ب)')
        return
    total = 0
    ios_pages = list(pages) if explicit else BUNDLED_PAGES
    for p in ios_pages:
        total += convert(fetch(f'hafs/v2/woff2/p{p}.woff2'), f'p{p}')
    # صفحات خارج المجموعة المضمّنة من بناء سابق تُزال كي لا تكبّر التطبيق
    for old in OUT.glob('p[0-9]*.ttf.z'):
        if int(old.name[1:].split('.')[0]) not in ios_pages: old.unlink()
    pages = ios_pages
    total += convert(fetch('surah-names/v1/sura_names.woff2'), 'sura_names')
    total += convert(fetch('UthmanicHafs1Ver18.woff2', HAFS_URL), 'hafs')
    if AMIRI.exists(): total += convert(AMIRI, 'AmiriQuran')
    print(f'خطوط المصحف: {len(list(pages))} صفحة + أسماء السور + حفص + أميري قرآن → {OUT} ({total // 1024 // 1024} م.ب مضغوطة)')

if __name__ == '__main__': main()
