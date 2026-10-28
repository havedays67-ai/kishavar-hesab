import { useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  FileText,
  Files,
  Info,
  Landmark,
  Printer,
  Receipt,
  Scale,
  Search,
  ShieldCheck,
} from "lucide-react";
import { cn } from "../utils/cn";
import type { SavedContract } from "../lib/data";
import {
  DOCUMENT_TYPES,
  makeDocument,
  type DocumentFamily,
  type DocumentKind,
  type DocumentSpec,
} from "../lib/documents";
import { formatJalali, formatNumber, toPersianDigits, todayJalali } from "../lib/format";
import { PRODUCT_PROFILES, type CropTrade } from "../lib/trade";
import { type CropPlot, plotMetrics } from "../lib/samples";
import { LegalReviewPanel } from "../components/LegalReviewPanel";

const familyTone: Record<DocumentFamily, string> = {
  trade: "mint",
  lease: "sand",
  report: "blue",
};

const familyIcons: Record<DocumentFamily, typeof Scale> = {
  trade: Scale,
  lease: Landmark,
  report: Files,
};

export function DocumentsPage({
  trades,
  contracts,
  plots,
  onOpenDocument,
}: {
  trades: CropTrade[];
  contracts: SavedContract[];
  plots: CropPlot[];
  onOpenDocument: (spec: DocumentSpec) => void;
}) {
  const [family, setFamily] = useState<"all" | DocumentFamily>("all");
  const [search, setSearch] = useState("");

  const docs = useMemo(() => {
    const rows: {
      spec: DocumentSpec;
      sourceLabel: string;
      sourceMeta: string;
      status: string;
      family: DocumentFamily;
    }[] = [];
    for (const trade of trades) {
      for (const kind of ["sale-contract", "weigh-ticket", "quality-minutes", "sale-invoice", "settlement"] as DocumentKind[]) {
        rows.push({
          spec: makeDocument(kind, { trade }),
          sourceLabel: `${PRODUCT_PROFILES[trade.productId].name} — ${trade.buyerName}`,
          sourceMeta: `${trade.serial} · ${formatJalali(trade.date, "long")}`,
          status: trade.status === "draft" ? "پیش‌نویس" : "تأییدشده",
          family: "trade",
        });
      }
    }
    for (const contract of contracts) {
      for (const kind of ["lease-contract", "lease-receipt", "lease-handover"] as DocumentKind[]) {
        rows.push({
          spec: makeDocument(kind, { contract }),
          sourceLabel: contract.landTitle,
          sourceMeta: `${contract.code} · ${contract.partyName}`,
          status: contract.status === "active" ? "جاری" : "در انتظار",
          family: "lease",
        });
      }
    }
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
    if (trades.length > 0) rows.push({
      spec: makeDocument("trades-report", { trades }),
      sourceLabel: "گزارش کامل معاملات محصول",
      sourceMeta: `${toPersianDigits(trades.length)} محموله · تا ${formatJalali(todayJalali(), "long")}`,
      status: "گزارش مدیریتی",
      family: "report",
    });
    if (plots.length > 0) rows.push({
      spec: makeDocument("cost-report", { costRows }),
      sourceLabel: "گزارش بهای تمام‌شده و سود زمین‌ها",
      sourceMeta: `${toPersianDigits(plots.length)} زمین · ${toPersianDigits(plots.reduce((sum, plot) => sum + plot.areaHa, 0))} هکتار`,
      status: "گزارش مدیریتی",
      family: "report",
    });
    return rows;
  }, [trades, contracts, plots]);

  const visible = docs.filter((doc) => {
    const inFamily = family === "all" || doc.family === family;
    const term = search.trim();
    const matches = !term || `${doc.spec.meta.title} ${doc.spec.serial} ${doc.sourceLabel} ${doc.sourceMeta}`.includes(term);
    return inFamily && matches;
  });

  const counts = {
    all: docs.length,
    trade: docs.filter((doc) => doc.family === "trade").length,
    lease: docs.filter((doc) => doc.family === "lease").length,
    report: docs.filter((doc) => doc.family === "report").length,
  };

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]">
            <Files className="h-3.5 w-3.5 text-mint-300" />
            مرکز اسناد و چاپ
            <span className="rounded border border-mint-300/20 bg-mint-300/[0.07] px-1.5 py-0.5 text-[8px] text-mint-300">A4 اداری</span>
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">اسناد اداری و قابل چاپ</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] font-light leading-6 text-[#89a598]">
            قرارداد فروش، قبض باسکول، صورتجلسه کیفیت، صورت‌حساب و تسویه — با سربرگ، شماره سریال، مبلغ به حروف، جای مهر و
            امضا و کد استعلام. قابل چاپ و ذخیره PDF.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {plots.length > 0 && (
            <button type="button" onClick={() => { const costRows = plots.map((plot) => { const metrics = plotMetrics(plot); return { title: plot.title, areaHa: plot.areaHa, crop: plot.crop, totalCost: metrics.cost, yieldKg: metrics.yieldKg, revenue: metrics.revenue, profit: metrics.profit }; }); onOpenDocument(makeDocument("cost-report", { costRows })); }} className="flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 py-2.5 text-[9px] text-[#b9cec3] transition hover:text-white">
              <Printer className="h-3.5 w-3.5" /> چاپ گزارش زمین‌ها
            </button>
          )}
          {trades.length > 0 && (
            <button type="button" onClick={() => onOpenDocument(makeDocument("trades-report", { trades }))} className="flex items-center gap-1.5 rounded-xl bg-mint-400 px-3 py-2.5 text-[9px] font-bold text-[#07110d]">
              <Printer className="h-3.5 w-3.5" /> چاپ گزارش معاملات
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          ["کل اسناد آماده", counts.all, "سند"],
          ["اسناد معامله محصول", counts.trade, "سند"],
          ["اسناد قرارداد زمین", counts.lease, "سند"],
          ["گزارش‌های مدیریتی", counts.report, "گزارش"],
        ].map(([label, value, unit]) => (
          <div key={String(label)} className="glass rounded-2xl p-3.5">
            <div className="text-[9px] text-[#91ad9f]">{label}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold text-[#eef8f1]">{toPersianDigits(Number(value))}</span>
              <span className="text-[8px] text-[#738f82]">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-2xl border border-mint-300/15 bg-mint-300/[0.04] p-3.5">
        <div className="flex items-start gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-mint-300/10 text-mint-300"><ShieldCheck className="h-4 w-4" /></span>
          <div>
            <p className="text-[10px] font-semibold text-[#e2f1e7]">چاپ اداری، شفاف و قابل بایگانی</p>
            <p className="mt-1 text-[9px] font-light leading-5 text-[#9db8ab]">
              هر سند سربرگ، شماره یکتا، تاریخ شمسی، شرح طرفین، جدول مبالغ، مبلغ به حروف، مبنای حقوقی، جای مهر و امضا و QR
              استعلام دارد. هر سند از دکمه «چاپ / ذخیره PDF» به فرمت A4 چاپ می‌شود.
            </p>
          </div>
        </div>
      </div>

      <LegalReviewPanel />

      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6c897b]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جست‌وجوی شماره سند، خریدار یا عنوان…"
            className="field pr-10 text-[11px]"
            aria-label="جست‌وجوی سند"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
          {([
            ["all", "همه"],
            ["trade", "معامله محصول"],
            ["lease", "قرارداد زمین"],
            ["report", "گزارش‌ها"],
          ] as ["all" | DocumentFamily, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFamily(value)}
              className={cn(
                "shrink-0 rounded-lg px-2.5 py-2 text-[9px] transition",
                family === value ? "bg-[#1d402f] font-medium text-mint-300" : "text-[#7f9b8e] hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        {(["trade", "lease", "report"] as DocumentFamily[])
          .filter((group) => family === "all" || family === group)
          .map((group) => {
            const groupDocs = visible.filter((doc) => doc.family === group);
            if (groupDocs.length === 0) return null;
            const Icon = familyIcons[group];
            const tone = familyTone[group];
            return (
              <section key={group}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={cn("grid h-6 w-6 place-items-center rounded-lg", tone === "mint" ? "bg-mint-300/10 text-mint-300" : tone === "sand" ? "bg-sand-300/10 text-sand-300" : "bg-sky-300/10 text-sky-200")}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <h2 className="text-[12px] font-semibold text-[#e3f0e8]">
                    {group === "trade" ? "اسناد معامله محصول" : group === "lease" ? "اسناد قرارداد زمین" : "گزارش‌های مدیریتی"}
                  </h2>
                  <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[8px] text-[#8fa99c]">{toPersianDigits(groupDocs.length)} سند</span>
                </div>
                <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                  {groupDocs.map((row) => (
                    <article key={`${row.spec.serial}-${row.spec.kind}`} className="glass group flex flex-col rounded-2xl p-3.5 transition hover:border-mint-300/20">
                      <div className="flex items-start gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-[#a9c3b6]">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[10px] font-semibold text-[#e5f1ea]">{row.spec.meta.title}</h3>
                          <p className="mt-0.5 truncate font-mono text-[8px] text-[#7e9b8e]">{row.spec.serial}</p>
                        </div>
                        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[8px]", row.status === "تأییدشده" || row.status === "جاری" ? "bg-mint-300/10 text-mint-300" : "bg-white/[0.05] text-[#9fb6aa]")}>
                          {row.status}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 min-h-[30px] text-[8px] font-light leading-4 text-[#819d90]">{row.spec.meta.description}</p>
                      <div className="mt-2 flex items-center gap-1 text-[8px] text-[#6f8c7f]">
                        <CalendarDays className="h-2.5 w-2.5" />
                        {formatJalali(row.spec.date, "long")}
                      </div>
                      <div className="mt-2 rounded-lg bg-white/[0.02] px-2 py-1.5">
                        <div className="truncate text-[8px] text-[#a8c0b4]">{row.sourceLabel}</div>
                        <div className="mt-0.5 truncate font-mono text-[7px] text-[#6f8c7f]">{row.sourceMeta}</div>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="text-[7px] text-[#6b887a]">{row.spec.meta.copies}</span>
                        <button
                          type="button"
                          onClick={() => onOpenDocument(row.spec)}
                          className="flex items-center gap-1 rounded-lg bg-mint-300/[0.08] px-2.5 py-1.5 text-[9px] font-medium text-mint-300 transition hover:bg-mint-300/[0.14]"
                        >
                          <Printer className="h-3 w-3" />
                          پیش‌نمایش و چاپ
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
      </div>

      {visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#355344] bg-white/[0.015] px-5 py-14 text-center">
          <Search className="mx-auto mb-2 h-7 w-7 text-[#6f8e80]" />
          <p className="text-xs text-[#c2d6cb]">هنوز سندی برای چاپ وجود ندارد.</p>
          <p className="mt-1 text-[9px] leading-5 text-[#78968a]">با ثبت معامله محصول، قرارداد زمین یا افزودن زمین، اسناد مربوط به‌صورت خودکار اینجا ساخته می‌شوند. گزارش‌های خالی نمایش داده نمی‌شوند.</p>
        </div>
      )}

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {[
          { icon: Archive, title: "نگهداری اسناد", text: "نسخه چاپی را با مهر و امضای طرفین نگه دارید. اسناد مالی معمولاً تا ۱۰ سال باید بایگانی شوند." },
          { icon: BadgeCheck, title: "اعتبار سند", text: "این اسناد داخلی، دقیق و قابل ارائه‌اند؛ برای اعتبار در برابر اشخاص ثالث، ثبت رسمی یا ارسال به سامانه مربوط لازم است." },
          { icon: Info, title: "استعلام و اصالت", text: "هر سند شماره یکتا و کد استعلام دارد. QR روی سند برای پیگیری داخلی و تطبیق نسخه‌ها استفاده می‌شود." },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-mint-300" />
                <h3 className="text-[10px] font-semibold text-[#dcebe2]">{item.title}</h3>
              </div>
              <p className="text-[8px] font-light leading-5 text-[#7f9b8e]">{item.text}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3 text-[8px] text-[#718e81]">
        <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-mint-300" /> {toPersianDigits(DOCUMENT_TYPES.length)} نوع سند استاندارد در مرکز اسناد</span>
        <span className="flex items-center gap-1.5"><Receipt className="h-3 w-3" /> مبالغ به تومان · تاریخ شمسی · شماره یکتا</span>
        <span className="flex items-center gap-1.5"><FileCheck2 className="h-3 w-3" /> {toPersianDigits(trades.reduce((sum, trade) => sum + trade.result.payableKg, 0))} کیلوگرم محصول ثبت‌شده</span>
      </div>
    </div>
  );
}

export function ShortcutArrow() {
  return <ArrowLeft className="h-3 w-3" />;
}

export function documentCount(trades: CropTrade[], contracts: SavedContract[]): number {
  return trades.length * 5 + contracts.length * 3 + 2;
}

export function totalDocumentValue(trades: CropTrade[]): string {
  return formatNumber(trades.reduce((sum, trade) => sum + trade.result.netReceipt, 0));
}
