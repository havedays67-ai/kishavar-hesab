/**
 * «باز نشانی» — یک نقطهٔ مشترک برای هم‌رسانی سند، رسید و لینک استعلام.
 * اولویت: اشتراک‌گذاری بومی دستگاه (Web Share / Capacitor) → کپی در کلیپ‌بورد → باز کردن در تب تازه.
 * هیچ داده‌ای به سرور فرستاده نمی‌شود؛ همه‌چیز روی خود دستگاه انجام می‌شود.
 */

export type ShareOutcome = "shared" | "copied" | "opened" | "failed" | "cancelled";

export interface ShareLinkInput {
  title: string;
  text?: string;
  url: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // افتادن به روش قدیمی
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** هم‌رسانی یک نشانی (لینک استعلام سند یا هر لینک دیگر). */
export async function shareLink(input: ShareLinkInput): Promise<ShareOutcome> {
  const { title, text, url } = input;
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void>; canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === "function") {
    try {
      const data: ShareData = { title, text: text ?? title, url };
      if (!nav.canShare || nav.canShare(data)) {
        await nav.share(data);
        return "shared";
      }
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return "cancelled";
    }
  }
  if (await copyText(url)) return "copied";
  try {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) return "opened";
  } catch {
    // پایین‌تر شکست گزارش می‌شود
  }
  return "failed";
}

/** هم‌رسانی فایل (تصویر رسید یا PDF) با اجازهٔ دستگاه؛ در نبود پشتیبانی، دانلود می‌کند. */
export async function shareFile(input: { title: string; fileName: string; dataUrl: string; text?: string }): Promise<ShareOutcome> {
  const { title, fileName, dataUrl, text } = input;
  const nav = navigator as Navigator & {
    share?: (data: ShareData & { files?: File[] }) => Promise<void>;
    canShare?: (data: ShareData & { files?: File[] }) => boolean;
  };
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
    if (typeof nav.share === "function" && (!nav.canShare || nav.canShare({ files: [file] }))) {
      await nav.share({ title, text: text ?? title, files: [file] });
      return "shared";
    }
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") return "cancelled";
  }
  if (await copyText(dataUrl)) return "copied";
  try {
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return "opened";
  } catch {
    return "failed";
  }
}

export function shareOutcomeMessage(outcome: ShareOutcome, kind: "link" | "file" = "link"): string {
  switch (outcome) {
    case "shared": return kind === "file" ? "فایل برای هم‌رسانی آماده شد." : "نشانی سند برای هم‌رسانی آماده شد.";
    case "copied": return kind === "file" ? "فایل کپی شد؛ می‌توانی در پیام‌رسان بچسبانی." : "نشانی سند کپی شد؛ در پیام‌رسان بچسبان.";
    case "opened": return kind === "file" ? "فایل ذخیره شد." : "نشانی سند در تب تازه باز شد.";
    case "cancelled": return "هم‌رسانی لغو شد.";
    default: return "هم‌رسانی ممکن نشد؛ دوباره تلاش کن.";
  }
}
