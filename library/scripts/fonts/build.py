#!/usr/bin/env python3
"""Rebuild public/fonts from the upstream packages. Run by hand when a font changes; the output is committed.

    python3 -I scripts/fonts/build.py            (needs: npm, and `pip install fonttools brotli`)

Three families, split by script (src/styles/fonts.css declares them, tests/unit/fonts.test.ts opens them):

  Zain        Arabic, plus digits and punctuation. Its own Latin is left out on purpose: Zain has no
              Ğ ğ Ş ş İ, so a Turkish word set in it would come out half in a fallback face.
  Outfit      every Latin letter. Cut from the variable font at the weights whose stems match Zain's,
              so a Latin word inside an Arabic line carries the same colour:
                  CSS 700 = wght 536 (stem .1226 em; Zain Bold .1225)
                  CSS 800 = wght 648 (stem .1464 em; Zain ExtraBold .1462)
              Cap height already agrees (Outfit .694 em, Zain .695 em), so no size-adjust is needed.
  Geist Mono  numbers that are read as data: sizes, durations, dates, file names. One cut, weight 500.

All three are SIL OFL 1.1 with no Reserved Font Name; each licence is copied beside the files.
"""
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = Path(__file__).resolve().parents[2] / 'public' / 'fonts'
PACKAGES = {
    'zain': '@fontsource/zain@5.3.0',
    'outfit': '@fontsource-variable/outfit@5.3.0',
    'geist-mono': '@fontsource/geist-mono@5.3.0',
}
# What Zain draws beside Arabic: space, digits and the punctuation of running text. Keep this list equal
# to the unicode-range of the "Zain" numerals faces in fonts.css.
ZAIN_NUMERALS = [0x20, 0x21, 0x22, 0x25, 0x27, 0x28, 0x29, *range(0x2B, 0x3C), 0x3F, 0x5B, 0x5D,
                 0xA0, 0xAB, 0xB7, 0xBB, 0xD7, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x2212]
OUTFIT_CUTS = {400: 400, 700: 536, 800: 648}  # CSS weight -> wght axis


def fetch(work: Path) -> dict[str, Path]:
    found = {}
    for name, spec in PACKAGES.items():
        dest = work / name
        dest.mkdir()
        tgz = subprocess.run(['npm', 'pack', spec, '--silent'], cwd=dest, check=True, capture_output=True, text=True).stdout.strip().splitlines()[-1]
        with tarfile.open(dest / tgz) as tar:
            tar.extractall(dest, filter='data')
        found[name] = dest / 'package'
    return found


def rename(font: TTFont, family: str, style: str, weight: int) -> None:
    """An instance keeps the variable font's default names («Outfit Thin»); say what the cut really is.

    Named the way static families are: Regular and Bold share the family name, any other weight carries its
    own («Outfit ExtraBold»), with the typographic family and style in IDs 16 and 17. Zain's files follow the
    same convention, and the browser reports these names — tests/e2e/components.spec.ts reads them to prove
    that heavy text is drawn by the heavy cut.
    """
    names = font['name']
    for record in list(names.names):
        if record.nameID in (16, 17, 25):
            names.removeNames(nameID=record.nameID)
    linked = style in ('Regular', 'Bold')
    legacy = ((1, family if linked else f'{family} {style}'), (2, style if linked else 'Regular'),
              (4, f'{family} {style}'), (6, f'{family}-{style}'.replace(' ', '')))
    for name_id, value in legacy:
        for record in [r for r in names.names if r.nameID == name_id]:
            names.setName(value, name_id, record.platformID, record.platEncID, record.langID)
    if not linked:
        names.setName(family, 16, 3, 1, 0x409)
        names.setName(style, 17, 3, 1, 0x409)
    font['OS/2'].usWeightClass = weight


def save(font: TTFont, name: str) -> None:
    font.flavor = 'woff2'
    font.save(OUT / name)
    print(f'  {name}  {(OUT / name).stat().st_size / 1024:.1f} kB')


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.woff2'):
        old.unlink()
    with tempfile.TemporaryDirectory() as tmp:
        pkg = fetch(Path(tmp))

        for weight in (400, 700, 800):
            shutil.copyfile(pkg['zain'] / 'files' / f'zain-arabic-{weight}-normal.woff2', OUT / f'Zain-Arabic-{weight}.woff2')
            print(f'  Zain-Arabic-{weight}.woff2  (as published)')

            font = TTFont(pkg['zain'] / 'files' / f'zain-latin-{weight}-normal.woff2')
            missing = [hex(cp) for cp in ZAIN_NUMERALS if cp not in font.getBestCmap()]
            if missing:
                sys.exit(f'Zain {weight} lacks {missing}')
            options = subset.Options(layout_features=['*'], name_IDs=['*'], notdef_outline=True)
            cutter = subset.Subsetter(options)
            cutter.populate(unicodes=ZAIN_NUMERALS)
            cutter.subset(font)
            save(font, f'Zain-Numerals-{weight}.woff2')

        for css_weight, wght in OUTFIT_CUTS.items():
            for part, label in (('latin', 'Latin'), ('latin-ext', 'LatinExt')):
                variable = TTFont(pkg['outfit'] / 'files' / f'outfit-{part}-wght-normal.woff2')
                cut = instancer.instantiateVariableFont(variable, {'wght': wght})
                rename(cut, 'Outfit', {400: 'Regular', 700: 'Bold', 800: 'ExtraBold'}[css_weight], css_weight)
                save(cut, f'Outfit-{label}-{css_weight}.woff2')

        for part, label in (('latin', 'Latin'), ('latin-ext', 'LatinExt')):
            shutil.copyfile(pkg['geist-mono'] / 'files' / f'geist-mono-{part}-500-normal.woff2', OUT / f'GeistMono-{label}-500.woff2')
            print(f'  GeistMono-{label}-500.woff2  (as published)')

        for name, licence in (('zain', 'OFL-Zain.txt'), ('outfit', 'OFL-Outfit.txt'), ('geist-mono', 'OFL-Geist-Mono.txt')):
            shutil.copyfile(pkg[name] / 'LICENSE', OUT / licence)


if __name__ == '__main__':
    main()
