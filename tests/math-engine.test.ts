import { describe, expect, it } from "vitest";
import {
  formatRatio,
  prepareMathText,
  ratio,
  roundRatio,
  solveMath,
  verbalToDigits,
  expandDigitScales,
} from "../app-v2/src/lib/ai/math-engine";
import { answerCache, resetAnswerCache, AnswerCache } from "../app-v2/src/lib/ai/answer-cache";
import { routeFast } from "../app-v2/src/lib/nlu/router";

const value = (text: string) => solveMath(text)?.value;

describe("موتور ریاضی قطعی (BigInt، بدون float)", () => {
  it("اعشار دقیق است و خطای ممیز شناور ندارد", () => {
    expect(formatRatio(value("۰.۱ + ۰.۲")!, 10)).toBe("0.3");
    expect(formatRatio(value("۰.۷ + ۰.۱")!, 10)).toBe("0.8");
    expect(formatRatio(value("۱.۱ × ۳")!, 10)).toBe("3.3");
    expect(formatRatio(value("۱۰۰ ÷ ۳")!, 6)).toBe("33.333333");
  });

  it("اولویت عملگرها و پرانتز درست است", () => {
    expect(formatRatio(value("۲ + ۳ × ۴")!)).toBe("14");
    expect(formatRatio(value("(۲ + ۳) × ۴")!)).toBe("20");
    expect(formatRatio(value("۲ به توان ۱۰")!)).toBe("1024");
    expect(formatRatio(value("۱۰ - ۲ - ۳")!)).toBe("5");
    expect(formatRatio(value("۱۰۰ ÷ (۲ × ۵)")!)).toBe("10");
  });

  it("درصد، تخفیف، مالیات، سهم، واحد، مساحت، رطوبت و سود را دقیق حساب می‌کند", () => {
    expect(formatRatio(value("۱۸ درصد از ۲۵,۰۰۰,۰۰۰ تومان")!)).toBe("4500000");
    expect(formatRatio(value("۲۵ میلیون تومان با ۱۰ درصد تخفیف")!)).toBe("22500000");
    expect(formatRatio(value("۲ تن به کیلوگرم")!)).toBe("2000");
    expect(formatRatio(value("۵۰۰ کیلو چند تن")!)).toBe("0.5");
    expect(formatRatio(value("۴۰ در ۶۰ متر")!)).toBe("2400");
    expect(formatRatio(value("۱۲۰ میلیون بین ۳ نفر")!)).toBe("40000000");
    expect(formatRatio(value("فروش ۱۲۰ میلیون هزینه ۹۰ میلیون")!)).toBe("30000000");
    expect(formatRatio(value("میانگین ۱۰ و ۲۰ و ۳۰")!)).toBe("20");
    expect(formatRatio(value("۱۰۰۰ کیلو گندم رطوبت ۱۶ پایه ۱۴")!, 3)).toBe("23.256");
  });

  it("عدد حرفی و مقیاس واژه‌ای را دقیق ترکیب می‌کند", () => {
    expect(verbalToDigits("دو میلیون و پانصد هزار")).toBe("2500000");
    expect(expandDigitScales("۲۵ میلیون")).toBe("25000000");
    expect(formatRatio(value("دو میلیون و پانصد هزار + ۵۰۰ هزار")!)).toBe("3000000");
  });

  it("تقسیم بر صفر، ورودی بی‌ربط و جمله‌های ثبت روزمره را حل نمی‌کند", () => {
    expect(solveMath("۱۰۰ تقسیم بر صفر")).toBeNull();
    expect(solveMath("سلام خوبی")).toBeNull();
    expect(solveMath("۲۵ میلیون تومان کود خریدم")).toBeNull();
    expect(solveMath("")).toBeNull();
    expect(solveMath("۹".repeat(400))).toBeNull();
  });

  it("گرد کردن مالی نیم‌به‌بالا و متقارن است", () => {
    expect(roundRatio(ratio(5n, 2n))).toBe(3n);
    expect(roundRatio(ratio(-5n, 2n))).toBe(-3n);
    expect(roundRatio(ratio(24n, 10n))).toBe(2n);
  });

  it("هیچ مبلغی در خروجی کش/حافظه نوشته نمی‌شود", () => {
    const result = solveMath("۱۸ درصد از ۲۵,۰۰۰,۰۰۰ تومان");
    expect(result).not.toBeNull();
    const key = prepareMathText("۱۸ درصد از ۲۵,۰۰۰,۰۰۰ تومان");
    expect(key).toContain("25000000");
    // خروجی حل، فقط شیء محاسبه است و در کش ذخیره نمی‌شود
    expect(JSON.stringify(answerCache().dump())).not.toContain("4500000");
  });
});

describe("کش پاسخ‌های آماده", () => {
  it("فقط شناسه ذخیره می‌کند، مبلغ نه؛ LRU و پاک‌سازی کار می‌کند", () => {
    resetAnswerCache();
    const cache = new AnswerCache(3);
    expect(cache.put("آیا چک چاپی معتبر است", { id: "qa-cheque-print", tag: "حقوقی", createdAt: 1 })).toBe(true);
    // کلید همیشه ماسک‌شده است: هیچ رقمی در کش نمی‌ماند
    expect(cache.put("متن ۲۵ میلیون", { id: "x", tag: "مالی", createdAt: 2 })).toBe(true);
    expect(cache.dump().map((item) => item.id + item.tag).join(" ")).not.toMatch(/[0-9۰-۹]/);
    for (let index = 0; index < 6; index += 1) cache.put(`پرسش شمارهٔ ${"الف".repeat(index + 1)}`, { id: `qa-${index}`, tag: "برنامه", createdAt: index });
    expect(cache.size()).toBeLessThanOrEqual(3);
    // آخرین ورودی باقی است و قدیمی‌ترها با LRU بیرون رفته‌اند
    expect(cache.get(`پرسش شمارهٔ ${"الف".repeat(6)}`)?.id).toBe("qa-5");
    expect(cache.get("آیا چک چاپی معتبر است")).toBeNull();
    expect(cache.stats().storesMoney).toBe(false);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});

describe("Router — لایهٔ ریاضی", () => {
  it("مسئلهٔ ریاضی پیش از قواعد و مدل با موتور قطعی حل می‌شود", () => {
    const result = routeFast("۱۸ درصد از ۲۵ میلیون تومان", { mode: "assistant" });
    expect(result.layer).toBe("math");
    expect(result.math?.display).toBe("4,500,000");
    expect(result.slots).toEqual({});
  });

  it("جملهٔ ثبت روزمره به لایهٔ ریاضی نمی‌رود", () => {
    const result = routeFast("۲۵ میلیون تومان کود برای گندم خریدم", { mode: "assistant" });
    expect(result.layer).not.toBe("math");
  });
});

describe("پایداری موتور ریاضی (fuzz)", () => {
  it("هیچ ورودی‌ای استثنا یا NaN تولید نمی‌کند", () => {
    let seed = 20261115;
    const random = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
    const alphabet = "۰۱۲۳۴۵۶۷۸۹0123456789+-*/^%() تومان درصد میلیون هزار بین نفر در کیلو تن رطوبت پایه سهم میانگین سلام خریدم ثبت کن .،";
    for (let index = 0; index < 400; index += 1) {
      const length = 1 + Math.floor(random() * 60);
      let text = "";
      for (let cursor = 0; cursor < length; cursor += 1) text += alphabet[Math.floor(random() * alphabet.length)];
      expect(() => solveMath(text)).not.toThrow();
      const solved = solveMath(text);
      if (solved) {
        expect(Number.isFinite(solved.value.n as unknown as number) || typeof solved.value.n === "bigint").toBe(true);
        expect(solved.value.d).not.toBe(0n);
        expect(solved.display.length).toBeGreaterThan(0);
      }
    }
  });

  it("ورودی‌های بسیار بلند و تکراری از سقف عبور نمی‌کنند", () => {
    expect(solveMath("۹".repeat(500))).toBeNull();
    expect(solveMath("(".repeat(200) + "۱" + ")".repeat(200))).toBeNull();
  });
});
