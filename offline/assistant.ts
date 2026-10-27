/**
 * دستیار آفلاین — تشخیص قصد و استخراج اسلات، بدون هیچ محاسبه‌ی مالی.
 * پاسخ‌های عددی فقط از موتور قطعی (store/engine) خوانده می‌شوند.
 */
import {
  addDays,
  aging,
  balanceSheet,
  budgetUsage,
  cashFlow,
  cashOf,
  contactBalance,
  currentPeriod,
  expenseOf,
  fmt,
  formatJalali,
  groupExpense,
  incomeOf,
  invoiceRemaining,
  toJalali,
  todayISO,
  fromJalali,
  toISO,
  normalizeDigits,
  profitOf,
  projectProfit,
  toAmount,
  trialBalance,
  type DB,
} from "./engine";

export type DraftTool = "txn" | "invoice" | "payment" | "cheque";

export interface AssistantDraft {
  tool: DraftTool;
  fields: Record<string, string>;
}

export interface AssistantResult {
  intent: string;
  title: string;
  action: "draft" | "answer" | "ask" | "refuse";
  reply: string;
  details?: { label: string; value: string }[];
  draft?: AssistantDraft;
  missing?: string[];
}

interface IntentDef {
  id: string;
  title: string;
  action: "draft" | "answer" | "ask";
  groups: string[][];
  need?: ("amount" | "date" | "contact" | "serial" | "qty")[];
}

export const OFFLINE_INTENTS: IntentDef[] = [
  { id: "add_expense", title: "ثبت هزینه", action: "draft", groups: [["هزینه", "خریدم", "خرید کردم", "پرداخت کردم", "دادم", "خرج"]], need: ["amount"] },
  { id: "add_income", title: "ثبت درآمد", action: "draft", groups: [["درآمد", "فروختم", "دریافت کردم", "گرفتم", "فروش"]], need: ["amount"] },
  { id: "transfer", title: "انتقال بین حساب‌ها", action: "draft", groups: [["انتقال", "منتقل", "واریز کردم به"]], need: ["amount"] },
  { id: "sale_invoice", title: "فاکتور فروش", action: "draft", groups: [["فاکتور", "فروش"]], need: ["amount"] },
  { id: "purchase_invoice", title: "فاکتور خرید", action: "draft", groups: [["فاکتور خرید", "خرید نهاده", "نهاده خریدم"]], need: ["amount"] },
  { id: "payment_in", title: "دریافت از مشتری", action: "draft", groups: [["دریافت", "وصول", "گرفتم از"]], need: ["amount"] },
  { id: "payment_out", title: "پرداخت به تأمین‌کننده", action: "draft", groups: [["پرداخت به", "پرداختم به", "واریز کردم به"]], need: ["amount"] },
  { id: "cheque_received", title: "چک دریافتی", action: "draft", groups: [["چک"], ["دریافت", "دریافتی", "گرفت"]], need: ["amount", "date", "serial"] },
  { id: "cheque_paid", title: "چک پرداختی", action: "draft", groups: [["چک"], ["پرداخت", "پرداختی", "دادم"]], need: ["amount", "date", "serial"] },
  { id: "report_profit", title: "سود و زیان دوره", action: "answer", groups: [["سود", "زیان"]] },
  { id: "report_cash", title: "جریان نقدی", action: "answer", groups: [["نقد", "نقدینگی", "جریان"]], need: [] },
  { id: "report_receivable", title: "مطالبات از مشتریان", action: "answer", groups: [["طلب", "مطالبات", "دریافتنی", "بدهکار"]] },
  { id: "report_payable", title: "بدهی به تأمین‌کنندگان", action: "answer", groups: [["بدهی", "بدهکاریم", "پرداختنی", "بستانکار"]] },
  { id: "report_tax", title: "گزارش مالیات", action: "answer", groups: [["مالیات", "ارزش افزوده"]] },
  { id: "report_expense", title: "تفکیک هزینه‌ها", action: "answer", groups: [["هزینه‌ها", "بیشترین هزینه", "تفکیک"]] },
  { id: "report_balance", title: "ترازنامه ساده", action: "answer", groups: [["ترازنامه", "تراز", "دارایی و بدهی"]] },
  { id: "report_aging", title: "مطالبات معوق", action: "answer", groups: [["معوق", "سنی", "سررسید گذشته"]] },
  { id: "report_stock", title: "موجودی انبار", action: "answer", groups: [["موجودی", "انبار"]] },
  { id: "report_loan", title: "اقساط و وام", action: "answer", groups: [["قسط", "وام", "اقساط"]] },
  { id: "report_farm", title: "سود زمین‌ها", action: "answer", groups: [["زمین", "مزرعه", "محصول"]] },
  { id: "help", title: "راهنما", action: "answer", groups: [["راهنما", "کمک", "چه کار", "چطور"]] },
];

const EXPENSE_MAP: { re: RegExp; code: string }[] = [
  { re: /دستمزد|کارگر|مزد/, code: "5110" },
  { re: /کود|بذر|سم|نهاده|علف/, code: "5120" },
  { re: /گازوئیل|سوخت|بنزین|دیزل/, code: "5130" },
  { re: /آب|برق|اجاره|گاز/, code: "5140" },
  { re: /تعمیر|قطعه|یدکی/, code: "5190" },
];

export function extractAmount(text: string): number | null {
  const n = toAmount(normalizeDigits(text).replace(/[^\d۰-۹٠-٩٠-٩.,،٬\s]*(هزار|میلیون|میلیارد)/g, (m) => m));
  const matched = /(\d[\d.,٬،]*)\s*(هزار|میلیون|میلیارد)/.exec(normalizeDigits(text));
  if (matched) {
    const base = toAmount(matched[1]);
    const mult = matched[2] === "میلیارد" ? 1_000_000_000 : matched[2] === "میلیون" ? 1_000_000 : 1000;
    return Math.round(base * mult);
  }
  const digits = /(\d{4,})/.exec(normalizeDigits(text).replace(/[.,٬،]/g, ""));
  return digits ? Number(digits[1]) : n > 0 ? n : null;
}

export function extractDate(text: string, today = todayISO()): string | null {
  const t = normalizeDigits(text);
  if (/دیروز/.test(t)) return addDays(today, -1);
  if (/امروز/.test(t)) return today;
  if (/فردا/.test(t)) return addDays(today, 1);
  const rel = /(\d+)\s*روز\s*(بعد|دیگر|آینده)/.exec(t);
  if (rel) return addDays(today, Number(rel[1]));
  const past = /(\d+)\s*روز\s*(پیش|قبل)/.exec(t);
  if (past) return addDays(today, -Number(past[1]));
  const jdate = /(1[34]\d{2})[/\-.](\d{1,2})[/\-.](\d{1,2})/.exec(t);
  if (jdate) return toISO(fromJalali(Number(jdate[1]), Number(jdate[2]), Number(jdate[3])));
  return null;
}

function score(text: string, def: IntentDef): number {
  let hits = 0;
  for (const group of def.groups) {
    if (!group.some((word) => text.includes(word))) return 0;
    hits += 1;
  }
  return hits * 10 + def.groups.length;
}

export function runAssistant(text: string, db: DB, today = todayISO()): AssistantResult {
  const input = normalizeDigits(text.trim());
  if (!input) return { intent: "unknown", title: "درخواست خالی", action: "refuse", reply: "یک جمله بنویسید؛ مثلاً «۴۵۰ هزار تومان گازوئیل خریدم»." };

  const amount = extractAmount(input);
  const date = extractDate(input, today);
  const serial = /چک\s*(?:شماره\s*)?(\d{3,})/.exec(input)?.[1] ?? "";
  const contact = db.contacts.find((c) => c.name.length > 2 && (input.includes(c.name) || c.name.split(/\s+/).some((p) => p.length > 3 && input.includes(p))));
  const period = currentPeriod();
  const matched = OFFLINE_INTENTS.map((def) => ({ def, s: score(input, def) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);

  if (!matched.length) {
    return {
      intent: "unknown",
      title: "متوجه نشدم",
      action: "refuse",
      reply:
        "این جمله را به یک قصد حسابداری نسبت ندادم. نمونه‌های درست: «۴۵۰ هزار تومان گازوئیل خریدم»، «۸۰ میلیون از شرکت لبنیات دریافت کردم»، «سود این ماه چقدر است؟»، «موجودی انبار چقدر است؟».",
    };
  }

  const def = matched[0].def;
  const need = def.need ?? [];
  const missing: string[] = [];
  if (need.includes("amount") && !amount) missing.push("مبلغ");
  if (need.includes("date") && !date) missing.push("تاریخ سررسید");
  if (need.includes("serial") && !serial) missing.push("شماره چک");
  if (need.includes("contact") && !contact) missing.push("طرف‌حساب");
  const account = /صندوق|نقد/.test(input) ? "1010" : "1020";

  if (missing.length) {
    return {
      intent: def.id,
      title: def.title,
      action: "ask",
      missing,
      reply: `«${def.title}» را متوجه شدم، اما ${missing.join(" و ")} را نگفتید. همان جمله را کامل‌تر بنویسید تا پیش‌نویس بسازم.`,
    };
  }

  if (def.action === "draft") {
    const amountText = String(amount ?? 0);
    switch (def.id) {
      case "add_expense": {
        const code = EXPENSE_MAP.find((m) => m.re.test(input))?.code ?? "5190";
        return {
          intent: def.id,
          title: def.title,
          action: "draft",
          reply: "پیش‌نویس هزینه آماده است. تا تأیید شما هیچ سندی ثبت نمی‌شود.",
          draft: { tool: "txn", fields: { kind: "expense", amount: amountText, date: date ?? today, desc: input.slice(0, 70), categoryCode: code, accountCode: account, contactId: contact ? String(contact.id) : "" } },
        };
      }
      case "add_income": {
        const code = /فروش|گندم|جو|محصول/.test(input) ? "4100" : "4110";
        return {
          intent: def.id,
          title: def.title,
          action: "draft",
          reply: "پیش‌نویس درآمد آماده است. تا تأیید شما سندی ثبت نمی‌شود.",
          draft: { tool: "txn", fields: { kind: "income", amount: amountText, date: date ?? today, desc: input.slice(0, 70), categoryCode: code, accountCode: account, contactId: contact ? String(contact.id) : "" } },
        };
      }
      case "transfer":
        return {
          intent: def.id,
          title: def.title,
          action: "draft",
          reply: "پیش‌نویس انتقال آماده است؛ حساب مبدأ و مقصد را در فرم بررسی کنید.",
          draft: { tool: "txn", fields: { kind: "transfer", amount: amountText, date: date ?? today, desc: "انتقال بین حساب‌ها", fromCode: account, toCode: account === "1010" ? "1020" : "1010" } },
        };
      case "sale_invoice":
      case "purchase_invoice":
        return {
          intent: def.id,
          title: def.title,
          action: "draft",
          reply: "پیش‌نویس فاکتور آماده است؛ طرف‌حساب و ردیف را بررسی و تکمیل کنید.",
          draft: {
            tool: "invoice",
            fields: {
              type: def.id === "sale_invoice" ? "sale" : "purchase",
              amount: amountText,
              date: date ?? today,
              due: date ?? today,
              contactId: contact ? String(contact.id) : "",
              desc: input.slice(0, 60),
            },
          },
        };
      case "payment_in":
      case "payment_out":
        return {
          intent: def.id,
          title: def.title,
          action: "draft",
          reply: "پیش‌نویس دریافت/پرداخت آماده است؛ با تأیید شما سند خزانه ثبت می‌شود.",
          draft: {
            tool: "payment",
            fields: { direction: def.id === "payment_in" ? "in" : "out", amount: amountText, date: date ?? today, accountCode: account, contactId: contact ? String(contact.id) : "", method: "bank" },
          },
        };
      default:
        return {
          intent: def.id,
          title: def.title,
          action: "draft",
          reply: "پیش‌نویس چک آماده است؛ شماره و سررسید را بررسی کنید.",
          draft: {
            tool: "cheque",
            fields: { direction: def.id === "cheque_received" ? "received" : "paid", amount: amountText, serial, due: date ?? addDays(today, 7), contactId: contact ? String(contact.id) : "" },
          },
        };
    }
  }

  // پاسخ‌های گزارشی — همه از موتور قطعی
  const range = { start: period.start, end: period.end };
  switch (def.id) {
    case "report_profit": {
      const income = incomeOf(db, range);
      const expense = expenseOf(db, range);
      return {
        intent: def.id,
        title: def.title,
        action: "answer",
        reply: `در ${period.label}، درآمد ${fmt(income)} و هزینه ${fmt(expense)} ثبت شده است؛ سود دوره ${fmt(profitOf(db, range))}.`,
        details: [
          { label: "درآمد", value: fmt(income) },
          { label: "هزینه", value: fmt(expense) },
          { label: "سود دوره", value: fmt(profitOf(db, range)) },
        ],
      };
    }
    case "report_cash": {
      const flow = cashFlow(db, range);
      return {
        intent: def.id,
        title: def.title,
        action: "answer",
        reply: `جریان نقد ${period.label}: ورود ${fmt(flow.inflow)}، خروج ${fmt(flow.outflow)}، خالص ${fmt(flow.net)}. موجودی نقد فعلی ${fmt(cashOf(db))}.`,
        details: [
          { label: "ورود", value: fmt(flow.inflow) },
          { label: "خروج", value: fmt(flow.outflow) },
          { label: "موجودی نقد", value: fmt(cashOf(db)) },
        ],
      };
    }
    case "report_receivable": {
      const total = db.invoices.filter((i) => i.type === "sale").reduce((s, i) => s + invoiceRemaining(i), 0);
      const count = db.invoices.filter((i) => i.type === "sale" && invoiceRemaining(i) > 0).length;
      return { intent: def.id, title: def.title, action: "answer", reply: `مجموع مطالبات ${fmt(total)} در ${count} فاکتور باز است.`, details: [{ label: "جمع مطالبات", value: fmt(total) }, { label: "فاکتور باز", value: String(count) }] };
    }
    case "report_payable": {
      const total = db.invoices.filter((i) => i.type === "purchase").reduce((s, i) => s + invoiceRemaining(i), 0);
      return { intent: def.id, title: def.title, action: "answer", reply: `مجموع بدهی به تأمین‌کنندگان ${fmt(total)} است.`, details: [{ label: "بستانکاری", value: fmt(total) }] };
    }
    case "report_tax": {
      const inPeriod = db.invoices.filter((i) => i.date >= range.start && i.date <= range.end);
      const saleTax = inPeriod.filter((i) => i.type === "sale").reduce((s, i) => s + i.tax, 0);
      const purchaseTax = inPeriod.filter((i) => i.type === "purchase").reduce((s, i) => s + i.tax, 0);
      return { intent: def.id, title: def.title, action: "answer", reply: `مالیات فروش ${fmt(saleTax)} و مالیات خرید ${fmt(purchaseTax)}؛ خالص ${fmt(saleTax - purchaseTax)}.`, details: [{ label: "مالیات فروش", value: fmt(saleTax) }, { label: "مالیات خرید", value: fmt(purchaseTax) }] };
    }
    case "report_expense": {
      const groups = groupExpense(db, range);
      return {
        intent: def.id,
        title: def.title,
        action: "answer",
        reply: groups.length ? `بیشترین هزینه ${period.label}: ${groups[0].name} با ${fmt(groups[0].amount)}.` : "در این دوره هزینه‌ای ثبت نشده است.",
        details: groups.slice(0, 5).map((g) => ({ label: g.name, value: fmt(g.amount) })),
      };
    }
    case "report_balance": {
      const sheet = balanceSheet(db);
      return {
        intent: def.id,
        title: def.title,
        action: "answer",
        reply: `دارایی خالص ${fmt(sheet.assets)}، بدهی ${fmt(sheet.liabilities)} و حقوق صاحبان سرمایه ${fmt(sheet.equity)}. ${sheet.balanced ? "ترازنامه تراز است." : "ترازنامه عدم تراز دارد؛ بررسی لازم است."}`,
        details: [
          { label: "دارایی", value: fmt(sheet.assets) },
          { label: "بدهی", value: fmt(sheet.liabilities) },
          { label: "سرمایه + سود", value: fmt(sheet.equity) },
        ],
      };
    }
    case "report_aging": {
      const buckets = aging(db);
      return { intent: def.id, title: def.title, action: "answer", reply: `مطالبات معوق: ${buckets[3].count} فاکتور بیش از ۶۰ روز.`, details: buckets.map((b) => ({ label: b.label, value: fmt(b.amount) })) };
    }
    case "report_stock": {
      const low = db.products.filter((p) => p.stock <= p.min);
      return {
        intent: def.id,
        title: def.title,
        action: "answer",
        reply: low.length ? `${low.length} قلم به حد سفارش رسیده است: ${low.map((p) => p.name).join("، ")}.` : "همه‌ی اقلام بالای حد سفارش هستند.",
        details: db.products.slice(0, 6).map((p) => ({ label: p.name, value: `${p.stock} ${p.unit}` })),
      };
    }
    case "report_loan": {
      const open = db.installments.filter((i) => !i.paid);
      const total = open.reduce((s, i) => s + i.principal + i.interest, 0);
      return { intent: def.id, title: def.title, action: "answer", reply: `${open.length} قسط پرداخت‌نشده با مجموع ${fmt(total)} باقی مانده است.`, details: db.loans.map((l) => ({ label: l.title, value: `اصل ${fmt(l.principal)}` })) };
    }
    case "report_farm": {
      return {
        intent: def.id,
        title: def.title,
        action: "answer",
        reply: db.projects.length ? "سود هر زمین بر پایه‌ی اسناد مرکز هزینه محاسبه شد." : "زمینی ثبت نشده است.",
        details: db.projects.map((p) => ({ label: p.name, value: fmt(projectProfit(db, p.id).profit) })),
      };
    }
    case "help":
    default:
      return {
        intent: "help",
        title: "راهنما",
        action: "answer",
        reply: `من ${OFFLINE_INTENTS.length} قصد آفلاین را می‌فهمم: ثبت هزینه/درآمد/انتقال، دریافت و پرداخت، چک، و گزارش‌های قطعی (سود، نقد، مطالبات، بدهی، مالیات، ترازنامه، معوق، انبار، اقساط، سود زمین). هیچ عددی را خودم حساب نمی‌کنم و بدون تأیید شما سندی ثبت نمی‌شود.`,
        details: [
          { label: "تعداد قصد", value: String(OFFLINE_INTENTS.length) },
          { label: "حالت", value: db.settings.assistantMode === "backup" ? "پشتیبان (فقط خواندن)" : "دستیار (پیش‌نویس + تأیید)" },
          { label: "دوره گزارش", value: `${period.label} ${toJalali(new Date()).jy}` },
        ],
      };
  }
}

export const ASSISTANT_INTENT_COUNT = OFFLINE_INTENTS.length;
export const ASSISTANT_SAMPLES = ["۴۵۰ هزار تومان گازوئیل خریدم", "۸۰ میلیون از شرکت لبنیات دریافت کردم", "سود این ماه چقدر است؟", "موجودی انبار چقدر است؟", "چک دریافتی ۵۰ میلیون با سررسید ۱۰ روز بعد", "مطالبات معوق را نشان بده"];
void contactBalance;
void trialBalance;
void budgetUsage;
void formatJalali;
