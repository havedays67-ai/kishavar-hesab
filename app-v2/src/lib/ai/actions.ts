/**
 * کنش‌های دستیار — قرارداد بسته و امن
 * ------------------------------------------------------------
 * مدل زبانی هیچ‌گاه مستقیم به برنامه دست نمی‌زند. فقط یک «برنامهٔ کنش»
 * (JSON) پیشنهاد می‌دهد؛ این فایل آن را اعتبارسنجی می‌کند و برنامه، خودش
 * با توابع موجودِ همان صفحه اجرا می‌کند.
 *
 * قواعد امنیتی:
 *  • فهرست بستهٔ کنش‌ها (allowlist)؛ هر چیز دیگر رد می‌شود.
 *  • فیلدهای مجاز هر رکورد مشخص است؛ فیلد ناشناخته = رد کل کنش.
 *  • حذف و ویرایش همیشه نیازمند تأیید صریح کاربر است.
 *  • حداکثر ۳ کنش در هر نوبت تا مدل «کارگاه» راه نیندازد.
 *  • هیچ URL، کد، یا نام فایل دلخواه پذیرفته نمی‌شود.
 */

export type PageKey =
  | "dashboard" | "finance" | "parties" | "inventory" | "trade" | "crops" | "rentals"
  | "contracts" | "documents" | "reports" | "receipts" | "signatures" | "profile" | "backup";

export type ActionType =
  | "navigate"
  | "party.create"
  | "party.payment.add"
  | "entry.add"
  | "receipt.open"
  | "receipt.send"
  | "record.update"
  | "document.print"
  | "document.create"
  | "document.send"
  | "signature.request"
  | "answer";

export interface NavigateAction { type: "navigate"; page: PageKey }
export interface PartyCreateAction {
  type: "party.create";
  name: string;
  kind: "debtor" | "creditor";
  amount: number;
  reason: string;
  city?: string;
  phone?: string;
}
export interface PartyPaymentAction {
  type: "party.payment.add";
  partyId: string;
  amount: number;
  method: "cash" | "bank" | "cheque" | "card";
  note?: string;
}
export interface EntryAddAction {
  type: "entry.add";
  kind: "income" | "expense";
  amount: number;
  reason: string;
  category?: string;
}
export interface ReceiptOpenAction { type: "receipt.open"; target: "last" | "party" | "party-payment" | "trade" | "cheque"; id?: string }
export interface RecordUpdateAction {
  type: "record.update";
  record: "party" | "crop" | "inventory" | "trade";
  id: string;
  field: "name" | "phone" | "city" | "reason" | "amount" | "note" | "dueDate";
  value: string;
}
export type AssistantDocType =
  | "sale-contract" | "weigh-ticket" | "quality-minutes" | "sale-invoice" | "settlement"
  | "lease-contract" | "lease-receipt" | "lease-handover" | "trades-report" | "cost-report"
  | "party-statement" | "finance-report" | "inventory-report" | "cheque-sheet";

export interface DocumentPrintAction { type: "document.print"; docType: AssistantDocType; id?: string }
export interface DocumentCreateAction {
  type: "document.create";
  docType: AssistantDocType;
  id?: string;
  partyId?: string;
  title?: string;
}
export interface DocumentSendAction { type: "document.send"; docType: AssistantDocType; id?: string }
export interface ReceiptSendAction { type: "receipt.send"; target: "last" | "party" | "party-payment" | "trade" | "cheque"; id?: string }
export interface SignatureRequestAction {
  type: "signature.request";
  title: string;
  note?: string;
  signerRole: string;
}
export interface AnswerAction { type: "answer"; text: string }

export type AppAction =
  | NavigateAction
  | PartyCreateAction
  | PartyPaymentAction
  | EntryAddAction
  | ReceiptOpenAction
  | ReceiptSendAction
  | RecordUpdateAction
  | DocumentPrintAction
  | DocumentCreateAction
  | DocumentSendAction
  | SignatureRequestAction
  | AnswerAction;

export interface ActionPlan {
  actions: AppAction[];
  /** جمله‌ای که به کاربر نشان داده می‌شود. */
  say: string;
  /** اگر مدل مطمئن نیست، به‌جای اجرا سؤال می‌پرسد. */
  question?: string;
}

const PAGES: PageKey[] = ["dashboard", "finance", "parties", "inventory", "trade", "crops", "rentals", "contracts", "documents", "reports", "receipts", "signatures", "profile", "backup"];
const METHODS = ["cash", "bank", "cheque", "card"] as const;
const RECORD_FIELDS: Record<string, string[]> = {
  party: ["name", "phone", "city", "reason", "amount", "note", "dueDate"],
  crop: ["name", "amount", "note"],
  inventory: ["name", "amount", "note"],
  trade: ["name", "amount", "note"],
};
const DOC_TYPES: AssistantDocType[] = [
  "sale-contract", "weigh-ticket", "quality-minutes", "sale-invoice", "settlement",
  "lease-contract", "lease-receipt", "lease-handover", "trades-report", "cost-report",
  "party-statement", "finance-report", "inventory-report", "cheque-sheet",
];
const SIGNER_ROLES = ["seller", "buyer", "landlord", "tenant", "witness", "manager", "counterparty", "payer", "payee", "issuer"];

export const MAX_ACTIONS = 3;
export const DESTRUCTIVE: ActionType[] = ["record.update"];
/** حداکثر مبلغ مجاز برای یک کنش خودکار (تومان)؛ بالاتر = تأیید دستی و پیش‌فرض رد. */
export const MAX_AUTO_AMOUNT = 5_000_000_000;

export interface ValidationResult {
  ok: boolean;
  plan?: ActionPlan;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function positiveAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_AUTO_AMOUNT;
}

function cleanText(value: unknown, max = 120): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > max) return null;
  if (/[<>{}]|javascript:|https?:\/\//i.test(text)) return null;
  return text;
}

/** اعتبارسنجی یک کنش؛ خروجی null یعنی رد. */
export function validateAction(raw: unknown): { action?: AppAction; error?: string } {
  if (!isRecord(raw) || typeof raw.type !== "string") return { error: "کنش بدون type" };
  const type = raw.type as ActionType;

  switch (type) {
    case "navigate": {
      const page = String(raw.page ?? "") as PageKey;
      if (!PAGES.includes(page)) return { error: `صفحهٔ ناشناخته: ${page}` };
      return { action: { type, page } };
    }
    case "party.create": {
      const name = cleanText(raw.name, 60);
      const reason = cleanText(raw.reason, 160);
      if (!name || !reason) return { error: "نام یا دلیل ناقص است" };
      if (raw.kind !== "debtor" && raw.kind !== "creditor") return { error: "نوع طرف‌حساب نامعتبر" };
      if (!positiveAmount(raw.amount)) return { error: "مبلغ نامعتبر" };
      return {
        action: {
          type,
          name,
          kind: raw.kind,
          amount: raw.amount,
          reason,
          city: cleanText(raw.city, 40) ?? undefined,
          phone: cleanText(raw.phone, 20) ?? undefined,
        },
      };
    }
    case "party.payment.add": {
      const partyId = cleanText(raw.partyId, 80);
      if (!partyId) return { error: "شناسهٔ طرف‌حساب لازم است" };
      if (!positiveAmount(raw.amount)) return { error: "مبلغ پرداخت نامعتبر" };
      const method = String(raw.method ?? "cash");
      if (!METHODS.includes(method as (typeof METHODS)[number])) return { error: "روش پرداخت نامعتبر" };
      return { action: { type, partyId, amount: raw.amount, method: method as PartyPaymentAction["method"], note: cleanText(raw.note, 120) ?? undefined } };
    }
    case "entry.add": {
      if (raw.kind !== "income" && raw.kind !== "expense") return { error: "نوع تراکنش نامعتبر" };
      const reason = cleanText(raw.reason, 160);
      if (!reason || !positiveAmount(raw.amount)) return { error: "مبلغ یا دلیل نامعتبر" };
      return { action: { type, kind: raw.kind, amount: raw.amount, reason, category: cleanText(raw.category, 40) ?? undefined } };
    }
    case "receipt.open": {
      const id = cleanText(raw.id, 80);
      const target = String(raw.target ?? "last");
      if (!id && target !== "last") return { error: "شناسهٔ رکورد لازم است" };
      if (!["last", "party", "party-payment", "trade", "cheque"].includes(target)) return { error: "نوع رکورد رسید نامعتبر" };
      return { action: { type, target: target as ReceiptOpenAction["target"], id: id ?? undefined } };
    }
    case "record.update": {
      const record = String(raw.record ?? "");
      const id = cleanText(raw.id, 80);
      const field = String(raw.field ?? "");
      const value = cleanText(raw.value, 160);
      if (!RECORD_FIELDS[record]) return { error: "رکورد نامعتبر" };
      if (!id || !value) return { error: "شناسه یا مقدار ناقص" };
      if (!RECORD_FIELDS[record].includes(field)) return { error: `فیلد ${field} برای این رکورد مجاز نیست` };
      if (field === "amount" && !positiveAmount(Number(value.replace(/[^\d]/g, "")))) return { error: "مبلغ نامعتبر" };
      return { action: { type, record: record as RecordUpdateAction["record"], id, field: field as RecordUpdateAction["field"], value } };
    }
    case "document.print":
    case "document.create":
    case "document.send": {
      const docType = String(raw.docType ?? "");
      if (!DOC_TYPES.includes(docType as AssistantDocType)) return { error: "نوع سند نامعتبر" };
      const id = cleanText(raw.id, 80) ?? undefined;
      if (type === "document.print") return { action: { type, docType: docType as AssistantDocType, id } };
      if (type === "document.send") return { action: { type, docType: docType as AssistantDocType, id } };
      return {
        action: {
          type,
          docType: docType as AssistantDocType,
          id,
          partyId: cleanText(raw.partyId, 80) ?? undefined,
          title: cleanText(raw.title, 120) ?? undefined,
        },
      };
    }
    case "receipt.send": {
      const target = String(raw.target ?? "last");
      if (!["last", "party", "party-payment", "trade", "cheque"].includes(target)) return { error: "نوع رسید نامعتبر" };
      return { action: { type, target: target as ReceiptSendAction["target"], id: cleanText(raw.id, 80) ?? undefined } };
    }
    case "signature.request": {
      const title = cleanText(raw.title, 120);
      if (!title) return { error: "عنوان سند امضا لازم است" };
      const signerRole = String(raw.signerRole ?? "counterparty");
      if (!SIGNER_ROLES.includes(signerRole)) return { error: "سمت امضاکننده نامعتبر" };
      return { action: { type, title, note: cleanText(raw.note, 240) ?? undefined, signerRole } };
    }
    case "answer": {
      const text = cleanText(raw.text, 600);
      if (!text) return { error: "متن پاسخ ناقص" };
      return { action: { type, text } };
    }
    default:
      return { error: `کنش غیرمجاز: ${String(type).slice(0, 24)}` };
  }
}

/** تفسیر خروجی JSON مدل؛ اگر خراب بود، هیچ کنشی اجرا نمی‌شود. */
export function parseActionPlan(raw: string): ValidationResult {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) return { ok: false, errors: ["JSON پیدا نشد"] };
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { ok: false, errors: ["JSON نامعتبر"] };
  }
  if (!isRecord(parsed)) return { ok: false, errors: ["ساختار نامعتبر"] };

  const say = cleanText(parsed.say, 600) ?? "";
  const question = cleanText(parsed.question, 300) ?? undefined;
  const rawActions = Array.isArray(parsed.actions) ? parsed.actions : [];
  if (rawActions.length > MAX_ACTIONS) return { ok: false, errors: [`حداکثر ${MAX_ACTIONS} کنش در هر نوبت مجاز است`] };

  const actions: AppAction[] = [];
  for (const item of rawActions.slice(0, MAX_ACTIONS)) {
    const result = validateAction(item);
    if (result.action) actions.push(result.action);
    else if (result.error) errors.push(result.error);
  }
  // اگر هیچ کنش معتبری نمانده و مدل هم سؤالی نپرسیده، متن «ثبت شد» به‌تنهایی پذیرفته نمی‌شود.
  if (actions.length === 0 && !question && errors.length > 0) return { ok: false, errors };
  if (actions.length === 0 && !question && !say) return { ok: false, errors: errors.length ? errors : ["هیچ کنش یا پاسخی نبود"] };
  // کنش‌های نامعتبر فقط هشدار می‌شوند؛ کنش‌های معتبر نباید به‌خاطر یک فیلد خراب از دست بروند.
  return { ok: true, plan: { actions, say, question }, errors };
}

/** متن تأیید برای کاربر؛ کنش‌های مخرب همیشه تأیید می‌خواهند. */
export function describeAction(action: AppAction): string {
  switch (action.type) {
    case "navigate": return `رفتن به صفحهٔ ${action.page}`;
    case "party.create": return `ثبت ${action.kind === "debtor" ? "بدهکار" : "بستانکار"} «${action.name}» به مبلغ ${action.amount.toLocaleString("fa-IR")} تومان`;
    case "party.payment.add": return `ثبت پرداخت ${action.amount.toLocaleString("fa-IR")} تومان برای حساب ${action.partyId}`;
    case "entry.add": return `ثبت ${action.kind === "income" ? "درآمد" : "هزینه"} ${action.amount.toLocaleString("fa-IR")} تومان — ${action.reason}`;
    case "receipt.open": return `باز کردن رسیدهای ${action.target} با شناسهٔ ${action.id}`;
    case "record.update": return `تغییر ${action.field} رکورد ${action.record} (${action.id}) به «${action.value}»`;
    case "document.print": return `آماده‌سازی چاپ ${action.docType}`;
    case "document.create": return `ساخت سند ${action.docType}${action.title ? ` «${action.title}»` : ""}`;
    case "document.send": return `ارسال/هم‌رسانی سند ${action.docType}`;
    case "receipt.send": return "ارسال رسید";
    case "signature.request": return `درخواست امضا برای «${action.title}»`;
    case "answer": return action.text;
  }
}

export function requiresConfirmation(plan: ActionPlan): boolean {
  return plan.actions.some((action) => DESTRUCTIVE.includes(action.type));
}

/** پرامپت سیستمی مدل برای تولید فقط JSON معتبر. */
export const ACTION_SYSTEM_PROMPT = `تو «کشاورزیار» هستی؛ دستیار فارسی‌زبان برنامهٔ کشاورزحساب.
فقط دربارهٔ کشاورزی، دام، نهاده، بازار و همین برنامه پاسخ بده. هیچ عدد مالی از خودت نساز.
اگر کاربر خواست کاری در برنامه انجام شود، فقط JSON زیر را بده و هیچ متن دیگری ننویس:
{"say":"توضیح کوتاه","question":null,"actions":[{"type":"...","...":"..."}]}
کنش‌های مجاز: navigate, party.create, party.payment.add, entry.add, receipt.open, receipt.send, record.update,
document.print, document.create, document.send, signature.request, answer.
نوع سند (docType) فقط یکی از: sale-contract, weigh-ticket, quality-minutes, sale-invoice, settlement,
lease-contract, lease-receipt, lease-handover, trades-report, cost-report, party-statement, finance-report,
inventory-report, cheque-sheet.
برای «امضا بگیر/امضا کن» کنش signature.request بده تا فرم مشخصات و کادر امضا برای کاربر باز شود.
برای «رسید بفرست» receipt.send و برای «سند بساز/چاپ/بفرست» document.create/document.print/document.send.
- حداکثر ۳ کنش.
- اگر اطلاعات کافی نیست، actions خالی بگذار و در question یک سؤال کوتاه بپرس.
- حذف هیچ رکوردی مجاز نیست؛ برای ویرایش فقط record.update با فیلدهای مجاز.
- مبلغ را فقط اگر کاربر گفته است بگذار؛ از خودت نساز.`;
