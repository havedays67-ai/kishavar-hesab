/**
 * قرارداد خروجی مدل دستیار (نسخه ۱).
 * مدل فقط اجازه دارد همین JSON را برگرداند؛ اعتبارسنجی نهایی همیشه در موتور قطعی انجام می‌شود.
 * همین فایل، منبع JSON Schema برای Constrained Decoding و برای اعتبارسنجی دیتاست است.
 */

export const INTENTS = [
  "add_expense",
  "add_income",
  "add_debt",
  "add_receivable",
  "add_cheque",
  "add_task",
  "add_labor",
  "inventory_out",
  "inventory_in",
  "settle_cheque",
  "settle_debt",
  "add_land",
  "report",
  "learn",
  "refuse",
] as const;

export type ContractIntent = (typeof INTENTS)[number];

export const SLOT_KEYS = [
  "amount",
  "currency",
  "category",
  "land",
  "crop",
  "party",
  "method",
  "date",
  "dueDate",
  "direction",
  "bank",
  "serial",
  "title",
  "worker",
  "days",
  "dailyWage",
  "item",
  "quantity",
  "unit",
  "areaHa",
  "region",
  "priority",
  "target",
  "reportType",
  "topic",
] as const;

export type SlotKey = (typeof SLOT_KEYS)[number];

/** اسلات‌های الزامی هر intent — منبع واحد حقیقت */
export const REQUIRED_SLOTS: Record<ContractIntent, SlotKey[]> = {
  add_expense: ["amount", "category"],
  add_income: ["amount", "category"],
  add_debt: ["party", "amount"],
  add_receivable: ["party", "amount"],
  add_cheque: ["party", "amount", "dueDate"],
  add_task: ["title"],
  add_labor: ["worker", "days", "dailyWage"],
  inventory_out: ["item", "quantity"],
  inventory_in: ["item", "quantity"],
  settle_cheque: ["target"],
  settle_debt: ["target"],
  add_land: ["land", "areaHa"],
  report: [],
  learn: [],
  refuse: [],
};

export const REPORT_TYPES = ["profit", "expense", "income", "land", "cropcost", "debt", "cheque", "inventory", "labor", "general"] as const;

export interface AssistantOutput {
  intent: ContractIntent;
  slots: Partial<Record<SlotKey, string | number>>;
  missing: SlotKey[];
  action: "draft" | "ask" | "answer" | "refuse";
  reply_fa: string;
}

export interface ContractValidation {
  ok: boolean;
  errors: string[];
  normalized?: AssistantOutput;
}

const ALLOWED_ACTIONS: Record<AssistantOutput["action"], ContractIntent[]> = {
  ask: ["add_expense", "add_income", "add_debt", "add_receivable", "add_cheque", "add_task", "add_labor", "inventory_out", "inventory_in", "settle_cheque", "settle_debt", "add_land"],
  draft: ["add_expense", "add_income", "add_debt", "add_receivable", "add_cheque", "add_task", "add_labor", "inventory_out", "inventory_in", "settle_cheque", "settle_debt", "add_land"],
  answer: ["report", "learn"],
  refuse: ["refuse"],
};

/**
 * اعتبارسنجی کامل: ساختار، نوع، intent، اسلات‌های مجاز، تناسب action با intent و missing.
 */
export function validateAssistantOutput(raw: unknown): ContractValidation {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ["output must be a JSON object"] };
  }
  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  const allowedTop = ["intent", "slots", "missing", "action", "reply_fa"];
  for (const key of keys) if (!allowedTop.includes(key)) errors.push(`unexpected top-level key: ${key}`);

  const intent = obj.intent;
  if (typeof intent !== "string" || !(INTENTS as readonly string[]).includes(intent)) {
    return { ok: false, errors: [...errors, "intent invalid or missing"] };
  }
  const typedIntent = intent as ContractIntent;

  const slotsRaw = obj.slots;
  if (typeof slotsRaw !== "object" || slotsRaw === null || Array.isArray(slotsRaw)) errors.push("slots must be an object");
  const slotsIn = (slotsRaw ?? {}) as Record<string, unknown>;
  const slots: Partial<Record<SlotKey, string | number>> = {};
  for (const [key, value] of Object.entries(slotsIn)) {
    if (!(SLOT_KEYS as readonly string[]).includes(key)) {
      errors.push(`unknown slot: ${key}`);
      continue;
    }
    if (typeof value !== "string" && typeof value !== "number") {
      errors.push(`slot ${key} must be string or number`);
      continue;
    }
    if (typeof value === "string" && value.length > 300) {
      errors.push(`slot ${key} too long`);
      continue;
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      errors.push(`slot ${key} not finite`);
      continue;
    }
    slots[key as SlotKey] = value;
  }

  if ("amount" in slots) {
    const amount = Number(slots.amount);
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount) !== amount) errors.push("amount must be a positive integer (Toman)");
    if (amount > 100_000_000_000_000) errors.push("amount out of range");
  }
  if ("days" in slots) {
    const days = Number(slots.days);
    if (!Number.isFinite(days) || days <= 0 || days > 365) errors.push("days out of range");
  }
  if ("areaHa" in slots) {
    const area = Number(slots.areaHa);
    if (!Number.isFinite(area) || area <= 0 || area > 100_000) errors.push("areaHa out of range");
  }
  if ("quantity" in slots && (!Number.isFinite(Number(slots.quantity)) || Number(slots.quantity) <= 0)) errors.push("quantity must be positive");
  for (const dateKey of ["date", "dueDate"] as const) {
    if (slots[dateKey] !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(slots[dateKey]))) errors.push(`${dateKey} must be YYYY-MM-DD`);
  }
  if (slots.date && slots.dueDate && String(slots.dueDate) < String(slots.date)) errors.push("dueDate before date");
  if ("currency" in slots && !["toman", "rial"].includes(String(slots.currency))) errors.push("currency must be toman or rial");
  if ("method" in slots && !["cash", "bank", "credit"].includes(String(slots.method))) errors.push("method invalid");
  if ("direction" in slots) {
    const dir = String(slots.direction);
    const allow = typedIntent === "add_cheque" ? ["issued", "received"] : ["payable", "receivable"];
    if (!allow.includes(dir)) errors.push("direction invalid for intent");
  }
  if ("reportType" in slots && !(REPORT_TYPES as readonly string[]).includes(String(slots.reportType))) errors.push("reportType invalid");
  if ("priority" in slots && !["low", "normal", "high"].includes(String(slots.priority))) errors.push("priority invalid");

  const missingRaw = obj.missing ?? [];
  if (!Array.isArray(missingRaw)) errors.push("missing must be an array");
  const missing = (Array.isArray(missingRaw) ? missingRaw : []).filter((m): m is SlotKey => typeof m === "string" && (SLOT_KEYS as readonly string[]).includes(m));
  if (Array.isArray(missingRaw) && missing.length !== missingRaw.length) errors.push("missing contains unknown slots");

  const action = obj.action;
  if (typeof action !== "string" || !Object.keys(ALLOWED_ACTIONS).includes(action)) {
    errors.push("action invalid");
  } else if (!ALLOWED_ACTIONS[action as AssistantOutput["action"]].includes(typedIntent)) {
    errors.push(`action ${action} not allowed for ${typedIntent}`);
  }

  const replyText = typeof obj.reply_fa === "string" ? obj.reply_fa : "";
  if (!replyText.trim()) errors.push("reply_fa required");
  else if (replyText.length > 1200) errors.push("reply_fa too long");

  const required = REQUIRED_SLOTS[typedIntent] ?? [];
  const computedMissing = required.filter((key) => {
    const value = slots[key];
    return value === undefined || value === "";
  });
  if (missing.length === 0 && computedMissing.length > 0 && action !== "answer" && action !== "refuse") {
    errors.push(`missing must list: ${computedMissing.join(", ")}`);
  }
  for (const key of missing) {
    if (!computedMissing.includes(key)) errors.push(`missing lists a slot that is already provided: ${key}`);
  }
  if (action === "draft" && computedMissing.length > 0) errors.push("draft requires all required slots");
  if (action === "ask" && computedMissing.length === 0) errors.push("ask requires at least one missing slot");
  if (typedIntent === "refuse" && action !== "refuse") errors.push("refuse intent requires refuse action");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    normalized: {
      intent: typedIntent,
      slots,
      missing: computedMissing,
      action: action as AssistantOutput["action"],
      reply_fa: replyText.trim(),
    },
  };
}

/** JSON Schema برای Constrained Decoding (گرامر خروجی مدل) */
export function assistantJsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["intent", "slots", "missing", "action", "reply_fa"],
    properties: {
      intent: { enum: [...INTENTS] },
      slots: {
        type: "object",
        additionalProperties: false,
        properties: Object.fromEntries(SLOT_KEYS.map((key) => [key, { type: ["string", "number"] }])),
      },
      missing: { type: "array", items: { enum: [...SLOT_KEYS] }, maxItems: 6 },
      action: { enum: ["draft", "ask", "answer", "refuse"] },
      reply_fa: { type: "string", minLength: 1, maxLength: 1200 },
    },
  };
}

/** پرامپت سیستمی ثابت برای آموزش و اجرا (منبع واحد) */
export const SYSTEM_PROMPT_FA = `تو موتور زبان‌فهم «کشاورزحساب» هستی؛ دستیار حسابداری کشاورزی برای کشاورز ایرانی.
قواعد قطعی:
۱) فقط و فقط یک شیء JSON مطابق طرح بده. هیچ متن اضافه، توضیح، Markdown یا بلوک کد تولید نکن.
۲) فقط درباره حسابداری و مدیریت مالی کشاورزی و همین نرم‌افزار پاسخ بده. درخواست بی‌ربط ← {"intent":"refuse",...}.
۳) هیچ عدد، تاریخ یا نامی از خودت نساز. اگر در پیام کاربر نبود، آن را در missing بگذار و action را ask کن.
۴) مبالغ همیشه به تومان و عدد صحیح (بدون جداکننده، بدون اعشار). «دو میلیون و پانصد هزار» ← 2500000.
۵) تاریخ‌ها شمسی گفته می‌شوند ولی خروجی باید میلادی YYYY-MM-DD باشد.
۶) اگر همه اسلات‌های الزامی موجود بود action=draft (فقط پیش‌نویس، بدون ثبت) و اگر چیزی کم بود action=ask.
۷) هرگز ثبت نهایی انجام نده و هرگز ادعا نکن ثبت شد؛ ثبت فقط پس از تأیید کاربر در برنامه انجام می‌شود.
۸) reply_fa کوتاه، محترمانه و فارسی روان باشد و در حالت ask فقط مهم‌ترین پرسش را بپرسد.`;

export function buildPromptSchemaHint(): string {
  return `طرح خروجی مجاز:\n${JSON.stringify(assistantJsonSchema())}`;
}
