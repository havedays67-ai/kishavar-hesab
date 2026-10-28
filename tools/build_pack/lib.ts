/**
 * ابزارهای مشترک ساخت بستهٔ پاسخ و ارزیابی
 * ------------------------------------------------------------
 * همه‌چیز قطعی (seeded PRNG) است تا خروجی در CI بازتولیدپذیر باشد.
 * هیچ مبلغی در رکوردهای بسته/کش ذخیره نمی‌شود؛ `sanitizeSlots` هر
 * مقداری را که رقم دارد حذف می‌کند.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { packKey } from "../../app-v2/src/lib/nlu/pack";
import { isRecordSafe } from "../../app-v2/src/lib/nlu/learned-cache";
import type { NluIntent, NluSlots } from "../../app-v2/src/lib/nlu/rules";
import { ALLOWED_INTENTS } from "../../app-v2/src/lib/nlu/model";

export const ROOT = join(dirname(new URL(import.meta.url).pathname), "../..");
export const DATA_DIR = join(ROOT, "tools/build_pack/data");
export const ARTIFACT_DIR = join(ROOT, "artifacts/packs");
export const GENERATED_DIR = join(ROOT, "app-v2/src/lib/nlu/generated");

export interface CorpusRow {
  text: string;
  intent: NluIntent;
  slots: NluSlots;
  source: "dataset" | "synthetic";
  split: "train" | "val" | "test";
}

export interface EvalRow {
  text: string;
  intent: NluIntent;
  slots: NluSlots;
  scenario: "common" | "colloquial" | "novel";
  source: "synthetic-held-out";
}

export function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

export function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

export function writeJsonl(path: string, rows: unknown[]): void {
  ensureDir(dirname(path));
  writeFileSync(path, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
}

/** mulberry32 — PRNG سبک و قطعی */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(random: () => number, values: T[]): T {
  return values[Math.floor(random() * values.length)];
}

const SLOT_KEYS = new Set(["crop", "category", "unit", "docType", "topic", "direction", "role"]);

/** حذف هر مقدار دارای رقم/مبلغ؛ نگاشت کلیدهای ناشناخته. */
export function sanitizeSlots(input: Record<string, unknown> | undefined): NluSlots {
  const slots: Record<string, string> = {};
  if (!input) return slots;
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string") continue;
    const clean = value.replace(/[|\n\r]/g, " ").trim().slice(0, 48);
    if (!clean || /[0-9۰-۹]/.test(clean)) continue;
    const mapped =
      key === "land" ? "topic" : key === "method" ? "direction" : key === "cropName" ? "crop" : key;
    if (!SLOT_KEYS.has(mapped)) continue;
    slots[mapped] = clean;
  }
  return slots as NluSlots;
}

export function validateRow(row: { text: string; intent: string; slots: NluSlots }): boolean {
  if (!row.text || row.text.trim().length < 3) return false;
  if (!ALLOWED_INTENTS.includes(row.intent as NluIntent)) return false;
  if (!isRecordSafe(row.intent, row.slots)) return false;
  if (/[0-9]{4,}/.test(JSON.stringify(row.slots))) return false;
  return true;
}

/** خواندن دیتاست تأییدشدهٔ موجود و تبدیل به ردیف بسته. */
export function readDatasetRows(): { rows: CorpusRow[]; rejected: number } {
  const dir = join(ROOT, "training/data");
  if (!existsSync(dir)) return { rows: [], rejected: 0 };
  const files = readdirSync(dir).filter((file) => file.endsWith(".jsonl") && !file.startsWith("hard"));
  const rows: CorpusRow[] = [];
  let rejected = 0;
  for (const file of files) {
    const split = file.startsWith("val") ? "val" : file.startsWith("test") ? "test" : "train";
    for (const raw of readJsonl<{ intent: string; messages: { role: string; content: string }[] }>(join(dir, file))) {
      const user = raw.messages.find((message) => message.role === "user")?.content ?? "";
      const assistant = raw.messages.find((message) => message.role === "assistant")?.content ?? "";
      let slots: NluSlots = {};
      try {
        const parsed = JSON.parse(assistant) as { slots?: Record<string, unknown> };
        slots = sanitizeSlots(parsed.slots);
      } catch {
        rejected += 1;
        continue;
      }
      const row: CorpusRow = { text: user, intent: raw.intent as NluIntent, slots, source: "dataset", split };
      if (!validateRow(row)) {
        rejected += 1;
        continue;
      }
      rows.push(row);
    }
  }
  return { rows, rejected };
}

export const CROPS = [
  "گندم", "جو", "برنج", "ذرت", "کلزا", "پنبه", "چغندرقند", "سیب‌زمینی", "پیاز", "سیر",
  "گوجه", "خیار", "فلفل", "بادمجان", "کدو", "هندوانه", "خربزه", "زعفران", "پسته", "بادام",
  "گردو", "انار", "انگور", "سیب", "زیتون", "خرما", "مرکبات", "پرتقال", "لیمو", "یونجه",
];

export const CATEGORIES = ["بذر", "کود", "سم", "آب و برق", "کارگر", "ماشین‌آلات", "حمل و نقل", "اجاره زمین", "تعمیر و نگهداری", "عوارض و مالیات"];

export const UNITS = ["کیلوگرم", "تن", "هکتار", "کیسه", "سبد", "کارتن", "خروار", "من", "حلب", "نفرروز"];

export const PARTIES = [
  "حاج رضا", "مهدی کشاورز", "تعاونی روستا", "فروشگاه نهاده", "آقای صادقی", "شرکت دانه طلایی",
  "مالک زمین شمالی", "حسین آقا", "کارگاه کود", "بانک کشاورزی",
];

export function summarize(rows: { intent: string; source: string }[]): { total: number; byIntent: Record<string, number>; bySource: Record<string, number> } {
  const byIntent: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const row of rows) {
    byIntent[row.intent] = (byIntent[row.intent] ?? 0) + 1;
    bySource[row.source] = (bySource[row.source] ?? 0) + 1;
  }
  return { total: rows.length, byIntent, bySource };
}

export function uniqueByKey<T extends { text: string }>(rows: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const row of rows) {
    const key = packKey(row.text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export { SLOT_KEYS };
