/**
 * کشاورزحساب — ماژول اجاره‌ی ملک کشاورزی و هوش تحلیلی
 * همه محاسبات قطعی و از دفتر کل است؛ هیچ عددی حدس زده نمی‌شود.
 */
import {
  addDays,
  addMonths,
  cashOf,
  lastMonths,
  profitOf,
  codeOf,
  faDigits,
  fmt,
  formatJalali,
  invoiceRemaining,
  parseDate,
  postEntry,
  todayISO,
  toJalali,
  type DB,
  type Lease,
  type RentPayment,
  type RentScheduleRow,
  type SignatureRecord,
} from "./engine";

/* --------------------------------- اجاره --------------------------------- */

export const LEASE_KIND_LABEL: Record<Lease["kind"], string> = {
  cash: "اجاره نقدی",
  share: "مزارعه (سهم محصول)",
  mixed: "اجاره + سهم محصول",
};

export const LEASE_STATUS_LABEL: Record<Lease["status"], string> = {
  draft: "پیش‌نویس (امضا نشده)",
  active: "فعال",
  ended: "پایان‌یافته",
  canceled: "فسخ‌شده",
};

export const LEASE_REQUIRED = [
  "عنوان ملک / زمین",
  "موجر (مالک)",
  "مستاجر",
  "مدت (تاریخ شروع و پایان)",
  "تاریخ شروع",
  "تاریخ پایان",
  "مبلغ اجاره یا سهم محصول",
] as const;

export const LEASE_ROLE_LABEL: Record<"tenant" | "owner", string> = {
  tenant: "زمین را اجاره می‌کنم (من مستاجرم)",
  owner: "زمین را اجاره می‌دهم (من موجرم)",
};

export function leaseRole(lease: Lease): "tenant" | "owner" {
  return lease.role === "owner" ? "owner" : "tenant";
}

/** نام طرفین از دید کسب‌وکار ما — طرفی که «ما» هستیم همیشه «کسب‌وکار من» نمایش داده می‌شود. */
export function leaseParties(db: DB, lease: Lease): { owner: string; tenant: string; counterparty: string; role: "tenant" | "owner" } {
  const role = leaseRole(lease);
  const name = (id: number) => (id ? db.contacts.find((c) => c.id === id)?.name ?? "—" : "کسب‌وکار من");
  const owner = role === "tenant" ? name(lease.landlordId) : "کسب‌وکار من";
  const tenant = role === "owner" ? name(lease.tenantId) : "کسب‌وکار من";
  return { owner, tenant, counterparty: role === "tenant" ? owner : tenant, role };
}

export function leaseTotalRent(lease: Lease): number {
  return lease.schedule.reduce((s, r) => s + r.amount, 0);
}

export function leasePaid(lease: Lease, rents: RentPayment[]): number {
  return rents.filter((r) => r.leaseId === lease.id).reduce((s, r) => s + r.amount, 0);
}

export function leaseRemaining(lease: Lease, rents: RentPayment[]): number {
  return Math.max(0, leaseTotalRent(lease) - leasePaid(lease, rents));
}

export function leaseNextDue(lease: Lease): RentScheduleRow | null {
  const pending = lease.schedule.filter((r) => !r.paid).sort((a, b) => (a.due < b.due ? -1 : 1));
  return pending[0] ?? null;
}

export function leaseIsOverdue(lease: Lease): boolean {
  const next = leaseNextDue(lease);
  return Boolean(next && next.due < todayISO() && lease.status === "active");
}

export function leaseSignatures(signatures: SignatureRecord[], leaseId: number): SignatureRecord[] {
  return signatures.filter((s) => s.context === "lease" && s.refId === leaseId);
}

export function leaseSignedBoth(lease: Lease, signatures: SignatureRecord[]): { landlord: boolean; tenant: boolean; complete: boolean } {
  const list = leaseSignatures(signatures, lease.id);
  const landlord = list.some((s) => s.role === "موجر" || s.role === "مالک");
  const tenant = list.some((s) => s.role === "مستاجر");
  return { landlord, tenant, complete: landlord && tenant };
}

/** ساخت جدول اقساط اجاره بر پایه‌ی مدت و دوره‌ی پرداخت */
export function buildLeaseSchedule(input: {
  start: string;
  end: string;
  total: number;
  cycle: Lease["cycle"];
}): RentScheduleRow[] {
  const total = Math.max(0, Math.round(input.total));
  if (total <= 0) return [];
  const start = parseDate(input.start);
  const end = parseDate(input.end);
  const rows: RentScheduleRow[] = [];
  const monthsBetween = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
  const stepMonths = input.cycle === "monthly" ? 1 : input.cycle === "seasonal" ? 3 : input.cycle === "annual" ? 12 : monthsBetween;
  const count = input.cycle === "once" ? 1 : Math.max(1, Math.ceil(monthsBetween / stepMonths));
  const base = Math.floor(total / count);
  for (let i = 0; i < count; i += 1) {
    rows.push({
      no: i + 1,
      due: addMonths(input.start, i * stepMonths),
      amount: i === count - 1 ? total - base * (count - 1) : base,
      paid: false,
    });
  }
  return rows;
}

export function validateLeaseInput(input: {
  title: string;
  landlordId: number | null;
  tenantId: number | null;
  start: string;
  end: string;
  kind: Lease["kind"];
  total: number;
  sharePercent: number;
}): string | null {
  if (!input.title.trim()) return "عنوان ملک یا زمین را وارد کنید.";
  if (!input.landlordId) return "موجر (مالک) را انتخاب کنید.";
  if (!input.tenantId) return "مستاجر را انتخاب کنید.";
  if (input.landlordId === input.tenantId) return "موجر و مستاجر نمی‌توانند یک نفر باشند.";
  if (!input.start || !input.end) return "تاریخ شروع و پایان قرارداد لازم است.";
  if (input.end <= input.start) return "تاریخ پایان باید بعد از شروع باشد.";
  if (input.kind === "share" && (input.sharePercent <= 0 || input.sharePercent >= 100)) return "در مزارعه سهم باید بین ۱ تا ۹۹ درصد و به‌صورت کسری از محصول باشد.";
  if (input.kind !== "share" && input.total <= 0) return "مبلغ اجاره باید بزرگ‌تر از صفر باشد.";
  return null;
}

/** متن قرارداد برای بازبینی/کپی — شامل ارکان حقوقی ضروری و وضعیت امضا */
export function leaseContractText(db: DB, leaseId: number): string {
  const lease = db.leases.find((l) => l.id === leaseId);
  if (!lease) return "";
  const parties = leaseParties(db, lease);
  const landlord = parties.owner;
  const tenant = parties.tenant;
  const paid = leasePaid(lease, db.rents);
  const remaining = leaseRemaining(lease, db.rents);
  const sig = leaseSignedBoth(lease, db.signatures);
  return [
    `قرارداد ${LEASE_KIND_LABEL[lease.kind]} — ${lease.title}`,
    `تاریخ تنظیم: ${formatJalali(lease.createdAt.slice(0, 10), "long")}`,
    "",
    `ماده ۱ — طرفین: موجر/مالک: ${landlord} و مستاجر/مزارع: ${tenant} (${LEASE_ROLE_LABEL[leaseRole(lease)]}).`,
    `ماده ۲ — مورد اجاره: ${lease.title}${lease.plate ? `، پلاک ${lease.plate}` : ""}${lease.location ? `، واقع در ${lease.location}` : ""}${lease.area ? `، به مساحت ${faDigits(lease.area)} هکتار` : ""}.`,
    `ماده ۳ — مدت: از ${formatJalali(lease.start)} تا ${formatJalali(lease.end)} (${faDigits(lease.months)} ماه).`,
    `ماده ۴ — مال‌الاجاره: ${lease.kind === "share" ? `${faDigits(lease.sharePercent)}٪ سهم محصول` : fmt(leaseTotalRent(lease))}${lease.kind === "mixed" ? ` به‌همراه ${faDigits(lease.sharePercent)}٪ سهم محصول` : ""}؛ نحوه پرداخت: ${lease.cycle === "monthly" ? "ماهانه" : lease.cycle === "seasonal" ? "فصلی" : lease.cycle === "annual" ? "سالانه" : "یک‌جا"} با ${faDigits(lease.schedule.length)} قسط.`,
    `ماده ۵ — ودیعه: ${lease.deposit > 0 ? `${fmt(lease.deposit)} (قابل استرداد پس از تسویه و تحویل زمین)` : "تعیین نشده"}.`,
    `ماده ۶ — حقابه: ${lease.waterShare || "بر اساس عرف محل"}؛ هزینه‌ی آب و برق و پمپ بر عهده‌ی ${lease.waterPaidBy}.`,
    `ماده ۷ — تعهدات کشاورز: استفاده صرفاً برای کشت ${lease.crop || "زراعت"}، عدم تغییر کاربری، حفظ حدود و تجهیزات، نگهداری چاه و آبیاری و پرداخت هزینه‌های جاری کشت.`,
    `ماده ۸ — تعهدات موجر: تسلیم عین مستاجره در ابتدای مدت، تأمین حقابه توافق‌شده، عدم مزاحمت در بهره‌برداری و پرداخت عوارض اصل ملک (مگر توافق خلاف آن).`,
    `ماده ۹ — فسخ: در صورت عدم پرداخت اجاره در سررسید یا تغییر کاربری غیرمجاز، موجر حق فسخ دارد.`,
    `ماده ۱۰ — شاهدها: ${lease.witnesses || "—"}.`,
    `وضعیت امضا — موجر: ${sig.landlord ? "امضا شده" : "امضا نشده"} · مستاجر: ${sig.tenant ? "امضا شده" : "امضا نشده"}`,
    `وضعیت پرداخت: پرداخت‌شده ${fmt(paid)} از ${fmt(leaseTotalRent(lease))} — مانده ${fmt(remaining)}.`,
    "",
    "این متن در اپ کشاورزحساب تولید شده و سند مالی رسمی یا تأییدیه‌ی دفتر اسناد رسمی نیست؛ برای موارد حقوقی، ثبت رسمی و مشورت حقوقی لازم است.",
  ].join("\n");
}

/* -------------------------------- هوش تحلیلی ------------------------------- */

export type InsightSeverity = "critical" | "warning" | "info" | "good";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  action?: { label: string; sheet?: string; tab?: string; fields?: Record<string, string> };
  amount?: number;
}

/** تحلیل قطعی وضعیت کسب‌وکار: همه اعداد از موتور حسابداری، بدون پیش‌بینی ساختگی */
export function businessInsights(db: DB): Insight[] {
  const out: Insight[] = [];
  const today = todayISO();
  const cash = db.accounts
    .filter((a) => a.isCash)
    .reduce((s, a) => s + db.entries.reduce((t, e) => t + e.lines.reduce((u, l) => (l.accountId === a.id ? u + l.debit - l.credit : u), 0), 0), 0);

  const openSales = db.invoices.filter((i) => i.type === "sale" && invoiceRemaining(i) > 0);
  const overdue = openSales.filter((i) => i.due < today);
  const overdueAmount = overdue.reduce((s, i) => s + invoiceRemaining(i), 0);
  if (overdue.length) {
    out.push({
      id: "overdue-receivables",
      severity: overdueAmount > 50_000_000 ? "critical" : "warning",
      title: `${faDigits(overdue.length)} فاکتور معوق به مبلغ ${fmt(overdueAmount)}`,
      detail: "مطالبات سررسیدگذشته، نقدینگی را قفل می‌کند. اول از بزرگ‌ترین بدهکار پیگیری کنید.",
      amount: overdueAmount,
      action: { label: "دیدن بدهکاران", tab: "reports" },
    });
  }

  const pendingCheques = db.cheques.filter((c) => c.status === "pending");
  const dueCheques = pendingCheques.filter((c) => c.direction === "paid" && c.due <= addDays(today, 10));
  if (dueCheques.length) {
    const sum = dueCheques.reduce((s, c) => s + c.amount, 0);
    out.push({
      id: "cheques-due",
      severity: sum > cash ? "critical" : "warning",
      title: `${faDigits(dueCheques.length)} چک پرداختی تا ۱۰ روز آینده (${fmt(sum)})`,
      detail: sum > cash ? `این مبلغ از موجودی نقد (${fmt(cash)}) بیشتر است؛ برنامه‌ی تأمین وجه لازم است.` : "موجودی نقد برای پوشش این چک‌ها در حال حاضر کافی است.",
      amount: sum,
      action: { label: "چک‌ها", tab: "more", fields: { open: "cheques-list" } },
    });
  }

  const activeLeases = db.leases.filter((l) => l.status === "active");
  for (const lease of activeLeases) {
    const next = leaseNextDue(lease);
    if (!next) continue;
    const days = Math.round((parseDate(next.due).getTime() - parseDate(today).getTime()) / 86_400_000);
    if (days <= 15) {
      out.push({
        id: `lease-due-${lease.id}`,
        severity: days < 0 ? "critical" : "warning",
        title: `اجاره «${lease.title}» ${days < 0 ? `${faDigits(Math.abs(days))} روز معوق` : `${faDigits(days)} روز تا سررسید`}`,
        detail: `قسط ${faDigits(next.no)} به مبلغ ${fmt(next.amount)} — ${days < 0 ? "پرداخت را ثبت کنید یا با موجر توافق تمدید بگیرید." : "برای ثبت پرداخت آماده است."}`,
        amount: next.amount,
        action: { label: "پرداخت اجاره", tab: "more", fields: { open: "lease-pay", id: String(lease.id) } },
      });
    }
    const sig = leaseSignedBoth(lease, db.signatures);
    if (!sig.complete) {
      out.push({
        id: `lease-sign-${lease.id}`,
        severity: "warning",
        title: `قرارداد اجاره «${lease.title}» کامل امضا نشده`,
        detail: `موجر: ${sig.landlord ? "امضا شده" : "امضا نشده"} · مستاجر: ${sig.tenant ? "امضا شده" : "امضا نشده"}. ثبت امضای هر دو طرف، ریسک اختلاف را کم می‌کند.`,
        action: { label: "ثبت امضا", tab: "more", fields: { open: "lease-sign", id: String(lease.id) } },
      });
    }
  }

  const low = db.products.filter((p) => p.stock <= p.min);
  if (low.length) {
    out.push({
      id: "stock-low",
      severity: "warning",
      title: `${faDigits(low.length)} قلم به حد سفارش رسیده`,
      detail: `${low.map((p) => p.name).join("، ")} — برای جلوگیری از توقف کار، سفارش را ثبت کنید.`,
      action: { label: "انبار", tab: "reports" },
    });
  }

  const budgetOver = db.budgets.length
    ? db.budgets
        .map((b) => {
          const yearRange = { start: `${toJalali(new Date()).jy}-01-01`, end: today };
          void yearRange;
          return b;
        })
        .filter(() => false)
    : [];
  void budgetOver;

  const trial = db.entries.length
    ? (() => {
        let debit = 0;
        let credit = 0;
        for (const e of db.entries) for (const l of e.lines) {
          debit += l.debit;
          credit += l.credit;
        }
        return { debit, credit };
      })()
    : { debit: 0, credit: 0 };
  if (trial.debit !== trial.credit) {
    out.push({ id: "trial", severity: "critical", title: "دفتر کل نامتوازن است", detail: "جمع بدهکار و بستانکار برابر نیست؛ پیش از ادامه، اسناد را بررسی کنید.", amount: trial.debit - trial.credit });
  }

  const duplicates = findDuplicateExpenses(db);
  if (duplicates.length) {
    out.push({
      id: "duplicates",
      severity: "info",
      title: `${faDigits(duplicates.length)} ثبت مشکوک به تکرار`,
      detail: "سندهایی با شرح و مبلغ یکسان در یک روز؛ اگر اشتباه است واگرد کنید.",
      action: { label: "دفتر", tab: "ledger" },
    });
  }


  // تحلیل همیشگی: سود ماه، پوشش نقدینگی، بزرگ‌ترین بدهکار
  const months = lastMonths(2);
  if (months.length === 2) {
    const prev = profitOf(db, { start: months[0].start, end: months[0].end });
    const cur = profitOf(db, { start: months[1].start, end: months[1].end });
    if (prev !== 0 || cur !== 0) {
      const diff = cur - prev;
      out.push({
        id: "profit-trend",
        severity: diff < 0 ? "warning" : "good",
        title: `سود ${months[1].label}: ${fmt(cur)} (${diff >= 0 ? "بهبود" : "کاهش"} ${fmt(Math.abs(diff))} نسبت به ${months[0].label})`,
        detail: diff < 0 ? "برای برگشت روند، هزینه‌های غیرضروری و مطالبات معوق را بررسی کنید." : "روند سود نسبت به ماه قبل بهتر شده است؛ همین مسیر را ادامه دهید.",
        amount: cur,
      });
    }
  }
  const obligations = db.cheques.filter((c) => c.status === "pending" && c.direction === "paid").reduce((s, c) => s + c.amount, 0) + db.leases.filter((l) => l.status === "active").reduce((s, l) => s + (leaseNextDue(l)?.amount ?? 0), 0);
  out.push({
    id: "cash-coverage",
    severity: cash <= 0 && obligations > 0 ? "critical" : obligations > cash ? "warning" : "good",
    title: `نقدینگی ${fmt(cash)} و تعهدات نزدیک ${fmt(obligations)}`,
    detail: obligations > cash ? "تعهدات پیش‌رو از موجودی نقد بیشتر است؛ وصول مطالبات یا تأمین وجه را در برنامه بگذارید." : "موجودی نقد برای پوشش تعهدات شناخته‌شده کافی است.",
    amount: cash,
  });
  const topDebtor = db.contacts
    .map((c) => ({ name: c.name, net: db.invoices.filter((i) => i.contactId === c.id && i.type === "sale").reduce((s, i) => s + invoiceRemaining(i), 0) }))
    .sort((a, b) => b.net - a.net)[0];
  if (topDebtor && topDebtor.net > 0) {
    out.push({ id: "top-debtor", severity: "info", title: `بیشترین طلب از ${topDebtor.name}: ${fmt(topDebtor.net)}`, detail: "برای وصول، صورتحساب طرف‌حساب را بگیرید و پیگیری را ثبت کنید.", amount: topDebtor.net, action: { label: "گزارش بدهکاران", tab: "reports" } });
  }
  if (!db.entries.length) {
    out.push({ id: "start", severity: "info", title: "اولین سند را ثبت کنید", detail: "با دکمه + یک هزینه یا درآمد ثبت کنید؛ یا از «بیشتر» داده نمونه را بارگذاری کنید.", action: { label: "ثبت هزینه", tab: "home", fields: { open: "expense" } } });
  } else if (!out.length) {
    out.push({ id: "healthy", severity: "good", title: "همه‌چیز مرتب است", detail: "سررسید بحرانی، مطالبات معوق، کمبود انبار یا قرارداد امضانشده‌ای ندارید." });
  }

  return out.slice(0, 8);
}

/** تشخیص ثبت تکراری: شرح یکسان + مبلغ یکسان + تاریخ یکسان */
export function findDuplicateExpenses(db: DB): { date: string; desc: string; ids: number[] }[] {
  const map = new Map<string, { date: string; desc: string; ids: number[] }>();
  for (const entry of db.entries) {
    const total = entry.lines.reduce((s, l) => s + l.debit, 0);
    const key = `${entry.date}|${entry.desc.trim()}|${total}`;
    const prev = map.get(key);
    if (prev) prev.ids.push(entry.id);
    else map.set(key, { date: entry.date, desc: entry.desc, ids: [entry.id] });
  }
  return [...map.values()].filter((v) => v.ids.length > 1);
}

export interface SmartSuggestion {
  id: string;
  label: string;
  sheet?: string;
  tab?: string;
  fields?: Record<string, string>;
}

/** پیشنهاد اقدام بعدی برای کارهای روزمره (قاعده‌محور و قابل توضیح) */
export function smartSuggestions(db: DB): SmartSuggestion[] {
  const list: SmartSuggestion[] = [];
  const out: SmartSuggestion[] = [];
  if (!db.contacts.length) out.push({ id: "contact", label: "افزودن بدهکار / بستانکار", sheet: "debtor-add" });
  if (!db.invoices.length) out.push({ id: "sale", label: "صدور اولین فاکتور فروش", sheet: "sale" });
  if (!db.leases.length) out.push({ id: "lease", label: "ثبت قرارداد اجاره زمین", sheet: "lease-new" });
  if (!db.assets.length) out.push({ id: "asset", label: "ثبت دارایی و استهلاک", sheet: "asset" });
  if (!db.budgets.length) out.push({ id: "budget", label: "تعیین بودجه سالانه", sheet: "budget" });
  if (!db.products.length) out.push({ id: "product", label: "ثبت کالا و نهاده", sheet: "product" });
  if (!db.entries.length) out.push({ id: "expense", label: "ثبت اولین هزینه", sheet: "expense" });
  if (!db.projects.length) out.push({ id: "project", label: "ثبت زمین کشاورزی", sheet: "project" });
  if (!db.contacts.some((c) => c.kind === "supplier" || c.kind === "both")) out.push({ id: "supplier", label: "افزودن تأمین‌کننده", sheet: "creditor-add" });
  void list;
  return out.slice(0, 4);
}

/** جمع‌بندی آماری برای گزارش اجاره */
export function leaseStats(db: DB): { active: number; totalRent: number; paid: number; remaining: number; overdue: number; unsigned: number } {
  const active = db.leases.filter((l) => l.status === "active");
  const totalRent = active.reduce((s, l) => s + leaseTotalRent(l), 0);
  const paid = active.reduce((s, l) => s + leasePaid(l, db.rents), 0);
  const overdue = active.filter((l) => leaseIsOverdue(l)).reduce((s, l) => {
    const next = leaseNextDue(l);
    return s + (next ? next.amount : 0);
  }, 0);
  const unsigned = active.filter((l) => !leaseSignedBoth(l, db.signatures).complete).length;
  return { active: active.length, totalRent, paid, remaining: Math.max(0, totalRent - paid), overdue, unsigned };
}

/** ثبت پرداخت اجاره: سند دوطرفه (هزینه اجاره / حساب پرداخت) + به‌روزرسانی قسط */
