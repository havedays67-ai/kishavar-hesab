import { describe, expect, it } from "vitest";
import { checkProfile } from "../app-v2/src/lib/profile-check";
import { importantTopics } from "../app-v2/src/lib/important-notifications";
import type { UserProfile } from "../app-v2/src/lib/profile";
import type { Insight } from "../app-v2/src/lib/insights";

const profile: UserProfile = {
  fullName: "علی رضایی",
  businessName: "",
  farmName: "",
  role: "کشاورز / مدیر مزرعه",
  phone: "09121234567",
  nationalId: "",
  economicCode: "",
  province: "گلستان",
  city: "گرگان",
  address: "",
  postalCode: "",
  email: "",
  landArea: "",
  mainCrop: "",
  notes: "",
  color: "sand",
  createdAt: "",
};

describe("بررسی پروفایل قبل از استدلال", () => {
  it("پروفایل کامل را تایید می‌کند", () => {
    expect(checkProfile(profile).ok).toBe(true);
  });

  it("شهر خالی را مشکل موقعیت می‌داند", () => {
    const check = checkProfile({ ...profile, city: "" });
    expect(check.ok).toBe(false);
    expect(check.locationIssue).toBe(true);
  });

  it("نام جای‌نگهدار و شمارهٔ نامعتبر را مشکل شخصی می‌داند", () => {
    const check = checkProfile({ ...profile, fullName: "test", phone: "123" });
    expect(check.personalIssue).toBe(true);
    expect(check.ok).toBe(false);
  });

  it("استان و شهر یکسان را مشکوک می‌داند", () => {
    expect(checkProfile({ ...profile, province: "گرگان", city: "گرگان" }).locationIssue).toBe(true);
  });
});

describe("انتخاب موضوعات مهم برای اعلان", () => {
  const insight = (code: string, severity: Insight["severity"]): Insight => ({ code, severity, title: code, detail: code, action: code, page: "finance" });

  it("فقط بحرانی و هشدار را برمی‌گرداند و بحرانی را اول می‌گذارد", () => {
    const rows = importantTopics([insight("info", "info"), insight("warn", "warning"), insight("critical", "critical"), insight("good", "good")]);
    expect(rows.map((row) => row.code)).toEqual(["critical", "warn"]);
  });

  it("حداکثر سه موضوع اعلان می‌شود", () => {
    const rows = importantTopics([1, 2, 3, 4].map((index) => insight(`w${index}`, "warning")));
    expect(rows).toHaveLength(3);
  });
});
