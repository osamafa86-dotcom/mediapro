package org.emdatra.sakinah.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * سلامة تخطيط المصحف في النسخة الأصلية: ما تعرضه الصفحة هو نصّ الآية نفسه، كلمةً كلمة، في كل صفحة.
 * بيانات حسّاسة، فلا يكفي فحصها في محرّك الويب — هذا الفحص يجري على الشيفرة التي تُرسم على الجهاز.
 */
class MushafLayoutIntegrityTest {
  /** الآية الوحيدة التي يختلف فيها تقسيم كلمات المجمع عن تقسيم Tanzil: ٣٧:١٣٠ «سلام على إل ياسين» */
  private val mappedAyah = 3918

  @Test fun everyPageRendersItsAyahsWordForWord() {
    val text = QuranText.shared
    val layout = MushafLayout.shared
    val cover = HashMap<Int, ArrayList<Int>>()
    val marks = HashMap<Int, Int>()
    var wordLines = 0

    for (p in 1..MushafLayout.TOTAL_PAGES) {
      val lines = layout.lines(p)
      assertTrue(lines.isNotEmpty(), "الصفحة $p فارغة")
      for (line in lines) {
        val ws = line.wordList
        if (ws.isEmpty()) continue
        wordLines++
        for (w in ws) {
          assertTrue(w.glyph.isNotEmpty(), "ص$p: كلمة بلا رمز في الآية ${w.n}")
          if (w.end) marks[w.n] = (marks[w.n] ?: 0) + 1
          else if (w.k >= 0) cover.getOrPut(w.n) { ArrayList() }.add(w.k)
        }
      }
    }

    assertTrue(wordLines > 8000, "أسطر الكلمات $wordLines")
    assertEquals(6236, cover.size, "آيات ظهرت كلماتها")

    for (n in 1..6236) {
      assertEquals(1, marks[n], "الآية $n: علامات نهاية ${marks[n] ?: 0}")
      val ayah = text.ayah(n) ?: fail("الآية $n غير موجودة")
      val spoken = QuranNormalize.tokenize(ayah.text).count { it.spoken }
      val got = cover[n] ?: emptyList<Int>()
      val expected = if (n == mappedAyah) 3 else spoken
      assertEquals(expected, got.size, "الآية $n: ${got.size} كلمة في التخطيط مقابل $expected")
      // متسلسلة ٠..ن‑١ بلا فجوة ولا تكرار — فلا كلمة تسقط ولا تتكرّر ولا تخرج عن ترتيبها
      for ((i, k) in got.withIndex()) if (k != i) fail("الآية $n: تسلسل الكلمات انكسر عند $i (وجد $k)")
    }
  }

  /** ترتيب الآيات المعروضة في كل صفحة هو ترتيبها في النصّ — لا صفحة تعرض آية صفحة أخرى */
  @Test fun pageAyahOrderMatchesText() {
    for (p in 1..MushafLayout.TOTAL_PAGES) {
      assertEquals(QuranText.shared.pageAyahs(p).map { it.n }, MushafLayout.shared.ayahs(p), "الصفحة $p")
    }
  }
}
