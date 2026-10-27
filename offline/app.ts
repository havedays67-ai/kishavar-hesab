/**
 * کشاورزحساب — نقطه ورود اپ آفلاین (داخل APK).
 * هیچ درخواست شبکه‌ای وجود ندارد؛ همه داده‌ها روی همین دستگاه است.
 */
import { startApp } from "./ui";

if (typeof document !== "undefined") {
  const boot = () => {
    try {
      startApp();
    } catch (error) {
      const view = document.getElementById("view");
      if (view) {
        view.innerHTML = `<div class="card"><h2>خطا در راه‌اندازی</h2><div class="note">${String(error instanceof Error ? error.message : error)}</div><div class="note">می‌توانید داده‌های محلی را از بخش «بیشتر › پاک‌سازی» بازنشانی کنید.</div></div>`;
      }
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
