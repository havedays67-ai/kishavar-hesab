/**
 * تولید قطعی دادهٔ آموزشی «سؤال/جواب نشان‌دار» برای کشاورزیار
 * ------------------------------------------------------------
 * هر نمونه: قالب پرسش + قصد + اسلات‌های متنی + جواب نشان‌دار (بدون هیچ مبلغ).
 * هیچ عدد مالی در نمونه‌ها ذخیره نمی‌شود؛ اعداد در نرمال‌ساز ماسک می‌شوند.
 *
 * مقیاس با Seed قطعی تغییر می‌کند: تعداد درخواستی هرچه باشد، خروجی برای
 * همان درخواست تکرارپذیر است (CI می‌تواند diff صفر بگیرد).
 */
import type { NluIntent, NluSlots } from "../../app-v2/src/lib/nlu/rules";
import { CROPS, EXPENSE_CATEGORIES } from "../../app-v2/src/lib/nlu/rules";

export interface LabeledSample {
  q: string;
  intent: NluIntent;
  slots: NluSlots;
  answer: string;
}

export const LABELS: NluIntent[] = [
  "add_expense", "add_income", "sale_crop", "quick_sale", "purchase_input", "harvest_record", "wage_payment",
  "fertilizer_pesticide", "irrigation_log", "cheque_received", "cheque_paid", "loan_installment",
  "inventory_out", "report_receivable", "report_payable", "report_cash", "report_profit",
  "report_cheques", "report_inventory", "legal_cheque", "legal_signature", "legal_contract",
  "contract_help", "app_help", "math_query", "trade_help", "weather", "greeting", "thanks",
];

const PARTIES = ["مهدی", "حسین", "رضا", "اکبر", "سیلو گندم", "تعاونی روستا", "کشاورز همسایه", "خریدار جو", "کارخانه قند", "آقای محمدی", "شرکت دانه طلایی"];
const UNITS = ["کیلوگرم", "تن", "هکتار", "کیسه", "سبد", "خروار", "کارتن", "نفرروز", "مترمربع"];
const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const PREFIXES = ["", "امروز ", "دیروز ", "برای زمین شمالی ", "برای زمین جنوبی ", "با اجازه شما ", "تو مزرعه ", "برای کشت امسال ", "جناب ", "بابا "];
const SUFFIXES = ["", " ثبت کن", " یادت باشه", " لطفا", " برای حساب مزرعه", " نقدی بود", " با فاکتور", " برای فصل جاری", " از حساب بانکی", " توی دفتر بنویس"];

/** تغییرهای محاوره‌ای/غلط‌املایی: عربی‌زدایی برعکس، حذف فاصله، غلط تایپی */
export function mutate(text: string, roll: number): string {
  let out = text;
  if (roll % 5 === 0) out = out.replace(/ی/g, "ي").replace(/ک/g, "ك");
  else if (roll % 5 === 1) out = out.replace(/می /g, "مي ").replace(/‌/g, "");
  else if (roll % 5 === 2) out = out.replace(/ان /g, "ن ");
  else if (roll % 5 === 3) out = out.replace(/ه /g, "ه  ");
  else out = out.replace(/آ/g, "ا");
  return out;
}

export function mulberry(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(random: () => number, values: T[]): T => values[Math.floor(random() * values.length)];

interface Template {
  intent: NluIntent;
  texts: string[];
  slots: (random: () => number) => NluSlots;
  answer: (slots: NluSlots) => string;
}

function slotText(slots: NluSlots): string {
  const parts: string[] = [];
  if (slots.crop) parts.push(`محصول ${slots.crop}`);
  if (slots.category) parts.push(`دستهٔ ${slots.category}`);
  if (slots.unit) parts.push(`واحد ${slots.unit}`);
  if (slots.docType) parts.push(`سند ${slots.docType}`);
  return parts.join(" · ");
}

const TEMPLATES: Template[] = [
  {
    intent: "add_expense",
    texts: [
      "هزینهٔ {cat} برای {crop} پرداخت شد", "{cat} خریدم برای {crop} و پولشو نقد دادم",
      "خرج {cat} زمین {crop} را دادم", "برای {crop} {cat} گرفتم و فاکتور هم گرفتم",
      "پول {cat} را واریز کردم", "کرایه حمل {crop} را دادم",
    ],
    slots: (r) => ({ category: pick(r, EXPENSE_CATEGORIES).label, crop: pick(r, CROPS) }),
    answer: (s) => `هزینه ثبت شد؛ ${slotText(s)}. مبلغ نهایی و اثر آن روی بهای تمام‌شده را موتور قطعی حساب می‌کند.`,
  },
  {
    intent: "add_income",
    texts: [
      "درآمد {crop} به دستم رسید", "پول {crop} به حسابم واریز شد", "از {party} پول گرفتم بابت {crop}",
      "پول اجاره تراکتور که دادم بهم برگشت", "مبلغی از فروش {crop} واریز شد",
    ],
    slots: (r) => ({ crop: pick(r, CROPS) }),
    answer: (s) => `درآمد ثبت شد؛ ${slotText(s)}. جمع درآمد از دفتر واقعی محاسبه می‌شود، نه از حافظهٔ فهم.`,
  },
  {
    intent: "sale_crop",
    texts: [
      "بار {crop} را به {party} فروختم {unit}", "{crop} را کیلویی به {party} فروختم",
      "قرارداد فروش {crop} با {party} بستم", "محصول {crop} تحویل سیلو شد",
    ],
    slots: (r) => ({ crop: pick(r, CROPS), unit: pick(r, UNITS), role: "seller" }),
    answer: (s) => `فروش آمادهٔ ثبت است؛ ${slotText(s)}. افت رطوبت، افت مفید/غیرمفید و مانده تسویه محاسبه می‌شود.`,
  },
  {
    intent: "quick_sale",
    texts: [
      "تخم آفتابگردان {qty} {unit} را کیلویی به شرکت فروختم", "فروش سادهٔ {crop} {qty} {unit} کیلویی {price}",
      "{qty} {unit} {crop} به شرکت {party} فروختم", "قیمت {qty} {unit} {crop} را حساب کن کیلویی {price}",
      "فروش سریع {crop} مقدار {qty} {unit}", "{crop} {qty} {unit} دست شرکت رفت کیلویی {price}",
    ],
    slots: (r) => ({ crop: pick(r, CROPS), unit: pick(r, ["تن", "کیلوگرم"]) }),
    answer: () => "در «فروش ساده» مقدار (کیلو یا تن) و قیمت هر کیلو را بدهید؛ مبلغ نهایی و مبلغ به حروف هر دو واحد نمایش داده می‌شود.",
  },
  {
    intent: "purchase_input",
    texts: [
      "کیسه بذر {crop} خریدم", "نهاده {cat} تهیه کردم برای {crop}", "خرید کود و سم برای کشت {crop} انجام شد",
      "{cat} برای {crop} خریدم با فاکتور",
    ],
    slots: (r) => ({ category: pick(r, EXPENSE_CATEGORIES).label, crop: pick(r, CROPS) }),
    answer: (s) => `خرید نهاده ثبت شد؛ ${slotText(s)}. موجودی انبار و بهای تمام‌شده به‌روز می‌شود.`,
  },
  {
    intent: "harvest_record",
    texts: ["برداشت {crop} انجام شد {unit}", "{crop} را درو کردم و همه به انبار رفت", "چیدن {crop} تمام شد", "کمباین برداشت {crop} را زد"],
    slots: (r) => ({ crop: pick(r, CROPS), unit: pick(r, UNITS) }),
    answer: (s) => `برداشت ثبت شد؛ ${slotText(s)}. هزینهٔ هر کیلو با عملکرد همین برداشت حساب می‌شود.`,
  },
  {
    intent: "wage_payment",
    texts: ["دستمزد {party} را دادم", "مزد کارگرهای {party} پرداخت شد", "تسویهٔ کارگر {party} انجام شد", "حقوق کارگر را نقداً دادم"],
    slots: () => ({ category: "کارگر", role: "worker" }),
    answer: () => "دستمزد ثبت شد در دستهٔ کارگر. نفر-روز و ماندهٔ کارگر از دفتر محاسبه می‌شود.",
  },
  {
    intent: "fertilizer_pesticide",
    texts: ["کود {cat} به {crop} دادم", "سمپاشی {crop} انجام شد", "قارچ‌کش برای {crop} زدم", "اوره به مزرعهٔ {crop} داده شد"],
    slots: (r) => ({ category: pick(r, ["کود", "سم"]), crop: pick(r, CROPS) }),
    answer: (s) => `عملیات نهاده ثبت شد؛ ${slotText(s)}. مقدار و اثر هزینه در گزارش کشت می‌آید.`,
  },
  {
    intent: "irrigation_log",
    texts: ["آبیاری {crop} انجام شد", "برای {crop} دور آب زدم", "نوبت آب مزرعهٔ {crop} تمام شد", "چاه را برای {crop} روشن کردم"],
    slots: (r) => ({ crop: pick(r, CROPS) }),
    answer: (s) => `آبیاری ثبت شد؛ ${slotText(s)}. نوبت بعدی و هزینهٔ آب در گزارش زمین دیده می‌شود.`,
  },
  {
    intent: "cheque_received",
    texts: ["چک از {party} گرفتم سررسید {month}", "چک {party} به دستم رسید", "چک دریافتی از {party} ثبت کن", "برگهٔ چک {party} را وصول کردم"],
    slots: () => ({ docType: "cheque", direction: "in" }),
    answer: (s) => `چک دریافتی ثبت شد؛ ${slotText(s)}. یادآوری: چک قانونی باید در سامانهٔ صیاد ثبت شده باشد.`,
  },
  {
    intent: "cheque_paid",
    texts: ["چک به {party} دادم", "برای {party} چک کشیدم", "چک پرداختی {party} ثبت شد", "چک {party} را پرداخت کردم"],
    slots: () => ({ docType: "cheque", direction: "out" }),
    answer: () => "چک پرداختی ثبت شد. سررسید و موجودی نقد را در گزارش چک‌ها ببینید.",
  },
  {
    intent: "loan_installment",
    texts: ["قسط وام را دادم", "قسط {month} پرداخت شد", "اقساط تسهیلات بانکی پرداخت شد", "وام گرفتم و قسط اول را دادم"],
    slots: () => ({ topic: "وام" }),
    answer: () => "قسط ثبت شد. جدول بازپرداخت و ماندهٔ وام به‌روز می‌شود.",
  },
  {
    intent: "inventory_out",
    texts: ["از انبار {cat} برای {crop} کم کن", "خروج {cat} از انبار ثبت شد", "کیسهٔ {cat} را از انبار ببر", "{cat} از انبار مصرف شد"],
    slots: (r) => ({ category: pick(r, EXPENSE_CATEGORIES).label, crop: pick(r, CROPS) }),
    answer: (s) => `خروج انبار ثبت شد؛ ${slotText(s)}. موجودی و حد سفارش دوباره بررسی می‌شود.`,
  },
  {
    intent: "report_receivable",
    texts: ["چقدر طلب دارم", "مطالبات من چقدره", "چه کسانی به من بدهکارند", "جمع طلب‌ها را بگو"],
    slots: () => ({}),
    answer: () => "مطالبات فقط از دفتر واقعی شما محاسبه و نمایش داده می‌شود.",
  },
  {
    intent: "report_payable",
    texts: ["چقدر بدهی دارم", "جمع بدهی‌ها را بگو", "به کی بدهکارم", "مانده بدهی چقدر است"],
    slots: () => ({}),
    answer: () => "بدهی‌ها از دفتر طرف‌حساب‌ها محاسبه می‌شود، نه از حافظهٔ فهم.",
  },
  {
    intent: "report_cash",
    texts: ["نقدینگی من چقدره", "چقدر پول نقد دارم", "مانده صندوق را بگو", "موجودی نقد چقدر است"],
    slots: () => ({}),
    answer: () => "ماندهٔ نقد از مجموع دریافتی‌ها منهای پرداختی‌ها محاسبه می‌شود.",
  },
  {
    intent: "report_profit",
    texts: ["سود {crop} چقدر شد", "بهای تمام‌شدهٔ هر کیلوی {crop} چقدره", "زیان این فصل چقدره", "حاشیهٔ سود {crop} را بگو"],
    slots: (r) => ({ crop: pick(r, CROPS) }),
    answer: (s) => `گزارش سود و بهای تمام‌شده از موتور قطعی ساخته می‌شود؛ ${slotText(s)}.`,
  },
  {
    intent: "report_cheques",
    texts: ["چک‌های نزدیک سررسید کدام‌اند", "وضعیت چک‌ها را بگو", "چند چک در جریان دارم", "چک‌هایی که نزدیک سررسیدن کدوما هستن"],
    slots: () => ({ docType: "cheque" }),
    answer: () => "فهرست چک‌ها با سررسید و وضعیت از دفتر چک ساخته می‌شود.",
  },
  {
    intent: "report_inventory",
    texts: ["موجودی انبار چقدره", "انبار چه کمبودی دارد", "مانده {cat} در انبار", "چه اقلامی به حد سفارش رسیده"],
    slots: (r) => ({ category: pick(r, EXPENSE_CATEGORIES).label }),
    answer: (s) => `گزارش انبار فقط از موجودی واقعی ساخته می‌شود؛ ${slotText(s)}.`,
  },
  {
    intent: "legal_cheque",
    texts: ["چک چاپی معتبر است", "آیا چک با امضا در برنامه قانونی است", "چک بدون صیاد اعتبار دارد", "چک برگشتی چه حکمی دارد"],
    slots: () => ({ docType: "cheque" }),
    answer: () => "چک قانونی باید روی برگهٔ رسمی بانک با شناسهٔ صیاد و ثبت در سامانهٔ صیاد باشد؛ فرم برنامه سند عادی است.",
  },
  {
    intent: "legal_signature",
    texts: ["امضای الکترونیکی معتبر است", "امضای دستی روی سند قانونی است", "امضای انگشتی برای قرارداد کافی است", "امضای دیجیتال اعتبار دارد"],
    slots: () => ({ docType: "signature" }),
    answer: () => "امضای دستی طرفین سند عادی معتبر می‌سازد؛ برای اموال غیرمنقول ثبت رسمی لازم است.",
  },
  {
    intent: "legal_contract",
    texts: ["قرارداد اجارهٔ زمین چاپی معتبر است", "سند عادی برای مزارعه کافی است", "قرارداد دستی باید ثبت رسمی شود", "اجاره‌نامهٔ عادی اعتبار دارد"],
    slots: () => ({ docType: "contract" }),
    answer: () => "قرارداد عادی بین طرفین معتبر است (مواد ۱۰ و ۲۱۹ قانون مدنی)؛ ثبت رسمی برای اسناد غیرمنقول توصیه می‌شود.",
  },
  {
    intent: "contract_help",
    texts: ["چطور قرارداد اجاره ثبت کنم", "قرارداد مزارعه چه بندهایی دارد", "راهنمای قرارداد زمین", "قرارداد جدید را از کجا بسازم"],
    slots: () => ({ docType: "contract" }),
    answer: () => "از بخش «قرارداد زمین» طرفین، تاریخ شمسی و تعهدات را وارد کنید؛ پیش‌نمایش A4 با QR و جای امضا ساخته می‌شود.",
  },
  {
    intent: "app_help",
    texts: ["چطور از برنامه پشتیبان بگیرم", "راهنمای برنامه", "کشاورزیار چطور کار می‌کند", "چاپ سند کار نمی‌کند", "برنامه بدون اینترنت کار می‌کند"],
    slots: () => ({}),
    answer: () => "راهنمای کامل در تب «راهنمای کامل» با گام‌های عملی و پرسش/پاسخ باز می‌شود؛ همه‌چیز آفلاین است.",
  },
  {
    intent: "app_help",
    texts: [
      "نقش من در برنامه چیست", "چطور نقش خودم را بنویسم", "گزینهٔ سایر برای نقش کجاست",
      "نقش دلخواه ثبت کنم", "پروفایل من را چطور کامل کنم", "در اولین ورود چه چیزی پر کنم",
      "راهنمای فروش ساده", "تفاوت فروش ساده و معامله محصول",
    ],
    slots: () => ({}),
    answer: () => "در «پروفایل» یا اولین ورود نقش را انتخاب کنید؛ گزینهٔ «سایر» کادر نوشتن آزاد باز می‌کند. راهنمای هر بخش در تب «راهنمای کامل» است.",
  },
  {
    intent: "math_query",
    texts: [
      "محاسبه کن {p} درصد از {amount} تومان", "حساب کن {amount} تومان با {p} درصد تخفیف",
      "چند می‌شود {p} درصد مالیات روی {amount}", "سهم هر نفر را حساب کن {amount} بین {people} نفر",
      "تقسیم بر کن {amount} تقسیم بر {people}", "میانگین را حساب کن {amount} و {p}",
      "ضربدر کن {amount} ضربدر {people}", "جمع کن {amount} به‌علاوه {p}",
      "تبدیل کن {amount} تن به کیلوگرم", "مساحت را حساب کن {amount} در {p} متر",
      "محاسبه افت رطوبت {amount} کیلو رطوبت {p} پایه ۱۴", "نتیجهٔ این محاسبه چند می‌شود {amount} منهای {p}",
    ],
    slots: () => ({}),
    answer: () => "با موتور ریاضی قطعی (اعداد گویا و BigInt) محاسبه می‌شود.",
  },
  {
    intent: "trade_help",
    texts: [
      "افت رطوبت چطور حساب می‌شود", "افت مفید و غیرمفید چند درصد است", "درجهٔ گندم با هکتولیتر چطور تعیین می‌شود",
      "ناخالصی مازاد چطور کسر می‌شود", "فرمول افت رطوبت چیست", "باسکول چطور وزن خالص را می‌دهد",
    ],
    slots: () => ({}),
    answer: () => "فرمول افت رطوبت وزنی است: (رطوبت اندازه‌گیری‌شده − پایه) ÷ (۱۰۰ − پایه) × ۱۰۰؛ بقیهٔ افت‌ها در ماشین‌حساب معامله قابل تنظیم‌اند.",
  },
  {
    intent: "weather",
    texts: ["هوا فردا چطوره", "باران می‌آید", "پیش‌بینی هوا برای سمپاشی", "سرما می‌رسد"],
    slots: () => ({}),
    answer: () => "این نسخه آفلاین است و پیش‌بینی هوا ندارد؛ برای سمپاشی از هواشناسی محلی و سرعت باد استفاده کنید.",
  },
  {
    intent: "greeting",
    texts: ["سلام", "درود", "وقت بخیر", "صبح بخیر", "سلام علیکم"],
    slots: () => ({}),
    answer: () => "سلام! سؤالتان را بنویسید: ثبت هزینه، فروش، گزارش مانده یا راهنمای سند.",
  },
  {
    intent: "thanks",
    texts: ["مممنون", "مرسی", "دستت درد نکنه", "متشکرم", "عالی بود"],
    slots: () => ({}),
    answer: () => "خواهش می‌کنم؛ هر وقت خواستید دوباره بپرسید.",
  },
];

/** تعداد کاندید برای هر قصد (بدون شمارش مالی) — ظرفیت تا ۲ میلیون نمونه */
export function generateLabeled(count: number, seed = 20261116): LabeledSample[] {
  const random = mulberry(seed);
  const out: LabeledSample[] = [];
  let guard = 0;
  const maxGuard = count * 4 + 1000;
  while (out.length < count && guard < maxGuard) {
    guard += 1;
    const template = TEMPLATES[guard % TEMPLATES.length];
    const slots = template.slots(random);
    // اعداد نمونه: سه شکل رایج (رقم خام، جداکنندهٔ هزارگان، مقیاس واژه‌ای)
    const amountValue = [12, 25, 18, 40, 90, 120, 250][Math.floor(random() * 7)] * 1_000_000;
    const amount = [
      String(amountValue),
      amountValue.toLocaleString("en-US"),
      `${amountValue / 1_000_000} میلیون`,
    ][Math.floor(random() * 3)];
    const percent = String(5 + Math.floor(random() * 25));
    const people = String(2 + Math.floor(random() * 10));
    // قیمت با شکل‌های مختلف: خام و جداکننده‌دار (100,000,000)
    const rawRate = [35000, 45000, 60000, 85000, 120000][Math.floor(random() * 5)];
    const priceGrouped = rawRate.toLocaleString("en-US");
    const base = pick(random, template.texts)
      .replace("{cat}", slots.category ?? pick(random, EXPENSE_CATEGORIES).label)
      .replace("{crop}", slots.crop ?? pick(random, CROPS))
      .replace("{party}", pick(random, PARTIES))
      .replace("{unit}", slots.unit ?? pick(random, UNITS))
      .replace("{month}", pick(random, MONTHS))
      .replace(/{qty}/g, [1, 2.5, 5, 12, 100, 1500][Math.floor(random() * 6)] + "")
      .replace(/{price}/g, (20000 + Math.floor(random() * 80) * 1000).toLocaleString("en-US"))
      .replace(/{amount}/g, amount)
      .replace(/{p}/g, percent)
      .replace(/{people}/g, people)
      .replace(/{qty}/g, String([1, 2, 5, 10, 20, 50][Math.floor(random() * 6)]))
      .replace(/{rate}/g, String(rawRate))
      .replace(/{rateGrouped}/g, priceGrouped)
      .replace(/{qty}/g, String([1, 1.5, 2, 2.5, 5, 10, 250, 500][Math.floor(random() * 8)]))
      .replace(/{rate2}/g, String([18000, 25000, 32000, 45000, 68000][Math.floor(random() * 5)]))
      .replace(/{weightUnit}/g, ["تن", "کیلوگرم", "کیلو", "خروار"][Math.floor(random() * 4)]);
    const withAmount = `${Math.floor(random() * 90 + 1)} میلیون تومان ${base}`;
    const text = mutate(`${pick(random, PREFIXES)}${random() % 2 === 0 ? withAmount : base}${pick(random, SUFFIXES)}`, guard + 3);
    const q = text.replace(/\s+/g, " ").trim();
    if (q.length < 3) continue;
    out.push({ q, intent: template.intent, slots, answer: template.answer(slots) });
  }
  return out;
}

/* ------------------------- پیکرهٔ زبان فارسی ------------------------- */

const FA_WORDS = [
  "امروز", "دیروز", "فردا", "صبح", "شب", "مزرعه", "زمین", "کشت", "کشاورز", "باغ", "باغدار", "محصول", "برداشت", "بذر", "کود", "سم", "آبیاری", "چاه", "آب", "خاک",
  "تراکتور", "کمباین", "ماشین", "کارگر", "دستمزد", "هزینه", "درآمد", "فروش", "خرید", "قرارداد", "اجاره", "مالک", "مستاجر", "سند", "امضا", "چک", "سررسید", "بانک",
  "اعتبار", "قانون", "دفتر", "حساب", "مانده", "طلب", "بدهی", "انبار", "موجودی", "کیسه", "تن", "کیلوگرم", "هکتار", "هزینه‌ها", "گزارش", "سود", "زیان", "بهای", "تمام‌شده",
  "گندم", "جو", "برنج", "ذرت", "کلزا", "پنبه", "چغندرقند", "سیب‌زمینی", "پیاز", "گوجه", "خیار", "زعفران", "پسته", "گردو", "انار", "انگور", "سیب", "زیتون", "خرما", "لیمو",
  "پشتیبان", "بازیابی", "داده", "برنامه", "تلفن", "گوشی", "راهنما", "سؤال", "پاسخ", "دستیار", "هوشمند", "آفلاین", "اینترنت", "امن", "سریع", "سبک", "دقیق", "پردازنده",
  "مالیات", "عوارض", "بیمه", "تسهیلات", "قسط", "وام", "ضمانت", "وصول", "برگشت", "چک‌ها", "صیاد", "شناسه", "شبا", "حساب", "شعبه",
  "کرایه", "حمل", "باسکول", "رطوبت", "افت", "کیفیت", "هکتولیتر", "پروتئین", "ناخالصی", "درجه", "قیمت", "نرخ", "مانده", "تسویه", "بیعانه",
  "قرارداد", "مزارعه", "مضاربه", "موجر", "مستاجر", "شاهد", "بند", "تعهد", "مدت", "سهم", "فسخ", "تمدید", "امضای", "دستی", "الکترونیکی",
  "زمین", "قطعه", "مساحت", "مرز", "چاه", "آبیاری", "قطره‌ای", "بارانی", "نوبت", "دور", "ساعت", "روز", "هفته", "ماه", "سال", "فصل",
  "بذر", "نشا", "کاشت", "داشت", "برداشت", "درو", "خرمن", "کیسه", "سبد", "کارتن", "خروار", "تن", "کیلو", "گرم", "لیتر", "بشکه",
  "کود", "اوره", "فسفات", "پتاس", "نیترات", "سولفات", "سم", "قارچ‌کش", "علف‌کش", "حشره‌کش", "سمپاشی", "محلول", "دز", "مصرف",
  "کارگر", "نفرروز", "دستمزد", "مزد", "حقوق", "بیمه", "قرارداد", "تسویه", "مانده", "پرداخت", "دریافت", "نقد", "بانک", "کارت", "فیش",
  "گزارش", "سود", "زیان", "سربه‌سر", "حاشیه", "عملکرد", "بهای", "تمام‌شده", "هزینه", "درآمد", "دفتر", "معین", "تراز", "جمع", "میانگین",
  "انبار", "ورود", "خروج", "موجودی", "حد", "سفارش", "کمبود", "دارایی", "استهلاک", "عمر", "مفید", "ارزش", "دفتری", "بودجه", "کنترل",
];

export function generatePersian(count: number, seed = 777001): string[] {
  const random = mulberry(seed);
  const out: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const words = 5 + Math.floor(random() * 9);
    const parts: string[] = [];
    for (let word = 0; word < words; word += 1) parts.push(pick(random, FA_WORDS));
    let sentence = `${parts.join(" ")}.`;
    if (index % 7 === 0) sentence = `«${sentence}»`;
    if (index % 11 === 0) sentence = sentence.replace(/ی/g, "ي");
    out.push(sentence);
  }
  return out;
}

export function wordFrequencies(lines: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    for (const raw of line.split(/[^\u0600-\u06FF‌]+/)) {
      const word = raw.replace(/‌/g, "").trim();
      if (word.length < 2) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return counts;
}


/** هر جای‌نگهدار خام در نمونه یعنی دادهٔ آموزشی خراب؛ برای گیت کیفیت. */
export function hasRawPlaceholder(text: string): boolean {
  return /\{[a-zA-Z0-9]+\}/.test(text);
}
