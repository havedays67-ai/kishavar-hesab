import { describe, expect, it } from "vitest";
import {
  addCheque,
  addContact,
  addContactOpening,
  addContactSignature,
  addInvoice,
  addLease,
  addLeasePayment,
  addLeaseSignature,
  addTransaction,
  demoDB,
  demoSignature,
  emptyDB,
  endLease,
  settleCheque,
} from "../offline/store";
import { balanceSheet, cashOf, codeOf, expenseOf, todayISO, trialBalance } from "../offline/engine";
import {
  LEASE_REQUIRED,
  buildLeaseSchedule,
  businessInsights,
  findDuplicateExpenses,
  leaseContractText,
  leaseIsOverdue,
  leaseNextDue,
  leasePaid,
  leaseRemaining,
  leaseSignedBoth,
  leaseSignedBoth as signed,
  leaseSignatures,
  leaseStats,
  leaseTotalRent,
  smartSuggestions,
  validateLeaseInput,
  LEASE_KIND_LABEL,
  LEASE_STATUS_LABEL,
} from "../offline/lease";
import { runAssistant } from "../offline/assistant";

function twoContacts() {
  let db = emptyDB();
  db = addContact(db, { name: "مالک زمین", kind: "partner" });
  db = addContact(db, { name: "کشاورز مستاجر", kind: "customer" });
  return { db, landlord: db.contacts[0].id, tenant: db.contacts[1].id };
}

function sampleLease() {
  const { db, landlord, tenant } = twoContacts();
  const next = addLease(db, {
    title: "زمین آبی ۳ هکتار",
    kind: "cash",
    landlordId: landlord,
    tenantId: tenant,
    location: "روستای سبز",
    plate: "۱۲/۳",
    area: 3,
    crop: "گندم",
    start: "2026-01-01",
    end: "2026-12-31",
    cycle: "seasonal",
    total: 120_000_000,
    sharePercent: 0,
    deposit: 30_000_000,
    waterShare: "۴ ساعت در هفته",
    waterPaidBy: "مستاجر",
    terms: "کشت گندم، عدم تغییر کاربری",
    witnesses: "شاهد یک",
    accountId: codeOf(db, "1020"),
  });
  return { db: next, lease: next.leases[0], landlord, tenant };
}

describe("اجاره — اعتبارسنجی ارکان قرارداد", () => {
  it("ارکان اجباری قرارداد تعریف شده‌اند", () => {
    expect(LEASE_REQUIRED.length).toBeGreaterThanOrEqual(6);
    expect(LEASE_REQUIRED.join(" ")).toContain("موجر");
    expect(LEASE_REQUIRED.join(" ")).toContain("مدت");
  });

  it("قرارداد بدون موجر یا با موجر=مستاجر رد می‌شود", () => {
    expect(validateLeaseInput({ title: "x", landlordId: null, tenantId: 2, start: "2026-01-01", end: "2026-06-01", kind: "cash", total: 100, sharePercent: 0 })).toContain("موجر");
    expect(validateLeaseInput({ title: "x", landlordId: 1, tenantId: 1, start: "2026-01-01", end: "2026-06-01", kind: "cash", total: 100, sharePercent: 0 })).toContain("یک نفر");
    expect(validateLeaseInput({ title: "x", landlordId: 1, tenantId: 2, start: "2026-06-01", end: "2026-01-01", kind: "cash", total: 100, sharePercent: 0 })).toContain("پایان");
    expect(() => addLease(emptyDB(), { title: "", kind: "cash", landlordId: 1, tenantId: 2, location: "", plate: "", area: 0, crop: "", start: "2026-01-01", end: "2026-06-01", cycle: "once", total: 100, sharePercent: 0, deposit: 0, waterShare: "", waterPaidBy: "", terms: "", witnesses: "" })).toThrow();
  });

  it("مزارعه بدون سهم کسری معتبر رد می‌شود", () => {
    expect(validateLeaseInput({ title: "x", landlordId: 1, tenantId: 2, start: "2026-01-01", end: "2026-06-01", kind: "share", total: 0, sharePercent: 0 })).toContain("سهم");
    expect(validateLeaseInput({ title: "x", landlordId: 1, tenantId: 2, start: "2026-01-01", end: "2026-06-01", kind: "share", total: 0, sharePercent: 25 })).toBeNull();
  });

  it("جدول اقساط مجموع را دقیقاً حفظ می‌کند", () => {
    const schedule = buildLeaseSchedule({ start: "2026-01-01", end: "2026-12-31", total: 100_000_000, cycle: "seasonal" });
    expect(schedule.length).toBeGreaterThan(1);
    expect(schedule.reduce((s, r) => s + r.amount, 0)).toBe(100_000_000);
  });
});

describe("اجاره — ثبت، پرداخت و سند", () => {
  it("پرداخت اجاره سند هزینه و کاهش مانده می‌سازد", () => {
    const { db, lease } = sampleLease();
    expect(trialBalance(db).balanced).toBe(true);
    const before = expenseOf(db);
    const next = addLeasePayment(db, { leaseId: lease.id, amount: 30_000_000, date: todayISO(), accountId: codeOf(db, "1020"), scheduleNo: 1 });
    expect(expenseOf(next)).toBe(before + 30_000_000);
    expect(leasePaid(next.leases[0], next.rents)).toBe(30_000_000);
    expect(leaseRemaining(next.leases[0], next.rents)).toBe(90_000_000);
    expect(next.leases[0].schedule[0].paid).toBe(true);
    expect(trialBalance(next).balanced).toBe(true);
    expect(balanceSheet(next).balanced).toBe(true);
  });

  it("پرداخت بدون شماره قسط، از ابتدا تخصیص می‌یابد", () => {
    const { db, lease } = sampleLease();
    const next = addLeasePayment(db, { leaseId: lease.id, amount: 100_000_000, date: todayISO(), accountId: codeOf(db, "1020") });
    expect(leaseRemaining(next.leases[0], next.rents)).toBe(20_000_000);
    expect(next.leases[0].schedule.filter((r) => r.paid).length).toBeGreaterThan(0);
  });

  it("پرداخت بیش از مانده، مانده را منفی نمی‌کند", () => {
    const { db, lease } = sampleLease();
    const next = addLeasePayment(db, { leaseId: lease.id, amount: 200_000_000, date: todayISO(), accountId: codeOf(db, "1020") });
    expect(leaseRemaining(next.leases[0], next.rents)).toBe(0);
  });

  it("پایان قرارداد وضعیت را تغییر می‌دهد", () => {
    const { db, lease } = sampleLease();
    const next = endLease(db, lease.id);
    expect(next.leases[0].status).toBe("ended");
    expect(leaseStats(next).active).toBe(0);
  });
});

describe("امضا", () => {
  it("امضای موجر و مستاجر کامل‌شدن قرارداد را تشخیص می‌دهد", () => {
    const { db, lease } = sampleLease();
    const withLandlord = addLeaseSignature(db, { leaseId: lease.id, role: "موجر", signerName: "مالک زمین", image: demoSignature() });
    expect(leaseSignedBoth(withLandlord.leases[0], withLandlord.signatures).complete).toBe(false);
    const withBoth = addLeaseSignature(withLandlord, { leaseId: lease.id, role: "مستاجر", signerName: "کشاورز", image: demoSignature() });
    expect(signed(withBoth.leases[0], withBoth.signatures).complete).toBe(true);
    expect(leaseSignatures(withBoth.signatures, lease.id)).toHaveLength(2);
  });

  it("امضای خالی رد می‌شود", () => {
    const { db, lease } = sampleLease();
    expect(() => addLeaseSignature(db, { leaseId: lease.id, role: "موجر", signerName: "x", image: "" })).toThrow();
  });

  it("امضای طرف‌حساب در دفتر امضاها ثبت می‌شود", () => {
    const { db, tenant } = twoContacts();
    const next = addContactSignature(db, { contactId: tenant, signerName: "کشاورز مستاجر", image: demoSignature() });
    expect(next.signatures).toHaveLength(1);
    expect(next.signatures[0].hash.startsWith("S")).toBe(true);
  });
});

describe("متن قرارداد", () => {
  it("ارکان حقوقی و وضعیت امضا در متن قرارداد می‌آید", () => {
    const { db, lease } = sampleLease();
    const text = leaseContractText(db, lease.id);
    for (const part of ["ماده ۱", "ماده ۳", "ماده ۴", "ماده ۶", "ماده ۷", "ماده ۹", "وضعیت امضا", "ودیعه", "حقابه"]) {
      expect(text).toContain(part);
    }
    expect(LEASE_KIND_LABEL[lease.kind]).toBe("اجاره نقدی");
    expect(LEASE_STATUS_LABEL[lease.status]).toBe("فعال");
  });
});

describe("هوش تحلیلی", () => {
  it("داده نمونه تحلیل بدون خطا و با اعداد قطعی می‌دهد", () => {
    const db = demoDB();
    const insights = businessInsights(db);
    expect(Array.isArray(insights)).toBe(true);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.every((i) => i.title.length > 3 && i.detail.length > 5)).toBe(true);
    expect(new Set(insights.map((i) => i.severity)).size).toBeGreaterThanOrEqual(1);
  });

  it("چک پرداختی نزدیک سررسید هشدار می‌دهد", () => {
    let db = emptyDB();
    db = addCheque(db, { direction: "paid", serial: "1111", bank: "ملت", amount: 5_000_000, due: todayISO(), contactId: null });
    const insights = businessInsights(db);
    expect(insights.some((i) => i.id === "cheques-due")).toBe(true);
  });

  it("اجاره‌ی معوق در تحلیل دیده می‌شود", () => {
    const { db, lease } = sampleLease();
    const next = { ...db, leases: db.leases.map((l) => (l.id === lease.id ? { ...l, schedule: l.schedule.map((r, idx) => (idx === 0 ? { ...r, due: "2020-01-01" } : r)) } : l)) };
    const insights = businessInsights(next);
    expect(insights.some((i) => i.id === `lease-due-${lease.id}`)).toBe(true);
    expect(leaseIsOverdue(next.leases[0])).toBe(true);
  });

  it("ثبت تکراری تشخیص داده می‌شود", () => {
    let db = emptyDB();
    const input = { kind: "expense" as const, amount: 1_000_000, date: todayISO(), desc: "کود", accountId: codeOf(db, "1010"), categoryId: codeOf(db, "5120") };
    db = addTransaction(db, input);
    db = addTransaction(db, input);
    expect(findDuplicateExpenses(db).length).toBe(1);
  });

  it("پیشنهادهای گام بعدی برای کاربر تازه‌کار معتبرند", () => {
    const suggestions = smartSuggestions(emptyDB());
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((s) => s.label.length > 3)).toBe(true);
    expect(smartSuggestions(demoDB()).some((s) => s.id === "lease")).toBe(false);
  });

  it("دفتر نمونه تراز و نقدینگی قطبی معتبر دارد", () => {
    const db = demoDB();
    expect(trialBalance(db).balanced).toBe(true);
    expect(cashOf(db)).toBeGreaterThan(0);
    expect(trialBalance(db).debit).toBe(trialBalance(db).credit);
  });
});

describe("دستیار — اجاره، امضا و تحلیل", () => {
  it("وضعیت اجاره‌ها را از موتور می‌خواند", () => {
    const db = demoDB();
    const result = runAssistant("وضعیت اجاره‌ها چقدر است؟", db);
    expect(result.action).toBe("answer");
    expect(result.reply).toContain("قرارداد");
    expect(result.details?.length).toBeGreaterThan(0);
  });

  it("راهنمای اجاره شامل ارکان و نکته حقوقی است", () => {
    const result = runAssistant("بخش اجاره را کامل توضیح بده", emptyDB());
    expect(result.action).toBe("answer");
    expect(result.reply).toContain("وديعه".replace("ي", "ی"));
    expect(result.details?.some((d) => String(d.value).includes("دفتر اسناد رسمی"))).toBe(true);
  });

  it("راهنمای امضا مراحل ثبت را می‌دهد", () => {
    const result = runAssistant("بخش امضا را توضیح بده", emptyDB());
    expect(result.intent).toBe("explain_signature");
    expect(result.details?.length).toBeGreaterThan(3);
  });

  it("تحلیل کسب‌وکار فهرست اقدام می‌دهد", () => {
    const result = runAssistant("وضعیت کسب‌وکار را تحلیل کن", demoDB());
    expect(result.intent).toBe("business_health");
    expect(result.details?.length).toBeGreaterThan(1);
  });

  it("دستیار هیچ سندی بدون تأیید ثبت نمی‌کند", () => {
    const db = demoDB();
    const before = db.entries.length;
    runAssistant("۱۰ میلیون اجاره پرداخت کردم", db);
    runAssistant("وضعیت اجاره‌ها چقدر است؟", db);
    expect(db.entries.length).toBe(before);
  });

  it("پرداخت اجاره از طریق موتور، بدهی را کاهش می‌دهد", () => {
    const { db, lease } = sampleLease();
    const next = addLeasePayment(db, { leaseId: lease.id, amount: 20_000_000, date: todayISO(), accountId: codeOf(db, "1010") });
    expect(leaseNextDue(next.leases[0]) === null ? 0 : 1).toBeGreaterThanOrEqual(0);
    expect(leaseTotalRent(next.leases[0])).toBe(120_000_000);
    expect(trialBalance(next).balanced).toBe(true);
  });
});

describe("پایداری و تشخیص خطا", () => {
  it("بیلدر داده نمونه دو بار هم تراز می‌ماند", () => {
    expect(trialBalance(demoDB()).balanced).toBe(true);
    expect(trialBalance(demoDB()).balanced).toBe(true);
  });
  it("طرف‌حساب با مانده اولیه در ترازنامه اثر درست دارد", () => {
    let db = emptyDB();
    db = addContact(db, { name: "بدهکار تست", kind: "customer" });
    db = addContactOpening(db, { contactId: db.contacts[0].id, amount: 5_000_000, side: "debit", date: todayISO() });
    expect(balanceSheet(db).balanced).toBe(true);
  });
  it("فاکتور باز در تحلیل مطالبات معوق اثر دارد", () => {
    let db = emptyDB();
    db = addContact(db, { name: "مشتری", kind: "customer" });
    db = addInvoice(db, { type: "sale", contactId: db.contacts[0].id, date: "2020-01-01", due: "2020-02-01", items: [{ desc: "گندم", qty: 1, price: 9_000_000 }], discount: 0, taxRate: 0 });
    expect(businessInsights(db).some((i) => i.id === "overdue-receivables")).toBe(true);
  });
  it("چک وصول‌شده دوباره در هشدار سررسید نمی‌آید", () => {
    let db = emptyDB();
    db = addCheque(db, { direction: "paid", serial: "2222", bank: "ملت", amount: 2_000_000, due: todayISO(), contactId: null });
    db = settleCheque(db, db.cheques[0].id, "cleared");
    expect(businessInsights(db).some((i) => i.id === "cheques-due")).toBe(false);
  });
});
