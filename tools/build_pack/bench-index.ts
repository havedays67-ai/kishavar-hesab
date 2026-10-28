/**
 * بنچمارک واقعی ایندکس‌های جستجوی بستهٔ پاسخ
 * ------------------------------------------------------------
 * اجرا: npx tsx tools/build_pack/bench-index.ts [--json artifacts/index-bench.json]
 *
 * ⚠️ صداقت اندازه‌گیری: این اعداد روی Node همین ماشین گرفته می‌شوند
 * (Linux x64، بدون Android Runtime). «زمان روی گوشی» نیست و ادعای
 * هم‌ارزی با ART Profiler نمی‌کنیم؛ برای انتخاب ساختار روی گوشی باید
 * همین بنچمارک در Instrumented Test اندروید تکرار شود. چیزی که این
 * گزارش واقعاً نشان می‌دهد: تفاوت نسبی ساختارها، حجم ساختار و نرخ
 * false-positive بلوم.
 *
 * ساختارهای مقایسه‌شده:
 *  ۱) sorted-u32 + binary-search       ← فرمت فعلی بسته (mmap-friendly، بدون RAM اضافی)
 *  ۲) sorted-u32 + bloom prefilter     ← همان بستهٔ v2 (رد سریع منفی‌ها)
 *  ۳) open-address-u32 (hash table)    ← شبیه جدول هش صفحه‌ای SQLite، mmap-friendly
 *  ۴) Map<hash, index>                 ← سریع‌ترین در JS ولی RAM بیشتر
 *  ۵) sorted-strings + binary-search   ← پروکسی دیکشنری رشته‌ای (نزدیک به FST، RAM زیاد)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { format } from "node:util";
import { hashKey } from "../../app-v2/src/lib/nlu/normalizer";
import { buildBloom, BLOOM_BITS_PER_KEY, BLOOM_HASH_COUNT } from "../../app-v2/src/lib/nlu/bloom";
import { encodePack, openPack, packKey } from "../../app-v2/src/lib/nlu/pack";
import { ROOT } from "./lib";

const CORPUS = join(ROOT, "tools/build_pack/data/corpus.jsonl");
const OUT = join(ROOT, "artifacts/index-bench.json");
const SCALE_TARGET = 50_000;
const POSITIVE_QUERIES = 40_000;
const NEGATIVE_QUERIES = 40_000;

interface Row { text: string; intent: "add_expense"; slots: Record<string, string> }

function loadRows(): Row[] {
  const base = readFileSync(CORPUS, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { text: string });
  const rows: Row[] = base.map((row) => ({ text: row.text, intent: "add_expense" as const, slots: { crop: "گندم" } }));
  const suffixes = ["", " ثبت کن", " برای زمین شمالی", " نقدی", " با فاکتور", " لطفا", " یادت باشه", " برای فصل جاری"];
  let index = 0;
  while (rows.length < SCALE_TARGET) {
    const source = base[index % base.length];
    rows.push({ text: `${source.text}${suffixes[index % suffixes.length]} ${index}`, intent: "add_expense", slots: { crop: "گندم" } });
    index += 1;
  }
  return rows.slice(0, SCALE_TARGET);
}

function percentile(sorted: Float64Array, p: number): number {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0;
}

interface VariantInput {
  label: string;
  positive: number[];
  negative: number[];
  structureBytes: number;
  keyCount: number;
  note: string;
}

function measure({ label, positive, negative, structureBytes, keyCount, note }: VariantInput) {
  const stats = (values: number[]) => {
    const sorted = Float64Array.from(values).sort();
    const sum = values.reduce((acc, value) => acc + value, 0);
    return {
      meanUs: Number(((sum / Math.max(1, values.length)) * 1000).toFixed(3)),
      p50Us: Number((percentile(sorted, 50) * 1000).toFixed(3)),
      p95Us: Number((percentile(sorted, 95) * 1000).toFixed(3)),
    };
  };
  return {
    label,
    queries: positive.length + negative.length,
    hit: stats(positive),
    miss: stats(negative),
    structureBytes,
    bytesPerKey: Number((structureBytes / Math.max(1, keyCount)).toFixed(2)),
    note,
  };
}

function timeIt(fn: (value: number) => unknown, values: number[]): { times: number[]; checksum: number } {
  const times: number[] = new Array(values.length);
  let checksum = 0;
  for (let index = 0; index < values.length; index += 1) {
    const started = performance.now();
    const result = fn(values[index]);
    times[index] = performance.now() - started;
    checksum += result ? 1 : 0;
  }
  return { times, checksum };
}

function main(): void {
  const rows = loadRows();
  // کلید ماسک‌شده (بدون مبلغ) — همان چیزی که در بسته ذخیره می‌شود
  const keys = rows.map((row) => packKey(row.text));
  const unique = [...new Set(keys)].sort((a, b) => a - b);
  const packBytes = encodePack(rows, { version: "1.0.0", builtFrom: "index-bench", syntheticShare: 1 });
  const pack = openPack(packBytes);
  const bloom = buildBloom(unique);
  const bloomBytes = bloom.byteLength;

  // ساختار ۳: جدول هش open-addressing (mmap-friendly، بدون آبجکت)
  const tableSize = 1 << Math.ceil(Math.log2(Math.max(16, unique.length * 2)));
  const tableKeys = new Uint32Array(tableSize);
  const tableValues = new Uint32Array(tableSize);
  let collisions = 0;
  for (let index = 0; index < unique.length; index += 1) {
    let slot = unique[index] % tableSize;
    while (tableKeys[slot] !== 0) {
      collisions += 1;
      slot = (slot + 1) % tableSize;
    }
    tableKeys[slot] = unique[index] || 1;
    tableValues[slot] = index;
  }
  const openAddress = (hash: number): number => {
    let slot = hash % tableSize;
    for (let guard = 0; guard < tableSize; guard += 1) {
      const current = tableKeys[slot];
      if (current === 0) return -1;
      if (current === hash) return tableValues[slot];
      slot = (slot + 1) % tableSize;
    }
    return -1;
  };

  // ساختار ۴: Map در جاوااسکریپت
  const map = new Map<number, number>();
  unique.forEach((hash, index) => map.set(hash, index));

  // ساختار ۵: دیکشنری رشته‌ای مرتب (پروکسی FST)
  const stringKeys = unique.map((hash) => String(hash));
  const stringBytes = stringKeys.reduce((acc, key) => acc + key.length + 2, 0);

  const positives: number[] = [];
  const negatives: number[] = [];
  for (let index = 0; index < POSITIVE_QUERIES; index += 1) positives.push(unique[index % unique.length]);
  let seed = 12345;
  const unseen: number[] = [];
  while (unseen.length < NEGATIVE_QUERIES) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    if (!map.has(seed)) {
      unseen.push(seed);
      if (bloom.contains(seed)) negatives.push(seed); // تنها false-positive واقعی
    }
  }

  const binarySearch = (hash: number): number => {
    let low = 0;
    let high = unique.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const current = unique[mid];
      if (current === hash) return mid;
      if (current < hash) low = mid + 1;
      else high = mid - 1;
    }
    return -1;
  };

  const noBloom = timeIt(binarySearch, [...positives, ...unseen]);

  // bloom فقط پیش‌فیلتر است: مسیر hit همان جستجوی دودویی است (بدون decode)
  const withBloom = timeIt((hash) => (bloom.contains(hash) ? binarySearch(hash) : -1), [...positives, ...unseen]);
  const bloomOnly = timeIt((hash) => bloom.contains(hash), [...positives, ...unseen]);
  const openAddressTimes = timeIt((hash) => openAddress(hash) >= 0, [...positives, ...unseen]);
  const mapTimes = timeIt((hash) => map.has(hash), [...positives, ...unseen]);
  const stringTimes = timeIt((hash) => {
    let low = 0;
    let high = stringKeys.length - 1;
    const target = String(hash);
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (stringKeys[mid] === target) return mid;
      if (stringKeys[mid] < target) low = mid + 1;
      else high = mid - 1;
    }
    return -1;
  }, [...positives, ...unseen]);

  const negativeIndexes = new Set(unseen.map((_value, index) => index));
  const split = (times: number[]) => ({
    positive: times.slice(0, positives.length),
    negative: times.slice(positives.length),
  });
  void negativeIndexes;

  const results = {
    environment: `Node ${process.version} · ${process.platform}/${process.arch} · sandbox (NOT an Android device)`,
    corpusKeys: unique.length,
    queries: { positive: positives.length, negative: unseen.length },
    pack: {
      format: pack.manifest.format,
      bytes: packBytes.byteLength,
      bloomBytes: pack.manifest.bloomBytes,
      bloomBitsPerKey: pack.manifest.bloomBitsPerKey,
      bloomHashCount: pack.manifest.bloomHashCount,
      estimatedFalsePositiveRate: pack.manifest.estimatedFalsePositiveRate,
      measuredFalsePositiveRate: Number((negatives.length / unseen.length).toFixed(6)),
    },
    collision: { probes: collisions, loadFactor: Number((unique.length / tableSize).toFixed(3)), tableSize },
    variants: [
      { ...measure({ label: "sorted-u32 + binary-search (فرمت v1، بدون bloom)", ...split(noBloom.times), structureBytes: unique.length * 4, keyCount: unique.length, note: "بدون RAM اضافی؛ mmap کامل" }) },
      { ...measure({ label: "sorted-u32 + bloom + binary-search (بسته v2)", ...split(withBloom.times), structureBytes: unique.length * 4 + bloomBytes, keyCount: unique.length, note: "پیش‌فرض فعلی؛ bloom فقط مسیر miss را کوتاه می‌کند" }) },
      { ...measure({ label: "open-address u32 hash table (mmap، شبیه SQLite)", ...split(openAddressTimes.times), structureBytes: tableSize * 8, keyCount: unique.length, note: "آرایه خام؛ RAM بیشتر، hit و miss تقریباً ثابت" }) },
      { ...measure({ label: "Map<number,number> (heap)", ...split(mapTimes.times), structureBytes: tableSize * 8 + unique.length * 48, keyCount: unique.length, note: "RAM تخمینی؛ سریع‌ترین در V8" }) },
      { ...measure({ label: "sorted strings + binary-search (FST-proxy)", ...split(stringTimes.times), structureBytes: stringBytes, keyCount: unique.length, note: "پروکسی رشته‌ای، نه FST واقعی" }) },
      { ...measure({ label: "bloom-only (پیش‌فیلتر، بدون جستجوی بسته)", ...split(bloomOnly.times), structureBytes: bloomBytes, keyCount: unique.length, note: "سریع‌ترین راه تشخیص «قطعاً نیست»" }) },
    ],
    bloomBitsPerKey: BLOOM_BITS_PER_KEY,
    bloomHashCount: BLOOM_HASH_COUNT,
    honesty: [
      "این اعداد روی Node/Linux x64 گرفته شده‌اند، نه روی گوشی ۶GB.",
      "بنچمارک روی ART/Android Instrumented Test هنوز انجام نشده است؛ قدم بعدی است.",
      "ساختار رشته‌ای فقط پروکسی برای FST است؛ FST واقعی پیاده‌سازی نشده است.",
      "bloom هیچ‌وقت پاسخ درست را رد نمی‌کند؛ فقط جمله‌های ناشناخته را قبل از جستجو رد می‌کند و روی hit کمی سربار دارد.",
    ],
  };
  void pack;
  if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(format(results));
}

main();
