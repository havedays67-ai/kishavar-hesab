/**
 * واژگان فارسی آموخته‌شده روی دستگاه + تطبیق تحمل‌پذیر غلط املایی
 * ----------------------------------------------------------------
 * پیکرهٔ فارسی (tools/train) پرتکرارترین واژه‌ها را می‌دهد؛ اینجا از آن
 * برای «تصحیح سبک» توکن‌های ناشناخته استفاده می‌شود تا جمله‌های محاوره‌ای و
 * غلط‌املایی هم به قواعد برسند. الگوریتم: فاصلهٔ ویرایشی ≤۱ فقط برای توکن‌های
 * ۴ حرف و بیشتر، با ترتیب قطعی — هیچ عدد یا مبلغی تولید نمی‌شود.
 */
import { PERSIAN_VOCAB } from "./generated/persian";

let vocabulary: Set<string> | null = null;

export function knownWords(): Set<string> {
  if (!vocabulary) vocabulary = new Set(PERSIAN_VOCAB.split(" ").filter(Boolean));
  return vocabulary;
}

export function isKnownWord(word: string): boolean {
  return knownWords().has(word);
}

function withinOneEdit(source: string, target: string): boolean {
  if (source === target) return true;
  const a = source.length;
  const b = target.length;
  if (Math.abs(a - b) > 1) return false;
  let indexA = 0;
  let indexB = 0;
  let edits = 0;
  while (indexA < a && indexB < b) {
    if (source[indexA] === target[indexB]) {
      indexA += 1;
      indexB += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a > b) indexA += 1;
    else if (a < b) indexB += 1;
    else {
      indexA += 1;
      indexB += 1;
    }
  }
  if (indexA < a || indexB < b) edits += 1;
  return edits <= 1;
}

/** نزدیک‌ترین واژهٔ آموخته‌شده با حداکثر یک ویرایش؛ اگر نبود، همان ورودی. */
export function correctWord(word: string): string {
  if (word.length < 4 || isKnownWord(word)) return word;
  let best: string | null = null;
  for (const candidate of knownWords()) {
    if (Math.abs(candidate.length - word.length) > 1) continue;
    if (!withinOneEdit(word, candidate)) continue;
    if (!best || candidate.length < best.length || (candidate.length === best.length && candidate < best)) best = candidate;
  }
  return best ?? word;
}

export function correctText(text: string): string {
  return text
    .split(" ")
    .map((token) => (/^[\u0600-\u06FF]{4,}$/.test(token) ? correctWord(token) : token))
    .join(" ");
}

export const PERSIAN_LEXICON_ENABLED = true;
