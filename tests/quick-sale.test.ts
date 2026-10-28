import { describe, expect, it } from "vitest";
import {
  convertWeight,
  describeWeight,
  formatKg,
  formatTon,
  kgWordsOf,
  moneyWords,
  parseNumericInput,
  toKg,
  toTon,
  tonWordsOf,
  validateWeight,
} from "../app-v2/src/lib/units";
import { computeQuickSale, quickSaleSummary, QUICK_SALE_PRODUCTS, MAX_PRICE_PER_KG } from "../app-v2/src/lib/quick-sale";
import { numberToPersianWords, toEnglishDigits } from "../app-v2/src/lib/format";
import {
  isCustomRole,
  isRoleSelected,
  normalizeStoredRole,
  validateCustomRole,
  PROFILE_ROLE_CHOICES,
  PROFILE_ROLE_OTHER,
} from "../app-v2/src/lib/profile-role";

describe("واحد وزن و نمایش دوگانه (کیلو و تن)", () => {
  it("تبدیل کیلو/تن دقیق و برگشت‌پذیر است", () => {
    expect(toKg(2, "ton")).toBe(2000);
    expect(toTon(2500)).toBe(2.5);
    expect(convertWeight(1500, "kg", "ton")).toBe(1.5);
    expect(convertWeight(1.25, "ton", "kg")).toBe(1250);
    expect(convertWeight(0.001, "ton", "kg")).toBe(1);
  });

  it("هم کیلو و هم تن را با رقم نشان می‌دهد", () => {
    const display = describeWeight(2500);
    expect(display.kgLabel).toBe("۲,۵۰۰ کیلوگرم");
    expect(display.tonLabel).toBe("۲٫۵ تن");
    expect(display.both).toBe("۲,۵۰۰ کیلوگرم (۲٫۵ تن)");
    expect(formatKg(2000)).toBe("۲,۰۰۰ کیلوگرم");
    expect(formatTon(2000)).toBe("۲ تن");
  });

  it("هم کیلو و هم تن را با حروف می‌نویسد", () => {
    expect(kgWordsOf(2000)).toBe("دو هزار کیلوگرم");
    expect(tonWordsOf(2000)).toBe("دو تن");
    expect(tonWordsOf(2500)).toContain("دو تن");
    expect(tonWordsOf(2500)).toContain("پانصد کیلوگرم");
    expect(describeWeight(1500).bothWords).toContain("یک هزار و پانصد کیلوگرم");
    expect(moneyWords(22_500_000)).toBe("بیست و دو میلیون و پانصد هزار تومان");
  });

  it("ورودی نامعتبر را حدس نمی‌زند", () => {
    expect(validateWeight(0, "kg")).toContain("بزرگ‌تر از صفر");
    expect(validateWeight(-2, "ton")).toContain("بزرگ‌تر از صفر");
    expect(validateWeight(null, "kg")).toContain("رقم");
    expect(validateWeight(11_000, "ton")).toContain("سقف");
    expect(validateWeight(1.5, "ton")).toBeNull();
  });

  it("جداکننده‌های فارسی/عربی و کاما را درست می‌خواند", () => {
    expect(parseNumericInput("۲٬۵۰۰")).toBe(2500);
    expect(parseNumericInput("2,500")).toBe(2500);
    expect(parseNumericInput("۲٫۵")).toBe(2.5);
    expect(parseNumericInput("۱۲۵۰۰۰۰۰")).toBe(12_500_000);
    expect(parseNumericInput("")).toBeNull();
    expect(parseNumericInput("abc")).toBeNull();
    expect(parseNumericInput("۱۲abc")).toBeNull();
  });
});

describe("فروش ساده (تخم آفتابگردان و بقیه)", () => {
  const base = {
    product: "تخم آفتابگردان",
    buyer: "شرکت دانه طلایی",
    unit: "ton" as const,
    quantity: 2,
    pricePerKg: 45_000,
    deductionPct: 0,
    transportToman: 0,
    taxPct: 0,
    prepaidToman: 0,
  };

  it("وزن تن را به کیلو تبدیل و مبلغ نهایی را دقیق حساب می‌کند", () => {
    const result = computeQuickSale(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quantity.kg).toBe(2000);
    expect(result.pricePerTon).toBe(45_000_000);
    expect(result.payableToman).toBe(90_000_000);
    expect(result.payableWords).toBe("نود میلیون تومان");
    expect(result.quantity.both).toContain("۲ تن");
  });

  it("افت، حمل، مالیات و پیش‌پرداخت را در مبلغ نهایی لحاظ می‌کند", () => {
    const result = computeQuickSale({ ...base, deductionPct: 2, transportToman: 3_000_000, taxPct: 0, prepaidToman: 10_000_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // ۲ تن با ۲٪ افت = ۱۹۶۰ کیلو × ۴۵٬۰۰۰ = ۸۸٬۲۰۰٬۰۰۰ + ۳٬۰۰۰٬۰۰۰ − ۱۰٬۰۰۰٬۰۰۰
    expect(result.netWeight.kg).toBe(1960);
    expect(result.payableToman).toBe(81_200_000);
    expect(result.steps.length).toBeGreaterThan(3);
  });

  it("پیش‌پرداخت قیمت مؤثر هر کیلو را کم نمی‌کند (باگ قبلی)", () => {
    const result = computeQuickSale({ ...base, unit: "ton", quantity: 1, pricePerKg: 50_000, prepaidToman: 20_000_000, transportToman: 0, deductionPct: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payableToman).toBe(30_000_000);
    // قیمت مؤثر باید همان ۵۰٬۰۰۰ باشد، نه ۳۰٬۰۰۰
    expect(result.effectivePricePerKg).toBe(50_000);
  });

  it("محصول خام کشاورزی پیش‌فرض بدون مالیات است و مقدار مرجع دقیق است", () => {
    const result = computeQuickSale({ ...base, unit: "kg", quantity: 750, pricePerKg: 60_000, deductionPct: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payableToman).toBe(45_000_000);
    expect(result.effectivePricePerKg).toBe(60_000);
    expect(QUICK_SALE_PRODUCTS).toContain("تخم آفتابگردان");
  });

  it("ورودی نامعتبر خطای شفاف می‌دهد و محاسبه نمی‌کند", () => {
    const result = computeQuickSale({ ...base, quantity: null, pricePerKg: 0, deductionPct: 120 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("خلاصهٔ متنی، کیلو و تن و حروف را با هم دارد", () => {
    const result = computeQuickSale(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const summary = quickSaleSummary(result);
    expect(summary).toContain("کیلوگرم");
    expect(summary).toContain("تن");
    expect(summary).toContain("تومان");
    expect(summary).toContain(result.payableWords);
  });
});

describe("رفع باگ‌های قالب‌بندی اعداد", () => {
  it("اعداد منفی به حروف نوشته می‌شوند (قبلاً بی‌صدا صفر می‌شدند)", () => {
    expect(numberToPersianWords(-5)).toBe("منفی پنج");
    expect(numberToPersianWords(-1200)).toBe("منفی یک هزار و دویست");
  });

  it("اعداد بزرگ مقیاس درست می‌گیرند (قبلاً فقط «یک» برمی‌گشت)", () => {
    expect(numberToPersianWords(1_000_000_000_000)).toBe("یک هزار میلیارد");
    expect(numberToPersianWords(1_000_000_000_000_000)).toBe("یک میلیون میلیارد");
    expect(moneyWords(1_000_000_000_000_000)).toContain("میلیون میلیارد");
  });

  it("جداکنندهٔ فارسی در ارقام به لاتین ترجمه می‌شود (قبلاً NaN می‌داد)", () => {
    expect(toEnglishDigits("۲٬۵۰۰")).toBe("2,500");
    expect(toEnglishDigits("۲٫۵")).toBe("2.5");
    expect(Number(toEnglishDigits("۲٬۵۰۰").replace(/,/g, ""))).toBe(2500);
  });
});

describe("نقش «سایر» با ورودی آزاد", () => {
  it("گزینهٔ سایر در انتهای فهرست است و انتخاب آن کادر نوشتن را فعال می‌کند", () => {
    expect(PROFILE_ROLE_CHOICES[PROFILE_ROLE_CHOICES.length - 1]).toBe(PROFILE_ROLE_OTHER);
    expect(isRoleSelected(PROFILE_ROLE_OTHER, "کشاورز")).toBe(false);
    expect(isRoleSelected(PROFILE_ROLE_OTHER, "دامدار")).toBe(true);
    expect(isCustomRole("دامدار")).toBe(true);
    expect(isCustomRole("باغدار")).toBe(false);
  });

  it("نقش سفارشی اعتبارسنجی می‌شود و مقدار خالی/عددی رد می‌شود", () => {
    expect(validateCustomRole("دامدار").ok).toBe(true);
    expect(validateCustomRole("کارشناس بیمهٔ محصول").value).toBe("کارشناس بیمهٔ محصول");
    expect(validateCustomRole("   ").ok).toBe(false);
    expect(validateCustomRole("۱۲۳").ok).toBe(false);
    expect(validateCustomRole("سایر").ok).toBe(false);
    expect(validateCustomRole("a".repeat(60)).value.length).toBe(40);
    expect(validateCustomRole("<script>").ok).toBe(false);
  });

  it("نقش قدیمی پیش‌فرض به «کشاورز» نگاشت می‌شود و «سایر» نمایش نمی‌یابد", () => {
    expect(normalizeStoredRole("کشاورز / مدیر مزرعه")).toBe("کشاورز");
    expect(isCustomRole("کشاورز / مدیر مزرعه")).toBe(false);
    expect(isRoleSelected("کشاورز", "کشاورز / مدیر مزرعه")).toBe(true);
  });
});

describe("نمایش دوگانهٔ وزن با حروف (باگ کسرها)", () => {
  it("کسرهای زیر یک کیلوگرم به گرم تبدیل می‌شوند و گم نمی‌شوند", () => {
    const small = describeWeight(0.25);
    expect(small.tonWords).toBe("دویست و پنجاه گرم");
    expect(small.kgWords).toBe("دویست و پنجاه گرم");
    expect(small.tonWords).not.toContain("صفر کیلوگرم");
  });

  it("۱۰۰۰٫۵ کیلوگرم نیم کیلو را از دست نمی‌دهد", () => {
    const half = describeWeight(1000.5);
    expect(half.tonWords).toBe("یک تن و پانصد گرم");
    expect(half.kgWords).toBe("یک هزار کیلوگرم و پانصد گرم");
  });

  it("مضرب‌های کامل تن و کیلوگرم درست نوشته می‌شوند", () => {
    expect(describeWeight(2500).tonWords).toBe("دو تن و پانصد کیلوگرم");
    expect(describeWeight(2000).tonWords).toBe("دو تن");
    expect(describeWeight(750).kgWords).toBe("هفتصد و پنجاه کیلوگرم");
    expect(describeWeight(0).both).toContain("۰");
  });
});

describe("گارد دقت مبلغ (باگ سرریز عدد صحیح ایمن)", () => {
  it("مبلغ خارج از محدودهٔ دقیق، خطای شفاف می‌دهد نه عدد نادرست", () => {
    const result = computeQuickSale({
      product: "زعفران", buyer: "شرکت", unit: "kg", quantity: 10_000_000, pricePerKg: 1_000_000_000,
      deductionPct: 0, taxPct: 0, transportToman: 0, prepaidToman: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("محدودهٔ دقیق");
  });

  it("قیمت غیرمنطقی هر کیلو رد می‌شود ولی قیمت واقعی زعفران پذیرفته است", () => {
    const absurd = computeQuickSale({ product: "زعفران", buyer: "", unit: "kg", quantity: 1, pricePerKg: MAX_PRICE_PER_KG + 1, deductionPct: 0, taxPct: 0, transportToman: 0, prepaidToman: 0 });
    expect(absurd.ok).toBe(false);
    const saffron = computeQuickSale({ product: "زعفران", buyer: "", unit: "kg", quantity: 1, pricePerKg: 95_000_000, deductionPct: 0, taxPct: 0, transportToman: 0, prepaidToman: 0 });
    expect(saffron.ok).toBe(true);
    if (saffron.ok) expect(saffron.payableToman).toBe(95_000_000);
  });

  it("مبلغ به حروف برای عدد ناایمن خالی می‌ماند", () => {
    expect(moneyWords(Number.MAX_SAFE_INTEGER + 10)).toBe("");
    expect(moneyWords(1500000)).toContain("تومان");
  });
});
