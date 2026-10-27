import { describe, expect, it } from "vitest";
import {
  LEASE_FORM_META,
  leaseFormMeta,
  leaseRoles,
  perspectiveStatement,
  settleCropShare,
  validateLeaseTerms,
} from "../offline/lease-forms";

const base = {
  kind: "cash",
  landlordId: 1,
  tenantId: 2,
  start: "2026-04-21",
  end: "2027-04-20",
  total: 100_000_000,
  sharePercent: 0,
};

describe("قالب‌های قرارداد زمین کشاورزی", () => {
  it("هر پنج قالب تعریف شده است", () => {
    expect(Object.keys(LEASE_FORM_META)).toEqual(["cash", "share", "mixed", "profit_share", "guaranteed_bonus"]);
  });

  it("کشاورز مستاجر است و مالک موجر", () => {
    expect(leaseRoles("cash").owner).toContain("موجر");
    expect(leaseRoles("cash").farmer).toContain("مستاجر");
    expect(leaseRoles("cash").farmer).toContain("کشاورز");
    expect(perspectiveStatement("farmer", "cash")).toContain("زمین را از");
    expect(perspectiveStatement("owner", "cash")).toContain("دریافت می‌کند");
  });

  it("در مزارعه نقش‌ها مزارع و عامل است", () => {
    expect(leaseRoles("share").owner).toContain("مزارع");
    expect(leaseRoles("share").farmer).toContain("عامل");
  });

  it("اعتبارسنجی نقدی و مزارعه و سود خالص", () => {
    expect(validateLeaseTerms(base)).toBeNull();
    expect(validateLeaseTerms({ ...base, total: 0 })).not.toBeNull();
    expect(validateLeaseTerms({ ...base, kind: "share", sharePercent: 33.33, total: 0 })).toBeNull();
    expect(validateLeaseTerms({ ...base, kind: "share", sharePercent: 0, total: 0 })).not.toBeNull();
    expect(validateLeaseTerms({ ...base, kind: "profit_share", profitPercent: 40, total: 0 })).toBeNull();
    expect(validateLeaseTerms({ ...base, kind: "profit_share", profitPercent: 0, total: 0 })).not.toBeNull();
    expect(validateLeaseTerms({ ...base, kind: "guaranteed_bonus", guaranteedMin: 0, total: 0 })).not.toBeNull();
    expect(validateLeaseTerms({ ...base, kind: "guaranteed_bonus", guaranteedMin: 50_000_000, bonusPercent: 20, total: 0 })).toBeNull();
    expect(validateLeaseTerms({ ...base, end: "2026-01-01" })).not.toBeNull();
    expect(validateLeaseTerms({ ...base, tenantId: 1 })).not.toBeNull();
  });

  it("تسویه مزارعه با سهم یک‌سوم و هزینه با عامل", () => {
    const r = settleCropShare({ kind: "share", totalKg: 100_000, pricePerKg: 1_000, totalCost: 20_000_000, ownerSharePercent: 33.33 });
    expect(r.revenue).toBe(100_000_000);
    expect(r.ownerTotal).toBe(33_330_000);
    expect(r.farmerNet).toBe(46_670_000);
    expect(r.ownerTotal + r.farmerNet).toBe(80_000_000);
  });

  it("اجاره نقدی سهم محصول برای مالک نمی‌سازد", () => {
    const r = settleCropShare({ kind: "cash", totalKg: 100_000, pricePerKg: 2_000, totalCost: 30_000_000 });
    expect(r.ownerTotal).toBe(0);
    expect(r.farmerNet).toBe(170_000_000);
  });

  it("ترکیبی، سود خالص و تضمینی + مازاد", () => {
    const mixed = settleCropShare({ kind: "mixed", totalKg: 100_000, pricePerKg: 1_000, totalCost: 20_000_000, ownerSharePercent: 20, costBearer: "split" });
    expect(mixed.ownerCrop).toBe(16_000_000);
    const profit = settleCropShare({ kind: "profit_share", totalKg: 100_000, pricePerKg: 1_000, totalCost: 20_000_000, profitPercent: 40 });
    expect(profit.ownerTotal).toBe(32_000_000);
    expect(profit.farmerNet).toBe(48_000_000);
    const bonus = settleCropShare({ kind: "guaranteed_bonus", totalKg: 100_000, pricePerKg: 1_000, totalCost: 10_000_000, guaranteedMin: 50_000_000, bonusPercent: 25 });
    expect(bonus.ownerCash).toBe(50_000_000);
    expect(bonus.ownerBonus).toBe(12_500_000);
    expect(bonus.farmerNet).toBe(27_500_000);
  });
});
