/**
 * موتور حسابداری قطعی و قابل تست.
 * قاعده: هیچ عددی از مدل زبانی پذیرفته نمی‌شود مگر این ماژول آن را تأیید کند.
 */
import { normalizeDigits, normalizePersian } from "./money";

export type TxnKind = "income" | "expense";
export type PayMethod = "cash" | "bank" | "credit";
export type ChequeDirection = "issued" | "received";

export interface ValidationIssue {
  field: string;
  code: string;
  message: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  issues: ValidationIssue[];
}

const issue = (field: string, code: string, message: string): ValidationIssue => ({ field, code, message });

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidISODate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function toISODate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(`${input.slice(0, 10)}T00:00:00Z`) : input;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** گرد کردن امن مبالغ تومانی به عدد صحیح نامنفی */
export function toToman(value: unknown): number {
  const n = typeof value === "number" ? value : Number(normalizeDigits(String(value ?? "")).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/* ----------------------------- محاسبات ----------------------------- */

/** بهای تمام‌شده هر واحد (کیلوگرم) */
export function costPerUnit(totalCost: number, yieldUnits: number): number | null {
  if (!Number.isFinite(totalCost) || !Number.isFinite(yieldUnits) || yieldUnits <= 0) return null;
  return totalCost / yieldUnits;
}

/** درآمد هر هکتار */
export function revenuePerHectare(income: number, areaHa: number): number | null {
  if (!Number.isFinite(income) || !Number.isFinite(areaHa) || areaHa <= 0) return null;
  return income / areaHa;
}

/** حاشیه سود = سود ÷ درآمد */
export function grossMargin(income: number, expense: number): number | null {
  if (!Number.isFinite(income) || !Number.isFinite(expense) || income === 0) return null;
  return (income - expense) / income;
}

/** نسبت هزینه به درآمد */
export function costRatio(income: number, expense: number): number | null {
  if (!Number.isFinite(income) || income === 0) return null;
  return expense / income;
}

/** نقطه سربه‌سر به کیلوگرم = هزینه ثابت ÷ (قیمت فروش هر کیلو − هزینه متغیر هر کیلو) */
export function breakEvenKg(fixedCost: number, pricePerKg: number, variableCostPerKg: number): number | null {
  const margin = pricePerKg - variableCostPerKg;
  if (!Number.isFinite(margin) || margin <= 0 || !Number.isFinite(fixedCost) || fixedCost < 0) return null;
  return fixedCost / margin;
}

/** استهلاک خط مستقیم سالانه */
export function depreciationStraightLine(purchasePrice: number, salvageValue: number, usefulLifeYears: number): number {
  const life = Number.isFinite(usefulLifeYears) && usefulLifeYears > 0 ? usefulLifeYears : 1;
  const base = Math.max(0, toToman(purchasePrice) - toToman(salvageValue));
  return Math.round(base / life);
}

export function ageInYears(purchaseDate: string, today: string): number {
  if (!isValidISODate(purchaseDate) || !isValidISODate(today)) return 0;
  const diff = new Date(`${today}T00:00:00Z`).getTime() - new Date(`${purchaseDate}T00:00:00Z`).getTime();
  return Math.max(0, diff / (365.25 * 86_400_000));
}

export interface DepreciationState {
  annual: number;
  accumulated: number;
  bookValue: number;
  remainingYears: number;
  fullyDepreciated: boolean;
}

export function depreciationState(
  purchasePrice: number,
  salvageValue: number,
  usefulLifeYears: number,
  purchaseDate: string,
  today: string,
): DepreciationState {
  const price = Math.max(0, toToman(purchasePrice));
  const salvage = Math.min(price, Math.max(0, toToman(salvageValue)));
  const annual = depreciationStraightLine(price, salvage, usefulLifeYears);
  const years = ageInYears(purchaseDate, today);
  const depreciable = price - salvage;
  const accumulated = Math.min(depreciable, Math.round(annual * years));
  const remainingYears = Math.max(0, (usefulLifeYears || 1) - years);
  return {
    annual,
    accumulated,
    bookValue: price - accumulated,
    remainingYears,
    fullyDepreciated: remainingYears <= 0,
  };
}

/** تعداد روز تا سررسید؛ منفی = گذشته */
export function daysBetween(from: string, to: string): number | null {
  if (!isValidISODate(from) || !isValidISODate(to)) return null;
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

export interface CashPosition {
  cashIn: number;
  cashOut: number;
  creditIn: number;
  creditOut: number;
  net: number;
  liquidityRatio: number | null;
}

export function cashPosition(entries: { kind: TxnKind; method: PayMethod; amount: number }[], dueNext30: number): CashPosition {
  let cashIn = 0;
  let cashOut = 0;
  let creditIn = 0;
  let creditOut = 0;
  for (const e of entries) {
    const amount = Math.max(0, toToman(e.amount));
    if (e.kind === "income") {
      if (e.method === "credit") creditIn += amount;
      else cashIn += amount;
    } else if (e.method === "credit") creditOut += amount;
    else cashOut += amount;
  }
  const net = cashIn - cashOut;
  const obligations = creditOut + Math.max(0, dueNext30);
  return {
    cashIn,
    cashOut,
    creditIn,
    creditOut,
    net,
    liquidityRatio: obligations > 0 ? (cashIn + creditIn) / obligations : null,
  };
}

/* ----------------------------- اعتبارسنجی ----------------------------- */

export interface TransactionInput {
  kind?: string;
  amount?: number;
  date?: string;
  categoryId?: number | null;
  method?: string;
  description?: string;
  party?: string;
  landId?: number | null;
  cropId?: number | null;
}

const MAX_TOMAN = 100_000_000_000_000; // سقف منطقی ۱۰۰ هزار میلیارد تومان

export function validateTransaction(input: TransactionInput, today?: string): ValidationResult<Required<Pick<TransactionInput, "kind" | "amount" | "date" | "method">> & TransactionInput> {
  const issues: ValidationIssue[] = [];
  const kind = input.kind as TxnKind | undefined;
  if (kind !== "income" && kind !== "expense") issues.push(issue("kind", "invalid-kind", "نوع باید درآمد یا هزینه باشد."));

  const amount = toToman(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) issues.push(issue("amount", "amount-positive", "مبلغ باید بزرگ‌تر از صفر باشد."));
  else if (amount > MAX_TOMAN) issues.push(issue("amount", "amount-max", "مبلغ خارج از سقف مجاز است."));

  const date = input.date ?? "";
  if (!isValidISODate(date)) issues.push(issue("date", "date-invalid", "تاریخ باید به شکل YYYY-MM-DD و معتبر باشد."));
  else if (today && isValidISODate(today) && daysBetween(today, date)! > 1) {
    issues.push(issue("date", "date-future", "تاریخ آینده مجاز نیست."));
  }

  const method = (input.method ?? "cash") as PayMethod;
  if (!["cash", "bank", "credit"].includes(method)) issues.push(issue("method", "method-invalid", "روش پرداخت نامعتبر است."));

  if (input.description && input.description.length > 300) issues.push(issue("description", "description-long", "شرح بیش از ۳۰۰ نویسه است."));
  if (input.party && input.party.length > 120) issues.push(issue("party", "party-long", "نام طرف حساب بیش از ۱۲۰ نویسه است."));
  if (kind === "income" && !input.categoryId) issues.push(issue("categoryId", "category-required", "برای درآمد انتخاب دسته الزامی است."));

  return {
    ok: issues.length === 0,
    issues,
    value: { ...input, kind: kind as TxnKind, amount, date, method },
  };
}

export function validateCheque(input: { party?: string; amount?: number; dueDate?: string; direction?: string; bank?: string; serial?: string }): ValidationResult<typeof input> {
  const issues: ValidationIssue[] = [];
  const amount = toToman(input.amount);
  if (!input.party || normalizePersian(input.party).length < 2) issues.push(issue("party", "party-required", "نام طرف حساب الزامی است."));
  if (amount <= 0) issues.push(issue("amount", "amount-positive", "مبلغ چک باید بزرگ‌تر از صفر باشد."));
  if (!input.dueDate || !isValidISODate(input.dueDate)) issues.push(issue("dueDate", "duedate-required", "سررسید معتبر الزامی است."));
  if (input.direction && !["issued", "received"].includes(input.direction)) issues.push(issue("direction", "direction-invalid", "نوع چک نامعتبر است."));
  if (input.serial && !/^[\d\p{L}-]{1,30}$/u.test(normalizeDigits(input.serial))) issues.push(issue("serial", "serial-invalid", "شماره سریال نامعتبر است."));
  return { ok: issues.length === 0, issues, value: { ...input, amount } };
}

export function validateDebt(input: { party?: string; amount?: number; direction?: string; dueDate?: string }): ValidationResult<typeof input> {
  const issues: ValidationIssue[] = [];
  const amount = toToman(input.amount);
  if (!input.party || normalizePersian(input.party).length < 2) issues.push(issue("party", "party-required", "طرف حساب الزامی است."));
  if (amount <= 0) issues.push(issue("amount", "amount-positive", "مبلغ باید بزرگ‌تر از صفر باشد."));
  if (input.direction && !["payable", "receivable"].includes(input.direction)) issues.push(issue("direction", "direction-invalid", "جهت بدهی نامعتبر است."));
  if (input.dueDate && !isValidISODate(input.dueDate)) issues.push(issue("dueDate", "duedate-invalid", "سررسید نامعتبر است."));
  return { ok: issues.length === 0, issues, value: { ...input, amount } };
}

export function validateLabor(input: { workerName?: string; days?: number; dailyWage?: number; date?: string }): ValidationResult<typeof input & { amount: number }> {
  const issues: ValidationIssue[] = [];
  const days = Number(input.days ?? 0);
  const wage = toToman(input.dailyWage);
  if (!input.workerName || normalizePersian(input.workerName).length < 2) issues.push(issue("workerName", "worker-required", "نام کارگر الزامی است."));
  if (!Number.isFinite(days) || days <= 0) issues.push(issue("days", "days-positive", "تعداد روز باید بیشتر از صفر باشد."));
  if (days > 365) issues.push(issue("days", "days-max", "تعداد روز نامعتبر است."));
  if (wage <= 0) issues.push(issue("dailyWage", "wage-positive", "دستمزد روزانه باید بیشتر از صفر باشد."));
  if (input.date && !isValidISODate(input.date)) issues.push(issue("date", "date-invalid", "تاریخ نامعتبر است."));
  return { ok: issues.length === 0, issues, value: { ...input, dailyWage: wage, amount: Math.round(Math.max(0, days) * wage) } };
}

export function validateInventoryMove(input: { quantity?: number; available?: number; kind?: string; unitCost?: number }): ValidationResult<{ quantity: number; kind: "in" | "out"; unitCost: number }> {
  const issues: ValidationIssue[] = [];
  const quantity = Number(input.quantity ?? 0);
  const kind = input.kind === "in" ? "in" : "out";
  if (!Number.isFinite(quantity) || quantity <= 0) issues.push(issue("quantity", "quantity-positive", "مقدار باید بیشتر از صفر باشد."));
  if (kind === "out" && Number.isFinite(input.available) && quantity > Number(input.available)) {
    issues.push(issue("quantity", "stock-insufficient", "موجودی کافی نیست."));
  }
  const unitCost = Math.max(0, toToman(input.unitCost));
  return { ok: issues.length === 0, issues, value: { quantity, kind, unitCost } };
}

/* ----------------------------- Undo ----------------------------- */

export type MutationKind = "transaction" | "cheque" | "debt" | "labor" | "inventory_move" | "land" | "crop" | "task";

export interface MutationLogEntry {
  id: number;
  kind: MutationKind;
  targetId: number;
  action: "create" | "update" | "delete";
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  at: string;
  actor: "user" | "assistant";
}

/** عملیات معکوس لازم برای Undo — بدون حدس */
export function inverseAction(entry: MutationLogEntry): { action: "create" | "update" | "delete"; payload: Record<string, unknown> | null } {
  if (entry.action === "create") return { action: "delete", payload: null };
  if (entry.action === "delete") return { action: "create", payload: entry.before ?? null };
  return { action: "update", payload: entry.before ?? null };
}

/** ثبت هر عملیات در لاگ و قابل واگرد تا ۳۰ مرحله */
export function canUndo(log: MutationLogEntry[], now: string, maxMinutes = 60 * 24): boolean {
  if (!log.length) return false;
  const last = log[log.length - 1];
  const minutes = (new Date(now).getTime() - new Date(last.at).getTime()) / 60_000;
  return minutes >= 0 && minutes <= maxMinutes;
}

/* ----------------------------- KPI ----------------------------- */

export interface LedgerEntryLike {
  kind: TxnKind;
  amount: number;
  method?: PayMethod;
  date: string;
  landId?: number | null;
  categoryName?: string | null;
}

export interface KpiSummary {
  income: number;
  expense: number;
  profit: number;
  margin: number | null;
  count: number;
  creditShare: number | null;
  topCategory: { name: string; amount: number } | null;
}

export function computeKpis(entries: LedgerEntryLike[]): KpiSummary {
  let income = 0;
  let expense = 0;
  let credit = 0;
  const byCategory = new Map<string, number>();
  for (const e of entries) {
    const amount = Math.max(0, toToman(e.amount));
    if (e.kind === "income") income += amount;
    else {
      expense += amount;
      const name = e.categoryName ?? "بدون دسته";
      byCategory.set(name, (byCategory.get(name) ?? 0) + amount);
    }
    if (e.method === "credit") credit += amount;
  }
  const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    income,
    expense,
    profit: income - expense,
    margin: grossMargin(income, expense),
    count: entries.length,
    creditShare: income + expense > 0 ? credit / (income + expense) : null,
    topCategory: topCategory ? { name: topCategory[0], amount: topCategory[1] } : null,
  };
}

/** سهم هر زمین از سود و هزینه هر هکتار */
export function landProfitability(
  lands: { id: number; name: string; areaHa: number }[],
  entries: LedgerEntryLike[],
): { landId: number; name: string; income: number; expense: number; profit: number; costPerHa: number | null; incomePerHa: number | null }[] {
  return lands.map((land) => {
    const rows = entries.filter((e) => e.landId === land.id);
    const income = rows.filter((e) => e.kind === "income").reduce((a, e) => a + Math.max(0, toToman(e.amount)), 0);
    const expense = rows.filter((e) => e.kind === "expense").reduce((a, e) => a + Math.max(0, toToman(e.amount)), 0);
    return {
      landId: land.id,
      name: land.name,
      income,
      expense,
      profit: income - expense,
      costPerHa: land.areaHa > 0 ? expense / land.areaHa : null,
      incomePerHa: land.areaHa > 0 ? income / land.areaHa : null,
    };
  });
}

/** دسته‌بندی سررسید چک‌ها برای هشدار آفلاین */
export function chequeBuckets(
  cheques: { amount: number; dueDate: string; status: string; direction: ChequeDirection }[],
  today: string,
): { overdue: number; next7: number; next30: number; issuedTotal: number; receivedTotal: number } {
  let overdue = 0;
  let next7 = 0;
  let next30 = 0;
  let issuedTotal = 0;
  let receivedTotal = 0;
  for (const c of cheques) {
    if (c.status !== "pending") continue;
    const amount = Math.max(0, toToman(c.amount));
    if (c.direction === "issued") issuedTotal += amount;
    else receivedTotal += amount;
    const d = daysBetween(today, c.dueDate);
    if (d === null) continue;
    if (d < 0) overdue += amount;
    else if (d <= 7) next7 += amount;
    else if (d <= 30) next30 += amount;
  }
  return { overdue, next7, next30, issuedTotal, receivedTotal };
}
