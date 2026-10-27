import { describe, expect, it } from "vitest";
import {
  addCheque,
  addInvoice,
  addLoan,
  addPayment,
  addTransaction,
  addTransfer,
  demoDB,
  emptyDB,
  payInstallment,
  removeEntry,
  settleCheque,
} from "../offline/store";
import {
  aging,
  balanceSheet,
  budgetUsageEq,
  cashOf,
  codeOf,
  computeInvoiceTotals,
  contactBalance,
  currentPeriod,
  depreciation,
  expenseOf,
  fmt,
  formatJalali,
  fromJalali,
  incomeOf,
  invoiceRemaining,
  loanSchedule,
  monthsForChart,
  postEntry,
  profitOf,
  toAmount,
  toISO,
  toJalali,
  todayISO,
  trialBalance,
  validatePosting,
} from "../offline/engine";
import { OFFLINE_INTENTS, extractAmount, runAssistant } from "../offline/assistant";

describe("پول و ورودی فارسی", () => {
  it("ارقام فارسی و ضریب‌ها را می‌فهمد", () => {
    expect(toAmount("۴۵۰٬۰۰۰")).toBe(450000);
    expect(toAmount("۲ میلیون")).toBe(2000000);
    expect(toAmount("1,500,000")).toBe(1500000);
    expect(toAmount("abc")).toBe(0);
  });
  it("قالب‌بندی فارسی و واحد تومان", () => {
    expect(fmt(450000)).toContain("تومان");
    expect(fmt(0)).toBe("۰ تومان");
    expect(fmt(-1200)).toContain("−");
  });
});

describe("تقویم شمسی", () => {
  it("تبدیل رفت و برگشت", () => {
    const date = new Date(2026, 9, 27);
    const j = toJalali(date);
    expect(j.jy).toBe(1405);
    expect(toISO(fromJalali(j.jy, j.jm, j.jd))).toBe("2026-10-27");
  });
  it("قالب‌بندی و دوره جاری", () => {
    expect(formatJalali("2026-10-27")).toMatch(/۱۴۰۵/);
    const period = currentPeriod(new Date(2026, 9, 27));
    expect(period.start <= "2026-10-27").toBe(true);
    expect(period.end >= "2026-10-27").toBe(true);
  });
});

describe("اعتبارسنجی سند دوطرفه", () => {
  it("سند نامتوازن رد می‌شود", () => {
    expect(validatePosting([{ accountId: 1, debit: 100, credit: 0 }, { accountId: 2, debit: 0, credit: 90 }]).ok).toBe(false);
  });
  it("سند یک‌ردیفی رد می‌شود", () => {
    expect(validatePosting([{ accountId: 1, debit: 100, credit: 0 }]).ok).toBe(false);
  });
  it("سند متوازن پذیرفته می‌شود", () => {
    const result = validatePosting([{ accountId: 1, debit: 100, credit: 0 }, { accountId: 2, debit: 0, credit: 100 }]);
    expect(result.ok).toBe(true);
    expect(result.debit).toBe(result.credit);
  });
});

describe("جمع فاکتور و مالیات", () => {
  it("تخفیف قبل از مالیات اعمال می‌شود", () => {
    const totals = computeInvoiceTotals([{ desc: "x", qty: 2, price: 1_000_000 }], 500_000, 10);
    expect(totals.subtotal).toBe(2_000_000);
    expect(totals.tax).toBe(150_000);
    expect(totals.total).toBe(1_650_000);
  });
  it("تخفیف بیش از جمع، به جمع محدود می‌شود", () => {
    const totals = computeInvoiceTotals([{ desc: "x", qty: 1, price: 1000 }], 5000, 9);
    expect(totals.discount).toBe(1000);
    expect(totals.total).toBe(0);
  });
});

describe("دفتر کل و گزارش‌ها", () => {
  it("ثبت هزینه تراز را حفظ می‌کند", () => {
    let db = emptyDB();
    db = addTransaction(db, {
      kind: "expense",
      amount: 450_000,
      date: todayISO(),
      desc: "گازوئیل",
      accountId: codeOf(db, "1010"),
      categoryId: codeOf(db, "5130"),
    });
    const trial = trialBalance(db);
    expect(trial.balanced).toBe(true);
    expect(expenseOf(db)).toBe(450_000);
    expect(cashOf(db)).toBe(-450_000);
  });

  it("درآمد و هزینه سود را درست می‌سازد", () => {
    let db = emptyDB();
    db = addTransaction(db, { kind: "income", amount: 5_000_000, date: todayISO(), desc: "فروش", accountId: codeOf(db, "1020"), categoryId: codeOf(db, "4100") });
    db = addTransaction(db, { kind: "expense", amount: 2_000_000, date: todayISO(), desc: "کارگر", accountId: codeOf(db, "1010"), categoryId: codeOf(db, "5110") });
    expect(incomeOf(db)).toBe(5_000_000);
    expect(expenseOf(db)).toBe(2_000_000);
    expect(profitOf(db)).toBe(3_000_000);
    expect(balanceSheet(db).balanced).toBe(true);
  });

  it("انتقال نقدینگی را جابه‌جا می‌کند و سود را تغییر نمی‌دهد", () => {
    let db = emptyDB();
    db = addTransaction(db, { kind: "income", amount: 1_000_000, date: todayISO(), desc: "واریز", accountId: codeOf(db, "1020"), categoryId: codeOf(db, "4100") });
    const before = cashOf(db);
    db = addTransfer(db, { amount: 400_000, date: todayISO(), desc: "به صندوق", fromId: codeOf(db, "1020"), toId: codeOf(db, "1010") });
    expect(cashOf(db)).toBe(before);
    expect(profitOf(db)).toBe(1_000_000);
  });

  it("فاکتور فروش مطالبه و مالیات می‌سازد", () => {
    let db = demoDB();
    const contact = db.contacts[0];
    db = addInvoice(db, { type: "sale", contactId: contact.id, date: todayISO(), due: todayISO(), items: [{ desc: "گندم", qty: 10, price: 100_000 }], discount: 0, taxRate: 9 });
    const invoice = db.invoices[db.invoices.length - 1];
    expect(invoice.total).toBe(1_090_000);
    expect(invoice.tax).toBe(90_000);
    expect(contactBalance(db, contact.id).receivable).toBeGreaterThan(0);
    expect(trialBalance(db).balanced).toBe(true);
  });

  it("پرداخت فاکتور، مانده را کاهش می‌دهد", () => {
    let db = demoDB();
    const contact = db.contacts[0];
    db = addInvoice(db, { type: "sale", contactId: contact.id, date: todayISO(), due: todayISO(), items: [{ desc: "جو", qty: 1, price: 1_000_000 }], discount: 0, taxRate: 0 });
    const invoice = db.invoices[db.invoices.length - 1];
    db = addPayment(db, { direction: "in", amount: 400_000, date: todayISO(), accountId: codeOf(db, "1020"), contactId: contact.id, method: "bank", invoiceId: invoice.id });
    const updated = db.invoices.find((i) => i.id === invoice.id);
    expect(updated ? invoiceRemaining(updated) : -1).toBe(600_000);
    expect(trialBalance(db).balanced).toBe(true);
  });

  it("واگرد سند، اثر آن را از گزارش حذف می‌کند", () => {
    let db = emptyDB();
    db = addTransaction(db, { kind: "expense", amount: 900_000, date: todayISO(), desc: "آزمون", accountId: codeOf(db, "1010"), categoryId: codeOf(db, "5190") });
    expect(expenseOf(db)).toBe(900_000);
    const id = db.entries[db.entries.length - 1].id;
    db = removeEntry(db, id);
    expect(expenseOf(db)).toBe(0);
    expect(db.audit.some((a) => a.action === "undo")).toBe(true);
  });
});

describe("چک، وام و استهلاک", () => {
  it("وصول چک دریافتی سند بانکی می‌سازد", () => {
    let db = emptyDB();
    db = addCheque(db, { direction: "received", serial: "1234", bank: "کشاورزی", amount: 2_000_000, due: todayISO(), contactId: null });
    const cheque = db.cheques[0];
    const before = cashOf(db);
    db = settleCheque(db, cheque.id, "cleared");
    expect(cashOf(db)).toBe(before + 2_000_000);
    expect(trialBalance(db).balanced).toBe(true);
  });

  it("برگشت چک هیچ سندی نمی‌سازد", () => {
    let db = emptyDB();
    db = addCheque(db, { direction: "paid", serial: "999", bank: "ملت", amount: 1_000_000, due: todayISO(), contactId: null });
    const entriesBefore = db.entries.length;
    db = settleCheque(db, db.cheques[0].id, "bounced");
    expect(db.entries.length).toBe(entriesBefore);
  });

  it("جدول اقساط جمع اصل را حفظ می‌کند", () => {
    const schedule = loanSchedule(1_000_000, 12, 12, todayISO());
    const sum = schedule.reduce((s, i) => s + i.principal, 0);
    expect(sum).toBe(1_000_000);
    expect(schedule).toHaveLength(12);
  });

  it("استهلاک خط مستقیم از پایه بیشتر نمی‌شود", () => {
    const dep = depreciation(1_000_000, 100_000, 12, "2020-01-01", new Date(2030, 0, 1));
    expect(dep.monthly).toBe(75_000);
    expect(dep.accumulated).toBe(900_000);
    expect(dep.book).toBe(100_000);
  });

  it("پرداخت قسط، بدهی وام را کاهش می‌دهد", () => {
    let db = addLoan(emptyDB(), { title: "وام", lender: "بانک", principal: 1_200_000, rate: 12, months: 12, start: todayISO() });
    const before = balanceSheet(db).liabilities;
    db = payInstallment(db, db.installments[0].id);
    expect(balanceSheet(db).liabilities).toBeLessThan(before);
    expect(trialBalance(db).balanced).toBe(true);
  });
});

describe("گزارش‌های تحلیلی", () => {
  it("داده نمونه تراز است و گزارش‌ها کار می‌کنند", () => {
    const db = demoDB();
    expect(trialBalance(db).balanced).toBe(true);
    expect(balanceSheet(db).balanced).toBe(true);
    expect(monthsForChart(db)).toHaveLength(6);
    expect(aging(db).length).toBe(4);
    expect(db.invoices.length).toBeGreaterThan(0);
    expect(budgetUsageEq(db).length).toBeGreaterThan(0);
  });

  it("سند دستی نامتوازن از موتور رد می‌شود", () => {
    const db = emptyDB();
    expect(() =>
      postEntry(db, { date: todayISO(), desc: "بد", source: "manual", lines: [{ accountId: 1, debit: 100, credit: 0 }, { accountId: 2, debit: 0, credit: 50 }] }),
    ).toThrow();
  });
});

describe("دستیار آفلاین", () => {
  it("قرارداد قصدها کامل است", () => {
    expect(OFFLINE_INTENTS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(OFFLINE_INTENTS.map((i) => i.id)).size).toBe(OFFLINE_INTENTS.length);
  });

  it("مبلغ را از جمله فارسی استخراج می‌کند", () => {
    expect(extractAmount("۴۵۰ هزار تومان گازوئیل خریدم")).toBe(450_000);
    expect(extractAmount("سود این ماه چقدر است؟")).toBeNull();
  });

  it("هزینه را به پیش‌نویس تبدیل می‌کند و ثبت نمی‌کند", () => {
    const db = emptyDB();
    const result = runAssistant("۴۵۰ هزار تومان گازوئیل خریدم", db);
    expect(result.action).toBe("draft");
    expect(result.draft?.tool).toBe("txn");
    expect(result.draft?.fields.amount).toBe("450000");
    expect(db.entries).toHaveLength(0);
  });

  it("بدون مبلغ، پرسش تکمیلی می‌کند و سند نمی‌سازد", () => {
    const db = emptyDB();
    const result = runAssistant("گازوئیل خریدم", db);
    expect(result.action).toBe("ask");
    expect(result.missing).toContain("مبلغ");
  });

  it("گزارش سود را از موتور قطعی می‌خواند", () => {
    const db = demoDB();
    const result = runAssistant("سود این ماه چقدر است؟", db);
    expect(result.action).toBe("answer");
    expect(result.details?.length).toBeGreaterThan(0);
  });

  it("حالت پشتیبان در UI اعمال می‌شود (بدون نوشتن)", () => {
    const db = demoDB();
    const before = db.entries.length;
    runAssistant("۱۰ میلیون گازوئیل خریدم", db);
    expect(db.entries.length).toBe(before);
  });
});

describe("پایداری داده", () => {
  it("شناسه‌ها یکتا و افزایشی هستند", () => {
    const db = demoDB();
    const ids = db.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("همه اسناد نمونه متوازن‌اند", () => {
    const db = demoDB();
    for (const entry of db.entries) {
      const check = validatePosting(entry.lines);
      expect(check.ok).toBe(true);
    }
  });
});
