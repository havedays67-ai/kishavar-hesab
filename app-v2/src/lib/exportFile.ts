/**
 * لایهٔ یکپارچهٔ ذخیره و چاپ
 * ------------------------------------------------------------
 * مشکل گزارش‌شده: در برخی مرورگرها/WebViewها، دانلود خودکار پس از یک
 * await طولانی مسدود می‌شود و پنجرهٔ چاپ با استایل تیرهٔ برنامه، سیاه
 * چاپ می‌شود. این فایل:
 *  • داده را به Blob تبدیل و لینک دانلود واقعی می‌سازد؛
 *  • لینک مستقیم برمی‌گرداند تا حتی اگر دانلود خودکار مسدود شد،
 *    کاربر با کلیک خودش فایل را ذخیره کند؛
 *  • چاپ را در iframe مستقل با رنگ‌های روشن و انتظار برای فونت/عکس
 *    انجام می‌دهد؛
 *  • در APK از Filesystem/Share استفاده می‌کند.
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

export function safeFileName(name: string, extension = "png"): string {
  const clean = name
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  return `${clean || "file"}.${extension}`;
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    if (dataUrl.startsWith("blob:")) return null;
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

/** لینک زنده برای دکمهٔ «ذخیرهٔ مستقیم»؛ مالکیت revoke با caller است. */
export function createObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export async function saveBlob(blob: Blob, filename: string, title = "فایل"): Promise<SaveResult> {
  const native = Capacitor.isNativePlatform();
  if (native) {
    try {
      const [{ Filesystem, Directory }, shareModule] = await Promise.all([
        import("@capacitor/filesystem"),
        import("@capacitor/share").catch(() => null),
      ]);
      const base64 = await blobToBase64(blob);
      const written = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Documents, recursive: true });
      const share = shareModule?.Share;
      const canShare = await share?.canShare().catch(() => ({ value: false }));
      if (share && canShare?.value) {
        await share.share({ title, text: `${title} — ساخت کشاورزحساب`, url: written.uri, dialogTitle: "ذخیره یا ارسال فایل" });
        return { ok: true, mode: "share", message: "فایل ساخته شد؛ در پنجرهٔ سیستم «ذخیره» یا برنامهٔ دلخواه را بزنید.", filename };
      }
      return { ok: true, mode: "share", message: `فایل در پوشهٔ اسناد ذخیره شد: ${filename}`, filename };
    } catch {
      // Web Share یا دانلود مرورگر را امتحان می‌کنیم.
      try {
        const file = new File([blob], filename, { type: blob.type });
        const nav = navigator as Navigator & { canShare?: (data?: { files?: File[] }) => boolean; share?: (data: { files?: File[]; title?: string }) => Promise<void> };
        if (nav.canShare?.({ files: [file] }) && nav.share) {
          await nav.share({ files: [file], title });
          return { ok: true, mode: "share", message: "پنجرهٔ ذخیره/ارسال سیستم باز شد.", filename };
        }
      } catch {
        /* ادامه می‌دهیم */
      }
    }
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
    // پنج دقیقه زنده می‌ماند تا دکمهٔ «ذخیرهٔ مستقیم» قابل استفاده باشد.
    window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    return { ok: true, mode: "download", message: "فایل ساخته شد؛ اگر دانلود خودکار شروع نشد، روی «ذخیرهٔ مستقیم» بزنید.", url, filename };
  } catch {
    return { ok: false, mode: "error", message: "مرورگر اجازهٔ ذخیرهٔ فایل را نداد؛ لینک را در تب جدید باز کنید.", filename };
  }
}

export async function saveDataUrl(dataUrl: string, filename: string, title = "فایل"): Promise<SaveResult> {
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) {
    const result = saveOriginalDataUrl(dataUrl, filename);
    return result;
  }
  return saveBlob(blob, filename, title);
}

function saveOriginalDataUrl(dataUrl: string, filename: string): SaveResult {
  try {
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return { ok: true, mode: "download", message: "دانلود آغاز شد.", url: dataUrl, filename };
  } catch {
    return { ok: false, mode: "error", message: "ذخیرهٔ تصویر ممکن نشد.", filename };
  }
}

export function collectDocumentStyles(): string {
  return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join("\n");
}

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
  .no-print { display: none !important; }
  .print-sheet {
    width: 100% !important; max-width: none !important; min-height: 0 !important;
    margin: 0 !important; padding: 0 !important; border: 0 !important;
    border-radius: 0 !important; box-shadow: none !important;
    background: #ffffff !important; color: #18241e !important;
    overflow: visible !important;
  }
  .print-sheet table { page-break-inside: auto; }
  .print-sheet tr, .print-sheet section { page-break-inside: avoid; }
  img, svg { max-width: 100%; }
  @media print {
    html, body { background: #ffffff !important; }
    .doc-overlay, .doc-scroll { position: static !important; overflow: visible !important; background: #ffffff !important; padding: 0 !important; }
  }
`;

export interface PrintDocumentOptions {
  bodyHtml: string;
  title: string;
  styles?: string;
  extraCss?: string;
  /** اگر true باشد، بلافاصله پس از بارگذاری چاپ‌گر باز می‌شود. */
  autoPrint?: boolean;
  onDone?: () => void;
}

/**
 * چاپ در iframe هم‌صفحه (بدون پاپ‌آپ). iframe با رنگ روشن و بعد از
 * آماده‌شدن فونت‌ها و تصاویر چاپ می‌شود. اگر چاپ در دسترس نبود false
 * برمی‌گرداند تا caller مسیر جایگزین (دانلود PNG/PDF) را نشان دهد.
 */
export function printDocument({ bodyHtml, title, styles = "", extraCss = "", autoPrint = true, onDone }: PrintDocumentOptions): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", `نسخهٔ چاپ ${title}`);
  // در صحنهٔ دید بماند تا Chrome آن را رندر کند؛ با opacity نزدیک صفر پنهان است.
  iframe.style.cssText = "position:fixed;left:0;top:0;width:820px;height:1160px;opacity:0.01;pointer-events:none;border:0;z-index:2147483647;background:#fff;";
  document.body.appendChild(iframe);

  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    return false;
  }

  let printed = false;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    iframe.remove();
    onDone?.();
  };

  const safeTitle = (title || "سند").replace(/[<>&"]/g, "");
  const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  ${styles}
  <style>${PRINT_RESET_CSS}\n${extraCss}</style>
</head>
<body>${bodyHtml}</body>
</html>`;

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  const runPrint = async () => {
    if (printed) return;
    printed = true;
    try {
      const fonts = (frameDocument as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
      if (fonts) await Promise.race([fonts, new Promise((resolve) => window.setTimeout(resolve, 900))]);
      const images = Array.from(frameDocument.images);
      await Promise.race([
        Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }))),
        new Promise((resolve) => window.setTimeout(resolve, 1600)),
      ]);
      frameWindow.focus();
      frameWindow.print();
    } catch {
      // اگر چاپ داخل iframe ناموفق بود، چاپ صفحهٔ اصلی به‌عنوان پشتیبان
      try { window.print(); } catch { /* ignore */ }
    } finally {
      window.setTimeout(cleanup, 2500);
    }
  };

  if (autoPrint) {
    iframe.addEventListener("load", () => { void runPrint(); }, { once: true });
    // fallback برای مرورگرهایی که رویداد load را دیر یا اصلاً نمی‌دهند
    window.setTimeout(() => { if (!printed) void runPrint(); }, 700);
  }
  return true;
}

export async function renderSignaturePng(dataUrl: string): Promise<Blob | null> {
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
