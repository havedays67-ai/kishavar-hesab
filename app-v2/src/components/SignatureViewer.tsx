import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Download, Loader2, Printer, Save, X, ZoomIn } from "lucide-react";
import { printDocument, renderSignaturePng, safeFileName, saveBlob } from "../lib/exportFile";

export function SignatureViewer({ image, name, onClose }: { image: string; name: string; onClose: () => void }) {
  const [busy, setBusy] = useState<"pdf" | "print" | "share" | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);
  const [directUrl, setDirectUrl] = useState<string>(image);
  const filename = safeFileName(`امضای ${name || "ثبت‌شده"}`, "png");
  const safeName = (name || "امضاکننده").replace(/[<>&"]/g, "");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // یک فایل PNG واقعی و با کیفیت بالا می‌سازیم تا لینک ذخیره همیشه کار کند.
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    void renderSignaturePng(image).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setDirectUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image]);

  const download = async () => {
    if (busy) return;
    setBusy("pdf");
    setStatus({ tone: "info", text: "در حال ساخت فایل PNG با کیفیت اصلی…" });
    try {
      const blob = await renderSignaturePng(image);
      if (!blob) {
        setStatus({ tone: "err", text: "تبدیل امضا به فایل ممکن نشد؛ از پیوند ذخیرهٔ مستقیم زیر استفاده کنید." });
        return;
      }
      const result = await saveBlob(blob, filename, "امضای دستی");
      if (result.ok) {
        setDirectUrl(result.url || directUrl);
        setStatus({ tone: "ok", text: result.message });
      } else {
        setStatus({ tone: "err", text: result.message });
      }
    } catch {
      setStatus({ tone: "err", text: "ذخیرهٔ فایل ممکن نشد؛ روی «ذخیرهٔ مستقیم» بزنید." });
    } finally {
      setBusy(null);
    }
  };

  const print = () => {
    if (busy) return;
    setBusy("print");
    setStatus({ tone: "info", text: "پنجرهٔ چاپ سفید در حال آماده‌سازی است…" });
    const ok = printDocument({
      title: `امضای ${safeName}`,
      bodyHtml: `<main style="min-height:250mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:Vazirmatn,Tahoma,sans-serif;background:#fff;color:#15271e">
        <div style="width:150mm;padding:12mm;border:1px solid #d6d1c2;border-radius:6px;background:#fff">
          <p style="font-size:11px;color:#65756b;margin:0 0 5mm">تصویر امضای ثبت‌شده در کشاورزحساب</p>
          <img src="${image}" alt="امضای ${safeName}" style="max-width:140mm;max-height:80mm;object-fit:contain" />
          <p style="font-size:14px;font-weight:700;margin:6mm 0 0">${safeName}</p>
          <p style="font-size:9px;color:#718277;margin:2mm 0 0">این تصویر امضای الکترونیکی ساده است؛ برای سند رسمی، امضای حضوری روی نسخهٔ کاغذی لازم است.</p>
        </div>
      </main>`,
    });
    setBusy(null);
    setStatus(ok ? { tone: "ok", text: "پنجرهٔ چاپ باز شد؛ در صورت نیاز مقصد «Save as PDF» را انتخاب کنید." } : { tone: "err", text: "مرورگر چاپ را مسدود کرد؛ ابتدا PNG را ذخیره و سپس چاپ کنید." });
  };

  const share = async () => {
    if (busy) return;
    setBusy("share");
    try {
      const blob = await renderSignaturePng(image);
      const file = blob ? new File([blob], filename, { type: "image/png" }) : null;
      const nav = navigator as Navigator & { canShare?: (data?: { files?: File[] }) => boolean; share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void> };
      if (file && nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "امضای دستی", text: "تصویر امضای ثبت‌شده" });
        setStatus({ tone: "ok", text: "پنجرهٔ ذخیره/ارسال سیستم باز شد." });
      } else {
        setStatus({ tone: "info", text: "این دستگاه اشتراک فایل را پشتیبانی نمی‌کند؛ از دکمهٔ «دانلود PNG» یا پیوند مستقیم استفاده کنید." });
      }
    } catch {
      setStatus({ tone: "err", text: "اشتراک‌گذاری ممکن نشد؛ لینک مستقیم پایین را امتحان کنید." });
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
            <button type="button" onClick={download} disabled={busy !== null} className="flex items-center gap-1 rounded-lg border border-mint-300/20 bg-mint-300/[0.08] px-2.5 py-1.5 text-[8px] text-mint-300 disabled:opacity-50">{busy === "pdf" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} دانلود PNG</button>
            <button type="button" onClick={print} disabled={busy !== null} className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[8px] text-[#c8ddd1] disabled:opacity-50">{busy === "print" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />} چاپ</button>
            <button type="button" onClick={share} disabled={busy !== null} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[8px] text-[#b9cec3] disabled:opacity-50">ذخیره / ارسال</button>
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-2 py-1.5 text-[#9fb6aa]" aria-label="بستن"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="bg-white p-3"><img src={image} alt={`امضای ${name}`} className="mx-auto max-h-[52vh] w-full object-contain" /></div>
        {status && <p className={`px-4 pt-2 text-[8px] leading-5 ${status.tone === "err" ? "text-[#efad9f]" : status.tone === "ok" ? "text-mint-300" : "text-[#c8ddd1]"}`}>{status.tone === "ok" ? <Check className="ml-1 inline h-3 w-3" /> : null}{status.text}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
          <p className="text-[8px] leading-4 text-[#78968a]">اگر مرورگر دانلود خودکار را مسدود کرد، این پیوند را مستقیم باز کنید:</p>
          <a href={directUrl} download={filename} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border border-mint-300/25 bg-mint-300/[0.06] px-2.5 py-1.5 text-[8px] text-mint-300"><Save className="h-3 w-3" /> ذخیرهٔ مستقیم PNG</a>
        </div>
        <p className="px-4 pb-3 text-[7px] leading-4 text-[#6f8c7f]">تصویر با کیفیت اصلی ذخیره می‌شود. برای اعتبار رسمی، امضای حضوری روی نسخهٔ کاغذی یا گواهی معتبر مرکز صدور گواهی لازم است.</p>
      </div>
    </div>,
    document.body
  );
}
