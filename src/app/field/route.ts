import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * نمایش نسخهٔ میدانی (همان بستهٔ APK) داخل مرورگر برای بررسی سریع.
 * فایل از خروجی ساخت app-v2 خوانده می‌شود: capacitor-web/index.html
 */
export async function GET() {
  try {
    const html = await readFile(path.join(process.cwd(), "capacitor-web", "index.html"), "utf8");
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response(
      `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><body style="font-family:Tahoma;background:#0a1712;color:#dcebe2;padding:24px">
        <h1>نسخهٔ میدانی ساخته نشده است</h1>
        <p>برای ساخت، در پوشهٔ app-v2 دستور npm run build را اجرا کنید؛ خروجی در capacitor-web/index.html قرار می‌گیرد.</p>
        <p><a style="color:#7fe0b4" href="/">بازگشت به نسخهٔ وب</a></p>
      </body></html>`,
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }
}
