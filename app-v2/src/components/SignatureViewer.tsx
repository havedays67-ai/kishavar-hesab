import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Download, Loader2, Printer, Save, Share2, X, ZoomIn } from "lucide-react";
import {
  downloadDataUrl,
  isNativeApp,
  printDocument,
  safeFileName,
  saveDataUrl,
  signatureDataUrlNow,
} from "../lib/exportFile";

/**
 * نمایش، دانلود و چاپ امضای دستی.
 * دانلود همگام (بدون await) انجام می‌شود تا مرورگر/WebView آن را
 * مسدود نکند؛ در اندروید فایل PNG با Filesystem ذخیره و پنجرهٔ
 * ذخیره/ارسال سیستم باز می‌شود. چاپ هم فقط با iframe سفید است تا
 * هرگز صفحهٔ سیاه تولید نشود.
 */
export function SignatureViewer({ image, name, onClose }: { image: string; name: string; onClose: () => void }) {
  const [busy, setBusy] = useState<"download" | "print" | "share" | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);
  const filename = safeFileName(`امضای ${name || "ثبت‌شده"}`, "png");
  const safeName = (name || "امضاکننده").replace(/[<>&"]/g, "");
  // نسخهٔ PNG با پس‌زمینهٔ سفید، ساخته‌شده به‌صورت همگام تا کلیک دانلود از دست نرود.
  const directDataUrl = useMemo(() => signatureDataUrlNow(image), [image]);
  const native = useMemo(() => isNativeApp(), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const download = async () => {
    if (busy) return;
    // ۱) تلاش همگام: در وب همین‌جا دانلود آغاز می‌شود.
    const immediate = downloadDataUrl(directDataUrl, filename);
    if (immediate.ok) {
      setStatus({ tone: "ok", text: immediate.message });
      return;
    }
    // ۲) مسیر اندروید: نوشتن فایل و باز کردن پنجرهٔ ذخیره/ارسال.
    setBusy("download");
    setStatus({ tone: "info", text: "در حال ذخیرهٔ فایل روی حافظهٔ دستگاه…" });
    try {
      const result = await saveDataUrl(directDataUrl, filename, "امضای دستی");
      setStatus({ tone: result.ok ? "ok" : "err", text: result.message });
      if (!result.ok) {
        setStatus({ tone: "err", text: `${result.message} از پیوند «ذخیرهٔ مستقیم» زیر استفاده کنید.` });
      }
    } catch {
      setStatus({ tone: "err", text: "ذخیرهٔ فایل ممکن نشد؛ از پیوند «ذخیرهٔ مستقیم» استفاده کنید." });
    } finally {
      setBusy(null);
    }
  };

  const print = async () => {
    if (busy) return;
    if (native) {
      // اندروید پنجرهٔ چاپ مرورگر ندارد؛ PNG سفید ساخته و به سیستم می‌دهیم.
      setBusy("print");
      setStatus({ tone: "info", text: "اندروید چاپ مستقیم ندارد؛ تصویر چاپی ساخته و پنجرهٔ سیستم باز می‌شود…" });
      try {
        const saved = await saveDataUrl(directDataUrl, filename, "امضای دستی برای چاپ");
        setStatus({
          tone: saved.ok ? "ok" : "err",
          text: saved.ok
            ? "تصویر امضا با پس‌زمینهٔ سفید ساخته شد؛ در پنجرهٔ سیستم «چاپ» یا یک برنامهٔ چاپ/گالری را انتخاب کنید."
            : `${saved.message} می‌توانید از «ذخیرهٔ مستقیم» استفاده کنید.`,
        });
      } finally {
        setBusy(null);
      }
      return;
    }
    setBusy("print");
    setStatus({ tone: "info", text: "پنجرهٔ چاپ سفید در حال آماده‌سازی است…" });
    const ok = printDocument({
      title: `امضای ${safeName}`,
      bodyHtml: `<main dir="rtl" style="min-height:250mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:Vazirmatn,Tahoma,sans-serif;background:#fff;color:#15271e">
        <div style="width:150mm;padding:12mm;border:1px solid #d6d1c2;border-radius:6px;background:#fff">
          <p style="font-size:11px;color:#65756b;margin:0 0 5mm">تصویر امضای ثبت‌شده در کشاورزحساب</p>
          <img src="${directDataUrl}" alt="امضای ${safeName}" style="max-width:140mm;max-height:80mm;object-fit:contain" />
          <p style="font-size:14px;font-weight:700;margin:6mm 0 0">${safeName}</p>
          <p style="font-size:9px;color:#718277;margin:2mm 0 0;line-height:1.8">این تصویر، امضای دستی ثبت‌شده در برنامه است. امضای دستی طرفین روی نسخهٔ کاغذی، سند عادی معتبر بین آن‌ها می‌سازد؛ برای امضای الکترونیکی «مطمئن» موضوع ماده ۱۰ قانون تجارت الکترونیکی، گواهی مرکز مجاز صدور گواهی لازم است.</p>
        </div>
      </main>`,
    });
    setBusy(null);
    setStatus(
      ok
        ? { tone: "ok", text: "پنجرهٔ چاپ باز شد؛ در صورت نیاز مقصد «Save as PDF» را انتخاب کنید." }
        : { tone: "err", text: "مرورگر چاپ را مسدود کرد؛ روی «دانلود PNG» بزنید و فایل ذخیره‌شده را چاپ کنید." }
    );
  };

  const share = async () => {
    if (busy) return;
    setBusy("share");
    try {
      const result = await saveDataUrl(directDataUrl, filename, "امضای دستی");
      setStatus({ tone: result.ok ? "ok" : "err", text: result.message });
    } finally {
      setBusy(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#020806]/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`مشاهده امضای ${name}`}>
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="بستن" />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-[#29483b] bg-[#0d1d16]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-medium text-[#dcebe2]"><ZoomIn className="h-4 w-4 text-mint-300" />امضای {name}</div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={download} disabled={busy !== null} className="flex items-center gap-1 rounded-lg border border-mint-300/20 bg-mint-300/[0.08] px-2.5 py-1.5 text-[8px] text-mint-300 disabled:opacity-50">{busy === "download" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} دانلود PNG</button>
            <button type="button" onClick={print} disabled={busy !== null} className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[8px] text-[#c8ddd1] disabled:opacity-50">{busy === "print" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />} چاپ</button>
            <button type="button" onClick={share} disabled={busy !== null} className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[8px] text-[#b9cec3] disabled:opacity-50">{busy === "share" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />} ذخیره / ارسال</button>
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-2 py-1.5 text-[#9fb6aa]" aria-label="بستن"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="bg-white p-3"><img src={directDataUrl} alt={`امضای ${name}`} className="mx-auto max-h-[52vh] w-full object-contain" /></div>
        {status && <p className={`px-4 pt-2 text-[8px] leading-5 ${status.tone === "err" ? "text-[#efad9f]" : status.tone === "ok" ? "text-mint-300" : "text-[#c8ddd1]"}`}>{status.tone === "ok" ? <Check className="ml-1 inline h-3 w-3" /> : null}{status.text}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
          <p className="text-[8px] leading-4 text-[#78968a]">اگر پنجرهٔ ذخیره باز نشد، این پیوند مستقیم را لمس کنید:</p>
          <a href={directDataUrl} download={filename} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border border-mint-300/25 bg-mint-300/[0.06] px-2.5 py-1.5 text-[8px] text-mint-300"><Save className="h-3 w-3" /> ذخیرهٔ مستقیم PNG</a>
        </div>
        <p className="px-4 pb-3 text-[7px] leading-4 text-[#6f8c7f]">
          امضای دستی طرفین روی نسخهٔ چاپی، بین همان طرفین سند عادی معتبر است (مواد ۱۰، ۲۱۹ و ۱۲۵۷ قانون مدنی). امضای داخل برنامه «امضای الکترونیکی ساده» است و برای امضای مطمئن موضوع ماده ۱۰ قانون تجارت الکترونیکی، گواهی مرکز مجاز صدور گواهی لازم است.
        </p>
      </div>
    </div>,
    document.body
  );
}
