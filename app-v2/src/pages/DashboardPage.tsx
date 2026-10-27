import {
  ArrowLeft,
  ArrowUpLeft,
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Landmark,
  Leaf,
  MapPin,
  Printer,
  Receipt,
  Scale,
  ShieldCheck,
  Sprout,
  TrendingUp,
  Truck,
  Wallet,
  Wheat,
} from "lucide-react";
import { cn } from "../utils/cn";
import { CONTRACT_TYPES, MY_BUSINESS, type Page, type SavedContract } from "../lib/data";
import { formatJalali, formatNumber, toPersianDigits, todayJalali } from "../lib/format";
import { PRODUCT_PROFILES, tradeBalance, type CropTrade } from "../lib/trade";
import { plotMetrics, type CropPlot } from "../lib/samples";
import { Avatar } from "../components/ui";
import { makeDocument, type DocumentSpec } from "../lib/documents";

const fa = (value: number) => toPersianDigits(formatNumber(Math.round(value)));
const money = (value: number) => `${fa(value)} تومان`;

export function DashboardPage({
  contracts,
  trades,
  plots,
  onNavigate,
  onOpenDocument,
}: {
  contracts: SavedContract[];
  trades: CropTrade[];
  plots: CropPlot[];
  onNavigate: (page: Page) => void;
  onOpenDocument: (spec: DocumentSpec) => void;
}) {
  const today = todayJalali();
  const saleValue = trades.reduce((sum, trade) => sum + trade.result.netReceipt, 0);
  const remaining = trades.reduce((sum, trade) => sum + tradeBalance(trade).remaining, 0);
  const productionCost = plots.reduce((sum, plot) => sum + plotMetrics(plot).cost, 0);
  const grossGap = saleValue - productionCost;
  const activeContracts = contracts.filter((contract) => contract.status === "active");
  const payableKg = trades.reduce((sum, trade) => sum + trade.result.payableKg, 0);
  const avgPrice = payableKg > 0 ? saleValue / payableKg : 0;
  const recentTrades = [...trades].sort((a, b) => (a.date.jy === b.date.jy ? (a.date.jm === b.date.jm ? b.date.jd - a.date.jd : b.date.jm - a.date.jm) : b.date.jy - a.date.jy)).slice(0, 3);
  const maxPlotRevenue = Math.max(...plots.map((plot) => plotMetrics(plot).revenue), 1);

  const tasks = [
    remaining > 0 ? { title: `پیگیری ${money(remaining)} مانده خریداران`, detail: "در بخش معاملات، تسویه را ثبت کنید.", icon: Receipt, tone: "sand", page: "trade" as Page } : null,
    trades.some((trade) => trade.status === "draft") ? { title: "تأیید پیش‌نویس‌های معامله", detail: "پیش‌نویس را بازبینی و نهایی کنید.", icon: ClipboardCheck, tone: "mint", page: "trade" as Page } : null,
    contracts.some((contract) => contract.status === "pending") ? { title: "تکمیل قرارداد زمین در انتظار امضا", detail: "طرف قرارداد و شرایط مالی را بررسی کنید.", icon: Landmark, tone: "mint", page: "contracts" as Page } : null,
    trades.length > 0 ? { title: "چاپ و بایگانی اسناد آخرین محموله", detail: "قرارداد، باسکول، کیفیت، فاکتور و تسویه.", icon: Printer, tone: "sand", page: "documents" as Page } : null,
    { title: "تطبیق نرخ روز خرید تضمینی", detail: "نرخ مرجع ۱۴۰۵: ۴۹٬۵۰۰ تومان با افت ۳+۱.", icon: ShieldCheck, tone: "mint", page: "trade" as Page },
  ].filter(Boolean) as { title: string; detail: string; icon: typeof Receipt; tone: string; page: Page }[];

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]">
            <CalendarDays className="h-3.5 w-3.5 text-mint-300" />
            {formatJalali(today, "weekday")}
            <span className="h-1 w-1 rounded-full bg-[#648173]" />
            نمای کلی مزرعه
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">پیشخوان مزرعه</h1>
          <p className="mt-1.5 text-[11px] font-light text-[#89a598]">هر تصمیم، یک عدد دقیق و یک سند قابل پیگیری.</p>
        </div>
        <button type="button" onClick={() => onNavigate("trade")} className="flex items-center justify-center gap-2 rounded-xl bg-mint-400 px-4 py-2.5 text-[10px] font-bold text-[#07110d] transition hover:bg-mint-300">
          <Scale className="h-3.5 w-3.5" />
          محاسبه فروش محصول
        </button>
      </div>

      <section className="relative mb-5 overflow-hidden rounded-[24px] border border-[#527a52]/25 bg-gradient-to-br from-[#1a3d2a] via-[#123021] to-[#0c2018] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.19)] sm:p-7">
        <div className="grid-texture pointer-events-none absolute inset-0 opacity-30" />
        <div className="pointer-events-none absolute -left-10 -top-20 h-72 w-72 rounded-full bg-[#8bc46d]/10 blur-3xl" />
        <Wheat className="pointer-events-none absolute -bottom-12 left-5 h-60 w-60 rotate-[-16deg] text-[#dbeab0]/[0.045] sm:left-16" strokeWidth={0.8} />
        <div className="relative max-w-[660px]">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-[#c5df9c]/20 bg-[#cadfa6]/[0.08] px-2.5 py-1 text-[9px] text-[#d2e8b2]"><MapPin className="h-3 w-3" />{MY_BUSINESS.farm}</span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] text-[#b5cbbd]"><Leaf className="h-3 w-3 text-mint-300" />فصل زراعی ۱۴۰۵–۱۴۰۶</span>
          </div>
          <h2 className="text-lg font-extrabold leading-8 text-[#f1f7eb] sm:text-2xl sm:leading-10">
            سلام محمدرضا؛
            <br />
            <span className="text-[#d7e8ad]">این بار همه‌چیز حساب‌شده است.</span>
          </h2>
          <p className="mt-2.5 max-w-xl text-[10px] font-light leading-6 text-[#a7c0af] sm:text-[11px]">
            گندم‌ات را به کارخانه می‌فروشی؟ وزن، رطوبت، افت مفید و غیرمفید، هکتولیتر و پروتئین را وارد کن تا وزن قابل
            پرداخت، درجه کیفی و خالص دریافتی را ببینی؛ بعد با یک کلیک اسناد رسمی و قابل چاپ بساز.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={() => onNavigate("trade")} className="flex items-center gap-2 rounded-xl bg-[#d1e8ab] px-4 py-2.5 text-[10px] font-bold text-[#19331f] transition hover:bg-[#e1f3c2]">
              <Wheat className="h-3.5 w-3.5" />
              فروش گندم را حساب کن
              <ArrowLeft className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => onNavigate("contracts")} className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-[10px] text-[#d6e6db] transition hover:bg-white/[0.09]">
              <FileText className="h-3.5 w-3.5" />
              قرارداد زمین
            </button>
            <button type="button" onClick={() => onNavigate("documents")} className="flex items-center gap-2 px-2 py-2.5 text-[10px] text-[#bcd3c3] transition hover:text-white">
              <Printer className="h-3.5 w-3.5" />
              اسناد و چاپ
            </button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/10 pt-3.5 text-[9px] text-[#aac0ae]">
            <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-[#c4e49a]" /> افت ۳+۱ طبق مصوبه ۱۴۰۵</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#c4e49a]" /> تاریخ شمسی</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#c4e49a]" /> محاسبه قابل حسابرسی</span>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-3 gap-2 border-t border-white/[0.09] pt-4 lg:absolute lg:bottom-6 lg:left-6 lg:mt-0 lg:w-[290px] lg:border-0 lg:pt-0">
          {[
            ["فروش خالص", fa(saleValue)],
            ["هزینه تولید", fa(productionCost)],
            ["ودیعه‌ها", fa(contracts.reduce((sum, contract) => sum + contract.deposit, 0))],
          ].map(([label, value], index) => (
            <div key={label} className={cn("text-center lg:text-right", index > 0 && "border-r border-white/[0.09] pr-2")}>
              <div className="truncate text-[12px] font-bold text-[#e6f1e7] sm:text-sm">{value}</div>
              <div className="mt-0.5 text-[8px] font-light text-[#92ae9c]">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        {[
          { label: "فروش خالص محصول", period: `${toPersianDigits(trades.length)} محموله`, value: fa(saleValue), unit: "تومان", change: "+ ثبت‌شده", icon: Receipt, tone: "mint" },
          { label: "اختلاف فروش و بهای تولید", period: "قبل از هزینه فروش", value: fa(grossGap), unit: "تومان", change: grossGap >= 0 ? "سود ناخالص" : "زیان", icon: TrendingUp, tone: grossGap >= 0 ? "mint" : "bad" },
          { label: "مانده دریافتنی", period: "از خریداران", value: fa(remaining), unit: "تومان", change: remaining > 0 ? "نیازمند پیگیری" : "تسویه", icon: Wallet, tone: remaining > 0 ? "sand" : "mint" },
          { label: "قرارداد زمین", period: `${toPersianDigits(activeContracts.length)} فعال`, value: toPersianDigits(contracts.length), unit: "قرارداد", change: "جاری", icon: FileText, tone: "neutral" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass rounded-2xl p-3.5 sm:p-4">
              <div className="mb-3 flex items-start justify-between">
                <span className={cn("grid h-8 w-8 place-items-center rounded-[10px] border", stat.tone === "mint" ? "border-mint-300/15 bg-mint-300/[0.07] text-mint-300" : stat.tone === "sand" ? "border-sand-300/15 bg-sand-300/[0.07] text-sand-300" : stat.tone === "bad" ? "border-[#a25649]/20 bg-[#a25649]/10 text-[#efad9f]" : "border-white/10 bg-white/[0.04] text-[#a8c0b4]")}>
                  <Icon className="h-4 w-4" strokeWidth={1.7} />
                </span>
                <span className={cn("rounded border px-1.5 py-0.5 text-[8px]", stat.tone === "bad" ? "border-[#a25649]/15 text-[#efad9f]" : "border-mint-300/10 bg-mint-300/[0.04] text-mint-300/80")}>{stat.change}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={cn("truncate text-base font-bold tracking-tight sm:text-lg", stat.tone === "bad" ? "text-[#efad9f]" : stat.tone === "sand" ? "text-sand-300" : "text-[#edf7f0]")}>{stat.value}</span>
                <span className="shrink-0 text-[8px] font-light text-[#78968a]">{stat.unit}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-1 text-[9px]">
                <span className="text-[#a0b9ad]">{stat.label}</span>
                <span className="hidden text-[8px] text-[#6f8c7f] sm:inline">{stat.period}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <div className="space-y-5">
          <section className="glass overflow-hidden rounded-[22px]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4 sm:px-5">
              <div>
                <h2 className="text-[13px] font-semibold text-white">آخرین معاملات محصول</h2>
                <p className="mt-1 text-[9px] font-light text-[#79968a]">وزن قابل پرداخت، نرخ مؤثر و مانده</p>
              </div>
              <button type="button" onClick={() => onNavigate("trade")} className="flex items-center gap-1 text-[9px] text-mint-300 transition hover:gap-1.5">مشاهده همه<ArrowLeft className="h-3 w-3" /></button>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {recentTrades.map((trade) => {
                const balance = tradeBalance(trade);
                return (
                  <div key={trade.id} className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-white/[0.025] sm:px-5">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-[#a6c2b4]"><Wheat className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[11px] font-medium text-[#e8f3ec]">{PRODUCT_PROFILES[trade.productId].name} — {trade.buyerName}</span>
                        <span className={cn("rounded px-1.5 py-0.5 text-[8px]", trade.status === "settled" ? "bg-mint-300/10 text-mint-300" : trade.status === "draft" ? "bg-white/[0.05] text-[#9fb6aa]" : "bg-sand-300/10 text-sand-300")}>
                          {trade.status === "settled" ? "تسویه" : trade.status === "draft" ? "پیش‌نویس" : "تأییدشده"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[8px] text-[#78968a]">
                        <span>{trade.serial}</span>
                        <span className="h-1 w-1 rounded-full bg-[#4f6b5e]" />
                        <span>{formatJalali(trade.date, "long")}</span>
                        <span className="h-1 w-1 rounded-full bg-[#4f6b5e]" />
                        <span>{trade.result.quality.label} · {fa(trade.result.payableKg)} کیلو</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-left">
                      <div className="text-[10px] font-semibold text-mint-300">{fa(trade.result.netReceipt)}</div>
                      <div className="mt-1 text-[8px] text-[#6f8c7f]">{balance.remaining > 0 ? `مانده ${fa(balance.remaining)}` : "تسویه کامل"}</div>
                    </div>
                    <button type="button" onClick={() => onOpenDocument(makeDocument("sale-invoice", { trade }))} className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[#6f8c7f] transition hover:bg-white/[0.05] hover:text-mint-300" aria-label="چاپ صورت‌حساب">
                      <Printer className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              {recentTrades.length === 0 && (
                <div className="px-5 py-10 text-center text-[10px] text-[#78968a]">هنوز معامله‌ای ثبت نشده است. از ماشین‌حساب شروع کنید.</div>
              )}
            </div>
            <button type="button" onClick={() => onNavigate("trade")} className="flex w-full items-center justify-center gap-1.5 border-t border-white/[0.05] py-2.5 text-[9px] text-[#a8bfb3] transition hover:text-mint-300">
              <Scale className="h-3 w-3" />
              ثبت محموله جدید
            </button>
          </section>

          <section className="glass rounded-[22px] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[13px] font-semibold text-white">عملکرد زمین‌ها</h2>
                <p className="mt-1 text-[9px] font-light text-[#79968a]">درآمد برآوردی هر زمین در برابر هزینه تولید</p>
              </div>
              <button type="button" onClick={() => onNavigate("crops")} className="flex items-center gap-1 text-[9px] text-mint-300">جزئیات<ArrowUpLeft className="h-3 w-3" /></button>
            </div>
            <div className="space-y-3">
              {plots.map((plot) => {
                const metrics = plotMetrics(plot);
                return (
                  <div key={plot.id}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[9px]">
                      <span className="flex min-w-0 items-center gap-1.5 text-[#d8e7df]"><Sprout className="h-3 w-3 shrink-0 text-mint-300" /><span className="truncate">{plot.title}</span><span className="text-[8px] text-[#6f8c7f]">· {plot.crop}</span></span>
                      <span className="shrink-0 text-[#c5d9cf]">{money(metrics.revenue)}</span>
                    </div>
                    <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-mint-400 to-[#c3e3a3]" style={{ width: `${Math.max(4, (metrics.revenue / maxPlotRevenue) * 100)}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[8px] text-[#6f8c7f]">
                      <span>هزینه {money(metrics.cost)}</span>
                      <span className={metrics.profit >= 0 ? "text-[#9fbfae]" : "text-[#efad9f]"}>سود {money(metrics.profit)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <span className="text-[9px] font-light text-[#89a598]">میانگین قیمت مؤثر فروش هر کیلو</span>
              <span className="text-[11px] font-semibold text-[#dcebe2]">{money(avgPrice)}</span>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="glass rounded-[22px] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-sand-300/[0.08] text-sand-300"><CalendarCheck className="h-3.5 w-3.5" /></span>
                <div>
                  <h2 className="text-[12px] font-semibold text-white">اقدام‌های پیش‌رو</h2>
                  <p className="mt-0.5 text-[8px] text-[#79968a]">{toPersianDigits(tasks.length)} کار باز</p>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              {tasks.slice(0, 4).map((task) => {
                const Icon = task.icon;
                return (
                  <button key={task.title} type="button" onClick={() => onNavigate(task.page)} className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2.5 text-right transition hover:bg-white/[0.03]">
                    <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border", task.tone === "sand" ? "border-sand-300/25 bg-sand-300/[0.08] text-sand-300" : "border-mint-300/20 bg-mint-300/[0.07] text-mint-300")}><Icon className="h-2.5 w-2.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[9px] font-medium text-[#dbe9e1]">{task.title}</span>
                      <span className="mt-0.5 block text-[8px] font-light leading-4 text-[#718e81]">{task.detail}</span>
                    </span>
                    <ChevronLeft className="mt-1 h-3 w-3 shrink-0 text-[#587466]" />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="relative overflow-hidden rounded-[22px] border border-mint-300/20 bg-gradient-to-br from-[#19392a] to-[#10281d] p-4">
            <div className="pointer-events-none absolute -left-6 -top-8 h-28 w-28 rounded-full bg-mint-300/[0.08] blur-xl" />
            <div className="relative">
              <div className="flex items-center gap-1.5 text-[9px] text-mint-300"><ShieldCheck className="h-3.5 w-3.5" /> موتور معامله محصول</div>
              <h3 className="mt-2 text-[12px] font-semibold text-[#edf6e5]">۵ سند رسمی، بدون کاغذبازی</h3>
              <p className="mt-1 text-[8px] font-light leading-5 text-[#9eb59c]">قرارداد فروش، قبض باسکول، صورتجلسه کیفیت، صورت‌حساب و تسویه — همه A4 و قابل ذخیره PDF.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["سربرگ", "سریال", "QR", "مهر و امضا"].map((tag) => (
                  <span key={tag} className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[7px] text-[#b8d0c1]">{tag}</span>
                ))}
              </div>
              <button type="button" onClick={() => onNavigate("documents")} className="mt-3 flex items-center gap-1.5 rounded-lg bg-mint-300/[0.1] px-2.5 py-1.5 text-[8px] font-medium text-mint-300">
                <Printer className="h-3 w-3" /> مرکز اسناد و چاپ
              </button>
            </div>
          </section>

          <section className="rounded-[22px] border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-2 flex items-center gap-2"><Landmark className="h-3.5 w-3.5 text-mint-300" /><h2 className="text-[11px] font-semibold text-[#dcebe2]">قراردادهای در جریان</h2></div>
            <div className="space-y-2">
              {contracts.slice(0, 3).map((contract) => (
                <button key={contract.id} type="button" onClick={() => onNavigate("contracts")} className="flex w-full items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-2 text-right transition hover:bg-white/[0.04]">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.04] text-[#8ba598]"><FileText className="h-3 w-3" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[9px] text-[#d3e4da]">{contract.landTitle}</span>
                    <span className="mt-0.5 block truncate text-[7px] text-[#6f8c7f]">{CONTRACT_TYPES.find((type) => type.id === contract.type)?.short} · {contract.partyName}</span>
                  </span>
                  <span className="shrink-0 text-[8px] text-mint-300">{contract.rent ? money(contract.rent) : `${toPersianDigits(contract.cropShare)}٪`}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[22px] border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[11px] font-semibold text-[#dcebe2]"><Truck className="h-3.5 w-3.5 text-mint-300" /> آماده فروش</h2>
              <span className="flex items-center gap-1 text-[8px] text-[#8fa99c]"><CheckCircle2 className="h-2.5 w-2.5" /> بدون خطای شناخته‌شده</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/[0.02] p-2"><div className="text-[7px] text-[#78968a]">امروز</div><div className="mt-0.5 text-[9px] text-[#cfe2d7]">{formatJalali(today, "short")}</div></div>
              <div className="rounded-lg bg-white/[0.02] p-2"><div className="text-[7px] text-[#78968a]">نرخ مرجع گندم</div><div className="mt-0.5 text-[9px] text-[#cfe2d7]">۴۹٬۵۰۰ تومان</div></div>
              <div className="col-span-2 flex items-center gap-1.5 rounded-lg bg-mint-300/[0.05] p-2 text-[8px] text-[#a9c9b6]"><ShieldCheck className="h-3 w-3 shrink-0 text-mint-300" />نرخ فصل جاری و جدول افت خریدار را قبل از امضا تطبیق دهید.</div>
            </div>
          </section>

          <button type="button" onClick={() => onNavigate("architecture")} className="flex w-full items-center justify-between gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-right transition hover:border-mint-300/20">
            <span>
              <span className="block text-[10px] font-medium text-[#dcebe2]">معماری و آزمون‌های موتور</span>
              <span className="mt-0.5 block text-[8px] text-[#718e81]">۱۰ آزمون قطعی · فرمول‌ها و منابع</span>
            </span>
            <BarChart3 className="h-4 w-4 text-mint-300" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3 text-[8px] text-[#718e81]">
        <span className="flex items-center gap-1.5"><BadgeCheck className="h-3 w-3 text-mint-300" /> همه محاسبات از موتور قطعی، بدون تخمین ذهنی</span>
        <span className="flex items-center gap-1.5"><Avatar name={MY_BUSINESS.owner} size="sm" /> {MY_BUSINESS.owner} · مدیر مزرعه</span>
      </div>
    </div>
  );
}
