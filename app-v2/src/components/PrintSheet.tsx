import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FileCheck2,
  Printer,
  QrCode,
  ShieldCheck,
  X,
} from "lucide-react";
import type { SavedContract } from "../lib/data";
import { useProfile, profileDisplayName, profileFarmLine } from "../lib/profile";
import { useSignatures } from "../lib/signatureContext";
import { documentEntity } from "../lib/signable";
import { SignatureDialog } from "./SignatureDialog";
import { Fingerprint } from "lucide-react";
import type { DocumentSpec } from "../lib/documents";
import { verificationData, verificationPayload } from "../lib/documents";
import { deliverDocumentPdf, deliverHtmlFile, printSheetInPage } from "../lib/pdf";
import {
  formatJalali,
  formatNumber,
  numberToPersianWords,
  toPersianDigits,
} from "../lib/format";
import {
  PAYMENT_METHOD_LABELS,
  PRODUCT_PROFILES,
  tradeBalance,
} from "../lib/trade";

const PRINT_CSS = `
  body{font-family:Vazirmatn,Tahoma,sans-serif;background:#eee;margin:0;padding:24px;direction:rtl;color:#18241e}
  .sheet{max-width:210mm;min-height:297mm;margin:0 auto;padding:14mm;background:#fff;box-sizing:border-box}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  th,td{border:1px solid #b9b4a7;padding:6px;text-align:right;font-size:11px}
  th{background:#f0eee5}
`;

const thClass = "border border-[#c9c4b4] bg-[#f1efe6] px-2 py-1.5 text-[10px] font-semibold text-[#27362e]";
const tdClass = "border border-[#d9d4c5] px-2 py-1.5 text-[10px] text-[#1e2a23]";
const sectionTitle = "mb-2 flex items-center gap-2 border-b border-[#d8d3c4] pb-1 text-[11px] font-extrabold text-[#1c4533]";

function num(value: number): string {
  return toPersianDigits(formatNumber(Math.round(value)));
}

function kg(value: number): string {
  return `${toPersianDigits(formatNumber(Math.round(value * 100) / 100))} کیلوگرم`;
}

function money(value: number): string {
  return `${num(value)} تومان`;
}

function words(value: number): string {
  return `${numberToPersianWords(Math.round(value))} تومان`;
}

function Row({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-[#e2ded2] py-1 text-[10px] last:border-0">
      <span className="text-[#6f7b72]">{label}</span>
      <span className={strong ? "font-bold text-[#1d3c2c]" : "text-[#2b3831]"}>{value}</span>
    </div>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className={sectionTitle}>
        <span className="grid h-4 w-4 place-items-center rounded bg-[#1d5139] text-[8px] font-bold text-white">{number}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ContractSignaturesBlock({ contract }: { contract: SavedContract }) {
  const signatures = contract.signatures ?? [];
  const slots = [
    { role: "landlord" as const, label: "موجر / مالک زمین" },
    { role: "tenant" as const, label: "مستاجر / بهره‌بردار" },
    { role: "witness" as const, label: "شاهد (اختیاری)" },
  ];
  return (
    <div className="mt-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-[8px] font-bold text-[#4c5a51]">
        <span>امضای الکترونیکی قرارداد — {signatures.length ? `${toPersianDigits(signatures.length)} امضا ثبت شده` : "امضا ثبت نشده"}</span>
        <span className="font-mono">کد پیگیری: {contract.trackingCode || contract.code}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {slots.map((slot) => {
          const signature = signatures.find((row) => row.role === slot.role);
          return (
            <div key={slot.role} className="rounded border border-[#c8c3b5] p-2 text-center">
              <div className="mb-1 text-[8px] font-semibold text-[#4c5a51]">{slot.label}</div>
              {signature ? <><img src={signature.image} alt={`امضای ${signature.signerName}`} className="mx-auto h-12 max-w-full object-contain" /><div className="mt-1 text-[8px] font-medium text-[#2e4a38]">{signature.signerName}</div><div className="text-[7px] text-[#7c877d]">{formatJalali(signature.signedAt, "short")} · {signature.hash}</div></> : <><div className="mb-5 border-b border-dashed border-[#a9a394]" /><div className="text-[8px] text-[#9aa096]">نام، مهر و امضا</div></>}
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[7px] leading-4 text-[#6f7a70]">امضای الکترونیکی ساده ثبت‌شده در برنامه؛ برای اعتبار رسمی و سند رسمی، امضای حضوری/دفتر اسناد رسمی نیز لازم است.</p>
    </div>
  );
}

function SignatureStatusBlock({ spec }: { spec: DocumentSpec }) {
  const { audit } = useSignatures();
  const entity = documentEntity(spec);
  const report = audit(entity);
  return (
    <div className="mt-3 rounded border border-[#cdbf8b] bg-[#f8f3e2] p-2.5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-[8px] font-bold text-[#4b5a50]">
        <span>وضعیت امضای الکترونیکی: {toPersianDigits(report.signed)} از {toPersianDigits(report.required)} امضای الزامی {report.complete ? "— کامل" : "— ناقص"}</span>
        <span>هش محتوا: {report.payloadHash.slice(0, 16)}… · {report.chainValid ? "زنجیره معتبر" : "هشدار زنجیره"}</span>
      </div>
      {report.records.length > 0 ? (
        <table>
          <thead><tr><th className={thClass}>سمت</th><th className={thClass}>نام امضاکننده</th><th className={thClass}>تاریخ</th><th className={thClass}>روش</th><th className={thClass}>کد اصالت</th></tr></thead>
          <tbody>{report.records.map((record) => <tr key={record.id}><td className={tdClass}>{entity.roles.find((role) => role.role === record.role)?.label ?? record.role}</td><td className={tdClass}>{record.signerName}</td><td className={tdClass}>{formatJalali(record.signedAt, "long")}</td><td className={tdClass}>{record.biometric.verified ? "دستی + بیومتریک دستگاه" : "دستی"}</td><td className={`${tdClass} font-mono`}>{record.verifyCode}</td></tr>)}</tbody>
        </table>
      ) : <p className="text-[8px] text-[#6b7068]">هنوز امضایی ثبت نشده است؛ امضاها به‌صورت الکترونیکی در برنامه و با کد اصالت ثبت می‌شوند.</p>}
      <p className="mt-1 text-[7px] leading-4 text-[#6f7a70]">این امضا «امضای الکترونیکی ساده» است و جایگزین امضای الکترونیکی مطمئن (نیازمند گواهی معتبر) یا سند رسمی و دسته‌چک کاغذی نیست. امضاهای دستی جای خالی روی نسخه چاپی برای کسانی است که امکان امضای الکترونیکی ندارند.</p>
    </div>
  );
}

function SignatureBoxes({ roles }: { roles: string[] }) {
  return (
    <div className={`mt-5 grid gap-3 ${roles.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {roles.map((role) => (
        <div key={role} className="rounded border border-[#c8c3b5] p-2">
          <div className="mb-6 text-[9px] font-semibold text-[#4c5a51]">{role}</div>
          <div className="border-b border-dashed border-[#a9a394] pb-1 text-center text-[8px] text-[#8a9188]">نام، مهر و امضا</div>
          <div className="mt-1 text-center text-[8px] text-[#8a9188]">تاریخ: ...... / ...... / ۱۴......</div>
        </div>
      ))}
    </div>
  );
}

function Watermark({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
      <span className="rotate-[-28deg] whitespace-nowrap text-[58px] font-black tracking-widest text-[#1b5139]/[0.055]">{text}</span>
    </div>
  );
}

function VerificationQR({ text }: { text: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 1, width: 320, color: { dark: "#14251c", light: "#ffffff" } })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => setSrc(""));
    return () => {
      cancelled = true;
    };
  }, [text]);
  return (
    <div className="flex flex-col items-center gap-1">
      {src ? <img src={src} alt="QR استعلام سند" className="h-[86px] w-[86px]" /> : <QrCode className="h-[86px] w-[86px] text-[#41594b]" />}
      <span className="text-[7px] text-[#69756c]">اسکن برای استعلام</span>
    </div>
  );
}

export function DocumentDialog({
  spec,
  onClose,
  onPrint,
}: {
  spec: DocumentSpec;
  onClose: () => void;
  onPrint?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState<"fit" | "large">("fit");
  const [busy, setBusy] = useState<"pdf" | "html" | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const { audit } = useSignatures();
  const signatureEntity = documentEntity(spec);
  const signatureReport = audit(signatureEntity);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const downloadHtml = () => {
    const sheet = document.getElementById("print-root")?.outerHTML ?? "";
    const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${spec.meta.title} — ${spec.serial}</title><style>${PRINT_CSS}</style></head><body>${sheet}</body></html>`;
    const ok = deliverHtmlFile(html, spec.serial);
    setStatus(ok ? { tone: "ok", text: "فایل HTML ذخیره شد؛ در مرورگر باز و چاپ کنید." } : { tone: "err", text: "ذخیره فایل ممکن نشد." });
  };

  const downloadPdf = async () => {
    setBusy("pdf");
    setStatus({ tone: "info", text: "در حال ساخت PDF…" });
    const result = await deliverDocumentPdf(document.getElementById("print-root"), spec.serial);
    setBusy(null);
    setStatus({ tone: result.ok ? "ok" : "err", text: result.message });
  };

  const copyCode = () => {
    void navigator.clipboard?.writeText(spec.verificationCode);
    setCopied(true);
    setStatus({ tone: "ok", text: "کد استعلام کپی شد." });
    window.setTimeout(() => setCopied(false), 2200);
  };

  const printNow = () => {
    onPrint?.();
    const done = printSheetInPage(document.getElementById("print-root"), `${spec.meta.title} — ${spec.serial}`);
    setStatus(
      done
        ? { tone: "info", text: "پنجره چاپ باز شد. برای ذخیره، «Save as PDF» را انتخاب کنید. اگر باز نشد از «دانلود PDF» استفاده کنید." }
        : { tone: "err", text: "چاپ در این دستگاه پشتیبانی نشد؛ از «دانلود PDF» استفاده کنید." }
    );
  };

  return createPortal(
    <div className="doc-overlay fixed inset-0 z-[100] flex flex-col bg-[#07110d]/95" role="dialog" aria-modal="true" aria-label={`پیش‌نمایش ${spec.meta.title}`}>
      <div className="no-print shrink-0 border-b border-white/10 bg-[#0b1a13]">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-mint-300/20 bg-mint-300/10 text-mint-300">
              <FileCheck2 className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[12px] font-semibold text-white sm:text-sm">{spec.meta.title}</h2>
              <p className="mt-0.5 truncate text-[9px] text-[#89a396]">{spec.serial} · {formatJalali(spec.date, "long")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setSignOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-[#9fd4ee]/30 bg-[#9fd4ee]/10 px-2.5 py-2 text-[9px] text-[#bfe6f7] transition hover:bg-[#9fd4ee]/20">
              <Fingerprint className="h-3.5 w-3.5" />
              امضا ({toPersianDigits(signatureReport.signed)}/{toPersianDigits(signatureReport.required)})
            </button>
            <button type="button" onClick={downloadPdf} disabled={busy !== null} className="flex items-center gap-1.5 rounded-lg bg-mint-400 px-3 py-2 text-[9px] font-bold text-[#07110d] transition hover:bg-mint-300 disabled:opacity-60">
              <Download className="h-3.5 w-3.5" />
              {busy === "pdf" ? "در حال ساخت…" : "دانلود PDF"}
            </button>
            <button type="button" onClick={printNow} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[9px] text-[#d4e5db] transition hover:bg-white/[0.08]">
              <Printer className="h-3.5 w-3.5" />
              چاپ
            </button>
            <button type="button" onClick={downloadHtml} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[9px] text-[#b9cec3] transition hover:bg-white/[0.08]">
              <FileCheck2 className="h-3.5 w-3.5" />
              ذخیره HTML
            </button>
            <button type="button" onClick={copyCode} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[9px] text-[#b9cec3] transition hover:bg-white/[0.08]">
              {copied ? <Check className="h-3.5 w-3.5 text-mint-300" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "کپی شد" : "کد استعلام"}
            </button>
            <button type="button" onClick={() => setZoom((current) => (current === "fit" ? "large" : "fit"))} className="hidden items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-[9px] text-[#b9cec3] sm:flex">
              <QrCode className="h-3.5 w-3.5" />
              {zoom === "fit" ? "بزرگ‌نمایی" : "تناسب صفحه"}
            </button>
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-[#9fb6aa] transition hover:bg-white/5 hover:text-white" aria-label="بستن پیش‌نمایش">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {status && (
          <div className={`flex items-start gap-2 px-3 pb-2 text-[9px] leading-5 sm:px-5 ${status.tone === "err" ? "text-[#f0a99c]" : status.tone === "ok" ? "text-[#a9dfbf]" : "text-[#c9d7cd]"}`}>
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{status.text}</span>
          </div>
        )}
      </div>

      <div className="doc-scroll flex-1 overflow-auto bg-[#dfddd4] p-2 sm:p-6">
        <div className="mx-auto mb-2 flex max-w-[820px] flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-1.5 text-[8px] text-[#4d5a51]">
          <span>پیش‌نمایش A4 — «دانلود PDF» فایل واقعی می‌سازد؛ «چاپ» همان سند را به چاپگر می‌فرستد.</span>
          <span className="font-mono tracking-wider">VERIFY: {spec.verificationCode}</span>
        </div>
        <div className="mx-auto" style={zoom === "large" ? { width: 794 } : { width: "100%", maxWidth: 794 }}>
          <div id="print-root">
            <DocumentSheet spec={spec} />
          </div>
        </div>
      </div>
      <SignatureDialog entity={signatureEntity} open={signOpen} onClose={() => setSignOpen(false)} />
    </div>,
    document.body
  );
}

function DocumentSheet({ spec }: { spec: DocumentSpec }) {
  const { profile } = useProfile();
  const trade = spec.payload.trade;
  const contract = spec.payload.contract;
  const isDraft = trade?.status === "draft";
  const result = trade?.result;
  const balance = trade ? tradeBalance(trade) : null;
  const product = trade ? PRODUCT_PROFILES[trade.productId] : null;

  const totalReceipt = result?.netReceipt ?? 0;
  const paid = balance?.paid ?? 0;
  const remaining = balance?.remaining ?? totalReceipt;

  return (
    <article className="print-sheet relative mx-auto max-w-[820px] overflow-hidden rounded-sm bg-[#fdfcf8] p-5 text-[#18241e] shadow-[0_16px_50px_rgba(0,0,0,0.25)] sm:p-8">
      {isDraft && <Watermark text="پیش‌نویس — بدون اعتبار نهایی" />}
      <div className="relative z-10">
        <header className="mb-4">
          <div className="mb-3 flex items-center justify-between gap-4 border-b-2 border-[#1c5139] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#1c5139] text-[#f4e7b8]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-[13px] font-extrabold leading-5 text-[#173c2b]">{profileDisplayName(profile)}</h1>
                <p className="mt-0.5 text-[8px] text-[#67736a]">دفتر کل آرام مزرعه · {profile.businessName || "کسب‌وکار کشاورزی"}</p>
                <p className="mt-0.5 text-[7px] text-[#879085]">{profileFarmLine(profile)}{profile.nationalId ? ` · شناسه ملی ${profile.nationalId}` : ""}</p>
              </div>
            </div>
            <div className="text-center">
              <div className="text-[8px] tracking-wider text-[#879085]">بسمه تعالی</div>
              <h2 className="mt-1 text-[14px] font-extrabold text-[#173c2b] sm:text-[16px]">{spec.meta.title}</h2>
              <div className="mt-1 inline-block rounded-full border border-[#c5b97f] px-2 py-0.5 text-[8px] text-[#7c6a2f]">
                سند داخلی قابل ارائه و بایگانی
              </div>
            </div>
            <div className="min-w-[120px] text-left text-[8px] leading-5 text-[#5b685e]">
              <div>شماره سند: <b className="font-mono text-[9px] text-[#203d2d]">{spec.serial}</b></div>
              <div>تاریخ: <b>{formatJalali(spec.date, "long")}</b></div>
              <div>کد استعلام: <b className="font-mono">{spec.verificationCode}</b></div>
              <div>صفحه: ۱ از ۱</div>
            </div>
          </div>
        </header>

        {spec.kind === "sale-contract" && trade && product && result && (
          <>
            <Section number="۱" title="طرفین قرارداد">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded border border-[#ddd8ca] bg-[#faf8f1] p-3">
                  <div className="mb-1 text-[9px] font-bold text-[#30543f]">فروشنده (طرف اول)</div>
                  <Row label="نام / واحد" value={trade.sellerName} />
                  <Row label="شناسه ملی" value={trade.sellerNationalId} />
                  <Row label="تلفن" value={trade.sellerPhone} />
                  <Row label="محل تولید" value={trade.farmTitle} />
                </div>
                <div className="rounded border border-[#ddd8ca] bg-[#faf8f1] p-3">
                  <div className="mb-1 text-[9px] font-bold text-[#30543f]">خریدار (طرف دوم)</div>
                  <Row label="نام / واحد" value={trade.buyerName} />
                  <Row label="نوع خریدار" value={trade.buyerType} />
                  <Row label="شناسه ملی" value={trade.buyerNationalId} />
                  <Row label="نشانی" value={trade.buyerAddress} />
                </div>
              </div>
            </Section>

            <Section number="۲" title="موضوع و مشخصات محموله">
              <table>
                <thead>
                  <tr>
                    <th className={thClass}>محصول</th>
                    <th className={thClass}>وزن خالص</th>
                    <th className={thClass}>وزن قابل پرداخت</th>
                    <th className={thClass}>درجه کیفی</th>
                    <th className={thClass}>نرخ واحد (پس از درجه)</th>
                    <th className={thClass}>ارزش محصول</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-center">
                    <td className={tdClass}>{product.name}</td>
                    <td className={tdClass}>{kg(result.netKg)}</td>
                    <td className={tdClass}>{kg(result.payableKg)}</td>
                    <td className={tdClass}>{result.quality.label}</td>
                    <td className={tdClass}>{money(result.adjustedUnitPrice)}</td>
                    <td className={`${tdClass} font-bold`}>{money(result.grossValue)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded border border-[#ddd8ca] p-2.5">
                  <Row label="رطوبت" value={`${toPersianDigits(trade.quality.moisture)}٪`} />
                  <Row label="افت مفید" value={`${toPersianDigits(trade.quality.usefulLossPercent)}٪`} />
                  <Row label="افت غیرمفید" value={`${toPersianDigits(trade.quality.nonUsefulLossPercent)}٪`} />
                  <Row label="هکتولیتر" value={`${toPersianDigits(trade.quality.hectoliter)} kg/hl`} />
                </div>
                <div className="rounded border border-[#ddd8ca] p-2.5">
                  <Row label="پروتئین" value={`${toPersianDigits(trade.quality.protein)}٪`} />
                  <Row label="سن‌زدگی" value={`${toPersianDigits(trade.quality.sprouted)}٪`} />
                  <Row label="دانه شکسته" value={`${toPersianDigits(trade.quality.broken)}٪`} />
                  <Row label="محل تحویل" value={trade.buyerAddress} />
                </div>
              </div>
            </Section>

            <Section number="۳" title="شرایط قرارداد">
              <div className="space-y-1.5 text-justify text-[9px] leading-6 text-[#35433a]">
                <p><b>ماده ۳-۱ (موضوع):</b> فروشنده متعهد می‌شود محموله‌ی {product.name} با مشخصات کیفی مندرج در این سند را به خریدار تسلیم کند. خریدار نیز متعهد به پرداخت بهاء به نرخ مقرر است.</p>
                <p><b>ماده ۳-۲ (وزن و کیفیت):</b> ملاک تسویه، وزن خالص باسکول و نتیجه نمونه‌برداری مشترک است. هرگونه اختلاف در نمونه، با نمونه‌ی کنترلی و آزمایشگاه مرجع بررسی می‌شود. درجه‌بندی بر پایه ضعیف‌ترین شاخص انجام شده است.</p>
                <p><b>ماده ۳-۳ (قیمت و پرداخت):</b> ارزش محصول {money(result.grossValue)} است. هزینه‌های فروشنده (کرایه، تخلیه، کارمزد و …) به مبلغ {money(result.costs.total)} کسر و خالص قابل پرداخت {money(result.netReceipt)} تعیین می‌شود. روش پرداخت: {PAYMENT_METHOD_LABELS[trade.paymentMethod]}{trade.chequeNo ? ` — چک شماره ${trade.chequeNo}` : ""}.</p>
                <p><b>ماده ۳-۴ (تحویل):</b> محل تحویل {trade.buyerAddress}، وسیله حمل به پلاک {trade.vehiclePlate} و راننده {trade.driverName} است. مسئولیت تا لحظه تحویل در انبار خریدار برعهده فروشنده و پس از آن برعهده خریدار است.</p>
                <p><b>ماده ۳-۵ (مالیات):</b> {trade.taxExempt ? "محصول کشاورزی فرآوری‌نشده، با استناد به جزء ۱ بند «الف» ماده ۹ قانون مالیات بر ارزش افزوده ۱۴۰۰، از مالیات و عوارض معاف است." : `مالیات با نرخ ${toPersianDigits(trade.taxRate)}٪ محاسبه شده است.`}</p>
                <p><b>ماده ۳-۶ (تعهدات و فسخ):</b> هرگونه تغییر کاربری، مخلوط کردن محموله یا ارائه مدارک نادرست، حق فسخ و مطالبه خسارت را برای طرف مقابل ایجاد می‌کند. فسخ یا اصلاح، با صورتجلسه کتبی معتبر است.</p>
                <p><b>ماده ۳-۷ (حل اختلاف):</b> ابتدا مذاکره، سپس میانجیگری اتاق تعاون/جهاد کشاورزی و در نهایت مرجع صالح قضایی. این سند با استناد به {spec.meta.legalBasis} تنظیم شده و رسمیت آن در برابر اشخاص ثالث تابع ثبت رسمی و مقررات است.</p>
                {trade.notes && <p><b>توضیحات طرفین:</b> {trade.notes}</p>}
              </div>
            </Section>
            <div className="mt-3 rounded border border-[#cdbf8b] bg-[#f8f3e2] p-2.5 text-[9px] leading-6">
              <b>مبلغ خالص قابل پرداخت به حروف:</b> {words(result.netReceipt)}
            </div>
            <div className="mt-2 rounded border border-[#ddd8ca] p-2.5">
              <div className="grid gap-2 sm:grid-cols-3">
                <Row label="خالص قابل پرداخت" value={money(result.netReceipt)} strong />
                <Row label="روش پرداخت" value={PAYMENT_METHOD_LABELS[trade.paymentMethod]} />
                <Row label="سررسید" value={formatJalali(trade.dueDate, "long")} />
              </div>
            </div>
            <div className="mt-2 rounded border border-[#ddd8ca] bg-[#f7f4ea] p-2.5 text-[8px] leading-5 text-[#4b5a50]">
              <b>درباره اصالت این سند:</b> این برگه یک پیش‌نویس قرارداد داخلی است و «سند رسمی» یا «صورتحساب الکترونیکی سامانه مؤدیان» محسوب نمی‌شود. برای اعتبار در برابر اشخاص ثالث، ثبت در دفتر اسناد رسمی یا ارسال به سامانه مربوط لازم است. مهر و امضای طرفین روی نسخه‌های چاپی، منشأ توافق است.
            </div>
            <SignatureBoxes roles={spec.meta.signatureRoles} />
          </>
        )}

        {spec.kind === "weigh-ticket" && trade && result && (
          <>
            <Section number="۱" title="مشخصات محموله و خودرو">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded border border-[#ddd8ca] p-2.5">
                  <Row label="فروشنده" value={trade.sellerName} />
                  <Row label="خریدار / انبار" value={trade.buyerName} />
                  <Row label="محصول و منشأ" value={`${PRODUCT_PROFILES[trade.productId].name} — ${trade.farmTitle}`} />
                  <Row label="شماره باسکول" value={trade.weighbridgeNo} />
                </div>
                <div className="rounded border border-[#ddd8ca] p-2.5">
                  <Row label="شماره پلاک خودرو" value={trade.vehiclePlate} />
                  <Row label="نام راننده" value={trade.driverName} />
                  <Row label="تلفن راننده" value={trade.driverPhone} />
                  <Row label="تاریخ ورود / خروج" value={`${formatJalali(trade.date, "short")} — ...... : ......`} />
                </div>
              </div>
            </Section>
            <Section number="۲" title="وزن‌های ثبت‌شده">
              <table>
                <thead>
                  <tr>
                    <th className={thClass}>شرح</th>
                    <th className={thClass}>وزن (کیلوگرم)</th>
                    <th className={thClass}>زمان</th>
                    <th className={thClass}>مهر / امضای باسکول</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className={tdClass}>وزن کامیون پر (ناخالص)</td><td className={`${tdClass} font-bold`}>{kg(trade.quality.grossKg)}</td><td className={tdClass}>...... : ......</td><td className={tdClass}>.........</td></tr>
                  <tr><td className={tdClass}>وزن کامیون خالی (تار)</td><td className={`${tdClass} font-bold`}>{kg(trade.quality.tareKg)}</td><td className={tdClass}>...... : ......</td><td className={tdClass}>.........</td></tr>
                  <tr className="bg-[#f3f0e5]"><td className={`${tdClass} font-bold`}>وزن خالص</td><td className={`${tdClass} font-extrabold text-[#1d5139]`}>{kg(result.netKg)}</td><td className={tdClass}>—</td><td className={tdClass}>.........</td></tr>
                  <tr><td className={tdClass}>وزن قابل پرداخت پس از کسورات</td><td className={`${tdClass} font-bold`}>{kg(result.payableKg)}</td><td className={tdClass}>—</td><td className={tdClass}>.........</td></tr>
                </tbody>
              </table>
              <p className="text-[8px] leading-5 text-[#66736a]">این قبض فقط سند تحویل و وزن است و به‌تنهایی سند مالکیت یا تسویه مالی محسوب نمی‌شود. اعتراض به وزن باید پیش از خروج خودرو از باسکول ثبت شود.</p>
            </Section>
            <SignatureBoxes roles={spec.meta.signatureRoles} />
          </>
        )}

        {spec.kind === "quality-minutes" && trade && result && (
          <>
            <Section number="۱" title="روش نمونه‌برداری">
              <p className="text-justify text-[9px] leading-6 text-[#3e4c42]">
                نمونه‌برداری از {trade.farmTitle}، محموله پلاک {trade.vehiclePlate}، به روش تصادفی از نقاط مختلف بار در حضور نماینده فروشنده انجام شد. نمونه در ظرف دربسته به آزمایشگاه منتقل و نتایج زیر ثبت گردید. نمونه کنترلی به مدت ۷۲ ساعت نگهداری می‌شود.
              </p>
            </Section>
            <Section number="۲" title="نتایج آزمون کیفیت">
              <table>
                <thead>
                  <tr><th className={thClass}>شاخص</th><th className={thClass}>مقدار اندازه‌گیری</th><th className={thClass}>حدود مرجع</th><th className={thClass}>وضعیت</th></tr>
                </thead>
                <tbody>
                  {result.quality.metrics.map((metric) => (
                    <tr key={metric.label}>
                      <td className={tdClass}>{metric.label}</td>
                      <td className={`${tdClass} font-bold`}>{metric.value}</td>
                      <td className={tdClass}>{metric.limit}</td>
                      <td className={tdClass}>
                        {metric.status === "good" ? "در محدوده درجه یک" : metric.status === "warn" ? "کاهش درجه" : "خارج از حدود"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
            <Section number="۳" title="افت‌ها، درجه و اثر مالی">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded border border-[#ddd8ca] p-2.5">
                  <Row label="افت رطوبت" value={kg(result.moistureLossKg)} />
                  <Row label="افت مفید" value={kg(result.usefulLossKg)} />
                  <Row label="افت غیرمفید" value={kg(result.nonUsefulLossKg)} />
                </div>
                <div className="rounded border border-[#ddd8ca] p-2.5">
                  <Row label="درجه نهایی" value={result.quality.label} strong />
                  <Row label="ضریب قیمت" value={toPersianDigits(result.quality.factor)} />
                  <Row label="نرخ مصوب/توافقی" value={money(result.adjustedUnitPrice)} />
                </div>
                <div className="rounded border border-[#ddd8ca] p-2.5">
                  <Row label="وزن قابل پرداخت" value={kg(result.payableKg)} strong />
                  <Row label="ارزش محموله" value={money(result.grossValue)} strong />
                  <Row label="شاخص محدودکننده" value={result.quality.limitingFactor} />
                </div>
              </div>
              <p className="mt-2 text-[8px] leading-5 text-[#66736a]">مبنای چارچوب: {spec.meta.legalBasis}. درجه و ضرایب قیمت این نسخه، مدل عملیاتی داخلی است و باید با جدول پاکی/قرارداد خریدار تطبیق داده شود؛ عدد نهایی پس از تأیید آزمایشگاه مرجع و مسئول کنترل کیفیت اعمال می‌شود.</p>
            </Section>
            <SignatureBoxes roles={spec.meta.signatureRoles} />
          </>
        )}

        {spec.kind === "sale-invoice" && trade && result && product && (
          <>
            <Section number="۱" title="فروشنده و خریدار">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded border border-[#ddd8ca] p-2.5">
                  <Row label="نام" value={trade.sellerName} />
                  <Row label="شناسه ملی" value={trade.sellerNationalId} />
                  <Row label="تلفن" value={trade.sellerPhone} />
                </div>
                <div className="rounded border border-[#ddd8ca] p-2.5">
                  <Row label="خریدار" value={trade.buyerName} />
                  <Row label="شناسه ملی / اقتصادی" value={trade.buyerNationalId} />
                  <Row label="نشانی" value={trade.buyerAddress} />
                </div>
              </div>
            </Section>
            <Section number="۲" title="اقلام صورت‌حساب">
              <table>
                <thead>
                  <tr>
                    <th className={thClass}>ردیف</th><th className={thClass}>شرح کالا</th><th className={thClass}>مقدار (kg)</th>
                    <th className={thClass}>نرخ واحد</th><th className={thClass}>مبلغ (تومان)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={`${tdClass} text-center`}>۱</td>
                    <td className={tdClass}>{product.name} — {trade.result.quality.label} — محموله {trade.farmTitle}</td>
                    <td className={tdClass}>{num(result.payableKg)}</td>
                    <td className={tdClass}>{num(result.adjustedUnitPrice)}</td>
                    <td className={`${tdClass} font-bold`}>{num(result.grossValue)}</td>
                  </tr>
                  {result.costs.total > 0 && (
                    <tr>
                      <td className={`${tdClass} text-center`}>۲</td>
                      <td className={tdClass}>هزینه‌های فروشنده (کرایه، تخلیه، کارمزد و …)</td>
                      <td className={tdClass}>—</td>
                      <td className={tdClass}>—</td>
                      <td className={`${tdClass} font-bold text-[#8b3f2f]`}>{num(-result.costs.total)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className={`${tdClass} text-center`}>۳</td>
                    <td className={tdClass}>مالیات و عوارض</td>
                    <td className={tdClass}>—</td>
                    <td className={tdClass}>—</td>
                    <td className={tdClass}>{trade.taxExempt ? "معاف (محصول فرآوری‌نشده)" : num(result.tax)}</td>
                  </tr>
                  <tr className="bg-[#eef2e6]">
                    <td className={`${tdClass} text-center`} colSpan={3}>خالص قابل پرداخت</td>
                    <td className={`${tdClass} text-left font-extrabold`} colSpan={2}>{money(result.netReceipt)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-2 rounded border border-[#cdbf8b] bg-[#f8f3e2] p-2.5 text-[9px] leading-6">
                <b>مبلغ به حروف:</b> {words(result.netReceipt)}
              </div>
              <div className="mt-2 rounded border border-[#ddd8ca] p-2.5">
                <Row label="روش پرداخت" value={PAYMENT_METHOD_LABELS[trade.paymentMethod]} />
                {trade.chequeNo && <Row label="شماره چک / حواله" value={trade.chequeNo} />}
                <Row label="مبلغ پرداخت‌شده" value={money(paid)} />
                <Row label="مانده" value={money(remaining)} strong />
                <Row label="سررسید" value={formatJalali(trade.dueDate, "long")} />
              </div>
              <p className="mt-2 text-[8px] leading-5 text-[#66736a]">
                معافیت مالیاتی بر اساس {spec.meta.legalBasis}. این صورت‌حساب داخلی باید در صورت نیاز به ثبت در سامانه مؤدیان/صورتحساب الکترونیکی، با اطلاعات هویتی معتبر طرفین ارسال شود.
              </p>
            </Section>
            <SignatureBoxes roles={spec.meta.signatureRoles} />
          </>
        )}

        {spec.kind === "settlement" && trade && result && (
          <>
            <Section number="۱" title="خلاصه مالی">
              <table>
                <thead>
                  <tr><th className={thClass}>شرح</th><th className={thClass}>مبلغ (تومان)</th></tr>
                </thead>
                <tbody>
                  <tr><td className={tdClass}>ارزش کالا پس از درجه‌بندی</td><td className={tdClass}>{num(result.grossValue)}</td></tr>
                  <tr><td className={tdClass}>هزینه‌های فروشنده</td><td className={`${tdClass} text-[#8b3f2f]`}>{num(-result.costs.total)}</td></tr>
                  <tr><td className={tdClass}>مالیات</td><td className={tdClass}>{trade.taxExempt ? "معاف" : num(result.tax)}</td></tr>
                  <tr className="bg-[#f3f0e5]"><td className={`${tdClass} font-bold`}>خالص قابل پرداخت</td><td className={`${tdClass} font-extrabold`}>{num(result.netReceipt)}</td></tr>
                  <tr><td className={tdClass}>پرداخت‌شده تا تاریخ این سند</td><td className={tdClass}>{num(paid)}</td></tr>
                  <tr className="bg-[#eef2e6]"><td className={`${tdClass} font-bold`}>مانده بدهی</td><td className={`${tdClass} font-extrabold`}>{num(remaining)}</td></tr>
                </tbody>
              </table>
              <div className="mt-2 rounded border border-[#ddd8ca] p-2.5">
                <Row label="محلول" value={`${trade.sellerName} به ${trade.buyerName}`} />
                <Row label="روش پرداخت" value={PAYMENT_METHOD_LABELS[trade.paymentMethod]} />
                {trade.chequeNo && <Row label="شماره چک / حواله" value={trade.chequeNo} />}
                <Row label="سررسید" value={formatJalali(trade.dueDate, "long")} />
                <Row label="وضعیت" value={remaining === 0 ? "تسویه کامل" : paid > 0 ? "پرداخت جزئی" : "پرداخت‌نشده"} strong />
              </div>
              <p className="mt-2 text-[9px] leading-6 text-[#3e4c42]">
                طرفین با امضای این صورتجلسه، پرداخت‌های فوق را تأیید می‌کنند. با پرداخت {money(remaining)} مانده، تعهدات این معامله به‌طور کامل مختومه می‌شود. این سند جایگزین رسید بانکی یا سند رسمی مالکیت نیست.
              </p>
            </Section>
            <SignatureBoxes roles={spec.meta.signatureRoles} />
          </>
        )}

        {(spec.kind === "lease-contract" || spec.kind === "lease-receipt" || spec.kind === "lease-handover") && contract && (
          <LeaseDocumentBody spec={spec} contract={contract} />
        )}

        {spec.kind === "trades-report" && (
          <TradesReportBody spec={spec} />
        )}

        {spec.kind === "cost-report" && (
          <CostReportBody spec={spec} />
        )}

        {spec.kind === "party-statement" && (
          <PartyStatementBody spec={spec} />
        )}

        {spec.kind === "finance-report" && (
          <FinanceReportBody spec={spec} />
        )}

        {spec.kind === "inventory-report" && (
          <InventoryReportBody spec={spec} />
        )}

        <SignatureStatusBlock spec={spec} />
        <footer className="mt-5 border-t border-[#d4cfc0] pt-3">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-[70%] text-[7px] leading-4 text-[#727c73]">
              <p>
                این سند بر پایه <b>{spec.meta.legalBasis}</b> و به‌عنوان سند اداری/داخلی تنظیم شده است. اعتبار در برابر
                اشخاص ثالث، تابع ثبت رسمی یا سامانه دولتی مربوط است؛ نسخه چاپی با مهر و امضای دو طرف، مبنای توافق است.
              </p>
              <p className="mt-1">{spec.meta.copies} · کد کنترل: <span className="font-mono">{verificationData(spec).check}</span> · استعلام: havedays67-ai.github.io/kishavar-hesab/verify · صادرشده توسط {profileDisplayName(profile)}</p>
              <p className="mt-1">آدرس: اردبیل، پارس‌آباد، مزرعه سبز دشت مغان · تلفن: {profile.phone || "—"} · تاریخ چاپ: {formatJalali(spec.date, "long")}</p>
            </div>
            <div className="flex items-end gap-2">
              <VerificationQR text={verificationPayload(spec)} />
              <div className="mb-1 rounded border border-[#c8c3b5] px-3 py-2 text-center text-[7px] text-[#7a847b]">
                مهر و امضای واحد
                <div className="mt-2 h-7 w-16 rounded-sm border border-dashed border-[#b5af9f]" />
              </div>
            </div>
          </div>
        </footer>
      </div>
    </article>
  );
}

function LeaseDocumentBody({ spec, contract }: { spec: DocumentSpec; contract: SavedContract }) {
  const isReceipt = spec.kind === "lease-receipt";
  const isHandover = spec.kind === "lease-handover";
  const landlord = contract.partyRole === "landlord" ? contract.partyName : (contract.myName || "طرف اول");
  const tenant = contract.partyRole === "tenant" ? contract.partyName : (contract.myName || "طرف اول");
  const perPeriod = contract.period === "ماهانه" ? 12 : contract.period === "فصلی" ? 4 : contract.period === "شش‌ماهه" ? 2 : 1;
  const installment = Math.round(contract.rent / perPeriod);

  if (isReceipt) {
    return (
      <>
        <Section number="۱" title="مشخصات قرارداد">
          <Row label="شماره قرارداد" value={contract.code} />
          <Row label="عنوان زمین" value={contract.landTitle} />
          <Row label="موجر / مالک" value={landlord} />
          <Row label="مستاجر / بهره‌بردار" value={tenant} />
          <Row label="دوره اجاره" value={`${formatJalali(contract.start, "long")} تا ${formatJalali(contract.end, "long")}`} />
        </Section>
        <Section number="۲" title="پرداخت">
          <div className="rounded border border-[#ddd8ca] bg-[#faf8f1] p-2.5">
            <Row label="دوره پرداخت" value={contract.period} />
            <Row label="مبلغ هر دوره" value={contract.rent > 0 ? money(installment) : "سهم محصول"} strong />
            <Row label="ودیعه (تسویه‌حساب جدا)" value={money(contract.deposit)} />
            <Row label="تاریخ دریافت" value={formatJalali(spec.date, "long")} />
            <Row label="روش پرداخت" value="نقدی / بانکی / چک (در هنگام دریافت مشخص شود)" />
            <Row label="شرح" value="مال‌الاجاره دوره جاری زمین کشاورزی" />
          </div>
          <div className="mt-2 rounded border border-[#cdbf8b] bg-[#f8f3e2] p-2.5 text-[9px] leading-6">
            <b>مبلغ به حروف:</b> {contract.rent > 0 ? words(installment) : `${toPersianDigits(contract.cropShare)} درصد سهم از محصول — بدون مبلغ نقدی در این دوره`}
          </div>
          <p className="mt-2 text-[8px] leading-5 text-[#66736a]">
            امضای دریافت‌کننده به‌معنای دریافت کامل مبلغ در تاریخ این رسید است. ودیعه قابل استرداد تعهد جداگانه است و در این مبلغ لحاظ نشده.
          </p>
        </Section>
        <ContractSignaturesBlock contract={contract} />
      </>
    );
  }

  if (isHandover) {
    const checklist = [
      "زمین خشک، تسطیح و عاری از علف هرز",
      "حقابه و نوبت آب به‌صورت کامل و بدون معارض تحویل شود",
      "کنتور آب و شیرها سالم و پلمب دارند",
      "پمپ، تابلو برق و سیم‌کشی سالم است",
      "بذر، کود و سایر نهاده‌ها تحویل نشده‌اند (نقطه‌چین)",
      "اموال و ادوات متعلق به مالک مشخص و فهرست شده‌اند",
      "معارض ثالث یا دعوای حقوقی روی زمین وجود ندارد",
    ];
    return (
      <>
        <Section number="۱" title="طرفین تحویل">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-[#ddd8ca] p-2.5">
              <Row label="تحویل‌دهنده" value={landlord} />
              <Row label="سند / مجوز مالکیت" value={`${contract.plaque || "—"} — ${contract.landTitle}`} />
            </div>
            <div className="rounded border border-[#ddd8ca] p-2.5">
              <Row label="تحویل‌گیرنده" value={tenant} />
              <Row label="قرارداد" value={`${contract.code} — ${formatJalali(contract.start, "long")}`} />
            </div>
          </div>
        </Section>
        <Section number="۲" title="چک‌لیست وضعیت زمین">
          <table>
            <thead>
              <tr><th className={thClass}>مورد</th><th className={thClass}>وضعیت</th><th className={thClass}>توضیح / قرائت</th></tr>
            </thead>
            <tbody>
              {checklist.map((item, index) => (
                <tr key={item}>
                  <td className={tdClass}>{index + 1}. {item}</td>
                  <td className={`${tdClass} text-center`}>سالم ☐ / نیاز به تعمیر ☐</td>
                  <td className={tdClass}>........................</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 rounded border border-[#ddd8ca] p-2.5 text-[9px] leading-6">
            <b>حقابه قرارداد:</b> {contract.waterShare || "طبق عرف محل"} · <b>خدمات بر عهده:</b> {contract.utilities} · <b>شرایط:</b> {contract.obligations || "طبق قرارداد."}
          </div>
        </Section>
        <ContractSignaturesBlock contract={contract} />
      </>
    );
  }

  return (
    <>
      <Section number="۱" title="طرفین قرارداد">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded border border-[#ddd8ca] bg-[#faf8f1] p-3">
            <Row label="موجر / مالک زمین" value={landlord} />
            <Row label="مستاجر / بهره‌بردار" value={tenant} />
            <Row label="تلفن طرف مقابل" value={contract.partyName} />
          </div>
          <div className="rounded border border-[#ddd8ca] bg-[#faf8f1] p-3">
            <Row label="نوع قرارداد" value={contract.type === "cash" ? "اجاره نقدی" : contract.type === "share" ? "مزارعه (سهم محصول)" : contract.type === "mixed" ? "اجاره + سهم محصول" : contract.type === "irrigation" ? "مساقات" : "مشارکت در کشت"} />
            <Row label="مدت" value={`${formatJalali(contract.start, "long")} تا ${formatJalali(contract.end, "long")}`} />
            <Row label="شماره سند" value={contract.plaque || "ثبت نشده"} />
          </div>
        </div>
      </Section>
      <Section number="۲" title="مورد اجاره و شرایط مالی">
        <table>
          <thead>
            <tr><th className={thClass}>ملک / زمین</th><th className={thClass}>مساحت (هکتار)</th><th className={thClass}>محصول</th><th className={thClass}>مال‌الاجاره</th><th className={thClass}>ودیعه</th><th className={thClass}>سهم محصول</th></tr>
          </thead>
          <tbody>
            <tr className="text-center">
              <td className={tdClass}>{contract.landTitle}</td>
              <td className={tdClass}>{toPersianDigits(contract.area || "—")}</td>
              <td className={tdClass}>{contract.crop}</td>
              <td className={tdClass}>{contract.rent ? money(contract.rent) : "—"}</td>
              <td className={tdClass}>{money(contract.deposit)}</td>
              <td className={tdClass}>{toPersianDigits(contract.cropShare)}٪</td>
            </tr>
          </tbody>
        </table>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded border border-[#ddd8ca] p-2.5">
            <Row label="دوره پرداخت" value={contract.period} />
            <Row label="حقابه / سهم آب" value={contract.waterShare || "طبق عرف محل"} />
            <Row label="هزینه آب و برق و پمپ" value={contract.utilities} />
          </div>
          <div className="rounded border border-[#ddd8ca] p-2.5">
            <Row label="سهم مالک از محصول" value={`${toPersianDigits(contract.cropShare)}٪`} />
            <Row label="شماره قرارداد" value={contract.code} />
            <Row label="تاریخ تنظیم" value={formatJalali(contract.createdAt, "long")} />
          </div>
        </div>
      </Section>
      <Section number="۳" title="تعهدات، شرایط و مبنای حقوقی">
        <p className="rounded border border-[#ddd8ca] bg-[#faf8f1] p-2.5 text-justify text-[9px] leading-6 text-[#35433a]">
          {contract.obligations || "طرفین متعهد به رعایت عرف محلی، حفظ کاربری زراعی و انجام تعهدات توافق‌شده هستند."}
          {" "}تغییر کاربری، واگذاری به غیر یا کشت خارج از توافق، از موجبات حق فسخ موجر است. بدل اجاره یا سهم محصول در سررسیدهای {contract.period} پرداخت/تسویه می‌شود.
          {" "}این قرارداد بر اساس {spec.meta.legalBasis} تنظیم شده و ثبت آن در دفتر اسناد رسمی برای آثار ثبتی توصیه می‌شود.
        </p>
      </Section>
      <ContractSignaturesBlock contract={contract} />
    </>
  );
}

function TradesReportBody({ spec }: { spec: DocumentSpec }) {
  const trades = spec.payload.trades ?? [];
  const totals = trades.reduce(
    (acc, trade) => {
      acc.netKg += trade.result.netKg;
      acc.payableKg += trade.result.payableKg;
      acc.netReceipt += trade.result.netReceipt;
      acc.remaining += tradeBalance(trade).remaining;
      return acc;
    },
    { netKg: 0, payableKg: 0, netReceipt: 0, remaining: 0 }
  );
  return (
    <>
      <Section number="۱" title="فهرست معاملات ثبت‌شده">
        <table>
          <thead>
            <tr>
              <th className={thClass}>سریال</th><th className={thClass}>تاریخ</th><th className={thClass}>محصول</th><th className={thClass}>خریدار</th>
              <th className={thClass}>خالص (kg)</th><th className={thClass}>قابل پرداخت (kg)</th><th className={thClass}>نرخ مؤثر</th>
              <th className={thClass}>خالص دریافتی</th><th className={thClass}>مانده</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.id}>
                <td className={`${tdClass} font-mono text-[8px]`}>{trade.serial}</td>
                <td className={tdClass}>{formatJalali(trade.date, "short")}</td>
                <td className={tdClass}>{PRODUCT_PROFILES[trade.productId].name}</td>
                <td className={tdClass}>{trade.buyerName}</td>
                <td className={tdClass}>{num(trade.result.netKg)}</td>
                <td className={tdClass}>{num(trade.result.payableKg)}</td>
                <td className={tdClass}>{num(trade.result.effectivePricePerKg)}</td>
                <td className={tdClass}>{num(trade.result.netReceipt)}</td>
                <td className={tdClass}>{num(tradeBalance(trade).remaining)}</td>
              </tr>
            ))}
            <tr className="bg-[#eef2e6] font-bold">
              <td className={tdClass} colSpan={4}>جمع کل</td>
              <td className={tdClass}>{num(totals.netKg)}</td>
              <td className={tdClass}>{num(totals.payableKg)}</td>
              <td className={tdClass}>—</td>
              <td className={tdClass}>{num(totals.netReceipt)}</td>
              <td className={tdClass}>{num(totals.remaining)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-[8px] leading-5 text-[#66736a]">گزارش مدیریتی بر اساس اسناد ثبت‌شده در نرم‌افزار. مبالغ به تومان و وزن‌ها بر مبنای باسکول محموله‌ها است.</p>
      </Section>
      <SignatureBoxes roles={spec.meta.signatureRoles} />
    </>
  );
}

function CostReportBody({ spec }: { spec: DocumentSpec }) {
  const rows = spec.payload.costRows ?? [];
  const totals = rows.reduce(
    (acc, row) => {
      acc.area += row.areaHa;
      acc.cost += row.totalCost;
      acc.yield += row.yieldKg;
      acc.revenue += row.revenue;
      acc.profit += row.profit;
      return acc;
    },
    { area: 0, cost: 0, yield: 0, revenue: 0, profit: 0 }
  );
  const totalCostPerKg = totals.yield > 0 ? totals.cost / totals.yield : 0;
  const totalMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  return (
    <>
      <Section number="۱" title="بهای تمام‌شده زمین‌ها">
        <table>
          <thead>
            <tr>
              <th className={thClass}>زمین</th><th className={thClass}>مساحت</th><th className={thClass}>محصول</th><th className={thClass}>هزینه کل</th>
              <th className={thClass}>عملکرد (kg)</th><th className={thClass}>هزینه هر کیلو</th><th className={thClass}>درآمد</th><th className={thClass}>سود</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.title}>
                <td className={tdClass}>{row.title}</td>
                <td className={tdClass}>{toPersianDigits(row.areaHa)} هکتار</td>
                <td className={tdClass}>{row.crop}</td>
                <td className={tdClass}>{num(row.totalCost)}</td>
                <td className={tdClass}>{num(row.yieldKg)}</td>
                <td className={tdClass}>{num(row.yieldKg > 0 ? row.totalCost / row.yieldKg : 0)}</td>
                <td className={tdClass}>{num(row.revenue)}</td>
                <td className={`${tdClass} font-bold`}>{num(row.profit)}</td>
              </tr>
            ))}
            <tr className="bg-[#eef2e6] font-bold">
              <td className={tdClass}>جمع</td><td className={tdClass}>{toPersianDigits(totals.area)} هکتار</td>
              <td className={tdClass}>—</td><td className={tdClass}>{num(totals.cost)}</td><td className={tdClass}>{num(totals.yield)}</td>
              <td className={tdClass}>{num(totalCostPerKg)}</td><td className={tdClass}>{num(totals.revenue)}</td><td className={tdClass}>{num(totals.profit)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="rounded border border-[#ddd8ca] p-2.5"><Row label="میانگین هزینه هر کیلو" value={money(totalCostPerKg)} strong /></div>
          <div className="rounded border border-[#ddd8ca] p-2.5"><Row label="حاشیه سود کل" value={`${toPersianDigits(totalMargin.toFixed(1))}٪`} strong /></div>
          <div className="rounded border border-[#ddd8ca] p-2.5"><Row label="سود کل" value={money(totals.profit)} strong /></div>
        </div>
        <p className="mt-2 text-[8px] leading-5 text-[#66736a]">هزینه‌ها شامل اجاره/حق بهره‌برداری، بذر، کود و سم، آب و انرژی، کارگر، ماشین‌آلات و سایر است. عملکرد و قیمت فروش، برآورد مدیریتی است.</p>
      </Section>
      <SignatureBoxes roles={spec.meta.signatureRoles} />
    </>
  );
}

export function PrintDocumentPreview({ spec, onBack }: { spec: DocumentSpec; onBack: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1d16] p-4">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-[10px] text-mint-300">
          <ArrowLeft className="h-3.5 w-3.5" /> بازگشت به فهرست اسناد
        </button>
        <span className="text-[9px] text-[#78968a]">جهت چاپ، پنجره را باز کنید</span>
      </div>
      <DocumentSheet spec={spec} />
    </div>
  );
}


function PartyStatementBody({ spec }: { spec: DocumentSpec }) {
  const parties = spec.payload.parties ?? [];
  const party = spec.payload.party;
  const payments = spec.payload.payments ?? [];

  if (party && party.id !== "all") {
    const rows = payments.filter((payment) => payment.partyId === party.id);
    const paid = rows.reduce((sum, payment) => sum + payment.amount, 0);
    const balance = Math.max(0, party.amount - paid);
    return (
      <>
        <Section number="۱" title="مشخصات طرف‌حساب">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-[#ddd8ca] p-2.5">
              <Row label="نام" value={party.name} />
              <Row label="تلفن" value={party.phone || "—"} />
              <Row label="شهر" value={party.city || "—"} />
            </div>
            <div className="rounded border border-[#ddd8ca] p-2.5">
              <Row label="نوع حساب" value={party.kind === "debtor" ? "بدهکار به ما (طلب ما)" : "بستانکار از ما (بدهی ما)"} />
              <Row label="تاریخ ثبت" value={formatJalali(party.date, "long")} />
              <Row label="یادآوری پیگیری" value={party.dueDate ? formatJalali(party.dueDate, "long") : "تعیین نشده"} />
            </div>
          </div>
        </Section>
        <Section number="۲" title="دلیل و مبلغ">
          <div className="rounded border border-[#ddd8ca] p-2.5 text-[9px] leading-6">
            <p><b>دلیل ثبت:</b> {party.reason || "—"}</p>
            {party.note && <p><b>یادداشت:</b> {party.note}</p>}
          </div>
          <table className="mt-2">
            <thead><tr><th className={thClass}>مبلغ اولیه</th><th className={thClass}>پرداخت‌شده</th><th className={thClass}>مانده</th></tr></thead>
            <tbody><tr className="text-center"><td className={tdClass}>{money(party.amount)}</td><td className={tdClass}>{money(paid)}</td><td className={`${tdClass} font-bold`}>{money(balance)}</td></tr></tbody>
          </table>
        </Section>
        <Section number="۳" title="گردش پرداخت‌ها (با تاریخ)">
          {rows.length === 0 ? <p className="rounded border border-[#ddd8ca] px-3 py-3 text-center text-[9px] text-[#6d796e]">پرداختی ثبت نشده است. هنگام تسویه، تاریخ و مبلغ پرداخت در همین سند ثبت می‌شود.</p> : (
            <table>
              <thead><tr><th className={thClass}>تاریخ پرداخت</th><th className={thClass}>مبلغ</th><th className={thClass}>روش</th><th className={thClass}>توضیح</th></tr></thead>
              <tbody>{rows.map((payment) => <tr key={payment.id}><td className={tdClass}>{formatJalali(payment.date, "long")}</td><td className={tdClass}>{money(payment.amount)}</td><td className={tdClass}>{payment.method}</td><td className={tdClass}>{payment.note || "—"}</td></tr>)}</tbody>
            </table>
          )}
        </Section>
        <SignatureBoxes roles={spec.meta.signatureRoles} />
      </>
    );
  }

  const debtorTotal = parties.filter((row) => row.kind === "debtor").reduce((sum, row) => sum + row.amount, 0);
  const creditorTotal = parties.filter((row) => row.kind === "creditor").reduce((sum, row) => sum + row.amount, 0);
  return (
    <>
      <Section number="۱" title="خلاصه دفتر">
        <div className="grid grid-cols-3 gap-2">
          {[["تعداد طرف‌حساب", toPersianDigits(parties.length)], ["جمع طلب", money(debtorTotal)], ["جمع بدهی", money(creditorTotal)]].map(([label, value]) => (
            <div key={label} className="rounded border border-[#ddd8ca] p-2 text-center"><div className="text-[8px] text-[#75816f]">{label}</div><div className="mt-1 text-[10px] font-bold">{value}</div></div>
          ))}
        </div>
      </Section>
      <Section number="۲" title="فهرست بدهکاران و بستانکاران">
        <table>
          <thead><tr><th className={thClass}>نام</th><th className={thClass}>تلفن</th><th className={thClass}>نوع</th><th className={thClass}>تاریخ ثبت</th><th className={thClass}>دلیل</th><th className={thClass}>مبلغ (تومان)</th></tr></thead>
          <tbody>{parties.map((row) => <tr key={row.id}><td className={tdClass}>{row.name}</td><td className={tdClass}>{row.phone || "—"}</td><td className={tdClass}>{row.kind === "debtor" ? "بدهکار" : "بستانکار"}</td><td className={tdClass}>{formatJalali(row.date, "short")}</td><td className={tdClass}>{row.reason}</td><td className={`${tdClass} font-bold`}>{formatNumber(row.amount)}</td></tr>)}</tbody>
        </table>
      </Section>
      <SignatureBoxes roles={spec.meta.signatureRoles} />
    </>
  );
}

function FinanceReportBody({ spec }: { spec: DocumentSpec }) {
  const entries = spec.payload.entries ?? [];
  const income = entries.filter((entry) => entry.kind === "income").reduce((sum, entry) => sum + entry.amount, 0);
  const expense = entries.filter((entry) => entry.kind === "expense").reduce((sum, entry) => sum + entry.amount, 0);
  return (
    <>
      <Section number="۱" title="خلاصه دوره">
        <div className="grid grid-cols-3 gap-2">{[["درآمد", money(income)], ["هزینه", money(expense)], ["سود / زیان", money(income - expense)]].map(([label, value]) => <div key={label} className="rounded border border-[#ddd8ca] p-2 text-center"><div className="text-[8px] text-[#75816f]">{label}</div><div className="mt-1 text-[10px] font-bold">{value}</div></div>)}</div>
      </Section>
      <Section number="۲" title="فهرست اسناد">
        <table>
          <thead><tr><th className={thClass}>تاریخ</th><th className={thClass}>نوع</th><th className={thClass}>دلیل</th><th className={thClass}>دسته</th><th className={thClass}>روش</th><th className={thClass}>مبلغ</th></tr></thead>
          <tbody>{entries.map((entry) => <tr key={entry.id}><td className={tdClass}>{formatJalali(entry.date, "short")}</td><td className={tdClass}>{entry.kind === "income" ? "درآمد" : "هزینه"}</td><td className={tdClass}>{entry.reason}</td><td className={tdClass}>{entry.category}</td><td className={tdClass}>{entry.method}</td><td className={`${tdClass} font-bold`}>{formatNumber(entry.amount)}</td></tr>)}</tbody>
        </table>
      </Section>
      <SignatureBoxes roles={spec.meta.signatureRoles} />
    </>
  );
}

function InventoryReportBody({ spec }: { spec: DocumentSpec }) {
  const items = spec.payload.items ?? [];
  const assets = spec.payload.assets ?? [];
  const budgets = spec.payload.budgets ?? [];
  const entries = spec.payload.entries ?? [];
  return (
    <>
      <Section number="۱" title="موجودی انبار">
        <table>
          <thead><tr><th className={thClass}>کالا</th><th className={thClass}>نوع</th><th className={thClass}>واحد</th><th className={thClass}>موجودی</th><th className={thClass}>حد سفارش</th><th className={thClass}>بهای واحد</th><th className={thClass}>ارزش</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}><td className={tdClass}>{item.name}</td><td className={tdClass}>{item.kind === "input" ? "نهاده" : "محصول"}</td><td className={tdClass}>{item.unit}</td><td className={tdClass}>{formatNumber(item.stock)}</td><td className={tdClass}>{formatNumber(item.min)}</td><td className={tdClass}>{formatNumber(item.cost)}</td><td className={`${tdClass} font-bold`}>{formatNumber(item.stock * item.cost)}</td></tr>)}</tbody>
        </table>
      </Section>
      <Section number="۲" title="دارایی و استهلاک">
        <table>
          <thead><tr><th className={thClass}>دارایی</th><th className={thClass}>بهای خرید</th><th className={thClass}>اسقاط</th><th className={thClass}>عمر (ماه)</th><th className={thClass}>تاریخ خرید</th><th className={thClass}>توضیح</th></tr></thead>
          <tbody>{assets.map((asset) => <tr key={asset.id}><td className={tdClass}>{asset.name}</td><td className={tdClass}>{formatNumber(asset.cost)}</td><td className={tdClass}>{formatNumber(asset.salvage)}</td><td className={tdClass}>{toPersianDigits(asset.lifeMonths)}</td><td className={tdClass}>{formatJalali(asset.purchase, "short")}</td><td className={tdClass}>{asset.note || "—"}</td></tr>)}</tbody>
        </table>
      </Section>
      <Section number="۳" title="بودجه در برابر هزینه">
        <table>
          <thead><tr><th className={thClass}>سرفصل</th><th className={thClass}>سقف بودجه</th><th className={thClass}>هزینه واقعی</th><th className={thClass}>مانده</th></tr></thead>
          <tbody>{budgets.map((budget) => { const spent = entries.filter((entry) => entry.kind === "expense" && entry.category === budget.category).reduce((sum, entry) => sum + entry.amount, 0); return <tr key={budget.id}><td className={tdClass}>{budget.category}</td><td className={tdClass}>{formatNumber(budget.limit)}</td><td className={tdClass}>{formatNumber(spent)}</td><td className={`${tdClass} font-bold`}>{formatNumber(budget.limit - spent)}</td></tr>; })}</tbody>
        </table>
      </Section>
      <SignatureBoxes roles={spec.meta.signatureRoles} />
    </>
  );
}
