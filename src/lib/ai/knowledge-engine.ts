/**
 * موتور دانش دائمی کشاورزیار
 * ------------------------------------------------------------
 * چرخهٔ کار:
 *  ۱) KNOWLEDGE_SEEDS → جدول `assistant_knowledge` (منبع حقیقت)
 *  ۲) تولید نمونه‌های آموزشی (پرسش/پاسخ/قصد) در
 *     `assistant_training_samples` برای آموزش/ارزیابی مدل
 *  ۳) بازیابی معنایی-واژگانی فارسی روی همان جدول برای هر پرسش
 *  ۴) ثبت پرسش/پاسخ و بازخورد در `assistant_interactions` و
 *     تنظیم وزن دانش بر اساس رضایت کاربر (یادگیری تدریجی)
 *
 * هیچ پاسخی بدون منبع از این لایه به کاربر نشان داده نمی‌شود؛
 * عددهای مالی همیشه از موتور قطعی همان مزرعه می‌آیند.
 */
import { db } from "@/db";
import { assistantInteractions, assistantKnowledge, assistantTrainingSamples } from "@/db/schema";
import { KNOWLEDGE_SEEDS, KNOWLEDGE_SYNONYMS } from "./knowledge-data";
import { normalizeFa } from "./nlu";
import { desc, eq, sql } from "drizzle-orm";

export interface KnowledgeRow {
  id: number;
  slug: string;
  category: string;
  question: string;
  answer: string;
  keywords: string;
  intent: string;
  source: string;
  weight: number;
}

export interface KnowledgeMatch extends KnowledgeRow {
  score: number;
  confidence: number;
}

export interface KnowledgeStats {
  entries: number;
  samples: number;
  interactions: number;
  categories: { category: string; count: number }[];
}

const PERSIAN_STOPWORDS = new Set([
  "از", "به", "با", "در", "را", "که", "و", "یا", "تا", "بر", "برای", "این", "آن", "است", "هست", "بود",
  "می", "کن", "کنم", "کنید", "شود", "شده", "چه", "چی", "چرا", "چطور", "چگونه", "کجا", "کی", "آیا",
  "من", "ما", "شما", "او", "ها", "های", "یک", "هم", "نه", "باید", "می‌شود", "کنیم", "دارد", "دارم",
]);

export function normalizeQuery(input: string): string {
  return normalizeFa(input)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  return normalizeQuery(input)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !PERSIAN_STOPWORDS.has(token));
}

/** گسترش واژه‌ها با مترادف‌ها؛ خروجی بدون تکرار. */
export function expandTokens(tokens: string[]): { token: string; weight: number }[] {
  const map = new Map<string, number>();
  const add = (token: string, weight: number) => {
    if (!token || token.length < 2) return;
    map.set(token, Math.max(map.get(token) ?? 0, weight));
  };
  tokens.forEach((token) => {
    add(token, 1);
    for (const [key, synonyms] of Object.entries(KNOWLEDGE_SYNONYMS)) {
      const keyNorm = normalizeFa(key);
      const group = [keyNorm, ...synonyms.map((item) => normalizeFa(item))];
      // واژه‌های کوتاه (مثل «آبی») فقط با تطبیق کامل گسترده می‌شوند؛ وگرنه
      // «آبی» با «آبیاری» یکی گرفته می‌شد و پاسخ آبیاری جای پاسخ عملکرد
      // گندم آبی می‌نشست (باگ واقعی بازیابی).
      const exact = group.some((item) => token === item);
      const fuzzy = token.length >= 4 && group.some((item) => item.includes(token) || token.includes(item));
      if (exact || fuzzy) {
        group.forEach((item) => add(item, exact ? 0.9 : 0.6));
      }
    }
  });
  return [...map.entries()]
    .filter(([token]) => !PERSIAN_STOPWORDS.has(token))
    .map(([token, weight]) => ({ token, weight }))
    .slice(0, 40);
}

function scoreRow(
  row: KnowledgeRow,
  query: string,
  tokens: { token: string; weight: number }[],
  coreTokens: string[],
): number {
  const question = normalizeQuery(row.question);
  const keywordsText = normalizeFa(row.keywords);
  const body = normalizeFa(`${row.question} ${row.keywords} ${row.answer}`);

  // ۱) سیگنال اصلی: واژه‌های واقعی پرسش کاربر. تطبیق در «عنوان/کلیدواژه» بسیار
  // ارزشمندتر از تکرار همان واژه در متن طولانی پاسخ است؛ همین موضوع باعث می‌شد
  // پرسش «راندمان آبیاری» یا «عملکرد گندم آبی» به پاسخ نیاز آبی برسد.
  let core = 0;
  for (const token of coreTokens) {
    if (question.includes(token)) core += 5;
    else if (keywordsText.includes(token)) core += 4;
    else if (body.includes(token)) core += 1;
  }

  // ۲) سیگنال کمکی: مترادف‌ها؛ سقف‌دار تا یک گروه مترادف بزرگ کل رتبه را نبرد.
  const coreSet = new Set(coreTokens);
  let synonym = 0;
  for (const { token, weight } of tokens) {
    if (coreSet.has(token)) continue;
    if (question.includes(token)) synonym += 2 * weight;
    else if (keywordsText.includes(token)) synonym += 1.6 * weight;
    else if (body.includes(token)) synonym += 0.35 * weight;
  }
  synonym = Math.min(8, synonym);

  // ۳) پاداش عبارت کامل موضوع (مثل «عملکرد گندم» یا «رطوبت مجاز»).
  const phrases = [...keywordsText.split(/[،,]/), ...question.split(" ")]
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length >= 8);
  let phraseBonus = 0;
  for (const phrase of phrases) {
    if (query.includes(phrase)) phraseBonus += 4;
  }
  if (phrases.some((phrase) => phrase === query)) phraseBonus += 6;
  const phraseScore = Math.min(14, phraseBonus);

  // ۴) وزن مدخل فقط تعدیل ملایم است، نه ضریب غالب.
  const weightFactor = 1 + Math.max(0, (row.weight || 1) - 1) * 0.12;

  let score = 0;
  if (query.length >= 3 && (question.includes(query) || keywordsText.includes(query))) score += 6;
  return (core + synonym + score) * weightFactor + phraseScore;
}

export function rankRows(rows: KnowledgeRow[], message: string, limit = 4): KnowledgeMatch[] {
  const query = normalizeQuery(message);
  const coreTokens = tokenize(message);
  const tokens = expandTokens(coreTokens);
  if (!query || tokens.length === 0) return [];
  const maxPossible = Math.max(10, coreTokens.reduce((sum, token) => sum + 5, 0) * 1.2);
  return rows
    .map((row) => {
      const score = scoreRow(row, query, tokens, coreTokens);
      return { ...row, score, confidence: Math.max(0, Math.min(1, score / Math.max(6, maxPossible))) };
    })
    .filter((row) => row.score > 2.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* --------------------------- seed --------------------------- */

function sampleVariants(seed: (typeof KNOWLEDGE_SEEDS)[number]): string[] {
  const variants = new Set<string>([seed.question, ...seed.aliases]);
  seed.aliases.forEach((alias) => {
    variants.add(`${alias}؟`);
    variants.add(`دربارهٔ ${alias} توضیح بده`);
  });
  if (/چیست|چطور|چگونه/.test(seed.question) === false) variants.add(`${seed.question} چیست؟`);
  return [...variants].slice(0, 6);
}

let ensurePromise: Promise<void> | null = null;

async function seedKnowledge(): Promise<void> {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assistantKnowledge);
  const existing = Number(countRow?.count ?? 0);
  if (existing < KNOWLEDGE_SEEDS.length) {
    const rows = KNOWLEDGE_SEEDS.map((seed) => ({
      slug: seed.slug,
      category: seed.category,
      question: seed.question,
      answer: seed.answer,
      keywords: [...seed.keywords, ...seed.aliases].join("، "),
      aliases: seed.aliases.join("، "),
      intent: seed.intent,
      source: seed.source,
      authority: "curated",
      weight: seed.weight ?? 1,
    }));
    for (let index = 0; index < rows.length; index += 25) {
      await db
        .insert(assistantKnowledge)
        .values(rows.slice(index, index + 25))
        .onConflictDoNothing({ target: assistantKnowledge.slug });
    }
  }

  const [sampleRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assistantTrainingSamples);
  const samples = Number(sampleRow?.count ?? 0);
  const expected = KNOWLEDGE_SEEDS.length * 5;
  if (samples < expected) {
    const entries = await db.select().from(assistantKnowledge);
    const bySlug = new Map(entries.map((entry) => [entry.slug, entry.id]));
    const values = KNOWLEDGE_SEEDS.flatMap((seed, index) =>
      sampleVariants(seed).map((prompt, variantIndex) => {
        const hash = (index * 7 + variantIndex * 13) % 10;
        const split = hash === 0 ? "test" : hash === 1 ? "val" : "train";
        return {
          knowledgeId: bySlug.get(seed.slug) ?? null,
          prompt,
          completion: seed.answer,
          intent: seed.intent,
          split,
          tokens: tokenize(prompt).length + tokenize(seed.answer).length,
          source: seed.source,
        };
      })
    );
    for (let index = 0; index < values.length; index += 100) {
      const chunk = values.slice(index, index + 100);
      await db
        .insert(assistantTrainingSamples)
        .values(chunk)
        .onConflictDoNothing({ target: [assistantTrainingSamples.prompt, assistantTrainingSamples.intent] });
    }
  }
}

/** راه‌اندازی بی‌خطر و یک‌بارهٔ هستهٔ دانش (قابل فراخوانی در همهٔ مسیرها). */
export async function ensureKnowledgeBase(force = false): Promise<void> {
  if (force) ensurePromise = null;
  if (!ensurePromise) {
    ensurePromise = seedKnowledge().catch((error) => {
      console.error("knowledge seed failed", error);
      ensurePromise = null;
    });
  }
  await ensurePromise;
}

/* --------------------------- retrieval --------------------------- */

export async function listKnowledge(): Promise<KnowledgeRow[]> {
  const rows = await db.select().from(assistantKnowledge).orderBy(desc(assistantKnowledge.weight));
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    category: row.category,
    question: row.question,
    answer: row.answer,
    keywords: row.keywords,
    intent: row.intent,
    source: row.source,
    weight: row.weight,
  }));
}

export async function searchKnowledge(message: string, limit = 4): Promise<KnowledgeMatch[]> {
  await ensureKnowledgeBase();
  const rows = await listKnowledge();
  return rankRows(rows, message, limit);
}

export async function knowledgeStats(): Promise<KnowledgeStats> {
  await ensureKnowledgeBase();
  const [entries] = await db.select({ count: sql<number>`count(*)::int` }).from(assistantKnowledge);
  const [samples] = await db.select({ count: sql<number>`count(*)::int` }).from(assistantTrainingSamples);
  const [interactions] = await db.select({ count: sql<number>`count(*)::int` }).from(assistantInteractions);
  const categoryRows = await db
    .select({ category: assistantKnowledge.category, count: sql<number>`count(*)::int` })
    .from(assistantKnowledge)
    .groupBy(assistantKnowledge.category)
    .orderBy(desc(sql`count(*)`));
  return {
    entries: Number(entries?.count ?? 0),
    samples: Number(samples?.count ?? 0),
    interactions: Number(interactions?.count ?? 0),
    categories: categoryRows.map((row) => ({ category: row.category, count: Number(row.count) })),
  };
}

/** پرسش‌هایی که جوابشان باید از دادهٔ واقعی مزرعه بیاید، نه دانش عمومی. */
export function needsLiveData(message: string): boolean {
  const text = normalizeFa(message);
  const liveMarkers = [
    "سود من", "سودم", "هزینه من", "هزینه‌های من", "درآمد من", "موجودی من", "مانده من",
    "چقدر سود", "چقدر هزینه", "چقدر درآمد", "چقدر بده", "چقدر طلب", "حساب من", "مزرعه من",
    "امسال", "این ماه", "هفته گذشته", "گزارش من", "چک‌های من", "چک های من",
  ];
  return liveMarkers.some((marker) => text.includes(normalizeFa(marker)));
}

export function looksLikeQuestion(message: string): boolean {
  const text = normalizeFa(message);
  if (text.includes("?")) return true;
  return ["چیست", "چیه", "چطور", "چگونه", "چرا", "آیا", "کجا", "کی", "چه", "چقدر", "تفاوت", "معنی", "یعنی", "راهنما", "توضیح"].some((word) =>
    text.includes(normalizeFa(word))
  );
}

/* --------------------------- learning --------------------------- */

export async function logInteraction(input: {
  mode: string;
  question: string;
  answer: string;
  confidence: number;
  knowledgeId?: number | null;
  source: string;
}): Promise<number | null> {
  try {
    const [row] = await db
      .insert(assistantInteractions)
      .values({
        mode: input.mode,
        question: input.question.slice(0, 2000),
        answer: input.answer.slice(0, 4000),
        confidence: input.confidence,
        knowledgeId: input.knowledgeId ?? null,
        source: input.source,
      })
      .returning({ id: assistantInteractions.id });
    return row?.id ?? null;
  } catch (error) {
    console.error("logInteraction failed", error);
    return null;
  }
}

export async function recordFeedback(interactionId: number, helpful: boolean): Promise<void> {
  await db
    .update(assistantInteractions)
    .set({ helpful })
    .where(eq(assistantInteractions.id, interactionId));
  if (!helpful) return;
  const [row] = await db
    .select({ knowledgeId: assistantInteractions.knowledgeId })
    .from(assistantInteractions)
    .where(eq(assistantInteractions.id, interactionId))
    .limit(1);
  const knowledgeId = row?.knowledgeId;
  if (!knowledgeId) return;
  // یادگیری تدریجی: وزن دانشِ مفید کمی بالا می‌رود (سقف ۲).
  await db
    .update(assistantKnowledge)
    .set({ weight: sql`least(2, ${assistantKnowledge.weight} + 0.05)` })
    .where(eq(assistantKnowledge.id, knowledgeId));
}

/** افزودن دانش جدید توسط کاربر/مدیر؛ همان لحظه در بازیابی شرکت می‌کند. */
export async function addKnowledge(input: {
  question: string;
  answer: string;
  category?: string;
  keywords?: string;
  source?: string;
}): Promise<{ id: number; slug: string }> {
  await ensureKnowledgeBase();
  const slug = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const [row] = await db
    .insert(assistantKnowledge)
    .values({
      slug,
      category: input.category?.trim() || "دانش کاربر",
      question: input.question.trim(),
      answer: input.answer.trim(),
      keywords: input.keywords?.trim() || tokenize(input.question).join("، "),
      aliases: "",
      intent: "user.custom",
      source: input.source?.trim() || "ثبت‌شده توسط کاربر",
      authority: "user",
      weight: 1,
    })
    .returning({ id: assistantKnowledge.id, slug: assistantKnowledge.slug });
  return row;
}

/** پاک‌سازی سبک گفتگوهای قدیمی برای جلوگیری از رشد بی‌رویه. */
export async function pruneInteractions(keep = 2000): Promise<void> {
  await db.execute(sql`
    delete from ${assistantInteractions}
    where id not in (
      select id from ${assistantInteractions} order by id desc limit ${keep}
    )
  `);
}

