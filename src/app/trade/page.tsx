import Link from "next/link";
import { Amount, Card, Disclosure, EmptyState, Icon, PageHeader, Progress, StatCard } from "@/components/ui";
import { formatDate, formatMoneyWords, formatNumber } from "@/lib/format";
import { TRADE_MODE_META, TRADE_STATUS_META, calcHeadline, type TradeCalc, type TradeStatus } from "@/lib/trade/engine";
import { balanceOf, getTradeStats, listTrades, progressOf } from "@/lib/trade/service";

import { RecordReceipts } from "@/components/RecordReceipts";
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<TradeStatus, string> = {
  draft: "bg-sand-100 text-[#5b6a5e] border-sand-200",
  confirmed: "bg-amber-50 text-amber-800 border-amber-200",
  settled: "bg-farm-50 text-farm-700 border-farm-200",
  canceled: "bg-red-50 text-red-700 border-red-200",
};

const toman = (value: number) => `${formatNumber(value)} تومان`;

export default async function TradePage({ searchParams }: { searchParams: Promise<{ deleted?: string; error?: string }> }) {
  const sp = await searchParams;
  const [trades, stats] = await Promise.all([listTrades(), getTradeStats()]);
  const lossKg = Math.max(0, stats.netKg - stats.adjustedKg);

  return (
    <div className="space-y-4">
      <PageHeader
        title="معامله و تسویه محصول"
        subtitle="از وزن باسکول و کیفیت آزمایشگاه تا فاکتور رسمی و مانده حساب؛ همه‌چیز با محاسبه شفاف و قابل چاپ."
        icon="wallet"
        actions={
          <>
            <Link href="/trade/new" className="btn btn-primary">
              <Icon name="plus" className="h-4 w-4" />
              معامله جدید
            </Link>
            <Link href="/trade/guide" className="btn">
              <Icon name="book" className="h-4 w-4" />
              راهنمای معامله
            </Link>
          </>
        }
      />

      {sp.deleted ? <div className="rounded-xl border border-farm-200 bg-farm-50 p-3 text-xs text-farm-800">معامله حذف شد.</div> : null}
      {sp.error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{sp.error}</div> : null}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard label="ارزش کل معاملات" value={`${formatNumber(stats.totalToman)} تومان`} hint={formatMoneyWords(stats.totalToman)} icon="receipt" />
        <StatCard label="دریافتی ثبت‌شده" value={`${formatNumber(stats.paidToman)} تومان`} hint={formatMoneyWords(stats.paidToman)} tone="farm" icon="check" />
        <StatCard label="مانده طلب از خریداران" value={`${formatNumber(stats.balanceToman)} تومان`} hint={`${formatNumber(stats.openCount)} معامله باز`} tone="clay" icon="wallet" />
        <StatCard label="افت وزنی کل" value={`${formatNumber(lossKg)} کیلوگرم`} hint={`میانگین کیفیت ${stats.avgScore} از ۱۰۰` + (stats.rejected ? ` · ${stats.rejected} رد شده` : "")} tone="slate" icon="chart" />
      </div>

      <Card className="card-pad">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">مسیر کار در چهار گام</h2>
          <span className="chip">{formatNumber(stats.count)} معامله ثبت‌شده</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["۱", "وزن و کیفیت", "وزن پر و خالی باسکول + رطوبت، ناخالصی، شکسته و هکتولیتر را وارد کنید."],
            ["۲", "محاسبه شفاف", "افت‌ها، درجه کیفی، قیمت، کارمزد، مالیات و مانده به‌صورت مرحله‌به‌مرحله محاسبه می‌شود."],
            ["۳", "اسناد رسمی", "قرارداد، قبض باسکول، صورتجلسه کیفیت، فاکتور و برگه تسویه با سریال و QR."],
            ["۴", "تسویه و پیگیری", "دریافتی‌ها را ثبت کنید؛ مانده، سررسید و خسارت تأخیر پایش می‌شود."],
          ].map(([n, title, text]) => (
            <div key={n} className="rounded-xl border border-[#eee9dc] bg-sand-50 p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-farm-700 text-[11px] font-bold text-white">{n}</span>
                <span className="text-xs font-bold text-farm-900">{title}</span>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-[#6a7a6d]">{text}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eee9dc] px-4 py-3">
          <h2 className="section-title">فهرست معاملات</h2>
          <div className="flex items-center gap-1.5 text-[11px] text-[#84907f]">
            <Icon name="lock" className="h-3.5 w-3.5" />
            هر سند سریال یکتا دارد و در نسخه چاپ، همان اعداد ثبت‌شده بازتولید می‌شود.
          </div>
        </div>
        {trades.length === 0 ? (
          <div className="p-4">
            <EmptyState title="هنوز معامله‌ای ثبت نشده است" hint="با ثبت وزن و کیفیت گندم، مبلغ تسویه و اسناد رسمی به‌صورت خودکار ساخته می‌شود." />
            <div className="mt-3 text-center">
              <Link href="/trade/new" className="btn btn-primary">
                <Icon name="plus" className="h-4 w-4" />
                ثبت اولین معامله
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>سریال / تاریخ</th>
                  <th>محصول و نوع</th>
                  <th>طرفین</th>
                  <th>وزن خالص</th>
                  <th>کیفیت</th>
                  <th>مبلغ و مانده</th>
                  <th>وضعیت</th>
                      <th>رسید</th>
                      <th />
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => {
                  const status = trade.status as TradeStatus;
                  return (
                    <tr key={trade.id} className="hover:bg-sand-50/60">
                      <td>
                        <span className="num block text-[11px] font-bold text-farm-900">{trade.code}</span>
                        <span className="block text-[10px] text-[#84907f]">{formatDate(trade.contractDate)}</span>
                      </td>
                      <td>
                        <span className="block text-xs font-semibold">{trade.cropName}</span>
                        <span className="block text-[10px] text-[#84907f]">{TRADE_MODE_META[trade.mode as keyof typeof TRADE_MODE_META]?.badge ?? trade.mode}</span>
                      </td>
                      <td>
                        <span className="block text-[11px]">{trade.sellerName}</span>
                        <span className="block text-[10px] text-[#84907f]">← {trade.buyerName}</span>
                      </td>
                      <td className="num text-[11px]">
                        {formatNumber(trade.adjustedKg)} kg
                        <span className="block text-[10px] text-[#84907f]">خالص {formatNumber(trade.netKg)}</span>
                      </td>
                      <td>
                        <span className="block text-[11px]">{trade.gradeLabel}</span>
                        <span className="block text-[10px] text-[#84907f]">{calcHeadline(trade.calc as unknown as TradeCalc)}</span>
                      </td>
                      <td>
                        <Amount value={trade.totalToman} showWords={false} />
                        <span className="block text-[10px] text-[#84907f]">مانده: {toman(balanceOf(trade))}</span>
                        <div className="mt-1 w-24">
                          <Progress value={progressOf(trade) / 100} tone={progressOf(trade) >= 100 ? "farm" : "clay"} />
                        </div>
                      </td>
                      <td>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[status] ?? STATUS_TONE.draft}`}>
                          {TRADE_STATUS_META[status]?.label ?? status}
                        </span>
                      </td>
                      <td>
                        <Link href={`/trade/${trade.id}`} className="btn btn-sm">
                          جزئیات
                          <Icon name="arrow" className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="card-pad">
          <h2 className="section-title">چه سندهایی صادر می‌شود؟</h2>
          <ul className="mt-2 space-y-2 text-[11px] leading-5 text-[#4a5a4c]">
            <li>• <strong>قرارداد فروش محصول:</strong> طرفین، مقدار، کیفیت، قیمت، کسورات، شرایط پرداخت و امضا.</li>
            <li>• <strong>قبض باسکول و رسید تحویل:</strong> وزن پر/خالی/خالص، پلاک خودرو، راننده و تحویل‌گیرنده.</li>
            <li>• <strong>صورتجلسه کیفیت:</strong> رطوبت، ناخالصی، شکسته، سن‌زدگی، هکتولیتر و درجه.</li>
            <li>• <strong>فاکتور و برگه تسویه:</strong> ارزش محصول، کسورات، مالیات، مبلغ به حروف، دریافتی‌ها و مانده.</li>
          </ul>
          <p className="mt-2 rounded-lg bg-sand-50 px-2 py-1.5 text-[10px] leading-5 text-[#6a7a6d]">
            اسناد با کد QR و صفحه «استعلام اصالت» صادر می‌شوند؛ هر سند فقط یک‌بار شماره سریال می‌گیرد و چاپ مجدد همان نسخه است.
          </p>
        </Card>

        <Card className="card-pad">
          <h2 className="section-title">مبنای قانونی و احتیاط‌ها</h2>
          <Disclosure title="استانداردهای خرید گندم و کسورات" defaultOpen>
            <ul className="space-y-1.5 text-[11px] leading-5 text-[#4a5a4c]">
              <li>• رطوبت مجاز تحویل گندم در خرید تضمینی حداکثر ۱۴٪ است؛ رطوبت بیشتر نیازمند خشک‌کردن یا مشمول افت است.</li>
              <li>• در خرید تضمینی، افت مفید ۳٪ و افت غیرمفید ۱٪ به‌عنوان کسورات استاندارد اعمال می‌شود (پیش‌تنظیم «خرید تضمینی»).</li>
              <li>• ناخالصی بیش از حد مجاز به‌صورت وزنی کسر می‌شود؛ ناخالصی بسیار بالا موجب رد محصول است.</li>
              <li>• درجه‌بندی گندم بر پایه وزن هکتولیتر (درجه یک ≥ ۷۸)، رطوبت، ناخالصی، دانه شکسته و سن‌زدگی انجام می‌شود.</li>
              <li>• محصولات کشاورزی فرآوری‌نشده طبق بند (الف) ماده ۹ قانون مالیات بر ارزش افزوده ۱۴۰۰ معاف از مالیات‌اند.</li>
            </ul>
          </Disclosure>
          <Disclosure title="نرخ خرید تضمینی و نرخ‌نامه">
            <p className="text-[11px] leading-5 text-[#4a5a4c]">
              نرخ‌های پیش‌فرض این سامانه «قابل ویرایش» هستند و مبنای قطعی محسوب نمی‌شوند. نرخ خرید تضمینی هر سال با مصوبه شورای قیمت‌گذاری
              محصولات اساسی کشاورزی اعلام می‌شود و ممکن است بر اساس درجه کیفی، حق بیمه و شرایط استان متفاوت باشد. پیش از امضای قرارداد،
              آخرین ابلاغیه را در فرم وارد کنید. سامانه اگر قیمت بیش از ۵٪ پایین‌تر از نرخ مرجع باشد هشدار می‌دهد.
            </p>
          </Disclosure>
          <Disclosure title="نکته درباره اسناد رسمی">
            <p className="text-[11px] leading-5 text-[#4a5a4c]">
              اسناد این بخش برای «معامله و تسویه داخلی» طراحی شده‌اند و مانند هر قرارداد خصوصی، با امضای طرفین و رعایت شرایط قانونی قابل
              استناد هستند. برای معاملات دولتی، فرم‌های ابلاغی سیلو/کارخانه و مهر و امضای رسمی الزامی است. فاکتور مالیاتی باید با سامانه
              مؤدیان و اطلاعات هویتی صحیح صادر شود.
            </p>
          </Disclosure>
        </Card>
      </div>

    </div>
  );
}
