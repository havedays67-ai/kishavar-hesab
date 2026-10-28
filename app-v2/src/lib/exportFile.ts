/**
 * لایهٔ یکپارچهٔ ذخیره، اشتراک‌گذاری و چاپ اسناد
 * ------------------------------------------------------------------
 * باگ‌های گزارش‌شده و ریشهٔ آن‌ها:
 *  ۱) «دانلود هیچ کاری نمی‌کند»: در WebView اندروید لینک
 *     `<a download>` نه دانلود می‌شود و نه باز می‌شود؛ در وب هم اگر
 *     کلیک بعد از چند await انجام شود، مرورگر آن را «بدون اشارهٔ
 *     کاربر» می‌داند و مسدود می‌کند. راه‌حل: کلیک وب کاملاً همگام،
 *     و در APK نوشتن فایل با Filesystem + پنجرهٔ ذخیره/ارسال سیستم.
 *  ۲) «صفحهٔ سیاه چاپ»: تم تیرهٔ برنامه به پنجرهٔ چاپ منتقل می‌شد و
 *     window.open در WebView برگهٔ خالی می‌ساخت. راه‌حل: چاپ فقط با
 *     iframe هم‌صفحه و CSS سفید؛ در APK خروجی PDF واقعی ساخته و با
 *     برنامهٔ PDF‌خوان سیستم چاپ می‌شود.
 */
import { Capacitor } from "@capacitor/core";

export type SaveMode = "download" | "share" | "open" | "error";

export interface SaveResult {
  ok: boolean;
  mode: SaveMode;
  message: string;
  url?: string;
  filename: string;
}

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function safeFileName(name: string, extension = "png"): string {
  const clean = (name || "file")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  return `${clean || "file"}.${extension}`;
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    if (!dataUrl || dataUrl.startsWith("blob:")) return null;
    const [header, payload] = dataUrl.split(",");
    if (!payload) return null;
    const mime = /data:([^;]+)/.exec(header)?.[1] || "application/octet-stream";
    if (header.includes(";base64")) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(payload)], { type: mime });
  } catch {
    return null;
  }
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

/**
 * ذخیرهٔ فوری Data-URL. باید بدون await و مستقیماً داخل onClick صدا
 * زده شود تا مرورگر اجازهٔ دانلود را نگیرد.
 */
export function downloadDataUrl(dataUrl: string, filename: string): SaveResult {
  if (!dataUrl) {
    return { ok: false, mode: "error", message: "دادهٔ فایل خالی است.", filename };
  }
  if (isNativeApp()) {
    return {
      ok: false,
      mode: "error",
      message: "برای ذخیره در اندروید از دکمهٔ «ذخیره / ارسال» استفاده کنید.",
      url: dataUrl,
      filename,
    };
  }
  try {
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return { ok: true, mode: "download", message: `دانلود «${filename}» آغاز شد.`, url: dataUrl, filename };
  } catch {
    return { ok: false, mode: "error", message: "مرورگر اجازهٔ ذخیرهٔ فایل را نداد.", url: dataUrl, filename };
  }
}

export function createObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * ذخیرهٔ Blob در وب (دانلود) و در APK (نوشتن فایل + پنجرهٔ ذخیره/ارسال).
 * همیشه پیام روشن و در صورت امکان لینک مستقیم برمی‌گرداند تا هیچ
 * کلیکی «بی‌صدا» نماند.
 */
export async function saveBlob(blob: Blob, filename: string, title = "فایل"): Promise<SaveResult> {
  if (isNativeApp()) {
    let savedUri = "";
    let savedDirectory = "";
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const base64 = await blobToBase64(blob);
      const candidates = [
        { directory: Directory.Cache, label: "حافظهٔ موقت برنامه" },
        { directory: Directory.Documents, label: "پوشهٔ اسناد برنامه" },
      ];
      for (const candidate of candidates) {
        try {
          const written = await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: candidate.directory,
            recursive: true,
          });
          savedUri = written.uri;
          savedDirectory = candidate.label;
          break;
        } catch {
          /* پوشهٔ بعدی را امتحان می‌کنیم */
        }
      }
    } catch {
      savedUri = "";
    }

    if (savedUri) {
      try {
        const { Share } = await import("@capacitor/share");
        const capability = await Share.canShare().catch(() => ({ value: false }));
        if (capability.value) {
          await Share.share({
            title,
            text: `${title} — کشاورزحساب`,
            url: savedUri,
            dialogTitle: "ذخیره، ارسال یا چاپ",
          });
          return {
            ok: true,
            mode: "share",
            message: `فایل در ${savedDirectory} ذخیره شد؛ پنجرهٔ سیستم باز شد. برای چاپ، «چاپ» یا یک برنامهٔ PDF‌خوان را انتخاب کنید.`,
            url: savedUri,
            filename,
          };
        }
      } catch {
        /* پیام ذخیره کافی است */
      }
      return {
        ok: true,
        mode: "open",
        message: `فایل با نام «${filename}» در ${savedDirectory} ذخیره شد.`,
        url: savedUri,
        filename,
      };
    }

    try {
      const file = new File([blob], filename, { type: blob.type });
      const nav = navigator as Navigator & {
        canShare?: (data?: { files?: File[] }) => boolean;
        share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title, text: title });
        return { ok: true, mode: "share", message: "پنجرهٔ ذخیره/ارسال سیستم باز شد.", filename };
      }
    } catch {
      /* ادامه می‌دهیم */
    }

    return {
      ok: false,
      mode: "error",
      message: "نوشتن فایل در حافظهٔ دستگاه ممکن نشد. اجازهٔ ذخیره‌سازی برنامه را بررسی کنید یا دکمهٔ «ارسال» را بزنید.",
      filename,
    };
  }

  try {
    const url = createObjectUrl(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    return {
      ok: true,
      mode: "download",
      message: `فایل «${filename}» ساخته شد؛ اگر دانلود خودکار شروع نشد، روی «ذخیرهٔ مستقیم» بزنید.`,
      url,
      filename,
    };
  } catch {
    return { ok: false, mode: "error", message: "مرورگر اجازهٔ ذخیرهٔ فایل را نداد؛ لینک را در تب جدید باز کنید.", filename };
  }
}

export async function saveDataUrl(dataUrl: string, filename: string, title = "فایل"): Promise<SaveResult> {
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) {
    if (!dataUrl) return { ok: false, mode: "error", message: "دادهٔ فایل خالی است.", filename };
    return isNativeApp()
      ? { ok: false, mode: "error", message: "ذخیره در اندروید ممکن نشد؛ دکمهٔ «ارسال» را امتحان کنید.", url: dataUrl, filename }
      : downloadDataUrl(dataUrl, filename);
  }
  return saveBlob(blob, filename, title);
}

export function collectDocumentStyles(): string {
  return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join("\n");
}

/**
 * CSS بازنشانی چاپ: سفید کردن کامل پس‌زمینه، حذف سایه/شفافیت و
 * جلوگیری از انتقال تم تیرهٔ برنامه به کاغذ (ریشهٔ «صفحهٔ سیاه»).
 */
export const PRINT_RESET_CSS = `
  @page { size: A4; margin: 10mm; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0 !important; padding: 0 !important;
    background: #ffffff !important; color: #18241e !important;
    color-scheme: only light !important;
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  body { -webkit-text-size-adjust: 100%; }
  .no-print, .no-print * { display: none !important; }
  .print-sheet {
    width: 100% !important; max-width: none !important; min-height: 0 !important;
    margin: 0 !important; padding: 0 !important; border: 0 !important;
    border-radius: 0 !important; box-shadow: none !important;
    background: #ffffff !important; color: #18241e !important;
    overflow: visible !important;
  }
  .print-sheet table { page-break-inside: auto; }
  .print-sheet tr, .print-sheet section { page-break-inside: avoid; }
  .print-sheet img { max-width: 100%; }
  .print-sheet .doc-overlay, .print-sheet .doc-scroll {
    position: static !important; overflow: visible !important;
    background: #ffffff !important; padding: 0 !important;
  }
  @media print {
    html, body { background: #ffffff !important; }
    .print-sheet { font-size: 10.5pt; }
  }
`;

export interface PrintDocumentOptions {
  bodyHtml: string;
  title: string;
  styles?: string;
  extraCss?: string;
  autoPrint?: boolean;
  onDone?: () => void;
}

const PRINT_IFRAME_ID = "kishavar-print-frame";

function removePrintFrame() {
  document.getElementById(PRINT_IFRAME_ID)?.remove();
}

/**
 * چاپ امن در همان صفحه با iframe سفید؛ بدون پاپ‌آپ و بدون برگهٔ سیاه.
 * در APK (WebView) چاپ در دسترس نیست و false برمی‌گردد تا caller
 * مسیر PDF/اشتراک را اجرا کند.
 */
export function printDocument({
  bodyHtml,
  title,
  styles = "",
  extraCss = "",
  autoPrint = true,
  onDone,
}: PrintDocumentOptions): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (isNativeApp()) return false;
  if (!bodyHtml.trim()) return false;

  removePrintFrame();
  const iframe = document.createElement("iframe");
  iframe.id = PRINT_IFRAME_ID;
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", `نسخهٔ چاپ ${title}`);
  iframe.style.cssText =
    "position:fixed;left:0;top:0;width:820px;height:1160px;opacity:0.01;pointer-events:none;border:0;z-index:2147483647;background:#fff;";
  document.body.appendChild(iframe);

  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    return false;
  }

  const safeTitle = (title || "سند").replace(/[<>&"]/g, "");
  const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  ${styles}
  <style>${PRINT_RESET_CSS}\n${extraCss}</style>
</head>
<body>${bodyHtml}</body>
</html>`;

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  let printed = false;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    removePrintFrame();
    onDone?.();
  };

  const runPrint = async () => {
    if (printed) return;
    printed = true;
    try {
      const fonts = (frameDocument as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
      if (fonts) await Promise.race([fonts, new Promise((resolve) => window.setTimeout(resolve, 900))]);
      const images = Array.from(frameDocument.images);
      await Promise.race([
        Promise.all(
          images.map((image) =>
            image.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  image.addEventListener("load", () => resolve(), { once: true });
                  image.addEventListener("error", () => resolve(), { once: true });
                })
          )
        ),
        new Promise((resolve) => window.setTimeout(resolve, 1600)),
      ]);
      if (!frameWindow.document.body || !frameWindow.document.body.innerHTML.trim()) return;
      frameWindow.focus();
      frameWindow.print();
    } catch {
      /* caller پیام جایگزین PDF را نمایش می‌دهد */
    } finally {
      window.setTimeout(cleanup, 3000);
    }
  };

  if (autoPrint) {
    iframe.addEventListener("load", () => void runPrint(), { once: true });
    window.setTimeout(() => {
      if (!printed) void runPrint();
    }, 700);
  }
  return true;
}

/** ساخت HTML کامل و مستقل برای ذخیره یا چاپ دستی در مرورگر. */
export function buildPrintableHtml(title: string, sheetHtml: string, styles = ""): string {
  const safeTitle = (title || "سند").replace(/[<>&"]/g, "");
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
${styles}
<style>${PRINT_RESET_CSS}</style>
</head>
<body>${sheetHtml}</body>
</html>`;
}

export async function renderSignaturePng(dataUrl: string): Promise<Blob | null> {
  if (!dataUrl) return null;
  const image = new Image();
  image.decoding = "async";
  image.src = dataUrl;
  try {
    await image.decode();
  } catch {
    return dataUrlToBlob(dataUrl);
  }
  const width = image.naturalWidth || 1280;
  const height = image.naturalHeight || 360;
  const scale = Math.min(3, Math.max(1, 2400 / width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) return dataUrlToBlob(dataUrl);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/** Data-URL همگام از تصویر امضا؛ برای دانلود فوری بدون بلوکه‌شدن. */
export function signatureDataUrlNow(dataUrl: string): string {
  try {
    const image = new Image();
    image.src = dataUrl;
    const width = image.naturalWidth || image.width || 0;
    const height = image.naturalHeight || image.height || 0;
    if (!width || !height) return dataUrl;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return dataUrl;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}
