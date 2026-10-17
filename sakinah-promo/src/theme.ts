import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// ألوان سكينة كما في DesignSystem.swift (الوضع الفاتح + تدرّج «الليل»)
export const C = {
  nightTop: "#0E5C55",
  nightBottom: "#062421",
  brandDeep: "#0B3733",
  brand: "#0E5C55",
  brandLight: "#3FB5A6",
  mint: "#9FD1CA",
  gold: "#C69C3E",
  goldLight: "#E2C77A",
  goldDot: "#E2B04A",
  paper: "#FBF9F4",
  canvas: "#F6F4EE",
  ink: "#16211F",
  inkSoft: "#5D6B68",
};

export const F = {
  display: "'Reem Kufi', 'Readex Pro', sans-serif",
  ui: "'Readex Pro', sans-serif",
  quran: "'Uthmanic Hafs', 'Amiri Quran', serif",
  amiri: "'Amiri', serif",
};

const fonts: Array<[string, string, string]> = [
  ["Reem Kufi", "fonts/ReemKufi-arabic.woff2", "400 700"],
  ["Reem Kufi", "fonts/ReemKufi-latin.woff2", "400 700"],
  ["Readex Pro", "fonts/ReadexPro-arabic.woff2", "160 700"],
  ["Readex Pro", "fonts/ReadexPro-latin.woff2", "160 700"],
  ["Uthmanic Hafs", "fonts/UthmanicHafs.woff2", "400"],
  ["Amiri Quran", "fonts/AmiriQuran.woff2", "400"],
  ["Amiri", "fonts/Amiri-400-arabic.woff2", "400"],
  ["Amiri", "fonts/Amiri-700-arabic.woff2", "700"],
];

for (const [family, file, weight] of fonts) {
  loadFont({ family, url: staticFile(file), weight, display: "block" });
}

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
