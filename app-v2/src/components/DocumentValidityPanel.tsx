import { useState } from "react";
import { AlertTriangle, BadgeCheck, Info, Lock } from "lucide-react";
import { cn } from "../utils/cn";
import {
  AUTHORITY,
  AUTHORITY_LEVELS,
  AUTHORITY_ORDER,
  VALIDITY_DISCLAIMER,
  VALIDITY_METHOD,
  authorityFor,
  type AuthorityLevel,
} from "../lib/document-validity";

const tone: Record<string, string> = {
  green: "border-mint-300/25 bg-mint-300/[0.07] text-mint-300",
  amber: "border-sand-300/25 bg-sand-300/[0.07] text-sand-300",
  slate: "border-white/10 bg-white/[0.04] text-[#a9c3b6]",
  red: "border-red-400/25 bg-red-400/[0.07] text-red-300",
};

export function ValidityBadge({ kind }: { kind: string }) {
  const entry = authorityFor(kind);
  const meta = AUTHORITY_LEVELS[entry.level];
  return (
    <span title={`${entry.levelLabel} — ${entry.short}`} className={cn("inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[8px]", tone[meta.tone])}>
      <Lock className="h-2.5 w-2.5" /> سطح {entry.level}
    </span>
  );
}

export function DocumentValidityPanel({ compact = false }: { compact?: boolean }) {
  const [filter, setFilter] = useState<"all" | AuthorityLevel>("all");
  const rows = AUTHORITY_ORDER.map((kind) => AUTHORITY[kind]).filter((entry) => filter === "all" || entry.level === filter);

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-mint-300/15 bg-mint-300/[0.04] p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 text-[11px] font-semibold text-[#e2f1e7]"><Lock className="h-3.5 w-3.5 text-mint-300" /> اعتبار حقوقی اسناد</h2>
            <p className="mt-1 max-w-3xl text-[9px] font-light leading-5 text-[#9db8ab]">
              هر سند یک سطح اعتبار دارد؛ بر پایهٔ قانون مدنی (۱۲۸۴ تا ۱۲۹۲)، قانون صدور چک و سامانهٔ صیاد، سامانهٔ مؤدیان و قانون الزام به ثبت رسمی معاملات.
              این تحلیل جای مشورت حقوقی پروندهٔ شما را نمی‌گیرد.
            </p>
          </div>
          <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] text-[#a9c3b6]">۴ سطح</span>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {([1, 2, 3, 4] as AuthorityLevel[]).map((level) => (
            <div key={level} className={cn("rounded-xl border p-2", tone[AUTHORITY_LEVELS[level].tone])}>
              <div className="text-[9px] font-bold">سطح {level}</div>
              <div className="mt-0.5 text-[8px] leading-4 opacity-90">{AUTHORITY_LEVELS[level].label}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {([["all", "همه"], [1, "سطح ۱"], [2, "سطح ۲"], [3, "سطح ۳"], [4, "بدون اعتبار"]] as ["all" | AuthorityLevel, string][]).map(([value, label]) => (
            <button key={String(value)} type="button" onClick={() => setFilter(value)} className={cn("rounded-lg px-2 py-1 text-[9px] transition", filter === value ? "bg-[#1d402f] text-mint-300" : "text-[#7f9b8e] hover:text-white")}>{label}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-2">
        {rows.map((entry) => (
          <details key={entry.kind} className="glass rounded-2xl p-3">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-[10px] font-semibold text-[#e5f1ea]">{entry.title}</h3>
                <p className="mt-0.5 text-[8px] font-light leading-4 text-[#89a598]">{entry.short}</p>
              </div>
              <ValidityBadge kind={entry.kind} />
            </summary>
            <div className="mt-2 space-y-1.5 border-t border-white/[0.06] pt-2 text-[8px] leading-4 text-[#a9c3b6]">
              <p><span className="text-mint-300">در برابر طرفین:</span> {entry.betweenParties}</p>
              <p><span className="text-sand-300">در برابر اشخاص ثالث:</span> {entry.againstThird}</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <div className="rounded-lg bg-mint-300/[0.06] p-1.5"><p className="text-mint-300">ثابت می‌کند</p><ul className="mt-0.5 list-disc pr-3">{entry.proves.map((item) => <li key={item}>{item}</li>)}</ul></div>
                <div className="rounded-lg bg-red-400/[0.06] p-1.5"><p className="text-red-300">ثابت نمی‌کند</p><ul className="mt-0.5 list-disc pr-3">{entry.doesNotProve.map((item) => <li key={item}>{item}</li>)}</ul></div>
              </div>
              <div>
                <p className="text-[#dcece3]">برای معتبرتر شدن</p>
                <ul className="mt-0.5 list-disc pr-3">{entry.needsToBeStronger.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <p className="text-[#dcece3]">شرایط لازم</p>
                <ul className="mt-0.5 space-y-0.5">
                  {entry.requirements.map((req) => (
                    <li key={req.label} className="rounded bg-white/[0.03] px-1.5 py-0.5">
                      <span className={req.importance === "الزامی" ? "text-red-300" : "text-sand-300"}>{req.importance}:</span> {req.label} — {req.note}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="rounded bg-white/[0.03] px-1.5 py-0.5"><span className="text-[#dcece3]">مبنای حقوقی:</span> {entry.legalBasis}</p>
              {entry.references.length > 0 && (
                <p className="flex flex-wrap gap-1">
                  {entry.references.map((ref) =>
                    ref.url ? <a key={ref.label} href={ref.url} target="_blank" rel="noreferrer" className="rounded border border-white/10 px-1.5 py-0.5 text-[#b9cec3] underline decoration-dotted">{ref.label}</a> : <span key={ref.label} className="rounded border border-white/10 px-1.5 py-0.5 text-[#8faa9d]">{ref.label}</span>,
                  )}
                </p>
              )}
            </div>
          </details>
        ))}
      </div>

      {!compact && (
        <div className="grid gap-2.5 lg:grid-cols-2">
          <div className="glass rounded-2xl p-3.5">
            <h3 className="flex items-center gap-1.5 text-[10px] font-semibold text-[#e3f0e8]"><BadgeCheck className="h-3.5 w-3.5 text-mint-300" /> روش چهار مرحله‌ای</h3>
            <ol className="mt-2 space-y-1.5 text-[9px] leading-5 text-[#9db8ab]">
              {VALIDITY_METHOD.map((step) => <li key={step.title}><span className="text-[#dcece3]">{step.title}:</span> {step.text}</li>)}
            </ol>
          </div>
          <div className="glass rounded-2xl p-3.5">
            <h3 className="flex items-center gap-1.5 text-[10px] font-semibold text-[#e3f0e8]"><AlertTriangle className="h-3.5 w-3.5 text-sand-300" /> اسنادی که فقط یادداشت‌اند (و حذف نمی‌شوند)</h3>
            <ul className="mt-2 space-y-1 text-[9px] leading-5 text-[#9db8ab]">
              <li>• گزارش دفتر مالی، معاملات، بهای تمام‌شده و انبار: یادداشت مدیریتی، بدون اثر اثباتی در دعوی.</li>
              <li>• فرم اطلاعات چک: چک بانکی نیست؛ باید برگهٔ چک و ثبت صیاد داشته باشد.</li>
              <li>• امضای ECDSA برنامه: اصالت فایل را نشان می‌دهد، نه امضای الکترونیکی مطمئن.</li>
              <li>• این اسناد عمداً در برنامه می‌مانند تا سابقه و مدیریت شما حفظ شود.</li>
            </ul>
          </div>
        </div>
      )}

      <p className="flex items-start gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5 text-[8px] leading-5 text-[#93ad9f]"><Info className="mt-0.5 h-3 w-3 shrink-0" /> {VALIDITY_DISCLAIMER}</p>
    </section>
  );
}
