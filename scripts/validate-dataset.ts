/**
 * اعتبارسنجی هر دیتاست JSONL (خروجی معلم‌ها یا دیتاست تولیدی) پیش از آموزش.
 * اجرا: npx tsx scripts/validate-dataset.ts training/data/train.jsonl [...]
 * خروج با کد ۱ در صورت هرگونه خطا (قابل استفاده در CI و ایجنت محلی).
 */
import { readFileSync } from "node:fs";
import { INTENTS, validateAssistantOutput } from "../src/lib/engine/contracts";

interface Row {
  id?: string;
  intent?: string;
  messages?: { role: string; content: string }[];
  expected?: unknown;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: tsx scripts/validate-dataset.ts <file.jsonl> [...]");
  process.exit(2);
}

let total = 0;
let invalidJson = 0;
let invalidContract = 0;
let invalidShape = 0;
const seen = new Map<string, number>();
const intentCounts = new Map<string, number>();
const errors: string[] = [];

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n").filter((l) => l.trim().length > 0);
  for (const [index, line] of lines.entries()) {
    total += 1;
    let row: Row;
    try {
      row = JSON.parse(line) as Row;
    } catch {
      invalidJson += 1;
      if (errors.length < 15) errors.push(`${file}:${index + 1} JSON نامعتبر`);
      continue;
    }
    const messages = row.messages ?? [];
    const user = messages.find((m) => m.role === "user")?.content ?? "";
    const assistantRaw = messages.find((m) => m.role === "assistant")?.content ?? "";
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    if (!user || !assistantRaw) {
      invalidShape += 1;
      if (errors.length < 15) errors.push(`${file}:${index + 1} پیام user/assistant ندارد`);
      continue;
    }
    if (!system.includes("JSON")) {
      invalidShape += 1;
      if (errors.length < 15) errors.push(`${file}:${index + 1} پرامپت سیستمی JSON-only ندارد`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(assistantRaw);
    } catch {
      invalidJson += 1;
      if (errors.length < 15) errors.push(`${file}:${index + 1} خروجی assistant JSON معتبر نیست`);
      continue;
    }
    const result = validateAssistantOutput(parsed);
    if (!result.ok) {
      invalidContract += 1;
      if (errors.length < 15) errors.push(`${file}:${index + 1} قرارداد: ${result.errors.join("; ")}`);
      continue;
    }
    if (row.intent && row.intent !== result.normalized?.intent) {
      invalidContract += 1;
      if (errors.length < 15) errors.push(`${file}:${index + 1} intent با meta هم‌خوان نیست`);
    }
    const key = `${result.normalized?.intent}|${user.replace(/\s+/g, " ").trim()}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    intentCounts.set(result.normalized!.intent, (intentCounts.get(result.normalized!.intent) ?? 0) + 1);
  }
}

const duplicates = [...seen.values()].filter((count) => count > 1).length;
const missingIntents = INTENTS.filter((intent) => !intentCounts.has(intent));
const summary = {
  files,
  total,
  invalidJson,
  invalidContract,
  invalidShape,
  duplicates,
  missingIntents,
  coverage: Object.fromEntries([...intentCounts.entries()].sort()),
  errors,
};
console.log(JSON.stringify(summary, null, 2));

const failed = invalidJson + invalidContract + invalidShape > 0;
process.exit(failed ? 1 : 0);
