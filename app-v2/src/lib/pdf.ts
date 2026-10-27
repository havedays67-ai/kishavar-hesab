import { Capacitor } from "@capacitor/core";

/**
 * تولید PDF واقعی از عنصر سند و ذخیره/اشتراک‌گذاری آن.
 * - در مرورگر: فایل PDF مستقیماً دانلود می‌شود.
 * - در APK اندروید: فایل در حافظه موقت نوشته و پنجره «ذخیره/ارسال» سیستم باز می‌شود
 *   (کاربر می‌تواند در فایل‌ها ذخیره کند یا با چاپگر/درایو به اشتراک بگذارد).
 * چاپ از طریق iframe همان صفحه انجام می‌شود و دیگر پنجره کروم باز نمی‌کند.
 */

export type PdfResult = {
  ok: boolean;
  mode: "download" | "share" | "print" | "error";
  message: string;
};

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 90);
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.onerror = () => reject(new Error("خواندن فایل ممکن نشد."));
    reader.readAsDataURL(blob);
  });
}

/** کلون سند با عرض ثابت A4 برای جلوگیری از خروجی باریک/بریده در موبایل */
function buildPrintClone(element: HTMLElement): HTMLDivElement {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "794px";
  host.style.background = "#ffffff";
  host.style.zIndex = "-1";
  host.setAttribute("dir", "rtl");
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.width = "794px";
  clone.style.maxWidth = "none";
  clone.style.margin = "0";
  host.appendChild(clone);
  document.body.appendChild(host);
  return host;
}

async function renderElementToPdf(element: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* فونت‌ها آماده نیستند؛ ادامه می‌دهیم */
    }
  }

  const host = buildPrintClone(element);
  const target = host.firstElementChild as HTMLElement;
  // اطمینان از بارگذاری QR و فونت‌ها پیش از عکس‌برداری
  const images = Array.from(target.querySelectorAll("img"));
  await Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => { image.onload = () => resolve(); image.onerror = () => resolve(); })));
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(target, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: 794,
      height: target.scrollHeight,
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0,
    });
  } finally {
    host.remove();
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const imageWidth = A4_WIDTH_MM;
  const pageHeightPx = Math.floor((canvas.width * (A4_HEIGHT_MM / A4_WIDTH_MM)));
  const pages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

  for (let page = 0; page < pages; page += 1) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - page * pageHeightPx);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const context = slice.getContext("2d");
    if (!context) continue;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, slice.width, slice.height);
    context.drawImage(
      canvas,
      0,
      page * pageHeightPx,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );
    const image = slice.toDataURL("image/jpeg", 0.94);
    const heightMm = (sliceHeight * imageWidth) / canvas.width;
    if (page > 0) pdf.addPage();
    pdf.addImage(image, "JPEG", 0, 0, imageWidth, heightMm);
  }

  return pdf.output("blob");
}

export async function deliverDocumentPdf(element: HTMLElement | null, fileBaseName: string): Promise<PdfResult> {
  if (!element) return { ok: false, mode: "error", message: "سند برای دانلود پیدا نشد." };
  let blob: Blob;
  try {
    blob = await renderElementToPdf(element);
  } catch {
    return { ok: false, mode: "error", message: "ساخت PDF ممکن نشد؛ دوباره تلاش کنید یا از «ذخیره HTML» استفاده کنید." };
  }
  const filename = `${safeName(fileBaseName)}.pdf`;
  const file = new File([blob], filename, { type: "application/pdf" });

  if (Capacitor.isNativePlatform()) {
    // ۱) ذخیره و ارسال با پلاگین‌های Capacitor (در APK نصب شده‌اند)
    try {
      if (Capacitor.isPluginAvailable("Filesystem") && Capacitor.isPluginAvailable("Share")) {
        const [{ Filesystem, Directory }, { Share }] = await Promise.all([
          import("@capacitor/filesystem"),
          import("@capacitor/share"),
        ]);
        const base64 = await blobToBase64(blob);
        const written = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache, recursive: true });
        const canShare = await Share.canShare().catch(() => ({ value: false }));
        if (canShare.value) {
          await Share.share({ title: filename, text: "سند کسب‌وکار من", url: written.uri, dialogTitle: "ذخیره یا ارسال PDF" });
          return { ok: true, mode: "share", message: "PDF ساخته شد؛ در پنجره سیستم «ذخیره» یا برنامه دلخواه را انتخاب کنید." };
        }
        return { ok: true, mode: "share", message: "PDF در حافظه موقت ساخته شد." };
      }
    } catch {
      // به روش‌های جایگزین می‌رویم
    }

    // ۲) Web Share API (در صورت پشتیبانی دستگاه)
    try {
      const nav = navigator as Navigator & { canShare?: (data?: { files?: File[] }) => boolean; share?: (data: { files?: File[]; title?: string }) => Promise<void> };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: filename });
        return { ok: true, mode: "share", message: "پنجره ذخیره/ارسال سیستم باز شد." };
      }
    } catch {
      // ادامه می‌دهیم
    }

    // ۳) نمایش PDF داخل برنامه برای ذخیره دستی/اسکرین‌شات
    try {
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, "_blank");
      if (opened) {
        window.setTimeout(() => URL.revokeObjectURL(url), 120000);
        return { ok: true, mode: "print", message: "PDF در پنجره پیش‌نمایش باز شد." };
      }
      return { ok: true, mode: "print", message: "فایل PDF آماده شد؛ از دکمه «چاپ» یا «ذخیره HTML» هم می‌توانید استفاده کنید." };
    } catch {
      return { ok: false, mode: "error", message: "ذخیره PDF در این دستگاه ممکن نشد؛ از «ذخیره HTML» یا دکمه چاپ استفاده کنید." };
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 8000);
    return { ok: true, mode: "download", message: "فایل PDF دانلود شد." };
  } catch {
    return { ok: false, mode: "error", message: "دانلود PDF ممکن نشد؛ از «ذخیره HTML» استفاده کنید." };
  }
}

/** چاپ واقعی همان سند از داخل برنامه (بدون پنجره جدید کروم) */
export function printSheetInPage(element: HTMLElement | null, title: string): boolean {
  if (!element) {
    window.print();
    return false;
  }
  const clone = buildPrintClone(element);
  const cloneHtml = (clone.firstElementChild as HTMLElement).outerHTML;
  clone.remove();

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "-10000px";
  iframe.style.bottom = "0";
  iframe.style.width = "820px";
  iframe.style.height = "1160px";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const frameDocument = iframe.contentDocument;
  if (!frameDocument) {
    iframe.remove();
    window.print();
    return false;
  }

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join("\n");

  frameDocument.open();
  frameDocument.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${title.replace(/[<>&"]/g, "")}</title>${styles}
  <style>
    @page{size:A4;margin:10mm}
    html,body{margin:0!important;padding:0!important;background:#fff!important}
    .print-sheet{width:100%!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:#fff!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .no-print{display:none!important}
  </style></head><body>${cloneHtml}</body></html>`);
  frameDocument.close();

  window.setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(() => iframe.remove(), 2500);
    }
  }, 550);
  return true;
}

export function deliverHtmlFile(html: string, fileBaseName: string): boolean {
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeName(fileBaseName)}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 6000);
    return true;
  } catch {
    return false;
  }
}
