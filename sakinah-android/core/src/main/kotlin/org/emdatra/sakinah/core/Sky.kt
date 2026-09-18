package org.emdatra.sakinah.core

import java.time.Instant
import java.time.ZoneId
import kotlin.math.pow

// سماء الرئيسية (Figma «٧ · نظام السماء والطقس») — مرآة حرفية لـ Sky.swift في SakinahCore:
// تسعة أطوار من مواقيت الصلاة، انتقال ٢٠ دقيقة حول كل حدّ، والطقس طبقة تعدّل التدرّج. الأرقام أرقام اللوحة.

enum class SkyPhase(val id: String, val nameAr: String, val ruleAr: String) {
  NIGHT("night", "الليل", "بعد العشاء → ثلث الليل الأخير"),
  SAHAR("sahar", "السَّحَر", "ثلث الليل الأخير → الفجر"),
  FAJR("fajr", "الفجر", "الفجر → الشروق"),
  SUNRISE("sunrise", "الشروق", "الشروق → بعده بساعة"),
  DUHA("duha", "الضحى", "بعد الشروق بساعة → الظهر"),
  DHUHR("dhuhr", "الظهر", "الظهر → العصر"),
  ASR("asr", "العصر", "العصر → قبل المغرب بأربعين دقيقة"),
  GHURUB("ghurub", "الغروب", "آخر أربعين دقيقة قبل المغرب"),
  SHAFAQ("shafaq", "الشفق", "المغرب → العشاء");
  companion object { fun of(s: String?) = entries.firstOrNull { it.id == s } ?: SHAFAQ }
}

enum class SkyDisc { NONE, MOON, SUN_LOW, SUN, SUN_HIGH }
enum class SkyInk { PAPER, INK }

data class SkyRGB(val r: Double, val g: Double, val b: Double) {
  companion object {
    fun hex(h: Long) = SkyRGB(((h shr 16) and 0xFF) / 255.0, ((h shr 8) and 0xFF) / 255.0, (h and 0xFF) / 255.0)
  }
  val hex: Long get() {
    fun c(v: Double): Long = Math.round(v.coerceIn(0.0, 1.0) * 255)
    return (c(r) shl 16) or (c(g) shl 8) or c(b)
  }
  fun mix(o: SkyRGB, t: Double): SkyRGB {
    val k = t.coerceIn(0.0, 1.0)
    if (k <= 0.0) return this
    if (k >= 1.0) return o
    return SkyRGB(r + (o.r - r) * k, g + (o.g - g) * k, b + (o.b - b) * k)
  }
  fun desaturate(f: Double): SkyRGB { val l = 0.2126 * r + 0.7152 * g + 0.0722 * b; return mix(SkyRGB(l, l, l), f) }
  fun darken(f: Double) = mix(SkyRGB(0.0, 0.0, 0.0), f)
  fun lighten(f: Double) = mix(SkyRGB(1.0, 1.0, 1.0), f)
  val luminance: Double get() {
    fun lin(c: Double): Double = if (c <= 0.03928) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  }
}

data class SkyPalette(val stops: List<SkyRGB>, val glow: SkyRGB, val glowOpacity: Double, val disc: SkyDisc, val ink: SkyInk, val accent: SkyRGB) {
  companion object {
    fun four(s: List<SkyRGB>): List<SkyRGB> = when {
      s.size >= 4 -> s.take(4)
      s.size == 3 -> listOf(s[0], s[0].mix(s[1], 0.5), s[1], s[2])
      s.size == 2 -> listOf(s[0], s[0].mix(s[1], 1.0 / 3), s[0].mix(s[1], 2.0 / 3), s[1])
      else -> { val c = s.firstOrNull() ?: SkyRGB(0.0, 0.0, 0.0); listOf(c, c, c, c) }
    }
    private fun p(hex: List<Long>, glow: Long, op: Double, disc: SkyDisc, ink: SkyInk, accent: Long) =
      SkyPalette(four(hex.map { SkyRGB.hex(it) }), SkyRGB.hex(glow), op, disc, ink, SkyRGB.hex(accent))

    fun of(phase: SkyPhase): SkyPalette = when (phase) {
      SkyPhase.NIGHT -> p(listOf(0x020B14, 0x0A1E2E, 0x10303C), 0xF3DFA0, 0.25, SkyDisc.MOON, SkyInk.PAPER, 0xF3DFA0)
      SkyPhase.SAHAR -> p(listOf(0x141A3A, 0x3B2A57, 0x9A4E5E, 0xD98B58), 0xFFC98A, 0.45, SkyDisc.NONE, SkyInk.PAPER, 0xFFC98A)
      SkyPhase.FAJR -> p(listOf(0x2A3E7A, 0x6E5B9E, 0xE39A7B, 0xF6C689), 0xFFE0B0, 0.5, SkyDisc.SUN_LOW, SkyInk.PAPER, 0xFFE0B0)
      SkyPhase.SUNRISE -> p(listOf(0x6FA8DC, 0xF7C59F, 0xF2A65A), 0xFFD27A, 0.5, SkyDisc.SUN_LOW, SkyInk.INK, 0xFFD27A)
      SkyPhase.DUHA -> p(listOf(0x4F9BE0, 0x8CC7F0, 0xDDEFFB), 0xFFFFFF, 0.5, SkyDisc.SUN, SkyInk.INK, 0xFFFFFF)
      SkyPhase.DHUHR -> p(listOf(0x1F63B5, 0x4C9BE0, 0xA9D6F5), 0xFFF6D6, 0.5, SkyDisc.SUN_HIGH, SkyInk.PAPER, 0xFFF6D6)
      SkyPhase.ASR -> p(listOf(0x3A86C8, 0x9CC7E6, 0xF3D9A6), 0xFFE7A8, 0.5, SkyDisc.SUN, SkyInk.INK, 0xFFE7A8)
      SkyPhase.GHURUB -> p(listOf(0x3E2C63, 0xB4506A, 0xF08A4B, 0xFFC46B), 0xFFB067, 0.5, SkyDisc.SUN_LOW, SkyInk.PAPER, 0xFFB067)
      SkyPhase.SHAFAQ -> p(listOf(0x04181A, 0x083430, 0x0E5C55), 0xD9A25B, 0.35, SkyDisc.NONE, SkyInk.PAPER, 0xD9A25B)
    }

    fun custom(accent: SkyAccent): SkyPalette {
      val a = SkyRGB.hex(accent.hex)
      return SkyPalette(listOf(SkyRGB.hex(0x0A0F14), a.darken(0.55), a, a.lighten(0.10)), a.lighten(0.4), 0.35, SkyDisc.NONE, SkyInk.PAPER, a.lighten(0.45))
    }
  }

  fun blended(o: SkyPalette, t: Double): SkyPalette {
    val k = t.coerceIn(0.0, 1.0)
    return copy(stops = (0 until 4).map { stops[it].mix(o.stops[it], k) }, glow = glow.mix(o.glow, k), glowOpacity = glowOpacity + (o.glowOpacity - glowOpacity) * k,
      accent = accent.mix(o.accent, k), disc = if (k >= 0.5) o.disc else disc, ink = if (k >= 0.5) o.ink else ink)
  }

  fun weathered(w: SkyWeather): SkyPalette {
    var out = when (w) {
      SkyWeather.CLEAR, SkyWeather.PARTLY_CLOUDY -> return this
      SkyWeather.OVERCAST -> copy(stops = stops.map { it.desaturate(0.25).darken(0.15) }, glowOpacity = glowOpacity * 0.3, ink = SkyInk.PAPER)
      SkyWeather.RAIN -> copy(stops = stops.map { it.desaturate(0.35).darken(0.30) }, glowOpacity = glowOpacity * 0.15, ink = SkyInk.PAPER)
      SkyWeather.DUST -> copy(stops = stops.map { it.mix(SkyRGB.hex(0xD6B48A), 0.45) }, glowOpacity = glowOpacity * 0.5)
      SkyWeather.SNOW -> copy(stops = stops.map { it.desaturate(0.3).lighten(0.25) }, glowOpacity = glowOpacity * 0.2)
    }
    if (w == SkyWeather.DUST || w == SkyWeather.SNOW) out = out.copy(ink = if (out.stops[1].luminance > 0.3) SkyInk.INK else SkyInk.PAPER)
    return out
  }
}

enum class SkyWeather(val id: String, val nameAr: String) {
  CLEAR("clear", "صافٍ"), PARTLY_CLOUDY("partlyCloudy", "غيوم متفرّقة"), OVERCAST("overcast", "غائم"), RAIN("rain", "مطر"), DUST("dust", "غبار"), SNOW("snow", "ثلج");
  companion object {
    fun of(s: String?) = entries.firstOrNull { it.id == s }
    /** من رمز WMO (Open-Meteo) والغطاء السحابي ٪ والغبار µg/m³ (اختياري) */
    fun from(wmo: Int, cloudCover: Int, dust: Double? = null): SkyWeather {
      if (dust != null && dust >= 150) return DUST
      return when (wmo) {
        in 71..77, 85, 86 -> SNOW
        in 51..67, in 80..82, in 95..99 -> RAIN
        45, 48, 3 -> OVERCAST
        1, 2 -> if (cloudCover >= 75) OVERCAST else PARTLY_CLOUDY
        else -> if (cloudCover >= 75) OVERCAST else if (cloudCover >= 30) PARTLY_CLOUDY else CLEAR
      }
    }
  }
}

enum class SkyMode(val id: String, val nameAr: String) { AUTO("auto", "تلقائي"), FIXED("fixed", "ثابت"), CUSTOM("custom", "مخصّص");
  companion object { fun of(s: String?) = entries.firstOrNull { it.id == s } ?: AUTO } }
enum class SkyAccent(val id: String, val nameAr: String, val hex: Long) {
  EMERALD("emerald", "زمرّد", 0x0E5C55), SAPPHIRE("sapphire", "ياقوت", 0x1F4FB5), VIOLET("violet", "بنفسج", 0x5B3A8E), ROSE("rose", "ورد", 0xA84A68),
  COPPER("copper", "نحاس", 0xB5652E), OLIVE("olive", "زيتون", 0x4E6B2E), GRAPHITE("graphite", "رمادي", 0x3C4A47), GOLD("gold", "ذهب", 0xC69C3E);
  companion object { fun of(s: String?) = entries.firstOrNull { it.id == s } ?: EMERALD }
}
data class SkyPrefs(val mode: SkyMode = SkyMode.AUTO, val fixedPhase: SkyPhase = SkyPhase.SHAFAQ, val accent: SkyAccent = SkyAccent.EMERALD, val weather: Boolean = false, val reduceMotion: Boolean = false)

data class SkyInputs(val fajr: Instant?, val sunrise: Instant?, val dhuhr: Instant?, val asr: Instant?, val maghrib: Instant?, val isha: Instant?,
                     val prevIsha: Instant? = null, val nextFajr: Instant? = null, val zone: ZoneId = ZoneId.systemDefault()) {
  companion object {
    fun of(t: PrayerTimes.DayTimeline, zone: ZoneId) = SkyInputs(t.times.fajr, t.times.sunrise, t.times.dhuhr, t.times.asr, t.times.maghrib, t.times.isha,
      t.yesterdayIsha, if (t.next.isTomorrow) t.next.time else null, zone)
  }
}

data class SkyState(val phase: SkyPhase, val blendTo: SkyPhase?, val t: Double, val weather: SkyWeather, val palette: SkyPalette) {
  val dominant: SkyPhase get() = if (blendTo != null && t >= 0.5) blendTo else phase
}

data class SkyResolvedPhase(val phase: SkyPhase, val blendTo: SkyPhase?, val t: Double)

object SkyEngine {
  const val BLEND_WINDOW_SECONDS = 20 * 60L

  fun schedule(i: SkyInputs): List<Pair<SkyPhase, Instant>>? {
    val fajr = i.fajr ?: return null; val sunrise = i.sunrise ?: return null; val dhuhr = i.dhuhr ?: return null
    val asr = i.asr ?: return null; val maghrib = i.maghrib ?: return null; val isha = i.isha ?: return null
    val prevIsha = i.prevIsha ?: fajr.minusSeconds(8 * 3600)
    val nextFajr = i.nextFajr ?: fajr.plusSeconds(24 * 3600)
    val saharToday = prevIsha.plusSeconds((fajr.epochSecond - prevIsha.epochSecond) * 2 / 3)
    val saharTomorrow = isha.plusSeconds((nextFajr.epochSecond - isha.epochSecond) * 2 / 3)
    val s = listOf(SkyPhase.NIGHT to prevIsha, SkyPhase.SAHAR to saharToday, SkyPhase.FAJR to fajr, SkyPhase.SUNRISE to sunrise, SkyPhase.DUHA to sunrise.plusSeconds(3600),
      SkyPhase.DHUHR to dhuhr, SkyPhase.ASR to asr, SkyPhase.GHURUB to maghrib.minusSeconds(40 * 60), SkyPhase.SHAFAQ to maghrib, SkyPhase.NIGHT to isha,
      SkyPhase.SAHAR to saharTomorrow, SkyPhase.FAJR to nextFajr)
    val out = ArrayList<Pair<SkyPhase, Instant>>()
    for (e in s) { val last = out.lastOrNull(); if (last != null && !e.second.isAfter(last.second)) continue; out.add(e) }
    return out
  }

  fun fallbackPhase(hour: Int): SkyPhase = when (hour) {
    in 0..2 -> SkyPhase.NIGHT; in 3..4 -> SkyPhase.SAHAR; 5 -> SkyPhase.FAJR; 6 -> SkyPhase.SUNRISE; in 7..11 -> SkyPhase.DUHA
    in 12..14 -> SkyPhase.DHUHR; in 15..17 -> SkyPhase.ASR; 18 -> SkyPhase.GHURUB; in 19..20 -> SkyPhase.SHAFAQ; else -> SkyPhase.NIGHT
  }

  fun phase(now: Instant, i: SkyInputs): SkyResolvedPhase {
    val sch = schedule(i)
    if (sch == null || sch.isEmpty()) return SkyResolvedPhase(fallbackPhase(now.atZone(i.zone).hour), null, 0.0)
    if (now.isBefore(sch.first().second)) return SkyResolvedPhase(SkyPhase.NIGHT, null, 0.0)
    var k = 0
    for ((idx, seg) in sch.withIndex()) if (!seg.second.isAfter(now)) k = idx
    val half = BLEND_WINDOW_SECONDS / 2.0
    val cur = sch[k].first
    val sinceStart = (now.epochSecond - sch[k].second.epochSecond).toDouble()
    if (k > 0 && sinceStart < half) return SkyResolvedPhase(sch[k - 1].first, cur, (sinceStart + half) / BLEND_WINDOW_SECONDS)
    if (k + 1 < sch.size) {
      val untilNext = (sch[k + 1].second.epochSecond - now.epochSecond).toDouble()
      if (untilNext <= half) return SkyResolvedPhase(cur, sch[k + 1].first, (-untilNext + half) / BLEND_WINDOW_SECONDS)
    }
    return SkyResolvedPhase(cur, null, 0.0)
  }

  fun state(now: Instant, inputs: SkyInputs?, prefs: SkyPrefs, weather: SkyWeather?): SkyState {
    val w = if (prefs.mode == SkyMode.AUTO && prefs.weather) (weather ?: SkyWeather.CLEAR) else SkyWeather.CLEAR
    return when (prefs.mode) {
      SkyMode.CUSTOM -> SkyState(SkyPhase.SHAFAQ, null, 0.0, SkyWeather.CLEAR, SkyPalette.custom(prefs.accent))
      SkyMode.FIXED -> SkyState(prefs.fixedPhase, null, 0.0, SkyWeather.CLEAR, SkyPalette.of(prefs.fixedPhase))
      SkyMode.AUTO -> {
        if (inputs == null) return SkyState(SkyPhase.SHAFAQ, null, 0.0, w, SkyPalette.of(SkyPhase.SHAFAQ).weathered(w))
        val r = phase(now, inputs)
        var pal = SkyPalette.of(r.phase)
        r.blendTo?.let { pal = pal.blended(SkyPalette.of(it), r.t) }
        SkyState(r.phase, r.blendTo, r.t, w, pal.weathered(w))
      }
    }
  }
}
