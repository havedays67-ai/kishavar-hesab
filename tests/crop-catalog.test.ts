import { describe, expect, it } from "vitest";
import { scoreCatalog } from "../app-v2/src/lib/agronomy/crop-catalog";
import type { FarmProfile } from "../app-v2/src/lib/ai/agronomy-planner";

const farm = (overrides: Partial<FarmProfile> = {}): FarmProfile => ({
  region: "گرگان",
  climate: "temperate",
  areaHa: 5,
  soil: "loam",
  waterSource: "well",
  season: "autumn",
  ...overrides,
});

describe("رتبه‌بندی همهٔ محصولات", () => {
  it("فهرست کامل محصولات زراعی را امتیاز می‌دهد", () => {
    const rows = scoreCatalog(farm());
    expect(rows.length).toBeGreaterThan(60);
    expect(rows.every((row) => row.score >= 0 && row.score <= 100)).toBe(true);
    expect(rows.some((row) => row.name === "زعفران")).toBe(true);
  });

  it("برای اقلیم خشک، زعفران از محصولات گرماپسند امتیاز بهتری می‌گیرد", () => {
    const rows = scoreCatalog(farm({ climate: "dry", waterSource: "qanat" }));
    const saffron = rows.find((row) => row.name === "زعفران");
    const bananaLike = rows.find((row) => row.name === "هندوانه");
    expect(saffron?.score).toBeGreaterThan(bananaLike?.score ?? 0);
  });

  it("در کشت دیم، محصول پرمصرف آبی امتیاز پایین می‌گیرد", () => {
    const rows = scoreCatalog(farm({ waterSource: "rain" }));
    const rice = rows.find((row) => row.name === "برنج");
    expect(rice?.score).toBeLessThan(50);
  });
});
