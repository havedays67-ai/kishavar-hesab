/**
 * تولید PDF واقعی و چاپ سند
 * ------------------------------------------------------------
 * • PDF از عنصر سند با عرض ثابت A4 ساخته می‌شود.
 * • لینک مستقیم خروجی برگردانده می‌شود تا در صورت مسدودشدن دانلود
 *   خودکار مرورگر، کاربر با یک کلیک خودش فایل را ذخیره کند.
 * • چاپ در iframe مستقل و روشن انجام می‌شود؛ استایل تیرهٔ برنامه
 *   هرگز به کاغذ منتقل نمی‌شود (رفع صفحهٔ سیاه چاپ).
 */
import {
  PRINT_RESET_CSS,
  collectDocumentStyles,
  printDocument,
  safeFileName,
  saveBlob,
  type SaveMode,
} from "./exportFile";

export type PdfResult = {
  ok: boolean;
  mode: SaveMode;
  message: string;
  url?: string;
  filename?: string;
};

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

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

async function waitForDocumentAssets(target: HTMLElement): Promise<void> {
  if (document.fonts?.ready) {
    try {
      await Promise.race([document.fonts.ready, new Promise((resolve) => window.setTimeout(resolve, 1400))]);
    } catch {
      /* ادامه می‌دهیم */
    }
  }
  const images = Array.from(target.querySelectorAll("img"));
  await Promise.race([
    Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    }))),
    new Promise((resolve) => window.setTimeout(resolve, 1800)),
  ]);
}

async function renderElementToPdf(element: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  await waitForDocumentAssets(element);
  const host = buildPrintClone(element);
  const target = host.firstElementChild as HTMLElement;
  // تصاویر داخل کلون هم باید کامل باشند (QR و امضاها)
  const images = Array.from(target.querySelectorAll("img"));
  await Promise.race([
    Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    }))),
    new Promise((resolve) => window.setTimeout(resolve, 1500)),
  ]);

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(target, {
      scale: 1.8,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: 794,
      height: target.scrollHeight,
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0,
      onclone: (cloned) => {
        cloned.documentElement.style.background = "#ffffff";
        cloned.body.style.background = "#ffffff";
        cloned.body.style.color = "#18241e";
      },
    });
  } finally {
    host.remove();
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const imageWidth = A4_WIDTH_MM;
  const pageHeightPx = Math.floor(canvas.width * (A4_HEIGHT_MM / A4_WIDTH_MM));
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
    context.drawImage(canvas, 0, page * pageHeightPx, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
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
    return {
      ok: false,
      mode: "error",
      message: "ساخت PDF ممکن نشد؛ از «چاپ» یا «ذخیره HTML» استفاده کنید. تصویر PNG نیز به‌عنوان نسخهٔ جایگزین در دسترس است.",
    };
  }
  const filename = safeFileName(fileBaseName, "pdf");
  const result = await saveBlob(blob, filename, "سند چاپی کشاورزحساب");
  return {
    ok: result.ok,
    mode: result.mode,
    message: result.ok
      ? result.mode === "download"
        ? `${result.message} (فایل: ${filename})`
        : result.message
      : result.message,
    url: result.url,
    filename,
  };
}

/** چاپ واقعی همان سند از داخل برنامه؛ iframe روشن، بدون پاپ‌آپ و بدون صفحهٔ سیاه */
export function printSheetInPage(element: HTMLElement | null, title: string): boolean {
  if (!element) return false;
  const sheet = element.outerHTML;
  return printDocument({
    title,
    bodyHtml: `<main dir="rtl" id="print-root">${sheet}</main>`,
    styles: collectDocumentStyles(),
    extraCss: `${PRINT_RESET_CSS}\nbody{padding:0;margin:0}#print-root{padding:0;margin:0;background:#fff}.sheet{background:#fff}.print-sheet{box-shadow:none!important}`,
    autoPrint: true,
  });
}

export function deliverHtmlFile(html: string, fileBaseName: string): boolean {
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeFileName(fileBaseName, "html");
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch {
    return false;
  }
}

/** ذخیرهٔ PNG از همان پیش‌نمایش سند؛ مسیر قطعی جایگزین چاپ. */
export async function deliverDocumentPng(element: HTMLElement | null, fileBaseName: string): Promise<PdfResult> {
  if (!element) return { ok: false, mode: "error", message: "سند برای تصویر پیدا نشد." };
  try {
    const [{ default: html2canvas }] = await Promise.all([import("html2canvas-pro")]);
    await waitForDocumentAssets(element);
    const host = buildPrintClone(element);
    const target = host.firstElementChild as HTMLElement;
    try {
      const canvas = await html2canvas(target, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, width: 794, windowWidth: 794 });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), "image/png"));
      if (!blob) return { ok: false, mode: "error", message: "تبدیل سند به PNG ممکن نشد." };
      const filename = safeFileName(fileBaseName, "png");
      const result = await saveBlob(blob, filename, "تصویر سند");
      return { ok: result.ok, mode: result.mode, message: result.ok ? `تصویر سند ساخته شد (${filename}).` : result.message, url: result.url, filename };
    } finally {
      host.remove();
    }
  } catch {
    return { ok: false, mode: "error", message: "ساخت PNG ممکن نشد؛ از «ذخیره HTML» استفاده کنید." };
  }
}
