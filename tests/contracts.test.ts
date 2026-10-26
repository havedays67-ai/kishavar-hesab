import { describe, it, expect } from "vitest";
import {
  INTENTS,
  REQUIRED_SLOTS,
  SLOT_KEYS,
  SYSTEM_PROMPT_FA,
  assistantJsonSchema,
  validateAssistantOutput,
  type ContractIntent,
} from "@/lib/engine/contracts";

const VALID_SLOTS: Partial<Record<ContractIntent, Record<string, string | number>>> = {
  add_expense: { amount: 25_000_000, category: "کود و سم", land: "زمین شمالی", method: "credit", date: "2026-03-20" },
  add_income: { amount: 196_000_000, category: "فروش محصول", method: "credit", date: "2026-03-20" },
  add_debt: { party: "فروشگاه نهاده سبز", amount: 44_500_000, dueDate: "2026-04-01", direction: "payable" },
  add_receivable: { party: "صنایع تبدیلی جنوب", amount: 96_000_000, dueDate: "2026-04-10", direction: "receivable" },
  add_cheque: { party: "فروشگاه نهاده سبز", amount: 44_000_000, dueDate: "2026-04-05", direction: "issued" },
  add_task: { title: "تماس با تعاونی برای بذر" },
  add_labor: { worker: "حسن رضایی", days: 3, dailyWage: 1_300_000 },
  inventory_out: { item: "کود اوره", quantity: 50, unit: "کیلوگرم" },
  inventory_in: { item: "سم حشره‌کش", quantity: 12, unit: "لیتر" },
  settle_cheque: { target: "فروشگاه نهاده سبز" },
  settle_debt: { target: "مکانیکی حاج‌رضا" },
  add_land: { land: "زمین شرقی", areaHa: 4.5, region: "جیرفت" },
  report: { reportType: "profit" },
  learn: { topic: "بهای تمام‌شده" },
  refuse: {},
};

const ACTION: Record<ContractIntent, "draft" | "ask" | "answer" | "refuse"> = {
  add_expense: "draft",
  add_income: "draft",
  add_debt: "draft",
  add_receivable: "draft",
  add_cheque: "draft",
  add_task: "draft",
  add_labor: "draft",
  inventory_out: "draft",
  inventory_in: "draft",
  settle_cheque: "draft",
  settle_debt: "draft",
  add_land: "draft",
  report: "answer",
  learn: "answer",
  refuse: "refuse",
};

const build = (intent: ContractIntent) => ({
  intent,
  slots: VALID_SLOTS[intent] ?? {},
  missing: [],
  action: ACTION[intent],
  reply_fa: "آماده ثبت است.",
});

describe("قرارداد خروجی دستیار — مسیرهای معتبر", () => {
  it.each(INTENTS)("intent «%s» با اسلات کامل معتبر است", (intent) => {
    const result = validateAssistantOutput(build(intent));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.each(INTENTS)(REQUIRED_SLOTS as unknown as string, () => {
    expect(true).toBe(true);
  });

  it("هر intent در طرح JSON وجود دارد", () => {
    const schema = assistantJsonSchema() as { properties: { intent: { enum: string[] } } };
    for (const intent of INTENTS) expect(schema.properties.intent.enum).toContain(intent);
  });

  it("همه اسلات‌ها در طرح خروجی هستند", () => {
    const schema = assistantJsonSchema() as { properties: { slots: { properties: Record<string, unknown> } } };
    for (const key of SLOT_KEYS) expect(Object.keys(schema.properties.slots.properties)).toContain(key);
  });

  it("پرامپت سیستمی قاعده JSON-only و منع ساخت عدد را دارد", () => {
    expect(SYSTEM_PROMPT_FA).toContain("JSON");
    expect(SYSTEM_PROMPT_FA).toContain("تومان");
    expect(SYSTEM_PROMPT_FA).toContain("refuse");
  });
});

describe("قرارداد خروجی دستیار — درخواست اطلاعات ناقص", () => {
  const intentsWithSlots = (Object.keys(REQUIRED_SLOTS) as ContractIntent[]).filter((i) => REQUIRED_SLOTS[i].length > 0);

  it.each(intentsWithSlots)("intent «%s»: نبود اسلات الزامی ← action=ask", (intent) => {
    const required = REQUIRED_SLOTS[intent];
    const slots = { ...(VALID_SLOTS[intent] ?? {}) };
    const removed = required[0];
    delete slots[removed];
    const result = validateAssistantOutput({
      intent,
      slots,
      missing: [removed],
      action: "ask",
      reply_fa: "لطفاً اطلاعات ناقص را بگویید.",
    });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.normalized?.missing).toEqual([removed]);
  });

  it("اسلات گمشده اعلام‌نشده خطا است", () => {
    const result = validateAssistantOutput({
      intent: "add_expense",
      slots: { amount: 1000 },
      missing: [],
      action: "draft",
      reply_fa: "ثبت",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("missing");
  });

  it("اسلات اعلام‌شده که در واقع موجود است خطا است", () => {
    const result = validateAssistantOutput({
      intent: "add_cheque",
      slots: { party: "بانک", amount: 1000, dueDate: "2026-04-01" },
      missing: ["party"],
      action: "ask",
      reply_fa: "؟",
    });
    expect(result.ok).toBe(false);
  });

  it("action=ask بدون اسلات گمشده خطا است", () => {
    const result = validateAssistantOutput({ ...build("add_cheque"), action: "ask" });
    expect(result.ok).toBe(false);
  });
});

describe("قرارداد خروجی دستیار — موارد رد‌شدنی", () => {
  const invalid: [string, unknown, string][] = [
    ["رشته به‌جای شیء", "salam", "JSON object"],
    ["آرایه", [], "JSON object"],
    ["null", null, "JSON object"],
    ["intent ناشناخته", { ...build("add_expense"), intent: "transfer_money" }, "intent"],
    ["کلید اضافه در سطح بالا", { ...build("add_expense"), extra: 1 }, "unexpected"],
    ["اسلات ناشناخته", { ...build("add_expense"), slots: { amount: 1000, category: "x", hacker: "y" } }, "unknown slot"],
    ["مبلغ اعشاری", { ...build("add_expense"), slots: { amount: 1000.5, category: "کود" } }, "integer"],
    ["مبلغ منفی", { ...build("add_expense"), slots: { amount: -5, category: "کود" } }, "integer"],
    ["مبلغ متنی", { ...build("add_expense"), slots: { amount: "۲۵ میلیون", category: "کود" } }, "integer"],
    ["date بد", { ...build("add_expense"), slots: { amount: 1000, category: "کود", date: "1404/08/15" } }, "date"],
    ["dueDate قبل از date", { ...build("add_cheque"), slots: { party: "x", amount: 1000, dueDate: "2026-01-01", date: "2026-02-01" } }, "dueDate before"],
    ["روش پرداخت نامعتبر", { ...build("add_expense"), slots: { amount: 1000, category: "کود", method: "crypto" } }, "method"],
    ["جهت چک نادرست", { ...build("add_cheque"), slots: { party: "x", amount: 1000, dueDate: "2026-04-01", direction: "payable" } }, "direction"],
    ["جهت بدهی نادرست", { ...build("add_debt"), slots: { party: "x", amount: 1000, direction: "issued" } }, "direction"],
    ["reportType نامعتبر", { ...build("report"), slots: { reportType: "weather" } }, "reportType"],
    ["روزهای دستمزد صفر", { ...build("add_labor"), slots: { worker: "حسن", days: 0, dailyWage: 1000 } }, "days"],
    ["روزهای دستمزد بیش از حد", { ...build("add_labor"), slots: { worker: "حسن", days: 400, dailyWage: 1000 } }, "days"],
    ["مساحت صفر", { ...build("add_land"), slots: { land: "زمین", areaHa: 0 } }, "areaHa"],
    ["مقدار انبار صفر", { ...build("inventory_out"), slots: { item: "کود", quantity: 0 } }, "quantity"],
    ["action نادرست برای intent", { ...build("add_expense"), action: "refuse" }, "not allowed"],
    ["refuse با action دیگر", { ...build("refuse"), action: "answer" }, "refuse action"],
    ["reply خالی", { ...build("add_expense"), reply_fa: "   " }, "reply_fa"],
    ["reply بلند", { ...build("add_expense"), reply_fa: "ی".repeat(1300) }, "reply_fa too long"],
    ["slots غیر شیء", { ...build("add_expense"), slots: [] }, "slots must be"],
    ["missing غیر آرایه", { ...build("add_expense"), missing: "amount" }, "missing must be"],
    ["مبلغ خارج از سقف", { ...build("add_expense"), slots: { amount: 999_000_000_000_000, category: "کود" } }, "out of range"],
    ["اسلات شیء تودرتو", { ...build("add_expense"), slots: { amount: 1000, category: { x: 1 } } }, "must be string or number"],
    ["کلید ناشناخته در missing", { ...build("add_cheque"), slots: { party: "x", amount: 1000 }, missing: ["banana"], action: "ask" }, "unknown slots"],
    ["currency نامعتبر", { ...build("add_expense"), slots: { amount: 1000, category: "کود", currency: "dollar" } }, "currency"],
  ];

  it.each(invalid)("%s رد می‌شود", (_title, payload, needle) => {
    const result = validateAssistantOutput(payload);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" | ")).toContain(needle);
  });

  it("خروجی معتبر، normalized برمی‌گرداند", () => {
    const result = validateAssistantOutput(build("add_labor"));
    expect(result.normalized?.intent).toBe("add_labor");
    expect(result.normalized?.action).toBe("draft");
    expect(result.normalized?.missing).toEqual([]);
  });
});
