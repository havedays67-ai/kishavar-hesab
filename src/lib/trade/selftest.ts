import {
  computeTrade,
  defaultPolicy,
  defaultQuality,
  documentSerial,
  getCrop,
  toKg,
  type TradeInput,
} from "@/lib/trade/engine";
import { formatJalaliNumeric, parseJalaliInput } from "@/lib/format";

export interface SelfTestResult {
  id: string;
  title: string;
  passed: boolean;
  expected: string;
  actual: string;
}

function input(overrides: Partial<TradeInput> = {}, qualityOverrides: Record<string, number> = {}): TradeInput {
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
    quality: { ...defaultQuality(crop), moisturePct: 14, foreignMatterPct: 1, ...qualityOverrides },
    policy: { ...defaultPolicy(mode, crop), gradePricing: false, ...(overrides.policy ?? {}) },
    meta: { sellerName: "آزمون", buyerName: "آزمون", contractDate: "2026-01-01", deliveryPlace: "انبار" },
    ...overrides,
  };
}

const close = (a: number, b: number, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

export function runSelfTests(): SelfTestResult[] {
  const results: SelfTestResult[] = [];
  const push = (id: string, title: string, expected: string, actual: string, passed: boolean) =>
    results.push({ id, title, expected, actual, passed });

  push("unit-ton", "تبدیل واحد: ۲۰ تن = ۲۰٬۰۰۰ کیلوگرم", "20000", String(toKg(20, "ton")), toKg(20, "ton") === 20000);
  push("unit-kharvar", "تبدیل واحد: ۱ خروار = ۳۰۰ کیلوگرم", "300", String(toKg(1, "kharvar")), toKg(1, "kharvar") === 300);

  const moisture = computeTrade(input({}, { moisturePct: 16 }));
  const expectedPct = (2 / 86) * 100;
  push(
    "moisture-formula",
    "افت رطوبت وزنی (۱۶٪ در برابر پایه ۱۴٪)",
    `${expectedPct.toFixed(4)}٪`,
    `${moisture.weights.moistureDeductionPct}٪`,
    close(moisture.weights.moistureDeductionPct, expectedPct, 0.001),
  );

  const guaranteed = computeTrade(input({ mode: "guaranteed", policy: { ...defaultPolicy("guaranteed", getCrop("wheat")) } }, { moisturePct: 13, foreignMatterPct: 1 }));
  push(
    "guaranteed-deduction",
    "خرید تضمینی: افت مفید ۳٪ + غیرمفید ۱٪",
    "800",
    String(guaranteed.weights.standardDeductionKg),
    close(guaranteed.weights.standardDeductionKg, 800),
  );
  push("guaranteed-insurance", "خرید تضمینی: حق بیمه ۵۰۰ تومان/کیلو", "> 0", String(guaranteed.money.insuranceToman), guaranteed.money.insuranceToman > 0);

  const overMoisture = computeTrade(input({}, { moisturePct: 19 }));
  push("moisture-reject", "رد تحویل با رطوبت بیش از سقف", "خطا دارد", `${overMoisture.errors.length} خطا`, overMoisture.errors.length > 0);

  const gradeHigh = computeTrade(input({}, { moisturePct: 13, foreignMatterPct: 0.5, hectoliter: 80 }));
  push("grade-1", "درجه‌بندی هکتولیتر ۸۰ → درجه یک", "1", String(gradeHigh.quality.grade), gradeHigh.quality.grade === 1);

  const gradeLow = computeTrade(input({}, { moisturePct: 13, foreignMatterPct: 0.5, hectoliter: 70 }));
  push("grade-reject", "هکتولیتر زیر ۷۲ → رد کیفی", "0", String(gradeLow.quality.grade), gradeLow.quality.grade === 0);

  const total = computeTrade(input({ policy: { ...defaultPolicy("factory", getCrop("wheat")), gradePricing: false, roundToToman: 1000 } }));
  push("round-total", "گرد کردن مبلغ نهایی به مضرب ۱۰۰۰", "true", String(total.money.totalToman % 1000 === 0), total.money.totalToman % 1000 === 0);
  push("net-weight", "وزن خالص ۲۰ تن با رطوبت پایه", "20000", String(total.weights.netKg), total.weights.netKg === 20000);
  push("vat-exempt", "معافیت مالیات محصول فرآوری‌نشده", "0", String(total.money.vatToman), total.money.vatToman === 0);

  const sellerFee = computeTrade(
    input({
      policy: {
        ...defaultPolicy("factory", getCrop("wheat")),
        gradePricing: false,
        commissionPct: 2,
        transportToman: 1000000,
        transportPayer: "seller",
      },
    }),
  );
  const expectedNet = sellerFee.money.grossToman - sellerFee.money.commissionToman - 1000000;
  push("fees", "کسر کارمزد ۲٪ و کرایه از مبلغ محصول", String(expectedNet), String(sellerFee.money.totalToman), close(sellerFee.money.totalToman, expectedNet, 1000));

  const prepaid = computeTrade(
    input({ policy: { ...defaultPolicy("factory", getCrop("wheat")), gradePricing: false, prepaidToman: 1_000_000_000 } }),
  );
  push("prepaid-guard", "عدم منفی شدن مانده با پیش‌پرداخت بزرگ", "0", String(prepaid.money.balanceToman), prepaid.money.balanceToman === 0);

  push("jalali-parse", "تاریخ شمسی ۱۴۰۴/۰۱/۰۱ = 2025-03-21", "2025-03-21", String(parseJalaliInput("۱۴۰۴/۰۱/۰۱")), parseJalaliInput("۱۴۰۴/۰۱/۰۱") === "2025-03-21");
  push("jalali-format", "نمایش 2025-06-05 به شمسی", "۱۴۰۴/۰۳/۱۵", formatJalaliNumeric("2025-06-05"), formatJalaliNumeric("2025-06-05") === "۱۴۰۴/۰۳/۱۵");
  push("jalali-invalid", "رد تاریخ شمسی نامعتبر ۱۴۰۴/۱۳/۰۱", "null", String(parseJalaliInput("1404/13/01")), parseJalaliInput("1404/13/01") === null);

  push("serial", "شماره سریال سند فاکتور", "KH-1404-0001/INV", documentSerial("KH-1404-0001", "invoice"), documentSerial("KH-1404-0001", "invoice") === "KH-1404-0001/INV");
  push("engine-deterministic", "محاسبه تکرارپذیر (Deterministic)", "true", String(JSON.stringify(computeTrade(input())) === JSON.stringify(computeTrade(input()))), JSON.stringify(computeTrade(input())) === JSON.stringify(computeTrade(input())));

  return results;
}

export function selfTestSummary(results: SelfTestResult[]) {
  const passed = results.filter((result) => result.passed).length;
  return { total: results.length, passed, failed: results.length - passed, ok: passed === results.length };
}
