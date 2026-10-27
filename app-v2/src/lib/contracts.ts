import { toEnglishDigits, toPersianDigits, type JDate } from "./format";
import type { SavedContract } from "./data";

/** شماره قرارداد واقعی: سال جاری + بالاترین شماره موجود + ۱ (بدون تکرار) */
export function nextContractCode(contracts: SavedContract[], year: number): string {
  const used = new Set(
    contracts
      .map((contract) => toEnglishDigits(contract.code))
      .map((code) => {
        const match = /(\d{4})\s*-\s*(\d{1,4})/.exec(code);
        return match ? { year: Number(match[1]), seq: Number(match[2]) } : null;
      })
      .filter((value): value is { year: number; seq: number } => Boolean(value))
      .filter((value) => value.year === year)
      .map((value) => value.seq)
  );
  let sequence = 1;
  while (used.has(sequence)) sequence += 1;
  return toPersianDigits(`${year}-${String(sequence).padStart(3, "0")}`);
}

/** کد پیگیری واقعی: سال + هش پایدار محتوای قرارداد (قابل بازتولید) */
export function contractTrackingCode(input: { code: string; partyName: string; start: JDate; rent: number; area: string }): string {
  const source = `${toEnglishDigits(input.code)}|${input.partyName.trim()}|${input.start.jy}/${input.start.jm}/${input.start.jd}|${Math.round(input.rent)}|${input.area}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `KSH-${hash.toString(36).toUpperCase().padStart(7, "0").slice(-7)}`;
}

export function contractSignatureHash(input: { code: string; role: string; signerName: string; date: string }): string {
  const source = `${input.code}|${input.role}|${input.signerName.trim()}|${input.date}`;
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) hash = ((hash << 5) + hash + source.charCodeAt(index)) >>> 0;
  return hash.toString(16).toUpperCase().padStart(8, "0");
}
