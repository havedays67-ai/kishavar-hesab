import { describe, expect, it } from "vitest";
import {
  MAX_ACTIONS,
  describeAction,
  parseActionPlan,
  requiresConfirmation,
  validateAction,
} from "../app-v2/src/lib/ai/actions";

describe("کنش‌های دستیار — اعتبارسنجی", () => {
  it("کنش‌های مجاز را می‌پذیرد", () => {
    expect(validateAction({ type: "navigate", page: "parties" }).action).toMatchObject({ type: "navigate", page: "parties" });
    expect(
      validateAction({ type: "party.payment.add", partyId: "party-1", amount: 2_500_000, method: "bank" }).action
    ).toMatchObject({ type: "party.payment.add", amount: 2_500_000 });
    expect(validateAction({ type: "document.print", docType: "party-statement" }).action).toBeTruthy();
  });

  it("کنش ناشناخته و صفحهٔ ناشناخته را رد می‌کند", () => {
    expect(validateAction({ type: "shell.exec", command: "rm -rf" }).error).toContain("غیرمجاز");
    expect(validateAction({ type: "navigate", page: "admin" }).error).toContain("ناشناخته");
  });

  it("مبلغ منفی/صفر/بزرگ‌تر از سقف را رد می‌کند", () => {
    const base = { type: "entry.add", kind: "expense", reason: "کود" };
    expect(validateAction({ ...base, amount: 0 }).error).toBeTruthy();
    expect(validateAction({ ...base, amount: 9_999_999_999_999 }).error).toBeTruthy();
  });

  it("فیلد ناشناخته یا متن آلوده را رد می‌کند", () => {
    expect(validateAction({ type: "party.create", name: "علی", kind: "debtor", amount: 1000, reason: "کود", admin: true }).action).toBeTruthy();
    expect(validateAction({ type: "party.create", name: "<script>", kind: "debtor", amount: 1000, reason: "کود" }).error).toBeTruthy();
    expect(validateAction({ type: "answer", text: "javascript:alert(1)" }).error).toBeTruthy();
  });

  it("ویرایش فقط با فیلد مجاز همان رکورد", () => {
    expect(validateAction({ type: "record.update", record: "party", id: "p1", field: "phone", value: "09120000000" }).action).toBeTruthy();
    expect(validateAction({ type: "record.update", record: "party", id: "p1", field: "secret", value: "x" }).error).toBeTruthy();
  });
});

describe("کنش‌های دستیار — برنامهٔ کامل", () => {
  it("JSON سالم را به برنامه تبدیل می‌کند", () => {
    const raw = '{"say":"ثبت شد","actions":[{"type":"navigate","page":"finance"}]}';
    const result = parseActionPlan(raw);
    expect(result.ok).toBe(true);
    expect(result.plan?.actions).toHaveLength(1);
  });

  it("JSON داخل توضیح مدل را هم پیدا می‌کند", () => {
    const raw = 'حتماً:\n```json\n{"say":"باشه","actions":[{"type":"document.print","docType":"report"}]}\n```';
    expect(parseActionPlan(raw).ok).toBe(true);
  });

  it("JSON خراب هیچ کنشی اجرا نمی‌کند", () => {
    expect(parseActionPlan("متأسفم، نمی‌توانم").ok).toBe(false);
    expect(parseActionPlan('{"actions":[{"type":"navigate","page":"x"}]}').ok).toBe(false);
  });

  it("بیش از حد مجاز کنش رد می‌شود", () => {
    const actions = Array.from({ length: MAX_ACTIONS + 1 }, () => ({ type: "navigate", page: "dashboard" }));
    expect(parseActionPlan(JSON.stringify({ say: "زیاد", actions })).ok).toBe(false);
  });

  it("سؤال روشن‌کننده بدون کنش پذیرفته می‌شود", () => {
    const result = parseActionPlan('{"say":"","question":"چند هکتار دارید؟","actions":[]}');
    expect(result.ok).toBe(true);
    expect(result.plan?.question).toBe("چند هکتار دارید؟");
  });

  it("ویرایش نیازمند تأیید است و متن تأیید فارسی است", () => {
    const plan = parseActionPlan(JSON.stringify({ say: "ویرایش", actions: [{ type: "record.update", record: "party", id: "p1", field: "phone", value: "0912" }] }));
    expect(plan.ok).toBe(true);
    expect(requiresConfirmation(plan.plan!)).toBe(true);
    expect(describeAction(plan.plan!.actions[0])).toContain("تغییر");
  });
});
