import { describe, expect, it } from "vitest";
import { describeAction, validateAction } from "../app-v2/src/lib/ai/actions";
import { DOCUMENT_TYPES } from "../app-v2/src/lib/documents";
import { shareOutcomeMessage } from "../app-v2/src/lib/share";

const KINDS = [
  "sale-contract", "weigh-ticket", "quality-minutes", "sale-invoice", "settlement",
  "lease-contract", "lease-receipt", "lease-handover", "trades-report", "cost-report",
  "party-statement", "finance-report", "inventory-report", "cheque-sheet",
] as const;

describe("کنش‌های تازهٔ کشاورزیار — سند، رسید و امضا", () => {
  it("هر ۱۴ نوع سند، هم در کنش‌ها و هم در موتور سند وجود دارد", () => {
    for (const docType of KINDS) {
      expect(DOCUMENT_TYPES.some((meta) => meta.kind === docType), docType).toBe(true);
      expect(validateAction({ type: "document.create", docType }).action, docType).toMatchObject({ docType });
      expect(validateAction({ type: "document.print", docType }).action).toBeTruthy();
      expect(validateAction({ type: "document.send", docType }).action).toBeTruthy();
    }
  });

  it("نوع سند ناشناخته رد می‌شود", () => {
    expect(validateAction({ type: "document.create", docType: "shell" }).error).toContain("نامعتبر");
  });

  it("ارسال رسید بدون هدف، «آخرین رسید» می‌شود", () => {
    expect(validateAction({ type: "receipt.send" }).action).toMatchObject({ type: "receipt.send", target: "last" });
    expect(validateAction({ type: "receipt.send", target: "party", id: "p1" }).action).toBeTruthy();
    expect(validateAction({ type: "receipt.send", target: "email" }).error).toContain("نامعتبر");
  });

  it("درخواست امضا عنوان می‌خواهد و سمت پیش‌فرض دارد", () => {
    expect(validateAction({ type: "signature.request" }).error).toContain("عنوان");
    const ok = validateAction({ type: "signature.request", title: "قرارداد فروش گندم" });
    expect(ok.action).toMatchObject({ type: "signature.request", signerRole: "counterparty" });
    expect(validateAction({ type: "signature.request", title: "سند", signerRole: "hacker" }).error).toContain("سمت");
  });

  it("برچسب فارسی همهٔ کنش‌های تازه ساخته می‌شود", () => {
    expect(describeAction({ type: "document.create", docType: "sale-invoice", title: "فاکتور" })).toContain("فاکتور");
    expect(describeAction({ type: "document.send", docType: "party-statement" })).toContain("ارسال");
    expect(describeAction({ type: "receipt.send", target: "last" })).toContain("رسید");
    expect(describeAction({ type: "signature.request", title: "قرارداد", signerRole: "buyer" })).toContain("امضا");
  });

  it("پیام نتیجهٔ «باز نشانی» روشن و فارسی است", () => {
    expect(shareOutcomeMessage("shared")).toContain("هم‌رسانی");
    expect(shareOutcomeMessage("copied")).toContain("کپی");
    expect(shareOutcomeMessage("failed")).toContain("دوباره");
  });
});
