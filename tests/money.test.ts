import { describe, it, expect } from "vitest";
import {
  normalizeDigits,
  normalizePersian,
  parseAmount,
  parsePersianWords,
  applyShare,
  rialToToman,
  tomanToRial,
} from "@/lib/engine/money";

describe("normalizeDigits", () => {
  const cases: [string, string][] = [
    ["۱۲۳۴۵۶۷۸۹۰", "1234567890"],
    ["٠١٢٣٤٥٦٧٨٩", "0123456789"],
    ["مبلغ ۲۵ میلیون", "مبلغ 25 میلیون"],
    ["", ""],
    ["abc 123", "abc 123"],
    ["۹۹۹", "999"],
    ["۵٬۰۰۰٬۰۰۰", "5٬000٬000"],
    ["۱۴۰۴/۰۸/۱۵", "1404/08/15"],
    ["۳٫۵", "3٫5"],
    ["سلام", "سلام"],
  ];
  it.each(cases)("تبدیل ارقام %s → %s", (input, expected) => {
    expect(normalizeDigits(input)).toBe(expected);
  });
});

describe("normalizePersian", () => {
  const cases: [string, string][] = [
    ["ميخواهم", "میخواهم"],
    ["كتاب", "کتاب"],
    ["می‌خواهم", "می خواهم"],
    ["مزرعهٔ من", "مزرعه من"],
    ["  فاصله   زیاد  ", "فاصله زیاد"],
    ["«چک»", "چک"],
    ["أحمد", "احمد"],
    ["مسؤول", "مسوول"],
    ["آب", "اب"],
    ["چک ‌برگ", "چک برگ"],
  ];
  it.each(cases)("نرمال‌سازی %s → %s", (input, expected) => {
    expect(normalizePersian(input)).toBe(expected);
  });
});

describe("parsePersianWords", () => {
  const cases: [string, number | null][] = [
    ["دو میلیون و پانصد هزار", 2_500_000],
    ["یک میلیون", 1_000_000],
    ["یک و نیم میلیون", 1_500_000],
    ["دو و نیم میلیون", 2_500_000],
    ["نیم میلیون", 500_000],
    ["دو میلیون و نیم", 2_500_000],
    ["سه میلیارد", 3_000_000_000],
    ["پانصد هزار", 500_000],
    ["دویست و پنجاه هزار", 250_000],
    ["سیصد", 300],
    ["چهارصد و پنجاه", 450],
    ["هزار", 1_000],
    ["دوازده میلیون", 12_000_000],
    ["بیست و پنج میلیون", 25_000_000],
    ["هفده هزار و پانصد", 17_500],
    ["یک میلیارد و دویست میلیون", 1_200_000_000],
    ["سلام", null],
    ["", null],
    ["", null],
    ["عدد پنج", null],
  ];
  it.each(cases)("«%s» → %s تومان", (input, expected) => {
    expect(parsePersianWords(input)).toBe(expected);
  });
});

describe("parseAmount", () => {
  const cases: [string, number | null][] = [
    ["۲۵ میلیون تومان", 25_000_000],
    ["۲۵ میلیون", 25_000_000],
    ["250 هزار تومان", 250_000],
    ["1.5 میلیارد تومان", 1_500_000_000],
    ["۲ میلیارد و ۳۰۰ میلیون تومان", 2_300_000_000],
    ["۵٬۰۰۰٬۰۰۰ تومان", 5_000_000],
    ["۳۵۰۰۰۰۰", 3_500_000],
    ["دو میلیون و پانصد هزار تومان", 2_500_000],
    ["پنج میلیون تومان", 5_000_000],
    ["نیم میلیون تومان", 500_000],
    ["۲۵۰۰۰۰۰۰ ریال", 2_500_000],
    ["۴۴ میلیون تومان برای چک", 44_000_000],
    ["خرید کود ۱۲ میلیون تومان", 12_000_000],
    ["۱۵ آبان", null],
    ["سلام خوبی", null],
    ["", null],
    ["سه هزار تومان", 3_000],
    ["۱۰۰ هزار تومان", 100_000],
    ["۷۵۰ میلیون", 750_000_000],
    ["یک میلیارد", 1_000_000_000],
  ];
  it.each(cases)("مبلغ «%s» → %s", (input, expected) => {
    const parsed = parseAmount(input);
    expect(parsed ? parsed.amount : null).toBe(expected);
  });

  it("واحد ریال را تشخیص و تبدیل می‌کند", () => {
    expect(parseAmount("۱۰۰۰۰۰۰۰ ریال")?.currency).toBe("rial");
    expect(parseAmount("۱۰ میلیون تومان")?.currency).toBe("toman");
  });

  it("منبع تحلیل را مشخص می‌کند", () => {
    expect(parseAmount("۲۵ میلیون تومان")?.source).toBe("digits");
    expect(parseAmount("بیست و پنج میلیون تومان")?.source).toBe("words");
    expect(parseAmount("یک و نیم میلیون")?.source).toBe("mixed");
  });

  it("ضریب مقیاس را گزارش می‌کند", () => {
    expect(parseAmount("۲۵ میلیون")?.multiplierApplied).toBe(1_000_000);
    expect(parseAmount("۵۰۰ هزار")?.multiplierApplied).toBe(1_000);
    expect(parseAmount("۲ میلیارد")?.multiplierApplied).toBe(1_000_000_000);
  });

  it("مبالغ ریالی را به تومان تبدیل می‌کند", () => {
    expect(parseAmount("۵۰۰۰۰ ریال")?.amount).toBe(5_000);
  });
});

describe("applyShare (مزارعه)", () => {
  const cases: [number, number, number][] = [
    [100_000_000, 60, 60_000_000],
    [100_000_000, 100, 100_000_000],
    [100_000_000, 0, 0],
    [0, 50, 0],
    [33_333_333, 50, 16_666_667],
    [1_000_000, 33, 330_000],
    [120, 25, 30],
    [100_000_000, 150, 100_000_000],
    [100_000_000, -20, 0],
    [7, 50, 4],
  ];
  it.each(cases)("سهم %s با %s٪ = %s", (amount, share, expected) => {
    expect(applyShare(amount, share)).toBe(expected);
  });
});

describe("تبدیل ریال/تومان", () => {
  it.each([
    [100_000, 10_000],
    [1_250_000, 125_000],
    [0, 0],
    [9, 1],
    [15, 2],
  ])("%s ریال → %s تومان", (rial, toman) => {
    expect(rialToToman(rial)).toBe(toman);
  });
  it.each([
    [10_000, 100_000],
    [0, 0],
    [2, 20],
  ])("%s تومان → %s ریال", (toman, rial) => {
    expect(tomanToRial(toman)).toBe(rial);
  });
});
