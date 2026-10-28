import { round } from "../src/lib/trade/engine";
import { describe, expect, it } from "vitest";
import {
  computeTrade,
  defaultPolicy,
  defaultQuality,
  documentSerial,
  getCrop,
  statusFor,
  toKg,
  type TradeInput,
} from "@/lib/trade/engine";
import { formatJalaliNumeric, jalaliToISO, parseJalaliInput } from "@/lib/format";
import { runSelfTests } from "@/lib/trade/selftest";

function input(overrides: Partial<TradeInput> = {}, quality: Record<string, number> = {}): TradeInput {
  const crop = getCrop(overrides.cropKey ?? "wheat");
  const mode = overrides.mode ?? "factory";
  return {
    direction: "sell",
    mode,
    cropKey: crop.key,
    unit: "ton",
    quantity: 20,
    grossKg: 0,
    tareKg: 0,
    pricePerKgToman: 50000,
    quality: { ...defaultQuality(crop), moisturePct: 14, foreignMatterPct: 1, ...quality },
    policy: { ...defaultPolicy(mode, crop), gradePricing: false, ...(overrides.policy ?? {}) },
    meta: { sellerName: "آزمون", buyerName: "کارخانه", contractDate: "2026-01-01", deliveryPlace: "سیلو" },
    ...overrides,
  };
}

describe("موتور معامله محصول", () => {
  it("واحدها را دقیق تبدیل می‌کند", () => {
    expect(toKg(1, "ton")).toBe(1000);
    expect(toKg(1, "kharvar")).toBe(300);
    expect(toKg(2.5, "kg")).toBe(2.5);
  });

  it("وزن خالص را از باسکول محاسبه می‌کند", () => {
    const calc = computeTrade(input({ grossKg: 31200, tareKg: 6200 }));
    expect(calc.weights.netKg).toBe(25000);
    expect(calc.weights.netTon).toBe(25);
  });

  it("افت رطوبت را با فرمول وزنی حساب می‌کند", () => {
    const calc = computeTrade(input({}, { moisturePct: 16 }));
    expect(calc.weights.moistureDeductionPct).toBeCloseTo((2 / 86) * 100, 2);
    expect(calc.weights.moistureDeductionKg).toBeGreaterThan(400);
  });

  it("افت مفید و غیرمفید خرید تضمینی را اعمال می‌کند", () => {
    const calc = computeTrade(input({ mode: "guaranteed" }, { moisturePct: 13, hectoliter: 79 }));
    expect(calc.weights.standardDeductionKg).toBe(800);
    expect(calc.money.insuranceToman).toBeGreaterThan(0);
  });

  it("محصول با رطوبت بیش از سقف را رد می‌کند", () => {
    const calc = computeTrade(input({}, { moisturePct: 18 }));
    expect(calc.quality.grade).toBe(0);
    expect(calc.errors.length).toBeGreaterThan(0);
  });

  it("درجه‌بندی هکتولیتر را رعایت می‌کند", () => {
    expect(computeTrade(input({}, { moisturePct: 13, foreignMatterPct: 0.5, hectoliter: 79 })).quality.grade).toBe(1);
    expect(computeTrade(input({}, { moisturePct: 13, foreignMatterPct: 0.5, hectoliter: 76 })).quality.grade).toBe(2);
    expect(computeTrade(input({}, { moisturePct: 13, foreignMatterPct: 0.5, hectoliter: 73 })).quality.grade).toBe(3);
    expect(computeTrade(input({}, { moisturePct: 13, foreignMatterPct: 0.5, hectoliter: 70 })).quality.grade).toBe(0);
  });

  it("کارمزد، کرایه و مالیات را در مبلغ نهایی لحاظ می‌کند", () => {
    const base = computeTrade(input());
    const withFees = computeTrade(
      input({ policy: { ...defaultPolicy("factory", getCrop("wheat")), gradePricing: false, commissionPct: 2, transportToman: 1_000_000 } }),
    );
    expect(withFees.money.commissionToman).toBeGreaterThan(0);
    expect(withFees.money.totalToman).toBeLessThan(base.money.totalToman);
    expect(withFees.money.vatToman).toBe(0);
  });

  it("مبلغ را به مضرب تعیین‌شده گرد می‌کند", () => {
    const calc = computeTrade(input({ policy: { ...defaultPolicy("factory", getCrop("wheat")), gradePricing: false, roundToToman: 5000 } }));
    expect(calc.money.totalToman % 5000).toBe(0);
  });

  it("مانده را منفی نمی‌کند", () => {
    const calc = computeTrade(input({ policy: { ...defaultPolicy("factory", getCrop("wheat")), gradePricing: false, prepaidToman: 10_000_000_000 } }));
    expect(calc.money.balanceToman).toBe(0);
  });

  it("وضعیت تسویه را از مبلغ و دریافتی می‌سازد", () => {
    expect(statusFor(1000, 1000, "confirmed")).toBe("settled");
    expect(statusFor(1000, 0, "draft")).toBe("draft");
    expect(statusFor(1000, 0, "confirmed")).toBe("confirmed");
    expect(statusFor(1000, 1000, "canceled")).toBe("canceled");
  });

  it("شماره سریال اسناد را یکتا می‌سازد", () => {
    expect(documentSerial("KH-1405-0007", "invoice")).toBe("KH-1405-0007/INV");
    expect(documentSerial("KH-1405-0007", "contract")).not.toBe(documentSerial("KH-1405-0007", "invoice"));
  });

  it("محاسبه تکرارپذیر است", () => {
    expect(JSON.stringify(computeTrade(input()))).toBe(JSON.stringify(computeTrade(input())));
  });
});

describe("تاریخ شمسی", () => {
  it("تبدیل رفت و برگشت درست است", () => {
    expect(jalaliToISO(1404, 1, 1)).toBe("2025-03-21");
    expect(formatJalaliNumeric("2025-06-05")).toBe("۱۴۰۴/۰۳/۱۵");
  });

  it("ورودی معتبر و نامعتبر را تشخیص می‌دهد", () => {
    expect(parseJalaliInput("۱۴۰۴/۱/۱")).toBe("2025-03-21");
    expect(parseJalaliInput("1404-12-30")).toBeNull();
    expect(parseJalaliInput("1404/13/01")).toBeNull();
  });
});

describe("آزمون‌های خودکار سامانه", () => {
  it("همه آزمون‌های داخلی موفق هستند", () => {
    const results = runSelfTests();
    const failed = results.filter((result) => !result.passed);
    expect(failed.map((item) => `${item.id}: ${item.actual}`).join(" | ")).toBe("");
  });
});

describe("ثبات گرد کردن مالی (باگ متقارن‌نبودن)", () => {
  it("گرد کردن منفی دقیقاً متقارن مثبت است", () => {
    expect(round(-1.005, 2)).toBe(-round(1.005, 2));
    expect(round(-2.675, 2)).toBe(-round(2.675, 2));
    expect(round(-1234.5)).toBe(-1235);
    expect(round(-0.4)).toBe(0);
    expect(Object.is(round(-0.4), -0)).toBe(false);
    expect(round(2.5)).toBe(3);
    expect(round(-2.5)).toBe(-3);
  });
});
