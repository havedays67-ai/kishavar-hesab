/**
 * نقش کاربر: فهرست آماده + گزینهٔ «سایر» با ورودی آزاد
 * ----------------------------------------------------
 * اگر کاربر «سایر» را بزند، کادر نوشتن باز می‌شود و هر نقش دلخواهی
 * (مثلاً «دامدار»، «کارشناس بیمهٔ محصول»، «مسئول خرید شرکت») ثبت می‌شود.
 *
 * قاعده: نقش ذخیره‌شده همان متنی است که کاربر می‌بیند؛ مقدار پیش‌فرض دستگاه
 * («کشاورز / مدیر مزرعه») به‌عنوان نقش سفارشی حساب نمی‌شود.
 */
export const PROFILE_ROLE_OTHER = "سایر";

/** نقش‌های آمادهٔ نمایش؛ «سایر» همیشه آخرین گزینه است. */
export const PROFILE_ROLE_CHOICES = [
  "کشاورز",
  "باغدار",
  "مدیر مزرعه",
  "مالک زمین",
  "مستاجر زمین",
  "کارشناس خرید محصول",
  "کشت و صنعت",
  "شرکت تعاونی",
  PROFILE_ROLE_OTHER,
] as const;

/**
 * نقش قدیمی ذخیره‌شده (پیش‌فرض نسخه‌های قبل) با هیچ گزینه‌ای برابر نبود و
 * در رابط کاربری به‌اشتباه «سایر» و کارت نوشتن باز نشان می‌داد.
 */
export const LEGACY_ROLE_MAP: Record<string, string> = {
  "کشاورز / مدیر مزرعه": "کشاورز",
};

export function normalizeStoredRole(role: string): string {
  const value = (role ?? "").trim();
  return LEGACY_ROLE_MAP[value] ?? value;
}

export const CUSTOM_ROLE_MAX = 40;
export const CUSTOM_ROLE_MIN = 2;

/** آیا نقش ذخیره‌شده از فهرست آماده نیست (یعنی سفارشی است)؟ */
export function isCustomRole(role: string): boolean {
  const value = normalizeStoredRole(role);
  if (!value) return false;
  return !PROFILE_ROLE_CHOICES.some((choice) => choice !== PROFILE_ROLE_OTHER && choice === value);
}

/** چپ‌چین بودن انتخاب: آیا این گزینه در فهرست، انتخاب‌شده است؟ */
export function isRoleSelected(choice: string, role: string): boolean {
  const value = normalizeStoredRole(role);
  if (choice === PROFILE_ROLE_OTHER) return isCustomRole(value);
  return value === choice;
}

export interface CustomRoleValidation {
  ok: boolean;
  value: string;
  error: string | null;
}

/** اعتبارسنجی نقش سفارشی؛ هیچ مقدار خالی/عددی/بیش‌ازحد بلندی پذیرفته نمی‌شود. */
export function validateCustomRole(raw: string): CustomRoleValidation {
  const value = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, CUSTOM_ROLE_MAX);
  if (!value) return { ok: false, value, error: "نقش خود را بنویسید." };
  if (value.length < CUSTOM_ROLE_MIN) return { ok: false, value, error: "نقش باید حداقل ۲ حرف باشد." };
  if (/^[\d۰-۹\s]+$/.test(value)) return { ok: false, value, error: "نقش نمی‌تواند فقط عدد باشد." };
  if (/[<>{}]/.test(value)) return { ok: false, value, error: "از نویسه‌های غیرمجاز استفاده نکنید." };
  if (value === PROFILE_ROLE_OTHER) return { ok: false, value, error: "به‌جای «سایر» نقش واقعی خود را بنویسید." };
  return { ok: true, value, error: null };
}

export const PROFILE_ROLE_VERSION = "1.0.0";
