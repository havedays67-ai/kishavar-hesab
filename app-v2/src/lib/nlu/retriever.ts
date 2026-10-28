/**
 * بازیاب معنایی سبک (TF-IDF) — فقط برای حالت «پشتیبان»
 * ------------------------------------------------------------
 * بدون embedding و بدون مدل: بردار TF-IDF روی واژه‌های نرمال‌شده
 * ساخته می‌شود و شباهت کسینوسی رتبه می‌دهد. پاسخ‌های دانشنامه متن
 * ثابت راهنما هستند؛ هیچ عدد مالی از این لایه تولید نمی‌شود و
 * پاسخ‌های گزارشی همیشه از موتور قطعی می‌آیند.
 */
import { normalizePersian } from "./normalizer";

const STOPWORDS = new Set([
  "از", "به", "با", "در", "را", "که", "و", "یا", "تا", "بر", "برای", "این", "آن", "است", "هست", "بود",
  "می", "کن", "کنم", "کنید", "شود", "شده", "چه", "چی", "چرا", "چطور", "چگونه", "کجا", "کی", "آیا",
  "من", "ما", "شما", "او", "ها", "های", "یک", "هم", "نه", "باید", "دارد", "دارم", "کدام", "چقدر",
]);

export function stemFa(word: string): string {
  const suffixes = ["هایی", "های", "ترین", "تری", "ها", "تر", "ام", "ات", "اش", "مان", "شان", "تان"];
  for (const suffix of suffixes) {
    if (word.length - suffix.length >= 3 && word.endsWith(suffix)) return word.slice(0, -suffix.length);
  }
  return word;
}

export function retrieverTokens(text: string): string[] {
  return normalizePersian(text)
    .split(/[^\p{L}\p{N}]+/u)
    .map(stemFa)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

export interface RetrievalDoc {
  id: string;
  title: string;
  text: string;
  category?: string;
}

export interface RetrievalHit {
  doc: RetrievalDoc;
  score: number;
  confidence: number;
}

export interface RetrieverIndex {
  docs: RetrievalDoc[];
  vectors: Map<string, number>[];
  idf: Map<string, number>;
  lookup(text: string, limit?: number): RetrievalHit[];
}

/** ساخت ایندکس TF-IDF (کوچک و سریع؛ برای ~۲۰۰ سند در چند میلی‌ثانیه). */
export function buildRetriever(docs: RetrievalDoc[]): RetrieverIndex {
  const tokenized = docs.map((doc) => retrieverTokens(`${doc.title} ${doc.title} ${doc.text} ${doc.category ?? ""}`));
  const df = new Map<string, number>();
  for (const tokens of tokenized) {
    for (const token of new Set(tokens)) df.set(token, (df.get(token) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [token, count] of df) idf.set(token, Math.log((docs.length + 1) / (count + 0.5)) + 1);
  const vectors = tokenized.map((tokens) => {
    const tf = new Map<string, number>();
    for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
    const vector = new Map<string, number>();
    const maxTf = Math.max(1, ...tf.values());
    for (const [token, count] of tf) vector.set(token, (0.5 + (0.5 * count) / maxTf) * (idf.get(token) ?? 1));
    return vector;
  });

  const cosine = (a: Map<string, number>, b: Map<string, number>): number => {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (const value of a.values()) normA += value * value;
    for (const value of b.values()) normB += value * value;
    if (normA === 0 || normB === 0) return 0;
    const [small, large] = a.size < b.size ? [a, b] : [b, a];
    for (const [token, value] of small) {
      const other = large.get(token);
      if (other) dot += value * other;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  return {
    docs,
    vectors,
    idf,
    lookup: (text: string, limit = 3) => {
      const tokens = retrieverTokens(text);
      if (!tokens.length) return [];
      const query = new Map<string, number>();
      for (const token of tokens) query.set(token, (query.get(token) ?? 0) + (idf.get(token) ?? 0.4));
      return docs
        .map((doc, index) => {
          const score = cosine(query, vectors[index]);
          return { doc, score, confidence: Math.max(0, Math.min(1, score)) };
        })
        .filter((hit) => hit.score > 0.02)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
  };
}

export const RETRIEVAL_THRESHOLD = 0.2;
