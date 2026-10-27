# قرارداد تحویل به ایجنت محلی (GPU / دستگاه / ابر)

هدف: هر ایجنت (یا انسان) بتواند **بدون حدس** دیتاست را بسازد، آموزش بدهد، ارزیابی کند و APK را منتشر کند.
همه مراحل، خروجی JSON یا فایل مشخص دارند و در صورت خطا کد خروج غیرصفر می‌دهند.

## ۰) پیش‌نیازها
```bash
git clone https://github.com/havedays67-ai/kishavar-hesab.git && cd kishavar-hesab
npm ci
npx tsx --version && node --version   # Node 20+
```
کلیدها فقط در محیط اجرا (هیچ کلیدی در ریپو/دیتاست/لاگ/APK نوشته نمی‌شود):
```bash
export ZAI_API_KEY=...        # GLM 5.3 Flash (معلم اول؛ اتصال هنوز پیاده نشده)
export TEACHER2_API_KEY=...   # معلم دوم از خانواده‌ی متفاوت
```
در این سشن کلید GLM موجود نیست و HF Inference هم اعتبار ندارد (402)؛ پس تولید معلم هنوز انجام نشده است.

## ۱) دیتاست پایه (بدون نیاز به کلید)
```bash
npx tsx scripts/gen-dataset.ts
# خروجی: training/data/{train,val,test,hard-test}.jsonl + stats.json
npx tsx scripts/check-dataset.ts
npx tsx scripts/validate-dataset.ts training/data/*.jsonl
# باید: invalidJson=0, invalidContract=0, invalidShape=0, missingIntents=[]
```
`check-dataset` توازن، پوشش هر ۱۵ intent در test، نشت متن، حداقل `ask` و نمونه‌های ایمنی را می‌سنجد.
معیار پذیرش: کد خروج `0` برای هر دو دستور.

## ۲) گسترش با دو معلم (فعلاً متوقف: کلید موجود نیست)
```bash
python3 training/generate_teachers.py --per-intent 150 --out training/data/teachers
```
- هر نمونه از `scripts/validate-dataset.ts` عبور می‌کند.
- فقط نمونه‌هایی که هر دو معلم تولید کرده‌اند در `agreed` می‌مانند.
- خروجی گزارش: `training/data/teachers/report.json`.

معیار پذیرش: `invalidContract = 0` و پوشش همه ۱۵ intent.

## ۳) آموزش (GPU ابری)
```bash
pip install "transformers==4.57.1" "peft>=0.13" "bitsandbytes>=0.44" datasets accelerate sentencepiece
python3 training/train_qlora.py --model Qwen/Qwen3.5-2B --data training/data --out out/qwen35-2b
# چالشگر: --model XHToken/Spark-X2.6-4B  (۴B، Q4≈۲.۶۲GB، RAM روی ۶GB ریسک دارد)
# تور نجات: --model Qwen/Qwen3-1.7B      (Q4≈۱.۱۱GB، اثبات‌شده)
```
ارزیابی همیشه روی `training/data/hard-test.jsonl` است، نه test قالب‌محور.
نوت‌بوك آماده: `training/kaggle_finetune.ipynb`.
خروجی: `out/kishavar-lora/eval_report.json`
```json
{"json_validity":1.0,"intent_accuracy":0.99,"field_accuracy":0.985,"passed":true}
```
معیار پذیرش: `passed=true` (intent ≥۰.۹۸، field ≥۰.۹۸، json = ۱.۰). در صورت رد شدن، ۲۰ خطای اول `errors` را برای افزودن دیتای هدفمند برگردانید.

## ۴) استخراج و کوانتیزه
```bash
BASE_MODEL=Qwen/Qwen3.5-2B ADAPTER=out/qwen35-2b OUT=out/qwen35-merged bash training/export_gguf.sh
# خروجی: out/kishavar-merged/kishavar-q4_k_m.gguf + .sha256
```
آپلود در میزبان امن و ثبت این‌ها برای اپ: `url`, `sha256`, `bytes_total`, `version`.

## ۵) بنچمارک دستگاه (اختیاری، پیشنهادشده)
روی گوشی اندروید ۸ با ۶ گیگ رم:
```text
۲۰ دستور از training/data/hard-test.jsonl را دستی/با ایجنت اجرا کنید
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
✅ APK آفلاین MVP منتشر شد (ثبت/دستیار/گزارش محلی، بدون سرور). مدل زبانی هنوز همراه APK نیست و در فاز بعد به‌صورت دانلود اختیاری اضافه می‌شود.

## ۷) قواعد ایمنی برای ایجنت
1. هرگز `DATABASE_URL` یا کلید API را در کد/دیتاست/لاگ ننویس.
2. هرگز بدون تأیید انسان روی دیتابیس **واقعی** بنویس؛ فقط روی محیط تست.
3. هر تغییر در `src/lib/engine/*` باید تست جدید داشته باشد؛ CI با `npx vitest run` و `npx next build` گارد می‌کند.
4. خروجی مدل هرگز مستقیم اجرا نمی‌شود؛ فقط از طریق `validateAssistantOutput` و موتور قطعی.
5. اگر یک گیت شکست خورد، توقف و گزارش؛ نه رد کردن با force.

## ۸) وضعیت فعلی (برای بازتولید)
- تست‌ها: `npx vitest run` → **۳۲۶ تست سبز**
- دیتاست: **۷۳۴ نمونه** (۵۲۹ train / ۸۸ val / ۱۱۷ test) + **۵۰ تست سخت مستقل**؛ ۰ خطای قرارداد، توازن ۱.۴۴
- دیتاست در HF: `Hamio/kishavar-hesab-dataset` (نسخه‌دار، sha256 در `SHA256SUMS`)
- قرارداد: `src/lib/engine/contracts.ts` (نسخه ۱)
- اسکیمای آفلاین: `src/lib/engine/localdb.ts` (نسخه ۳)
