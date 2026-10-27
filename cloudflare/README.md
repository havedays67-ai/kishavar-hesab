# صفحه دانلود و manifest (Cloudflare Workers)

- **صفحه:** https://kishavar.tivachat-vflash-ai.ir
- **manifest:** https://kishavar.tivachat-vflash-ai.ir/api/latest.json
- **health:** https://kishavar.tivachat-vflash-ai.ir/health
- **workers.dev:** https://kishavar-download.indistinctiveeee.workers.dev

## چرا Worker و نه R2؟

مدل داخل APK باندل نمی‌شود؛ اپ در اولین اجرا مدل را با resume و بررسی sha256 دانلود می‌کند.
این Worker فقط «صفحه دانلود + manifest نسخه» است و هیچ استنتاج مدلی انجام نمی‌دهد.
R2 در این حساب فعال نیست؛ فایل APK فعلاً از GitHub Releases سرو می‌شود و مدل بعداً از HF.

## استقرار

```bash
export CF_API_TOKEN=...        # فقط در محیط اجرا؛ در ریپو نوشته نشود
export CF_ACCOUNT_ID=...
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/scripts/kishavar-download" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -F 'metadata={"main_module":"worker.js","compatibility_date":"2026-10-26"};type=application/json' \
  -F 'worker.js=@worker.js;type=application/javascript+module'
```

دامنه‌ی سفارشی از طریق Workers Domains API وصل شده است:

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/domains" \
  -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"zone_id":"...","hostname":"kishavar.tivachat-vflash-ai.ir","service":"kishavar-download","environment":"production"}'
```

## به‌روزرسانی نسخه

1. `latest.json` را ویرایش کنید (نسخه، versionCode، sha256، حجم، URL).
2. همان مقادیر را در `worker.js` (بخش `MANIFEST` و متن صفحه) به‌روز کنید.
3. دوباره استقرار بدهید و با `curl /api/latest.json` بررسی کنید.

> عدد نسخه/هش را از خروجی واقعی build بگیرید؛ هیچ عدد دستی و ادعایی در manifest نمی‌نویسیم.


## نسخه آفلاین MVP

- APK: `apk-offline-mvp` → `KishavarHesab-1.0.0-offline.apk`
- بدون سرور؛ داده‌ها روی گوشی؛ مدل هنوز همراه نیست.
