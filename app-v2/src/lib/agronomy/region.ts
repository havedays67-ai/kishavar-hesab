import type { ClimateZone } from "../ai/agronomy-planner";

/** حدس محافظه‌کارانهٔ اقلیم از استان/شهر؛ کاربر همیشه می‌تواند عوضش کند. */
export function guessClimate(value: string): ClimateZone {
  const text = String(value ?? "");
  if (/(گیلان|مازندران|گلستان)/.test(text)) return "humid";
  if (/(خوزستان|بوشهر|هرمزگان|سیستان|بلوچستان|جاسک|چابهار)/.test(text)) return "warm";
  if (/(یزد|کرمان|اصفهان|سمنان|قم|مرکزی|خراسان جنوبی)/.test(text)) return "dry";
  if (/(آذربایجان|اردبیل|کردستان|همدان|زنجان|قزوین|البرز)/.test(text)) return "cold";
  return "temperate";
}
