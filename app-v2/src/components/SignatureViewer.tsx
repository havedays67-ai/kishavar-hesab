import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Download, X, ZoomIn } from "lucide-react";

export function SignatureViewer({ image, name, onClose }: { image: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const download = () => {
    const anchor = document.createElement("a");
    anchor.href = image;
    anchor.download = `امضا-${name.replace(/\s+/g, "-")}.png`;
    anchor.click();
  };
  const print = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!doctype html><html dir="rtl"><head><title>امضای ${name}</title><style>body{display:grid;place-items:center;height:100vh;margin:0;font-family:Tahoma}img{max-width:90vw;max-height:85vh;image-rendering:auto}</style></head><body><div style="text-align:center"><img src="${image}" alt="امضا"/><p>امضای ${name}</p></div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#020806]/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`مشاهده امضای ${name}`}>
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="بستن" />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-[#29483b] bg-[#0d1d16]">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-medium text-[#dcebe2]"><ZoomIn className="h-4 w-4 text-mint-300" />امضای {name}</div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={download} className="flex items-center gap-1 rounded-lg border border-mint-300/20 bg-mint-300/[0.08] px-2.5 py-1.5 text-[8px] text-mint-300"><Download className="h-3 w-3" /> دانلود با کیفیت</button>
            <button type="button" onClick={print} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[8px] text-[#b9cec3]">چاپ</button>
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-2 py-1.5 text-[#9fb6aa]" aria-label="بستن"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="bg-white p-3"><img src={image} alt={`امضای ${name}`} className="mx-auto max-h-[60vh] w-full object-contain" /></div>
        <p className="px-4 py-2 text-[8px] text-[#78968a]">تصویر با کیفیت اصلی ذخیره‌شده در برنامه نمایش داده می‌شود؛ برای ذخیره، «دانلود با کیفیت» را بزنید.</p>
      </div>
    </div>,
    document.body
  );
}
