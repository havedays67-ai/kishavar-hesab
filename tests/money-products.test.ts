import { describe, expect, it } from "vitest";
import { digitsOnly, formatAmount, formatAmountInput, formatQuantity, formatTomanAmount, toLatinDigits } from "../app-v2/src/lib/money-format";
import { PRODUCTS, findProductName, normalizeProductQuery, productsByCategory, searchProducts } from "../app-v2/src/lib/products";
import { computeQuickSale } from "../app-v2/src/lib/quick-sale";
import { parseNumericInput } from "../app-v2/src/lib/units";

describe("قالب مبلغ: 100,000,000 در همه‌جا", () => {
  it("ورودی فارسی/عربی/با جداکننده به قالب لاتین تبدیل می‌شود", () => {
    expect(formatAmountInput("100000000")).toBe("100,000,000");
    expect(formatAmountInput("۱۰۰۰۰۰۰۰۰")).toBe("100,000,000");
    expect(formatAmountInput("١٠٠٠٠٠٠٠٠")).toBe("100,000,000");
    expect(formatAmountInput("۱۰۰٬۰۰۰٬۰۰۰")).toBe("100,000,000");
    expect(formatAmountInput("100,000,000")).toBe("100,000,000");
    expect(formatAmountInput("45000")).toBe("45,000");
    expect(formatAmountInput("1000")).toBe("1,000");
  });

  it("ورودی نامعتبر خالی می‌شود و ورودی صفر حفظ می‌شود", () => {
    expect(formatAmountInput("")).toBe("");
    expect(formatAmountInput("abc")).toBe("");
    expect(formatAmountInput("0")).toBe("0");
  });

  it("نمایش مبلغ با واحد همیشه لاتین و جداشده است", () => {
    expect(formatTomanAmount(100_000_000)).toBe("100,000,000 تومان");
    expect(formatTomanAmount(45_000, false)).toBe("45,000");
    expect(formatAmount(1_234_567_890)).toBe("1,234,567,890");
    expect(formatAmount(-2_500)).toBe("-2,500");
    expect(formatAmount(2_500.5)).toBe("2,500.5");
    expect(formatQuantity(2500)).toBe("2,500");
    expect(toLatinDigits("۱۲۳")).toBe("123");
    expect(digitsOnly("۱۲,۰۰۰ تومان")).toBe("12000");
  });

  it("دور رفت‌وبرگشت قالب و تجزیه عدد دقیق است", () => {
    for (const input of ["100000000", "45,000", "۲۵٬۰۰۰٬۰۰۰", "1,000"]) {
      const formatted = formatAmountInput(input);
      const parsed = parseNumericInput(formatted);
      expect(parsed).not.toBeNull();
      expect(formatAmountInput(String(parsed))).toBe(formatted);
    }
  });

  it("قیمت قالب‌بندی‌شده در فروش ساده همان نتیجهٔ عدد خام را می‌دهد", () => {
    const formatted = computeQuickSale({ product: "تخم آفتابگردان", buyer: "شرکت", unit: "ton", quantity: 2.5, pricePerKg: parseNumericInput(formatAmountInput("45,000")) });
    const raw = computeQuickSale({ product: "تخم آفتابگردان", buyer: "شرکت", unit: "ton", quantity: 2.5, pricePerKg: 45000 });
    expect(formatted.ok && raw.ok).toBe(true);
    if (!formatted.ok || !raw.ok) return;
    expect(formatted.payableToman).toBe(raw.payableToman);
  });
});

describe("فهرست محصولات: کامل، مرتب، جستجوپذیر و قابل نوشتن", () => {
  it("همهٔ محصولات در دسته‌های مرتب و بدون تکرار هستند", () => {
    expect(PRODUCTS.length).toBeGreaterThanOrEqual(70);
    const names = PRODUCTS.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
    const grouped = productsByCategory();
    expect(grouped.length).toBeGreaterThanOrEqual(8);
    for (const group of grouped) {
      const sorted = [...group.items].map((item) => item.name);
      expect(sorted).toEqual([...sorted].sort((a, b) => a.localeCompare(b, "fa")));
    }
  });

  it("جستجو مترادف، غلط املایی و انگلیسی را می‌پذیرد", () => {
    expect(searchProducts("آفتابگردان")[0].name).toBe("تخم آفتابگردان");
    expect(searchProducts("افتوگردان")[0].name).toBe("تخم آفتابگردان");
    expect(searchProducts("sunflower")[0].name).toBe("تخم آفتابگردان");
    expect(searchProducts("گندن")[0].name).toBe("گندم");
    expect(searchProducts("شالی")[0].name).toBe("برنج");
    expect(searchProducts("سیب زمینی")[0].name).toBe("سیب‌زمینی");
    expect(searchProducts("چیزی که وجود ندارد")).toHaveLength(0);
    expect(findProductName("برنج")).toBe("برنج");
    expect(normalizeProductQuery("آفتابگردان")).toBe("افتابگردان");
  });
});
