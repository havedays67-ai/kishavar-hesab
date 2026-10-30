import { isValidIranMobile, type UserProfile } from "./profile";

export interface ProfileCheck {
  ok: boolean;
  personalIssue: boolean;
  locationIssue: boolean;
  reasons: string[];
}

const PLACEHOLDER = /^(test|تست|aaa|aaaa|admin|کاربر|نام|نام‌|شهر|استان|منطقه|نامشخص|unknown|null|undefined|\.+|-+)$/i;

function suspicious(value: string): boolean {
  const text = String(value ?? "").trim();
  return !text || text.length < 2 || PLACEHOLDER.test(text) || /^[0-9۰-۹]+$/.test(text) || /(.)\1{3,}/.test(text);
}

/** بررسی سریع و محلی پروفایل؛ تشخیص «خالی/جای‌نگهدار/تکراری» نه اعتبارسنجی هویتی. */
export function checkProfile(profile: UserProfile): ProfileCheck {
  const reasons: string[] = [];
  const personalIssue = suspicious(profile.fullName) || !isValidIranMobile(profile.phone);
  if (suspicious(profile.fullName)) reasons.push("نام و نام خانوادگی کامل نیست.");
  if (!isValidIranMobile(profile.phone)) reasons.push("شمارهٔ موبایل معتبر نیست.");
  const province = String(profile.province ?? "").trim();
  const city = String(profile.city ?? "").trim();
  const locationIssue = suspicious(province) || suspicious(city) || province === city;
  if (!province) reasons.push("استان ثبت نشده است.");
  if (!city) reasons.push("شهر/شهرستان ثبت نشده است.");
  if (province && city && province === city) reasons.push("استان و شهر یکسان نوشته شده‌اند.");
  return { ok: !personalIssue && !locationIssue, personalIssue, locationIssue, reasons };
}
