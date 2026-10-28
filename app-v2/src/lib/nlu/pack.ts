/**
 * بستهٔ پاسخ (Answer Pack) — فرمت دودویی فشرده + ایندکس هش
 * ------------------------------------------------------------
 * ساختار فایل (Little Endian):
 *   magic "KHPK" (4) | format uint16 | count uint32 | blobLen uint32
 *   count × رکورد: hash uint32 | offset uint32 | length uint8
 *   blob: رشته‌های UTF-8 با قالب «intent|crop|category|unit|docType|direction|role»
 *
 * کلید = هش FNV-1a از «جملهٔ نرمال‌شدهٔ ماسک‌شده» (اعداد با # جایگزین
 * شده‌اند)؛ بنابراین مبلغ هرگز در بسته ذخیره نمی‌شود. مقدار هم فقط
 * برچسب intent/slots است و هیچ عدد مالی ندارد.
 * جستجو با binary search روی آرایهٔ Uint32Array انجام می‌شود؛ هیچ
 * JSON.parse و هیچ ساخت آبجکت سنگینی در مسیر داغ اجرا نمی‌شود.
 */
import { hashKey, sentenceKey } from "./normalizer";
import type { NluIntent, NluSlots } from "./rules";

export const PACK_MAGIC = "KHPK";
export const PACK_FORMAT = 1;
export const MAX_SLOT_VALUE_LENGTH = 48;

export interface PackEntry {
  intent: NluIntent;
  slots: NluSlots;
}

export interface PackManifest {
  format: number;
  version: string;
  count: number;
  bytes: number;
  checksum: string;
  builtFrom: string;
  syntheticShare: number;
}

export interface PackHit extends PackEntry {
  /** هش جملهٔ نرمال‌شده */
  hash: number;
}

const SLOT_ORDER = ["crop", "category", "unit", "docType", "direction", "role"] as const;

export function encodeValue(entry: PackEntry): string {
  const slots = entry.slots ?? {};
  const parts = SLOT_ORDER.map((key) => String(slots[key] ?? "").replace(/[|\n\r]/g, " ").slice(0, MAX_SLOT_VALUE_LENGTH));
  return [entry.intent, ...parts].join("|");
}

export function decodeValue(value: string): PackEntry | null {
  const parts = value.split("|");
  const intent = parts[0] as NluIntent;
  if (!intent) return null;
  const slots: Record<string, string> = {};
  SLOT_ORDER.forEach((key, index) => {
    const slot = parts[index + 1];
    if (slot) slots[key] = slot;
  });
  return { intent, slots: slots as NluSlots };
}

export function packKey(text: string): number {
  return hashKey(sentenceKey(text));
}

export interface PackBuildItem extends PackEntry {
  text: string;
  weight?: number;
}

/** کدگذاری رکوردها؛ کلیدهای تکراری حذف می‌شوند (اولویت: وزن بالاتر). */
export function encodePack(items: PackBuildItem[], _meta: { version: string; builtFrom: string; syntheticShare: number; checksum?: string }): Uint8Array {
  const byHash = new Map<number, { value: string; weight: number }>();
  for (const item of items) {
    const value = encodeValue(item);
    if (!value.trim()) continue;
    // هیچ عددی نباید در مقدار باشد
    if (/\d/.test(value)) continue;
    const hash = packKey(item.text);
    const existing = byHash.get(hash);
    if (!existing || existing.weight < (item.weight ?? 1)) byHash.set(hash, { value, weight: item.weight ?? 1 });
  }
  const entries = [...byHash.entries()].sort((a, b) => a[0] - b[0]);
  const encoder = new TextEncoder();
  const values = entries.map((entry) => encoder.encode(entry[1].value));
  const blobLength = values.reduce((sum, value) => sum + value.length, 0);
  const headerSize = 4 + 2 + 4 + 4;
  const recordSize = 4 + 4 + 1;
  const total = headerSize + entries.length * recordSize + blobLength;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  bytes.set(encoder.encode(PACK_MAGIC), 0);
  view.setUint16(4, PACK_FORMAT, true);
  view.setUint32(6, entries.length, true);
  view.setUint32(10, blobLength, true);
  let blobOffset = 0;
  const blobStart = headerSize + entries.length * recordSize;
  entries.forEach(([hash], index) => {
    const valueBytes = values[index];
    const recordStart = headerSize + index * recordSize;
    view.setUint32(recordStart, hash, true);
    view.setUint32(recordStart + 4, blobStart + blobOffset, true);
    view.setUint8(recordStart + 8, Math.min(255, valueBytes.length));
    bytes.set(valueBytes, blobStart + blobOffset);
    blobOffset += valueBytes.length;
  });
  return new Uint8Array(buffer);
}

export function checksumOf(bytes: Uint8Array): string {
  // FNV-1a 32-bit به‌صورت hex 8 رقمی؛ سبک و بدون crypto
  let hash = 0x811c9dc5;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export interface PackIndex {
  manifest: PackManifest;
  lookup(text: string): PackHit | null;
  lookupByHash(hash: number): PackHit | null;
  /** فقط برای تست/آمار: همهٔ مقادیر ذخیره‌شده (بدون کلید) */
  values(): string[];
}

export function openPack(source: ArrayBuffer | Uint8Array, manifest?: Partial<PackManifest>): PackIndex {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const magic = decoder.decode(bytes.subarray(0, 4));
  if (magic !== PACK_MAGIC) throw new Error("بستهٔ پاسخ معتبر نیست (magic)");
  const format = view.getUint16(4, true);
  if (format !== PACK_FORMAT) throw new Error(`نسخهٔ بسته پشتیبانی نمی‌شود: ${format}`);
  const count = view.getUint32(6, true);
  const headerSize = 14;
  const recordSize = 9;
  const lookupByHash = (hash: number): PackHit | null => {
    let low = 0;
    let high = count - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const start = headerSize + mid * recordSize;
      const current = view.getUint32(start, true);
      if (current === hash) {
        const offset = view.getUint32(start + 4, true);
        const length = view.getUint8(start + 8);
        const value = decoder.decode(bytes.subarray(offset, offset + length));
        const entry = decodeValue(value);
        return entry ? { ...entry, hash } : null;
      }
      if (current < hash) low = mid + 1;
      else high = mid - 1;
    }
    return null;
  };
  const lookup = (text: string): PackHit | null => lookupByHash(packKey(text));
  return {
    manifest: {
      format,
      version: manifest?.version ?? "unknown",
      count,
      bytes: bytes.byteLength,
      checksum: manifest?.checksum ?? checksumOf(bytes),
      builtFrom: manifest?.builtFrom ?? "unknown",
      syntheticShare: manifest?.syntheticShare ?? 0,
    },
    lookup,
    lookupByHash,
    values: () => {
      const out: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const start = headerSize + index * recordSize;
        const offset = view.getUint32(start + 4, true);
        const length = view.getUint8(start + 8);
        out.push(decoder.decode(bytes.subarray(offset, offset + length)));
      }
      return out;
    },
  };
}

export function bytesFromBase64(base64: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  // محیط Node (تست/ساخت)
  const bufferCtor = (globalThis as unknown as { Buffer?: { from: (input: string, encoding: string) => Uint8Array } }).Buffer;
  if (bufferCtor) return new Uint8Array(bufferCtor.from(base64, "base64"));
  throw new Error("base64 decode unavailable");
}

export const PACK_HEADER_BYTES = 14;
export const PACK_RECORD_BYTES = 9;
