import { describe, it, expect } from "vitest";
import {
  breakEvenKg,
  canUndo,
  cashPosition,
  chequeBuckets,
  computeKpis,
  costPerUnit,
  costRatio,
  daysBetween,
  depreciationState,
  depreciationStraightLine,
  grossMargin,
  inverseAction,
  isValidISODate,
  landProfitability,
  revenuePerHectare,
  toToman,
  validateCheque,
  validateDebt,
  validateInventoryMove,
  validateLabor,
  validateTransaction,
  type MutationLogEntry,
} from "@/lib/engine/accounting";
import { applyShare } from "@/lib/engine/money";

const TODAY = "2026-03-21";

describe("toToman", () => {
  it.each([
    ["۲۵۰۰۰۰۰", 2_500_000],
    ["5,000,000", 5_000_000],
    [1500.4, 1500],
    [-250, -250],
    ["abc", 0],
    [null, 0],
    [undefined, 0],
    ["۱۲۳", 123],
    [0, 0],
  ])("%s → %d", (input, expected) => {
    expect(toToman(input as unknown)).toBe(expected);
  });
});

describe("isValidISODate", () => {
  it.each([
    ["2026-03-21", true],
    ["2024-02-29", true],
    ["2025-02-29", false],
    ["2026-13-01", false],
    ["2026-00-10", false],
    ["2026-04-31", false],
    ["1404/08/15", false],
    ["", false],
    ["2026-3-2", false],
  ])("%s → %s", (input, expected) => {
    expect(isValidISODate(input)).toBe(expected);
  });
});

describe("costPerUnit / revenuePerHectare / نسبت‌ها", () => {
  it.each([
    [122_600_000, 55_000, 2229.090909090909],
    [0, 1000, 0],
    [1000, 0, null],
    [1000, -5, null],
  ])("بهای تمام‌شده %d / %d", (cost, yieldKg, expected) => {
    const value = costPerUnit(cost, yieldKg);
    if (expected === null) expect(value).toBeNull();
    else expect(value).toBeCloseTo(expected as number, 5);
  });

  it.each([
    [50_000_000, 12.5, 4_000_000],
    [0, 4, 0],
    [1000, 0, null],
    [1000, -2, null],
  ])("درآمد هر هکتار %d / %d", (income, area, expected) => {
    const value = revenuePerHectare(income, area);
    if (expected === null) expect(value).toBeNull();
    else expect(value).toBe(expected);
  });

  it.each([
    [1000, 700, 0.3],
    [1000, 1000, 0],
    [1000, 1300, -0.3],
    [0, 100, null],
  ])("حاشیه سود %d و %d", (income, expense, expected) => {
    const value = grossMargin(income, expense);
    if (expected === null) expect(value).toBeNull();
    else expect(value).toBeCloseTo(expected, 6);
  });

  it.each([
    [1000, 700, 0.7],
    [0, 700, null],
  ])("نسبت هزینه %d/%d", (income, expense, expected) => {
    const value = costRatio(income, expense);
    if (expected === null) expect(value).toBeNull();
    else expect(value).toBeCloseTo(expected, 6);
  });

  it.each([
    [100_000_000, 25_000, 15_000, 10_000],
    [0, 25_000, 15_000, 0],
    [100_000_000, 15_000, 15_000, null],
    [100_000_000, 10_000, 15_000, null],
  ])("نقطه سربه‌سر %d با حاشیه %d-%d", (fixed, price, variable, expected) => {
    const value = breakEvenKg(fixed, price, variable);
    if (expected === null) expect(value).toBeNull();
    else expect(value).toBeCloseTo(expected as number, 5);
  });
});

describe("استهلاک خط مستقیم", () => {
  it.each([
    [2_000_000_000, 400_000_000, 10, 160_000_000],
    [1_450_000_000, 350_000_000, 12, 91_666_667],
    [100_000_000, 0, 5, 20_000_000],
    [100_000_000, 100_000_000, 5, 0],
    [100_000_000, 200_000_000, 5, 0],
    [100_000_000, 0, 0, 100_000_000],
  ])("(%d−%d)/%d = %d", (price, salvage, life, expected) => {
    expect(depreciationStraightLine(price, salvage, life)).toBe(expected);
  });

  it("ارزش دفتری هرگز منفی نمی‌شود", () => {
    const state = depreciationState(1_000_000_000, 100_000_000, 10, "2010-01-01", TODAY);
    expect(state.bookValue).toBeGreaterThanOrEqual(100_000_000);
    expect(state.fullyDepreciated).toBe(true);
    expect(state.accumulated).toBe(900_000_000);
  });

  it("برای خرید جدید استهلاک انباشته صفر است", () => {
    const state = depreciationState(1_200_000_000, 200_000_000, 10, "2026-03-21", TODAY);
    expect(state.annual).toBe(100_000_000);
    expect(state.accumulated).toBe(0);
    expect(state.bookValue).toBe(1_200_000_000);
    expect(state.fullyDepreciated).toBe(false);
  });

  it.each([
    ["2026-03-21", 0],
    ["2025-03-21", 365],
    ["2024-03-21", 730],
    ["2026-04-21", -31],
  ])("تعداد روز از %s به %s", (from, expected) => {
    expect(daysBetween(from, TODAY)).toBe(expected);
  });
});

describe("cashPosition", () => {
  it("جریان نقدی و اعتباری را جدا می‌کند", () => {
    const result = cashPosition(
      [
        { kind: "income", method: "cash", amount: 100_000_000 },
        { kind: "income", method: "credit", amount: 50_000_000 },
        { kind: "expense", method: "bank", amount: 40_000_000 },
        { kind: "expense", method: "credit", amount: 10_000_000 },
      ],
      20_000_000,
    );
    expect(result).toEqual({
      cashIn: 100_000_000,
      cashOut: 40_000_000,
      creditIn: 50_000_000,
      creditOut: 10_000_000,
      net: 60_000_000,
      liquidityRatio: 5,
    });
  });

  it("در نبود تعهد، نسبت نقدینگی null است", () => {
    const result = cashPosition([{ kind: "income", method: "cash", amount: 1000 }], 0);
    expect(result.liquidityRatio).toBeNull();
  });

  it("مبالغ منفی را صفر می‌کند", () => {
    const result = cashPosition([
      { kind: "income", method: "cash", amount: -500 },
      { kind: "expense", method: "cash", amount: 100 },
    ], 0);
    expect(result.cashIn).toBe(0);
    expect(result.net).toBe(-100);
  });
});

describe("validateTransaction", () => {
  it("تراکنش معتبر را می‌پذیرد", () => {
    const result = validateTransaction(
      { kind: "expense", amount: 25_000_000, date: "2026-03-20", method: "credit", description: "کود اوره", party: "نهاده سبز" },
      TODAY,
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.value?.amount).toBe(25_000_000);
  });

  it.each([
    [{ kind: "transfer", amount: 1000, date: TODAY, method: "cash" }, "kind"],
    [{ kind: "expense", amount: 0, date: TODAY, method: "cash" }, "amount"],
    [{ kind: "expense", amount: -5, date: TODAY, method: "cash" }, "amount"],
    [{ kind: "expense", amount: 1000, date: "1404/08/15", method: "cash" }, "date"],
    [{ kind: "expense", amount: 1000, date: "2027-01-01", method: "cash" }, "date"],
    [{ kind: "expense", amount: 1000, date: TODAY, method: "bitcoin" }, "method"],
    [{ kind: "income", amount: 1000, date: TODAY, method: "cash" }, "categoryId"],
    [{ kind: "expense", amount: 200_000_000_000_000, date: TODAY, method: "cash" }, "amount"],
    [{ kind: "expense", amount: 1000, date: TODAY, method: "cash", description: "x".repeat(301) }, "description"],
    [{ kind: "expense", amount: 1000, date: TODAY, method: "cash", party: "x".repeat(121) }, "party"],
  ])("خطای %#: %o", (input, field) => {
    const result = validateTransaction(input as Parameters<typeof validateTransaction>[0], TODAY);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.field)).toContain(field);
  });

  it("درآمد با دسته معتبر است", () => {
    const result = validateTransaction({ kind: "income", amount: 5_000_000, date: TODAY, categoryId: 3, method: "bank" }, TODAY);
    expect(result.ok).toBe(true);
  });

  it("تاریخ فردا را مجاز می‌داند ولی پس‌فردا را نه", () => {
    expect(validateTransaction({ kind: "expense", amount: 1000, date: "2026-03-22", method: "cash" }, TODAY).ok).toBe(true);
    expect(validateTransaction({ kind: "expense", amount: 1000, date: "2026-03-23", method: "cash" }, TODAY).ok).toBe(false);
  });
});

describe("validateCheque", () => {
  const valid = { party: "فروشگاه نهاده", amount: 44_000_000, dueDate: "2026-11-05", direction: "issued", bank: "بانک ملت" };
  it("چک معتبر", () => {
    expect(validateCheque(valid).ok).toBe(true);
  });
  it.each([
    [{ ...valid, party: "" }, "party"],
    [{ ...valid, party: "ا" }, "party"],
    [{ ...valid, amount: 0 }, "amount"],
    [{ ...valid, dueDate: undefined }, "dueDate"],
    [{ ...valid, dueDate: "1404/08/15" }, "dueDate"],
    [{ ...valid, direction: "unknown" }, "direction"],
    [{ ...valid, serial: "###" }, "serial"],
  ])("خطای چک %#", (input, field) => {
    const result = validateCheque(input);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.field)).toContain(field);
  });
});

describe("validateDebt", () => {
  it("بدهی معتبر", () => {
    expect(validateDebt({ party: "بانک کشاورزی", amount: 85_000_000, direction: "payable", dueDate: "2026-04-14" }).ok).toBe(true);
  });
  it.each([
    [{ party: "", amount: 1000 }, "party"],
    [{ party: "بانک", amount: 0 }, "amount"],
    [{ party: "بانک", amount: 1000, direction: "both" }, "direction"],
    [{ party: "بانک", amount: 1000, dueDate: "bad" }, "dueDate"],
  ])("خطای بدهی %#", (input, field) => {
    const result = validateDebt(input);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.field)).toContain(field);
  });
});

describe("validateLabor", () => {
  it.each([
    [{ workerName: "حسن رضایی", days: 3, dailyWage: 1_300_000, date: TODAY }, 3_900_000],
    [{ workerName: "مریم", days: 0.5, dailyWage: 1_000_000 }, 500_000],
    [{ workerName: "علی", days: 21, dailyWage: 1_150_000 }, 24_150_000],
  ])("جمع دستمزد %#", (input, expected) => {
    const result = validateLabor(input);
    expect(result.ok).toBe(true);
    expect(result.value?.amount).toBe(expected);
  });

  it.each([
    [{ workerName: "", days: 1, dailyWage: 1000 }, "workerName"],
    [{ workerName: "حسن", days: 0, dailyWage: 1000 }, "days"],
    [{ workerName: "حسن", days: 400, dailyWage: 1000 }, "days"],
    [{ workerName: "حسن", days: 1, dailyWage: 0 }, "dailyWage"],
    [{ workerName: "حسن", days: 1, dailyWage: 1000, date: "x" }, "date"],
  ])("خطای دستمزد %#", (input, field) => {
    const result = validateLabor(input);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.field)).toContain(field);
  });
});

describe("validateInventoryMove", () => {
  it("خروج معتبر", () => {
    expect(validateInventoryMove({ quantity: 50, available: 380, kind: "out" }).ok).toBe(true);
  });
  it("خروج بیش از موجودی رد می‌شود", () => {
    const result = validateInventoryMove({ quantity: 500, available: 380, kind: "out" });
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe("stock-insufficient");
  });
  it("ورود بیش از موجودی مجاز است", () => {
    expect(validateInventoryMove({ quantity: 500, available: 380, kind: "in" }).ok).toBe(true);
  });
  it.each([0, -3, Number.NaN])("مقدار نامعتبر %s", (quantity) => {
    expect(validateInventoryMove({ quantity }).ok).toBe(false);
  });
});

describe("Undo / mutation log", () => {
  const base: MutationLogEntry = {
    id: 1,
    kind: "transaction",
    targetId: 12,
    action: "create",
    after: { amount: 1000 },
    before: null,
    at: "2026-03-21T08:00:00.000Z",
    actor: "assistant",
  };

  it("ایجاد ← حذف", () => {
    expect(inverseAction(base)).toEqual({ action: "delete", payload: null });
  });
  it("حذف ← بازگردانی", () => {
    const entry: MutationLogEntry = { ...base, action: "delete", before: { amount: 5000 } };
    expect(inverseAction(entry)).toEqual({ action: "create", payload: { amount: 5000 } });
  });
  it("ویرایش ← مقدار قبلی", () => {
    const entry: MutationLogEntry = { ...base, action: "update", before: { amount: 400 } };
    expect(inverseAction(entry)).toEqual({ action: "update", payload: { amount: 400 } });
  });
  it.each([
    ["2026-03-21T08:10:00.000Z", true],
    ["2026-03-21T20:00:00.000Z", true],
    ["2026-03-25T08:00:00.000Z", false],
    ["2026-03-20T08:00:00.000Z", false],
  ])("امکان واگرد در %s → %s", (now, expected) => {
    expect(canUndo([base], now)).toBe(expected);
  });
  it("لاگ خالی قابل واگرد نیست", () => {
    expect(canUndo([], "2026-03-21T08:00:00.000Z")).toBe(false);
  });
});

describe("KPI و عملکرد زمین", () => {
  const entries = [
    { kind: "income" as const, amount: 196_000_000, method: "credit" as const, date: TODAY, landId: 2, categoryName: "فروش محصول" },
    { kind: "expense" as const, amount: 81_900_000, method: "cash" as const, date: TODAY, landId: 2, categoryName: "کود و سم" },
    { kind: "expense" as const, amount: 34_600_000, method: "cash" as const, date: TODAY, landId: 2, categoryName: "دستمزد کارگر" },
    { kind: "income" as const, amount: 43_700_000, method: "cash" as const, date: TODAY, landId: 1, categoryName: "فروش محصول" },
  ];

  it("خلاصه مالی درست محاسبه می‌شود", () => {
    const kpi = computeKpis(entries);
    expect(kpi.income).toBe(239_700_000);
    expect(kpi.expense).toBe(116_500_000);
    expect(kpi.profit).toBe(123_200_000);
    expect(kpi.count).toBe(4);
    expect(kpi.margin).toBeCloseTo(123_200_000 / 239_700_000, 6);
    expect(kpi.topCategory).toEqual({ name: "کود و سم", amount: 81_900_000 });
    expect(kpi.creditShare).toBeCloseTo(196_000_000 / 356_200_000, 6);
  });

  it("لیست خالی امن است", () => {
    const kpi = computeKpis([]);
    expect(kpi).toMatchObject({ income: 0, expense: 0, profit: 0, count: 0, topCategory: null, creditShare: null });
    expect(kpi.margin).toBeNull();
  });

  it("سود هر زمین و هزینه هر هکتار", () => {
    const rows = landProfitability(
      [
        { id: 1, name: "شمالی", areaHa: 12.5 },
        { id: 2, name: "جنوبی", areaHa: 2 },
        { id: 3, name: "شرقی", areaHa: 0 },
      ],
      entries,
    );
    expect(rows[0]).toMatchObject({ landId: 1, income: 43_700_000, expense: 0, profit: 43_700_000, costPerHa: 0 });
    expect(rows[1].profit).toBe(196_000_000 - 116_500_000);
    expect(rows[1].costPerHa).toBeCloseTo(58_250_000, 5);
    expect(rows[2].costPerHa).toBeNull();
  });

  it("سال زراعی مزارعه با سهم شریک", () => {
    const gross = 196_000_000;
    const share = applyShare(gross, 60);
    expect(share).toBe(117_600_000);
    expect(computeKpis([{ kind: "income", amount: share, date: TODAY, landId: 2 }]).income).toBe(117_600_000);
  });
});

describe("chequeBuckets", () => {
  const cheques = [
    { amount: 10_000_000, dueDate: "2026-03-20", status: "pending", direction: "issued" as const },
    { amount: 5_000_000, dueDate: "2026-03-25", status: "pending", direction: "received" as const },
    { amount: 7_000_000, dueDate: "2026-04-15", status: "pending", direction: "issued" as const },
    { amount: 9_000_000, dueDate: "2026-03-22", status: "passed", direction: "issued" as const },
  ];
  it("دسته‌بندی سررسید", () => {
    const b = chequeBuckets(cheques, TODAY);
    expect(b).toEqual({ overdue: 10_000_000, next7: 5_000_000, next30: 7_000_000, issuedTotal: 17_000_000, receivedTotal: 5_000_000 });
  });
  it("بدون چک", () => {
    expect(chequeBuckets([], TODAY)).toEqual({ overdue: 0, next7: 0, next30: 0, issuedTotal: 0, receivedTotal: 0 });
  });
});
