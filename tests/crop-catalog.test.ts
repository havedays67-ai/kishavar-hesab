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
    const rows = scoreCatalog(farm({ region: "یزد", climate: "dry", waterSource: "qanat" }));
    const saffron = rows.find((row) => row.name === "زعفران");
    const bananaLike = rows.find((row) => row.name === "هندوانه");
    expect(saffron?.score).toBeGreaterThan(bananaLike?.score ?? 0);
  });

  it("در کشت دیم، محصول پرمصرف آبی امتیاز پایین می‌گیرد", () => {
    const rows = scoreCatalog(farm({ waterSource: "rain" }));
    const rice = rows.find((row) => row.name === "برنج");
    expect(rice?.score).toBeLessThan(50);
  });

  it("در آبان گلستان غلات پاییزه از سبزی‌های تابستانه بالاتر می‌گیرند", () => {
    const rows = scoreCatalog(farm({ region: "انبارالوم، گلستان", climate: "humid" }), 8);
    const wheat = rows.find((row) => row.name === "گندم")!;
    const canola = rows.find((row) => row.name === "کلزا")!;
    const okra = rows.find((row) => row.name === "بامیه")!;
    const basil = rows.find((row) => row.name === "ریحان")!;
    expect(wheat.score).toBeGreaterThan(okra.score);
    expect(canola.score).toBeGreaterThan(basil.score);
    expect(okra.verdict).not.toBe("مناسب");
    expect(basil.verdict).not.toBe("مناسب");
  });

  it("زعفران در یزد از گلستان و برنج در گیلان از یزد بالاتر است", () => {
    const saffronYazd = scoreCatalog(farm({ region: "یزد", climate: "dry" }), 8).find((row) => row.name === "زعفران")!;
    const saffronGolestan = scoreCatalog(farm({ region: "گلستان", climate: "humid" }), 8).find((row) => row.name === "زعفران")!;
    const riceGilan = scoreCatalog(farm({ region: "گیلان", climate: "humid" }), 3).find((row) => row.name === "برنج")!;
    const riceYazd = scoreCatalog(farm({ region: "یزد", climate: "dry" }), 3).find((row) => row.name === "برنج")!;
    expect(saffronYazd.score).toBeGreaterThan(saffronGolestan.score);
    expect(riceGilan.score).toBeGreaterThan(riceYazd.score);
  });
});
