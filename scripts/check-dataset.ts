/**
 * دروازه‌ی کیفیت دیتاست. اگر شرطی رد شود، کد خروج ۱ می‌دهد و CI متوقف می‌شود.
 * اجرا: npx tsx scripts/check-dataset.ts
 */
import { readFileSync } from "node:fs";
import { INTENTS, validateAssistantOutput, type ContractIntent } from "../src/lib/engine/contracts";

type Row = {
  id?: string;
  intent?: string;
  messages: { role: string; content: string }[];
  meta?: { tags?: string[]; difficulty?: string };
};

const FILES = {
  train: "training/data/train.jsonl",
  val: "training/data/val.jsonl",
  test: "training/data/test.jsonl",
  hard: "training/data/hard-test.jsonl",
} as const;

const MIN_TRAIN = 12;
const MIN_TEST = 5;
const MIN_HARD = 40;
const MAX_RATIO = 3.0;
const MIN_ASK = 15;

function load(path: string): Row[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Row);
}

function userOf(row: Row): string {
  return row.messages.find((m) => m.role === "user")?.content ?? "";
}

function intentOf(row: Row): ContractIntent | null {
  const raw = row.messages.find((m) => m.role === "assistant")?.content ?? "";
  try {
    const parsed = JSON.parse(raw) as { intent?: string };
    return (parsed.intent as ContractIntent) ?? null;
  } catch {
    return null;
  }
}

function actionOf(row: Row): string {
  const raw = row.messages.find((m) => m.role === "assistant")?.content ?? "";
  try {
    return (JSON.parse(raw) as { action?: string }).action ?? "";
  } catch {
    return "";
  }
}

const data = {
  train: load(FILES.train),
  val: load(FILES.val),
  test: load(FILES.test),
  hard: load(FILES.hard),
};

const errors: string[] = [];
const coverage = Object.fromEntries(
  INTENTS.map((intent) => [
    intent,
    {
      train: data.train.filter((row) => intentOf(row) === intent).length,
      val: data.val.filter((row) => intentOf(row) === intent).length,
      test: data.test.filter((row) => intentOf(row) === intent).length,
      hard: data.hard.filter((row) => intentOf(row) === intent).length,
    },
  ]),
) as Record<string, { train: number; val: number; test: number; hard: number }>;

// ۱) اعتبار قرارداد همه‌ی ردیف‌ها
for (const [split, rows] of Object.entries(data)) {
  rows.forEach((row, index) => {
    const assistant = row.messages.find((m) => m.role === "assistant")?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(assistant);
    } catch {
      errors.push(`${split}:${index + 1} JSON نامعتبر`);
      return;
    }
    const result = validateAssistantOutput(parsed);
    if (!result.ok) errors.push(`${split}:${index + 1} ${result.errors.join("; ")}`);
    if (row.intent && row.intent !== intentOf(row)) errors.push(`${split}:${index + 1} intent ناهم‌خوان`);
  });
}

// ۲) پوشش و کف تعداد
for (const intent of INTENTS) {
  const c = coverage[intent];
  if (c.train < MIN_TRAIN) errors.push(`train/${intent}: ${c.train} < ${MIN_TRAIN}`);
  if (c.test < MIN_TEST) errors.push(`test/${intent}: ${c.test} < ${MIN_TEST} (پوشش تست ناقص)`);
  if (c.hard < 1) errors.push(`hard/${intent}: صفر (تست سخت باید همه‌ی intentها را پوشش دهد)`);
}

// ۳) توازن
const trainCounts = INTENTS.map((intent) => coverage[intent].train);
const min = Math.min(...trainCounts);
const max = Math.max(...trainCounts);
if (min > 0 && max / min > MAX_RATIO) errors.push(`عدم توازن train: max/min = ${(max / min).toFixed(2)} > ${MAX_RATIO}`);

// ۴) نشت داده
const users = {
  train: new Set(data.train.map(userOf)),
  val: new Set(data.val.map(userOf)),
  test: new Set(data.test.map(userOf)),
  hard: new Set(data.hard.map(userOf)),
};
for (const [a, b] of [
  ["train", "test"],
  ["train", "hard"],
  ["test", "hard"],
  ["train", "val"],
] as const) {
  let overlap = 0;
  for (const text of users[a]) if (users[b].has(text)) overlap += 1;
  if (overlap > 0) errors.push(`نشت متن بین ${a} و ${b}: ${overlap} مورد`);
}

// ۵) عمل‌ها و ایمنی
const actions = ["draft", "ask", "answer", "refuse"].map((action) => ({
  action,
  train: data.train.filter((row) => actionOf(row) === action).length,
}));
for (const row of actions) if (row.train === 0) errors.push(`action «${row.action}» در train وجود ندارد`);
const askCount = actions.find((row) => row.action === "ask")?.train ?? 0;
if (askCount < MIN_ASK) errors.push(`نمونه‌های ask در train: ${askCount} < ${MIN_ASK}`);

const safety = data.train.filter((row) => (row.meta?.tags ?? []).includes("safety")).length;
if (safety < 10) errors.push(`نمونه‌های دستور خطرناک (safety) در train: ${safety} < 10`);

if (data.hard.length < MIN_HARD) errors.push(`hard-test: ${data.hard.length} < ${MIN_HARD}`);

const summary = {
  counts: { train: data.train.length, val: data.val.length, test: data.test.length, hard: data.hard.length },
  coverage,
  actions,
  safety,
  balanceRatio: min > 0 ? Number((max / min).toFixed(2)) : null,
  errors,
};
console.log(JSON.stringify(summary, null, 2));
if (errors.length) process.exit(1);
