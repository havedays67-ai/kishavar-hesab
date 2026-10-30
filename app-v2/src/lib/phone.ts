/** نرمال‌سازی و اعتبارسنجی شمارهٔ موبایل ایران؛ مستقل از رابط کاربری. */
import { toEnglishDigits } from "./format";

export function normalizePhone(value: string): string {
  const digits = toEnglishDigits(value).replace(/\D/g, "");
  if (digits.startsWith("0098")) return `0${digits.slice(4)}`;
  if (digits.startsWith("98") && digits.length > 10) return `0${digits.slice(2)}`;
  if (digits.startsWith("9") && digits.length === 10) return `0${digits}`;
  return digits;
}

export function isValidIranMobile(value: string): boolean {
  return /^09\d{9}$/.test(normalizePhone(value));
}
