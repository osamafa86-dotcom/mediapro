#!/usr/bin/env python3
"""يتحقّق أن كل رمز في تخطيط المصحف موجود فعلًا في خطّ صفحته ويُرسم شيئًا.

بيانات المصحف حسّاسة، وخطوط QCF لكل صفحة خطّ مستقلّ تعني نفس نقاط الترميز رسمًا مختلفًا.
فرمزٌ غائب عن خطّ صفحته يظهر للقارئ فراغًا مكان كلمة — أي نقصًا في المصحف — بلا أي خطأ
في البيانات نفسها. هذا الفحص يمنع ذلك في كل بناء.

خطوط QCF v2 (منذ ٢٨/٩) ترسم بعض العلامات رموزًا بلا تقدّم أفقي فوق الكلمة السابقة في الخلية نفسها،
والخلية قد تجمع الكلمة ورمزًا بعدها بمسافة؛ فالمعيار: كل رمز موجود في خطّ صفحته ويرسم حبرًا،
والرمز الأول في الخلية (الكلمة نفسها) له عرض. المسافة لا تُطلب من خطّ الصفحة.

الاستعمال: python3 tools/verify-mushaf-fonts.py
"""
import json
import os
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LAYOUT = os.path.join(ROOT, "data", "mushaf-layout.json")
FONTS = os.path.join(ROOT, "www", "assets", "fonts", "quran", "hafs", "v2", "woff2")


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
        glyf = font["glyf"] if "glyf" in font else None
        for line in page:
            if line[0] != 0:
                continue
            for cell in line[1].split("|"):
                for position, char in enumerate(cell):
                    if char == " ":
                        continue
                    checked += 1
                    name = cmap.get(ord(char))
                    if name is None:
                        missing_glyph.append((number, hex(ord(char))))
                        continue
                    if glyf is not None:
                        inked = glyf[name].numberOfContours != 0  # المركّب -1 وله حبر
                    else:
                        pen = BoundsPen(glyphs)
                        glyphs[name].draw(pen)
                        inked = pen.bounds is not None
                    if not inked or (position == 0 and getattr(glyphs[name], "width", 1) == 0):
                        blank_glyph.append((number, hex(ord(char)), name))
        font.close()

    print("صفحات: %d — رموز فُحصت: %d" % (len(layout["pages"]), checked))
    ok = True
    for label, bad in (
        ("خطوط صفحات مفقودة", missing_font),
        ("رموز غائبة عن خطّ صفحتها", missing_glyph),
        ("رموز لا ترسم شيئًا أو كلمة بلا عرض (تظهر فراغًا)", blank_glyph),
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
