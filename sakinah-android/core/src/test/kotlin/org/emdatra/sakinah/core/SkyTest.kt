package org.emdatra.sakinah.core

import java.time.Instant
import java.time.ZoneId
import kotlin.test.*

/** محرّك السماء: الأطوار من المواقيت، نوافذ الانتقال، طبقات الطقس، والتفضيلات — الأرقام نفسها في Sky.swift */
class SkyTest {
  private val zone = ZoneId.of("Europe/Istanbul")
  private fun at(h: Int, m: Int, day: Int = 18) = Instant.parse("2026-09-${day.toString().padStart(2, '0')}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00+03:00")
  // مواقيت إسطنبول ١٨ سبتمبر (تقريبية) — عشاء الأمس وفجر الغد للّيل
  private val inputs = SkyInputs(fajr = at(5, 14), sunrise = at(6, 40), dhuhr = at(13, 3), asr = at(16, 30), maghrib = at(19, 15), isha = at(20, 36),
    prevIsha = at(20, 38, 17), nextFajr = at(5, 15, 19), zone = zone)

  private fun phaseAt(h: Int, m: Int) = SkyEngine.phase(at(h, m), inputs)

  @Test fun phasesFollowThePrayerDay() {
    assertEquals(SkyPhase.NIGHT, phaseAt(1, 0).phase)
    // ثلث الليل الأخير: من ٢٠:٣٨ أمس إلى ٥:١٤ → مدة ٨:٣٦ → ثلثاها ٥:٤٤ → السَّحَر يبدأ ٢:٢٢
    assertEquals(SkyPhase.SAHAR, phaseAt(3, 0).phase)
    assertEquals(SkyPhase.FAJR, phaseAt(5, 30).phase)
    assertEquals(SkyPhase.SUNRISE, phaseAt(7, 0).phase)
    assertEquals(SkyPhase.DUHA, phaseAt(9, 0).phase)
    assertEquals(SkyPhase.DHUHR, phaseAt(14, 0).phase)
    assertEquals(SkyPhase.ASR, phaseAt(17, 30).phase)
    assertEquals(SkyPhase.GHURUB, phaseAt(18, 50).phase)
    assertEquals(SkyPhase.SHAFAQ, phaseAt(20, 0).phase)
    assertEquals(SkyPhase.NIGHT, phaseAt(23, 0).phase)
    assertEquals(SkyPhase.SAHAR, SkyEngine.phase(at(3, 30, 19), inputs).phase)
  }

  @Test fun blendWindowIsTwentyMinutesAroundEachBoundary() {
    val r1 = phaseAt(19, 5)  // ١٠ دقائق قبل المغرب: غروب → شفق عند t=0
    assertEquals(SkyPhase.GHURUB, r1.phase); assertEquals(SkyPhase.SHAFAQ, r1.blendTo); assertEquals(0.0, r1.t, 1e-9)
    val r2 = phaseAt(19, 15)  // عند الحدّ نفسه: منتصف المزج
    assertEquals(SkyPhase.GHURUB, r2.phase); assertEquals(SkyPhase.SHAFAQ, r2.blendTo); assertEquals(0.5, r2.t, 1e-9)
    assertEquals(SkyPhase.SHAFAQ, SkyEngine.state(at(19, 15), inputs, SkyPrefs(), null).dominant)
    val r3 = phaseAt(19, 24)  // ٩ دقائق بعده: ما زال يمزج قرب النهاية
    assertEquals(SkyPhase.SHAFAQ, r3.blendTo); assertTrue(r3.t > 0.9 && r3.t < 1.0)
    val r4 = phaseAt(19, 40)
    assertEquals(SkyPhase.SHAFAQ, r4.phase); assertNull(r4.blendTo)
  }

  @Test fun blendedPaletteInterpolatesAndSwitchesInkAtMidpoint() {
    val a = SkyPalette.of(SkyPhase.ASR); val b = SkyPalette.of(SkyPhase.GHURUB)
    val mid = a.blended(b, 0.5)
    assertEquals(4, mid.stops.size)
    assertEquals((a.stops[0].r + b.stops[0].r) / 2, mid.stops[0].r, 1e-9)
    assertEquals(SkyInk.INK, a.blended(b, 0.49).ink); assertEquals(SkyInk.PAPER, mid.ink)
    assertEquals(a, a.blended(b, 0.0)); assertEquals(b.stops, a.blended(b, 1.0).stops)
  }

  @Test fun palettesHaveFourStopsAndFigmaHexes() {
    for (p in SkyPhase.entries) assertEquals(4, SkyPalette.of(p).stops.size, p.name)
    assertEquals(0x04181A, SkyPalette.of(SkyPhase.SHAFAQ).stops[0].hex)
    assertEquals(0x0E5C55, SkyPalette.of(SkyPhase.SHAFAQ).stops[3].hex)
    assertEquals(0xD98B58, SkyPalette.of(SkyPhase.SAHAR).stops[3].hex)
    assertEquals(SkyInk.INK, SkyPalette.of(SkyPhase.DUHA).ink); assertEquals(SkyInk.PAPER, SkyPalette.of(SkyPhase.DHUHR).ink)
  }

  @Test fun weatherMappingFromWmoCodes() {
    assertEquals(SkyWeather.CLEAR, SkyWeather.from(0, 10))
    assertEquals(SkyWeather.PARTLY_CLOUDY, SkyWeather.from(2, 40))
    assertEquals(SkyWeather.OVERCAST, SkyWeather.from(2, 90))
    assertEquals(SkyWeather.OVERCAST, SkyWeather.from(3, 100)); assertEquals(SkyWeather.OVERCAST, SkyWeather.from(45, 0))
    assertEquals(SkyWeather.RAIN, SkyWeather.from(61, 100)); assertEquals(SkyWeather.RAIN, SkyWeather.from(95, 100)); assertEquals(SkyWeather.RAIN, SkyWeather.from(80, 60))
    assertEquals(SkyWeather.SNOW, SkyWeather.from(73, 100)); assertEquals(SkyWeather.SNOW, SkyWeather.from(86, 100))
    assertEquals(SkyWeather.DUST, SkyWeather.from(0, 10, dust = 220.0))
  }

  @Test fun weatherLayersDarkenOrTintButNeverChangeClearSkies() {
    val noon = SkyPalette.of(SkyPhase.DHUHR)
    assertEquals(noon, noon.weathered(SkyWeather.CLEAR)); assertEquals(noon, noon.weathered(SkyWeather.PARTLY_CLOUDY))
    assertTrue(noon.weathered(SkyWeather.OVERCAST).stops[0].luminance < noon.stops[0].luminance)
    assertTrue(noon.weathered(SkyWeather.RAIN).stops[0].luminance < noon.weathered(SkyWeather.OVERCAST).stops[0].luminance)
    assertEquals(SkyInk.PAPER, SkyPalette.of(SkyPhase.DUHA).weathered(SkyWeather.RAIN).ink)
    assertTrue(noon.weathered(SkyWeather.SNOW).stops[3].luminance > noon.stops[3].luminance)
    val dusty = noon.weathered(SkyWeather.DUST).stops[1]; assertTrue(dusty.r > noon.stops[1].r)  // ميل رملي دافئ
  }

  @Test fun prefsOverrideTheClock() {
    val fixed = SkyEngine.state(at(14, 0), inputs, SkyPrefs(mode = SkyMode.FIXED, fixedPhase = SkyPhase.NIGHT), SkyWeather.RAIN)
    assertEquals(SkyPhase.NIGHT, fixed.phase); assertEquals(SkyWeather.CLEAR, fixed.weather); assertEquals(SkyPalette.of(SkyPhase.NIGHT), fixed.palette)
    val custom = SkyEngine.state(at(14, 0), inputs, SkyPrefs(mode = SkyMode.CUSTOM, accent = SkyAccent.ROSE), null)
    assertEquals(SkyAccent.ROSE.hex, custom.palette.stops[2].hex); assertEquals(SkyInk.PAPER, custom.palette.ink)
    val autoNoWeather = SkyEngine.state(at(14, 0), inputs, SkyPrefs(weather = false), SkyWeather.RAIN)
    assertEquals(SkyWeather.CLEAR, autoNoWeather.weather)
    val autoWeather = SkyEngine.state(at(14, 0), inputs, SkyPrefs(weather = true), SkyWeather.RAIN)
    assertEquals(SkyWeather.RAIN, autoWeather.weather); assertEquals(SkyPhase.DHUHR, autoWeather.phase)
  }

  @Test fun polarFallbackUsesTheClock() {
    val polar = SkyInputs(null, null, null, null, null, null, zone = zone)
    assertEquals(SkyPhase.DUHA, SkyEngine.phase(at(9, 0), polar).phase)
    assertEquals(SkyPhase.NIGHT, SkyEngine.phase(at(23, 30), polar).phase)
  }

  @Test fun rgbRoundTripsHex() { assertEquals(0x9A4E5E, SkyRGB.hex(0x9A4E5E).hex); assertEquals(0xFFFFFF, SkyRGB(1.0, 1.0, 1.0).hex) }
}
