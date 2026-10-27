/**
 * کشاورزحساب آفلاین — ذخیره‌سازی محلی و عملیات.
 * همه‌ی تغییرات از این لایه عبور می‌کنند و سند متوازن می‌سازند.
 * localStorage فقط برای داده‌ی همین دستگاه است؛ هیچ درخواست شبکه‌ای وجود ندارد.
 */
import {
  CHART,
  accountName,
  addDays,
  addMonths,
  aging,
  balanceSheet,
  balances,
  budgetUsage,
  cashFlow,
  cashOf,
  codeOf,
  computeInvoiceTotals,
  contactBalance,
  currentPeriod,
  depreciation,
  expenseOf,
  fiscalYearStart,
  fmt,
  groupExpense,
  incomeOf,
  invoiceRemaining,
  invoiceStatus,
  lastMonths,
  loanSchedule,
  monthlySeries,
  postEntry,
  profitOf,
  projectProfit,
  toAmount,
  toJalali,
  todayISO,
  trialBalance,
  undoEntry,
  validatePosting,
  type Account,
  type Asset,
  type Budget,
  type Cheque,
  type Contact,
  type DB,
  type FarmOp,
  type Invoice,
  type InvoiceItem,
  type Loan,
  type Payment,
  type Posting,
  type Product,
  type Project,
  type Settings,
} from "./engine";

export const STORAGE_KEY = "kishavar.offline.v2";
export const LEGACY_KEY = "kishavar.offline.v1";

export function emptyDB(): DB {
  const accounts: Account[] = CHART.map((a, i) => ({ ...a, id: i + 1 }));
  return {
    version: 2,
    seq: 0,
    savedAt: new Date().toISOString(),
    settings: { business: "کسب‌وکار من", owner: "", taxRate: 9, assistantMode: "assistant", theme: "light" },
    accounts,
    contacts: [],
    entries: [],
    invoices: [],
    payments: [],
    cheques: [],
    loans: [],
    installments: [],
    products: [],
    moves: [],
    assets: [],
    budgets: [],
    projects: [],
    ops: [],
    audit: [],
  };
}

function bump(db: DB): { db: DB; id: number } {
  const id = db.seq + 1;
  return { db: { ...db, seq: id }, id };
}

function audit(db: DB, summary: string, entity = "system", action: "create" | "update" | "undo" | "reset" = "create"): DB {
  return {
    ...db,
    audit: [...db.audit, { id: db.audit.length + 1, at: new Date().toISOString(), action, entity, summary }].slice(-300),
  };
}

/* ------------------------------ بارگذاری/ذخیره ----------------------------- */

export function loadDB(): DB {
  const base = emptyDB();
  if (typeof localStorage === "undefined") return base;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DB>;
      if (parsed && parsed.version === 2 && Array.isArray(parsed.entries) && Array.isArray(parsed.accounts)) {
        return { ...base, ...parsed, accounts: parsed.accounts.length ? parsed.accounts : base.accounts, settings: { ...base.settings, ...parsed.settings } } as DB;
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return migrateLegacy(base, JSON.parse(legacy) as { version?: number; txns?: LegacyTxn[] });
  } catch {
    /* داده‌ی خراب نباید اپ را از کار بیندازد */
  }
  return base;
}

interface LegacyTxn {
  kind?: string;
  amount?: number;
  category?: string;
  date?: string;
  note?: string;
}

const LEGACY_CATEGORY: { re: RegExp; code: string }[] = [
  { re: /کود|بذر|سم|نهاده/, code: "5120" },
  { re: /کارگر|دستمزد/, code: "5110" },
  { re: /سوخت|گازوئیل|بنزین/, code: "5130" },
  { re: /آب|آبیاری|اجاره|برق/, code: "5140" },
  { re: /محصول|فروش|گندم|جو|دام/, code: "4100" },
  { re: /ماشین|تراکتور|تعمیر/, code: "5190" },
];

/** انتقال داده‌ی نسخه‌ی قبلی (تراکنش‌های تک‌طرفه) به دفتر دوطرفه */
export function migrateLegacy(base: DB, legacy: { txns?: LegacyTxn[] }): DB {
  let db = base;
  const txns = Array.isArray(legacy.txns) ? legacy.txns : [];
  for (const txn of txns) {
    const amount = Math.abs(Math.round(Number(txn.amount) || 0));
    if (!amount) continue;
    const kind = txn.kind === "income" ? "income" : "expense";
    const mapped = LEGACY_CATEGORY.find((c) => c.re.test(String(txn.category ?? "")))?.code ?? (kind === "income" ? "4100" : "5190");
    try {
      const posting: Posting = {
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(txn.date)) ? String(txn.date) : todayISO(),
        desc: String(txn.note || txn.category || "انتقال از نسخه قبلی").slice(0, 90),
        source: "manual",
        lines:
          kind === "income"
            ? [
                { accountId: codeOf(db, "1010"), debit: amount, credit: 0 },
                { accountId: codeOf(db, mapped), debit: 0, credit: amount },
              ]
            : [
                { accountId: codeOf(db, mapped), debit: amount, credit: 0 },
                { accountId: codeOf(db, "1010"), debit: 0, credit: amount },
              ],
      };
      db = postEntry(db, posting).db;
    } catch {
      /* ردیف نامعتبر نادیده گرفته می‌شود */
    }
  }
  return audit(db, `انتقال ${txns.length} تراکنش از نسخه قبلی`, "migration", "update");
}

export function saveDB(db: DB): DB {
  const next = { ...db, savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* حافظه پر است؛ داده در نشست فعلی می‌ماند */
  }
  return next;
}

/* --------------------------------- عملیات -------------------------------- */

export interface TxnInput {
  kind: "expense" | "income";
  amount: number;
  date: string;
  desc: string;
  accountId: number;
  categoryId: number;
  contactId?: number | null;
  projectId?: number | null;
}

export function addTransaction(db: DB, input: TxnInput): DB {
  const amount = Math.round(Math.abs(input.amount));
  if (amount <= 0) throw new Error("مبلغ باید بزرگ‌تر از صفر باشد.");
  if (!input.desc.trim()) throw new Error("شرح تراکنش لازم است.");
  const lines =
    input.kind === "income"
      ? [
          { accountId: input.accountId, debit: amount, credit: 0 },
          { accountId: input.categoryId, debit: 0, credit: amount },
        ]
      : [
          { accountId: input.categoryId, debit: amount, credit: 0 },
          { accountId: input.accountId, debit: 0, credit: amount },
        ];
  const { db: next } = postEntry(db, {
    date: input.date,
    desc: input.desc.trim(),
    source: "manual",
    contactId: input.contactId ?? null,
    projectId: input.projectId ?? null,
    lines,
  });
  return next;
}

export function addTransfer(db: DB, input: { amount: number; date: string; desc: string; fromId: number; toId: number }): DB {
  const amount = Math.round(Math.abs(input.amount));
  if (amount <= 0) throw new Error("مبلغ انتقال باید بزرگ‌تر از صفر باشد.");
  if (input.fromId === input.toId) throw new Error("حساب مبدأ و مقصد نباید یکی باشند.");
  const { db: next } = postEntry(db, {
    date: input.date,
    desc: input.desc.trim() || "انتقال بین حساب‌ها",
    source: "manual",
    lines: [
      { accountId: input.toId, debit: amount, credit: 0 },
      { accountId: input.fromId, debit: 0, credit: amount },
    ],
  });
  return next;
}

export function addContact(db: DB, input: { name: string; kind: Contact["kind"]; phone?: string }): DB {
  if (!input.name.trim()) throw new Error("نام طرف‌حساب لازم است.");
  const { db: next, id } = bump(db);
  return audit({ ...next, contacts: [...next.contacts, { id, name: input.name.trim(), kind: input.kind, phone: input.phone?.trim() || undefined }] }, `طرف‌حساب ${input.name}`, "contact");
}

export function addInvoice(
  db: DB,
  input: {
    type: "sale" | "purchase";
    contactId: number;
    date: string;
    due: string;
    items: InvoiceItem[];
    discount: number;
    taxRate: number;
    targetCode?: string;
    applyStock?: boolean;
  },
): DB {
  if (!input.contactId) throw new Error("طرف‌حساب را انتخاب کنید.");
  const items = input.items.filter((it) => it.desc.trim() && it.qty > 0 && it.price > 0);
  if (!items.length) throw new Error("حداقل یک ردیف با تعداد و مبلغ معتبر لازم است.");
  const totals = computeInvoiceTotals(items, input.discount, input.taxRate);
  const { db: next, id } = bump(db);
  const invoice: Invoice = {
    id,
    no: `${input.type === "sale" ? "ف" : "خ"}-${toJalali(new Date()).jy}-${id}`,
    type: input.type,
    contactId: input.contactId,
    date: input.date,
    due: input.due || input.date,
    items,
    discount: totals.discount,
    taxRate: input.taxRate,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    paid: 0,
  };
  const lines =
    input.type === "sale"
      ? [
          { accountId: codeOf(next, "1100"), debit: totals.total, credit: 0 },
          { accountId: codeOf(next, "4100"), debit: 0, credit: totals.total },
        ]
      : [
          { accountId: codeOf(next, input.targetCode ?? "5120"), debit: totals.total, credit: 0 },
          { accountId: codeOf(next, "2100"), debit: 0, credit: totals.total },
        ];
  const posted = postEntry(next, {
    date: input.date,
    desc: `${input.type === "sale" ? "فروش" : "خرید"} — فاکتور ${invoice.no}`,
    source: input.type,
    contactId: input.contactId,
    lines,
  });
  let result: DB = { ...posted.db, invoices: [...posted.db.invoices, invoice] };
  if (input.applyStock) {
    for (const item of items) {
      if (!item.productId) continue;
      const product = result.products.find((p) => p.id === item.productId);
      if (!product) continue;
      const delta = input.type === "purchase" ? item.qty : -item.qty;
      const moveId = result.seq + 1;
      result = {
        ...result,
        seq: moveId,
        products: result.products.map((p) => (p.id === product.id ? { ...p, stock: Math.round((p.stock + delta) * 1000) / 1000 } : p)),
        moves: [...result.moves, { id: moveId, productId: product.id, date: input.date, kind: input.type === "purchase" ? "in" : "out", qty: item.qty, unitCost: item.price, note: invoice.no }],
      };
    }
  }
  return audit(result, `فاکتور ${invoice.no} به مبلغ ${fmt(invoice.total)}`, "invoice");
}

export function addPayment(
  db: DB,
  input: { direction: "in" | "out"; amount: number; date: string; accountId: number; contactId: number | null; method: Payment["method"]; invoiceId?: number | null; note?: string },
): DB {
  const amount = Math.round(Math.abs(input.amount));
  if (amount <= 0) throw new Error("مبلغ پرداخت معتبر نیست.");
  const { db: next, id } = bump(db);
  const lines =
    input.direction === "in"
      ? [
          { accountId: input.accountId, debit: amount, credit: 0 },
          { accountId: codeOf(next, "1100"), debit: 0, credit: amount },
        ]
      : [
          { accountId: codeOf(next, "2100"), debit: amount, credit: 0 },
          { accountId: input.accountId, debit: 0, credit: amount },
        ];
  const posted = postEntry(next, {
    date: input.date,
    desc: `${input.direction === "in" ? "دریافت" : "پرداخت"} ${input.contactId ? `— ${next.contacts.find((c) => c.id === input.contactId)?.name ?? ""}` : "متفرقه"}`,
    source: "payment",
    contactId: input.contactId,
    lines,
  });
  const payment: Payment = {
    id,
    date: input.date,
    direction: input.direction,
    contactId: input.contactId,
    accountId: input.accountId,
    amount,
    method: input.method,
    invoiceId: input.invoiceId ?? null,
    note: input.note,
  };
  let result: DB = { ...posted.db, payments: [...posted.db.payments, payment] };
  if (input.invoiceId) {
    result = {
      ...result,
      invoices: result.invoices.map((inv) => (inv.id === input.invoiceId ? { ...inv, paid: Math.min(inv.total, inv.paid + amount) } : inv)),
    };
  }
  return audit(result, `${input.direction === "in" ? "دریافت" : "پرداخت"} ${fmt(amount)}`, "payment");
}

export function addCheque(db: DB, input: { direction: Cheque["direction"]; serial: string; bank: string; amount: number; due: string; contactId: number | null }): DB {
  if (!input.serial.trim()) throw new Error("شماره چک لازم است.");
  if (input.amount <= 0) throw new Error("مبلغ چک معتبر نیست.");
  const { db: next, id } = bump(db);
  return audit(
    { ...next, cheques: [...next.cheques, { id, direction: input.direction, serial: input.serial.trim(), bank: input.bank.trim() || "—", amount: Math.round(input.amount), due: input.due, contactId: input.contactId, status: "pending" }] },
    `ثبت چک ${input.serial}`,
    "cheque",
  );
}

export function settleCheque(db: DB, chequeId: number, status: "cleared" | "bounced"): DB {
  const cheque = db.cheques.find((c) => c.id === chequeId);
  if (!cheque) throw new Error("چک یافت نشد.");
  if (cheque.status !== "pending") throw new Error("این چک قبلاً تعیین وضعیت شده است.");
  let next: DB = { ...db, cheques: db.cheques.map((c) => (c.id === chequeId ? { ...c, status } : c)) };
  if (status === "cleared") {
    const bank = codeOf(db, "1020");
    const counter = codeOf(db, cheque.direction === "received" ? "1100" : "2100");
    next = postEntry(next, {
      date: todayISO(),
      desc: `وصول چک ${cheque.serial}`,
      source: "cheque",
      contactId: cheque.contactId,
      lines:
        cheque.direction === "received"
          ? [
              { accountId: bank, debit: cheque.amount, credit: 0 },
              { accountId: counter, debit: 0, credit: cheque.amount },
            ]
          : [
              { accountId: counter, debit: cheque.amount, credit: 0 },
              { accountId: bank, debit: 0, credit: cheque.amount },
            ],
    }).db;
  }
  return audit(next, `${status === "cleared" ? "وصول" : "برگشت"} چک ${cheque.serial}`, "cheque", "update");
}

export function addLoan(db: DB, input: { title: string; lender: string; principal: number; rate: number; months: number; start: string }): DB {
  if (input.principal <= 0) throw new Error("مبلغ وام معتبر نیست.");
  const { db: next, id } = bump(db);
  const loan: Loan = { id, title: input.title.trim() || "وام", lender: input.lender.trim(), principal: Math.round(input.principal), rate: input.rate, months: Math.max(1, Math.round(input.months)), start: input.start, accountId: codeOf(next, "1020") };
  const schedule = loanSchedule(loan.principal, loan.rate, loan.months, loan.start);
  const posted = postEntry(next, {
    date: loan.start,
    desc: `دریافت تسهیلات — ${loan.title}`,
    source: "loan",
    lines: [
      { accountId: codeOf(next, "1020"), debit: loan.principal, credit: 0 },
      { accountId: codeOf(next, "2200"), debit: 0, credit: loan.principal },
    ],
  });
  const installments = schedule.map((s) => ({ id: loan.id * 1000 + s.no, loanId: loan.id, no: s.no, due: s.due, principal: s.principal, interest: s.interest, paid: false }));
  return audit({ ...posted.db, loans: [...posted.db.loans, loan], installments: [...posted.db.installments, ...installments] }, `وام ${loan.title} و ${installments.length} قسط`, "loan");
}

export function payInstallment(db: DB, installmentId: number): DB {
  const inst = db.installments.find((i) => i.id === installmentId);
  if (!inst) throw new Error("قسط یافت نشد.");
  if (inst.paid) throw new Error("این قسط قبلاً پرداخت شده است.");
  const loan = db.loans.find((l) => l.id === inst.loanId);
  const total = inst.principal + inst.interest;
  const posted = postEntry(db, {
    date: todayISO(),
    desc: `پرداخت قسط ${inst.no} — ${loan?.title ?? "وام"}`,
    source: "loan",
    lines: [
      { accountId: codeOf(db, "2200"), debit: inst.principal, credit: 0 },
      { accountId: codeOf(db, "5190"), debit: inst.interest, credit: 0 },
      { accountId: loan?.accountId ?? codeOf(db, "1020"), debit: 0, credit: total },
    ],
  });
  return audit({ ...posted.db, installments: posted.db.installments.map((i) => (i.id === installmentId ? { ...i, paid: true } : i)) }, `پرداخت قسط ${inst.no}`, "loan", "update");
}

export function addProduct(db: DB, input: { name: string; unit: string; kind: Product["kind"]; cost: number; price: number; stock: number; min: number }): DB {
  if (!input.name.trim()) throw new Error("نام کالا لازم است.");
  const { db: next, id } = bump(db);
  const product: Product = { id, name: input.name.trim(), unit: input.unit.trim() || "عدد", kind: input.kind, cost: Math.round(input.cost), price: Math.round(input.price), stock: input.stock, min: input.min };
  return audit({ ...next, products: [...next.products, product] }, `کالا ${product.name}`, "product");
}

export function addStockMove(db: DB, input: { productId: number; kind: "in" | "out"; qty: number; unitCost: number; date: string; note?: string }): DB {
  const product = db.products.find((p) => p.id === input.productId);
  if (!product) throw new Error("کالا یافت نشد.");
  if (input.qty <= 0) throw new Error("تعداد باید بزرگ‌تر از صفر باشد.");
  const { db: next, id } = bump(db);
  return audit(
    {
      ...next,
      moves: [...next.moves, { id, productId: product.id, date: input.date, kind: input.kind, qty: input.qty, unitCost: Math.round(input.unitCost), note: input.note }],
      products: next.products.map((p) => (p.id === product.id ? { ...p, stock: Math.round((p.stock + (input.kind === "in" ? input.qty : -input.qty)) * 1000) / 1000 } : p)),
    },
    `${input.kind === "in" ? "ورود" : "خروج"} ${input.qty} ${product.unit} ${product.name}`,
    "stock",
  );
}

export function addAsset(db: DB, input: { name: string; cost: number; salvage: number; lifeMonths: number; purchase: string; paidFromId: number }): DB {
  if (!input.name.trim()) throw new Error("نام دارایی لازم است.");
  if (input.cost <= 0) throw new Error("بهای دارایی معتبر نیست.");
  const { db: next, id } = bump(db);
  const asset: Asset = { id, name: input.name.trim(), purchase: input.purchase, cost: Math.round(input.cost), salvage: Math.round(input.salvage), lifeMonths: Math.max(1, Math.round(input.lifeMonths)) };
  const posted = postEntry(next, {
    date: input.purchase,
    desc: `خرید دارایی ثابت — ${asset.name}`,
    source: "manual",
    lines: [
      { accountId: codeOf(next, "1300"), debit: asset.cost, credit: 0 },
      { accountId: input.paidFromId || codeOf(next, "1020"), debit: 0, credit: asset.cost },
    ],
  });
  return audit({ ...posted.db, assets: [...posted.db.assets, asset] }, `دارایی ${asset.name}`, "asset");
}

export function addBudget(db: DB, input: { accountId: number; amount: number; year: number }): DB {
  if (input.amount <= 0) throw new Error("مبلغ بودجه معتبر نیست.");
  const { db: next, id } = bump(db);
  const budget: Budget = { id, year: input.year, accountId: input.accountId, amount: Math.round(input.amount) };
  return audit({ ...next, budgets: [...next.budgets.filter((b) => !(b.year === budget.year && b.accountId === budget.accountId)), budget] }, `بودجه ${accountName(next, input.accountId)}`, "budget");
}

export function addProject(db: DB, input: { name: string; crop: string; area: number; sharePercent: number }): DB {
  if (!input.name.trim()) throw new Error("نام زمین لازم است.");
  const { db: next, id } = bump(db);
  const project: Project = { id, name: input.name.trim(), crop: input.crop.trim(), area: Number(input.area) || 0, sharePercent: Math.max(0, Math.min(100, Math.round(input.sharePercent))) };
  return audit({ ...next, projects: [...next.projects, project] }, `زمین ${project.name}`, "project");
}

export function addFarmOp(db: DB, input: { projectId: number; date: string; kind: FarmOp["kind"]; desc: string; amount: number; qty?: number; unit?: string; payFromId?: number }): DB {
  if (!input.projectId) throw new Error("زمین را انتخاب کنید.");
  if (!input.desc.trim()) throw new Error("شرح عملیات لازم است.");
  const { db: next, id } = bump(db);
  const op: FarmOp = { id, projectId: input.projectId, date: input.date, kind: input.kind, desc: input.desc.trim(), amount: Math.round(input.amount), qty: input.qty, unit: input.unit };
  let result: DB = { ...next, ops: [...next.ops, op] };
  if (op.amount > 0) {
    const isIncome = input.kind === "sale";
    result = postEntry(result, {
      date: op.date,
      desc: `${input.kind === "sale" ? "فروش" : "عملیات"} ${op.desc}`,
      source: "manual",
      projectId: op.projectId,
      lines: isIncome
        ? [
            { accountId: input.payFromId ?? codeOf(result, "1010"), debit: op.amount, credit: 0 },
            { accountId: codeOf(result, "4100"), debit: 0, credit: op.amount },
          ]
        : [
            { accountId: codeOf(result, input.kind === "labor" ? "5110" : input.kind === "irrigate" ? "5140" : "5190"), debit: op.amount, credit: 0 },
            { accountId: input.payFromId ?? codeOf(result, "1010"), debit: 0, credit: op.amount },
          ],
    }).db;
  }
  return audit(result, `عملیات ${op.desc}`, "farm");
}

export function removeEntry(db: DB, entryId: number): DB {
  const entry = db.entries.find((e) => e.id === entryId);
  if (!entry) throw new Error("سند یافت نشد.");
  return undoEntry(db, entryId);
}

export function updateSettings(db: DB, patch: Partial<Settings>): DB {
  return audit({ ...db, settings: { ...db.settings, ...patch } }, "به‌روزرسانی تنظیمات", "settings", "update");
}

export function resetDB(): DB {
  return audit(emptyDB(), "پاک‌سازی کامل داده‌ها", "system", "reset");
}

/* -------------------------------- داده نمونه ------------------------------- */

export function demoDB(): DB {
  let db = emptyDB();
  db = updateSettings(db, { business: "مزرعه سبز دشت", owner: "حسین کریمی" });
  db = addContact(db, { name: "شرکت لبنیات دشت", kind: "customer", phone: "08132224455" });
  db = addContact(db, { name: "بازار میوه البرز", kind: "customer" });
  db = addContact(db, { name: "نهاده‌های کشاورزی زاگرس", kind: "supplier", phone: "08134456677" });
  db = addContact(db, { name: "اکیپ کارگران برداشت", kind: "worker" });
  db = addProduct(db, { name: "گندم", unit: "کیلوگرم", kind: "product", cost: 15000, price: 21000, stock: 8000, min: 2000 });
  db = addProduct(db, { name: "کود اوره", unit: "کیسه", kind: "input", cost: 2400000, price: 0, stock: 18, min: 20 });
  db = addProduct(db, { name: "گازوئیل", unit: "لیتر", kind: "input", cost: 3000, price: 0, stock: 900, min: 400 });
  db = addProject(db, { name: "زمین شماره ۱ — گندم", crop: "گندم", area: 12.5, sharePercent: 25 });
  db = addProject(db, { name: "زمین شماره ۲ — جو", crop: "جو", area: 6, sharePercent: 0 });
  const today = todayISO();
  const cash = codeOf(db, "1010");
  const bank = codeOf(db, "1020");
  const customer = db.contacts[0].id;
  const supplier = db.contacts[2].id;
  const p1 = db.projects[0].id;

  db = addTransaction(db, { kind: "income", amount: 180_000_000, date: addDays(today, -160), desc: "افتتاح حساب — سرمایه مالک", accountId: bank, categoryId: codeOf(db, "3100") });
  for (let i = 5; i >= 0; i -= 1) {
    const base = addMonths(today, -i);
    db = addTransaction(db, { kind: "income", amount: 210_000_000 + i * 8_000_000, date: addDays(base, -20), desc: "فروش گندم", accountId: bank, categoryId: codeOf(db, "4100"), contactId: customer, projectId: p1 });
    db = addTransaction(db, { kind: "expense", amount: 24_000_000 + i * 1_500_000, date: addDays(base, -16), desc: "دستمزد کارگران برداشت", accountId: cash, categoryId: codeOf(db, "5110"), projectId: p1 });
    db = addTransaction(db, { kind: "expense", amount: 18_000_000 + i * 900_000, date: addDays(base, -14), desc: "خرید کود اوره", accountId: bank, categoryId: codeOf(db, "5120"), contactId: supplier, projectId: p1 });
    db = addTransaction(db, { kind: "expense", amount: 7_500_000, date: addDays(base, -10), desc: "گازوئیل تراکتور", accountId: cash, categoryId: codeOf(db, "5130"), projectId: p1 });
    db = addTransaction(db, { kind: "expense", amount: 4_200_000, date: addDays(base, -6), desc: "آب و برق و اجاره", accountId: bank, categoryId: codeOf(db, "5140") });
  }
  db = addInvoice(db, {
    type: "sale",
    contactId: customer,
    date: addDays(today, -12),
    due: addDays(today, 8),
    items: [{ desc: "گندم — برداشت جاری", qty: 4000, price: 21000, productId: db.products[0].id }],
    discount: 2_000_000,
    taxRate: 9,
    applyStock: true,
  });
  db = addInvoice(db, {
    type: "purchase",
    contactId: supplier,
    date: addDays(today, -40),
    due: addDays(today, -5),
    items: [{ desc: "کود اوره", qty: 20, price: 2_400_000, productId: db.products[1].id }],
    discount: 0,
    taxRate: 9,
    targetCode: "5120",
    applyStock: true,
  });
  db = addPayment(db, { direction: "in", amount: 60_000_000, date: addDays(today, -8), accountId: bank, contactId: customer, method: "bank", invoiceId: db.invoices[0].id });
  db = addCheque(db, { direction: "received", serial: "۴۵۲۱۸۷", bank: "بانک کشاورزی", amount: 85_000_000, due: addDays(today, 5), contactId: customer });
  db = addCheque(db, { direction: "paid", serial: "۹۹۳۴۵۱", bank: "بانک ملت", amount: 42_000_000, due: addDays(today, 14), contactId: supplier });
  db = addLoan(db, { title: "تسهیلات خرید تراکتور", lender: "بانک کشاورزی", principal: 600_000_000, rate: 18, months: 12, start: addMonths(today, -3) });
  db = addAsset(db, { name: "تراکتور مسی فرگوسن", cost: 900_000_000, salvage: 150_000_000, lifeMonths: 96, purchase: addMonths(today, -5), paidFromId: bank });
  db = addAsset(db, { name: "سیستم آبیاری بارانی", cost: 480_000_000, salvage: 40_000_000, lifeMonths: 120, purchase: addMonths(today, -22), paidFromId: bank });
  db = addBudget(db, { accountId: codeOf(db, "5110"), amount: 360_000_000, year: toJalali(new Date()).jy });
  db = addBudget(db, { accountId: codeOf(db, "5120"), amount: 300_000_000, year: toJalali(new Date()).jy });
  db = addFarmOp(db, { projectId: p1, date: addMonths(today, -2), kind: "plant", desc: "کاشت گندم رقم چمران", amount: 0, qty: 2400, unit: "کیلوگرم بذر" });
  db = addFarmOp(db, { projectId: p1, date: addMonths(today, -1), kind: "irrigate", desc: "آبیاری بارانی — نوبت سوم", amount: 7_500_000 });
  db = addFarmOp(db, { projectId: p1, date: addDays(today, -6), kind: "harvest", desc: "برداشت گندم", amount: 0, qty: 12800, unit: "کیلوگرم" });
  return audit(db, "بارگذاری داده نمونه", "system", "update");
}

/* --------------------------------- خروجی‌ها -------------------------------- */

export const REPORTING = {
  currentPeriod,
  lastMonths,
  fiscalYearStart,
  incomeOf,
  expenseOf,
  profitOf,
  cashOf,
  cashFlow,
  balances,
  trialBalance,
  balanceSheet,
  groupExpense,
  monthlySeries,
  aging,
  invoiceStatus,
  invoiceRemaining,
  contactBalance,
  budgetUsage,
  projectProfit,
  depreciation,
  loanSchedule,
  validatePosting,
  toAmount,
};
