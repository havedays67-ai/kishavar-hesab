import Link from "next/link";
import { Card, Icon, PageHeader } from "@/components/ui";
import { CROP_SPECS } from "@/lib/trade/engine";
import { formatNumber } from "@/lib/format";

export const metadata = {
  title: "راهنمای معامله محصول | کشاورزحساب",
  description: "مبنای محاسبه وزن، افت رطوبت و ناخالصی، درجه‌بندی گندم، مالیات، اسناد رسمی و چاپ اداری",
};

const STEPS: { title: string; text: string; icon: string }[] = [
  { title: "۱. تغیین نوع معامله", text: "خرید تضمینی (سیلو/دولت) یا قرارداد با کارخانه یا توافقی. هر انتخاب، پیش‌تنظیم کسورات و نرخ‌ها را تغییر می‌دهد.", icon: "land" },
  { title: "۲. ثبت وزن باسکول", text: "وزن پر، وزن خالی و خالص را از قبض باسکول وارد کنید. اگر تناژ را می‌دانید، واحد (کیلوگرم/تن/خروار) را انتخاب کنید.", icon: "tractor" },
  { title: "۳. ثبت کیفیت آزمایشگاه", text: "رطوبت، ناخالصی، دانه شکسته، سن‌زدگی، وزن هکتولیتر و پروتئین. سامانه درجه و افت‌ها را محاسبه می‌کند.", icon: "chart" },
  { title: "۴. تأیید مالی و صدور سند", text: "قیمت، کارمزد، کرایه، مالیات و سررسید را تأیید کنید؛ پنج سند رسمی با شماره سریال و QR صادر می‌شود.", icon: "receipt" },
];

export default function TradeGuidePage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="راهنمای معامله و تسویه محصول"
        subtitle="هرچه پیش از فروش گندم، جو یا هر محصول دیگر باید بدانید — از فرمول افت تا سند قابل چاپ."
        icon="book"
        actions={
          <Link href="/trade/new" className="btn btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            ثبت معامله
          </Link>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step) => (
          <Card key={step.title} className="card-pad">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-farm-50 text-farm-700">
              <Icon name={step.icon} className="h-4.5 w-4.5" />
            </span>
            <h2 className="mt-2 text-xs font-bold text-farm-900">{step.title}</h2>
            <p className="mt-1 text-[11px] leading-5 text-[#5b6a5e]">{step.text}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="card-pad">
          <h2 className="section-title">فرمول‌های دقیق محاسبه</h2>
          <div className="mt-2 space-y-2 text-[11px] leading-6 text-[#3d4c41]">
            <Formula title="وزن خالص">
              وزن خالص = وزن پر (با بار) − وزن خالی (خودرو). اگر تناژ وارد شود: وزن خالص = مقدار × ضریب واحد
              (کیلوگرم ۱، تن ۱۰۰۰، خروار ۳۰۰).
            </Formula>
            <Formula title="افت رطوبت (روش وزنی استاندارد)">
              درصد افت = (رطوبت اندازه‌گیری‌شده − رطوبت پایه) ÷ (۱۰۰ − رطوبت پایه) × ۱۰۰
              <br />
              نمونه: رطوبت ۱۶٪ و پایه ۱۴٪ → (۲ ÷ ۸۶) × ۱۰۰ ≈ ۲٫۳۳٪ افت وزنی.
            </Formula>
            <Formula title="افت رطوبت (روش توافقی)">
              درصد افت = (رطوبت اندازه‌گیری‌شده − رطوبت پایه) × ضریب توافقی هر واحد (مثلاً ۱٫۲).
            </Formula>
            <Formula title="افت ناخالصی مازاد">
              درصد افت = ناخالصی اندازه‌گیری‌شده − ناخالصی مجاز؛ سپس به‌صورت وزنی یک‌به‌یک کسر می‌شود. ناخالصی بیش از سقف، موجب رد
              محصول است.
            </Formula>
            <Formula title="وزن تعدیل‌شده و ارزش محصول">
              وزن تعدیل‌شده = وزن خالص − (افت مفید + افت غیرمفید + افت رطوبت + افت ناخالصی + افت شکسته)
              <br />
              ارزش محصول = وزن تعدیل‌شده × قیمت هر کیلوگرم (پس از تعدیل درجه)
            </Formula>
            <Formula title="مبلغ قابل تسویه">
              مبلغ = ارزش محصول + حق بیمه + مالیات − کارمزد − کرایه و هزینه‌های فروشنده − خسارت تأخیر ± تعدیل توافقی
              <br />
              سپس به مضرب توافق‌شده (مثلاً هزار تومان) گرد می‌شود.
            </Formula>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="card-pad">
            <h2 className="section-title">استانداردها و مبانی حقوقی</h2>
            <ul className="mt-2 space-y-2 text-[11px] leading-6 text-[#3d4c41]">
              <li><strong>رطوبت گندم:</strong> حداکثر ۱۴٪ در تحویل به مراکز خرید تضمینی. رطوبت بیشتر نیازمند خشک‌کردن است و در قرارداد آزاد مشمول افت می‌شود.</li>
              <li><strong>افت استاندارد خرید تضمینی:</strong> ۳٪ افت مفید و ۱٪ افت غیرمفید؛ در پیش‌تنظیم «خرید تضمینی» اعمال می‌شود و قابل تغییر است.</li>
              <li><strong>ناخالصی:</strong> حد مجاز معمول ۲٪؛ مازاد به‌صورت وزنی کسر می‌شود.</li>
              <li><strong>درجه‌بندی گندم:</strong> وزن هکتولیتر (درجه یک ≥ ۷۸، درجه دو ≥ ۷۵، درجه سه ≥ ۷۲ کیلوگرم بر هکتولیتر)، رطوبت، ناخالصی، دانه شکسته و سن‌زدگی.</li>
              <li><strong>مالیات بر ارزش افزوده:</strong> محصولات کشاورزی فرآوری‌نشده طبق بند (الف) ماده ۹ قانون مالیات بر ارزش افزوده ۱۴۰۰ معاف‌اند؛ نرخ پیش‌فرض صفر و قابل تنظیم است.</li>
              <li><strong>اعتبار قرارداد:</strong> مستند به ماده ۱۰ قانون مدنی، توافق طرفین در حدود قوانین نافذ است؛ امضا، تاریخ، مشخصات هویتی و پیوست‌های وزن و کیفیت الزامی است.</li>
              <li><strong>حق بیمه محصول:</strong> در خرید تضمینی، مبلغی به‌ازای هر کیلوگرم به نرخ اضافه می‌شود؛ آن را در فیلد «حق بیمه» وارد کنید.</li>
            </ul>
          </Card>

          <Card className="card-pad bg-sand-50">
            <h2 className="section-title">چک‌لیست پیش از امضا</h2>
            <ul className="mt-2 space-y-1 text-[11px] leading-5 text-[#4a5a4c]">
              <li>• نام و کد ملی/شناسه ملی دو طرف در سند درست است؟</li>
              <li>• قبض باسکول و صورتجلسه کیفیت پیوست شده است؟</li>
              <li>• نرخ با آخرین ابلاغیه شورای قیمت‌گذاری تطبیق داده شده؟</li>
              <li>• کرایه، تخلیه و کارمزد بر عهده چه کسی است و در سند آمده؟</li>
              <li>• سررسید پرداخت و نرخ خسارت تأخیر مشخص است؟</li>
              <li>• مبلغ به حروف با مبلغ عددی مطابقت دارد؟</li>
              <li>• وضعیت مالیات (معاف/مشمول) با نوع محصول هم‌خوان است؟</li>
            </ul>
          </Card>
        </div>
      </div>

      <Card className="card-pad">
        <h2 className="section-title">پیش‌فرض کیفیت محصولات</h2>
        <p className="mt-1 text-[11px] leading-5 text-[#6a7a6d]">این مقادیر فقط پیش‌فرض راهنما هستند و در فرم معامله قابل ویرایش‌اند.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>محصول</th>
                <th>گروه</th>
                <th>رطوبت پایه / سقف</th>
                <th>ناخالصی مجاز / سقف</th>
                <th>هکتولیتر</th>
                <th>نرخ پیش‌فرض (تومان/کیلو)</th>
              </tr>
            </thead>
            <tbody>
              {CROP_SPECS.map((crop) => (
                <tr key={crop.key}>
                  <td className="text-xs font-medium">{crop.name}</td>
                  <td className="text-[11px] text-[#6a7a6d]">{crop.category}</td>
                  <td className="num text-[11px]">{crop.baseMoisturePct}٪ / {crop.maxMoisturePct}٪</td>
                  <td className="num text-[11px]">{crop.allowedForeignPct}٪ / {crop.maxForeignPct}٪</td>
                  <td className="text-[11px]">{crop.usesHectoliter ? "دارد" : "—"}</td>
                  <td className="num text-[11px]">{formatNumber(crop.defaultPricePerKgToman)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="card-pad">
        <h2 className="section-title">چاپ اداری و نگهداری اسناد</h2>
        <div className="mt-2 grid gap-2 text-[11px] leading-6 text-[#3d4c41] sm:grid-cols-2">
          <p>
            هر سند در قالب A4، با سرصفحه هویتی فروشنده، عنوان سند، شماره سریال یکتا، تاریخ شمسی، متن تعهدات، جدول مالی و سه محل امضا
            (فروشنده، خریدار، ناظر/باسکول) طراحی شده است. با دکمه «چاپ / ذخیره PDF» می‌توانید نسخه رسمی را ذخیره و بایگانی کنید.
          </p>
          <p>
            سند در اولین بازدید شماره سریال می‌گیرد و تصویر لحظه صدور آن در پایگاه داده ذخیره می‌شود؛ بنابراین چاپ مجدد، همان اعداد و همان
            سریال را نشان می‌دهد. کد QR به صفحه استعلام اصالت وصل است و برای دریافت‌کننده سند قابل بررسی است.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Formula({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#eee9dc] bg-sand-50 p-2">
      <strong className="block text-[11px] text-farm-900">{title}</strong>
      <p className="text-[10.5px] leading-6 text-[#4a5a4c]">{children}</p>
    </div>
  );
}
