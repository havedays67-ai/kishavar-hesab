import { useState } from "react";
import {
  AlertTriangle,
  Sparkles,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileText,
  Landmark,
  Printer,
  Receipt,
  Scale,
  Sprout,
  TrendingUp,
  Wallet,
  Wheat,
} from "lucide-react";
import { cn } from "../utils/cn";
import type { SavedContract } from "../lib/data";
import { CONTRACT_TYPES } from "../lib/data";
import { formatJalali, formatNumber, toPersianDigits, todayJalali } from "../lib/format";
import { PRODUCT_PROFILES, tradeBalance, type CropTrade } from "../lib/trade";
import { plotCost, plotMetrics, type CropPlot } from "../lib/samples";
import { makeDocument, type DocumentSpec } from "../lib/documents";
import type { HealthReport } from "../lib/insights";

type Tab = "overview" | "trades" | "crops" | "lease";

const fa = (value: number) => toPersianDigits(formatNumber(Math.round(value)));
const money = (value: number) => `${fa(value)} تومان`;

export function ReportsPage({
  trades,
  plots,
  contracts,
  health,
  onOpenDocument,
  onNavigateTrade,
}: {
  trades: CropTrade[];
  plots: CropPlot[];
  contracts: SavedContract[];
  health: HealthReport;
  onOpenDocument: (spec: DocumentSpec) => void;
  onNavigateTrade: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [severity, setSeverity] = useState<"all" | "critical" | "warning" | "info" | "good">("all");
  const visibleInsights = health.insights.filter((insight) => severity === "all" || insight.severity === severity);

  const saleValue = trades.reduce((sum, trade) => sum + trade.result.netReceipt, 0);
  const costValue = plots.reduce((sum, plot) => sum + plotCost(plot), 0);
  const remaining = trades.reduce((sum, trade) => sum + tradeBalance(trade).remaining, 0);
  const payableKg = trades.reduce((sum, trade) => sum + trade.result.payableKg, 0);
  const profitGap = saleValue - costValue;
  const margin = saleValue > 0 ? (profitGap / saleValue) * 100 : 0;
  const leaseIncome = contracts.filter((contract) => contract.myRole === "landlord").reduce((sum, contract) => sum + contract.rent, 0);
  const leaseExpense = contracts.filter((contract) => contract.myRole === "tenant").reduce((sum, contract) => sum + contract.rent, 0);

  const costRows = plots.map((plot) => {
    const metrics = plotMetrics(plot);
    return {
      title: plot.title,
      areaHa: plot.areaHa,
      crop: plot.crop,
      totalCost: metrics.cost,
      yieldKg: metrics.yieldKg,
      revenue: metrics.revenue,
      profit: metrics.profit,
    };
  });

  const productBreakdown = (Object.keys(PRODUCT_PROFILES) as (keyof typeof PRODUCT_PROFILES)[])
    .map((id) => {
      const productTrades = trades.filter((trade) => trade.productId === id);
      return {
        id,
        label: PRODUCT_PROFILES[id].name,
        count: productTrades.length,
        kg: productTrades.reduce((sum, trade) => sum + trade.result.payableKg, 0),
        value: productTrades.reduce((sum, trade) => sum + trade.result.netReceipt, 0),
      };
    })
    .filter((row) => row.count > 0);
  const maxProductValue = Math.max(...productBreakdown.map((row) => row.value), 1);

  const alerts = [
    remaining > 0 ? { title: `${fa(remaining)} تومان مانده دریافتنی`, text: "پیگیری تسویه با خریداران در مرکز اسناد و بخش معاملات انجام می‌شود.", tone: "sand" as const } : null,
    trades.some((trade) => trade.quality.moisture > PRODUCT_PROFILES[trade.productId].maxMoisture)
      ? { title: "رطوبت یک محموله بالاتر از حد پذیرش است", text: "پیش از تحویل بعدی، خشک‌کردن یا تطبیق با خریدار را بررسی کنید.", tone: "bad" as const }
      : null,
    plots.some((plot) => plotMetrics(plot).profit < 0)
      ? { title: "یک زمین با هزینه بالاتر از درآمد برآوردی", text: "سرفصل هزینه و عملکرد همان زمین را در بخش زمین و کشت بازبینی کنید.", tone: "bad" as const }
      : null,
    trades.some((trade) => trade.status === "draft")
      ? { title: "پیش‌نویس تأییدنشده در معاملات", text: "پیش‌نویس‌ها را نهایی یا حذف کنید تا گزارش مدیریتی دقیق بماند.", tone: "sand" as const }
      : null,
  ].filter(Boolean);

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]">
            <BarChart3 className="h-3.5 w-3.5 text-mint-300" />
            تحلیل مدیریتی
            <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] text-[#a8bfb3]">قابل چاپ</span>
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">گزارش‌های مدیریتی</h1>
          <p className="mt-1.5 text-[11px] font-light text-[#89a598]">فروش، بهای تمام‌شده، سود و اجاره — همه بر پایه اسناد ثبت‌شده.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onOpenDocument(makeDocument("cost-report", { costRows }))}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 py-2.5 text-[9px] text-[#b9cec3] transition hover:text-white"
          >
            <Printer className="h-3.5 w-3.5" />
            چاپ بهای تمام‌شده
          </button>
          <button
            type="button"
            onClick={() => onOpenDocument(makeDocument("trades-report", { trades }))}
            className="flex items-center gap-1.5 rounded-xl bg-mint-400 px-3 py-2.5 text-[9px] font-bold text-[#07110d]"
          >
            <Printer className="h-3.5 w-3.5" />
            چاپ گزارش معاملات
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: "ارزش فروش ثبت‌شده", value: fa(saleValue), unit: "تومان", icon: Receipt, tone: "mint" },
          { label: "بهای تولید زمین‌ها", value: fa(costValue), unit: "تومان", icon: Wallet, tone: "neutral" },
          { label: "اختلاف فروش و بهای تولید", value: fa(profitGap), unit: "تومان", icon: TrendingUp, tone: profitGap >= 0 ? "mint" : "bad" },
          { label: "مانده دریافتنی", value: fa(remaining), unit: "تومان", icon: Landmark, tone: remaining > 0 ? "sand" : "mint" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="glass rounded-2xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#91ad9f]">{item.label}</span>
                <Icon className={cn("h-3.5 w-3.5", item.tone === "bad" ? "text-[#efad9f]" : item.tone === "sand" ? "text-sand-300" : "text-mint-300/80")} />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={cn("truncate text-base font-bold", item.tone === "bad" ? "text-[#efad9f]" : item.tone === "sand" ? "text-sand-300" : "text-[#eef8f1]")}>{item.value}</span>
                <span className="text-[8px] text-[#738f82]">{item.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex w-full max-w-lg items-center overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
        {[
          ["overview", "نمای کلی", BarChart3],
          ["trades", "معاملات محصول", Scale],
          ["crops", "زمین و بهای تمام‌شده", Sprout],
          ["lease", "اجاره زمین", Landmark],
        ].map(([value, label, Icon]) => {
          const TabIcon = Icon as typeof BarChart3;
          return (
            <button
              key={String(value)}
              type="button"
              onClick={() => setTab(value as Tab)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[9px] transition",
                tab === value ? "bg-[#1d402f] font-medium text-mint-300" : "text-[#819d90] hover:text-white"
              )}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {String(label)}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <div className="grid items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <section className="glass rounded-[22px] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-[12px] font-semibold text-white">ارزش فروش به تفکیک محصول</h2>
                  <p className="mt-0.5 text-[8px] text-[#78968a]">خالص دریافتی پس از افت و هزینه‌ها</p>
                </div>
                <span className="rounded-full border border-white/[0.07] px-2 py-1 text-[8px] text-[#8ca99b]">
                  <CalendarDays className="ml-1 inline h-2.5 w-2.5" />
                  {formatJalali(todayJalali(), "long")}
                </span>
              </div>
              <div className="space-y-3">
                {productBreakdown.length === 0 && <p className="rounded-xl border border-dashed border-[#355344] px-3 py-6 text-center text-[10px] text-[#78968a]">هنوز معامله‌ای ثبت نشده است.</p>}
                {productBreakdown.map((row) => (
                  <div key={row.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[10px] text-[#d8e7df]"><Wheat className="h-3 w-3 text-mint-300" /> {row.label} <span className="text-[8px] text-[#6f8c7f]">({toPersianDigits(row.count)} محموله)</span></span>
                      <span className="text-[9px] font-medium text-[#c5d9cf]">{money(row.value)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                      <div className="h-full rounded-full bg-gradient-to-l from-mint-400 to-[#bce1a0]" style={{ width: `${Math.max(3, (row.value / maxProductValue) * 100)}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[8px] text-[#6f8c7f]">
                      <span>{fa(row.kg)} کیلوگرم قابل پرداخت</span>
                      <span>میانگین {money(row.kg > 0 ? row.value / row.kg : 0)} / کیلو</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  ["حاشیه سود ناخالص", `${toPersianDigits(margin.toFixed(1))}٪`],
                  ["وزن کل قابل پرداخت", `${fa(payableKg)} کیلو`],
                  ["میانگین نرخ مؤثر", money(payableKg > 0 ? saleValue / payableKg : 0)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-white/[0.02] px-2.5 py-2">
                    <div className="text-[8px] text-[#78968a]">{label}</div>
                    <div className="mt-0.5 text-[10px] font-semibold text-[#d7e7de]">{value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass rounded-[22px] p-4 sm:p-5">
              <h2 className="mb-3 text-[12px] font-semibold text-white">هشدارهای مدیریتی</h2>
              <div className="space-y-2">
                {alerts.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-xl border border-mint-300/15 bg-mint-300/[0.05] px-3 py-3 text-[9px] text-[#b5d3c2]">
                    <CheckCircle2 className="h-4 w-4 text-mint-300" />
                    وضعیت فعلی بدون هشدار است؛ همه معاملات تأییدشده و تسویه‌شده‌اند.
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert!.title} className={cn("flex items-start gap-2 rounded-xl border px-3 py-2.5", alert!.tone === "bad" ? "border-[#a25649]/20 bg-[#a25649]/[0.07]" : "border-sand-300/15 bg-sand-300/[0.05]")}>
                      <AlertTriangle className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", alert!.tone === "bad" ? "text-[#efad9f]" : "text-sand-300")} />
                      <div>
                        <div className="text-[9px] font-medium text-[#dcebe2]">{alert!.title}</div>
                        <div className="mt-0.5 text-[8px] font-light leading-4 text-[#819d90]">{alert!.text}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <section className="glass rounded-[22px] p-4">
              <h2 className="mb-3 text-[12px] font-semibold text-white">خلاصه اجاره</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-mint-300/[0.05] px-2.5 py-2">
                  <span className="text-[9px] text-[#9fbfae]">اجاره دریافتی (موجر)</span>
                  <span className="text-[10px] font-semibold text-mint-300">{money(leaseIncome)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white/[0.02] px-2.5 py-2">
                  <span className="text-[9px] text-[#9fbfae]">اجاره پرداختی (مستاجر)</span>
                  <span className="text-[10px] font-semibold text-[#d7e7de]">{money(leaseExpense)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white/[0.02] px-2.5 py-2">
                  <span className="text-[9px] text-[#9fbfae]">ودیعه نزد طرف‌ها</span>
                  <span className="text-[10px] font-semibold text-[#d7e7de]">{money(contracts.reduce((sum, contract) => sum + contract.deposit, 0))}</span>
                </div>
              </div>
              <button type="button" onClick={() => setTab("lease")} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-white/[0.07] py-2 text-[9px] text-[#a8bfb3] transition hover:text-white">
                جزئیات قراردادهای زمین
                <ArrowLeft className="h-3 w-3" />
              </button>
            </section>

            <section className="rounded-[22px] border border-mint-300/15 bg-mint-300/[0.04] p-4">
              <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#e2f0e7]"><BadgeCheck className="h-3.5 w-3.5 text-mint-300" /> اقدام بعدی</h2>
              <p className="text-[8px] font-light leading-5 text-[#9db8ab]">
                برای هر محموله جدید، ابتدا ماشین‌حساب فروش را اجرا کنید؛ سپس اسناد را چاپ و با خریدار امضا کنید.
              </p>
              <button type="button" onClick={onNavigateTrade} className="mt-2 flex items-center gap-1.5 rounded-lg bg-mint-300/10 px-2.5 py-1.5 text-[8px] font-medium text-mint-300">
                <Scale className="h-3 w-3" />
                رفتن به معامله محصول
              </button>
            </section>

            <section className="rounded-[22px] border border-white/[0.06] bg-white/[0.02] p-4">
              <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#dcebe2]"><FileText className="h-3.5 w-3.5 text-mint-300" /> یادداشت گزارش</h2>
              <p className="text-[8px] font-light leading-5 text-[#819d90]">
                این گزارش مدیریتی است و مبنای اظهارنامه مالیاتی یا سند رسمی نیست. ارزش فروش از ماشین‌حساب قطعی معاملات و
                بهای تولید از هزینه‌های ثبت‌شده زمین‌ها می‌آید.
              </p>
            </section>
          </div>
        </div>
      )}

      {tab === "trades" && (
        <section className="glass overflow-hidden rounded-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-4">
            <div>
              <h2 className="text-[12px] font-semibold text-white">دفتر معاملات محصول</h2>
              <p className="mt-0.5 text-[8px] text-[#78968a]">وزن، کسورات، درجه، نرخ مؤثر و مانده</p>
            </div>
            <button type="button" onClick={() => onOpenDocument(makeDocument("trades-report", { trades }))} className="flex items-center gap-1.5 rounded-lg bg-mint-300/[0.08] px-2.5 py-1.5 text-[9px] text-mint-300">
              <Printer className="h-3 w-3" />
              چاپ گزارش
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-right">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.025] text-[8px] text-[#7d9a8d]">
                  {["سریال", "تاریخ", "محصول / خریدار", "خالص", "قابل پرداخت", "درجه", "ارزش محصول", "خالص دریافتی", "مانده", "وضعیت"].map((header) => (
                    <th key={header} className="px-3 py-2.5 font-normal">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => {
                  const balance = tradeBalance(trade);
                  return (
                    <tr key={trade.id} className="border-b border-white/[0.04] text-[9px] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 font-mono text-[8px] text-[#b6ccc0]">{trade.serial}</td>
                      <td className="px-3 py-2.5 text-[#a8bfb3]">{formatJalali(trade.date, "short")}</td>
                      <td className="px-3 py-2.5"><div className="text-[#d8e7df]">{PRODUCT_PROFILES[trade.productId].name}</div><div className="mt-0.5 text-[8px] text-[#6f8c7f]">{trade.buyerName}</div></td>
                      <td className="px-3 py-2.5 text-[#a8bfb3]">{fa(trade.result.netKg)}</td>
                      <td className="px-3 py-2.5 font-medium text-mint-300">{fa(trade.result.payableKg)}</td>
                      <td className="px-3 py-2.5 text-[#d9c48f]">{trade.result.quality.label}</td>
                      <td className="px-3 py-2.5 text-[#c5d9cf]">{fa(trade.result.grossValue)}</td>
                      <td className="px-3 py-2.5 font-medium text-[#d8e7df]">{fa(trade.result.netReceipt)}</td>
                      <td className={cn("px-3 py-2.5", balance.remaining > 0 ? "text-sand-300" : "text-[#8ea99a]")}>{fa(balance.remaining)}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("rounded px-1.5 py-0.5 text-[8px]", trade.status === "settled" ? "bg-mint-300/10 text-mint-300" : trade.status === "draft" ? "bg-white/[0.05] text-[#9fb6aa]" : "bg-sand-300/10 text-sand-300")}>
                          {trade.status === "settled" ? "تسویه" : trade.status === "draft" ? "پیش‌نویس" : "تأییدشده"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] bg-white/[0.015] px-4 py-2.5 text-[8px] text-[#718e81]">
            <span>{toPersianDigits(trades.length)} معامله · وزن قابل پرداخت {fa(payableKg)} کیلو</span>
            <span>مبالغ تومان · تاریخ شمسی</span>
          </div>
        </section>
      )}

      {tab === "crops" && (
        <section className="glass overflow-hidden rounded-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-4">
            <div>
              <h2 className="text-[12px] font-semibold text-white">بهای تمام‌شده زمین‌ها</h2>
              <p className="mt-0.5 text-[8px] text-[#78968a]">هزینه تولید، عملکرد و سود هر زمین</p>
            </div>
            <button type="button" onClick={() => onOpenDocument(makeDocument("cost-report", { costRows }))} className="flex items-center gap-1.5 rounded-lg bg-mint-300/[0.08] px-2.5 py-1.5 text-[9px] text-mint-300">
              <Printer className="h-3 w-3" />
              چاپ گزارش
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-right">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.025] text-[8px] text-[#7d9a8d]">
                  {["زمین", "مساحت", "محصول", "هزینه کل", "عملکرد", "هزینه هر کیلو", "درآمد", "سود", "حاشیه"].map((header) => (
                    <th key={header} className="px-3 py-2.5 font-normal">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plots.map((plot) => {
                  const metrics = plotMetrics(plot);
                  return (
                    <tr key={plot.id} className="border-b border-white/[0.04] text-[9px] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5"><div className="text-[#d8e7df]">{plot.title}</div><div className="mt-0.5 text-[8px] text-[#6f8c7f]">{plot.location}</div></td>
                      <td className="px-3 py-2.5 text-[#a8bfb3]">{toPersianDigits(plot.areaHa)} هکتار</td>
                      <td className="px-3 py-2.5 text-[#c5d9cf]">{plot.crop}</td>
                      <td className="px-3 py-2.5 text-[#c5d9cf]">{fa(metrics.cost)}</td>
                      <td className="px-3 py-2.5 text-[#a8bfb3]">{fa(metrics.yieldKg)}</td>
                      <td className="px-3 py-2.5 font-medium text-sand-300">{fa(metrics.costPerKg)}</td>
                      <td className="px-3 py-2.5 text-[#a8bfb3]">{fa(metrics.revenue)}</td>
                      <td className={cn("px-3 py-2.5 font-medium", metrics.profit >= 0 ? "text-mint-300" : "text-[#efad9f]")}>{fa(metrics.profit)}</td>
                      <td className={cn("px-3 py-2.5", metrics.margin >= 0 ? "text-[#9fbfae]" : "text-[#efad9f]")}>{toPersianDigits(metrics.margin.toFixed(1))}٪</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-white/[0.05] bg-white/[0.015] px-4 py-2.5 text-[8px] text-[#718e81]">
            <span>هزینه کل {money(costValue)}</span>
            <span>میانگین هزینه هر کیلو {money(plots.reduce((sum, plot) => sum + plotMetrics(plot).yieldKg, 0) > 0 ? costValue / plots.reduce((sum, plot) => sum + plotMetrics(plot).yieldKg, 0) : 0)}</span>
          </div>
        </section>
      )}

      {tab === "lease" && (
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {[
              ["اجاره دریافتی", money(leaseIncome)],
              ["اجاره پرداختی", money(leaseExpense)],
              ["قراردادهای فعال", toPersianDigits(contracts.filter((contract) => contract.status === "active").length)],
              ["ودیعه‌های ثبت‌شده", money(contracts.reduce((sum, contract) => sum + contract.deposit, 0))],
            ].map(([label, value]) => (
              <div key={label} className="glass rounded-2xl p-3.5">
                <div className="text-[9px] text-[#91ad9f]">{label}</div>
                <div className="mt-1 text-[12px] font-semibold text-[#eef8f1]">{value}</div>
              </div>
            ))}
          </div>
          {contracts.map((contract) => (
            <article key={contract.id} className="glass rounded-2xl px-4 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-[11px] font-semibold text-[#e5f1e9]">{contract.landTitle}</h3>
                  <p className="mt-0.5 text-[8px] text-[#78968a]">
                    {contract.code} · {contract.partyName} · {CONTRACT_TYPES.find((type) => type.id === contract.type)?.label} ·{" "}
                    {formatJalali(contract.start, "short")} تا {formatJalali(contract.end, "short")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-left">
                    <div className="text-[10px] font-semibold text-mint-300">{contract.rent ? money(contract.rent) : `${toPersianDigits(contract.cropShare)}٪ محصول`}</div>
                    <div className="mt-0.5 text-[8px] text-[#718e81]">ودیعه {money(contract.deposit)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenDocument(makeDocument("lease-contract", { contract }))}
                    className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[8px] text-[#a8bfb3] transition hover:text-mint-300"
                  >
                    <Printer className="h-3 w-3" />
                    چاپ قرارداد
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["ودیعه", money(contract.deposit)],
                  ["سهم محصول", `${toPersianDigits(contract.cropShare)}٪`],
                  ["حقابه", contract.waterShare || "طبق عرف"],
                  ["خدمات", contract.utilities],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-white/[0.02] px-2.5 py-1.5">
                    <div className="text-[8px] text-[#78968a]">{label}</div>
                    <div className="mt-0.5 truncate text-[9px] text-[#c5d9cf]">{value}</div>
                  </div>
                ))}
              </div>
            </article>
          ))}
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-3.5 py-2.5 text-[8px] text-[#718e81]">
            برای چاپ رسید اجاره و صورتجلسه تحویل، به «مرکز اسناد و چاپ» بروید. اسناد هر قرارداد در همان‌جا آماده است.
          </div>
        </section>
      )}
      <section className="glass mt-4 rounded-[22px] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-mint-300/10 text-mint-300"><Sparkles className="h-4 w-4" /></span><div><h2 className="text-[13px] font-semibold text-white">تحلیل کامل هوشمند</h2><p className="mt-0.5 text-[8px] text-[#78968a]">امتیاز سلامت {toPersianDigits(health.score)} از ۱۰۰ · {health.level} — {toPersianDigits(health.insights.length)} یافته و اقدام</p></div></div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.025] p-1">
            {([["all", "همه"], ["critical", "بحرانی"], ["warning", "هشدار"], ["info", "اطلاع"], ["good", "مطلوب"]] as [typeof severity, string][]).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setSeverity(value)} className={cn("rounded-md px-2 py-1.5 text-[8px]", severity === value ? "bg-[#1d402f] font-medium text-mint-300" : "text-[#7f9b8e]")}>{label}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {visibleInsights.map((insight) => (
            <div key={insight.code} className={cn("rounded-xl border p-2.5", insight.severity === "critical" ? "border-[#a25649]/25 bg-[#a25649]/[0.06]" : insight.severity === "warning" ? "border-sand-300/20 bg-sand-300/[0.04]" : insight.severity === "good" ? "border-mint-300/20 bg-mint-300/[0.04]" : "border-sky-300/15 bg-sky-300/[0.03]")}>
              <div className="flex items-start justify-between gap-2"><span className="text-[9px] font-semibold text-[#dcebe2]">{insight.title}</span><span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[7px]", insight.severity === "critical" ? "bg-[#a25649]/20 text-[#efad9f]" : insight.severity === "warning" ? "bg-sand-300/10 text-sand-300" : insight.severity === "good" ? "bg-mint-300/10 text-mint-300" : "bg-sky-300/10 text-[#b3d3de]")}>{insight.severity === "critical" ? "بحرانی" : insight.severity === "warning" ? "هشدار" : insight.severity === "good" ? "مطلوب" : "اطلاع"}</span></div>
              <p className="mt-1 text-[8px] font-light leading-4 text-[#9db8ab]">{insight.detail}</p>
              <p className="mt-1 text-[8px] leading-4 text-mint-300/85">اقدام: {insight.action}</p>
            </div>
          ))}
        </div>
        {visibleInsights.length === 0 && <p className="rounded-xl border border-dashed border-[#355344] px-3 py-6 text-center text-[9px] text-[#78968a]">در این سطح، یافته‌ای وجود ندارد.</p>}
        <div className="mt-3 rounded-lg border border-[#c5b97f]/20 bg-[#c5b97f]/[0.05] px-3 py-2 text-[8px] leading-5 text-[#d7cba1]">این تحلیل بر اساس قواعد قطعی و داده‌های ثبت‌شده شماست؛ نه حدس. توصیه‌های حقوقی/مالی سنگین را با مشاور خود بازبینی کنید.</div>
      </section>

    </div>
  );
}
