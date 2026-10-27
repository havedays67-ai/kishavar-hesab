/**
 * کشاورزحساب — موتور آفلاین (قطعیت‌محور)
 * تمام محاسبه‌های پول، مالیات، مانده، استهلاک و گزارش‌ها اینجاست.
 * هیچ لایه‌ی دیگری (UI یا زبان طبیعی) مجاز به محاسبه‌ی مالی نیست.
 */

/* ------------------------------- انواع داده ------------------------------- */

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense" | "contra";

export interface Account {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  isCash?: boolean;
}

export interface Contact {
  id: number;
  name: string;
  kind: "customer" | "supplier" | "both" | "worker" | "partner";
  phone?: string;
}

export interface Line {
  accountId: number;
  debit: number;
  credit: number;
}

export interface Entry {
  id: number;
  date: string;
  desc: string;
  source: "manual" | "sale" | "purchase" | "payment" | "cheque" | "loan" | "opening" | "depreciation";
  contactId?: number | null;
  projectId?: number | null;
  lines: Line[];
}

export interface InvoiceItem {
  desc: string;
  qty: number;
  price: number;
  productId?: number | null;
}

export interface Invoice {
  id: number;
  no: string;
  type: "sale" | "purchase";
  contactId: number;
  date: string;
  due: string;
  items: InvoiceItem[];
  discount: number;
  taxRate: number;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
}

export interface Payment {
  id: number;
  date: string;
  direction: "in" | "out";
  contactId: number | null;
  accountId: number;
  amount: number;
  method: "cash" | "bank" | "cheque";
  invoiceId?: number | null;
  note?: string;
}

export interface Cheque {
  id: number;
  direction: "received" | "paid";
  serial: string;
  bank: string;
  contactId: number | null;
  amount: number;
  due: string;
  status: "pending" | "cleared" | "bounced";
}

export interface Loan {
  id: number;
  title: string;
  lender: string;
  principal: number;
  rate: number;
  months: number;
  start: string;
  accountId: number;
}

export interface Installment {
  id: number;
  loanId: number;
  no: number;
  due: string;
  principal: number;
  interest: number;
  paid: boolean;
}

export interface Product {
  id: number;
  name: string;
  unit: string;
  kind: "product" | "input";
  cost: number;
  price: number;
  stock: number;
  min: number;
}

export interface StockMove {
  id: number;
  productId: number;
  date: string;
  kind: "in" | "out";
  qty: number;
  unitCost: number;
  note?: string;
}

export interface Asset {
  id: number;
  name: string;
  purchase: string;
  cost: number;
  salvage: number;
  lifeMonths: number;
}

export interface Budget {
  id: number;
  year: number;
  accountId: number;
  amount: number;
}

export interface Project {
  id: number;
  name: string;
  crop: string;
  area: number;
  sharePercent: number;
}

export interface FarmOp {
  id: number;
  projectId: number;
  date: string;
  kind: "plant" | "irrigate" | "harvest" | "cost" | "sale" | "labor";
  desc: string;
  amount: number;
  qty?: number;
  unit?: string;
}

export interface Audit {
  id: number;
  at: string;
  action: "create" | "undo" | "update" | "reset";
  entity: string;
  summary: string;
  entryId?: number;
}

export interface Settings {
  business: string;
  owner: string;
  taxRate: number;
  assistantMode: "assistant" | "backup";
  theme: "light" | "dark";
}


/* ------------------------------ اجاره و امضا ------------------------------ */

export interface RentScheduleRow {
  no: number;
  due: string;
  amount: number;
  paid: boolean;
  paidAmount?: number;
}

export interface Lease {
  id: number;
  title: string;
  kind: "cash" | "share" | "mixed";
  landlordId: number;
  tenantId: number;
  location: string;
  plate: string;
  area: number;
  crop: string;
  start: string;
  end: string;
  months: number;
  cycle: "once" | "monthly" | "seasonal" | "annual";
  sharePercent: number;
  deposit: number;
  waterShare: string;
  waterPaidBy: string;
  terms: string;
  witnesses: string;
  status: "draft" | "active" | "ended" | "canceled";
  schedule: RentScheduleRow[];
  createdAt: string;
  note?: string;
}

export interface RentPayment {
  id: number;
  leaseId: number;
  date: string;
  amount: number;
  accountId: number;
  scheduleNo?: number | null;
  note?: string;
}

export interface SignatureRecord {
  id: number;
  at: string;
  context: "lease" | "contact" | "document" | "invoice";
  refId: number | null;
  role: string;
  signerName: string;
  image: string;
  hash: string;
}

export interface DB {
  version: 2;
  seq: number;
  savedAt: string;
  settings: Settings;
  accounts: Account[];
  contacts: Contact[];
  entries: Entry[];
  invoices: Invoice[];
  payments: Payment[];
  cheques: Cheque[];
  loans: Loan[];
  installments: Installment[];
  products: Product[];
  moves: StockMove[];
  assets: Asset[];
  budgets: Budget[];
  projects: Project[];
  ops: FarmOp[];
  leases: Lease[];
  rents: RentPayment[];
  signatures: SignatureRecord[];
  audit: Audit[];
}

/* --------------------------------- پول ---------------------------------- */

const FA = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function faDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA[Number(d)]);
}

export function normalizeDigits(input: string): string {
  return String(input ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** ورودی کاربر (رقم فارسی، جداکننده، ضریب هزار/میلیون) → تومان صحیح */
export function toAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const text = normalizeDigits(String(value ?? ""))
    .replace(/[٬,\u066C\s]/g, "")
    .replace(/تومان|تومن|ریال/g, "");
  const mult = /(\d+(?:\.\d+)?)هزار/.exec(text);
  const mil = /(\d+(?:\.\d+)?)میلیون/.exec(text);
  const bil = /(\d+(?:\.\d+)?)میلیارد/.exec(text);
  if (bil) return Math.round(Number(bil[1]) * 1_000_000_000);
  if (mil) return Math.round(Number(mil[1]) * 1_000_000);
  if (mult) return Math.round(Number(mult[1]) * 1000);
  const digits = text.replace(/[^0-9.]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/* --------------------- نمایش مبالغ: ریال + حروفی تومان --------------------- */

const W_ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const W_TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const W_TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const W_HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const W_SCALES = ["", " هزار", " میلیون", " میلیارد", " تریلیون"];

function under1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(W_HUNDREDS[h]);
  if (r >= 10 && r < 20) parts.push(W_TEENS[r - 10]);
  else {
    const t = Math.floor(r / 10);
    if (t) parts.push(W_TENS[t]);
    if (r % 10) parts.push(W_ONES[r % 10]);
  }
  return parts.join(" و ");
}

/** عدد → حروف فارسی: ۱۰۰۰۰۰۰۰ → «ده میلیون» */
export function numberToWords(value: number): string {
  const n = Math.round(Math.abs(Number(value) || 0));
  if (!n) return "صفر";
  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (!groups[i]) continue;
    parts.push(`${under1000(groups[i])}${W_SCALES[i] ?? ""}`);
  }
  return parts.join(" و ");
}

/** مبلغ تومانی → «ده میلیون تومان» */
export function moneyWords(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return `${n < 0 ? "منفی " : ""}${numberToWords(n)} تومان`;
}

/** مبلغ تومانی → «100,000,000 ریال» (رقم لاتین، جداشده با کاما) */
export function moneyRial(amount: number): string {
  const rial = Math.round((Number.isFinite(amount) ? amount : 0) * 10);
  const sign = rial < 0 ? "−" : "";
  return `${sign}${Math.abs(rial).toLocaleString("en-US")} ریال`;
}

export function fmt(amount: number, withUnit = true): string {
  const n = Math.round(Number.isFinite(amount) ? amount : 0);
  const sign = n < 0 ? "−" : "";
  if (!withUnit) return `${sign}${Math.abs(n * 10).toLocaleString("en-US")}`;
  return `${moneyRial(n)} · ${moneyWords(n)}`;
}

export function fmtShort(amount: number): string {
  const n = Math.abs(Math.round(amount));
  const sign = amount < 0 ? "−" : "";
  if (n >= 1_000_000_000) return `${sign}${faDigits((n / 1_000_000_000).toFixed(1))} میلیارد`;
  if (n >= 1_000_000) return `${sign}${faDigits((n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1))} میلیون`;
  if (n >= 1000) return `${sign}${faDigits(Math.round(n / 1000))} هزار`;
  return `${sign}${faDigits(n)}`;
}

/* ------------------------------- تقویم شمسی ------------------------------ */

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

export function toJalali(date: Date): { jy: number; jm: number; jd: number } {
  const jdn = g2d(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  let k = jdn - g2d(gy, 3, r.march);
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export function fromJalali(jy: number, jm: number, jd: number): Date {
  const g = d2g(j2d(jy, jm, jd));
  return new Date(g.gy, g.gm - 1, g.gd);
}

export const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function parseDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function formatJalali(value: string | Date, style: "short" | "long" | "month" = "short"): string {
  const d = typeof value === "string" ? parseDate(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const { jy, jm, jd } = toJalali(d);
  if (style === "month") return `${MONTHS[jm - 1]} ${faDigits(jy)}`;
  if (style === "long") return `${faDigits(jd)} ${MONTHS[jm - 1]} ${faDigits(jy)}`;
  return `${faDigits(jy)}/${faDigits(String(jm).padStart(2, "0"))}/${faDigits(String(jd).padStart(2, "0"))}`;
}

export function addDays(value: string | Date, days: number): string {
  const d = typeof value === "string" ? parseDate(value) : new Date(value);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function addMonths(value: string | Date, months: number): string {
  const d = typeof value === "string" ? parseDate(value) : new Date(value);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toISO(d);
}

export function daysBetween(from: string | Date, to: string | Date): number {
  const a = typeof from === "string" ? parseDate(from) : from;
  const b = typeof to === "string" ? parseDate(to) : to;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function jalaliMonthStart(jy: number, jm: number): string {
  return toISO(fromJalali(jy, jm, 1));
}

export function jalaliMonthEnd(jy: number, jm: number): string {
  const next = jm === 12 ? fromJalali(jy + 1, 1, 1) : fromJalali(jy, jm + 1, 1);
  return addDays(toISO(next), -1);
}

export interface Period {
  jy: number;
  jm: number;
  start: string;
  end: string;
  label: string;
}

export function currentPeriod(at: Date = new Date()): Period {
  const { jy, jm } = toJalali(at);
  return { jy, jm, start: jalaliMonthStart(jy, jm), end: jalaliMonthEnd(jy, jm), label: MONTHS[jm - 1] };
}

export function lastMonths(n: number, at: Date = new Date()): Period[] {
  const { jy, jm } = toJalali(at);
  const out: Period[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    let y = jy;
    let m = jm - i;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    out.push({ jy: y, jm: m, start: jalaliMonthStart(y, m), end: jalaliMonthEnd(y, m), label: MONTHS[m - 1] });
  }
  return out;
}

export function fiscalYearStart(at: Date = new Date()): string {
  return jalaliMonthStart(toJalali(at).jy, 1);
}

/* --------------------------- موتور دوطرفه (هسته) -------------------------- */

export const CHART: ReadonlyArray<Omit<Account, "id">> = [
  { code: "1010", name: "صندوق نقدی", type: "asset", isCash: true },
  { code: "1020", name: "بانک", type: "asset", isCash: true },
  { code: "1100", name: "حساب‌های دریافتنی", type: "asset" },
  { code: "1200", name: "موجودی کالا و نهاده", type: "asset" },
  { code: "1300", name: "دارایی ثابت", type: "asset" },
  { code: "1310", name: "استهلاک انباشته", type: "contra" },
  { code: "2100", name: "حساب‌های پرداختنی", type: "liability" },
  { code: "2200", name: "وام و تسهیلات", type: "liability" },
  { code: "2300", name: "مالیات پرداختنی", type: "liability" },
  { code: "3100", name: "سرمایه مالک", type: "equity" },
  { code: "4100", name: "درآمد فروش", type: "income" },
  { code: "4110", name: "درآمد خدمات و سایر", type: "income" },
  { code: "5100", name: "بهای تمام‌شده", type: "expense" },
  { code: "5110", name: "دستمزد کارگر", type: "expense" },
  { code: "5120", name: "خرید نهاده", type: "expense" },
  { code: "5130", name: "سوخت و انرژی", type: "expense" },
  { code: "5140", name: "اجاره و آب و برق", type: "expense" },
  { code: "5150", name: "استهلاک", type: "expense" },
  { code: "5190", name: "هزینه‌های متفرقه", type: "expense" },
];

export function codeOf(db: DB, code: string): number {
  const found = db.accounts.find((a) => a.code === code);
  if (found) return found.id;
  throw new Error(`حساب ${code} در کدینگ نیست`);
}

export function accountName(db: DB, id: number): string {
  return db.accounts.find((a) => a.id === id)?.name ?? "—";
}

export function validatePosting(lines: Line[]): { ok: boolean; error?: string; debit: number; credit: number } {
  const clean = lines.filter((l) => l.debit !== 0 || l.credit !== 0);
  const debit = clean.reduce((s, l) => s + Math.round(l.debit), 0);
  const credit = clean.reduce((s, l) => s + Math.round(l.credit), 0);
  if (clean.length < 2) return { ok: false, error: "سند باید حداقل دو ردیف داشته باشد.", debit, credit };
  if (clean.some((l) => l.debit < 0 || l.credit < 0)) return { ok: false, error: "مبلغ منفی مجاز نیست.", debit, credit };
  if (clean.some((l) => l.debit > 0 && l.credit > 0)) return { ok: false, error: "یک ردیف نمی‌تواند هم بدهکار و هم بستانکار باشد.", debit, credit };
  if (debit !== credit) return { ok: false, error: "جمع بدهکار و بستانکار برابر نیست.", debit, credit };
  if (debit === 0) return { ok: false, error: "مبلغ سند صفر است.", debit, credit };
  return { ok: true, debit, credit };
}

export function computeInvoiceTotals(
  items: InvoiceItem[],
  discount = 0,
  taxRate = 0,
): { subtotal: number; discount: number; tax: number; total: number } {
  const subtotal = items.reduce((s, it) => s + Math.round(it.qty * it.price), 0);
  const safeDiscount = Math.min(Math.max(0, Math.round(discount)), subtotal);
  const base = subtotal - safeDiscount;
  const tax = Math.round((base * Math.max(0, Math.round(taxRate))) / 100);
  return { subtotal, discount: safeDiscount, tax, total: base + tax };
}

export interface Posting {
  date: string;
  desc: string;
  source: Entry["source"];
  lines: Line[];
  contactId?: number | null;
  projectId?: number | null;
}

/** تنها راه نوشتن در دفتر: اعتبارسنجی، درج سند و ثبت حسابرسی (تغییرناپذیر) */
export function postEntry(db: DB, posting: Posting): { db: DB; entry: Entry } {
  const check = validatePosting(posting.lines);
  if (!check.ok) throw new Error(check.error ?? "سند نامعتبر است");
  const id = db.seq + 1;
  const entry: Entry = {
    id,
    date: posting.date || todayISO(),
    desc: posting.desc.trim() || "سند بدون شرح",
    source: posting.source,
    contactId: posting.contactId ?? null,
    projectId: posting.projectId ?? null,
    lines: posting.lines.map((l) => ({ accountId: l.accountId, debit: Math.round(l.debit), credit: Math.round(l.credit) })),
  };
  return {
    db: {
      ...db,
      seq: id,
      entries: [...db.entries, entry],
      audit: [
        ...db.audit,
        { id: db.audit.length + 1, at: new Date().toISOString(), action: "create", entity: "entry", summary: entry.desc, entryId: id },
      ],
    },
    entry,
  };
}

export function undoEntry(db: DB, entryId: number): DB {
  return {
    ...db,
    entries: db.entries.filter((e) => e.id !== entryId),
    audit: [
      ...db.audit,
      { id: db.audit.length + 1, at: new Date().toISOString(), action: "undo", entity: "entry", summary: `واگرد سند ${faDigits(entryId)}`, entryId },
    ],
  };
}

/* --------------------------------- گزارش --------------------------------- */

export interface Balance {
  accountId: number;
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
  balance: number;
}

const isDebitNature = (type: AccountType) => type === "asset" || type === "expense";

export function balances(db: DB): Balance[] {
  const map = new Map<number, { debit: number; credit: number }>();
  for (const entry of db.entries) {
    for (const line of entry.lines) {
      const cur = map.get(line.accountId) ?? { debit: 0, credit: 0 };
      map.set(line.accountId, { debit: cur.debit + line.debit, credit: cur.credit + line.credit });
    }
  }
  return db.accounts.map((a) => {
    const sums = map.get(a.id) ?? { debit: 0, credit: 0 };
    const raw = a.type === "contra" ? sums.credit - sums.debit : isDebitNature(a.type) ? sums.debit - sums.credit : sums.credit - sums.debit;
    return { accountId: a.id, code: a.code, name: a.name, type: a.type, debit: sums.debit, credit: sums.credit, balance: raw };
  });
}

const inRange = (date: string, range?: { start: string; end: string }) => !range || (date >= range.start && date <= range.end);

export function sumType(db: DB, type: AccountType, range?: { start: string; end: string }): number {
  return db.entries
    .filter((e) => inRange(e.date, range))
    .reduce((total, entry) => {
      let subtotal = 0;
      for (const line of entry.lines) {
        const acc = db.accounts.find((a) => a.id === line.accountId);
        if (!acc || acc.type !== type) continue;
        subtotal += type === "income" ? line.credit - line.debit : line.debit - line.credit;
      }
      return total + subtotal;
    }, 0);
}

export function incomeOf(db: DB, range?: { start: string; end: string }): number {
  return sumType(db, "income", range);
}

export function expenseOf(db: DB, range?: { start: string; end: string }): number {
  return sumType(db, "expense", range);
}

export function profitOf(db: DB, range?: { start: string; end: string }): number {
  return incomeOf(db, range) - expenseOf(db, range);
}

export function cashOf(db: DB, range?: { start: string; end: string }): number {
  const cashIds = new Set(db.accounts.filter((a) => a.isCash).map((a) => a.id));
  return db.entries
    .filter((e) => inRange(e.date, range))
    .reduce((s, e) => s + e.lines.reduce((t, l) => (cashIds.has(l.accountId) ? t + l.debit - l.credit : t), 0), 0);
}

export function cashFlow(db: DB, range?: { start: string; end: string }): { inflow: number; outflow: number; net: number } {
  const cashIds = new Set(db.accounts.filter((a) => a.isCash).map((a) => a.id));
  let inflow = 0;
  let outflow = 0;
  for (const e of db.entries) {
    if (!inRange(e.date, range)) continue;
    for (const l of e.lines) {
      if (!cashIds.has(l.accountId)) continue;
      inflow += l.debit;
      outflow += l.credit;
    }
  }
  return { inflow, outflow, net: inflow - outflow };
}

export function trialBalance(db: DB): { rows: Balance[]; debit: number; credit: number; balanced: boolean } {
  const rows = balances(db).filter((b) => b.debit || b.credit);
  const debit = rows.reduce((s, r) => s + r.debit, 0);
  const credit = rows.reduce((s, r) => s + r.credit, 0);
  return { rows, debit, credit, balanced: debit === credit };
}

export function balanceSheet(db: DB): {
  assets: number;
  grossAssets: number;
  accumulated: number;
  liabilities: number;
  equity: number;
  netProfit: number;
  balanced: boolean;
} {
  const rows = balances(db);
  const sum = (type: AccountType) => rows.filter((r) => r.type === type).reduce((s, r) => s + r.balance, 0);
  const gross = sum("asset");
  const accumulated = sum("contra");
  const liabilities = sum("liability");
  const capital = sum("equity");
  const netProfit = sum("income") - sum("expense");
  const assets = gross - accumulated;
  return { assets, grossAssets: gross, accumulated, liabilities, equity: capital + netProfit, netProfit, balanced: assets === liabilities + capital + netProfit };
}

export function groupExpense(db: DB, range?: { start: string; end: string }): { name: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const e of db.entries) {
    if (!inRange(e.date, range)) continue;
    for (const l of e.lines) {
      const acc = db.accounts.find((a) => a.id === l.accountId);
      if (!acc || acc.type !== "expense") continue;
      const amount = l.debit - l.credit;
      map.set(acc.name, (map.get(acc.name) ?? 0) + amount);
    }
  }
  return [...map.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
}

export function monthlySeries(db: DB, months: Period[]): { label: string; income: number; expense: number; profit: number }[] {
  return months.map((m) => {
    const range = { start: m.start, end: m.end };
    return { label: m.label, income: incomeOf(db, range), expense: expenseOf(db, range), profit: profitOf(db, range) };
  });
}

export function invoiceRemaining(inv: Invoice): number {
  return Math.max(0, inv.total - inv.paid);
}

export function invoiceStatus(inv: Invoice): { key: "paid" | "partial" | "open"; label: string } {
  const remaining = invoiceRemaining(inv);
  if (remaining <= 0) return { key: "paid", label: "تسویه‌شده" };
  if (inv.paid > 0) return { key: "partial", label: "پرداخت جزئی" };
  return { key: "open", label: "باز" };
}

export function aging(db: DB, today = todayISO()): { label: string; amount: number; count: number }[] {
  const buckets = [
    { label: "جاری", amount: 0, count: 0 },
    { label: "۱ تا ۳۰ روز", amount: 0, count: 0 },
    { label: "۳۱ تا ۶۰ روز", amount: 0, count: 0 },
    { label: "بیش از ۶۰ روز", amount: 0, count: 0 },
  ];
  for (const inv of db.invoices) {
    if (inv.type !== "sale") continue;
    const remaining = invoiceRemaining(inv);
    if (remaining <= 0) continue;
    const days = daysBetween(inv.due, today);
    const idx = days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3;
    buckets[idx].amount += remaining;
    buckets[idx].count += 1;
  }
  return buckets;
}

export function contactBalance(db: DB, contactId: number): { receivable: number; payable: number; net: number } {
  let receivable = 0;
  let payable = 0;
  for (const inv of db.invoices) {
    if (inv.contactId !== contactId) continue;
    const remaining = invoiceRemaining(inv);
    if (inv.type === "sale") receivable += remaining;
    else payable += remaining;
  }
  const ar = codeOfSafe(db, "1100");
  const ap = codeOfSafe(db, "2100");
  for (const e of db.entries) {
    if (e.contactId !== contactId) continue;
    for (const l of e.lines) {
      if (l.accountId === ar) receivable += l.debit - l.credit;
      if (l.accountId === ap) payable += l.credit - l.debit;
    }
  }
  return { receivable, payable, net: receivable - payable };
}

function codeOfSafe(db: DB, code: string): number {
  return db.accounts.find((a) => a.code === code)?.id ?? -1;
}

export function budgetUsage(db: DB, year: number): { accountId: number; name: string; budget: number; actual: number; pct: number }[] {
  const range = { start: toISO(fromJalali(year, 1, 1)), end: todayISO() };
  return db.budgets
    .filter((b) => b.year === year)
    .map((b) => {
      const actual = db.entries
        .filter((e) => inRange(e.date, range))
        .reduce((s, e) => s + e.lines.filter((l) => l.accountId === b.accountId).reduce((t, l) => t + l.debit - l.credit, 0), 0);
      return { accountId: b.accountId, name: accountName(db, b.accountId), budget: b.amount, actual, pct: b.amount > 0 ? Math.round((actual / b.amount) * 100) : 0 };
    })
    .sort((a, b) => b.pct - a.pct);
}

export function projectProfit(db: DB, projectId: number): { income: number; expense: number; profit: number } {
  let income = 0;
  let expense = 0;
  for (const e of db.entries) {
    if (e.projectId !== projectId) continue;
    for (const l of e.lines) {
      const acc = db.accounts.find((a) => a.id === l.accountId);
      if (!acc) continue;
      if (acc.type === "income") income += l.credit - l.debit;
      if (acc.type === "expense") expense += l.debit - l.credit;
    }
  }
  return { income, expense, profit: income - expense };
}

/* ------------------------------ دارایی و وام ----------------------------- */

export function depreciation(
  cost: number,
  salvage: number,
  lifeMonths: number,
  purchaseISO: string,
  asOf: Date = new Date(),
): { monthly: number; months: number; accumulated: number; book: number } {
  const life = Math.max(1, Math.round(lifeMonths));
  const base = Math.max(0, Math.round(cost) - Math.max(0, Math.round(salvage)));
  const monthly = Math.round(base / life);
  const start = parseDate(purchaseISO);
  const months = Math.max(0, (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth()) + 1);
  const elapsed = Math.min(life, months);
  const accumulated = Math.min(base, monthly * elapsed);
  return { monthly, months: elapsed, accumulated, book: Math.round(cost) - accumulated };
}

export function loanSchedule(
  principal: number,
  annualRate: number,
  months: number,
  startISO: string,
): { no: number; due: string; principal: number; interest: number }[] {
  const count = Math.max(1, Math.round(months));
  const base = Math.round(principal / count);
  const interest = Math.round((principal * Math.max(0, annualRate)) / 100 / 12);
  return Array.from({ length: count }, (_, i) => ({
    no: i + 1,
    due: addMonths(startISO, i),
    principal: i === count - 1 ? Math.round(principal) - base * (count - 1) : base,
    interest,
  }));
}

/* ------------------------------ کمک‌های نمایشی ----------------------------- */

export function cashOfAccount(db: DB, accountId: number): number {
  return db.entries.reduce((total, entry) => total + entry.lines.reduce((t, line) => (line.accountId === accountId ? t + line.debit - line.credit : t), 0), 0);
}

export function budgetUsageEq(db: DB): { accountId: number; name: string; budget: number; actual: number; pct: number }[] {
  return budgetUsage(db, toJalali(new Date()).jy);
}

export function monthsForChart(db: DB, count = 6): { label: string; income: number; expense: number }[] {
  return monthlySeries(db, lastMonths(count)).map((m) => ({ label: m.label, income: m.income, expense: m.expense }));
}


/* --------------------------- دفتر معین طرف‌حساب --------------------------- */

export interface StatementRow {
  id: string;
  date: string;
  kind: "invoice" | "payment" | "cheque" | "opening" | "manual";
  title: string;
  ref: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface ContactLedger {
  rows: StatementRow[];
  debit: number;
  credit: number;
  net: number;
  invoiced: number;
  settled: number;
  openInvoices: number;
  chequesPending: number;
  overdue: number;
}

export function contactKindLabel(kind: Contact["kind"]): string {
  return kind === "customer" ? "مشتری" : kind === "supplier" ? "تأمین‌کننده" : kind === "both" ? "مشتری و تأمین‌کننده" : kind === "worker" ? "کارگر" : "شریک";
}

/** گردش کامل یک طرف‌حساب: هر ردیف با مانده‌ی تجمعی (بدهکار مثبت، بستانکار منفی) */
export function contactStatement(db: DB, contactId: number): ContactLedger {
  const ar = codeOfSafe(db, "1100");
  const ap = codeOfSafe(db, "2100");
  const raw: Omit<StatementRow, "balance">[] = [];
  for (const entry of db.entries) {
    if (entry.contactId !== contactId) continue;
    let debit = 0;
    let credit = 0;
    for (const line of entry.lines) {
      if (line.accountId !== ar && line.accountId !== ap) continue;
      debit += line.debit;
      credit += line.credit;
    }
    if (!debit && !credit) continue;
    raw.push({
      id: `e-${entry.id}`,
      date: entry.date,
      kind:
        entry.source === "sale" || entry.source === "purchase"
          ? "invoice"
          : entry.source === "payment"
            ? "payment"
            : entry.source === "cheque"
              ? "cheque"
              : entry.source === "opening"
                ? "opening"
                : "manual",
      title: entry.desc,
      ref: `#${faDigits(entry.id)}`,
      debit,
      credit,
    });
  }
  raw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let running = 0;
  const rows: StatementRow[] = raw.map((r) => {
    running += r.debit - r.credit;
    return { ...r, balance: running };
  });
  const debit = rows.reduce((s, r) => s + r.debit, 0);
  const credit = rows.reduce((s, r) => s + r.credit, 0);
  const invoices = db.invoices.filter((i) => i.contactId === contactId);
  const open = invoices.filter((i) => invoiceRemaining(i) > 0);
  const overdue = open.filter((i) => i.type === "sale" && i.due < todayISO()).reduce((s, i) => s + invoiceRemaining(i), 0);
  return {
    rows,
    debit,
    credit,
    net: debit - credit,
    invoiced: invoices.reduce((s, i) => s + i.total, 0),
    settled: invoices.reduce((s, i) => s + i.paid, 0),
    openInvoices: open.length,
    chequesPending: db.cheques.filter((c) => c.contactId === contactId && c.status === "pending").reduce((s, c) => s + c.amount, 0),
    overdue,
  };
}

export interface ContactSummary {
  id: number;
  name: string;
  kind: Contact["kind"];
  debit: number;
  credit: number;
  net: number;
  overdue: number;
  openInvoices: number;
}

export function contactSummaries(db: DB): ContactSummary[] {
  return db.contacts
    .map((c) => {
      const s = contactStatement(db, c.id);
      return { id: c.id, name: c.name, kind: c.kind, debit: s.debit, credit: s.credit, net: s.net, overdue: s.overdue, openInvoices: s.openInvoices };
    })
    .sort((a, b) => b.net - a.net);
}

/** تفکیک بدهکاران (طلب ما) و بستانکاران (بدهی ما) با جمع و معوق */
export function debtorsCreditors(db: DB): {
  debtors: ContactSummary[];
  creditors: ContactSummary[];
  totalDebit: number;
  totalCredit: number;
  overdueTotal: number;
} {
  const all = contactSummaries(db);
  const debtors = all.filter((c) => c.net > 0);
  const creditors = all.filter((c) => c.net < 0);
  return {
    debtors,
    creditors,
    totalDebit: debtors.reduce((s, c) => s + c.net, 0),
    totalCredit: creditors.reduce((s, c) => s + Math.abs(c.net), 0),
    overdueTotal: all.reduce((s, c) => s + c.overdue, 0),
  };
}

/** دفتر معین یک حساب: همه ردیف‌های آن حساب با مانده تجمعی */
export function accountLedger(db: DB, accountId: number): {
  name: string;
  code: string;
  type: AccountType;
  rows: StatementRow[];
  debit: number;
  credit: number;
  balance: number;
} {
  const account = db.accounts.find((a) => a.id === accountId);
  const rowsRaw: Omit<StatementRow, "balance">[] = [];
  for (const entry of db.entries) {
    const debit = entry.lines.filter((l) => l.accountId === accountId).reduce((s, l) => s + l.debit, 0);
    const credit = entry.lines.filter((l) => l.accountId === accountId).reduce((s, l) => s + l.credit, 0);
    if (!debit && !credit) continue;
    rowsRaw.push({ id: `e-${entry.id}`, date: entry.date, kind: "manual", title: entry.desc, ref: `#${faDigits(entry.id)}`, debit, credit });
  }
  rowsRaw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let running = 0;
  const rows = rowsRaw.map((r) => {
    running += r.debit - r.credit;
    return { ...r, balance: running };
  });
  const debit = rows.reduce((s, r) => s + r.debit, 0);
  const credit = rows.reduce((s, r) => s + r.credit, 0);
  return { name: account?.name ?? "—", code: account?.code ?? "—", type: account?.type ?? "asset", rows, debit, credit, balance: debit - credit };
}

/** صورتحساب متنی برای اشتراک‌گذاری/کپی (بدون کلید و داده حساس) */
export function statementText(db: DB, contactId: number): string {
  const contact = db.contacts.find((c) => c.id === contactId);
  if (!contact) return "";
  const s = contactStatement(db, contactId);
  const lines = [
    `صورتحساب ${contact.name} — ${formatJalali(new Date(), "long")}`,
    `مانده: ${fmt(s.net)} (${s.net > 0 ? "بدهکار" : s.net < 0 ? "بستانکار" : "تسویه"})`,
    `جمع بدهکار: ${fmt(s.debit)} | جمع بستانکار: ${fmt(s.credit)}`,
    "—".repeat(20),
    ...s.rows.map((r) => `${formatJalali(r.date)} | ${r.title} | بدهکار ${fmt(r.debit)} | بستانکار ${fmt(r.credit)} | مانده ${fmt(r.balance)}`),
    "—".repeat(20),
    "کشاورزحساب — محاسبه‌شده با موتور قطعی دوطرفه",
  ];
  return lines.join("\n");
}
