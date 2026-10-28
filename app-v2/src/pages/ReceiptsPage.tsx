import { useEffect, useMemo, useState } from "react";
import { Camera, Database, Info, ShieldCheck } from "lucide-react";
import { cn } from "../utils/cn";
import { loadReceipts, receiptsStats, RECEIPTS_CHANGED_EVENT } from "../lib/receipts";
import { formatTomanAmount } from "../lib/money-format";
import { RECEIPT_SECTIONS } from "../lib/receipt-sections";
import { RECEIPT_NOTE, VALIDITY_DISCLAIMER } from "../lib/document-validity";
import { formatJalali } from "../lib/format";

const RECEIPT_REF_LABELS: Record<string, string> = {
  debt: "درآمد/هزینه",
  cheque: "چک",
  loan: "وام",
  party: "طرف‌حساب",
  contract: "قرارداد و اجاره",
  trade: "معامله محصول",
  "inventory-item": "کالای انبار",
  crop: "زمین و کشت",
  document: "سند",
};

export function ReceiptsPage() {
  const [filter, setFilter] = useState<string>("all");
  const [tick, setTick] = useState(0);
  const rows = useMemo(() => loadReceipts(), [tick]);
  const stats = useMemo(() => receiptsStats(rows), [rows]);
  useEffect(() => {
    const onStorage = () => setTick((value) => value + 1);
    window.addEventListener("storage", onStorage);
    window.addEventListener(RECEIPTS_CHANGED_EVENT, onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(RECEIPTS_CHANGED_EVENT, onStorage);
    };
  }, []);

  return (
    <div className="animate-rise space-y-4">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]">
          <Camera className="h-3.5 w-3.5 text-mint-300" /> مرکز رسیدها و فیش‌ها
          <span className="rounded border border-sand-300/20 bg-sand-300/[0.07] px-1.5 py-0.5 text-[8px] text-sand-300">آفلاین</span>
        </div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">رسیدها، فیش‌ها و مدارک حمایتی</h1>
        <p className="mt-1.5 max-w-3xl text-[11px] font-light leading-6 text-[#89a598]">{RECEIPT_NOTE}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          ["تعداد رسید", stats.count.toLocaleString("fa-IR"), "مورد"],
          ["جمع مبالغ", `${Math.round(stats.total).toLocaleString("fa-IR")}`, "تومان"],
          ["حجم بایگانی", (stats.bytes / 1024).toFixed(0), "کیلوبایت"],
          ["بخش‌های دارای رسید", stats.sections.toLocaleString("fa-IR"), "بخش"],
        ].map(([label, value, unit]) => (
          <div key={label} className="glass rounded-2xl p-3.5">
            <div className="text-[9px] text-[#91ad9f]">{label}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold text-[#eef8f1]">{value}</span>
              <span className="text-[8px] text-[#738f82]">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-mint-300/15 bg-mint-300/[0.04] p-3.5">
        <div className="flex items-start gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-mint-300/10 text-mint-300"><Info className="h-4 w-4" /></span>
          <div>
            <p className="text-[10px] font-semibold text-[#e2f1e7]">رسید را همان‌جا که اطلاعات را می‌نویسید ضمیمه کنید</p>
            <p className="mt-1 text-[9px] font-light leading-5 text-[#9db8ab]">
              در بخش‌های دفتر مالی (درآمد/هزینه، چک و وام)، طرف‌حساب، اجاره، معامله محصول، انبار و زمین و کشت، زیر هر رکورد
              دکمهٔ «افزودن تصویر رسید» هست. این صفحه فقط بایگانی و جست‌وجوی همهٔ رسیدهاست؛ می‌توانید تصویر را ببینید، دانلود کنید یا حذف کنید.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-[11px] font-semibold text-[#e3f0e8]"><Database className="h-3.5 w-3.5 text-mint-300" /> بایگانی رسیدها</h2>
          <button type="button" onClick={() => setTick((value) => value + 1)} className="rounded-lg border border-white/10 px-2 py-1 text-[9px] text-[#a9c3b6]">به‌روزرسانی</button>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {([{ id: "all", label: "همه" }, ...RECEIPT_SECTIONS] as { id: string; label: string }[]).map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setFilter(section.id)}
              className={cn("shrink-0 rounded-lg px-2.5 py-1.5 text-[9px] transition", filter === section.id ? "bg-[#1d402f] text-mint-300" : "text-[#7f9b8e] hover:text-white")}
            >
              {section.label}
            </button>
          ))}
        </div>
        <ul className="mt-2 space-y-1.5">
          {rows.filter((row) => filter === "all" || row.section === filter).map((row) => (
            <li key={row.id} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/[0.05] text-mint-300">
                {row.mimeType.startsWith("image/") ? (
                  <img
                    src={row.thumbnailDataUrl ?? row.dataUrl}
                    alt={row.title}
                    className="h-full w-full object-cover"
                    width={36}
                    height={36}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] text-[#e4f1e9]">{row.title}</p>
                <p className="truncate text-[8px] text-[#88a496]">
                  {RECEIPT_SECTIONS.find((section) => section.id === row.section)?.label ?? "سایر"}
                  {row.refType ? ` · پیوست رکورد (${RECEIPT_REF_LABELS[row.refType] ?? row.refType})` : ""} · {formatJalali(row.date, "long")}
                  {row.amount !== null ? ` · ${formatTomanAmount(row.amount)}` : ""}
                  {row.reference ? ` · پیگیری ${row.reference}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
        {rows.length === 0 && (
          <p className="mt-1 flex items-start gap-1 rounded-lg bg-white/[0.03] p-2 text-[9px] leading-5 text-[#8faa9d]"><Info className="mt-0.5 h-3 w-3 shrink-0" /> هنوز رسیدی ذخیره نشده است. در هر بخش، زیر همان رکورد (بدهی، چک، معامله، قرارداد…) دکمهٔ «افزودن تصویر رسید» را بزنید.</p>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="glass rounded-2xl p-3.5">
          <h2 className="flex items-center gap-1.5 text-[11px] font-semibold text-[#e3f0e8]"><ShieldCheck className="h-3.5 w-3.5 text-mint-300" /> رسید چه چیزی را ثابت می‌کند؟</h2>
          <ul className="mt-2 space-y-1.5 text-[9px] leading-5 text-[#9db8ab]">
            <li>• وقوع پرداخت، مبلغ و تاریخ را نشان می‌دهد.</li>
            <li>• علت پرداخت را قرارداد یا صورتجلسهٔ تسویه اثبات می‌کند.</li>
            <li>• شمارهٔ پیگیری، نام پرداخت‌کننده و شمارهٔ قرارداد را حتماً بنویسید.</li>
            <li>• اصل فیش بانکی یا گواهی آن از اسکرین‌شات قوی‌تر است.</li>
            <li>• رسید در برنامه «یادداشت حمایتی» است و جای سند رسمی را نمی‌گیرد.</li>
          </ul>
        </div>
        <div className="glass rounded-2xl p-3.5">
          <h2 className="flex items-center gap-1.5 text-[11px] font-semibold text-[#e3f0e8]"><Info className="h-3.5 w-3.5 text-mint-300" /> هر رسید در کدام بخش؟</h2>
          <ul className="mt-2 grid grid-cols-1 gap-1 text-[9px] leading-5 text-[#9db8ab] sm:grid-cols-2">
            {RECEIPT_SECTIONS.map((section) => (
              <li key={section.id}><span className="text-[#d6e8dd]">{section.label}:</span> {section.hint}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-[9px] leading-5 text-[#93ad9f]">{VALIDITY_DISCLAIMER}</p>
    </div>
  );
}
