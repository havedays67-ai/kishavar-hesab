import { describe, expect, it } from "vitest";
import {
  AUTHORITY,
  AUTHORITY_LEVELS,
  AUTHORITY_ORDER,
  authorityFor,
  authoritySummary,
  matchAuthorityQuestion,
} from "../app-v2/src/lib/document-validity";

describe("اعتبار اسناد — پوشش کامل و پاسخ بدون حدس", () => {
  it("هر سند جدول، فیلدهای لازم و سطح معتبر دارد", () => {
    expect(AUTHORITY_ORDER.length).toBeGreaterThanOrEqual(15);
    for (const kind of AUTHORITY_ORDER) {
      const entry = AUTHORITY[kind];
      expect(entry, kind).toBeTruthy();
      expect(entry.title.length, kind).toBeGreaterThan(3);
      expect([1, 2, 3, 4], kind).toContain(entry.level);
      expect(AUTHORITY_LEVELS[entry.level].label.length, kind).toBeGreaterThan(3);
      expect(entry.proves.length, kind).toBeGreaterThan(0);
      expect(entry.doesNotProve.length, kind).toBeGreaterThan(0);
      expect(entry.needsToBeStronger.length, kind).toBeGreaterThan(0);
      expect(entry.requirements.length, kind).toBeGreaterThan(0);
      expect(entry.betweenParties.length, kind).toBeGreaterThan(10);
      expect(entry.againstThird.length, kind).toBeGreaterThan(10);
      expect(entry.legalBasis.length, kind).toBeGreaterThan(5);
      expect(entry.references.length, kind).toBeGreaterThan(0);
      for (const req of entry.requirements) {
        expect(req.note.length, `${kind}:${req.label}`).toBeGreaterThan(5);
        expect(["الزامی", "توصیه‌شده"], `${kind}:${req.label}`).toContain(req.importance);
      }
    }
  });

  it("فرم چک عمداً سطح ۴ (بدون اعتبار حقوقی) دارد", () => {
    expect(authorityFor("cheque-sheet").level).toBe(4);
  });

  it("گزارش‌های داخلی هرگز سند اثباتی معرفی نمی‌شوند", () => {
    for (const kind of ["finance-report", "trades-report", "cost-report", "inventory-report"]) {
      expect(authorityFor(kind).level).toBe(3);
      expect(authorityFor(kind).doesNotProve.join(" ")).toMatch(/اثبات|بدهی|مالکیت|مالیات|حق/);
    }
  });

  it("رسید پرداخت به‌عنوان مدرک حمایتی با محدودیت بیان می‌شود", () => {
    const receipt = authorityFor("receipt");
    expect(receipt.level).toBe(2);
    expect(receipt.doesNotProve.join(" ")).toContain("علت پرداخت");
    expect(receipt.needsToBeStronger.join(" ")).toContain("پیگیری");
  });

  it("پرسش اعتبار سند، پاسخ قطعی با منبع و مبنای حقوقی می‌گیرد", () => {
    for (const question of ["آیا رسید پرداخت سند معتبری است؟", "قبض باسکول اعتبار قانونی دارد؟", "چک چاپی معتبر است؟", "صورتجلسه تسویه در دادگاه قبول می‌شود؟"]) {
      const answer = matchAuthorityQuestion(question);
      expect(answer, question).not.toBeNull();
      expect(answer!.confidence).toBeGreaterThanOrEqual(90);
      expect(answer!.text.length, question).toBeGreaterThan(120);
      expect(answer!.sources.length, question).toBeGreaterThan(0);
      expect(answer!.followUps.length, question).toBeGreaterThan(0);
    }
  });

  it("پرسش عمومی «کدام اسناد معتبرند» فهرست سطح‌بندی‌شده می‌دهد", () => {
    const answer = matchAuthorityQuestion("کدام اسناد برنامه معتبر هستند؟");
    expect(answer?.kind).toBe("summary");
    expect(answer!.text).toContain("سطح");
    expect(answer!.text).toContain("یادداشت");
  });

  it("پرسش‌های غیرحقوقی به این لایه سپرده نمی‌شوند (بدون پاسخ اشتباه)", () => {
    for (const question of ["هوا چطور است؟", "چقدر طلب دارم؟", "بهای تمام‌شده گندم چقدر است؟", "امروز چه کارهایی دارم؟"]) {
      expect(matchAuthorityQuestion(question), question).toBeNull();
    }
  });

  it("خلاصهٔ جدول همهٔ سندها را با سطح برمی‌گرداند", () => {
    const summary = authoritySummary();
    expect(summary.length).toBe(AUTHORITY_ORDER.length);
    expect(summary.filter((row) => row.level === 1).length).toBeGreaterThan(0);
    expect(summary.filter((row) => row.level === 4).length).toBe(1);
  });
});
