"use server";

import { db } from "@/db";
import { cropTrades, tradePayments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseJalaliInput, toEnDigits, todayInIranISO } from "@/lib/format";
import {
  computeTrade,
  defaultPolicy,
  defaultQuality,
  getCrop,
  type MarketMode,
  type MoistureMethod,
  type Payer,
  type TradeDirection,
  type TradeInput,
  type TradePolicy,
  type TradeQuality,
  type TradeStatus,
  type TradeUnit,
} from "@/lib/trade/engine";
import { getTrade, insertTrade, nextTradeCode, recalcPaid } from "@/lib/trade/service";

const s = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const cleanNumber = (raw: string) => toEnDigits(raw).replace(/[,٬\s]/g, "").replace(/[^\d.-]/g, "");
const n = (fd: FormData, key: string, fallback = 0) => {
  const raw = s(fd, key);
  if (!raw) return fallback;
  const value = Number(cleanNumber(raw));
  return Number.isFinite(value) ? value : fallback;
};
const b = (fd: FormData, key: string) => ["1", "on", "true", "yes"].includes(s(fd, key).toLowerCase());
const oneOf = <T extends string>(value: string, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
const jdate = (fd: FormData, key: string): string | null => parseJalaliInput(s(fd, key));

function refresh(id?: number) {
  revalidatePath("/trade");
  revalidatePath("/");
  if (id) revalidatePath(`/trade/${id}`);
}

const MODES: readonly MarketMode[] = ["guaranteed", "factory", "custom"];
const UNITS: readonly TradeUnit[] = ["kg", "ton", "kharvar"];
const METHODS: readonly MoistureMethod[] = ["proportional", "per_percent", "none"];
const DIRECTIONS: readonly TradeDirection[] = ["sell", "buy"];
const STATUSES: readonly TradeStatus[] = ["draft", "confirmed", "settled", "canceled"];

function buildInput(fd: FormData): { input: TradeInput; contractDate: string; sellerName: string; buyerName: string } {
  const cropKey = s(fd, "cropKey") || "wheat";
  const crop = getCrop(cropKey);
  const mode = oneOf(s(fd, "mode"), MODES, "factory");
  const preset = defaultPolicy(mode, crop);
  const qualityPreset = defaultQuality(crop);

  const policy: TradePolicy = {
    ...preset,
    baseMoisturePct: n(fd, "baseMoisturePct", preset.baseMoisturePct),
    maxMoisturePct: n(fd, "maxMoisturePct", preset.maxMoisturePct),
    allowedForeignPct: n(fd, "allowedForeignPct", preset.allowedForeignPct),
    maxForeignPct: n(fd, "maxForeignPct", preset.maxForeignPct),
    moistureMethod: oneOf(s(fd, "moistureMethod"), METHODS, preset.moistureMethod),
    moistureStepPct: n(fd, "moistureStepPct", preset.moistureStepPct),
    standardDeductionPct: n(fd, "standardDeductionPct", preset.standardDeductionPct),
    nonUsefulDeductionPct: n(fd, "nonUsefulDeductionPct", preset.nonUsefulDeductionPct),
    brokenDeduction: b(fd, "brokenDeduction"),
    gradePricing: b(fd, "gradePricing"),
    insurancePerKgToman: n(fd, "insurancePerKgToman", preset.insurancePerKgToman),
    commissionPct: n(fd, "commissionPct", preset.commissionPct),
    transportToman: n(fd, "transportToman"),
    transportPayer: oneOf(s(fd, "transportPayer"), ["seller", "buyer"] as const, preset.transportPayer) as Payer,
    unloadingToman: n(fd, "unloadingToman"),
    unloadingPayer: oneOf(s(fd, "unloadingPayer"), ["seller", "buyer"] as const, preset.unloadingPayer) as Payer,
    samplingToman: n(fd, "samplingToman"),
    weighbridgeToman: n(fd, "weighbridgeToman"),
    otherCostsToman: n(fd, "otherCostsToman"),
    vatRatePct: n(fd, "vatRatePct", preset.vatRatePct),
    vatOnFeesOnly: b(fd, "vatOnFeesOnly"),
    delayDays: n(fd, "delayDays"),
    delayPenaltyPerDayPct: n(fd, "delayPenaltyPerDayPct"),
    adjustmentToman: n(fd, "adjustmentToman"),
    prepaidToman: n(fd, "prepaidToman"),
    roundToToman: n(fd, "roundToToman", preset.roundToToman),
    benchmarkPricePerKgToman: n(fd, "benchmarkPricePerKgToman", preset.benchmarkPricePerKgToman),
  };

  const quality: TradeQuality = {
    moisturePct: n(fd, "moisturePct", qualityPreset.moisturePct),
    foreignMatterPct: n(fd, "foreignMatterPct", qualityPreset.foreignMatterPct),
    brokenPct: n(fd, "brokenPct", qualityPreset.brokenPct),
    pestPct: n(fd, "pestPct", qualityPreset.pestPct),
    hectoliter: n(fd, "hectoliter", qualityPreset.hectoliter),
    proteinPct: n(fd, "proteinPct", qualityPreset.proteinPct),
  };

  const contractDate = jdate(fd, "contractDate") ?? todayInIranISO();
  const deliveryDate = jdate(fd, "deliveryDate");
  const dueDate = jdate(fd, "dueDate");
  const sellerName = s(fd, "sellerName");
  const buyerName = s(fd, "buyerName");

  const input: TradeInput = {
    direction: oneOf(s(fd, "direction"), DIRECTIONS, "sell"),
    mode,
    cropKey,
    unit: oneOf(s(fd, "unit"), UNITS, "ton"),
    quantity: n(fd, "quantity"),
    grossKg: n(fd, "grossKg"),
    tareKg: n(fd, "tareKg"),
    pricePerKgToman: n(fd, "pricePerKgToman"),
    quality,
    policy,
    meta: {
      sellerName,
      buyerName,
      contractDate,
      deliveryDate: deliveryDate ?? undefined,
      dueDate: dueDate ?? undefined,
      deliveryPlace: s(fd, "deliveryPlace"),
    },
  };

  return { input, contractDate, sellerName, buyerName };
}

export async function createTrade(formData: FormData) {
  const { input, contractDate, sellerName, buyerName } = buildInput(formData);
  const calc = computeTrade(input);
  const missing: string[] = [];
  if (!sellerName) missing.push("نام فروشنده را وارد کنید.");
  if (!buyerName) missing.push("نام خریدار (کارخانه/سیلو) را وارد کنید.");
  const blocking = [...missing, ...calc.errors];
  if (blocking.length) {
    redirect(`/trade/new?error=${encodeURIComponent(blocking.slice(0, 4).join(" | "))}`);
  }

  const code = await nextTradeCode();
  const deliveryDate = input.meta?.deliveryDate ?? null;
  const dueDate = input.meta?.dueDate ?? null;
  const landId = n(formData, "landId");
  const prepaid = Math.max(0, Math.round(input.policy.prepaidToman));

  const id = await insertTrade({
    code,
    input: input as unknown as Record<string, unknown>,
    calc,
    row: {
      direction: input.direction,
      mode: input.mode,
      cropKey: input.cropKey,
      cropName: calc.crop.name,
      variety: s(formData, "variety"),
      sellerName,
      sellerNationalId: s(formData, "sellerNationalId"),
      sellerPhone: s(formData, "sellerPhone"),
      buyerName,
      buyerType: s(formData, "buyerType") || "factory",
      buyerNationalId: s(formData, "buyerNationalId"),
      buyerPhone: s(formData, "buyerPhone"),
      province: s(formData, "province"),
      deliveryPlace: s(formData, "deliveryPlace"),
      vehiclePlate: s(formData, "vehiclePlate"),
      driverName: s(formData, "driverName"),
      landId: landId > 0 ? Math.round(landId) : null,
      contractDate,
      deliveryDate,
      dueDate,
      unit: input.unit,
      quantityInput: input.quantity,
      grossKg: input.grossKg,
      tareKg: input.tareKg,
      netKg: calc.weights.netKg,
      adjustedKg: calc.weights.adjustedKg,
      moisturePct: input.quality.moisturePct,
      foreignMatterPct: input.quality.foreignMatterPct,
      brokenPct: input.quality.brokenPct,
      pestPct: input.quality.pestPct,
      hectoliter: input.quality.hectoliter,
      proteinPct: input.quality.proteinPct,
      pricePerKgToman: Math.round(input.pricePerKgToman),
      grade: calc.quality.grade,
      gradeLabel: calc.quality.gradeLabel,
      totalToman: calc.money.totalToman,
      prepaidToman: prepaid,
      paidToman: 0,
      status: "draft",
      notes: s(formData, "notes"),
      terms: s(formData, "terms"),
    },
  });

  if (prepaid > 0) {
    await db.insert(tradePayments).values({
      tradeId: id,
      amountToman: prepaid,
      paidAt: contractDate,
      method: "cash",
      note: "پیش‌پرداخت هنگام انعقاد قرارداد",
    });
    await recalcPaid(id);
  }
  refresh(id);
  redirect(`/trade/${id}?created=1`);
}

export async function addTradePayment(formData: FormData) {
  const tradeId = n(formData, "tradeId");
  const amount = Math.round(n(formData, "amountToman"));
  const trade = await getTrade(tradeId);
  if (!trade) redirect("/trade?error=" + encodeURIComponent("معامله یافت نشد."));
  if (trade.status === "canceled") {
    redirect(`/trade/${tradeId}?error=${encodeURIComponent("معامله لغو شده است و دریافت جدید ثبت نمی‌شود.")}`);
  }
  if (amount <= 0) {
    redirect(`/trade/${tradeId}?error=${encodeURIComponent("مبلغ دریافتی باید بزرگ‌تر از صفر باشد.")}`);
  }
  const balance = Math.max(0, Number(trade.totalToman) - Number(trade.paidToman));
  if (amount > balance) {
    redirect(
      `/trade/${tradeId}?error=${encodeURIComponent(
        `مبلغ دریافتی از مانده (${balance.toLocaleString("en-US")} تومان) بیشتر است؛ ابتدا مبلغ را اصلاح کنید.`,
      )}`,
    );
  }
  await db.insert(tradePayments).values({
    tradeId,
    amountToman: amount,
    paidAt: jdate(formData, "paidAt") ?? todayInIranISO(),
    method: oneOf(s(formData, "method"), ["cash", "bank", "cheque", "deduction"] as const, "bank"),
    reference: s(formData, "reference"),
    note: s(formData, "note"),
  });
  await recalcPaid(tradeId);
  refresh(tradeId);
  redirect(`/trade/${tradeId}?paid=1`);
}

export async function deleteTradePayment(formData: FormData) {
  const id = n(formData, "id");
  const tradeId = n(formData, "tradeId");
  if (id > 0) {
    await db.delete(tradePayments).where(eq(tradePayments.id, Math.round(id)));
    await recalcPaid(tradeId);
  }
  refresh(tradeId);
}

export async function setTradeStatus(formData: FormData) {
  const id = n(formData, "id");
  const status = oneOf(s(formData, "status"), STATUSES, "draft");
  if (id <= 0) return;
  if (status === "settled") {
    const trade = await getTrade(id);
    if (!trade || Number(trade.paidToman) < Number(trade.totalToman)) {
      redirect(`/trade/${id}?error=${encodeURIComponent("برای تسویه، ابتدا همه دریافت‌ها ثبت شود.")}`);
    }
  }
  await db.update(cropTrades).set({ status }).where(eq(cropTrades.id, Math.round(id)));
  refresh(id);
}

export async function deleteTrade(formData: FormData) {
  const id = n(formData, "id");
  if (id > 0) {
    await db.delete(cropTrades).where(eq(cropTrades.id, Math.round(id)));
  }
  refresh();
  redirect("/trade?deleted=1");
}
