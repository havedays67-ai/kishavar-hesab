import Link from "next/link";
import { getFarmOverview, getSeedFlag } from "@/lib/data";
import { formatMoney, formatNumber } from "@/lib/format";
import { Badge, Card, Icon, PageHeader, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [o, seeded] = await Promise.all([getFarmOverview(), getSeedFlag()]);
  const aiProvider =
    process.env.OPENAI_API_KEY
      ? "OpenAI (فعال)"
      : process.env.OPENROUTER_API_KEY
        ? "OpenRouter (فعال)"
        : process.env.GROQ_API_KEY
          ? "Groq (فعال)"
          : "موتور محلی داخلی (بدون کلید خارجی)";

  const rows: { label: string; value: string }[] = [
    { label: "سطح زیرکشت", value: `${formatNumber(o.totals.landArea, 1)} هکتار` },
    { label: "تعداد کشت‌ها", value: formatNumber(o.cropStats.length) },
    { label: "ارزش انبار", value: `${formatMoney(Math.round(o.totals.inventoryValue))}` },
    { label: "بدهی تسویه‌نشده", value: `${formatMoney(o.totals.payable)}` },
    { label: "طلب وصول‌نشده", value: `${formatMoney(o.totals.receivable)}` },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="تنظیمات و درباره نرم‌افزار" subtitle="وضعیت داده‌ها، هوش مصنوعی، نسخه اندروید و راهنمای نصب." icon="settings" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="وضعیت پایگاه داده" value={seeded ? "آماده" : "در حال راه‌اندازی"} tone={seeded ? "farm" : "red"} icon="check" />
        <StatCard label="موتور هوش" value={aiProvider} tone="slate" icon="sparkles" />
        <StatCard label="حالت‌های هوش" value="پشتیبان + دستیار" tone="farm" icon="bolt" />
        <StatCard label="نسخه" value="1.0.0" tone="clay" icon="settings" hint="وب و اندروید ۸ به بالا" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="card-pad">
          <h2 className="section-title mb-2">خلاصه داده‌های مزرعه</h2>
          <dl className="space-y-2 text-xs">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between border-b border-[#f3efe5] pb-1.5">
                <dt className="text-[#7c8a7f]">{r.label}</dt>
                <dd className="num font-semibold text-[#2b3a2e]">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] leading-6 text-[#7c8a7f]">
            داده‌ها در PostgreSQL روی سرور خودتان ذخیره می‌شوند؛ هیچ داده‌ای برای آموزش مدل بیرونی ارسال نمی‌شود. برای پشتیبان‌گیری، از دیتابیس نسخه
            پشتیبان بگیرید.
          </p>
        </Card>

        <Card className="card-pad">
          <h2 className="section-title mb-2">هوش مصنوعی و محدوده دسترسی</h2>
          <ul className="space-y-2 text-[11px] leading-6 text-[#4a5a4c]">
            <li className="flex gap-2">
              <Icon name="check" className="mt-1 h-3.5 w-3.5 shrink-0 text-farm-600" />
              موتور محلی پاسخ‌گویی: تحلیل داده‌های همین نرم‌افزار + پایگاه دانش کشاورزی (بدون توهم عددی).
            </li>
            <li className="flex gap-2">
              <Icon name="lock" className="mt-1 h-3.5 w-3.5 shrink-0 text-farm-600" />
              دستیار اجازه نوشتن دارد اما فقط از طریق موتور امن سرور؛ پیش از هر ثبت، خلاصه را نشان می‌دهد و تأیید می‌گیرد.
            </li>
            <li className="flex gap-2">
              <Icon name="book" className="mt-1 h-3.5 w-3.5 shrink-0 text-farm-600" />
              حالت پشتیبان هیچ مسیر نوشتن ندارد؛ فقط آموزش، راهنما و گزارش.
            </li>
            <li className="flex gap-2">
              <Icon name="bolt" className="mt-1 h-3.5 w-3.5 shrink-0 text-farm-600" />
              یادگیری تدریجی: از الگوی هزینه‌ها، طرف‌حساب‌ها و هشدارهای مزرعه یادداشت می‌سازد و در پاسخ‌های بعدی استفاده می‌کند.
            </li>
          </ul>
          <p className="mt-3 rounded-xl bg-sand-50 p-2.5 text-[10px] leading-5 text-[#7c8a7f]">
            ارتقای هوش با مدل زبانی: متغیرهای محیطی <span className="num">OPENAI_API_KEY</span> یا <span className="num">OPENROUTER_API_KEY</span> یا{" "}
            <span className="num">GROQ_API_KEY</span> را تنظیم کنید؛ داده مزرعه به‌عنوان زمینه ارسال می‌شود و پاسخ همیشه بر پایه موتور محلی اعتبارسنجی می‌شود.
          </p>
        </Card>
      </div>

      <Card className="card-pad">
        <h2 className="section-title mb-2">نسخه اندروید و نصب روی گوشی</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#f0ebdd] p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-farm-900">
              <Icon name="phone" className="h-4 w-4" />
              نصب سریع به‌صورت PWA
            </p>
            <p className="mt-1.5 text-[11px] leading-6 text-[#5b6a5e]">
              در مرورگر کروم گوشی، منوی سه‌نقطه ← «افزودن به صفحه اصلی». نرم‌افزار مثل اپ باز می‌شود، آیکون اختصاصی دارد و برای گوشی‌های ۶ گیگ رم سبک
              طراحی شده است.
            </p>
          </div>
          <div className="rounded-xl border border-[#f0ebdd] p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-farm-900">
              <Icon name="box" className="h-4 w-4" />
              فایل APK (اندروید ۸ و بالاتر)
            </p>
            <p className="mt-1.5 text-[11px] leading-6 text-[#5b6a5e]">
              بسته اندروید با Capacitor ساخته می‌شود؛ شرط minSdk = 26 (اندروید ۸). فایل نهایی و مشخصات کلید امضا در صفحه اصلی مخزن گیت‌هاب پروژه درج شده
              است.
            </p>
            <a
              href="https://github.com/havedays67-ai/kishavar-hesab/releases/download/apk-v1.0.2/KishavarHesab-1.0.0.apk"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-farm-700 px-3 py-2 text-[11px] font-bold text-white"
            >
              <Icon name="box" className="h-3.5 w-3.5" />
              دانلود مستقیم APK (۳.۹ مگابایت)
            </a>
            <a
              href="https://github.com/havedays67-ai/kishavar-hesab"
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-farm-700 hover:underline"
            >
              <Icon name="arrow" className="h-3.5 w-3.5" />
              مخزن عمومی پروژه و مشخصات کلید امضا
            </a>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-[10px] text-[#7c8a7f] sm:grid-cols-3">
          <span className="chip">شناسه بسته: ir.kishavarhesab.app</span>
          <span className="chip">حداقل اندروید: ۸ (API 26)</span>
          <span className="chip">معماری: Next.js + PostgreSQL</span>
        </div>
      </Card>

      <Card className="card-pad">
        <h2 className="section-title mb-2">راهنمای بخش‌ها</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: "/lands", label: "زمین و کشت", desc: "قطعات، کشت‌ها، سود هر قطعه" },
            { href: "/transactions", label: "دفتر عملیات", desc: "ثبت هزینه و درآمد با دسته و زمین" },
            { href: "/inventory", label: "انبار نهاده", desc: "موجودی، نقطه سفارش، خروج نهاده" },
            { href: "/labor", label: "کارگر و دستمزد", desc: "نفر-روز و تسویه دستمزد" },
            { href: "/equipment", label: "ماشین‌آلات", desc: "استهلاک خط مستقیم و ارزش دفتری" },
            { href: "/finance", label: "بدهی و چک", desc: "سررسیدها و نقدینگی" },
            { href: "/reports", label: "گزارش‌ها", desc: "سود و زیان، بهای تمام‌شده" },
            { href: "/assistant", label: "هوش مصنوعی", desc: "پشتیبان و دستیار" },
            { href: "/knowledge", label: "پایگاه دانش", desc: "آموزش حسابداری کشاورزی" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl border border-[#f0ebdd] p-3 transition hover:bg-farm-50">
              <p className="text-xs font-bold text-farm-900">{item.label}</p>
              <p className="mt-0.5 text-[10px] text-[#7c8a7f]">{item.desc}</p>
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="green">داده نمونه قابل ویرایش</Badge>
          <Badge tone="blue">رابط راست‌به‌چپ و موبایل‌محور</Badge>
          <Badge tone="amber">بدون کتابخانه سنگین نمودار</Badge>
        </div>
      </Card>
    </div>
  );
}
