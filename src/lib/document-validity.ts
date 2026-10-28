/**
 * اعتبار حقوقی اسناد کشاورزحساب — ماژول مشترک وب و اپ اندروید (بدون وابستگی)
 * مرجع: قانون مدنی (۱۲۸۴، ۱۲۸۷، ۱۲۸۹، ۱۲۹۰، ۱۲۹۱، ۱۲۹۲، ۲۱۶ آ.د.م، ۲۱۹،
 * ۲۲۰، ۳۳۸، ۳۴۸، ۳۶۷، ۴۶۶، ۴۹۰)، قانون صدور چک ۱۳۹۷ و صیاد، قانون
 * پایانه‌های فروشگاهی و مؤدیان، ماده ۱۶۹ ق.م.م، قانون تجارت الکترونیک،
 * قانون الزام به ثبت رسمی معاملات اموال غیرمنقول ۱۴۰۳ و استاندارد ملی ۱۰۴۳.
 */

export type AuthorityLevel = 1 | 2 | 3 | 4;
export type AuthorityStatus = "party-evidence" | "supporting" | "internal-note" | "no-legal-value";

export interface AuthorityEntry {
  kind: string;
  title: string;
  level: AuthorityLevel;
  levelLabel: string;
  status: AuthorityStatus;
  short: string;
  betweenParties: string;
  againstThird: string;
  proves: string[];
  doesNotProve: string[];
  needsToBeStronger: string[];
  requirements: { label: string; importance: "الزامی" | "توصیه‌شده"; note: string }[];
  legalBasis: string;
  references: { label: string; url?: string }[];
}

export const AUTHORITY_LEVELS: Record<
  AuthorityLevel,
  { label: string; tone: "green" | "amber" | "slate" | "red"; description: string }
> = {
  1: {
    label: "سند عادی قابل استناد بین طرفین",
    tone: "green",
    description:
      "مدرک مکتوب امضاشده که در اختلاف بین امضاکنندگان (و ورثه و قائم‌مقام) دلیل است؛ به‌تنهایی به اشخاص ثالث تحمیل نمی‌شود.",
  },
  2: {
    label: "مدرک حمایتی / قرینه",
    tone: "amber",
    description:
      "در کنار سند اصلی کمک‌کننده است و تنهایی برای اثبات همهٔ موضوع کافی نیست؛ ارزش آن به امضا، مهر، شمارهٔ رسمی و منبع صدور بستگی دارد.",
  },
  3: {
    label: "یادداشت داخلی",
    tone: "slate",
    description:
      "برای مدیریت، بایگانی و پیگیری خودِ کسب‌وکار است و در دادگاه یا برابر مراجع، سند اثبات حق نیست.",
  },
  4: {
    label: "بدون اعتبار حقوقی به‌عنوان سند",
    tone: "red",
    description:
      "صرفاً فرم یادداشت است؛ برای اثر حقوقی باید در سامانه یا دفتر رسمی مربوط ثبت و شکل قانونی بگیرد.",
  },
};

const CIVIL_CODE = {
  label: "متن قانون مدنی — مواد ۱۲۸۴ تا ۱۲۹۲ (اسناد)",
  url: "https://www.mizanonline.ir/fa/news/4738210/",
};
const HEYVALAW = {
  label: "اعتبار اسناد در برابر اشخاص ثالث — ماده ۱۲۹۰ قانون مدنی",
  url: "https://www.heyvalaw.com/web/articles/view/1456/",
};
const VANDALAW = {
  label: "تفاوت اعتبار سند رسمی و عادی (مواد ۱۲۹۰ و ۱۲۹۱)",
  url: "https://vandalawfirm.com/comparison-of-official-and-ordinary-document-validity/",
};
const CHEQUE_LAW = {
  label: "قانون صدور چک (اصلاحی ۱۳۹۷) و سامانهٔ صیاد",
  url: "https://www.cbi.ir",
};
const TAX_LAW = {
  label: "قانون پایانه‌های فروشگاهی و سامانهٔ مؤدیان (۱۳۹۸) و ماده ۱۶۹ ق.م.م",
  url: "https://tax.gov.ir",
};
const WHEAT_STANDARD = {
  label: "استاندارد ملی ایران ۱۰۴۳ (گندم) و دستورالعمل کیفیت مراکز خرید",
  url: "https://www.isiri.gov.ir",
};
const REGISTRATION_LAW = {
  label: "قانون الزام به ثبت رسمی معاملات اموال غیرمنقول (۱۴۰۳) — اجارهٔ بیش از دو سال",
  url: "https://www.mizanonline.ir/fa/news/4863219/",
};
const CONTRACT_LIT = { label: "ماده ۲۱۶ قانون آیین دادرسی مدنی — اعتبار سند علیه امضاکنندگان" };

const signatureReq = (role: string): { label: string; importance: "الزامی"; note: string } => ({
  label: `امضای ${role}`,
  importance: "الزامی",
  note: "بدون امضا یا مهر صاحب سند، در برابر او قابل استناد نیست.",
});
const idReq: { label: string; importance: "الزامی"; note: string } = {
  label: "نام و کد ملی / شناسهٔ ملی طرفین",
  importance: "الزامی",
  note: "بدون هویت قابل احراز، طرف مقابل می‌تواند انتساب سند را انکار کند.",
};
const dateReq: { label: string; importance: "توصیه‌شده"; note: string } = {
  label: "درج تاریخ شمسی روز تنظیم",
  importance: "توصیه‌شده",
  note: "تاریخ سند عادی فقط برای امضاکنندگان معتبر است؛ تاریخ قطعی نیاز به ثبت رسمی دارد.",
};

export const AUTHORITY: Record<string, AuthorityEntry> = {
  "sale-contract": {
    kind: "sale-contract",
    title: "قرارداد فروش محصول کشاورزی",
    level: 1,
    levelLabel: AUTHORITY_LEVELS[1].label,
    status: "party-evidence",
    short: "بین فروشنده و خریدار دلیل مکتوب است (سند عادی).",
    betweenParties:
      "اگر همهٔ طرفین آن را امضا کرده باشند، مندرجاتش علیه امضاکنندگان معتبر است و تعهد فروش، تحویل و پرداخت را نشان می‌دهد.",
    againstThird:
      "برای کسی که امضا نکرده و برابر سند رسمی/اداره، به‌تنهایی قوی نیست؛ برای اجرای مستقیم، سند رسمی یا رأی دادگاه لازم است.",
    proves: ["وجود توافق فروش", "مقدار، نرخ و شرایط پرداخت", "تعهدات طرفین"],
    doesNotProve: ["مالکیت زمین", "انتقال رسمی مالکیت در برابر ثالث", "اعتبار چک"],
    needsToBeStronger: [
      "ثبت در دفتر اسناد رسمی یا سامانهٔ ثبت قرارداد",
      "ضمیمهٔ قبض باسکول و رسید واریز یا چک صیادی",
      "درج محل تحویل، مهلت و شرط جریمهٔ تأخیر",
    ],
    requirements: [
      idReq,
      signatureReq("فروشنده و خریدار"),
      signatureReq("شاهد (اختیاری، مؤثر در اثبات)"),
      dateReq,
      {
        label: "تعیین مقدار، واحد و نرخ",
        importance: "الزامی",
        note: "مبلغ باید بدون ابهام و قابل محاسبه باشد.",
      },
    ],
    legalBasis: "مواد ۱۰، ۲۱۹، ۲۲۰، ۳۳۸، ۳۴۸، ۳۶۷ و ۴۲۲ قانون مدنی؛ ماده ۲۱۶ آ.د.م",
    references: [CIVIL_CODE, HEYVALAW, VANDALAW, CONTRACT_LIT],
  },
  settlement: {
    kind: "settlement",
    title: "صورتجلسه تسویه حساب",
    level: 1,
    levelLabel: AUTHORITY_LEVELS[1].label,
    status: "party-evidence",
    short: "اقرار به پرداخت و مانده بین طرفین؛ سند عادی معتبر.",
    betweenParties:
      "با امضای هر دو طرف، اقرار به دریافت/پرداخت مبلغ و مانده است و در اختلاف بین آن‌ها دلیل محسوب می‌شود.",
    againstThird: "برای ثالث قابل تحمیل نیست؛ ولی در کنار رسید بانکی و قرارداد زنجیرهٔ اثبات را کامل می‌کند.",
    proves: ["مبلغ پرداخت‌شده", "ماندهٔ بدهی", "تاریخ تسویه"],
    doesNotProve: ["منشأ بدهی بدون سند اصلی", "واریز واقعی پول بدون رسید بانکی"],
    needsToBeStronger: ["پیوست رسید واریز/فیش POS", "درج شمارهٔ چک و پیگیری صیاد", "امضای دو شاهد"],
    requirements: [idReq, signatureReq("پرداخت‌کننده و دریافت‌کننده"), dateReq],
    legalBasis: "مواد ۲۹۵ و ۳۰۱ قانون مدنی (وفای به عهد) و ماده ۱۹ قانون تجارت",
    references: [CIVIL_CODE, HEYVALAW],
  },
  "party-statement": {
    kind: "party-statement",
    title: "صورتحساب بدهکار / بستانکار",
    level: 1,
    levelLabel: "اقرارنامه/رسید بین طرفین (با امضا)",
    status: "party-evidence",
    short: "با امضای طرف‌حساب اقرار به بدهی است؛ بدون امضا یادداشت داخلی.",
    betweenParties:
      "اگر طرف‌حساب آن را امضا کند، نسبت به اقلام و ماندهٔ ذکرشده اقرار دارد و در مطالبهٔ بدهی کمک بزرگی است.",
    againstThird: "بدون ثبت رسمی یا حکم دادگاه، علیه اشخاص ثالث اثر ندارد.",
    proves: ["اقلام بدهی/طلب", "تاریخ‌ها", "ماندهٔ مورد توافق (در صورت امضا)"],
    doesNotProve: ["مالکیت اموال", "بدهی اقلام امضانشده"],
    needsToBeStronger: ["امضا یا انگشت‌زنی طرف‌حساب", "پیوست رسید و چک", "تأیید در پیام‌رسان قابل استناد"],
    requirements: [idReq, signatureReq("طرف‌حساب (برای اعتبار اقرار)"), dateReq],
    legalBasis: "مواد ۲۹۵، ۳۰۱ و ۳۰۴ قانون مدنی و ماده ۱۶۹ ق.م.م",
    references: [CIVIL_CODE, HEYVALAW],
  },
  "lease-contract": {
    kind: "lease-contract",
    title: "قرارداد زمین کشاورزی (اجاره)",
    level: 2,
    levelLabel: "عادی معتبر بین طرفین؛ بیش از ۲ سال نیازمند ثبت رسمی",
    status: "supporting",
    short: "بین طرفین معتبر؛ اجارهٔ بلندمدت باید در دفتر رسمی/سامانه ثبت شود.",
    betweenParties:
      "برای مدت کوتاه، امضای طرفین آن را معتبر می‌کند؛ مدت، مال‌الاجاره، حقابه و تحویل باید روشن باشد.",
    againstThird:
      "بر پایهٔ قانون الزام به ثبت رسمی معاملات اموال غیرمنقول، اجارهٔ بیش از دو سال باید رسمی ثبت شود؛ در غیر این صورت در برابر ثالث و مراجع مشکل‌ساز است.",
    proves: ["توافق اجاره و مدت", "مبلغ مال‌الاجاره بین طرفین", "تعهدات بهره‌بردار"],
    doesNotProve: ["مالکیت موجر", "حق انتفاع قابل انتقال بدون ثبت", "حقابهٔ رسمی"],
    needsToBeStronger: [
      "ثبت در دفتر اسناد رسمی یا سامانهٔ ثبت معاملات املاک",
      "پیوست سند مالکیت/نسق زراعی و استعلام ثبتی",
      "درج دقیق مدت، حقابه، تعمیرات و شرط تخلیه",
    ],
    requirements: [
      idReq,
      signatureReq("موجر و مستاجر"),
      {
        label: "مشخصات زمین (پلاک/آبادی/مساحت)",
        importance: "الزامی",
        note: "بدون شناسهٔ زمین، اجرای قرارداد و اثبات تصرف دشوار است.",
      },
      { label: "مدت و شروع اجاره", importance: "الزامی", note: "مدت بیش از دو سال نیازمند ثبت رسمی است." },
      dateReq,
    ],
    legalBasis: "مواد ۴۶۶، ۴۶۸، ۴۹۰، ۴۹۳، ۴۹۴، ۵۰۲ و ۵۰۳ قانون مدنی و قانون ثبت رسمی معاملات ۱۴۰۳",
    references: [CIVIL_CODE, REGISTRATION_LAW, VANDALAW],
  },
  "lease-receipt": {
    kind: "lease-receipt",
    title: "رسید پرداخت مال‌الاجاره",
    level: 1,
    levelLabel: "رسید پرداخت بین موجر و مستاجر",
    status: "party-evidence",
    short: "اقرار موجر به دریافت مبلغ؛ در حد همان پرداخت معتبر.",
    betweenParties: "امضای دریافت‌کننده دلیل بر دریافت آن مبلغ در آن تاریخ است.",
    againstThird: "فقط پرداخت را نشان می‌دهد؛ قرارداد اجاره یا مالکیت را اثبات نمی‌کند.",
    proves: ["پرداخت مبلغ اجاره", "تاریخ پرداخت"],
    doesNotProve: ["کل تعهدات اجاره", "مالکیت زمین"],
    needsToBeStronger: ["پیوست فیش واریز بانکی", "درج شمارهٔ قرارداد و دوره"],
    requirements: [
      signatureReq("موجر/دریافت‌کننده"),
      { label: "مبلغ و تاریخ", importance: "الزامی", note: "مبلغ و تاریخ باید با فیش بانکی هم‌خوان باشد." },
    ],
    legalBasis: "مواد ۲۹۵ و ۴۹۰ قانون مدنی",
    references: [CIVIL_CODE],
  },
  "lease-handover": {
    kind: "lease-handover",
    title: "صورتجلسه تحویل زمین",
    level: 2,
    levelLabel: "مدرک حمایتی وضعیت زمین",
    status: "supporting",
    short: "وضعیت زمین را در تاریخ تحویل نشان می‌دهد؛ با امضا قوی‌تر می‌شود.",
    betweenParties: "با امضای دو طرف، وضعیت تأسیسات و حقابه را در آن تاریخ ثبت می‌کند.",
    againstThird: "برای اثبات وضعیت، کارشناس یا شهادت هم لازم است.",
    proves: ["وضعیت ظاهری زمین در تاریخ تحویل", "تحویل تأسیسات/کلید/آب"],
    doesNotProve: ["کیفیت خاک به‌صورت کارشناسی", "مالکیت"],
    needsToBeStronger: ["عکس و فیلم تاریخ‌دار", "کارشناسی مستقل خاک/آب", "امضای شاهد"],
    requirements: [signatureReq("تحویل‌دهنده و تحویل‌گیرنده"), dateReq],
    legalBasis: "مواد ۴۷۰ و ۴۸۶ تا ۴۹۳ قانون مدنی",
    references: [CIVIL_CODE],
  },
  "weigh-ticket": {
    kind: "weigh-ticket",
    title: "قبض باسکول / رسید تحویل محموله",
    level: 2,
    levelLabel: "قرینهٔ وزن — نه سند قطعی وزن",
    status: "supporting",
    short: "نسخهٔ چاپ‌شده در برنامه قرینه است؛ قبض باسکول مجاز معتبرتر است.",
    betweenParties:
      "قبض باسکول دارای مجوز با شماره و مهر اپراتور در اختلاف وزن کمک‌کننده است؛ برگهٔ چاپ برنامه فقط یادداشت هم‌خوان با آن است.",
    againstThird: "برای مراجع، قبض باسکول رسمی و کارشناسی وزن معتبرتر از چاپ داخلی است.",
    proves: ["وزن اعلامی در آن نوبت", "زمان ورود/خروج خودرو", "تحویل ظاهری محموله"],
    doesNotProve: ["صحت دستگاه باسکول بدون تأییدیهٔ آن", "کیفیت محصول", "مالکیت محموله"],
    needsToBeStronger: [
      "ضمیمه‌کردن اصل/تصویر قبض باسکول مجاز",
      "درج شمارهٔ باسکول، خودرو و راننده",
      "امضای اپراتور باسکول و تحویل‌گیرنده",
    ],
    requirements: [
      signatureReq("مسئول باسکول"),
      signatureReq("تحویل‌گیرنده"),
      {
        label: "شمارهٔ باسکول و تاریخ/ساعت توزین",
        importance: "الزامی",
        note: "بدون شناسهٔ باسکول، انتساب وزن قابل انکار است.",
      },
      { label: "وزن پر، خالی و خالص", importance: "الزامی", note: "محاسبهٔ خالص باید در سند دیده شود." },
    ],
    legalBasis: "ماده ۳۶۷ قانون مدنی (تسلیم) و رویهٔ تشریفات باسکول مراکز خرید",
    references: [CIVIL_CODE, WHEAT_STANDARD],
  },
  "quality-minutes": {
    kind: "quality-minutes",
    title: "صورتجلسه نمونه‌برداری و کیفیت",
    level: 2,
    levelLabel: "مدرک حمایتی فنی",
    status: "supporting",
    short: "بدون آزمایشگاه/نمونه‌بردار مورد قبول، سند قطعی کیفیت نیست.",
    betweenParties: "اگر نمایندهٔ دو طرف یا آزمایشگاه معتمد امضا کند، مبنای خوبی برای افت و کسورات است.",
    againstThird: "برای مراجع، گزارش آزمایشگاه دارای مجوز یا کارشناسی رسمی لازم است.",
    proves: ["نتایج آزمون نمونهٔ همان تاریخ", "مبنای افت رطوبت/ناخالصی بین طرفین"],
    doesNotProve: ["کیفیت کل محموله بدون نمونه‌برداری استاندارد", "سلامت محصول برای مصرف"],
    needsToBeStronger: ["آزمایشگاه معتمد با کد نمونه", "نگهداری نمونهٔ شاهد", "امضای هر دو طرف"],
    requirements: [
      { label: "روش نمونه‌برداری و کد نمونه", importance: "الزامی", note: "بدون روش استاندارد، نتیجه قابل خدشه است." },
      signatureReq("نمونه‌بردار/آزمایشگاه و فروشنده"),
      { label: "درج نتایج عددی (رطوبت، ناخالصی و…)", importance: "الزامی", note: "اعداد باید با آزمایشگاه هم‌خوان باشد." },
    ],
    legalBasis: "استاندارد ملی ایران ۱۰۴۳ و دستورالعمل کنترل کیفیت مراکز خرید",
    references: [WHEAT_STANDARD, CIVIL_CODE],
  },
  "sale-invoice": {
    kind: "sale-invoice",
    title: "صورتحساب فروش محصول",
    level: 2,
    levelLabel: "مدرک قیمت بین طرفین — فاکتور مالیاتی نیست",
    status: "supporting",
    short: "برای مالیات، شناسهٔ یکتای سامانهٔ مؤدیان لازم است.",
    betweenParties: "با امضای خریدار، نشان‌دهندهٔ نرخ و مبلغ مبنای پرداخت است.",
    againstThird:
      "فاکتور معتبر مالیاتی باید از سامانهٔ مؤدیان/پایانهٔ فروشگاهی با شناسهٔ یکتا و امضای الکترونیکی صادر شود؛ چاپ برنامه سند مالیاتی نیست.",
    proves: ["توافق بر نرخ و مبلغ بین طرفین", "جمع کسورات و محاسبات"],
    doesNotProve: ["پرداخت مبلغ", "اعتبار مالیاتی برای خریدار", "وزن تحویلی"],
    needsToBeStronger: ["صدور در سامانهٔ مؤدیان", "پیوست قبض باسکول و رسید پرداخت", "درج شمارهٔ اقتصادی/کد رهگیری"],
    requirements: [
      idReq,
      signatureReq("فروشنده و خریدار"),
      {
        label: "شناسهٔ یکتای مالی/کد رهگیری سامانهٔ مؤدیان",
        importance: "الزامی",
        note: "بدون آن، فاکتور برای مالیات خریدار قابل استناد نیست.",
      },
    ],
    legalBasis: "ماده ۱۶۹ قانون مالیات‌های مستقیم و قانون پایانه‌های فروشگاهی و سامانهٔ مؤدیان",
    references: [TAX_LAW],
  },
  receipt: {
    kind: "receipt",
    title: "رسید پرداخت / فیش واریز / قبض POS",
    level: 2,
    levelLabel: "دلیل بر پرداخت — نه سند منشأ بدهی",
    status: "supporting",
    short: "پرداخت را نشان می‌دهد؛ علت پرداخت را قرارداد/صورتجلسه اثبات می‌کند.",
    betweenParties: "برای دریافت‌کننده پرداخت مبلغ را نشان می‌دهد و در اختلاف حساب به کار می‌آید.",
    againstThird: "فیش بانکی اصل یا گواهی‌شده ارزش بالاتری دارد؛ اسکرین‌شات تنهایی ضعیف است.",
    proves: ["وقوع پرداخت", "مبلغ، تاریخ و شمارهٔ پیگیری"],
    doesNotProve: ["علت پرداخت", "تسویهٔ کامل بدهی", "انصراف از بقیهٔ طلب"],
    needsToBeStronger: [
      "دریافت رسید امضاشدهٔ دریافت‌کننده",
      "ذکر شمارهٔ قرارداد/فاکتور در توضیح واریز",
      "نگهداری گواهی بانک",
      "درج شمارهٔ پیگیری فیش در توضیح رسید",
    ],
    requirements: [
      { label: "شمارهٔ پیگیری/مرجع بانکی", importance: "الزامی", note: "برای صحت‌سنجی فیش لازم است." },
      {
        label: "نام پرداخت‌کننده و دریافت‌کننده",
        importance: "الزامی",
        note: "انتقال به حساب شخص دیگر، انتساب را دشوار می‌کند.",
      },
      {
        label: "اتصال به قرارداد یا فاکتور (شماره/تاریخ)",
        importance: "توصیه‌شده",
        note: "همین اتصال، رسید را از سند مبهم به مدرک حمایتی قوی تبدیل می‌کند.",
      },
    ],
    legalBasis: "مواد ۲۹۵ و ۳۰۱ قانون مدنی؛ ماده ۲۱۶ آ.د.م",
    references: [CIVIL_CODE, HEYVALAW],
  },
  "cheque-sheet": {
    kind: "cheque-sheet",
    title: "فرم اطلاعات چک — چک بانکی نیست",
    level: 4,
    levelLabel: "یادداشت اطلاعات چک؛ فاقد اعتبار چک",
    status: "no-legal-value",
    short: "این برگه چک نیست؛ فقط یادداشت شماره و سررسید است.",
    betweenParties:
      "به‌عنوان یادداشت و اقرار غیرمستقیم ممکن است مفید باشد، ولی چک محسوب نمی‌شود و وصول، ظهرنویسی یا اجرای چک بر آن بار نمی‌شود.",
    againstThird: "برای مراجع اجرایی، چک باید برگهٔ چک بانکی و ثبت‌شده در سامانهٔ صیاد باشد.",
    proves: ["وجود یادداشت اطلاعات چک در پروندهٔ شما"],
    doesNotProve: ["صدور چک", "تعهد بانک به پرداخت", "امکان اجرای قانونی چک"],
    needsToBeStronger: [
      "استفاده از برگهٔ چک بانکی با تمام شرایط قانونی",
      "ثبت و تأیید چک در سامانهٔ صیاد",
      "دریافت رسید/تأیید دریافت‌کننده",
    ],
    requirements: [
      { label: "برگهٔ چک بانکی دارای دسته/سری", importance: "الزامی", note: "فرم داخلی برنامه جای برگهٔ بانکی را نمی‌گیرد." },
      { label: "ثبت در سامانهٔ صیاد و تأیید گیرنده", importance: "الزامی", note: "بدون ثبت صیاد، چک در شبکهٔ بانکی قابل وصول نیست." },
      { label: "مبلغ به عدد و حروف، تاریخ و امضا", importance: "الزامی", note: "نقص در این اقلام موجب بی‌اعتباری چک می‌شود." },
    ],
    legalBasis: "قانون صدور چک (اصلاحی ۱۳۹۷) و دستورالعمل‌های سامانهٔ صیاد",
    references: [CHEQUE_LAW],
  },
  "electronic-signature": {
    kind: "electronic-signature",
    title: "امضای الکترونیکی داخل برنامه (ECDSA)",
    level: 2,
    levelLabel: "اثر انگشت فنی داده — نه امضای الکترونیکی مطمئن",
    status: "supporting",
    short: "اصالت فایل را نشان می‌دهد؛ جای امضای رسمی مطمئن نیست.",
    betweenParties:
      "نشان می‌دهد متن بعد از امضا تغییر نکرده؛ اما هویت امضاکننده فقط تا حدی که کلید روی دستگاه او باشد قابل انتساب است.",
    againstThird:
      "«امضای الکترونیکی مطمئن» شرایط و گواهی مرکز میانی معتبر دارد؛ امضای تولیدشده در برنامه این جایگاه را ندارد.",
    proves: ["عدم تغییر داده پس از امضا (با تأیید همان کلید)", "زمان امضا در دستگاه"],
    doesNotProve: ["احراز هویت رسمی امضاکننده", "مالکیت انحصاری کلید در همهٔ شرایط"],
    needsToBeStronger: ["امضای کاغذی نسخهٔ چاپی", "گواهی امضای الکترونیکی معتبر", "ثبت سند در سامانه/دفتر رسمی"],
    requirements: [
      { label: "کد رهگیری امضا روی نسخهٔ چاپی", importance: "الزامی", note: "بدون آن، ارتباط امضای دیجیتال با کاغذ مشخص نیست." },
      { label: "حفاظت از کلید خصوصی دستگاه", importance: "الزامی", note: "در صورت نفوذ به دستگاه، انتساب امضا تضعیف می‌شود." },
    ],
    legalBasis: "قانون تجارت الکترونیک ۱۳۸۲ (مواد ۷ و ۱۰) و آیین‌نامهٔ امضای الکترونیکی",
    references: [{ label: "قانون تجارت الکترونیک — امضای الکترونیکی مطمئن" }, CIVIL_CODE],
  },
  "trades-report": {
    kind: "trades-report",
    title: "گزارش مدیریتی معاملات",
    level: 3,
    levelLabel: AUTHORITY_LEVELS[3].label,
    status: "internal-note",
    short: "برای مدیریت خودتان؛ در دادگاه سند اثبات حق نیست.",
    betweenParties: "تا وقتی با اسناد پایه (قرارداد/رسید) هم‌راستا نباشد، حرف شماست نه دلیل.",
    againstThird: "برای مراجع، گزارش داخلی به‌تنهایی ارزش اثباتی ندارد.",
    proves: ["تصویر داخلی مدیریت از معاملات"],
    doesNotProve: ["وقوع واقعی معامله", "بدهی طرف مقابل"],
    needsToBeStronger: ["قرارداد و صورتحساب امضاشده", "پیوست قبض باسکول", "تطبیق با گردش حساب بانکی"],
    requirements: [{ label: "تطبیق با اسناد پایه", importance: "توصیه‌شده", note: "هر عدد گزارش باید به سند پایهٔ خودش وصل باشد." }],
    legalBasis: "گزارش داخلی مدیریتی — فاقد اثر اثباتی در دعوی",
    references: [CIVIL_CODE],
  },
  "cost-report": {
    kind: "cost-report",
    title: "گزارش بهای تمام‌شده هر کیلو",
    level: 3,
    levelLabel: AUTHORITY_LEVELS[3].label,
    status: "internal-note",
    short: "تحلیل مدیریتی هزینه؛ سند مالیاتی یا حقوقی نیست.",
    betweenParties: "مبنای تصمیم شماست؛ اگر هزینهٔ مشترک با شریک/موجر است، به تأیید او نیاز دارد.",
    againstThird: "برای بیمه/مالیات، گزارش‌ها و فاکتورهای رسمی لازم است.",
    proves: ["برآورد داخلی سود و سر‌به‌سر"],
    doesNotProve: ["هزینهٔ واقعی قابل قبول مالیاتی", "حقوق شریک"],
    needsToBeStronger: ["پیوست فاکتورهای رسمی نهاده و کارگر", "تأیید شریک/موجر", "ثبت مبالغ در دفتر مالی"],
    requirements: [{ label: "مستندسازی هر ردیف هزینه", importance: "توصیه‌شده", note: "ردیف بدون فاکتور و رسید قابل اتکا نیست." }],
    legalBasis: "گزارش داخلی مدیریتی — مبنای حسابداری مدیریت",
    references: [CIVIL_CODE],
  },
  "finance-report": {
    kind: "finance-report",
    title: "گزارش دفتر مالی",
    level: 3,
    levelLabel: AUTHORITY_LEVELS[3].label,
    status: "internal-note",
    short: "یادداشت داخلی؛ برای دادگاه و مالیات باید اسناد پایه ضمیمه شود.",
    betweenParties: "با امضای طرف‌حساب به اقرارنامه نزدیک می‌شود، وگرنه سابقهٔ داخلی است.",
    againstThird: "به‌تنهایی سند اثبات حق نیست.",
    proves: ["سوابق داخلی درآمد و هزینه"],
    doesNotProve: ["مطالبات قانونی", "پروندهٔ مالیاتی"],
    needsToBeStronger: ["ضمیمهٔ رسیدهای پرداخت", "دفاتر قانونی و اسناد رسمی", "امضای طرف‌حساب"],
    requirements: [{ label: "اتصال هر ردیف به رسید/فاکتور", importance: "توصیه‌شده", note: "گزارش بدون سند پشتیبان ارزش اثباتی ندارد." }],
    legalBasis: "گزارش داخلی مدیریتی و ماده ۱۶۹ ق.م.م (نگهداری سوابق)",
    references: [TAX_LAW],
  },
  "inventory-report": {
    kind: "inventory-report",
    title: "گزارش انبار، دارایی و بودجه",
    level: 3,
    levelLabel: AUTHORITY_LEVELS[3].label,
    status: "internal-note",
    short: "شمارش داخلی انبار؛ برای اثبات، صورت‌جلسهٔ مشترک لازم است.",
    betweenParties: "برای انبار مشترک/اکیپ، بدون امضای طرف دیگر قابل استناد نیست.",
    againstThird: "برای بیمه و مراجع، ارزیابی رسمی/کارشناس لازم است.",
    proves: ["تصویر داخلی موجودی"],
    doesNotProve: ["مالکیت کالا", "ارزش قابل قبول بیمه‌ای"],
    needsToBeStronger: ["صورتجلسهٔ شمارش با امضای دو طرف", "گزارش کارشناس/بیمه"],
    requirements: [{ label: "امضای شمارش‌کننده/شاهد", importance: "توصیه‌شده", note: "شمارش بدون شاهد قابل خدشه است." }],
    legalBasis: "گزارش داخلی مدیریتی — رویه‌های حسابداری مدیریت",
    references: [CIVIL_CODE],
  },
  "id-document": {
    kind: "id-document",
    title: "تصویر مدارک هویتی و ثبتی (سند مالکیت، نسق زراعی)",
    level: 2,
    levelLabel: "تصویر مدرک رسمی — نیازمند گواهی برابر اصل",
    status: "supporting",
    short: "کپی تنها کافی نیست؛ برای مراجع گواهی برابر اصل لازم است.",
    betweenParties: "برای احراز هویت اولیه و تنظیم قرارداد مفید است.",
    againstThird: "مراجع معمولاً اصل یا رونوشت گواهی‌شده می‌خواهند؛ استعلام ثبتی اعتبار بیشتری دارد.",
    proves: ["وجود ظاهری مدرک و مشخصات آن"],
    doesNotProve: ["مالکیت فعلی و نبود بازداشتی (نیاز به استعلام)"],
    needsToBeStronger: ["گواهی برابر اصل", "استعلام ثبتی روز", "تطبیق با سند رسمی اصل"],
    requirements: [
      { label: "خوانا بودن کامل شماره و مهر", importance: "الزامی", note: "تصویر ناخوانا ارزش استنادی ندارد." },
      { label: "تطبیق با اصل", importance: "توصیه‌شده", note: "برای مراجع، گواهی برابر اصل بگیرید." },
    ],
    legalBasis: "قانون ثبت اسناد و املاک و ماده ۱۲۸۷ قانون مدنی",
    references: [{ label: "ماده ۱۲۸۷ قانون مدنی — اسناد رسمی", url: CIVIL_CODE.url }, VANDALAW],
  },
};

export const AUTHORITY_ORDER: string[] = [
  "sale-contract",
  "settlement",
  "party-statement",
  "lease-contract",
  "lease-receipt",
  "lease-handover",
  "weigh-ticket",
  "quality-minutes",
  "sale-invoice",
  "receipt",
  "cheque-sheet",
  "electronic-signature",
  "trades-report",
  "cost-report",
  "finance-report",
  "inventory-report",
  "id-document",
];

const FALLBACK: AuthorityEntry = {
  kind: "unknown",
  title: "سند/یادداشت نامشخص",
  level: 3,
  levelLabel: AUTHORITY_LEVELS[3].label,
  status: "internal-note",
  short: "اعتبار آن به نوع، امضا و ثبت رسمی بستگی دارد.",
  betweenParties: "اگر امضای طرف مقابل را داشته باشد می‌تواند اقرار محسوب شود؛ در غیر این صورت یادداشت است.",
  againstThird: "بدون ثبت رسمی یا سند پایه، در برابر ثالث قابل استناد نیست.",
  proves: ["همان چیزی که در متن نوشته شده و طرف آن را پذیرفته است"],
  doesNotProve: ["موضوعات بیرون از متن", "مالکیت و تعهدات رسمی"],
  needsToBeStronger: ["امضای طرفین", "ثبت در سامانه/دفتر رسمی", "پیوست رسید و مدارک"],
  requirements: [idReq, signatureReq("طرفین"), dateReq],
  legalBasis: "مواد ۱۲۸۴، ۱۲۸۹، ۱۲۹۰ و ۱۲۹۱ قانون مدنی",
  references: [CIVIL_CODE, HEYVALAW, VANDALAW],
};

export function authorityFor(kind: string): AuthorityEntry {
  return AUTHORITY[kind] ?? FALLBACK;
}

export function authoritySummary() {
  return AUTHORITY_ORDER.map((kind) => {
    const entry = AUTHORITY[kind];
    return {
      kind: entry.kind,
      title: entry.title,
      level: entry.level,
      levelLabel: entry.levelLabel,
      short: entry.short,
      status: entry.status,
    };
  });
}

/**
 * اسنادی که نباید به‌عنوان «سند اثبات حق» به کاربر نشان داده شوند.
 * این‌ها حذف نمی‌شوند؛ فقط به‌عنوان «یادداشت» در برنامه بایگانی می‌شوند
 * و در همهٔ گزارش‌ها باید با همین هشدار همراه باشند.
 */
export function noteOnlyEntries() {
  return AUTHORITY_ORDER.map((kind) => AUTHORITY[kind])
    .filter((entry) => entry.level >= 3)
    .map((entry) => ({
      kind: entry.kind,
      title: entry.title,
      level: entry.level,
      levelLabel: entry.levelLabel,
      status: entry.status,
      short: entry.short,
      why: entry.doesNotProve,
      toBeValid: entry.needsToBeStronger,
      legalBasis: entry.legalBasis,
    }));
}

/** اسنادی که اعتبار حقوقی بالاتری دارند (سطح ۱ و ۲). */
export function credibleEntries() {
  return AUTHORITY_ORDER.map((kind) => AUTHORITY[kind])
    .filter((entry) => entry.level <= 2)
    .map((entry) => ({
      kind: entry.kind,
      title: entry.title,
      level: entry.level,
      levelLabel: entry.levelLabel,
      status: entry.status,
      short: entry.short,
      legalBasis: entry.legalBasis,
    }));
}

/** شمارش اسناد به تفکیک سطح اعتبار؛ منبع واحد برای صفحه و کامپوننت. */
export function authorityLevelCounts(): Record<AuthorityLevel, number> {
  const counts: Record<AuthorityLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  AUTHORITY_ORDER.forEach((kind) => {
    const entry = AUTHORITY[kind];
    counts[entry.level] += 1;
  });
  return counts;
}

/** پیام یکسان برای هر سند سطح ۳ و ۴: چرا یادداشت است و چطور معتبر می‌شود. */
export function noteOnlyMessage(kind: string): string {
  const entry = authorityFor(kind);
  if (entry.level < 3) return "";
  return (
    `این سند در سطح ${entry.level} است و در برنامه فقط به‌عنوان «یادداشت» ذخیره می‌شود؛ ` +
    `برای اثبات حق کافی نیست. ${entry.againstThird} ` +
    `برای معتبرتر شدن: ${entry.needsToBeStronger.slice(0, 3).join("، ")}.`
  );
}

export const VALIDITY_METHOD = [
  {
    title: "۱) چه کسی امضا کرده؟",
    text: "سند عادی علیه کسی که آن را امضا کرده و ورثه و قائم‌مقام او معتبر است؛ علیه دیگران به‌تنهایی اثر ندارد (مواد ۱۲۹۰ و ۱۲۹۱ قانون مدنی).",
  },
  {
    title: "۲) در برابر چه کسی استفاده می‌کنید؟",
    text: "بین طرفین امضاکننده، سند عادی دلیل است. برای اجرای مستقیم یا استناد در برابر بانک و اداره، سند رسمی/ثبت‌شده لازم است.",
  },
  {
    title: "۳) ثبت رسمی انجام شده؟",
    text: "دفتر اسناد رسمی یا سامانهٔ قانونی همان موضوع (صیاد برای چک، مؤدیان برای فاکتور، ثبت معاملات املاک برای اجارهٔ بیش از ۲ سال) جایگاه سند را بالا می‌برد.",
  },
  {
    title: "۴) اسناد پایه پیوست است؟",
    text: "قرارداد + قبض باسکول + صورتجلسهٔ کیفیت + رسید پرداخت یک زنجیرهٔ اثبات می‌سازند؛ هیچ‌کدام تنهایی کامل نیست.",
  },
];

export const VALIDITY_DISCLAIMER =
  "این تحلیل راهنمای عمومی و آموزشی است، نه نظر حقوقی پروندهٔ شما. برای تصمیم حقوقی، متن قرارداد و پروندهٔ خود را به وکیل یا دفتر اسناد رسمی نشان دهید. اسناد تولیدشده در برنامه «یادداشت و پیش‌نویس» هستند و حذف نمی‌شوند؛ برای اعتبار رسمی باید امضا/ثبت/سامانهٔ مربوط را طی کنند.";

export const RECEIPT_NOTE =
  "رسیدهای آپلودی (فیش واریز، قبض POS، عکس قبض) مدرک حمایتی‌اند: پرداخت را نشان می‌دهند، ولی علت پرداخت را قرارداد/صورتجلسه اثبات می‌کند. شمارهٔ پیگیری و شمارهٔ قرارداد را در توضیح رسید بنویسید.";

/** پاسخ قطعی برای پرسش‌های «اعتبار سند»؛ همهٔ متن از جدول بالا ساخته می‌شود. */
export function matchAuthorityQuestion(raw: string): {
  kind: string;
  confidence: number;
  text: string;
  followUps: string[];
  sources: { label: string; note?: string }[];
} | null {
  const text = raw
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200f\u200e]/g, " ")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!text) return null;

  const legalCue = /(اعتبار|معتبر|قانونی|دادگاه|سند|ثبت رسمی|دفتر اسناد|حجیت|قابل استناد|ارزش اثبات|اثبات|شکایت|وکیل|اجرا)/.test(text);
  if (!legalCue) return null;

  const wantsGeneral = /(کدام|چه اسناد|چه سند|لیست|فهرست|همه|جدول|تفاوت|اعتبار اسناد|انواع سند|چی معتبر)/.test(text);

  const keys: { kind: string; patterns: RegExp }[] = [
    { kind: "weigh-ticket", patterns: /(باسکول|وزن نامه|وزن‌نامه|قبض وزن|توزین)/ },
    { kind: "quality-minutes", patterns: /(کیفیت|نمونه برداری|نمونه‌برداری|رطوبت|ناخالصی|آزمایشگاه)/ },
    { kind: "sale-invoice", patterns: /(فاکتور|صورتحساب|مؤدیان|مودیان|ارزش افزوده)/ },
    { kind: "cheque-sheet", patterns: /(چک|صیاد|برگه چک)/ },
    { kind: "lease-receipt", patterns: /(رسید اجاره|پرداخت اجاره|اجاره‌بها)/ },
    { kind: "lease-contract", patterns: /(اجاره|مال الاجاره|مال‌الاجاره|مستاجر|موجر|مساقات|مزارعه)/ },
    { kind: "lease-handover", patterns: /(تحویل زمین|صورتجلسه تحویل|تحویل و تحول)/ },
    { kind: "electronic-signature", patterns: /(امضای الکترونیکی|امضای دیجیتال|ecdsa|امضای رمزنگاری|امضای دستی)/ },
    { kind: "sale-contract", patterns: /(قرارداد فروش|قرارداد محصول|بیع|مبایعه|فروش محصول)/ },
    { kind: "settlement", patterns: /(تسویه|وفای به عهد)/ },
    { kind: "party-statement", patterns: /(صورت‌حساب|صورت حساب|بدهکار|بستانکار|اقرار|رسید بدهی|مانده حساب)/ },
    { kind: "receipt", patterns: /(رسید|فیش|واریز|کارت به کارت|pos|قبض پرداخت|فیش بانکی)/ },
    { kind: "finance-report", patterns: /(دفتر مالی|گزارش مالی|دفتر عملیات|تراکنش)/ },
    { kind: "cost-report", patterns: /(بهای تمام|تمام شده|سربه‌سر|سر به سر)/ },
    { kind: "inventory-report", patterns: /(انبار|موجودی|دارایی|بودجه|استهلاک)/ },
    { kind: "id-document", patterns: /(سند مالکیت|نسق|مدارک هویتی|کارت ملی|شناسنامه|برابر اصل)/ },
  ];

  const wantsNotes = /(بی اعتبار|بی‌اعتبار|کم اعتبار|کم‌اعتبار|اعتبار ندارند|اعتبار نداره|بدون اعتبار|یادداشت|یاد داشت)/.test(
    text,
  );
  const matched = keys.find((item) => item.patterns.test(text));
  const kind = matched?.kind ?? (wantsNotes ? "notes" : wantsGeneral ? "summary" : null);
  if (!kind) return null;

  const followUps = [
    "چه امضاهایی برای معتبر بودن سند لازم است؟",
    "تفاوت سند عادی و رسمی چیست؟",
    "رسید پرداخت چه چیزی را ثابت می‌کند؟",
    "چک صیادی چه شرایطی دارد؟",
  ];

  if (kind === "notes") {
    const notes = noteOnlyEntries();
    const lines = notes.map(
      (item) =>
        `• ${item.title} — سطح ${item.level} (${item.levelLabel})\n  ثابت نمی‌کند: ${item.why.slice(0, 3).join("، ")}\n  برای اعتبار بیشتر: ${item.toBeValid.slice(0, 3).join("، ")}`,
    );
    return {
      kind: "notes",
      confidence: 95,
      text:
        `این اسناد در برنامه ساخته و ذخیره می‌شوند، اما سند اثبات حق نیستند؛ فقط «یادداشت» هستند:\n${lines.join("\n")}\n\n` +
        "این موارد از برنامه حذف نمی‌شوند و برای مدیریت و بایگانی شما می‌مانند؛ اما برای دادگاه/اداره باید سند رسمی، ثبت صیاد، فاکتور رسمی مؤدیان، سند رسمی اجاره یا گزارش کارشناس ضمیمه شود.\n\n" +
        VALIDITY_DISCLAIMER,
      followUps: [
        "تفاوت سند عادی و رسمی چیست؟",
        "چک صیادی چه شرایطی دارد و چه زمانی قابل پیگیری است؟",
        "آیا فیش واریز سند است؟",
        "کدام اسناد قابل استناد بین طرفین است؟",
      ],
      sources: [
        { label: "جدول اعتبار ۱۷ سند کشاورزحساب", note: "بر پایهٔ قانون مدنی، قانون صیاد، سامانهٔ مؤدیان و قانون ثبت معاملات" },
        CIVIL_CODE,
        REGISTRATION_LAW,
      ],
    };
  }

  if (kind === "summary") {
    const lines = AUTHORITY_ORDER.filter((key) =>
      ["sale-contract", "weigh-ticket", "quality-minutes", "sale-invoice", "lease-contract", "receipt", "cheque-sheet"].includes(key),
    ).map((key) => {
      const item = AUTHORITY[key];
      return `• ${item.title} — سطح ${item.level}: ${item.levelLabel}\n  ${item.short}`;
    });
    return {
      kind: "summary",
      confidence: 94,
      text:
        `${lines.join("\n")}\n\n` +
        `— اسناد سطح ۳ و ۴ (فقط یادداشت): ${noteOnlyEntries().map((item) => item.title).join("، ")}.\n` +
        `این‌ها در برنامه می‌مانند اما حق قانونی اثبات نمی‌کنند.\n\nجمع‌بندی: قوی‌ترین حالت زمانی است که سند عادی امضاشده داشته باشید و همان موضوع را در سامانه/دفتر رسمی ثبت کنید. ` +
        `گزارش‌های داخلی برنامه (دفتر مالی، انبار، بهای تمام‌شده، معاملات) یادداشت مدیریتی‌اند و جای سند رسمی را نمی‌گیرند.\n\n${VALIDITY_DISCLAIMER}`,
      followUps,
      sources: [
        { label: "جدول اعتبار اسناد کشاورزحساب", note: "بر پایهٔ قانون مدنی، قانون صیاد، سامانهٔ مؤدیان و قانون ثبت معاملات" },
        CIVIL_CODE,
      ],
    };
  }

  const entry = authorityFor(kind);
  const reqs = entry.requirements.map((req) => `• ${req.label} (${req.importance}): ${req.note}`).join("\n");
  const body = [
    `سطح اعتبار «${entry.title}»: ${entry.level} از ۴ — ${entry.levelLabel}`,
    entry.short,
    "",
    `در برابر طرفین: ${entry.betweenParties}`,
    `در برابر اشخاص ثالث: ${entry.againstThird}`,
    "",
    "چه چیزی را ثابت می‌کند؟",
    ...entry.proves.map((item) => `• ${item}`),
    "",
    "چه چیزی را ثابت نمی‌کند؟",
    ...entry.doesNotProve.map((item) => `• ${item}`),
    "",
    "برای معتبرتر شدن:",
    ...entry.needsToBeStronger.map((item) => `• ${item}`),
    "",
    "شرایط لازم:",
    reqs,
    "",
    `مبنای حقوقی: ${entry.legalBasis}`,
    "",
    VALIDITY_DISCLAIMER,
  ].join("\n");

  return {
    kind: entry.kind,
    confidence: 96,
    text: body,
    followUps,
    sources: [
      { label: `تحلیل اعتبار سند کشاورزحساب — ${entry.title}`, note: entry.legalBasis },
      ...entry.references.map((ref) => ({ label: ref.label, note: ref.url })),
    ],
  };
}
