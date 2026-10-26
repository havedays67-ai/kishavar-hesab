# قرارداد تحویل به ایجنت محلی (GPU / دستگاه / ابر)

هدف: هر ایجنت (یا انسان) بتواند **بدون حدس** دیتاست را بسازد، آموزش بدهد، ارزیابی کند و APK را منتشر کند.
همه مراحل، خروجی JSON یا فایل مشخص دارند و در صورت خطا کد خروج غیرصفر می‌دهند.

## ۰) پیش‌نیازها
```bash
git clone https://github.com/havedays67-ai/kishavar-hesab.git && cd kishavar-hesab
npm ci
npx tsx --version && node --version   # Node 20+
```
کلیدها فقط در محیط اجرا:
```bash
export ANTHROPIC_API_KEY=...   # معلم اول
export DEEPSEEK_API_KEY=...    # معلم دوم
```
هیچ کلیدی در ریپو، APK یا دیتابیس نوشته نمی‌شود.

## ۱) دیتاست پایه (بدون نیاز به کلید)
```bash
npx tsx scripts/gen-dataset.ts
# خروجی: training/data/{train,val,test}.jsonl + stats.json
npx tsx scripts/validate-dataset.ts training/data/*.jsonl
# باید: invalidJson=0, invalidContract=0, invalidShape=0, missingIntents=[]
```
معیار پذیرش: کد خروج `0`.

## ۲) گسترش با دو معلم
```bash
python3 training/generate_teachers.py --per-intent 150 --out training/data/teachers
```
- هر نمونه از `scripts/validate-dataset.ts` عبور می‌کند.
- فقط نمونه‌هایی که هر دو معلم تولید کرده‌اند در `agreed` می‌مانند.
- خروجی گزارش: `training/data/teachers/report.json`.

معیار پذیرش: `invalidContract = 0` و پوشش همه ۱۵ intent.

## ۳) آموزش (GPU ابری)
```bash
pip install "transformers>=4.45" "peft>=0.13" "bitsandbytes>=0.44" datasets accelerate torch
python3 training/train_qlora.py --model Qwen/Qwen3-1.7B --data training/data/teachers --out out/kishavar-lora
```
خروجی: `out/kishavar-lora/eval_report.json`
```json
{"json_validity":1.0,"intent_accuracy":0.99,"field_accuracy":0.985,"passed":true}
```
معیار پذیرش: `passed=true` (intent ≥۰.۹۸، field ≥۰.۹۸، json = ۱.۰). در صورت رد شدن، ۲۰ خطای اول `errors` را برای افزودن دیتای هدفمند برگردانید.

## ۴) استخراج و کوانتیزه
```bash
BASE_MODEL=Qwen/Qwen3-1.7B ADAPTER=out/kishavar-lora OUT=out/kishavar-merged bash training/export_gguf.sh
# خروجی: out/kishavar-merged/kishavar-q4_k_m.gguf + .sha256
```
آپلود در میزبان امن و ثبت این‌ها برای اپ: `url`, `sha256`, `bytes_total`, `version`.

## ۵) بنچمارک دستگاه (اختیاری، پیشنهادشده)
روی گوشی اندروید ۸ با ۶ گیگ رم:
```text
۲۰ دستور از training/data/test.jsonl را دستی/با ایجنت اجرا کنید
ثبت: زمان پاسخ هر دستور، موفقیت JSON، مصرف RAM، دمای دستگاه
```
گزارش را در `docs/device-benchmark.md` بگذارید. اگر NLP قطعی سریع‌تر و دقیق‌تر از مدل بود، پیش‌فرض را NLU نگه می‌داریم (این تصمیم با داده شما گرفته می‌شود).

## ۶) ساخت APK
```bash
gh workflow run android.yml -f variant=release -f server_url=https://YOUR_HOST
gh run watch
gh release view --json assets
```
خروجی: `KishavarHesab-1.0.0.apk` متصل به آخرین Release.

## ۷) قواعد ایمنی برای ایجنت
1. هرگز `DATABASE_URL` یا کلید API را در کد/دیتاست/لاگ ننویس.
2. هرگز بدون تأیید انسان روی دیتابیس **واقعی** بنویس؛ فقط روی محیط تست.
3. هر تغییر در `src/lib/engine/*` باید تست جدید داشته باشد؛ CI با `npx vitest run` و `npx next build` گارد می‌کند.
4. خروجی مدل هرگز مستقیم اجرا نمی‌شود؛ فقط از طریق `validateAssistantOutput` و موتور قطعی.
5. اگر یک گیت شکست خورد، توقف و گزارش؛ نه رد کردن با force.

## ۸) وضعیت فعلی (برای بازتولید)
- تست‌ها: `npx vitest run` → **۳۲۶ تست سبز**
- دیتاست پایه: **۲۴۱ نمونه متوازن** (۰ خطای قرارداد، ۰ تکراری، همه intentها)
- قرارداد: `src/lib/engine/contracts.ts` (نسخه ۱)
- اسکیمای آفلاین: `src/lib/engine/localdb.ts` (نسخه ۳)
