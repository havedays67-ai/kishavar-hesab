/**
 * مدل نمایش قراردادهای کشاورزی — توابع خالص و قابل استفاده در سرور و کلاینت.
 */

/** نمایش تاریخ ISO میلادی به شمسی فارسی؛ در صورت نبود Intl فارسی، ISO برمی‌گردد. */
export function formatJalaliDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const value = iso instanceof Date ? iso : new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeZone: "UTC" }).format(value);
  } catch {
    return String(iso).slice(0, 10);
  }
}

export const CONTRACT_PERSPECTIVE_LABEL: Record<string, string> = {
  lessee: "من مستأجرم (زمین را اجاره می‌کنم)",
  lessor: "من موجرم (زمین را اجاره می‌دهم)",
};

export const CONTRACT_TYPE_LABEL: Record<string, string> = {
  cash: "اجاره نقدی",
  crop_share: "مزارعه (سهم محصول)",
  cash_share: "اجاره نقدی + سهم محصول",
  mosaqat: "مساقات (سهم باغ)",
  partnership: "مشارکت در سود",
};

export function contractTypeLabel(type: string): string {
  return CONTRACT_TYPE_LABEL[type] ?? type;
}

export function perspectiveLabel(perspective: string): string {
  return CONTRACT_PERSPECTIVE_LABEL[perspective] ?? perspective;
}
