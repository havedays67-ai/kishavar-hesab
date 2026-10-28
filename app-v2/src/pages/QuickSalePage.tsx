import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BadgeCheck,
  Building2,
  Calculator,
  Check,
  ClipboardCopy,
  History,
  Info,
  Plus,
  Sparkles,
  Trash2,
  Wheat,
} from "lucide-react";
import { cn } from "../utils/cn";
import { toPersianDigits } from "../lib/format";
import { parseNumericInput, validateWeight, type WeightUnit } from "../lib/units";
import { computeQuickSale, quickSaleSummary, QUICK_SALE_PRODUCTS, type QuickSaleResult } from "../lib/quick-sale";
import { useProfile, profileDisplayName } from "../lib/profile";
import { Toast } from "../components/ui";

const HISTORY_KEY = "kishavar.quickSales.v1";
const HISTORY_LIMIT = 12;

interface SavedQuickSale {
  id: string;
  at: string;
  product: string;
  buyer: string;
  payableToman: number;
  summary: string;
}

function loadHistory(): SavedQuickSale[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedQuickSale[];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.summary === "string").slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

export function QuickSalePage() {
  const { profile } = useProfile();
  const [product, setProduct] = useState(QUICK_SALE_PRODUCTS[0]);
  const [buyer, setBuyer] = useState("");
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const [quantity, setQuantity] = useState("1000");
  const [pricePerKg, setPricePerKg] = useState("45000");
  const [advanced, setAdvanced] = useState(false);
  const [deductionPct, setDeductionPct] = useState("0");
  const [transport, setTransport] = useState("0");
  const [taxPct, setTaxPct] = useState("0");
  const [prepaid, setPrepaid] = useState("0");
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<QuickSaleResult | null>(null);
  const [history, setHistory] = useState<SavedQuickSale[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const quantityNumber = useMemo(() => parseNumericInput(quantity), [quantity]);
  const weightHint = useMemo(() => {
    if (quantityNumber === null) return null;
    const error = validateWeight(quantityNumber, unit);
    if (error) return { tone: "error" as const, text: error };
    const kg = unit === "ton" ? quantityNumber * 1000 : quantityNumber;
    return {
      tone: "info" as const,
      text: `هم‌ارز: ${toPersianDigits(kg.toLocaleString("en-US"))} کیلوگرم · ${toPersianDigits((kg / 1000).toLocaleString("en-US", { maximumFractionDigits: 3 }))} تن`,
    };
  }, [quantityNumber, unit]);

  const calculate = () => {
    const next = computeQuickSale({
      product,
      buyer,
      unit,
      quantity: quantityNumber,
      pricePerKg: parseNumericInput(pricePerKg),
      deductionPct: parseNumericInput(deductionPct),
      transportToman: parseNumericInput(transport),
      taxPct: parseNumericInput(taxPct),
      prepaidToman: parseNumericInput(prepaid),
    });
    if (!next.ok) {
      setResult(null);
      setErrors(next.errors);
      return;
    }
    setErrors([]);
    setResult(next);
    const entry: SavedQuickSale = {
      id: `qs-${Date.now()}`,
      at: new Date().toISOString(),
      product: next.product,
      buyer: next.buyer,
      payableToman: next.payableToman,
      summary: quickSaleSummary(next),
    };
    const updated = [entry, ...history].slice(0, HISTORY_LIMIT);
    setHistory(updated);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {
      /* حافظهٔ پر/غیرفعال: محاسبه باید کار کند، فقط تاریخچه ذخیره نمی‌شود */
    }
    setToast("محاسبه انجام و در تاریخچهٔ همین دستگاه ذخیره شد.");
  };

  const copy = () => {
    if (!result) return;
    void navigator.clipboard?.writeText(quickSaleSummary(result));
    setCopied(true);
    setToast("خلاصهٔ فروش کپی شد.");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const removeEntry = (id: string) => {
    const updated = history.filter((item) => item.id !== id);
    setHistory(updated);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {
      /* بی‌اهمیت */
    }
  };

  const reset = () => {
    setProduct(QUICK_SALE_PRODUCTS[0]);
    setBuyer("");
    setUnit("kg");
    setQuantity("1000");
    setPricePerKg("45000");
    setDeductionPct("0");
    setTransport("0");
    setTaxPct("0");
    setPrepaid("0");
    setAdvanced(false);
    setErrors([]);
    setResult(null);
  };

  return (
    <div className="animate-rise mx-auto max-w-5xl">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]"><Sparkles className="h-3.5 w-3.5 text-mint-300" />محاسبه‌گر سریع فروش</div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">فروش ساده محصول</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] font-light leading-6 text-[#89a598]">
            مقدار را با کیلو یا تن وارد کنید و قیمت هر کیلو را بدهید؛ مبلغ نهایی، وزن و مبلغ با هر دو واحد و هم با حروف نمایش داده می‌شود.
            این بخش ساده و سریع است و جای «معامله محصول» کامل را نمی‌گیرد؛ هر دو در دسترس‌اند.
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-xl border border-mint-300/15 bg-mint-300/[0.05] px-3 py-2 text-[9px] text-mint-300"><BadgeCheck className="h-3.5 w-3.5" /> محاسبهٔ قطعی و آفلاین</span>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section className="glass rounded-[22px] p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-white"><Calculator className="h-3.5 w-3.5 text-mint-300" /> ورودی فروش</h2>
          <div className="space-y-3">
            <div>
              <div className="label">محصول</div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SALE_PRODUCTS.map((item) => (
                  <button key={item} type="button" onClick={() => setProduct(item)} className={cn("rounded-lg border px-2.5 py-1.5 text-[9px]", product === item ? "border-mint-300/35 bg-mint-300/[0.08] text-mint-300" : "border-white/[0.08] text-[#9db5a8]")}>{item}</button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="label">خریدار / شرکت</span>
              <span className="relative mt-1 flex items-center">
                <Building2 className="absolute right-2.5 h-3.5 w-3.5 text-[#7fa294]" />
                <input value={buyer} onChange={(event) => setBuyer(event.target.value)} placeholder="مثلاً شرکت دانه طلایی" className="field py-2 pr-8 text-[10px]" />
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="label">مقدار</div>
                <div className="flex gap-2">
                  <input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" placeholder="۱۰۰۰" className="field py-2 text-[11px]" aria-label="مقدار فروش" />
                  <div className="inline-flex shrink-0 rounded-xl border border-white/10 bg-black/25 p-1">
                    {([["kg", "کیلو"], ["ton", "تن"]] as const).map(([id, label]) => (
                      <button key={id} type="button" onClick={() => setUnit(id)} className={cn("rounded-lg px-2.5 py-1 text-[9px]", unit === id ? "bg-mint-300/15 text-mint-200" : "text-[#8ba79a]")}>{label}</button>
                    ))}
                  </div>
                </div>
                {weightHint && <p className={cn("mt-1 text-[8px]", weightHint.tone === "error" ? "text-[#f0a59a]" : "text-[#8ba79a]")}>{weightHint.text}</p>}
              </div>
              <label className="block">
                <span className="label">قیمت هر کیلو (تومان)</span>
                <input value={pricePerKg} onChange={(event) => setPricePerKg(event.target.value)} inputMode="numeric" placeholder="۴۵٬۰۰۰" className="field mt-1 py-2 text-[11px]" />
                <p className="mt-1 text-[8px] text-[#8ba79a]">هم‌ارز هر تن با محاسبه نشان داده می‌شود.</p>
              </label>
            </div>

            <button type="button" onClick={() => setAdvanced((value) => !value)} className="flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[9px] text-[#a9c1b5]">
              <span className="flex items-center gap-1.5"><Info className="h-3 w-3 text-mint-300" /> کسورات، حمل، مالیات و پیش‌پرداخت (اختیاری)</span>
              <span>{advanced ? "بستن" : "باز کردن"}</span>
            </button>

            {advanced && (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "افت/کسورات (٪)", value: deductionPct, set: setDeductionPct, hint: "مثلاً رطوبت یا ناخالصی" },
                  { label: "کرایهٔ حمل (تومان)", value: transport, set: setTransport, hint: "در مبلغ نهایی اضافه می‌شود" },
                  { label: "مالیات/عوارض (٪)", value: taxPct, set: setTaxPct, hint: "محصول خام معمولاً معاف است" },
                  { label: "پیش‌پرداخت (تومان)", value: prepaid, set: setPrepaid, hint: "از مبلغ نهایی کم می‌شود" },
                ].map((field) => (
                  <label key={field.label} className="block">
                    <span className="label">{field.label}</span>
                    <input value={field.value} onChange={(event) => field.set(event.target.value)} inputMode="decimal" className="field mt-1 py-2 text-[10px]" />
                    <span className="mt-0.5 block text-[8px] text-[#78968a]">{field.hint}</span>
                  </label>
                ))}
              </div>
            )}

            {errors.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-[#8f4c44]/30 bg-[#8f4c44]/10 px-3 py-2 text-[9px] text-[#f0a59a]">
                {errors.map((error) => <li key={error}>• {error}</li>)}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={calculate} className="flex items-center gap-1.5 rounded-xl bg-mint-400 px-4 py-2.5 text-[10px] font-bold text-[#07110d]"><Calculator className="h-3.5 w-3.5" /> محاسبهٔ مبلغ نهایی</button>
              <button type="button" onClick={reset} className="rounded-xl border border-white/[0.09] px-3 py-2.5 text-[10px] text-[#a9c1b5]">پاک کردن فرم</button>
              <button type="button" onClick={() => setUnit(unit === "kg" ? "ton" : "kg")} className="flex items-center gap-1.5 rounded-xl border border-white/[0.09] px-3 py-2.5 text-[10px] text-[#a9c1b5]"><ArrowLeftRight className="h-3.5 w-3.5" /> تغییر واحد</button>
            </div>
            <p className="text-[8px] leading-5 text-[#78968a]">برای فروش کامل با افت رطوبت، درجه‌بندی و اسناد A4 از بخش «معامله محصول» استفاده کنید. این محاسبه‌گر چیزی را در دفتر مالی ثبت نمی‌کند.</p>
          </div>
        </section>

        <div className="space-y-3">
          <section className="glass rounded-[22px] p-4">
            <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-white"><Wheat className="h-3.5 w-3.5 text-mint-300" /> نتیجه</h2>
            {!result ? (
              <p className="rounded-xl border border-dashed border-white/10 p-4 text-[9px] leading-6 text-[#8ba79a]">مقدار و قیمت هر کیلو را وارد و «محاسبهٔ مبلغ نهایی» را بزنید. خروجی هم کیلو و هم تن، هم با رقم و هم با حروف نمایش داده می‌شود.</p>
            ) : (
              <div className="space-y-2.5">
                <div className="rounded-xl border border-mint-300/25 bg-mint-300/[0.06] p-3">
                  <p className="text-[9px] text-[#a9c5b8]">مبلغ قابل پرداخت{result.buyer ? ` از ${result.buyer}` : ""}</p>
                  <p className="mt-1 text-[18px] font-extrabold text-mint-200">{toPersianDigits(result.payableToman.toLocaleString("en-US"))} تومان</p>
                  <p className="mt-1 text-[8px] leading-5 text-[#c3d8cc]">{result.payableWords}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[9px]">
                  {[
                    ["مقدار", `${result.quantity.kgLabel}`],
                    ["مقدار (تن)", result.quantity.tonLabel],
                    ["مقدار با حروف", result.quantity.kgWords],
                    ["مقدار با حروف (تن)", result.quantity.tonWords],
                    ["وزن خالص", result.netWeight.both],
                    ["وزن خالص با حروف", result.netWeight.tonWords],
                    ["قیمت هر کیلو", `${toPersianDigits(result.pricePerKg.toLocaleString("en-US"))} تومان`],
                    ["قیمت هر تن", `${toPersianDigits(result.pricePerTon.toLocaleString("en-US"))} تومان`],
                    ["مبلغ ناخالص", `${toPersianDigits(result.grossToman.toLocaleString("en-US"))} تومان`],
                    ["کسورات + مالیات", `${toPersianDigits((result.deductionToman + result.taxToman).toLocaleString("en-US"))} تومان`],
                    ["کرایهٔ حمل", `${toPersianDigits(result.transportToman.toLocaleString("en-US"))} تومان`],
                    ["قیمت مؤثر هر کیلو", `${toPersianDigits(result.effectivePricePerKg.toLocaleString("en-US"))} تومان`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
                      <div className="text-[7px] text-[#78968a]">{label}</div>
                      <div className="mt-0.5 text-[9px] text-[#dcebe2]">{value}</div>
                    </div>
                  ))}
                </div>
                <details className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                  <summary className="cursor-pointer text-[9px] text-[#a9c1b5]">مراحل محاسبه ({toPersianDigits(result.steps.length)} گام)</summary>
                  <ol className="mt-1.5 space-y-1 text-[8px] leading-5 text-[#93ad9f]">
                    {result.steps.map((step, index) => <li key={`${step.title}-${index}`}>{toPersianDigits(index + 1)}. <span className="text-[#c3d8cc]">{step.title}:</span> {step.detail}</li>)}
                  </ol>
                </details>
                {result.warnings.length > 0 && (
                  <ul className="rounded-xl border border-sand-300/20 bg-sand-300/[0.05] px-2.5 py-2 text-[8px] leading-5 text-[#d5caa9]">
                    {result.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                  </ul>
                )}
                <button type="button" onClick={copy} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-mint-300/25 bg-mint-300/[0.08] py-2 text-[9px] text-mint-300">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />} کپی خلاصهٔ فروش
                </button>
              </div>
            )}
          </section>

          <section className="glass rounded-[22px] p-4">
            <h2 className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-white">
              <span className="flex items-center gap-1.5"><History className="h-3.5 w-3.5 text-mint-300" /> تاریخچهٔ محاسبه‌ها</span>
              <span className="text-[8px] font-normal text-[#78968a]">{toPersianDigits(history.length)} مورد · روی همین دستگاه</span>
            </h2>
            {history.length === 0 ? (
              <p className="text-[9px] leading-6 text-[#8ba79a]">هنوز محاسبه‌ای ذخیره نشده است.</p>
            ) : (
              <ul className="space-y-1.5">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-[9px] text-[#dcebe2]">{entry.product}{entry.buyer ? ` — ${entry.buyer}` : ""}</p>
                      <p className="text-[8px] text-[#78968a]">{toPersianDigits(entry.payableToman.toLocaleString("en-US"))} تومان</p>
                    </div>
                    <button type="button" onClick={() => removeEntry(entry.id)} className="shrink-0 text-[#8a6a63] transition hover:text-[#e0a097]" aria-label="حذف از تاریخچه"><Trash2 className="h-3 w-3" /></button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 flex items-center gap-1 text-[8px] leading-5 text-[#78968a]"><Plus className="h-2.5 w-2.5" /> {profileDisplayName(profile)} · داده‌ها به بیرون ارسال نمی‌شوند.</p>
          </section>
        </div>
      </div>

      <Toast open={Boolean(toast)} message={toast ?? ""} onClose={() => setToast(null)} />
    </div>
  );
}
