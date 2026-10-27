import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  FileSignature,
  Fingerprint,
  Link2,
  LockKeyhole,
  Scale,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useSignatures } from "../lib/signatureContext";
import { buildSignableEntities } from "../lib/signable";
import { runSignatureSelfTest, signatureTierExplanation, type SignableEntity } from "../lib/signatures";
import { checkBiometric, type BiometricAvailability } from "../lib/biometric";
import type { DocumentSpec } from "../lib/documents";
import type { LedgerState } from "../lib/ledger";
import type { CropTrade } from "../lib/trade";
import { formatJalali, toPersianDigits, todayJalali } from "../lib/format";
import { SignatureDialog } from "../components/SignatureDialog";
import { Toast } from "../components/ui";
import { useEffect } from "react";

const TYPE_LABELS: Record<SignableEntity["type"], string> = {
  document: "سند",
  party: "بدهی/طلب",
  cheque: "چک",
  loan: "وام",
  trade: "معامله",
  asset: "دارایی",
  "inventory-move": "انبار",
};

export function SignaturesPage({
  ledger,
  trades,
  documents,
}: {
  ledger: LedgerState;
  trades: CropTrade[];
  documents: DocumentSpec[];
}) {
  const { audit } = useSignatures();
  const [filter, setFilter] = useState<"all" | "pending" | "complete" | SignableEntity["type"]>("pending");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<SignableEntity | null>(null);
  const [biometric, setBiometric] = useState<BiometricAvailability | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const selfTests = useMemo(() => runSignatureSelfTest(), []);

  useEffect(() => { void checkBiometric().then(setBiometric); }, []);

  const entities = useMemo(() => buildSignableEntities({ ledger, trades, documents }), [ledger, trades, documents]);
  const rows = entities.map((entity) => ({ entity, report: audit(entity) }));
  const pendingRows = rows.filter((row) => !row.report.complete);
  const completeRows = rows.filter((row) => row.report.complete);
  const invalidRows = rows.filter((row) => !row.report.chainValid);
  const visible = rows.filter((row) => {
    const matchFilter = filter === "all" || (filter === "pending" ? !row.report.complete : filter === "complete" ? row.report.complete : row.entity.type === filter);
    const haystack = `${row.entity.title} ${row.entity.subtitle} ${row.entity.serial} ${TYPE_LABELS[row.entity.type]}`;
    return matchFilter && (!search.trim() || haystack.includes(search.trim()));
  });

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]"><Fingerprint className="h-3.5 w-3.5 text-mint-300" />امضا و اعتبار اسناد<span className="rounded border border-mint-300/20 bg-mint-300/[0.07] px-1.5 py-0.5 text-[8px] text-mint-300">امضای الکترونیکی + بیومتریک</span></div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">مرکز امضا و اعتبار</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] font-light leading-6 text-[#89a598]">برای هر سند و تعهد، مشخص است چه کسانی باید امضا کنند؛ امضا با اثر انگشت گوشی تقویت می‌شود و hash محتوا تغییرها را آشکار می‌کند.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[9px] text-[#a8bfb3]"><Link2 className="h-3.5 w-3.5 text-mint-300" />زنجیره هش ازتغییر جلوگیری می‌کند</div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: "کل تعهدات قابل امضا", value: toPersianDigits(rows.length), icon: FileSignature, tone: "mint" },
          { label: "امضای کامل", value: toPersianDigits(completeRows.length), icon: BadgeCheck, tone: "mint" },
          { label: "نیازمند امضا", value: toPersianDigits(pendingRows.length), icon: AlertTriangle, tone: pendingRows.length ? "sand" : "mint" },
          { label: "هشدار زنجیره", value: toPersianDigits(invalidRows.length + (biometric?.status === "available" ? 0 : 0)), icon: AlertTriangle, tone: invalidRows.length ? "bad" : "mint" },
        ].map((stat) => { const Icon = stat.icon; return <div key={stat.label} className="glass rounded-2xl p-3.5"><div className="flex items-center justify-between"><span className="text-[9px] text-[#91ad9f]">{stat.label}</span><Icon className={cn("h-3.5 w-3.5", stat.tone === "bad" ? "text-[#efad9f]" : stat.tone === "sand" ? "text-sand-300" : "text-mint-300/80")} /></div><div className={cn("mt-1 text-lg font-bold", stat.tone === "bad" ? "text-[#efad9f]" : "text-[#eef8f1]")}>{stat.value}</div></div>; })}
      </div>

      <div className="mb-4 grid items-start gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-mint-300/15 bg-mint-300/[0.04] p-3.5">
          <div className="flex items-start gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-mint-300/10 text-mint-300"><Scale className="h-4 w-4" /></span><div><p className="text-[10px] font-semibold text-[#e2f1e7]">آیا امضای این برنامه رسمی است؟</p><p className="mt-1 text-[8px] leading-5 text-[#a8c3b6]">امضای ساده الکترونیکی + تأیید هویت دستگاه، شواهد قوی‌تری از توافق می‌سازد؛ اما «امضای الکترونیکی مطمئن» ماده ۱۰ قانون تجارت الکترونیکی نیست مگر گواهی معتبر مرکز صدور گواهی داشته باشد. برای قرارداد زمین، چک و مبالغ بالا، ثبت رسمی/امضای حضوری را هم انجام دهید.</p></div></div>
        </div>
        <div className="glass rounded-2xl p-3.5">
          <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-[10px] font-medium text-[#dcebe2]"><Fingerprint className="h-3.5 w-3.5 text-mint-300" />حسگر اثر انگشت دستگاه</div><span className={cn("rounded px-1.5 py-0.5 text-[8px]", biometric?.status === "available" ? "bg-mint-300/10 text-mint-300" : "bg-sand-300/10 text-sand-300")}>{biometric?.status === "available" ? "آماده" : "غیرفعال"}</span></div>
          <p className="mt-1 text-[8px] leading-4 text-[#78968a]">{biometric?.note ?? "در حال بررسی…"}</p>
          <p className="mt-1 text-[7px] leading-4 text-[#6f8c7f]">تا ۳ تلاش؛ هر اثر انگشت ثبت‌شده در گوشی پذیرفته می‌شود. تصویر اثر انگشت در برنامه ذخیره نمی‌شود.</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجوی عنوان، شماره یا نوع…" className="field flex-1 text-[11px]" aria-label="جست‌وجوی تعهد" />
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
          {([["pending", "نیازمند امضا"], ["complete", "کامل"], ["all", "همه"], ["document", "اسناد"], ["party", "بدهی/طلب"], ["cheque", "چک"], ["loan", "وام"]] as ["pending" | "complete" | "all" | SignableEntity["type"], string][]).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={cn("shrink-0 rounded-lg px-2.5 py-2 text-[8px] transition", filter === value ? "bg-[#1d402f] font-medium text-mint-300" : "text-[#7f9b8e]")}>{label}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {visible.map(({ entity, report }) => (
          <article key={entity.id} className="glass flex flex-col rounded-2xl p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-[#a9c3b6]">{entity.type === "cheque" ? <LockKeyhole className="h-4 w-4" /> : entity.type === "party" ? <UsersRound className="h-4 w-4" /> : <FileSignature className="h-4 w-4" />}</span>
                <div className="min-w-0"><h3 className="truncate text-[10px] font-semibold text-[#e5f1e9]">{entity.title}</h3><p className="mt-0.5 line-clamp-2 text-[8px] leading-4 text-[#819d90]">{entity.subtitle}</p></div>
              </div>
              <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[8px]", report.complete ? "bg-mint-300/10 text-mint-300" : "bg-sand-300/10 text-sand-300")}>{toPersianDigits(report.signed)}/{toPersianDigits(report.required)}</span>
            </div>
            <div className="mt-2 rounded-lg bg-white/[0.02] px-2 py-1.5 text-[7px] text-[#78968a]"><span className="font-mono">{entity.serial}</span> · {TYPE_LABELS[entity.type]} · {formatJalali(entity.createdAt, "short")}</div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className={cn("flex items-center gap-1 text-[8px]", report.chainValid ? "text-mint-300" : "text-[#efad9f]")}>{report.chainValid ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{report.chainValid ? "زنجیره سالم" : "هشدار زنجیره"}</span>
              <button type="button" onClick={() => setActive(entity)} className="flex items-center gap-1 rounded-lg bg-mint-300/[0.08] px-2.5 py-1.5 text-[8px] text-mint-300">{report.complete ? "مشاهده امضاها" : "امضا"} <Fingerprint className="h-3 w-3" /></button>
            </div>
          </article>
        ))}
      </div>

      {visible.length === 0 && <div className="rounded-2xl border border-dashed border-[#355344] bg-white/[0.015] px-5 py-12 text-center"><ShieldCheck className="mx-auto mb-2 h-6 w-6 text-[#6f8e80]" /><p className="text-xs text-[#c2d6cb]">موردی برای این فیلتر نیست.</p><p className="mt-1 text-[9px] text-[#78968a]">با ثبت معامله، طرف‌حساب، چک، وام یا زمین، تعهدهای قابل امضا اینجا ساخته می‌شوند.</p></div>}

      <div className="mt-4 grid items-start gap-3 lg:grid-cols-2">
        <details className="glass rounded-2xl p-4">
          <summary className="cursor-pointer text-[11px] font-semibold text-white">چه کسی باید امضا کند؟ جدول نقش‌ها</summary>
          <ul className="mt-2 space-y-2 text-[8px] leading-5 text-[#9db8ab]">
            <li><b>قرارداد فروش محصول:</b> فروشنده + خریدار؛ شاهد اختیاری.</li>
            <li><b>قبض باسکول:</b> مسئول باسکول + تحویل‌دهنده/فروشنده.</li>
            <li><b>صورتجلسه کیفیت:</b> نمونه‌بردار + مسئول آزمایشگاه + فروشنده.</li>
            <li><b>صورت‌حساب و تسویه:</b> فروشنده (طلبکار) + خریدار (بدهکار).</li>
            <li><b>چک:</b> صادرکننده چک + دریافت‌کننده آن؛ در نسخه چاپی، امضای صاحب حساب و ظهرنویسی مطابق قانون صدور چک در دسته‌چک کاغذی/بانک انجام می‌شود.</li>
            <li><b>وام:</b> وام‌گیرنده + وام‌دهنده؛ شاهد اختیاری.</li>
            <li><b>بدهی/طلب:</b> ثبت‌کننده + طرف بدهی/طلب؛ پرداخت‌ها با تاریخ جداگانه در دفتر معین.</li>
            <li><b>قرارداد زمین:</b> موجر + مستاجر؛ شاهد اختیاری. برای مبالغ بالا ثبت رسمی توصیه می‌شود.</li>
          </ul>
        </details>
        <details className="glass rounded-2xl p-4">
          <summary className="cursor-pointer text-[11px] font-semibold text-white">آزمون‌های امنیت و اصالت ({toPersianDigits(selfTests.filter((test) => test.pass).length)}/{toPersianDigits(selfTests.length)})</summary>
          <div className="mt-2 space-y-1.5">{selfTests.map((test) => <div key={test.name} className="flex items-start gap-2 text-[8px]"><span className={cn("mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full", test.pass ? "bg-mint-300/15 text-mint-300" : "bg-[#a25649]/20 text-[#efad9f]")}>{test.pass ? <Check className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}</span><span className="text-[#a9c1b5]"><b>{test.name}</b> — <span className="text-[#7f9b8e]">{test.detail}</span></span></div>)}</div>
        </details>
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3 text-[8px] leading-5 text-[#718e81]">
        <p><b>مبنای قانونی:</b> {signatureTierExplanation()[2]}</p>
        <p className="mt-1">پشتیبان‌گیری امضاها در بخش «دستیار و پشتیبان» انجام می‌شود. حذف امضا فقط با تأیید و در همین دیالوگ امکان‌پذیر است. تاریخ امروز: {formatJalali(todayJalali(), "long")}.</p>
      </div>

      <SignatureDialog entity={active} open={Boolean(active)} onClose={() => setActive(null)} />
      <Toast open={Boolean(toast)} message={toast ?? ""} onClose={() => setToast(null)} />
    </div>
  );
}
