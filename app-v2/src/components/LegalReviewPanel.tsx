import { AlertTriangle, Ban, ChevronDown, FileCheck2, Landmark, Scale, ShieldCheck } from "lucide-react";
import { cn } from "../utils/cn";
import { CHEQUE_PRINT_WARNING, LEGAL_DISCLAIMER_SHORT, LEGAL_PRINCIPLES, LEGAL_REVIEWS, type LegalClass } from "../lib/legal";

const classStyle: Record<LegalClass, { label: string; className: string }> = {
  "ordinary-document": { label: "سند عادی امضاشده", className: "border-mint-300/20 bg-mint-300/[0.07] text-mint-300" },
  "internal-report": { label: "گزارش داخلی", className: "border-sand-300/20 bg-sand-300/[0.06] text-sand-300" },
  "cheque-note": { label: "فرم غیرچک", className: "border-[#a25649]/30 bg-[#a25649]/10 text-[#efad9f]" },
};

const wetLabel = {
  yes: "امضای دستی طرفین: معتبر بین آنان",
  "between-parties": "سند عادی بین طرفین؛ برای آثار ثبتی، ثبت رسمی",
  "not-a-cheque": "چک بانکی نیست؛ قابل وصول در بانک نیست",
};

export function LegalReviewPanel() {
  const reviews = Object.values(LEGAL_REVIEWS);
  const cheque = LEGAL_REVIEWS["cheque-sheet"];

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-mint-300/15 bg-gradient-to-l from-mint-300/[0.055] to-white/[0.015]">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-mint-300/20 bg-mint-300/10 text-mint-300"><Scale className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[11px] font-semibold text-[#e8f4ec]">بازبینی حقوقی تک‌به‌تک اسناد</h2>
            <span className="rounded border border-mint-300/20 bg-mint-300/[0.07] px-1.5 py-0.5 text-[7px] text-mint-300">{reviews.length} سند بازبینی شد</span>
            <span className="rounded border border-white/10 px-1.5 py-0.5 text-[7px] text-[#a8c3b6]">قانون ایران — تطبیق‌شده با رویهٔ صیاد ۱۴۰۴/۱۴۰۵</span>
          </div>
          <p className="mt-1.5 text-[9px] leading-5 text-[#a9c3b6]">
            پاسخ کوتاه: <b className="text-[#d8ecdf]">همهٔ قراردادها، رسیدها، صورت‌جلسه‌ها و صورت‌حساب‌های چاپی، با مشخصات کامل و امضای دستی طرفین، «سند عادی» معتبر بین امضاکنندگان‌اند.</b> نسخهٔ الکترونیکی برنامه امضای مطمئن/سند رسمی نیست و برای زمین/مبالغ بالا ثبت رسمی توصیه می‌شود.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LEGAL_PRINCIPLES.map((principle) => (
              <span key={principle.title} className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[7px] text-[#a8c3b6]" title={`${principle.text} — ${principle.basis}`}>
                <ShieldCheck className="ml-1 inline h-2.5 w-2.5 text-mint-300" />
                {principle.title}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-4 mb-3 rounded-xl border border-[#a25649]/25 bg-[#a25649]/[0.07] p-3">
        <div className="flex items-start gap-2">
          <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#efad9f]" />
          <div>
            <p className="text-[9px] font-semibold text-[#f2c1b7]">چک چاپی A4 = چک بانکی نیست</p>
            <p className="mt-1 text-[8px] leading-5 text-[#d8b5ad]">{CHEQUE_PRINT_WARNING}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {["برگهٔ رسمی بانک", "شناسهٔ ۱۶ رقمی صیاد", "ثبت مبلغ/تاریخ/گیرنده در صیاد", "امضای اصلی مطابق نمونهٔ بانک", "تأیید/وصول گیرنده"].map((item) => <span key={item} className="rounded bg-[#a25649]/15 px-1.5 py-0.5 text-[7px] text-[#e7c3bc]">✓ {item}</span>)}
            </div>
          </div>
        </div>
      </div>

      <details className="group border-t border-white/[0.06]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-[9px] font-medium text-[#b9d2c5] transition hover:bg-white/[0.02]">
          <span className="flex items-center gap-1.5"><FileCheck2 className="h-3.5 w-3.5 text-mint-300" />دیدن نتیجهٔ بازبینی هر سند، کم‌وکسری‌ها و راه پیگیری قانونی</span>
          <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-2 px-4 pb-4 md:grid-cols-2">
          {reviews.map((review) => {
            const style = classStyle[review.legalClass];
            return (
              <div key={review.kind} className="rounded-xl border border-white/[0.06] bg-[#081712]/55 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-[9px] font-semibold leading-5 text-[#e3f0e8]">{review.title}</h3>
                  <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-[7px]", style.className)}>{review.classLabel}</span>
                </div>
                <p className="mt-1 text-[8px] leading-5 text-[#9ab5a8]">{review.summary}</p>
                <p className={cn("mt-1.5 flex items-start gap-1 text-[8px] leading-4", review.legalClass === "cheque-note" ? "text-[#efad9f]" : "text-mint-300/85")}>
                  {review.legalClass === "cheque-note" ? <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" /> : <Landmark className="mt-0.5 h-2.5 w-2.5 shrink-0" />}
                  {wetLabel[review.wetSignatureValid]}
                </p>
                <details className="mt-1.5 border-t border-white/[0.05] pt-1.5">
                  <summary className="cursor-pointer list-none text-[7px] text-[#8aa99a]">الزامات، ریسک‌ها و مبنا</summary>
                  <div className="mt-1.5 space-y-1.5 text-[7px] leading-4">
                    <p className="text-[#a8c3b6]"><b className="text-[#d7e9de]">الزامات: </b>{review.requirements.join("، ")}.</p>
                    <p className="text-[#c9b39b]"><b>ریسک‌ها: </b>{review.risks.join("، ")}.</p>
                    <p className="text-[#89a79a]"><b>مسیر پیگیری: </b>{review.enforcement}</p>
                    <p className="font-mono text-[6.5px] leading-4 text-[#6f8c7f]">{review.basis.join(" · ")}</p>
                  </div>
                </details>
              </div>
            );
          })}
          <p className="text-[7px] leading-5 text-[#78968a] md:col-span-2">{cheque.risks[0]} · {LEGAL_DISCLAIMER_SHORT}</p>
        </div>
      </details>
    </section>
  );
}
