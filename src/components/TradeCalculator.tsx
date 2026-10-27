"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createTrade } from "@/app/trade/actions";
import { Icon } from "@/components/ui";
import { formatDate, formatJalaliNumeric, parseJalaliInput, toEnDigits, todayJalali } from "@/lib/format";
import {
  CROP_SPECS,
  GRADE_LABEL,
  TRADE_MODE_META,
  UNIT_FACTORS,
  UNIT_LABEL,
  computeTrade,
  defaultPolicy,
  defaultQuality,
  getCrop,
  type MarketMode,
  type TradeInput,
  type TradeUnit,
} from "@/lib/trade/engine";

type FormState = Record<string, string>;

const toman = (value: number) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value || 0))} تومان`;

function initialState(): FormState {
  const crop = getCrop("wheat");
  const mode: MarketMode = "factory";
  const policy = defaultPolicy(mode, crop);
  const quality = defaultQuality(crop);
  return {
    mode,
    direction: "sell",
    cropKey: crop.key,
    variety: "پیشتاز",
    unit: "ton",
    quantity: "25",
    grossKg: "",
    tareKg: "",
    pricePerKgToman: String(crop.defaultPricePerKgToman),
    benchmarkPricePerKgToman: String(policy.benchmarkPricePerKgToman),
    moisturePct: String(quality.moisturePct),
    foreignMatterPct: String(quality.foreignMatterPct),
    brokenPct: String(quality.brokenPct),
    pestPct: String(quality.pestPct),
    hectoliter: String(quality.hectoliter),
    proteinPct: String(quality.proteinPct),
    baseMoisturePct: String(policy.baseMoisturePct),
    maxMoisturePct: String(policy.maxMoisturePct),
    allowedForeignPct: String(policy.allowedForeignPct),
    maxForeignPct: String(policy.maxForeignPct),
    moistureMethod: policy.moistureMethod,
    moistureStepPct: String(policy.moistureStepPct),
    standardDeductionPct: String(policy.standardDeductionPct),
    nonUsefulDeductionPct: String(policy.nonUsefulDeductionPct),
    brokenDeduction: policy.brokenDeduction ? "1" : "",
    gradePricing: policy.gradePricing ? "1" : "",
    insurancePerKgToman: String(policy.insurancePerKgToman),
    commissionPct: String(policy.commissionPct),
    transportToman: "0",
    transportPayer: "seller",
    unloadingToman: "0",
    unloadingPayer: "seller",
    samplingToman: "0",
    weighbridgeToman: "0",
    otherCostsToman: "0",
    vatRatePct: String(policy.vatRatePct),
    vatOnFeesOnly: "1",
    delayDays: "0",
    delayPenaltyPerDayPct: "0",
    adjustmentToman: "0",
    prepaidToman: "0",
    roundToToman: "1000",
    sellerName: "",
    sellerNationalId: "",
    sellerPhone: "",
    buyerName: "",
    buyerType: "factory",
    buyerNationalId: "",
    buyerPhone: "",
    province: "خوزستان",
    deliveryPlace: "",
    vehiclePlate: "",
    driverName: "",
    contractDate: todayJalali(),
    deliveryDate: todayJalali(),
    dueDate: "",
    notes: "",
    terms:
      "تحویل بار در محل خریدار و پس از تأیید کیفیت انجام می‌شود. مبلغ باقیمانده حداکثر تا سررسید توافق‌شده پرداخت می‌گردد.",
  };
}

function applyPreset(current: FormState, mode: MarketMode, cropKey: string): FormState {
  const crop = getCrop(cropKey);
  const policy = defaultPolicy(mode, crop);
  const quality = defaultQuality(crop);
  return {
    ...current,
    mode,
    cropKey,
    pricePerKgToman: String(crop.defaultPricePerKgToman),
    benchmarkPricePerKgToman: String(policy.benchmarkPricePerKgToman),
    moisturePct: String(quality.moisturePct),
    foreignMatterPct: String(quality.foreignMatterPct),
    brokenPct: String(quality.brokenPct),
    pestPct: String(quality.pestPct),
    hectoliter: String(quality.hectoliter),
    proteinPct: String(quality.proteinPct),
    baseMoisturePct: String(policy.baseMoisturePct),
    maxMoisturePct: String(policy.maxMoisturePct),
    allowedForeignPct: String(policy.allowedForeignPct),
    maxForeignPct: String(policy.maxForeignPct),
    moistureMethod: policy.moistureMethod,
    standardDeductionPct: String(policy.standardDeductionPct),
    nonUsefulDeductionPct: String(policy.nonUsefulDeductionPct),
    brokenDeduction: policy.brokenDeduction ? "1" : "",
    gradePricing: policy.gradePricing ? "1" : "",
    insurancePerKgToman: String(policy.insurancePerKgToman),
    commissionPct: String(policy.commissionPct),
    vatRatePct: String(policy.vatRatePct),
  };
}

export function TradeCalculator({
  lands,
  initialError,
}: {
  lands: { id: number; name: string }[];
  initialError?: string;
}) {
  const [form, setForm] = useState<FormState>(initialState);
  const [showAudit, setShowAudit] = useState(false);
  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const num = (key: string, fallback = 0) => {
    const raw = toEnDigits(form[key] ?? "").replace(/[,٬\s]/g, "");
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  };

  const crop = getCrop(form.cropKey);
  const preset = defaultPolicy(form.mode as MarketMode, crop);

  const dateErrors = useMemo(() => {
    const errors: string[] = [];
    if (form.contractDate && !parseJalaliInput(form.contractDate)) errors.push("تاریخ قرارداد به شمسی معتبر نیست (نمونه: ۱۴۰۴/۰۳/۱۵).");
    if (form.deliveryDate && !parseJalaliInput(form.deliveryDate)) errors.push("تاریخ تحویل به شمسی معتبر نیست.");
    if (form.dueDate && !parseJalaliInput(form.dueDate)) errors.push("تاریخ سررسید به شمسی معتبر نیست.");
    return errors;
  }, [form.contractDate, form.deliveryDate, form.dueDate]);

  const input: TradeInput = useMemo(
    () => ({
      direction: form.direction as "sell" | "buy",
      mode: form.mode as MarketMode,
      cropKey: form.cropKey,
      unit: form.unit as TradeUnit,
      quantity: num("quantity"),
      grossKg: num("grossKg"),
      tareKg: num("tareKg"),
      pricePerKgToman: num("pricePerKgToman"),
      quality: {
        moisturePct: num("moisturePct"),
        foreignMatterPct: num("foreignMatterPct"),
        brokenPct: num("brokenPct"),
        pestPct: num("pestPct"),
        hectoliter: num("hectoliter"),
        proteinPct: num("proteinPct"),
      },
      policy: {
        ...preset,
        baseMoisturePct: num("baseMoisturePct", preset.baseMoisturePct),
        maxMoisturePct: num("maxMoisturePct", preset.maxMoisturePct),
        allowedForeignPct: num("allowedForeignPct", preset.allowedForeignPct),
        maxForeignPct: num("maxForeignPct", preset.maxForeignPct),
        moistureMethod: (form.moistureMethod || preset.moistureMethod) as typeof preset.moistureMethod,
        moistureStepPct: num("moistureStepPct", preset.moistureStepPct),
        standardDeductionPct: num("standardDeductionPct"),
        nonUsefulDeductionPct: num("nonUsefulDeductionPct"),
        brokenDeduction: Boolean(form.brokenDeduction),
        gradePricing: Boolean(form.gradePricing),
        insurancePerKgToman: num("insurancePerKgToman"),
        commissionPct: num("commissionPct"),
        transportToman: num("transportToman"),
        transportPayer: (form.transportPayer || "seller") as "seller" | "buyer",
        unloadingToman: num("unloadingToman"),
        unloadingPayer: (form.unloadingPayer || "seller") as "seller" | "buyer",
        samplingToman: num("samplingToman"),
        weighbridgeToman: num("weighbridgeToman"),
        otherCostsToman: num("otherCostsToman"),
        vatRatePct: num("vatRatePct"),
        vatOnFeesOnly: Boolean(form.vatOnFeesOnly),
        delayDays: num("delayDays"),
        delayPenaltyPerDayPct: num("delayPenaltyPerDayPct"),
        adjustmentToman: num("adjustmentToman"),
        prepaidToman: num("prepaidToman"),
        roundToToman: num("roundToToman", 1000),
        benchmarkPricePerKgToman: num("benchmarkPricePerKgToman"),
      },
      meta: {
        sellerName: form.sellerName,
        buyerName: form.buyerName,
        contractDate: form.contractDate,
        deliveryDate: form.deliveryDate,
        dueDate: form.dueDate,
        deliveryPlace: form.deliveryPlace,
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, preset],
  );

  const calc = useMemo(() => computeTrade(input), [input]);
  const hasBlocking = calc.errors.length > 0 || dateErrors.length > 0;
  const gradeTone =
    calc.quality.grade === 1 ? "text-farm-700" : calc.quality.grade === 0 ? "text-red-700" : "text-clay-600";

  return (
    <form action={createTrade} className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
      <input type="hidden" name="mode" value={form.mode} />
      <input type="hidden" name="cropKey" value={form.cropKey} />

      <div className="space-y-4">
        {(initialError || dateErrors.length > 0) && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-800">
            <strong className="ml-1">ثبت انجام نشد:</strong>
            {initialError ?? dateErrors.join(" · ")}
          </div>
        )}

        {/* گام ۱ */}
        <section className="card card-pad">
          <SectionTitle n="۱" title="طرفین معامله و محصول" hint="نام‌ها همان‌گونه که در سند چاپ می‌شود وارد شوند" />
          <div className="mt-3 flex flex-wrap gap-2">
            {(["sell", "buy"] as const).map((direction) => (
              <button
                key={direction}
                type="button"
                onClick={() => set("direction", direction)}
                className={`btn flex-1 justify-center ${form.direction === direction ? "btn-primary" : ""}`}
              >
                {direction === "sell" ? "محصول خودم را می‌فروشم" : "محصول می‌خرم (کارخانه/سیلو)"}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">نوع معامله / مبنا *</span>
              <select
                className="input"
                value={form.mode}
                onChange={(event) => setForm((prev) => applyPreset(prev, event.target.value as MarketMode, prev.cropKey))}
              >
                {(Object.keys(TRADE_MODE_META) as MarketMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {TRADE_MODE_META[mode].label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[10px] leading-5 text-[#7d8b80]">{TRADE_MODE_META[form.mode as MarketMode].description}</span>
            </label>
            <label>
              <span className="label">محصول *</span>
              <select
                className="input"
                value={form.cropKey}
                onChange={(event) => setForm((prev) => applyPreset(prev, prev.mode as MarketMode, event.target.value))}
              >
                {CROP_SPECS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.name} — {item.category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">نام فروشنده *</span>
              <input name="sellerName" value={form.sellerName} onChange={(e) => set("sellerName", e.target.value)} className="input" placeholder="مثلاً حاج رضا محمدی" required />
            </label>
            <label>
              <span className="label">کد ملی / شناسه ملی فروشنده</span>
              <input name="sellerNationalId" value={form.sellerNationalId} onChange={(e) => set("sellerNationalId", e.target.value)} className="input num" inputMode="numeric" placeholder="۱۰ یا ۱۱ رقم" />
            </label>
            <label>
              <span className="label">نام خریدار (کارخانه / سیلو / تعاونی) *</span>
              <input name="buyerName" value={form.buyerName} onChange={(e) => set("buyerName", e.target.value)} className="input" placeholder="مثلاً کارخانه آرد زرین" required />
            </label>
            <label>
              <span className="label">نوع خریدار</span>
              <select name="buyerType" value={form.buyerType} onChange={(e) => set("buyerType", e.target.value)} className="input">
                <option value="factory">کارخانه / کارگاه فرآوری</option>
                <option value="silo">سیلو / مرکز خرید دولتی</option>
                <option value="coop">تعاونی / اتحادیه</option>
                <option value="trader">دلال / بازرگان</option>
                <option value="other">سایر</option>
              </select>
            </label>
            <label>
              <span className="label">شناسه / کد ملی خریدار</span>
              <input name="buyerNationalId" value={form.buyerNationalId} onChange={(e) => set("buyerNationalId", e.target.value)} className="input num" inputMode="numeric" />
            </label>
            <label>
              <span className="label">تلفن خریدار</span>
              <input name="buyerPhone" value={form.buyerPhone} onChange={(e) => set("buyerPhone", e.target.value)} className="input num" inputMode="tel" placeholder="۰۹۱۲..." />
            </label>
            <label>
              <span className="label">تلفن فروشنده</span>
              <input name="sellerPhone" value={form.sellerPhone} onChange={(e) => set("sellerPhone", e.target.value)} className="input num" inputMode="tel" />
            </label>
            <label>
              <span className="label">زمین / قطعه (اختیاری)</span>
              <select name="landId" className="input" defaultValue="">
                <option value="">بدون اتصال به زمین</option>
                {lands.map((land) => (
                  <option key={land.id} value={land.id}>
                    {land.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">رقم / واریته</span>
              <input name="variety" value={form.variety} onChange={(e) => set("variety", e.target.value)} className="input" placeholder="مثلاً پیشتاز، چمران" />
            </label>
            <label>
              <span className="label">استان</span>
              <input name="province" value={form.province} onChange={(e) => set("province", e.target.value)} className="input" />
            </label>
          </div>
        </section>

        {/* گام ۲ */}
        <section className="card card-pad">
          <SectionTitle n="۲" title="وزن و کیفیت محصول" hint="وزن خالص از باسکول و کیفیت از آزمایشگاه/نمونه‌برداری" />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label>
              <span className="label">واحد وزن</span>
              <select name="unit" className="input" value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                {(Object.keys(UNIT_LABEL) as TradeUnit[]).map((unit) => (
                  <option key={unit} value={unit}>
                    {UNIT_LABEL[unit]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">مقدار تحویلی *</span>
              <input name="quantity" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} className="input num" inputMode="decimal" />
              <span className="mt-1 block text-[10px] text-[#7d8b80]">
                معادل {new Intl.NumberFormat("en-US").format(Math.round(num("quantity") * UNIT_FACTORS[form.unit as TradeUnit]))} کیلوگرم
              </span>
            </label>
            <div className="rounded-xl border border-farm-100 bg-farm-50 px-3 py-2">
              <span className="text-[10px] text-farm-800">وزن خالص محاسبه‌شده</span>
              <div className="text-sm font-bold text-farm-900 num">{new Intl.NumberFormat("en-US").format(calc.weights.netKg)} کیلوگرم</div>
              <span className="text-[10px] text-[#5b6a5e]">{(calc.weights.netTon).toLocaleString("en-US")} تن</span>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-dashed border-[#e2dccb] p-3">
            <p className="text-[11px] font-semibold text-[#55655a]">اگر برگه باسکول دارید، وزن پر و خالی را وارد کنید (دقیق‌تر است):</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="label">وزن پر (با بار) کیلوگرم</span>
                <input name="grossKg" value={form.grossKg} onChange={(e) => set("grossKg", e.target.value)} className="input num" inputMode="decimal" placeholder="مثلاً ۳۱۲۰۰" />
              </label>
              <label>
                <span className="label">وزن خالی (خودرو) کیلوگرم</span>
                <input name="tareKg" value={form.tareKg} onChange={(e) => set("tareKg", e.target.value)} className="input num" inputMode="decimal" placeholder="مثلاً ۶۲۰۰" />
              </label>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <NumberField name="moisturePct" label="رطوبت (٪)" value={form.moisturePct} onChange={set} suffix="٪" />
            <NumberField name="foreignMatterPct" label="ناخالصی (خاک، سنگ، کاه) ٪" value={form.foreignMatterPct} onChange={set} suffix="٪" />
            <NumberField name="brokenPct" label="دانه شکسته (٪)" value={form.brokenPct} onChange={set} suffix="٪" />
            <NumberField name="pestPct" label="سن‌زدگی (٪)" value={form.pestPct} onChange={set} suffix="٪" />
            {crop.usesHectoliter ? (
              <NumberField name="hectoliter" label="وزن هکتولیتر (kg/hl)" value={form.hectoliter} onChange={set} />
            ) : null}
            {crop.key === "wheat" ? <NumberField name="proteinPct" label="پروتئین (٪) — اختیاری" value={form.proteinPct} onChange={set} suffix="٪" /> : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-sand-50 p-3">
            <span className={`text-sm font-bold ${gradeTone}`}>درجه‌بندی: {GRADE_LABEL[calc.quality.grade]}</span>
            <span className="chip">کیفیت {calc.quality.score} از ۱۰۰</span>
            <span className="chip">ضریب قیمت {calc.quality.priceFactor}</span>
            {calc.quality.notes.map((note) => (
              <span key={note} className="text-[11px] leading-5 text-[#6a7a6d]">
                • {note}
              </span>
            ))}
          </div>
        </section>

        {/* گام ۳ */}
        <section className="card card-pad">
          <SectionTitle n="۳" title="قیمت، افت‌ها و کسورات" hint="هر عدد را می‌توانید با توافق طرف مقابل تغییر دهید" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">قیمت هر کیلوگرم (تومان) *</span>
              <input name="pricePerKgToman" value={form.pricePerKgToman} onChange={(e) => set("pricePerKgToman", e.target.value)} className="input num" inputMode="decimal" required />
              <span className="mt-1 block text-[10px] leading-5 text-[#7d8b80]">
                نرخ مرجع {toman(num("benchmarkPricePerKgToman"))} — {crop.rateNote}
              </span>
            </label>
            <label>
              <span className="label">نرخ مرجع مقایسه (تومان/کیلو)</span>
              <input name="benchmarkPricePerKgToman" value={form.benchmarkPricePerKgToman} onChange={(e) => set("benchmarkPricePerKgToman", e.target.value)} className="input num" inputMode="decimal" />
            </label>
            <label>
              <span className="label">روش افت رطوبت</span>
              <select name="moistureMethod" value={form.moistureMethod} onChange={(e) => set("moistureMethod", e.target.value)} className="input">
                <option value="proportional">وزنی استاندارد: (مازاد ÷ (۱۰۰−رطوبت پایه))×۱۰۰</option>
                <option value="per_percent">توافقی: به ازای هر ۱٪ مازاد</option>
                <option value="none">بدون افت رطوبت</option>
              </select>
            </label>
            <label>
              <span className="label">رطوبت مجاز پایه (٪)</span>
              <input name="baseMoisturePct" value={form.baseMoisturePct} onChange={(e) => set("baseMoisturePct", e.target.value)} className="input num" inputMode="decimal" />
            </label>
            <label>
              <span className="label">سقف پذیرش رطوبت (٪)</span>
              <input name="maxMoisturePct" value={form.maxMoisturePct} onChange={(e) => set("maxMoisturePct", e.target.value)} className="input num" inputMode="decimal" />
            </label>
            {form.moistureMethod === "per_percent" ? (
              <NumberField name="moistureStepPct" label="افت به ازای هر ۱٪ رطوبت مازاد (٪)" value={form.moistureStepPct} onChange={set} suffix="٪" />
            ) : null}
            <label>
              <span className="label">افت مفید استاندارد (٪)</span>
              <input name="standardDeductionPct" value={form.standardDeductionPct} onChange={(e) => set("standardDeductionPct", e.target.value)} className="input num" inputMode="decimal" />
            </label>
            <label>
              <span className="label">افت غیرمفید (٪)</span>
              <input name="nonUsefulDeductionPct" value={form.nonUsefulDeductionPct} onChange={(e) => set("nonUsefulDeductionPct", e.target.value)} className="input num" inputMode="decimal" />
            </label>
            <NumberField name="allowedForeignPct" label="ناخالصی مجاز (٪)" value={form.allowedForeignPct} onChange={set} suffix="٪" />
            <NumberField name="maxForeignPct" label="سقف ناخالصی (٪)" value={form.maxForeignPct} onChange={set} suffix="٪" />
            <NumberField name="insurancePerKgToman" label="حق بیمه محصول (تومان/کیلو)" value={form.insurancePerKgToman} onChange={set} />
            <NumberField name="commissionPct" label="کارمزد/دلالی (٪)" value={form.commissionPct} onChange={set} suffix="٪" />
            <NumberField name="vatRatePct" label="مالیات ارزش افزوده (٪)" value={form.vatRatePct} onChange={set} suffix="٪" />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <NumberField name="transportToman" label="کرایه حمل (تومان)" value={form.transportToman} onChange={set} />
            <label>
              <span className="label">کرایه حمل بر عهده</span>
              <select name="transportPayer" value={form.transportPayer} onChange={(e) => set("transportPayer", e.target.value)} className="input">
                <option value="seller">فروشنده (از مبلغ کسر می‌شود)</option>
                <option value="buyer">خریدار</option>
              </select>
            </label>
            <NumberField name="unloadingToman" label="تخلیه و بارگیری (تومان)" value={form.unloadingToman} onChange={set} />
            <label>
              <span className="label">تخلیه بر عهده</span>
              <select name="unloadingPayer" value={form.unloadingPayer} onChange={(e) => set("unloadingPayer", e.target.value)} className="input">
                <option value="seller">فروشنده</option>
                <option value="buyer">خریدار</option>
              </select>
            </label>
            <NumberField name="samplingToman" label="نمونه‌برداری/آزمایش (تومان)" value={form.samplingToman} onChange={set} />
            <NumberField name="weighbridgeToman" label="باسکول (تومان)" value={form.weighbridgeToman} onChange={set} />
            <NumberField name="otherCostsToman" label="سایر هزینه‌ها (تومان)" value={form.otherCostsToman} onChange={set} />
            <NumberField name="prepaidToman" label="پیش‌پرداخت/دریافتی اولیه (تومان)" value={form.prepaidToman} onChange={set} />
            <NumberField name="adjustmentToman" label="تعدیل توافقی (+/- تومان)" value={form.adjustmentToman} onChange={set} />
            <NumberField name="roundToToman" label="گرد کردن نهایی (تومان)" value={form.roundToToman} onChange={set} />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <CheckField name="gradePricing" label="قیمت بر اساس درجه کیفی تعدیل شود" checked={Boolean(form.gradePricing)} onChange={(v) => set("gradePricing", v ? "1" : "")} />
            <CheckField name="brokenDeduction" label="افت دانه شکسته بیش از ۲٪ کسر شود" checked={Boolean(form.brokenDeduction)} onChange={(v) => set("brokenDeduction", v ? "1" : "")} />
            <CheckField name="vatOnFeesOnly" label="مالیات فقط بر خدمات (نه کل محصول)" checked={Boolean(form.vatOnFeesOnly)} onChange={(v) => set("vatOnFeesOnly", v ? "1" : "")} />
            <p className="rounded-xl bg-sand-50 px-3 py-2 text-[10px] leading-5 text-[#6a7a6d]">
              محصولات کشاورزی فرآوری‌نشده طبق بند (الف) ماده ۹ قانون مالیات بر ارزش افزوده ۱۴۰۰ معاف‌اند؛ نرخ صفر پیش‌فرض است.
            </p>
          </div>
        </section>

        {/* گام ۴ */}
        <section className="card card-pad">
          <SectionTitle n="۴" title="تاریخ‌ها، حمل و شرایط پرداخت" hint="همه تاریخ‌ها شمسی و مطابق تقویم رسمی ایران" />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <DateField name="contractDate" label="تاریخ قرارداد *" value={form.contractDate} onChange={set} required />
            <DateField name="deliveryDate" label="تاریخ تحویل بار" value={form.deliveryDate} onChange={set} />
            <DateField name="dueDate" label="سررسید پرداخت" value={form.dueDate} onChange={set} />
            <label>
              <span className="label">محل تحویل</span>
              <input name="deliveryPlace" value={form.deliveryPlace} onChange={(e) => set("deliveryPlace", e.target.value)} className="input" placeholder="مثلاً سیلوی اهواز — درب ۳" />
            </label>
            <label>
              <span className="label">پلاک خودرو</span>
              <input name="vehiclePlate" value={form.vehiclePlate} onChange={(e) => set("vehiclePlate", e.target.value)} className="input" placeholder="۱۲ ب ۳۴۵ — ایران ۷۸" />
            </label>
            <label>
              <span className="label">نام راننده</span>
              <input name="driverName" value={form.driverName} onChange={(e) => set("driverName", e.target.value)} className="input" />
            </label>
            <NumberField name="delayDays" label="تأخیر پرداخت (روز)" value={form.delayDays} onChange={set} />
            <NumberField name="delayPenaltyPerDayPct" label="خسارت تأخیر روزانه (٪)" value={form.delayPenaltyPerDayPct} onChange={set} suffix="٪" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">یادداشت داخلی</span>
              <textarea name="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} className="input min-h-20" placeholder="جزئیات مذاکره، شماره تلفن رابط و ..." />
            </label>
            <label>
              <span className="label">شرایط قرارداد (متن چاپی)</span>
              <textarea name="terms" value={form.terms} onChange={(e) => set("terms", e.target.value)} className="input min-h-20" />
            </label>
          </div>
          <p className="mt-2 text-[10px] leading-5 text-[#7d8b80]">
            شماره سریال معامله و پنج سند رسمی (قرارداد، قبض باسکول، صورتجلسه کیفیت، فاکتور و برگه تسویه) پس از ثبت ساخته می‌شوند.
          </p>
        </section>
      </div>

      {/* نتایج */}
      <div className="space-y-3 xl:sticky xl:top-16 xl:self-start">
        <section className="card card-pad border-farm-200">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-farm-900">صورت‌حساب لحظه‌ای</h2>
            <span className="chip">{calc.quality.gradeLabel}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniStat label="وزن خالص" value={`${new Intl.NumberFormat("en-US").format(calc.weights.netKg)} kg`} />
            <MiniStat label="وزن تعدیل‌شده" value={`${new Intl.NumberFormat("en-US").format(calc.weights.adjustedKg)} kg`} />
            <MiniStat label="کسر کل" value={`${new Intl.NumberFormat("en-US").format(calc.weights.totalDeductionKg)} kg`} />
            <MiniStat label="ضریب نهایی" value={`${(calc.weights.factor * 100).toFixed(1)}٪`} />
          </div>
          <div className="mt-3 space-y-1.5 text-xs">
            <Row label="ارزش محصول" value={toman(calc.money.grossToman)} />
            {calc.money.insuranceToman > 0 ? <Row label="حق بیمه محصول" value={`+ ${toman(calc.money.insuranceToman)}`} /> : null}
            {calc.money.commissionToman > 0 ? <Row label="کارمزد/دلالی" value={`− ${toman(calc.money.commissionToman)}`} /> : null}
            {calc.money.sellerFeesToman > 0 ? <Row label="کرایه، تخلیه و هزینه‌ها" value={`− ${toman(calc.money.sellerFeesToman)}`} /> : null}
            {calc.money.vatToman > 0 ? <Row label={`مالیات (${calc.money.vatRatePct}٪)`} value={`+ ${toman(calc.money.vatToman)}`} /> : null}
            {calc.money.delayPenaltyToman > 0 ? <Row label="خسارت تأخیر" value={`− ${toman(calc.money.delayPenaltyToman)}`} /> : null}
          </div>
          <div className="mt-3 rounded-xl bg-farm-800 p-3 text-white">
            <span className="text-[10px] text-farm-100">مبلغ قابل تسویه</span>
            <div className="num text-lg font-extrabold">{toman(calc.money.totalToman)}</div>
            <div className="text-[10px] text-farm-100">معادل {new Intl.NumberFormat("en-US").format(calc.money.totalToman * 10)} ریال</div>
            {calc.money.prepaidToman > 0 ? (
              <div className="mt-1 border-t border-white/20 pt-1 text-[11px]">پیش‌پرداخت: {toman(calc.money.prepaidToman)} · مانده: {toman(calc.money.balanceToman)}</div>
            ) : null}
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-[#6a7a6d]">
              <span>اعتبار داده‌های واردشده</span>
              <span className="num">{calc.confidence}٪</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand-200">
              <div className="h-full rounded-full bg-farm-500" style={{ width: `${calc.confidence}%` }} />
            </div>
          </div>

          {calc.errors.length > 0 ? (
            <ul className="mt-3 space-y-1 rounded-xl border border-red-200 bg-red-50 p-2 text-[11px] leading-5 text-red-800">
              {calc.errors.map((error) => (
                <li key={error}>• {error}</li>
              ))}
            </ul>
          ) : null}
          {calc.warnings.length > 0 ? (
            <ul className="mt-2 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">
              {calc.warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          ) : null}

          <button type="submit" disabled={hasBlocking} className="btn btn-primary mt-3 w-full">
            <Icon name="check" className="h-4 w-4" />
            ثبت معامله و صدور اسناد
          </button>
          <Link href="/trade" className="btn btn-ghost mt-2 w-full">
            بازگشت به فهرست معاملات
          </Link>
        </section>

        <section className="card card-pad">
          <button type="button" onClick={() => setShowAudit((v) => !v)} className="section-title w-full">
            <span>ردّ حسابرسی محاسبه</span>
            <Icon name="chevron" className={`h-4 w-4 transition ${showAudit ? "rotate-90" : "-rotate-90"}`} />
          </button>
          {showAudit ? (
            <ol className="mt-2 space-y-1.5 text-[11px] leading-5 text-[#4a5a4c]">
              {calc.steps.map((step) => (
                <li key={step.key} className="rounded-lg bg-sand-50 px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[11px]">{step.label}</strong>
                    <span className="num text-[10px]">
                      {step.weightKg !== undefined ? `${new Intl.NumberFormat("en-US").format(step.weightKg)} kg` : null}
                      {step.amountToman !== undefined && step.amountToman !== 0 ? ` ${toman(step.amountToman)}` : null}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#7d8b80]">{step.detail}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-[11px] leading-5 text-[#7d8b80]">
              مسیر محاسبه وزن، افت، درجه و مبلغ را ببینید؛ همین شرح در اسناد چاپی نیز قابل درج است.
            </p>
          )}
        </section>

        <section className="card card-pad bg-farm-50">
          <h3 className="text-xs font-bold text-farm-900">هوش کیفیت و ریسک</h3>
          <ul className="mt-1.5 space-y-1 text-[11px] leading-5 text-[#4a5a4c]">
            <li>• رطوبت {num("moisturePct")}٪ نسبت به پایه {num("baseMoisturePct")}٪: {calc.weights.moistureDeductionKg > 0 ? `${new Intl.NumberFormat("en-US").format(calc.weights.moistureDeductionKg)} کیلوگرم افت` : "بدون افت"}</li>
            <li>• اختلاف قیمت با نرخ مرجع: {calc.price.gapToBenchmarkPct > 0 ? "+" : ""}{calc.price.gapToBenchmarkPct}٪</li>
            <li>• تاریخ قرارداد: {parseJalaliInput(form.contractDate) ? formatJalaliNumeric(parseJalaliInput(form.contractDate)) : "نامعتبر"}</li>
            <li>• سررسید: {parseJalaliInput(form.dueDate) ? formatJalaliNumeric(parseJalaliInput(form.dueDate)) : "بدون سررسید"}</li>
          </ul>
        </section>
      </div>
    </form>
  );
}

function SectionTitle({ n, title, hint }: { n: string; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-farm-700 text-xs font-bold text-white">{n}</span>
      <div>
        <h2 className="text-sm font-extrabold text-farm-900">{title}</h2>
        <p className="text-[10px] leading-5 text-[#7d8b80]">{hint}</p>
      </div>
    </div>
  );
}

function NumberField({
  name,
  label,
  value,
  onChange,
  suffix,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (key: string, value: string) => void;
  suffix?: string;
}) {
  return (
    <label>
      <span className="label">
        {label} {suffix ? <span className="text-[9px] text-[#94a196]">({suffix})</span> : null}
      </span>
      <input name={name} value={value} onChange={(event) => onChange(name, event.target.value)} className="input num" inputMode="decimal" />
    </label>
  );
}

function DateField({
  name,
  label,
  value,
  onChange,
  required,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (key: string, value: string) => void;
  required?: boolean;
}) {
  const iso = parseJalaliInput(value);
  return (
    <label>
      <span className="label">{label}</span>
      <input
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        className={`input num ${iso ? "" : "border-red-300"}`}
        placeholder="۱۴۰۴/۰۳/۱۵"
        inputMode="numeric"
        required={required}
      />
      <span className="mt-1 block text-[10px] text-[#7d8b80]">{iso ? formatDate(iso) : "قالب: ۱۴۰۴/۰۳/۱۵"}</span>
    </label>
  );
}

function CheckField({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-[#e7e2d3] bg-white px-3 py-2 text-[11px] font-medium text-[#3d4c41]">
      <input type="checkbox" name={name} checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-farm-700" />
      {label}
    </label>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-sand-50 px-2 py-1.5">
      <span className="block text-[9px] text-[#7d8b80]">{label}</span>
      <span className="num block text-[11px] font-bold text-[#22331f]">{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-dashed border-[#eee9dc] pb-1">
      <span className="text-[#6a7a6d]">{label}</span>
      <span className="num font-medium">{value}</span>
    </div>
  );
}
