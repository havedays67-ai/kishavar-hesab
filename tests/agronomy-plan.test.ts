import { describe, expect, it } from "vitest";
import { CROPS, estimateWater, planCrop, rankCrops, summarizePlan, type FarmProfile } from "../app-v2/src/lib/ai/agronomy-planner";

const coldFarm: FarmProfile = {
  region: "پارس‌آباد",
  climate: "cold",
  areaHa: 5,
  soil: "loam",
  waterSource: "well",
  waterM3PerHa: 5000,
  budgetToman: 400_000_000,
  season: "autumn",
  salinityEc: 3,
};

describe("برنامه‌ریز کشت — تراز آب و اقلیم", () => {
  it("نیاز آبی از میلی‌متر به متر مکعب درست تبدیل می‌شود", () => {
    expect(estimateWater(CROPS["wheat-irrigated"], 5)).toBe(550 * 10 * 5);
  });

  it("گندم آبی در اقلیم سرد، پنجرهٔ مهر/آبان می‌گیرد", () => {
    const plan = planCrop("wheat-irrigated", coldFarm);
    expect(plan.window).toContain("مهر");
    expect(plan.verdict).not.toBe("پیشنهاد نمی‌شود");
    expect(plan.score).toBeGreaterThanOrEqual(50);
  });

  it("کشت دیم محصول پرآب‌بر، ریسک آب می‌دهد", () => {
    const plan = planCrop("corn-forage", { ...coldFarm, waterSource: "rain", waterM3PerHa: undefined });
    expect(plan.risks.join(" ")).toContain("آب");
    expect(plan.verdict).toBe("پیشنهاد نمی‌شود");
  });

  it("کمبود آب هشدار می‌دهد و تراز منفی گزارش می‌شود", () => {
    const plan = planCrop("alfalfa", { ...coldFarm, waterM3PerHa: 3000 });
    expect(plan.water.gapM3).toBeLessThan(0);
    expect(plan.water.note).toContain("کمبود");
    expect(plan.factors.find((factor) => factor.key === "water")?.status).toBe("warn");
  });

  it("آب ناشناخته به سؤال تبدیل می‌شود، نه حدس", () => {
    const plan = planCrop("wheat-irrigated", { ...coldFarm, waterM3PerHa: undefined });
    expect(plan.water.availableM3).toBeNull();
    expect(plan.questions.some((question) => question.includes("آب"))).toBe(true);
    expect(plan.confidence).not.toBe("بالا");
  });

  it("شوری بیش از تحمل، ریسک و امتیاز پایین می‌آورد", () => {
    const sensitive = planCrop("corn-forage", { ...coldFarm, salinityEc: 9, season: "spring" });
    expect(sensitive.risks.join(" ")).toContain("شوری");
    expect(sensitive.factors.find((factor) => factor.key === "salinity")?.status).toBe("bad");
  });

  it("سرمای نزدیک برای محصول حساس هشدار است", () => {
    const plan = planCrop("corn-forage", { ...coldFarm, season: "spring" }, {
      days: Array.from({ length: 10 }, () => ({ minTemp: 1, maxTemp: 12, rainMm: 0 })),
    });
    expect(plan.risks.join(" ")).toContain("سرما");
  });

  it("اقتصاد همیشه بازه می‌دهد و سود از درآمد منهای هزینه است", () => {
    const plan = planCrop("wheat-irrigated", coldFarm);
    const [lowProfit, highProfit] = plan.economics.profitToman;
    expect(highProfit).toBeGreaterThan(lowProfit);
    expect(plan.economics.costToman[0]).toBeGreaterThan(0);
    expect(plan.economics.revenueToman[1]).toBeGreaterThan(plan.economics.revenueToman[0]);
  });

  it("رتبه‌بندی سه محصول برمی‌گرداند و خلاصه شامل هشدار دادهٔ زنده است", () => {
    const ranking = rankCrops(coldFarm);
    expect(ranking).toHaveLength(3);
    expect(ranking[0].score).toBeGreaterThanOrEqual(ranking[1].score);
    const summary = summarizePlan(ranking[0]);
    expect(summary).toContain("پنجرهٔ کاشت");
    expect(summary).toContain("بازهٔ راهنما");
  });
});
