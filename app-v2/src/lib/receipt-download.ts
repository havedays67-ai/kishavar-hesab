/**
 * دانلود واقعی فایل رسید — روی وب و اندروید (Capacitor)
 * ------------------------------------------------------------
 * پیش‌تر دانلود با لینک ساده انجام می‌شد و در وب‌ویو اندروید فقط تصویر
 * باز می‌شد یا فایل بی‌پسوند ذخیره می‌شد. اکنون:
 *  ۱) روی دستگاه اندرویدی فایل در حافظهٔ برنامه نوشته و با «اشتراک‌گذاری/ذخیره»
 *     سیستم به کاربر داده می‌شود (کاربر می‌تواند در گالری یا دانلودها ذخیره کند).
 *  ۲) در مرورگر، از Blob + لینک موقت با نام و پسوند درست استفاده می‌شود.
 *  ۳) اگر هیچ‌کدام نشد، در پنجرهٔ جدید باز می‌شود تا کاربر خودش ذخیره کند.
 */

import type { StoredReceipt } from "./receipts";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

function extensionFor(row: StoredReceipt): string {
  const fromMime = MIME_EXT[row.mimeType.toLowerCase().split(";")[0]] ?? "";
  if (fromMime) return fromMime;
  const dataUrlMime = /^data:([^;,]+)/.exec(row.dataUrl)?.[1]?.toLowerCase() ?? "";
  if (MIME_EXT[dataUrlMime]) return MIME_EXT[dataUrlMime];
  const fromName = /\.([a-z0-9]{2,5})$/i.exec(row.fileName ?? "")?.[1]?.toLowerCase();
  if (fromName && !fromName.includes("/")) return fromName;
  return dataUrlMime.includes("pdf") ? "pdf" : "jpg";
}

export function receiptFileName(row: StoredReceipt): string {
  const base =
    (row.fileName ?? "")
      .replace(/\.[^.]+$/, "")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .trim() ||
    (row.title ?? "receipt")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .trim() ||
    "receipt";
  return `${base}.${extensionFor(row)}`;
}

export function receiptMime(row: StoredReceipt): string {
  if (row.mimeType) return row.mimeType;
  return row.dataUrl.startsWith("data:application/pdf") ? "application/pdf" : "image/jpeg";
}

export function receiptIsPdf(row: StoredReceipt): boolean {
  return receiptMime(row).toLowerCase().includes("pdf");
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("فایل رسید سالم نیست");
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "application/octet-stream";
  const base64 = header.includes(";base64") ? body : "";
  if (!base64) {
    return new Blob([decodeURIComponent(body)], { type: mime });
  }
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

type NativeBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

/**
 * ذخیره/اشتراک‌گذاری فایل روی اندروید.
 * @returns true اگر فایل با موفقیت به کاربر داده شد.
 */
async function saveOnDevice(row: StoredReceipt): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const bridge = (window as unknown as { Capacitor?: NativeBridge }).Capacitor;
  if (!bridge?.isNativePlatform?.()) return false;
  try {
    const filesystem = await import("@capacitor/filesystem");
    const share = await import("@capacitor/share");
    const filename = receiptFileName(row);
    const base64 = row.dataUrl.slice(row.dataUrl.indexOf(",") + 1);
    const written = await filesystem.Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: filesystem.Directory.Cache,
      recursive: true,
    });
    if (written?.uri) {
      const canShare = await share.Share.canShare().catch(() => ({ value: true }));
      if (canShare?.value !== false) {
        await share.Share.share({
          title: row.title || "رسید",
          text: "رسید ذخیره‌شده در کشاورزحساب",
          files: [written.uri],
          dialogTitle: "ذخیره یا ارسال رسید",
        });
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/** دانلود/ذخیرهٔ فایل رسید؛ خروجی برای نمایش پیام به کاربر است. */
export async function downloadReceiptFile(row: StoredReceipt): Promise<{ ok: boolean; message: string }> {
  const filename = receiptFileName(row);
  try {
    if (await saveOnDevice(row)) {
      return { ok: true, message: `فایل «${filename}» آمادهٔ ذخیره/ارسال شد.` };
    }
  } catch {
    // ادامه با روش مرورگری
  }

  try {
    const blob = dataUrlToBlob(row.dataUrl);
    const typed = new Blob([blob], { type: receiptMime(row) });
    const objectUrl = URL.createObjectURL(typed);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 8000);
    return { ok: true, message: `دانلود «${filename}» آغاز شد.` };
  } catch {
    try {
      const opened = window.open(row.dataUrl, "_blank", "noopener,noreferrer");
      if (opened) return { ok: true, message: "فایل در پنجرهٔ جدید باز شد؛ از همان‌جا ذخیره کنید." };
    } catch {
      // پایان
    }
    return { ok: false, message: "دانلود فایل ممکن نشد؛ دوباره تلاش کنید." };
  }
}

/** گشودن فایل با اپلیکیشن پیش‌فرض (برای مشاهدهٔ PDF در اندروید). */
export async function openReceiptExternally(row: StoredReceipt): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const bridge = (window as unknown as { Capacitor?: NativeBridge }).Capacitor;
  if (!bridge?.isNativePlatform?.()) return false;
  try {
    const filesystem = await import("@capacitor/filesystem");
    const share = await import("@capacitor/share");
    const filename = receiptFileName(row);
    const base64 = row.dataUrl.slice(row.dataUrl.indexOf(",") + 1);
    const written = await filesystem.Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: filesystem.Directory.Cache,
      recursive: true,
    });
    if (!written?.uri) return false;
    await share.Share.share({ title: row.title || "رسید", files: [written.uri], dialogTitle: "بازکردن رسید" });
    return true;
  } catch {
    return false;
  }
}
