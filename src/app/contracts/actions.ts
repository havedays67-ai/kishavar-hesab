"use server";

import { db } from "@/db";
import { agriContractPayments, agriContracts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseJalaliInput, toEnDigits, todayInIranISO } from "@/lib/format";

const s = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const clean = (raw: string) => toEnDigits(raw).replace(/[,٬\s]/g, "").replace(/[^\d.-]/g, "");
const n = (fd: FormData, key: string, fallback = 0) => {
  const raw = s(fd, key);
  if (!raw) return fallback;
  const value = Number(clean(raw));
  return Number.isFinite(value) ? value : fallback;
};
const oneOf = <T extends string>(value: string, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
const jdate = (fd: FormData, key: string) => parseJalaliInput(s(fd, key));

function refresh(id?: number) {
  revalidatePath("/contracts");
  revalidatePath("/");
  if (id) revalidatePath(`/contracts/${id}`);
}

export async function createContract(formData: FormData) {
  const title = s(formData, "title");
  const counterpartyName = s(formData, "counterpartyName");
  const startDate = jdate(formData, "startDate");
  const endDate = jdate(formData, "endDate");
  if (!title || !counterpartyName || !startDate || !endDate) {
    redirect(`/contracts?error=${encodeURIComponent("عنوان، طرف قرارداد و تاریخ شروع/پایان (شمسی) الزامی است.")}`);
  }
  if (endDate < startDate) {
    redirect(`/contracts?error=${encodeURIComponent("تاریخ پایان نمی‌تواند پیش از تاریخ شروع باشد.")}`);
  }
  await db.insert(agriContracts).values({
    title,
    perspective: oneOf(s(formData, "perspective"), ["lessee", "lessor"] as const, "lessee"),
    type: oneOf(s(formData, "type"), ["cash", "crop_share", "cash_share", "mosaqat", "partnership"] as const, "cash"),
    counterpartyName,
    counterpartyPhone: s(formData, "counterpartyPhone"),
    crop: s(formData, "crop"),
    areaHa: n(formData, "areaHa"),
    location: s(formData, "location"),
    plate: s(formData, "plate"),
    startDate,
    endDate,
    cycle: oneOf(s(formData, "cycle"), ["once", "monthly", "seasonal", "annual"] as const, "once"),
    totalRentToman: Math.max(0, Math.round(n(formData, "totalRentToman"))),
    depositToman: Math.max(0, Math.round(n(formData, "depositToman"))),
    landownerSharePercent: Math.min(100, Math.max(0, n(formData, "landownerSharePercent"))),
    waterShare: s(formData, "waterShare"),
    waterPaidBy: oneOf(s(formData, "waterPaidBy"), ["farmer", "landowner", "split"] as const, "farmer"),
    costsPaidBy: oneOf(s(formData, "costsPaidBy"), ["farmer", "landowner", "split"] as const, "farmer"),
    status: oneOf(s(formData, "status"), ["draft", "active", "ended", "canceled"] as const, "active"),
    witnesses: s(formData, "witnesses"),
    terms: s(formData, "terms"),
    notes: s(formData, "notes"),
  });
  refresh();
  redirect("/contracts?created=1");
}

export async function setContractStatus(formData: FormData) {
  const id = n(formData, "id");
  const status = oneOf(s(formData, "status"), ["draft", "active", "ended", "canceled"] as const, "active");
  if (id > 0) await db.update(agriContracts).set({ status }).where(eq(agriContracts.id, Math.round(id)));
  refresh(id);
}

export async function deleteContract(formData: FormData) {
  const id = n(formData, "id");
  if (id > 0) await db.delete(agriContracts).where(eq(agriContracts.id, Math.round(id)));
  refresh();
}

export async function addContractPayment(formData: FormData) {
  const contractId = Math.round(n(formData, "contractId"));
  const amount = Math.round(n(formData, "amountToman"));
  if (contractId <= 0 || amount <= 0) {
    redirect(`/contracts?error=${encodeURIComponent("مبلغ پرداخت/دریافت باید بزرگ‌تر از صفر باشد.")}`);
  }
  await db.insert(agriContractPayments).values({
    contractId,
    kind: oneOf(s(formData, "kind"), ["rent", "deposit", "deposit_refund", "crop_share", "other"] as const, "rent"),
    amountToman: amount,
    paidAt: jdate(formData, "paidAt") ?? todayInIranISO(),
    account: oneOf(s(formData, "account"), ["cash", "bank"] as const, "bank"),
    note: s(formData, "note"),
  });
  refresh(contractId);
}

export async function deleteContractPayment(formData: FormData) {
  const id = n(formData, "id");
  const contractId = n(formData, "contractId");
  if (id > 0) await db.delete(agriContractPayments).where(eq(agriContractPayments.id, Math.round(id)));
  refresh(contractId);
}
