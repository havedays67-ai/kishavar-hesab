/**
 * مدل کوچک به‌عنوان آخرین راه (Model Fallback) + اعتبارسنج سخت JSON
 * ------------------------------------------------------------
 * وضعیت واقعی: در این نسخه هیچ وزن مدلی همراه APK نیست؛ بنابراین
 * `isModelAvailable()` مقدار false برمی‌گرداند و Router بدون فراخوانی
 * مدل به سطح «پرسش شفاف‌کننده» می‌رود. جای اتصال مدل (llama.cpp/GGUF)
 * با `setModelRunner` آماده است تا در نسخهٔ بعد بدون تغییر معماری وصل شود.
 *
 * خروجی مدل هرگز مستقیم استفاده نمی‌شود: `validateModelOutput` فقط
 * شیء JSON با کلیدهای مجاز و بدون هیچ عدد مالی را می‌پذیرد؛ در غیر این
 * صورت null برمی‌گردد (بنابراین JSON نامعتبر هرگز به موتور نمی‌رسد).
 */
import type { NluIntent, NluSlots } from "./rules";
import { isRecordSafe } from "./learned-cache";

const ALLOWED_INTENTS: NluIntent[] = [
  "add_expense", "add_income", "sale_crop", "purchase_input", "harvest_record", "wage_payment",
  "fertilizer_pesticide", "irrigation_log", "cheque_received", "cheque_paid", "loan_installment",
  "inventory_out", "report_receivable", "report_payable", "report_cash", "report_profit",
  "report_cheques", "report_inventory", "legal_cheque", "legal_signature", "legal_contract",
  "contract_help", "app_help", "math_query", "trade_help", "weather", "greeting", "thanks", "unknown",
];

export const ALLOWED_SLOT_KEYS = ["crop", "category", "unit", "docType", "topic", "direction", "role"] as const;
export const MODEL_MIN_CONFIDENCE = 0.6;

export interface ModelOutput {
  intent: NluIntent;
  slots: NluSlots;
  confidence: number;
}

export type ModelValidation = { ok: true; value: ModelOutput } | { ok: false; reason: string };

/** استخراج اولین شیء JSON متوازن از متن مدل (حذف بلوک کد/توضیح). */
export function extractJsonObject(raw: string): string | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const character = raw[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, index + 1);
    }
  }
  return null;
}

export function validateModelOutput(raw: string): ModelValidation {
  const candidate = extractJsonObject(raw);
  if (!candidate) return { ok: false, reason: "no-json" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "not-object" };
  const record = parsed as Record<string, unknown>;
  const intent = record.intent;
  if (typeof intent !== "string" || !ALLOWED_INTENTS.includes(intent as NluIntent)) {
    return { ok: false, reason: "bad-intent" };
  }
  const rawSlots = record.slots;
  const slots: Record<string, string> = {};
  if (rawSlots !== undefined) {
    if (!rawSlots || typeof rawSlots !== "object" || Array.isArray(rawSlots)) return { ok: false, reason: "bad-slots" };
    for (const [key, value] of Object.entries(rawSlots as Record<string, unknown>)) {
      if (!ALLOWED_SLOT_KEYS.includes(key as (typeof ALLOWED_SLOT_KEYS)[number])) return { ok: false, reason: "unknown-slot" };
      if (typeof value !== "string") return { ok: false, reason: "slot-not-string" };
      slots[key] = value.slice(0, 48);
    }
  }
  if (!isRecordSafe(intent, slots as NluSlots)) return { ok: false, reason: "unsafe-slots" };
  const confidenceRaw = record.confidence;
  const confidence = typeof confidenceRaw === "number" && Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.5;
  return { ok: true, value: { intent: intent as NluIntent, slots: slots as NluSlots, confidence } };
}

export type ModelRunner = (input: { text: string; key: string }) => Promise<string>;

let runner: ModelRunner | null = null;
let loaded = false;
let lastUsed = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let callCount = 0;
let loadCount = 0;

/** اتصال مدل روی دستگاه (فعلاً وصل نشده؛ برای نسخهٔ بعد). */
export function setModelRunner(next: ModelRunner | null, options?: { idleMs?: number }): void {
  runner = next;
  loaded = Boolean(next);
  loadCount = next ? loadCount + 1 : loadCount;
  lastUsed = Date.now();
  if (idleTimer) clearTimeout(idleTimer);
  if (next) {
    const idleMs = options?.idleMs ?? 90_000;
    idleTimer = setTimeout(() => {
      loaded = false;
    }, idleMs);
  }
}

export function isModelAvailable(): boolean {
  return Boolean(runner) && loaded;
}

export function modelStats(): { available: boolean; calls: number; loads: number; idleMs: number } {
  return { available: isModelAvailable(), calls: callCount, loads: loadCount, idleMs: lastUsed ? Date.now() - lastUsed : 0 };
}

/** اجرای مدل با محدودیت زمانی و اعتبارسنجی سخت؛ در نبود مدل null. */
export async function runModelFallback(
  text: string,
  key: string,
  timeoutMs = 2500
): Promise<{ value: ModelOutput | null; reason: string; rawValidJson: boolean }> {
  if (!runner || !loaded) return { value: null, reason: "unavailable", rawValidJson: false };
  callCount += 1;
  lastUsed = Date.now();
  try {
    const raw = await Promise.race([
      runner({ text, key }),
      new Promise<string>((resolve) => setTimeout(() => resolve(""), timeoutMs)),
    ]);
    const validation = validateModelOutput(raw);
    if (!validation.ok) return { value: null, reason: validation.reason, rawValidJson: false };
    if (validation.value.confidence < MODEL_MIN_CONFIDENCE) {
      return { value: validation.value, reason: "low-confidence", rawValidJson: true };
    }
    return { value: validation.value, reason: "ok", rawValidJson: true };
  } catch {
    return { value: null, reason: "error", rawValidJson: false };
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      loaded = false;
    }, 90_000);
  }
}

export function __resetModelForTests(): void {
  runner = null;
  loaded = false;
  callCount = 0;
  loadCount = 0;
  lastUsed = 0;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
}

export { ALLOWED_INTENTS };
export const MODEL_CONTRACT_VERSION = "1.0.0";
