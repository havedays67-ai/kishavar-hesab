// Cloudflare Worker: صفحه دانلود + manifest کشاورزحساب
// deploy: POST /accounts/{account}/workers/scripts/kishavar-download
const MANIFEST = {
  "schema": 1,
  "updatedAt": "2026-10-27T05:16:24Z",
  "app": {
    "name": "KishavarHesab",
    "nameFa": "کشاورزحساب",
    "applicationId": "ir.kishavarhesab.app",
    "version": "1.0.0",
    "versionCode": null,
    "minSdk": 26,
    "sizeBytes": 4013545,
    "sha256": "e0159a79d60d5a69478d019d5e674fc3cbabe0faad537a4ddff8c42a4f717110",
    "url": "https://github.com/havedays67-ai/kishavar-hesab/releases/download/apk-offline-mvp/KishavarHesab-1.0.0-offline.apk",
    "releaseNotes": "نسخه آفلاین MVP: ثبت هزینه/درآمد، دستیار با پیش‌نمایش و تأیید، گزارش و خروجی JSON. بدون سرور؛ داده‌ها روی گوشی. مدل زبانی هنوز همراه APK نیست.",
    "build": "offline-mvp"
  },
  "model": {
    "status": "not-published",
    "note": "مدل NLU هنوز آموزش ندیده و منتشر نشده است؛ پس از باک‌آف روی Kaggle و عبور از آستانه‌ها منتشر می‌شود.",
    "url": null,
    "sha256": null,
    "bytesTotal": null,
    "version": null
  },
  "dataset": {
    "name": "Hamio/kishavar-hesab-dataset",
    "url": "https://huggingface.co/datasets/Hamio/kishavar-hesab-dataset",
    "revision": "8f64775",
    "rows": {
      "train": 529,
      "val": 88,
      "test": 117,
      "hard": 50
    }
  },
  "serverRequired": false,
  "links": {
    "chat": "https://chat.tivachat-vflash-ai.ir",
    "download": "https://kishavar.tivachat-vflash-ai.ir"
  },
  "offline": true
};

const HTML = "<!doctype html>\n<html lang=\"fa\" dir=\"rtl\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>کشاورزحساب — دانلود</title>\n<meta name=\"description\" content=\"دانلود اپ حسابداری مزرعه کشاورزحساب، دیتاست و مدل NLU فارسی\">\n<style>\n:root{--bg:#0b1220;--card:#121c2e;--line:#23324d;--text:#e8eefc;--muted:#9fb0cc;--green:#34d399;--amber:#fbbf24;--blue:#60a5fa;--red:#f87171}\n*{box-sizing:border-box}\nbody{margin:0;background:radial-gradient(1200px 600px at 80% -10%,#17305a 0%,var(--bg) 55%);color:var(--text);font-family:system-ui,-apple-system,\"Segoe UI\",Tahoma,sans-serif;line-height:1.9}\n.wrap{max-width:860px;margin:0 auto;padding:32px 20px 64px}\nheader{display:flex;align-items:center;gap:14px;margin-bottom:26px}\n.logo{font-size:42px;line-height:1}\nh1{margin:0;font-size:26px}\n.sub{color:var(--muted);font-size:14px;margin-top:2px}\n.card{background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,0)) ,var(--card);border:1px solid var(--line);border-radius:18px;padding:22px;margin:16px 0}\n.badge{display:inline-block;font-size:12px;border:1px solid var(--line);border-radius:999px;padding:3px 10px;color:var(--muted);margin-inline-start:6px}\n.warn{border-color:#7c5a12;background:linear-gradient(180deg,rgba(251,191,36,.09),rgba(251,191,36,.02)),var(--card)}\n.warn b{color:var(--amber)}\n.btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;text-decoration:none;padding:13px 22px;border-radius:12px;font-weight:700;font-size:16px}\n.btn:hover{filter:brightness(1.1)}\n.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--text);font-weight:500}\ncode,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;direction:ltr;display:inline-block;word-break:break-all}\n.sha{background:#0a1120;border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:10px;color:#cfe0ff}\nbutton.copy{background:#1b2a44;color:var(--text);border:1px solid var(--line);border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer;margin-inline-start:8px}\n.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}\n.stat{border:1px solid var(--line);border-radius:14px;padding:14px}\n.stat .k{color:var(--muted);font-size:12px}\n.stat .v{font-size:16px;font-weight:700;margin-top:4px}\n.ok{color:var(--green)} .wait{color:var(--amber)} .no{color:var(--red)}\nh2{font-size:17px;margin:0 0 10px}\nul,ol{margin:0;padding-inline-start:22px;color:#d7e2f7}\nli{margin:6px 0}\na{color:var(--blue)}\nfooter{color:var(--muted);font-size:12px;text-align:center;margin-top:34px}\n.small{font-size:12.5px;color:var(--muted)}\n</style>\n</head>\n<body>\n<div class=\"wrap\">\n<header>\n  <div class=\"logo\">🌾</div>\n  <div>\n    <h1>کشاورزحساب <span class=\"badge\">v1.0.0 · اندروید 26+</span></h1>\n    <div class=\"sub\">حسابداری مزرعه، فارسی و بدون کاغذ — موتور قطعی، نه حدس مدل</div>\n  </div>\n</header>\n\n<div class=\"card\" style=\"border-color:#bfe3b8;background:#f4faf2\">\n  <b>✅ این نسخه آفلاین است.</b>\n  <p class=\"small\" style=\"margin:8px 0 0\">همه‌ی داده‌ها روی گوشی ذخیره می‌شود و اپ هیچ آدرس سروری نمی‌خواهد. مدل زبانی هنوز داخل APK نیست؛ در نسخه بعدی به‌صورت دانلود اختیاری اضافه می‌شود.</p>\n</div>\n\n<div class=\"card\">\n  <h2>دانلود APK</h2>\n  <p class=\"small\">نسخه 1.0.0 · offline MVP · 3.8 مگابایت · applicationId: <span class=\"mono\">ir.kishavarhesab.app</span></p>\n  <p><a class=\"btn\" href=\"https://github.com/havedays67-ai/kishavar-hesab/releases/download/apk-offline-mvp/KishavarHesab-1.0.0-offline.apk\" rel=\"noopener\">⬇️ دانلود KishavarHesab-1.0.0.apk</a>\n     <a class=\"btn ghost\" href=\"/api/latest.json\">manifest JSON</a>\n     <a class=\"btn ghost\" href=\"https://chat.tivachat-vflash-ai.ir\">آزمایشگاه دستیار 💬</a></p>\n  <div class=\"sha\"><span class=\"mono\">SHA-256: e0159a79d60d5a69478d019d5e674fc3cbabe0faad537a4ddff8c42a4f717110</span><button class=\"copy\" onclick=\"navigator.clipboard.writeText('e0159a79d60d5a69478d019d5e674fc3cbabe0faad537a4ddff8c42a4f717110');this.textContent='کپی شد'\">کپی</button></div>\n  <p class=\"small\" style=\"margin-top:10px\">صحت فایل را قبل از نصب بررسی کنید:\n    <code>sha256sum KishavarHesab-1.0.0.apk</code>\n  </p>\n</div>\n\n<div class=\"grid\">\n  <div class=\"stat\"><div class=\"k\">APK</div><div class=\"v ok\">✅ منتشرشده</div></div>\n  <div class=\"stat\"><div class=\"k\">دیتاست</div><div class=\"v ok\">✅ 784 نمونه</div></div>\n  <div class=\"stat\"><div class=\"k\">مدل NLU</div><div class=\"v wait\">⏳ در انتظار باک‌آف</div></div>\n  <div class=\"stat\"><div class=\"k\">حالت آفلاین</div><div class=\"v wait\">⏳ فاز بعد</div></div>\n</div>\n\n<div class=\"card\">\n  <h2>نصب</h2>\n  <ol>\n    <li>فایل APK را دانلود کنید.</li>\n    <li>در اندروید، «نصب از منابع ناشناس» را برای مرورگر/فایل‌منیجر فعال کنید.</li>\n    <li>APK را نصب و باز کنید؛ در نسخه‌ی فعلی آدرس سرور را وارد کنید.</li>\n  </ol>\n  <p class=\"small\">حداقل اندروید 26 (اندروید ۸). برای گوشی ۶ گیگ رم بهینه شده است.</p>\n</div>\n\n<div class=\"card\">\n  <h2>مدل روی گوشی</h2>\n  <p class=\"small\">مدل NLU هنوز آموزش ندیده و منتشر نشده است؛ پس از باک‌آف روی Kaggle و عبور از آستانه‌ها منتشر می‌شود.</p>\n  <p class=\"small\">معیار انتشار: خروجی JSON معتبر ۱۰۰٪، تشخیص intent ≥ ۹۸٪ و فیلدها ≥ ۹۸٪ روی تست سخت مستقل. هیچ عددی بدون <span class=\"mono\">eval_report.json</span> منتشر نمی‌شود.</p>\n  <p class=\"small\">دانلود مدل، قابل ادامه (resume) و همراه با بررسی <span class=\"mono\">sha256</span> خواهد بود؛ مدل داخل APK باندل نمی‌شود.</p>\n</div>\n\n<div class=\"card\">\n  <h2>دیتاست</h2>\n  <p class=\"small\">دیتاست NLU فارسی (۱۵ intent) روی Hugging Face منتشر شده است: <a href=\"https://huggingface.co/datasets/Hamio/kishavar-hesab-dataset\" rel=\"noopener\">Hamio/kishavar-hesab-dataset</a></p>\n  <p class=\"small\">train 529 · val 88 · test 117 · hard-test 50 — همه با قرارداد JSON و موتور حسابداری اعتبارسنجی شده‌اند.</p>\n</div>\n\n<footer>\n  ساخته‌شده با موتور حسابداری قطعی · هیچ عددی از مدل به‌عنوان حقیقت پذیرفته نمی‌شود<br>\n  <span class=\"mono\">GET /api/latest.json</span> برای اپ و اسکریپت‌ها · به‌روزرسانی: 2026-10-26\n</footer>\n</div>\n</body>\n</html>";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, service: "kishavar-download", version: MANIFEST.app.version }), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS },
      });
    }

    if (url.pathname === "/api/latest.json" || url.pathname === "/latest.json") {
      return new Response(JSON.stringify(MANIFEST, null, 2), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300", ...CORS },
      });
    }

    if (url.pathname === "/download/apk") {
      return Response.redirect(MANIFEST.app.url, 302);
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(HTML, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300",
          "x-content-type-options": "nosniff",
          "referrer-policy": "strict-origin-when-cross-origin",
        },
      });
    }

    return new Response("404 — مسیر پیدا نشد. صفحه اصلی: /", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", ...CORS },
    });
  },
};
