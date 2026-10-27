/**
 * دستیار آفلاین — تشخیص قصد و استخراج اسلات، بدون هیچ محاسبه‌ی مالی.
 * پاسخ‌های عددی فقط از موتور قطعی (store/engine) خوانده می‌شوند.
 */
import {
  addDays,
  aging,
  contactKindLabel,
  contactStatement,
  debtorsCreditors,
  faDigits,
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
  { id: "contact_balances", title: "بدهکاران و بستانکاران", action: "answer", groups: [["بدهکار", "بستانکار", "طلبکار", "طلب", "بدهی", "دفتر معین"], ["چقدر", "فهرست", "نشان", "کی", "کیست", "چه کسانی", "چه کس", "جمع", "توضیح", "چند", "کدام", "چه"]] },
  { id: "explain_home", title: "راهنمای داشبورد", action: "answer", groups: [["داشبورد", "خانه", "صفحه اول"], ["توضیح", "راهنما", "چیست", "چطور", "یعنی", "کامل"]] },
  { id: "explain_ledger", title: "راهنمای دفتر روزنامه", action: "answer", groups: [["دفتر", "روزنامه", "سند"], ["توضیح", "راهنما", "چیست", "چطور", "یعنی", "کامل"]] },
  { id: "explain_invoice", title: "راهنمای فاکتور", action: "answer", groups: [["فاکتور"], ["توضیح", "راهنما", "چیست", "چطور", "یعنی", "کامل", "نحوه"]] },
  { id: "explain_payment", title: "راهنمای دریافت و پرداخت", action: "answer", groups: [["دریافت", "پرداخت"], ["توضیح", "راهنما", "چیست", "چطور", "یعنی", "کامل", "نحوه"]] },
  { id: "explain_cheque", title: "راهنمای چک", action: "answer", groups: [["چک"], ["توضیح", "راهنما", "چیست", "چطور", "یعنی", "کامل", "نحوه"]] },
  { id: "explain_loan", title: "راهنمای وام و اقساط", action: "answer", groups: [["وام", "قسط", "اقساط"], ["توضیح", "راهنما", "چیست", "چطور", "یعنی", "کامل", "نحوه"]] },
  { id: "explain_stock", title: "راهنمای انبار", action: "answer", groups: [["انبار", "موجودی", "کالا"], ["توضیح", "راهنما", "چیست", "چطور", "یعنی", "کامل", "نحوه"]] },
  { id: "explain_asset", title: "راهنمای دارایی ثابت", action: "answer", groups: [["دارایی", "استهلاک"], ["توضیح", "راهنما", "چیست", "چطور", "یعنی", "کامل", "نحوه"]] },
  { id: "explain_budget", title: "راهنمای بودجه", action: "answer", groups: [["بودجه"], ["توضیح", "راهنما", "چیست", "چطور", "یعنی", "کامل", "نحوه"]] },
  { id: "explain_farm", title: "راهنمای زمین و کشاورزی", action: "answer", groups: [["زمین", "مزرعه", "کشاورزی"], ["توضیح", "راهنما", "چیست", "چطور", "یعنی", "کامل", "نحوه"]] },
  { id: "explain_contact", title: "راهنمای طرف‌حساب", action: "answer", groups: [["طرف‌حساب", "مشتری", "تأمین‌کننده"], ["توضیح", "راهنما", "چیست", "چطور", "یعنی", "کامل", "نحوه"]] },
  { id: "explain_reports", title: "راهنمای گزارش‌ها", action: "answer", groups: [["گزارش", "ترازنامه", "سود و زیان"], ["توضیح", "راهنما", "چیست", "چطور", "یعنی", "کامل", "نحوه"]] },
  { id: "explain_tax", title: "راهنمای مالیات", action: "answer", groups: [["مالیات"], ["توضیح", "راهنما", "چیست", "چطور", "یعنی", "کامل", "نحوه"]] },
  { id: "explain_backup", title: "راهنمای پشتیبان و بازیابی", action: "answer", groups: [["پشتیبان", "بازیابی", "بکاپ"], ["توضیح", "راهنما", "چیست", "چطور", "یعنی", "کامل", "نحوه"]] },
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


export interface SectionGuide {
  title: string;
  icon: string;
  what: string;
  steps: string[];
  tips: string[];
  example: string;
}

/** راهنمای کامل و ساده‌ی هر بخش — همان محتوایی که دستیار توضیح می‌دهد */
export const SECTION_GUIDES: Record<string, SectionGuide> = {
  home: {
    title: "داشبورد (خانه)",
    icon: "🏠",
    what:
      "داشبورد تصویر لحظه‌ای کسب‌وکار شماست: موجودی نقد و بانک، درآمد و هزینه‌ی ماه شمسی جاری، سود دوره، سود انباشته، مطالبات، بدهی‌ها، هشدار سررسید چک و قسط، اقلام زیر حد سفارش، عبور از بودجه و آخرین اسناد. همه‌ی این اعداد از دفتر کل دوطرفه محاسبه می‌شوند و هیچ‌کدام دستی وارد نمی‌شوند.",
    steps: [
      "کارت بالای صفحه: موجودی نقد و بانک، درآمد، هزینه و سود همین ماه شمسی.",
      "کارت هشدارها: هر مورد را ببینید و از دکمه‌های زیرش به همان بخش بروید.",
      "کارت بدهکاران و بستانکاران: جمع طلب‌ها و بدهی‌ها؛ با «صورتحساب» گردش هر طرف‌حساب را ببینید.",
      "آخرین اسناد: سند اشتباه را از دفتر روزنامه واگرد کنید.",
      "برای ثبت سریع، دکمه‌ی + پایین صفحه را بزنید.",
    ],
    tips: [
      "اگر «تراز دفتر: متوازن» باشد، جمع بدهکار و بستانکار برابر است؛ یعنی داده‌ی حسابداری سالم است.",
      "اعداد داشبورد بعد از هر ثبت بلافاصله بازمحاسبه می‌شوند.",
    ],
    example: "سود این ماه چقدر است؟",
  },
  ledger: {
    title: "دفتر روزنامه و ثبت سند",
    icon: "📒",
    what:
      "دفتر روزنامه قلب برنامه است. هر ثبت (هزینه، درآمد، فاکتور، دریافت، پرداخت، چک، قسط، دارایی، مانده اول دوره) یک سند دوطرفه می‌سازد: یک حساب بدهکار و یک حساب بستانکار با مبلغ برابر. به همین دلیل گزارش‌ها، ترازنامه و مالیات قابل اتکا هستند.",
    steps: [
      "مبلغ، شرح، تاریخ، حساب پرداخت/دریافت و دسته را وارد کنید.",
      "اگر هزینه یا درآمد مربوط به زمین یا مشتری است، طرف‌حساب و مرکز هزینه را انتخاب کنید.",
      "دکمه‌ی «ثبت سند متوازن» را بزنید؛ برنامه ردیف دوم (بستانکار) را خودش می‌سازد.",
      "در دفتر، ردیف‌های بدهکار و بستانکار هر سند را می‌بینید.",
      "برای برگرداندن یک سند، دکمه‌ی «واگرد» همان ردیف را بزنید (در گزارش عملیات ثبت می‌شود).",
    ],
    tips: [
      "مبلغ را فارسی یا با ضریب هم می‌توانید بنویسید: «۴۵۰ هزار» یا «۲ میلیون».",
      "سند یک‌ردیفی یا نامتوازن توسط موتور رد می‌شود؛ این یک محافظ است، نه محدودیت.",
    ],
    example: "۴۵۰ هزار تومان گازوئیل خریدم",
  },
  invoice: {
    title: "فاکتور فروش و خرید",
    icon: "🧾",
    what:
      "فاکتور فروش طلب شما از مشتری را ثبت می‌کند (بدهکار حساب‌های دریافتنی، بستانکار درآمد فروش). فاکتور خرید، بدهی شما به تأمین‌کننده و هزینه یا موجودی را ثبت می‌کند (بدهکار خرید/موجودی، بستانکار حساب‌های پرداختنی). تخفیف قبل از مالیات اعمال می‌شود و مالیات از ردیف‌های همان فاکتور محاسبه می‌شود.",
    steps: [
      "طرف‌حساب را انتخاب کنید (برای فروش: مشتری، برای خرید: تأمین‌کننده).",
      "در صورت نیاز کالا/نهاده را انتخاب کنید تا موجودی انبار هم به‌روز شود.",
      "تعداد و مبلغ واحد را وارد کنید؛ جمع ردیف، تخفیف و مالیات خودکار حساب می‌شود.",
      "سررسید را بگذارید تا در گزارش سنّی مطالبات و هشدارهای داشبورد دیده شود.",
      "بعد از فروش، از بخش «دریافت» فاکتور را تخصیص دهید تا مانده صفر شود.",
    ],
    tips: [
      "فاکتور باز و معوق در داشبورد و در گزارش بدهکاران دیده می‌شود.",
      "برای خرید، تیک «به‌روزرسانی موجودی انبار» را بزنید تا انبار اصلاح شود.",
    ],
    example: "فاکتور فروش ۱۲۰ میلیون برای شرکت لبنیات دشت",
  },
  payment: {
    title: "دریافت و پرداخت (بدهکار/بستانکار)",
    icon: "💳",
    what:
      "دریافت یعنی پول از مشتری وارد شده: بدهکار بانک یا صندوق، بستانکار حساب‌های دریافتنی. پرداخت یعنی پول به تأمین‌کننده داده‌اید: بدهکار حساب‌های پرداختنی، بستانکار بانک یا صندوق. وقتی دریافت/پرداخت را به فاکتور تخصیص دهید، مانده‌ی آن فاکتور و وضعیت پرداخت خودکار به‌روز می‌شود.",
    steps: [
      "مبلغ، تاریخ، حساب (بانک یا صندوق) و روش (بانکی/نقدی/چک) را وارد کنید.",
      "طرف‌حساب را انتخاب کنید تا در گردش حساب او ثبت شود.",
      "اگر مربوط به فاکتور مشخصی است، همان فاکتور را از فهرست «تخصیص» انتخاب کنید.",
      "ثبت کنید؛ مانده طرف‌حساب و مانده فاکتور هم‌زمان به‌روز می‌شوند.",
    ],
    tips: [
      "بدون انتخاب فاکتور هم ثبت ممکن است؛ به‌عنوان علی‌الحساب روی حساب طرف‌حساب می‌نشیند.",
      "برای دیدن نتیجه، در فهرست طرف‌حساب‌ها دکمه‌ی «صورتحساب» را بزنید.",
    ],
    example: "۸۰ میلیون از شرکت لبنیات دریافت کردم",
  },
  cheque: {
    title: "چک دریافتی و پرداختی",
    icon: "🏦",
    what:
      "چک دریافتی، تعهد مشتری به پرداخت در آینده است و چک پرداختی، تعهد شما به تأمین‌کننده. ثبت چک به‌تنهایی سند مالی نمی‌سازد؛ فقط سررسید و مبلغ را پیگیری می‌کند. با «وصول»، سند بانکی خودکار ثبت می‌شود؛ با «برگشت» هیچ سندی ساخته نمی‌شود و چک برگشتی می‌ماند.",
    steps: [
      "شماره چک، مبلغ، بانک، سررسید و طرف‌حساب را ثبت کنید.",
      "در فهرست چک‌ها، چک‌های نزدیک سررسید و معوق را ببینید.",
      "هنگام وصول، دکمه‌ی «وصول» را بزنید تا سند بانکی ساخته شود.",
      "اگر چک برگشت خورد، دکمه‌ی «برگشت» را بزنید و پیگیری حقوقی را جدا انجام دهید.",
    ],
    tips: [
      "چک پرداختی وصول‌شده بدهی به تأمین‌کننده را کاهش می‌دهد و چک دریافتی وصول‌شده طلب شما را.",
      "چک‌های سررسید نزدیک در کارت هشدار داشبورد نشان داده می‌شوند.",
    ],
    example: "چک دریافتی ۵۰ میلیون با سررسید ۱۰ روز بعد",
  },
  loan: {
    title: "وام و اقساط",
    icon: "📆",
    what:
      "با ثبت وام، برنامه جدول اقساط را می‌سازد و اصل و سود هر قسط را جدا نگه می‌دارد. هنگام پرداخت قسط، سند سه‌ردیفی ثبت می‌شود: کاهش بدهی وام (اصل)، هزینه سود و پرداخت از بانک. بدهی وام در ترازنامه و پرداخت‌های آینده در داشبورد دیده می‌شود.",
    steps: [
      "عنوان وام، وام‌دهنده، اصل، نرخ سالانه، تعداد اقساط و تاریخ شروع را وارد کنید.",
      "در فهرست وام‌ها، هر قسط با سررسید و مبلغ اصل/سود نمایش داده می‌شود.",
      "هنگام پرداخت، دکمه‌ی «پرداخت» همان قسط را بزنید تا سند ثبت شود.",
      "مانده اقساط را در گزارش وام‌ها و ترازنامه ببینید.",
    ],
    tips: ["نرخ سالانه را به درصد وارد کنید (مثلاً ۱۸).", "پرداخت قسط در گزارش عملیات قابل واگرد است."],
    example: "وام ۵۰۰ میلیونی با اقساط ۱۲ ماهه ثبت کن",
  },
  stock: {
    title: "انبار، کالا و نهاده",
    icon: "📦",
    what:
      "هر کالا یا نهاده شناسنامه دارد: واحد، دسته، بهای تمام‌شده، قیمت فروش، موجودی و حد سفارش. با هر ورود/خروج، موجودی و ارزش انبار بازمحاسبه می‌شود. فاکتور فروش/خرید هم می‌تواند موجودی را خودکار اصلاح کند. ارزش‌گذاری ساده بر پایه‌ی بهای تمام‌شده است.",
    steps: [
      "کالا یا نهاده را با واحد و بهای واحد ثبت کنید.",
      "برای ورود/خروج، مقدار و بهای واحد را وارد کنید.",
      "حد سفارش را تنظیم کنید تا هشدار کمبود در داشبورد بیاید.",
      "برای اتصال به فاکتور، هنگام صدور فاکتور کالا را انتخاب کنید.",
    ],
    tips: ["ارزش موجودی = موجودی × بهای تمام‌شده.", "اگر موجودی منفی شد یعنی خروج بدون ورود ثبت کرده‌اید."],
    example: "۲۰ کیسه کود به انبار اضافه شد",
  },
  asset: {
    title: "دارایی ثابت و استهلاک",
    icon: "🚜",
    what:
      "دارایی ثابت با بهای خرید، ارزش اسقاط و عمر مفید ثبت می‌شود. استهلاک به روش خط مستقیم ماه‌به‌ماه محاسبه می‌شود: (بها − ارزش اسقاط) ÷ عمر مفید. ارزش دفتری هر دارایی همیشه قابل بازتولید است و خرید دارایی یک سند مالی واقعی می‌سازد.",
    steps: [
      "نام، بهای خرید، ارزش اسقاط، عمر (ماه) و تاریخ خرید را وارد کنید.",
      "حساب پرداخت (بانک یا صندوق) را انتخاب کنید.",
      "در گزارش دارایی‌ها، استهلاک ماهانه، انباشته و ارزش دفتری را ببینید.",
      "برای فروش یا کنارگذاری دارایی، در نسخه‌های بعدی سند اصلاحی ثبت می‌شود.",
    ],
    tips: ["استهلاک انباشته هرگز از پایه‌ی استهلاک بیشتر نمی‌شود.", "عمر مفید را واقع‌بینانه بگذارید تا سود ماهانه درست باشد."],
    example: "استهلاک امسال چقدر است؟",
  },
  budget: {
    title: "بودجه و کنترل هزینه",
    icon: "🎯",
    what:
      "برای هر سرفصل هزینه، سقف سالانه تعیین می‌کنید. برنامه مصرف واقعی را از اسناد همان سال جمع می‌زند و درصد مصرف را نشان می‌دهد. اگر از ۱۰۰٪ عبور کنید، هشدار «عبور از بودجه» در داشبورد ظاهر می‌شود.",
    steps: [
      "سرفصل هزینه و سقف سالانه را انتخاب کنید.",
      "در گزارش بودجه، میله‌ی مصرف هر سرفصل را ببینید.",
      "برای اصلاح، بودجه‌ی همان سرفصل را دوباره ثبت کنید (جایگزین می‌شود).",
    ],
    tips: ["بودجه ادعا نیست؛ ابزار مقایسه با واقعیت است.", "برای گزارش دقیق‌تر، هر هزینه را به دسته‌ی درست بزنید."],
    example: "بودجه دستمزد چقدر مصرف شده؟",
  },
  farm: {
    title: "زمین، محصول و عملیات کشاورزی",
    icon: "🌾",
    what:
      "این بخش یک افزونه‌ی اختیاری روی هسته‌ی حسابداری است. هر زمین یک «مرکز هزینه» می‌شود؛ کاشت، آبیاری، کوددهی، دستمزد و برداشت ثبت می‌شود و سود زمین از اسناد مالی محاسبه می‌شود، نه از تخمین. سهم شریک یا مزارعه را هم مشخص می‌کنید.",
    steps: [
      "زمین را با محصول، مساحت و سهم شریک ثبت کنید.",
      "عملیات را ثبت کنید؛ اگر مبلغ دارد، سند مالی روی همان زمین ساخته می‌شود.",
      "برای هر هزینه، مرکز هزینه (زمین) را در فرم انتخاب کنید.",
      "در گزارش زمین‌ها، درآمد، هزینه و سود هر زمین را ببینید.",
    ],
    tips: ["می‌توانید این بخش را کامل نادیده بگیرید و فقط حسابداری عمومی استفاده کنید.", "سود زمین = درآمد اسناد − هزینه اسناد همان زمین."],
    example: "سود زمین شماره یک چقدر است؟",
  },
  contact: {
    title: "طرف‌حساب، بدهکار و بستانکار",
    icon: "👥",
    what:
      "هر مشتری، تأمین‌کننده، کارگر یا شریک یک پرونده دارد: مشخصات، فاکتورها، دریافت/پرداخت‌ها، چک‌های در جریان و مانده‌ی تجمعی. مانده‌ی مثبت یعنی طرف‌حساب به شما بدهکار است (بدهکار) و مانده‌ی منفی یعنی شما به او بدهکار هستید (بستانکار). گردش حساب با مانده‌ی هر ردیف نمایش داده می‌شود.",
    steps: [
      "طرف‌حساب را با نوع (مشتری/تأمین‌کننده/کارگر/شریک) ثبت کنید.",
      "برای مانده‌ی قبلی، از «مانده اول دوره» استفاده کنید و ماهیت (بدهکار/بستانکار) را انتخاب کنید.",
      "در فهرست، دکمه‌ی «صورتحساب» را بزنید تا گردش حساب و مانده‌ی هر ردیف را ببینید.",
      "از همان‌جا می‌توانید دریافت یا پرداخت ثبت کنید یا صورتحساب را کپی کنید.",
    ],
    tips: [
      "مانده هر طرف‌حساب از اسناد محاسبه می‌شود؛ عدد دستی ذخیره نمی‌شود.",
      "در گزارش «بدهکاران و بستانکاران» جمع طلب‌ها، جمع بدهی‌ها و مبالغ معوق را می‌بینید.",
    ],
    example: "بدهکاران و بستانکاران چه کسانی هستند؟",
  },
  reports: {
    title: "گزارش‌ها و صورت‌های مالی",
    icon: "📊",
    what:
      "گزارش‌ها همه از دفتر کل ساخته می‌شوند: سود و زیان (درآمد − هزینه)، جریان نقد (ورود و خروج نقد)، سنّی مطالبات (چه کسی چقدر و چند روز دیرکرد دارد)، ترازنامه (دارایی = بدهی + سرمایه)، مالیات (از ردیف‌های فاکتور)، بدهکاران و بستانکاران، تراز آزمایشی و دفتر معین حساب، بودجه، انبار، دارایی و سود زمین.",
    steps: [
      "از نوار بالا، گزارش مورد نظر را انتخاب کنید: سود و زیان، جریان نقد، مطالبات، ترازنامه، مالیات، بدهکاران، تراز آزمایشی…",
      "برای دیدن دوره‌ی دیگر، از فیلتر ماه در داشبورد یا تاریخ‌های سند استفاده کنید.",
      "خروجی بگیرید: CSV از بخش «بیشتر › داده و پشتیبان».",
    ],
    tips: ["اگر تراز آزمایشی نامتوازن بود، یعنی سندی معتبر نبوده؛ برنامه اجازه‌ی چنین سندی نمی‌دهد.", "ترازنامه‌ی متوازن نشانه‌ی سلامت داده است."],
    example: "ترازنامه ساده بده",
  },
  tax: {
    title: "مالیات",
    icon: "🧮",
    what:
      "مالیات هر فاکتور از ردیف‌های همان فاکتور محاسبه می‌شود (بعد از تخفیف)، نه از یک درصد ثابت روی جمع کل فروش. گزارش مالیات، مالیات فروش، مالیات خرید (اعتبار) و خالص قابل پرداخت را نشان می‌دهد. نرخ پیش‌فرض در تنظیمات است و برای هر فاکتور قابل تغییر است.",
    steps: [
      "نرخ مالیات پیش‌فرض را در تنظیمات تنظیم کنید.",
      "هنگام صدور فاکتور، نرخ همان فاکتور را بررسی کنید.",
      "در گزارش مالیات، مالیات فروش و خرید دوره را ببینید.",
    ],
    tips: ["این گزارش برای آماده‌سازی اظهارنامه است، نه مشاوره مالیاتی.", "قوانین محلی را با حسابدار خود بررسی کنید."],
    example: "مالیات فروش این ماه چقدر است؟",
  },
  backup: {
    title: "پشتیبان، بازیابی و تنظیمات",
    icon: "🛡️",
    what:
      "همه‌ی داده‌ها روی همین دستگاه ذخیره می‌شوند و هیچ درخواست شبکه‌ای وجود ندارد. پشتیبان JSON شامل اسناد، فاکتورها، چک، اقساط، انبار، دارایی، بودجه، زمین، طرف‌حساب‌ها و تنظیمات است و هیچ کلید یا رمزی در آن نیست. با «بازیابی» می‌توانید همان فایل را برگردانید.",
    steps: [
      "از «بیشتر › داده و پشتیبان» دکمه‌ی «پشتیبان JSON» را بزنید.",
      "فایل را در جای امن (ایمیل یا حافظه) نگه دارید.",
      "برای بازیابی، محتوای فایل را در کادر «بازیابی» بچسبانید و ثبت کنید.",
      "برای شروع از صفر، «پاک‌سازی» و برای آموزش، «داده نمونه» را بزنید.",
    ],
    tips: ["قبل از هر تغییر بزرگ پشتیبان بگیرید.", "خروجی CSV برای حسابدار و تحلیل در Excel مناسب است."],
    example: "چطور پشتیبان بگیرم؟",
  },
};

export function sectionGuide(section: string): SectionGuide | null {
  return SECTION_GUIDES[section] ?? null;
}

export const GUIDE_SECTIONS = Object.keys(SECTION_GUIDES);

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
  const contactForStatement = db.contacts.find((c) => c.name.length > 2 && (input.includes(c.name) || c.name.split(/\s+/).some((part) => part.length > 3 && input.includes(part))));
  if (contactForStatement && /صورتحساب|گردش|دفتر معین|مانده/.test(input)) {
    const st = contactStatement(db, contactForStatement.id);
    return {
      intent: "contact_statement",
      title: `صورتحساب ${contactForStatement.name}`,
      action: "answer",
      reply: `${contactKindLabel(contactForStatement.kind)} — مانده ${fmt(Math.abs(st.net))} ${st.net > 0 ? "بدهکار به شما" : st.net < 0 ? "بستانکار از شما" : "(تسویه)"}؛ ${faDigits(st.openInvoices)} فاکتور باز${st.overdue > 0 ? ` و ${fmt(st.overdue)} معوق` : ""}.`,
      details: [
        { label: "جمع بدهکار", value: fmt(st.debit) },
        { label: "جمع بستانکار", value: fmt(st.credit) },
        { label: "مانده", value: fmt(st.net) },
        { label: "چک در جریان", value: fmt(st.chequesPending) },
        ...st.rows.slice(-5).map((r) => ({ label: formatJalali(r.date), value: `${r.title} · ${fmt(r.debit - r.credit)}` })),
      ],
    };
  }

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

  // توضیح بخش‌ها، بدهکار/بستانکار و صورتحساب — بدون نوشتن داده
  if (def.id.startsWith("explain_")) {
    const guide = sectionGuide(def.id.slice("explain_".length));
    if (guide) {
      return {
        intent: def.id,
        title: guide.title,
        action: "answer",
        reply: `${guide.icon} ${guide.title}\n${guide.what}`,
        details: [
          ...guide.steps.map((step, i) => ({ label: `گام ${faDigits(i + 1)}`, value: step })),
          ...guide.tips.map((tip) => ({ label: "نکته", value: tip })),
          { label: "نمونه", value: guide.example },
        ],
      };
    }
  }

  if (def.id === "contact_balances") {
    const dc = debtorsCreditors(db);
    const rows = [
      ...dc.debtors.slice(0, 6).map((c) => ({ label: `بدهکار · ${c.name}`, value: fmt(c.net) })),
      ...dc.creditors.slice(0, 6).map((c) => ({ label: `بستانکار · ${c.name}`, value: fmt(Math.abs(c.net)) })),
    ];
    return {
      intent: def.id,
      title: def.title,
      action: "answer",
      reply:
        dc.debtors.length + dc.creditors.length === 0
          ? "هنوز طرف‌حسابی با مانده ثبت نشده است. اول طرف‌حساب و سپس فاکتور یا مانده اول دوره ثبت کنید."
          : `جمع طلب شما از بدهکاران ${fmt(dc.totalDebit)} و جمع بدهی شما به بستانکاران ${fmt(dc.totalCredit)} است.${dc.overdueTotal > 0 ? ` از این مبلغ، ${fmt(dc.overdueTotal)} سررسید گذشته و معوق است.` : " هیچ مطالبه‌ی معوقی ندارید."}`,
      details: [
        { label: "جمع بدهکاران", value: fmt(dc.totalDebit) },
        { label: "جمع بستانکاران", value: fmt(dc.totalCredit) },
        { label: "مانده خالص", value: fmt(dc.totalDebit - dc.totalCredit) },
        { label: "مطالبات معوق", value: fmt(dc.overdueTotal) },
        ...rows,
      ],
    };
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
        reply: `من ${OFFLINE_INTENTS.length} قصد آفلاین را می‌فهمم: ثبت هزینه/درآمد/انتقال، دریافت و پرداخت، چک، و گزارش‌های قطعی (سود، نقد، بدهکاران و بستانکاران، مالیات، ترازنامه، معوق، انبار، اقساط، سود زمین).\nهمچنین هر بخش را کامل توضیح می‌دهم؛ مثلاً بنویسید «بخش چک را کامل توضیح بده» یا از دکمه‌های راهنما در هر صفحه استفاده کنید. هیچ عددی را خودم حساب نمی‌کنم و بدون تأیید شما سندی ثبت نمی‌شود.`,
        details: [
          { label: "تعداد قصد", value: String(OFFLINE_INTENTS.length) },
          { label: "حالت", value: db.settings.assistantMode === "backup" ? "پشتیبان (فقط خواندن)" : "دستیار (پیش‌نویس + تأیید)" },
          { label: "دوره گزارش", value: `${period.label} ${toJalali(new Date()).jy}` },
        ],
      };
  }
}

export const ASSISTANT_INTENT_COUNT = OFFLINE_INTENTS.length;
export const ASSISTANT_SAMPLES = [
  "۴۵۰ هزار تومان گازوئیل خریدم",
  "۸۰ میلیون از شرکت لبنیات دریافت کردم",
  "سود این ماه چقدر است؟",
  "بدهکاران و بستانکاران چه کسانی هستند؟",
  "بخش چک را کامل توضیح بده",
  "صورتحساب شرکت لبنیات دشت",
  "موجودی انبار چقدر است؟",
  "مالیات فروش این ماه چقدر است؟",
];
void contactBalance;
void trialBalance;
void budgetUsage;
