import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Check,
  CircleCheck,
  ClipboardCheck,
  Database,
  FileCheck2,
  FlaskConical,
  Layers,
  LockKeyhole,
  Printer,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Wheat,
} from "lucide-react";
import { cn } from "../utils/cn";
import { PRODUCT_PROFILES, runEngineSelfTest } from "../lib/trade";
import { DOCUMENT_TYPES } from "../lib/documents";
import { formatJalali, toPersianDigits, todayJalali } from "../lib/format";

const LAYERS = [
  {
    number: "۰۱",
    title: "لایه ورودی و اعتبارسنجی",
    description: "فرم‌های مرحله‌ای، تاریخ شمسی، محدوده‌های عددی و پیام خطای فارسی. ورودی نامعتبر هرگز به موتور مالی نمی‌رسد.",
    items: ["وزن پر > وزن خالی", "رطوبت و افت در محدوده", "نرخ و کارمزد مثبت", "تاریخ شروع ≤ پایان"],
    icon: ClipboardCheck,
  },
  {
    number: "۰۲",
    title: "موتور قطعی محاسبه",
    description: "توابع خالص TypeScript با ترتیب ثابت: وزن خالص، افت رطوبت، افت مفید، افت غیرمفید، درجه، قیمت، هزینه، مالیات، خالص.",
    items: ["بدون محاسبه در UI", "گرد کردن قطعی", "Snapshot هر معامله", "نسخه موتور در سند"],
    icon: Scale,
  },
  {
    number: "۰۳",
    title: "قواعد کیفیت و انطباق",
    description: "حدود کیفی با ضعیف‌ترین شاخص؛ سقف‌های رطوبت و ناخالصی؛ معافیت مالیاتی محصول فرآوری‌نشده و هشدارهای خریدار.",
    items: ["قاعده ضعیف‌ترین شاخص", "سقف افت غیرمفید", "معافیت مالیاتی", "هشدار ریسک معامله"],
    icon: ShieldCheck,
  },
  {
    number: "۰۴",
    title: "اسناد، چاپ و ماندگاری",
    description: "تولید قرارداد، قبض باسکول، صورتجلسه کیفیت، صورت‌حساب و تسویه با سریال یکتا، کد استعلام، QR و قالب A4.",
    items: ["سربرگ و مهر/امضا", "شماره یکتا", "ذخیره PDF", "بایگانی محلی"],
    icon: Printer,
  },
];

const PIPELINE = [
  { title: "۱. وزن خالص", formula: "وزن پر − وزن خالی", note: "کلیه وزن‌ها از باسکول معتبر و در حضور طرفین." },
  { title: "۲. افت رطوبت", formula: "(رطوبت اندازه‌گیری − رطوبت پایه) ÷ (۱۰۰ − رطوبت پایه) × وزن", note: "فقط وقتی رطوبت از پایه بیشتر باشد. آب اضافه از وزن قابل پرداخت کم می‌شود." },
  { title: "۳. افت مفید", formula: "وزن پس از رطوبت × درصد افت مفید", note: "دانه شکسته، جوانه‌زده و موارد قابل مصرف؛ حداقل پایه قرارداد." },
  { title: "۴. افت غیرمفید", formula: "وزن پس از رطوبت × بیشترِ(نرخ قرارداد، ناخالصی)", note: "شامل ناخالصی، کاه، سنگ و بذر علف هرز؛ سقف ۷٪ در رویه مراکز خرید." },
  { title: "۵. درجه کیفی", formula: "ضعیف‌ترین شاخص → درجه ۱/۲/۳/خارج", note: "هکتولیتر، پروتئین، سن‌زدگی و دانه شکسته؛ ضریب قیمت ۱، ۰٫۹۸، ۰٫۹۶." },
  { title: "۶. ارزش محصول", formula: "وزن قابل پرداخت × نرخ پایه × ضریب درجه", note: "نرخ توافقی خریدار بر نرخ مرجع اولویت دارد." },
  { title: "۷. هزینه‌های فروشنده", formula: "کرایه + تخلیه + کارمزد + بیمه + جریمه + سایر", note: "کارمزد بر اساس درصد ارزش محصول؛ همه اقلام تفکیک می‌شوند." },
  { title: "۸. مالیات", formula: "ارزش محصول × نرخ مالیات (پیش‌فرض صفر)", note: "معافیت محصول فرآوری‌نشده — ماده ۹ قانون ارزش افزوده ۱۴۰۰." },
  { title: "۹. خالص دریافتی", formula: "ارزش + مالیات − هزینه‌ها", note: "پرداخت‌شده و مانده بر اساس تاریخ سررسید پیگیری می‌شود." },
];

const ENTITIES = [
  ["CropTrade", "معامله محصول", "سریال، تاریخ، خریدار، وزن، کیفیت، نرخ، هزینه، snapshot نتیجه"],
  ["CropPlot", "زمین و کشت", "مساحت، محصول، هزینه‌های هفت‌گانه، عملکرد، نرخ، مالکیت"],
  ["Party", "طرف‌حساب", "نام، نقش مالک/مستاجر، تلفن، شهر، توضیح"],
  ["Contract", "قرارداد زمین", "نوع، طرفین، مدت، اجاره، ودیعه، سهم محصول، حقابه"],
  ["DocumentRecord", "سند چاپی", "نوع، سریال، تاریخ، payload، کد استعلام"],
  ["Payment", "پرداخت", "معامله/قرارداد، مبلغ، روش، شماره چک، تاریخ"],
  ["AuditEvent", "ردّ تغییرات", "ثبت/ویرایش/حذف، زمان، نسخه موتور"],
];

const INVARIANTS = [
  "هیچ محاسبه مالی در کامپوننت‌های UI انجام نمی‌شود؛ همه از توابع خالص موتور می‌آید.",
  "وزن قابل پرداخت هرگز منفی نمی‌شود و افت‌ها فقط یک‌بار و به ترتیب اعمال می‌شوند.",
  "درجه کیفی از ضعیف‌ترین شاخص تعیین می‌شود؛ شاخص خوب، ضعف دیگر را جبران نمی‌کند.",
  "مبلغ‌ها به تومان و عدد صحیح ذخیره می‌شوند؛ وزن‌ها حداکثر دو رقم اعشار.",
  "هر معامله snapshot ورودی و نتیجه را نگه می‌دارد؛ تغییر تنظیمات بعدی، سند قدیمی را تغییر نمی‌دهد.",
  "جمع هزینه‌ها با جمع اقلام برابر است؛ پرداخت‌شده هرگز از مانده بیشتر نمی‌شود.",
  "کد استعلام و شماره سریال یکتا تولید می‌شوند و روی سند چاپی درج می‌گردند.",
  "مالیات صفر فقط با انتخاب صریح «معاف» فعال می‌شود و مبنای قانونی روی سند می‌آید.",
];

const SOURCES = [
  { title: "مصوبه قیمت خرید تضمینی — آخرین نرخ مصوب", org: "شورای قیمت‌گذاری محصولات کشاورزی", note: "نرخ پایه ۴۹٬۵۰۰ تومان (فصل ۱۴۰۴–۱۴۰۵) بر مبنای افت ۳+۱؛ نرخ فصل جاری باید از ابلاغیه روز جایگزین شود.", url: "https://fa.shafaqna.com/news/2288126/" },
  { title: "آیین‌نامه بند (ب) تبصره (۱۳) قانون بودجه ۱۴۰۴", org: "هیئت وزیران / خرید تضمینی گندم", note: "شرایط کیفی، درصد افت مفید و غیرمفید، رطوبت و اختیارات شورای قیمت‌گذاری.", url: "https://www.ekhtebar.ir/" },
  { title: "استاندارد ملی ایران ۱۰۴۳ — گندم ویژگی‌ها", org: "سازمان ملی استاندارد ایران", note: "شاخص‌های رطوبت، ناخالصی، وزن هکتولیتر، دانه شکسته و سن‌زدگی.", url: "https://www.isiri.gov.ir/" },
  { title: "قانون مالیات بر ارزش افزوده ۱۴۰۰ — ماده ۹", org: "مجلس شورای اسلامی", note: "معافیت محصولات کشاورزی فرآوری‌نشده؛ بسته‌بندی و درجه‌بندی، فرآوری محسوب نمی‌شود.", url: "https://maliatman.com/قانون-ارزش-افزوده-ماده-9/" },
  { title: "قانون مدنی — بیع و تعهدات", org: "قانون مدنی ایران", note: "مواد ۱۰، ۱۹۰، ۲۱۹، ۲۲۰، ۳۳۸، ۳۴۸، ۳۶۷ و ۴۲۲؛ مبنای تنظیم قرارداد و قبض.", url: "https://fa.wikisource.org/wiki/قانون_مدنی" },
];

export function ArchitecturePage() {
  const [checks, setChecks] = useState(() => runEngineSelfTest());
  const [lastRun, setLastRun] = useState(() => todayJalali());
  const passed = checks.filter((check) => check.pass).length;

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]">
            <BookOpen className="h-3.5 w-3.5 text-mint-300" />
            سند معماری
            <span className="rounded border border-mint-300/20 bg-mint-300/[0.07] px-1.5 py-0.5 font-mono text-[8px] text-mint-300">trade-engine-1.0.0</span>
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">معماری، فرمول‌ها و کنترل کیفیت</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] font-light leading-6 text-[#89a598]">
            هر عدد این نرم‌افزار یک مسیر قابل ردیابی دارد. این صفحه، قرارداد فنی محصول و مبنای محاسبات فروش محصول
            کشاورزی است؛ همراه با آزمون‌های خودکار موتور.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setChecks(runEngineSelfTest());
            setLastRun(todayJalali());
          }}
          className="flex items-center gap-1.5 rounded-xl border border-mint-300/20 bg-mint-300/[0.07] px-3 py-2.5 text-[9px] font-medium text-mint-300"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          اجرای مجدد آزمون‌ها
        </button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between"><span className="text-[9px] text-[#91ad9f]">آزمون‌های موتور</span><FlaskConical className="h-4 w-4 text-mint-300" /></div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={cn("text-2xl font-extrabold", passed === checks.length ? "text-mint-300" : "text-[#efad9f]")}>{toPersianDigits(passed)}</span>
            <span className="text-[10px] text-[#78968a]">از {toPersianDigits(checks.length)} قبول</span>
          </div>
          <p className="mt-1 text-[8px] text-[#6f8c7f]">آخرین اجرا: {formatJalali(lastRun, "long")}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between"><span className="text-[9px] text-[#91ad9f]">قواعد تغییرناپذیر</span><LockKeyhole className="h-4 w-4 text-mint-300" /></div>
          <div className="mt-2 text-2xl font-extrabold text-[#eef8f1]">{toPersianDigits(INVARIANTS.length)}</div>
          <p className="mt-1 text-[8px] text-[#6f8c7f]">اعتبارسنجی پیش و پس از محاسبه</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between"><span className="text-[9px] text-[#91ad9f]">انواع سند استاندارد</span><FileCheck2 className="h-4 w-4 text-mint-300" /></div>
          <div className="mt-2 text-2xl font-extrabold text-[#eef8f1]">{toPersianDigits(DOCUMENT_TYPES.length)}</div>
          <p className="mt-1 text-[8px] text-[#6f8c7f]">A4 · سریال · QR · مهر و امضا</p>
        </div>
      </div>

      <section className="mb-5">
        <div className="mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-mint-300" />
          <h2 className="text-[13px] font-semibold text-white">معماری چهارلایه</h2>
          <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[8px] text-[#8fa99c]">جداسازی مسئولیت</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {LAYERS.map((layer) => {
            const Icon = layer.icon;
            return (
              <div key={layer.number} className="glass relative overflow-hidden rounded-2xl p-4">
                <div className="absolute left-3 top-2 text-2xl font-black text-white/[0.05]">{layer.number}</div>
                <span className="mb-2 grid h-8 w-8 place-items-center rounded-lg bg-mint-300/[0.08] text-mint-300"><Icon className="h-4 w-4" /></span>
                <h3 className="text-[11px] font-semibold text-[#e3f0e8]">{layer.title}</h3>
                <p className="mt-1.5 text-[8px] font-light leading-5 text-[#819d90]">{layer.description}</p>
                <ul className="mt-2 space-y-1">
                  {layer.items.map((item) => (
                    <li key={item} className="flex items-center gap-1.5 text-[8px] text-[#a8c0b4]">
                      <Check className="h-2.5 w-2.5 shrink-0 text-mint-300" strokeWidth={3} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mb-5 grid items-start gap-4 xl:grid-cols-[1.35fr_1fr]">
        <section className="glass rounded-[22px] p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Wheat className="h-4 w-4 text-mint-300" />
            <h2 className="text-[13px] font-semibold text-white">مسیر محاسبه فروش گندم</h2>
            <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[8px] text-[#8fa99c]">ترتیب قطعی</span>
          </div>
          <div className="space-y-2">
            {PIPELINE.map((step, index) => (
              <div key={step.title} className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 pr-3">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <h3 className="text-[10px] font-medium text-[#dcebe2]">{step.title}</h3>
                  <span className={cn("rounded px-1.5 py-0.5 text-[8px]", index < 2 ? "bg-mint-300/10 text-mint-300" : index < 5 ? "bg-sand-300/10 text-sand-300" : "bg-white/[0.05] text-[#9fb6aa]")}>
                    {index < 2 ? "وزن" : index < 5 ? "کیفیت" : "مالی"}
                  </span>
                </div>
                <div className="mt-1 rounded bg-[#071510]/60 px-2 py-1 font-mono text-[8px] text-[#a9c4b7]" dir="rtl">{step.formula}</div>
                <p className="mt-1 text-[8px] font-light leading-4 text-[#78968a]">{step.note}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <section className="glass rounded-[22px] p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-mint-300" />
              <h2 className="text-[13px] font-semibold text-white">آزمون‌های خودکار موتور</h2>
              <span className={cn("mr-auto rounded-full border px-2 py-0.5 text-[8px]", passed === checks.length ? "border-mint-300/20 bg-mint-300/[0.07] text-mint-300" : "border-[#a25649]/25 bg-[#a25649]/10 text-[#efad9f]")}>
                {toPersianDigits(passed)} / {toPersianDigits(checks.length)}
              </span>
            </div>
            <div className="space-y-1.5">
              {checks.map((check) => (
                <div key={check.name} className="flex items-start gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                  <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full", check.pass ? "bg-mint-300/15 text-mint-300" : "bg-[#a25649]/20 text-[#efad9f]")}>
                    {check.pass ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : <AlertTriangle className="h-2.5 w-2.5" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[8px] font-medium text-[#d3e4da]">{check.name}</div>
                    <div className="mt-0.5 text-[7px] font-light leading-4 text-[#7f9b8e]">{check.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[7px] font-light leading-4 text-[#6f8c7f]">
              این آزمون‌ها در مرورگر شما و روی توابع خالص موتور اجرا می‌شوند؛ همان تابعی که اعداد فرم و اسناد را می‌سازد.
            </p>
          </section>
        </div>
      </div>

      <div className="mb-5 grid items-start gap-4 lg:grid-cols-2">
        <section className="glass rounded-[22px] p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-mint-300" /><h2 className="text-[13px] font-semibold text-white">قواعد تغییرناپذیر (Invariants)</h2></div>
          <ul className="space-y-2">
            {INVARIANTS.map((item, index) => (
              <li key={item} className="flex items-start gap-2 rounded-lg bg-white/[0.02] px-2.5 py-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-mint-300/10 text-[7px] font-bold text-mint-300">{toPersianDigits(index + 1)}</span>
                <span className="text-[8px] font-light leading-4 text-[#a9c1b5]">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass rounded-[22px] p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2"><Database className="h-4 w-4 text-mint-300" /><h2 className="text-[13px] font-semibold text-white">مدل داده</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-white/[0.07] text-[8px] text-[#7d9a8d]">
                  <th className="py-1.5 font-normal">موجودیت</th>
                  <th className="py-1.5 font-normal">کاربرد</th>
                  <th className="py-1.5 font-normal">فیلدهای کلیدی</th>
                </tr>
              </thead>
              <tbody>
                {ENTITIES.map(([entity, usage, fields]) => (
                  <tr key={entity} className="border-b border-white/[0.04] align-top">
                    <td className="py-1.5 pl-2 font-mono text-[8px] text-mint-300">{entity}</td>
                    <td className="py-1.5 pl-2 text-[8px] text-[#c5d9cf]">{usage}</td>
                    <td className="py-1.5 text-[7px] font-light leading-4 text-[#7f9b8e]">{fields}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[7px] font-light leading-4 text-[#6f8c7f]">
            در نسخه وب، داده‌ها در localStorage با نسخه‌بندی نگه‌داری می‌شوند. برای چندکاربره/سازمانی، همان مدل روی
            PostgreSQL و با رعایت کنترل دسترسی اجرا می‌شود.
          </p>
        </section>
      </div>

      <section className="mb-5">
        <div className="mb-3 flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-mint-300" /><h2 className="text-[13px] font-semibold text-white">رجیستری اسناد چاپی</h2><span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[8px] text-[#8fa99c]">{toPersianDigits(DOCUMENT_TYPES.length)} نوع</span></div>
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {DOCUMENT_TYPES.map((doc) => (
            <div key={doc.kind} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[10px] font-semibold text-[#e3f0e8]">{doc.title}</h3>
                <span className="shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 text-[7px] text-[#8fa99c]">{doc.family === "trade" ? "محصول" : doc.family === "lease" ? "زمین" : "گزارش"}</span>
              </div>
              <p className="mt-1 text-[8px] font-light leading-4 text-[#819d90]">{doc.description}</p>
              <p className="mt-1.5 rounded bg-[#071510]/50 px-2 py-1 text-[7px] leading-4 text-[#7f9b8e]">{doc.legalBasis}</p>
              <div className="mt-1.5 flex items-center justify-between text-[7px] text-[#6f8c7f]">
                <span>{doc.copies}</span>
                <span className="flex items-center gap-1">{doc.needsStamp ? <><ShieldCheck className="h-2.5 w-2.5" /> مهر و امضا</> : <><CircleCheck className="h-2.5 w-2.5" /> بایگانی</>}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-5 grid items-start gap-4 lg:grid-cols-2">
        <section className="glass rounded-[22px] p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4 text-mint-300" /><h2 className="text-[13px] font-semibold text-white">استانداردها و منابع</h2></div>
          <div className="space-y-2.5">
            {SOURCES.map((source) => (
              <a key={source.title} href={source.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition hover:border-mint-300/20">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[9px] font-medium text-[#d7e7de]">{source.title}</h3>
                  <ArrowLeft className="mt-0.5 h-3 w-3 shrink-0 text-[#6f8c7f]" />
                </div>
                <p className="mt-0.5 text-[7px] text-[#78968a]">{source.org}</p>
                <p className="mt-1 text-[8px] font-light leading-4 text-[#819d90]">{source.note}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="glass rounded-[22px] p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-sand-300" /><h2 className="text-[13px] font-semibold text-white">پروفایل محصولات</h2></div>
          <div className="space-y-2">
            {Object.values(PRODUCT_PROFILES).map((product) => (
              <div key={product.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#d7e7de]"><Wheat className="h-3 w-3 text-mint-300" /> {product.name}</span>
                  <span className="font-mono text-[8px] text-[#9fc7ae]">{toPersianDigits(product.basePrice)} تومان/kg</span>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-1 text-[7px] text-[#78968a]">
                  <span>رطوبت پایه {toPersianDigits(product.baseMoisture)}٪</span>
                  <span>افت {toPersianDigits(product.baseUsefulLoss)}+{toPersianDigits(product.baseNonUsefulLoss)}٪</span>
                  <span>{product.priceYear}</span>
                </div>
                <p className="mt-1 text-[7px] font-light leading-4 text-[#6f8c7f]">{product.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-sand-300/15 bg-sand-300/[0.05] p-2.5 text-[8px] font-light leading-5 text-sand-300/90">
            <b>اصل طلایی:</b> نرخ و شرایط افت را همیشه از قرارداد خریدار/ابلاغیه روز بگیرید. اعداد پیش‌فرض برای
            برنامه‌ریزی است، نه جایگزین سند رسمی خریدار.
          </div>
        </section>
      </div>

      <section className="rounded-[22px] border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-2 flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-mint-300" /><h2 className="text-[12px] font-semibold text-white">مسیر توسعه (فازهای بعدی)</h2></div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["نسخه وب سازمانی", "چند کاربر، نقش و سطح دسترسی، پایگاه داده PostgreSQL"],
            ["اتصال سامانه مؤدیان", "صورتحساب الکترونیکی، امضای دیجیتال و ارسال خودکار"],
            ["اتصال سیلو/کارخانه", "دریافت berat باسکول و نتیجه آزمایشگاه از API"],
            ["نسخه آفلاین اندروید", "همین موتور و اسناد، روی دستگاه و بدون اینترنت"],
          ].map(([title, detail], index) => (
            <div key={title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
              <span className="mb-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-mint-300/10 text-[8px] font-bold text-mint-300">{toPersianDigits(index + 1)}</span>
              <h3 className="text-[9px] font-medium text-[#d7e7de]">{title}</h3>
              <p className="mt-0.5 text-[7px] font-light leading-4 text-[#78968a]">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3 text-[8px] text-[#718e81]">
        <span className="flex items-center gap-1.5"><Scale className="h-3 w-3 text-mint-300" /> موتور معامله {toPersianDigits("1.0.0")} · اسناد {toPersianDigits("1.0")}</span>
        <span className="flex items-center gap-1.5"><CircleCheck className="h-3 w-3 text-mint-300" /> این صفحه با هر تغییر، آزمون‌ها را دوباره اجرا می‌کند.</span>
      </div>
    </div>
  );
}
