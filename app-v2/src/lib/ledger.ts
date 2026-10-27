import { addJalaliMonths, daysBetween, formatJalali, todayJalali, type JDate } from "./format";

/* ------------------------------ انواع داده ------------------------------ */

export type PaymentMethod = "cash" | "bank" | "cheque" | "credit";
export type PartyKind = "debtor" | "creditor";

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  cash: "نقدی",
  bank: "حواله بانکی",
  cheque: "چک",
  credit: "نسیه / اعتباری",
};

export interface DebtParty {
  id: string;
  name: string;
  phone: string;
  city: string;
  kind: PartyKind;
  amount: number;
  reason: string;
  date: JDate;
  dueDate: JDate | null;
  note: string;
  color: "mint" | "sand" | "blue" | "rose";
}

export interface PartyPayment {
  id: string;
  partyId: string;
  date: JDate;
  amount: number;
  method: PaymentMethod;
  note: string;
}

export interface FinanceEntry {
  id: string;
  kind: "income" | "expense";
  date: JDate;
  amount: number;
  reason: string;
  category: string;
  method: PaymentMethod;
  partyId: string | null;
  note: string;
}

export const INCOME_CATEGORIES = ["فروش محصول", "درآمد اجاره", "سهم محصول", "یارانه و کمک", "فروش دام", "سایر درآمد"];
export const EXPENSE_CATEGORIES = ["بذر و نهال", "کود و سم", "آب و انرژی", "کارگر و دستمزد", "ماشین‌آلات", "اجاره زمین", "حمل و نقل", "تعمیرات", "مالیات و عوارض", "سایر هزینه"];

export interface Cheque {
  id: string;
  direction: "received" | "paid";
  amount: number;
  serial: string;
  bank: string;
  due: JDate;
  partyName: string;
  reason: string;
  status: "pending" | "cleared" | "bounced";
}

export interface Loan {
  id: string;
  title: string;
  lender: string;
  principal: number;
  rate: number;
  months: number;
  start: JDate;
  paidInstallments: number;
  reason: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  kind: "input" | "product";
  stock: number;
  min: number;
  cost: number;
}

export interface InventoryMove {
  id: string;
  itemId: string;
  date: JDate;
  kind: "in" | "out";
  qty: number;
  note: string;
}

export interface Asset {
  id: string;
  name: string;
  cost: number;
  salvage: number;
  lifeMonths: number;
  purchase: JDate;
  note: string;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
}

export interface LedgerState {
  parties: DebtParty[];
  payments: PartyPayment[];
  entries: FinanceEntry[];
  cheques: Cheque[];
  loans: Loan[];
  items: InventoryItem[];
  moves: InventoryMove[];
  assets: Asset[];
  budgets: Budget[];
}

/* ----------------------------- محاسبات ----------------------------- */

export function partyTotals(party: DebtParty, payments: PartyPayment[]) {
  const paid = payments.filter((payment) => payment.partyId === party.id).reduce((sum, payment) => sum + payment.amount, 0);
  const balance = Math.max(0, party.amount - paid);
  const ratio = party.amount > 0 ? Math.min(100, Math.round((paid / party.amount) * 100)) : 0;
  const dueInDays = party.dueDate ? daysBetween(todayJalali(), party.dueDate) : null;
  const overdue = Boolean(party.dueDate && balance > 0 && daysBetween(party.dueDate, todayJalali()) > 0);
  return { original: party.amount, paid, balance, ratio, dueInDays, overdue };
}

export function ledgerTotals(state: LedgerState) {
  const debtors = state.parties.filter((party) => party.kind === "debtor");
  const creditors = state.parties.filter((party) => party.kind === "creditor");
  const receivable = debtors.reduce((sum, party) => sum + partyTotals(party, state.payments).balance, 0);
  const payable = creditors.reduce((sum, party) => sum + partyTotals(party, state.payments).balance, 0);
  const overdue = state.parties.reduce((sum, party) => sum + (partyTotals(party, state.payments).overdue ? partyTotals(party, state.payments).balance : 0), 0);
  return { receivable, payable, overdue, net: receivable - payable, debtorCount: debtors.length, creditorCount: creditors.length };
}

export function financeTotals(entries: FinanceEntry[]) {
  const income = entries.filter((entry) => entry.kind === "income").reduce((sum, entry) => sum + entry.amount, 0);
  const expense = entries.filter((entry) => entry.kind === "expense").reduce((sum, entry) => sum + entry.amount, 0);
  return { income, expense, profit: income - expense };
}

export function entryTotalsByCategory(entries: FinanceEntry[]) {
  const map = new Map<string, { income: number; expense: number }>();
  for (const entry of entries) {
    const current = map.get(entry.category) ?? { income: 0, expense: 0 };
    current[entry.kind] += entry.amount;
    map.set(entry.category, current);
  }
  return Array.from(map.entries()).map(([category, value]) => ({ category, ...value }));
}

export function loanSchedule(loan: Loan) {
  const monthlyRate = loan.rate / 100 / 12;
  const factor = monthlyRate === 0 ? 1 / Math.max(1, loan.months) : (monthlyRate * Math.pow(1 + monthlyRate, loan.months)) / (Math.pow(1 + monthlyRate, loan.months) - 1);
  const installment = Math.round((loan.principal * factor) / 1000) * 1000;
  return Array.from({ length: loan.months }, (_, index) => ({
    no: index + 1,
    due: addJalaliMonths(loan.start, index + 1),
    amount: installment,
    paid: index < loan.paidInstallments,
  }));
}

export function assetRows(assets: Asset[]) {
  return assets.map((asset) => {
    const monthsPassed = Math.max(0, Math.min(asset.lifeMonths, Math.round(daysBetween(asset.purchase, todayJalali()) / 30.44)));
    const monthly = asset.lifeMonths > 0 ? (asset.cost - asset.salvage) / asset.lifeMonths : 0;
    const accumulated = Math.min(asset.cost - asset.salvage, monthly * monthsPassed);
    return { ...asset, monthly: Math.round(monthly), accumulated: Math.round(accumulated), book: Math.round(asset.cost - accumulated), monthsPassed };
  });
}

export function budgetRows(budgets: Budget[], entries: FinanceEntry[]) {
  return budgets.map((budget) => {
    const spent = entries.filter((entry) => entry.kind === "expense" && entry.category === budget.category).reduce((sum, entry) => sum + entry.amount, 0);
    const pct = budget.limit > 0 ? Math.round((spent / budget.limit) * 100) : 0;
    return { ...budget, spent, remaining: budget.limit - spent, pct };
  });
}

export function inventoryValue(items: InventoryItem[]) {
  return {
    inputs: items.filter((item) => item.kind === "input").reduce((sum, item) => sum + item.stock * item.cost, 0),
    products: items.filter((item) => item.kind === "product").reduce((sum, item) => sum + item.stock * item.cost, 0),
    low: items.filter((item) => item.stock <= item.min).length,
  };
}

export function chequeTotals(cheques: Cheque[]) {
  const pending = cheques.filter((cheque) => cheque.status === "pending");
  const received = cheques.filter((cheque) => cheque.direction === "received");
  const paid = cheques.filter((cheque) => cheque.direction === "paid");
  return {
    receivable: received.filter((cheque) => cheque.status !== "bounced").reduce((sum, cheque) => sum + cheque.amount, 0),
    payable: paid.filter((cheque) => cheque.status === "pending").reduce((sum, cheque) => sum + cheque.amount, 0),
    pending: pending.length,
    bounced: cheques.filter((cheque) => cheque.status === "bounced").length,
    dueSoon: pending.filter((cheque) => daysBetween(todayJalali(), cheque.due) <= 10).length,
  };
}

export function buildLedgerAccountText(party: DebtParty, payments: PartyPayment[]): string {
  const totals = partyTotals(party, payments);
  const label = party.kind === "debtor" ? "طلب ما از ایشان" : "بدهی ما به ایشان";
  const lines = [
    `صورتحساب ${party.name}`,
    `نوع: ${party.kind === "debtor" ? "بدهکار" : "بستانکار"} — ${label}`,
    `دلیل/شرح: ${party.reason}`,
    `تاریخ ایجاد: ${formatJalali(party.date, "long")}`,
    party.dueDate ? `یادآوری پیگیری: ${formatJalali(party.dueDate, "long")}` : "",
    `مبلغ اولیه: ${party.amount.toLocaleString("en-US")} تومان`,
    `پرداخت‌شده: ${totals.paid.toLocaleString("en-US")} تومان`,
    `مانده: ${totals.balance.toLocaleString("en-US")} تومان`,
    "",
    "گردش پرداخت‌ها (تاریخ پرداخت):",
    ...payments.filter((payment) => payment.partyId === party.id).map((payment) => `${formatJalali(payment.date, "long")} — ${payment.amount.toLocaleString("en-US")} تومان — ${PAYMENT_METHODS[payment.method]}${payment.note ? ` — ${payment.note}` : ""}`),
    payments.filter((payment) => payment.partyId === party.id).length === 0 ? "پرداختی ثبت نشده است." : "",
  ];
  return lines.join("\n");
}


/** وضعیت کاملاً خالی برای نصب تازه — هیچ داده نمونه‌ای وارد نسخه کاربر نمی‌شود. */
export function emptyLedger(): LedgerState {
  return { parties: [], payments: [], entries: [], cheques: [], loans: [], items: [], moves: [], assets: [], budgets: [] };
}

export const DEMO_FLAG_KEY = "kishavar.demo";

/* ------------------------------ داده نمونه (فقط تست) ------------------------------ */

const today = todayJalali();

export function initialLedger(): LedgerState {
  return {
    parties: [
      {
        id: "acc-1", name: "کارخانه آرد آذربایجان", phone: "۰۹۱۴ ۲۲۵ ۸۸۷۷", city: "پارس‌آباد", kind: "debtor",
        amount: 822_772_159, reason: "مانده صورتجلسه تحویل گندم محموله KSH-WHT — سه‌شنبه ۵ آبان ۱۴۰۵",
        date: today, dueDate: addJalaliMonths(today, 1), note: "چک شماره ۴۵۲۱۹۸۷ نزد فروشنده است.", color: "mint",
      },
      {
        id: "acc-2", name: "بازار میوه البرز", phone: "۰۹۱۲ ۵۵۰ ۷۷۱۲", city: "اردبیل", kind: "debtor",
        amount: 45_000_000, reason: "فروش نسیه زردآلو باغ شرقی — ۳۲۰ کیلوگرم",
        date: addJalaliMonths(today, -1), dueDate: addJalaliMonths(today, 0), note: "سررسید گذشته است؛ پیگیری تلفنی لازم است.", color: "blue",
      },
      {
        id: "acc-3", name: "نهاده‌های کشاورزی زاگرس", phone: "۰۸۱ ۳۴۴۵ ۶۶۷۷", city: "همدان", kind: "creditor",
        amount: 78_500_000, reason: "خرید کود اوره و سم برای قطعه شمالی — ۱۸ کیسه",
        date: addJalaliMonths(today, -1), dueDate: addJalaliMonths(today, 0), note: "فاکتور شماره ۴۴۸۲.", color: "sand",
      },
      {
        id: "acc-4", name: "تعمیرگاه تراکتور رضایی", phone: "۰۹۱۵ ۳۳۳ ۲۲۱۱", city: "پارس‌آباد", kind: "creditor",
        amount: 12_000_000, reason: "تعمیر گیربکس تراکتور MF 285",
        date: today, dueDate: null, note: "پرداخت نقدی توافق‌شده تا پایان هفته.", color: "rose",
      },
      {
        id: "acc-5", name: "حاج رضا کاویانی", phone: "۰۹۱۲ ۴۸۸ ۲۲۱۰", city: "پارس‌آباد", kind: "creditor",
        amount: 30_000_000, reason: "اجاره معوق مرحله سوم قطعه شمالی — قرارداد ۱۴۰۵-۰۸۴",
        date: addJalaliMonths(today, -1), dueDate: addJalaliMonths(today, 0), note: "رسید پرداخت پس از واریز صادر شود.", color: "sand",
      },
    ],
    payments: [
      { id: "pay-1", partyId: "acc-1", date: addJalaliMonths(today, 0), amount: 200_000_000, method: "bank", note: "حواله پایا — پیش‌پرداخت" },
      { id: "pay-2", partyId: "acc-3", date: addJalaliMonths(today, 0), amount: 20_000_000, method: "bank", note: "علی‌الحساب" },
    ],
    entries: [
      { id: "fin-1", kind: "income", date: today, amount: 822_772_159, reason: "فروش گندم به کارخانه آرد آذربایجان", category: "فروش محصول", method: "cheque", partyId: "acc-1", note: "۵ سند معامله صادر شد." },
      { id: "fin-2", kind: "expense", date: today, amount: 22_224_986, reason: "کرایه، تخلیه و کارمزد فروش گندم", category: "حمل و نقل", method: "bank", partyId: null, note: "طبق صورت‌حساب معامله" },
      { id: "fin-3", kind: "expense", date: addJalaliMonths(today, -1), amount: 78_500_000, reason: "خرید کود اوره و سم", category: "کود و سم", method: "credit", partyId: "acc-3", note: "فاکتور ۴۴۸۲" },
      { id: "fin-4", kind: "expense", date: addJalaliMonths(today, -1), amount: 132_000_000, reason: "دستمزد کارگران برداشت", category: "کارگر و دستمزد", method: "cash", partyId: null, note: "۲۲ نفر-روز" },
      { id: "fin-5", kind: "income", date: addJalaliMonths(today, -1), amount: 30_000_000, reason: "اجاره دریافتی باغ زردآلو", category: "درآمد اجاره", method: "bank", partyId: null, note: "قرارداد ۱۴۰۵-۰۶۲" },
      { id: "fin-6", kind: "expense", date: addJalaliMonths(today, 0), amount: 12_000_000, reason: "تعمیر تراکتور", category: "تعمیرات", method: "cash", partyId: "acc-4", note: "گیربکس" },
      { id: "fin-7", kind: "expense", date: addJalaliMonths(today, 0), amount: 84_000_000, reason: "خرید بذر گندم چمران", category: "بذر و نهال", method: "bank", partyId: null, note: "۲٬۴۰۰ کیلوگرم" },
    ],
    cheques: [
      { id: "chq-1", direction: "received", amount: 400_000_000, serial: "۴۵۲۱۹۸۷", bank: "بانک کشاورزی", due: addJalaliMonths(today, 0), partyName: "کارخانه آرد آذربایجان", reason: "مانده فروش گندم", status: "pending" },
      { id: "chq-2", direction: "paid", amount: 45_000_000, serial: "۹۹۳۴۵۱", bank: "بانک ملت", due: addJalaliMonths(today, 0), partyName: "نهاده‌های زاگرس", reason: "تسویه بخشی از کود", status: "pending" },
      { id: "chq-3", direction: "received", amount: 85_000_000, serial: "۳۳۲۱۸۸", bank: "بانک ملی", due: addJalaliMonths(today, -1), partyName: "بازار میوه البرز", reason: "فروش زردآلو", status: "bounced" },
    ],
    loans: [
      { id: "loan-1", title: "وام سرمایه در گردش", lender: "بانک کشاورزی", principal: 300_000_000, rate: 4, months: 18, start: addJalaliMonths(today, -4), paidInstallments: 4, reason: "خرید نهاده و بذر فصل" },
    ],
    items: [
      { id: "item-1", name: "بذر گندم چمران", unit: "کیلوگرم", kind: "input", stock: 800, min: 500, cost: 35_000 },
      { id: "item-2", name: "کود اوره", unit: "کیسه ۵۰ کیلویی", kind: "input", stock: 6, min: 10, cost: 2_400_000 },
      { id: "item-3", name: "گازوئیل", unit: "لیتر", kind: "input", stock: 240, min: 300, cost: 3_000 },
      { id: "item-4", name: "گندم برداشت‌شده", unit: "کیلوگرم", kind: "product", stock: 12_000, min: 0, cost: 49_500 },
    ],
    moves: [
      { id: "mv-1", itemId: "item-1", date: addJalaliMonths(today, -2), kind: "in", qty: 2_400, note: "خرید بذر" },
      { id: "mv-2", itemId: "item-1", date: addJalaliMonths(today, -2), kind: "out", qty: 1_600, note: "کاشت قطعه شمالی" },
      { id: "mv-3", itemId: "item-2", date: addJalaliMonths(today, -1), kind: "in", qty: 18, note: "خرید کود" },
      { id: "mv-4", itemId: "item-2", date: addJalaliMonths(today, -1), kind: "out", qty: 12, note: "کوددهی" },
    ],
    assets: [
      { id: "ast-1", name: "تراکتور MF 285", cost: 2_400_000_000, salvage: 400_000_000, lifeMonths: 120, purchase: addJalaliMonths(today, -30), note: "به‌روزرسانی موتور انجام شده" },
      { id: "ast-2", name: "پمپ آب چاه مشترک", cost: 180_000_000, salvage: 20_000_000, lifeMonths: 96, purchase: addJalaliMonths(today, -14), note: "تأسیسات آبیاری" },
    ],
    budgets: [
      { id: "bud-1", category: "بذر و نهال", limit: 120_000_000 },
      { id: "bud-2", category: "کود و سم", limit: 200_000_000 },
      { id: "bud-3", category: "کارگر و دستمزد", limit: 150_000_000 },
      { id: "bud-4", category: "حمل و نقل", limit: 40_000_000 },
    ],
  };
}

export const LEDGER_STORAGE_KEY = "kishavar.ledger.v2";
