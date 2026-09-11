#!/usr/bin/env python3
"""يتحقّق أن كل رمز في تخطيط المصحف موجود فعلًا في خطّ صفحته ويُرسم شيئًا.

بيانات المصحف حسّاسة، وخطوط QCF لكل صفحة خطّ مستقلّ تعني نفس نقاط الترميز رسمًا مختلفًا.
فرمزٌ غائب عن خطّ صفحته يظهر للقارئ فراغًا مكان كلمة — أي نقصًا في المصحف — بلا أي خطأ
في البيانات نفسها. هذا الفحص يمنع ذلك في كل بناء.

الاستعمال: python3 tools/verify-mushaf-fonts.py
"""
import json
import os
import sys

from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LAYOUT = os.path.join(ROOT, "data", "mushaf-layout.json")
FONTS = os.path.join(ROOT, "www", "assets", "fonts", "quran", "hafs", "v1", "woff2")


def main() -> int:
    with open(LAYOUT, encoding="utf-8") as fh:
        layout = json.load(fh)

    missing_font, missing_glyph, blank_glyph = [], [], []
    checked = 0

    for index, page in enumerate(layout["pages"]):
        number = index + 1
        path = os.path.join(FONTS, "p%d.woff2" % number)
        if not os.path.exists(path):
            missing_font.append(number)
            continue
        font = TTFont(path, lazy=True)
        cmap = font.getBestCmap()
        glyphs = font.getGlyphSet()
        for line in page:
            if line[0] != 0:
                continue
            for cell in line[1].split("|"):
                for char in cell:
                    checked += 1
                    name = cmap.get(ord(char))
                    if name is None:
                        missing_glyph.append((number, hex(ord(char))))
                    elif getattr(glyphs[name], "width", 1) == 0:
                        blank_glyph.append((number, hex(ord(char)), name))
        font.close()

    print("صفحات: %d — رموز فُحصت: %d" % (len(layout["pages"]), checked))
    ok = True
    for label, bad in (
        ("خطوط صفحات مفقودة", missing_font),
        ("رموز غائبة عن خطّ صفحتها", missing_glyph),
        ("رموز بعرض صفر (تظهر فراغًا)", blank_glyph),
    ):
        if bad:
            ok = False
            print("✗ %s: %d" % (label, len(bad)))
            for item in bad[:20]:
                print("   ", item)
    if not ok:
        return 1
    print("✓ كل رمز موجود في خطّ صفحته ويُرسم شيئًا")
    return 0


if __name__ == "__main__":
    sys.exit(main())
