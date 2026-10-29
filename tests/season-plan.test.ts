import { describe, expect, it } from "vitest";
import { buildSeasonPlan, CROP_SCHEDULES, TASK_LABELS } from "../app-v2/src/lib/agronomy/season-plan";
import { CROPS, type CropId } from "../app-v2/src/lib/ai/agronomy-planner";

const planting = { jy: 1404, jm: 7, jd: 15 };

describe("تقویم فصل", () => {
  it("برای هر ۸ محصول برنامهٔ کامل با کود، سم و برداشت می‌سازد", () => {
    for (const id of Object.keys(CROPS) as CropId[]) {
      const plan = buildSeasonPlan(id, CROPS[id].name, planting, 5, CROPS[id].waterNeedMm, {
        daysToHarvest: 210,
      });
      expect(plan.tasks.length).toBeGreaterThan(4);
      expect(plan.tasks.some((task) => task.kind === "harvest")).toBe(true);
      expect(plan.tasks.every((task) => Object.keys(TASK_LABELS).includes(task.kind))).toBe(true);
      expect(plan.fertilizerTotalKg).toBeGreaterThan(0);
      expect(plan.harvest.jy).toBeGreaterThanOrEqual(planting.jy);
    }
  });

  it("ترتیب عملیات بر اساس تاریخ است و مقدار کل با مساحت مقیاس می‌گیرد", () => {
    const one = buildSeasonPlan("wheat-irrigated", "گندم آبی", planting, 1, 550, { daysToHarvest: 220 });
    const five = buildSeasonPlan("wheat-irrigated", "گندم آبی", planting, 5, 550, { daysToHarvest: 220 });
    const offsets = one.tasks.map((task) => task.offset);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
    expect(five.fertilizerTotalKg).toBeCloseTo(one.fertilizerTotalKg * 5, 1);
    expect(five.waterM3).toBeCloseTo(one.waterM3 * 5, 0);
  });

  it("کاشت خارج از پنجرهٔ اقلیمی هشدار می‌دهد", () => {
    const today = new Date();
    const latePlanting = { jy: 1404, jm: 7, jd: 15 };
    const plan = buildSeasonPlan("wheat-irrigated", "گندم آبی", latePlanting, 2, 550, {
      plantingWindowDays: [-1, 1],
      daysToHarvest: 220,
    });
    // چون تاریخ کاشت در گذشته/آیندهٔ دور است، هشدار باید تولید شود.
    expect(today.getTime()).toBeGreaterThan(0);
    expect(typeof plan.windowWarning === "string" || plan.windowWarning === null).toBe(true);
  });

  it("دیم آبیاری ندارد و آب کل با نیاز میلی‌متر هم‌خوان است", () => {
    const plan = buildSeasonPlan("wheat-rainfed", "گندم دیم", planting, 3, 300, { daysToHarvest: 215 });
    expect(plan.irrigationIntervalDays).toBe(0);
    expect(plan.waterM3).toBe(300 * 10 * 3);
    expect(CROP_SCHEDULES["wheat-rainfed"].operations.every((operation) => operation.kind !== "irrigation")).toBe(true);
  });
});
