/**
 * کشاورزحساب — قالب‌های قرارداد زمین کشاورزی
 * پنج قالب رایج با نقش درست طرفین و محاسبه‌ی قطعی سهم محصول/سود.
 *
 * قاعده‌ی کلیدی: «مستاجر» همان کشاورزی است که زمین را برای کشت اجاره می‌کند و
 * مالک (موجر) زمین را واگذار می‌کند. در مزارعه، صاحب زمین «مزارع» و کشاورز «عامل» است.
 * فیلد perspective مشخص می‌کند کاربر اپ کدام طرف قرارداد است.
 */
import { faDigits, fmt } from "./engine";

export type LeaseContractType =
  | "cash"
  | "share"
  | "mixed"
  | "profit_share"
  | "guaranteed_bonus";

export interface LeaseFormMeta {
  label: string;
  short: string;
  ownerTitle: string;
  farmerTitle: string;
  hasCash: boolean;
  hasCropShare: boolean;
  risk: "owner" | "farmer" | "shared";
  note: string;
}

export const LEASE_FORM_META: Record<LeaseContractType, LeaseFormMeta> = {
  cash: {
    label: "اجاره نقدی ثابت",
    short: "اجاره نقدی",
    ownerTitle: "موجر (مالک زمین)",
    farmerTitle: "مستاجر (کشاورز)",
    hasCash: true,
    hasCropShare: false,
    risk: "farmer",
    note: "مبلغ ثابت با اقساط معین؛ تمام ریسک تولید با کشاورز/مستاجر است.",
  },
  share: {
    label: "مزارعه (سهم مشاعی محصول)",
    short: "مزارعه",
    ownerTitle: "مزارع (صاحب زمین)",
    farmerTitle: "عامل (کشاورز)",
    hasCash: false,
    hasCropShare: true,
    risk: "shared",
    note: "سهم طرفین باید کسری و به نحو اشاعه باشد (۱/۳، ۱/۴ …).",
  },
  mixed: {
    label: "اجاره نقدی + سهم محصول",
    short: "ترکیبی",
    ownerTitle: "موجر (مالک زمین)",
    farmerTitle: "مستاجر (کشاورز)",
    hasCash: true,
    hasCropShare: true,
    risk: "shared",
    note: "مبلغ پایه‌ی نقدی برای مالک + درصدی از محصول؛ ریسک تقسیم می‌شود.",
  },
  profit_share: {
    label: "مشارکت در سود خالص",
    short: "سود خالص",
    ownerTitle: "مالک (شریک)",
    farmerTitle: "بهره‌بردار (شریک)",
    hasCash: false,
    hasCropShare: true,
    risk: "shared",
    note: "درصدی از سود پس از کسر هزینه‌های مستند تولید.",
  },
  guaranteed_bonus: {
    label: "حداقل تضمینی + درصد مازاد",
    short: "تضمینی + مازاد",
    ownerTitle: "موجر (مالک زمین)",
    farmerTitle: "مستاجر (کشاورز)",
    hasCash: true,
    hasCropShare: true,
    risk: "shared",
    note: "کف پرداخت برای مالک + درصدی از مازاد درآمد/محصول.",
  },
};

export function leaseFormMeta(kind: string): LeaseFormMeta {
  return LEASE_FORM_META[(kind as LeaseContractType) in LEASE_FORM_META ? (kind as LeaseContractType) : "cash"];
}

export function leaseRoles(kind: string): { owner: string; farmer: string } {
  const meta = leaseFormMeta(kind);
  return { owner: meta.ownerTitle, farmer: meta.farmerTitle };
}

/** جمله‌ی صریح نقش کاربر در قرارداد (رفع ابهام موجر/مستاجر) */
export function perspectiveStatement(perspective: string | undefined, kind: string): string {
  const roles = leaseRoles(kind);
  return perspective === "owner"
    ? `تنظیم‌کننده‌ی این قرارداد ${roles.owner} است و عوض قرارداد را از ${roles.farmer} دریافت می‌کند.`
    : `تنظیم‌کننده‌ی این قرارداد ${roles.farmer} است و زمین را از ${roles.owner} برای کشت در اختیار می‌گیرد و عوض قرارداد را می‌پردازد.`;
}

export function validateLeaseTerms(input: {
  kind: string;
  landlordId: number;
  tenantId: number;
  start: string;
  end: string;
  total: number;
  sharePercent: number;
  guaranteedMin?: number;
  bonusPercent?: number;
  profitPercent?: number;
  perspective?: string;
}): string | null {
  if (!input.landlordId) return "مالک زمین را انتخاب کنید.";
  if (!input.tenantId) return "کشاورز (بهره‌بردار) را انتخاب کنید.";
  if (input.landlordId === input.tenantId) return "مالک و کشاورز نمی‌توانند یک نفر باشند.";
  if (!input.start || !input.end) return "تاریخ شروع و پایان قرارداد لازم است.";
  if (input.end <= input.start) return "تاریخ پایان باید بعد از شروع باشد.";
  if (input.perspective && input.perspective !== "farmer" && input.perspective !== "owner")
    return "نقش شما در قرارداد (مالک یا کشاورز) را انتخاب کنید.";
  if (input.kind === "share" || input.kind === "mixed") {
    if (input.sharePercent <= 0 || input.sharePercent >= 100)
      return "سهم مالک از محصول باید بین ۱ تا ۹۹ درصد و به‌صورت کسری باشد (مثلاً ۱/۳).";
  }
  if (input.kind === "profit_share") {
    if ((input.profitPercent ?? 0) <= 0 || (input.profitPercent ?? 0) >= 100)
      return "سهم مالک از سود خالص باید بین ۱ تا ۹۹ درصد باشد.";
  }
  if (input.kind === "guaranteed_bonus") {
    if ((input.guaranteedMin ?? 0) <= 0) return "حداقل مبلغ تضمینی باید بزرگ‌تر از صفر باشد.";
    if ((input.bonusPercent ?? 0) < 0 || (input.bonusPercent ?? 0) >= 100) return "درصد مازاد باید بین ۰ تا ۹۹ باشد.";
  }
  if (input.kind === "share" || input.kind === "profit_share") return null;
  if (input.total <= 0 && !(input.kind === "guaranteed_bonus" && (input.guaranteedMin ?? 0) > 0))
    return "مبلغ اجاره باید بزرگ‌تر از صفر باشد.";
  return null;
}

export interface CropShareSettlement {
  revenue: number;
  costs: number;
  ownerCash: number;
  ownerCrop: number;
  ownerBonus: number;
  ownerTotal: number;
  farmerNet: number;
  explanation: string[];
}

/** تسویه‌ی محصول/سود برای هر پنج قالب — قطعی و مستند */
export function settleCropShare(input: {
  kind: string;
  totalKg: number;
  pricePerKg: number;
  totalCost?: number;
  ownerSharePercent?: number;
  guaranteedMin?: number;
  bonusPercent?: number;
  profitPercent?: number;
  costBearer?: "farmer" | "owner" | "split";
}): CropShareSettlement {
  const revenue = Math.max(0, Math.round((input.totalKg || 0) * (input.pricePerKg || 0)));
  const costs = Math.max(0, Math.round(input.totalCost || 0));
  const pct = Math.min(99, Math.max(0, input.ownerSharePercent || 0));
  const bearer = input.costBearer || "farmer";
  const explanation: string[] = [];
  explanation.push(`فروش محصول: ${fmt(revenue)} (${faDigits(input.totalKg)} کیلو × ${fmt(input.pricePerKg)})`);
  if (costs) explanation.push(`هزینه‌های تولید: ${fmt(costs)}`);

  let ownerCash = 0;
  let ownerCrop = 0;
  let ownerBonus = 0;
  let farmerNet = 0;

  switch (input.kind) {
    case "share": {
      const base = bearer === "split" ? Math.max(0, revenue - costs) : revenue;
      ownerCrop = Math.round((base * pct) / 100);
      farmerNet = revenue - ownerCrop - (bearer === "farmer" ? costs : 0);
      if (bearer === "owner") ownerCrop -= costs;
      explanation.push(`سهم مالک ${faDigits(pct)}٪ از محصول = ${fmt(Math.round((base * pct) / 100))}`);
      break;
    }
    case "profit_share": {
      const net = Math.max(0, revenue - costs);
      const profitPct = Math.min(99, Math.max(0, input.profitPercent || pct));
      ownerCrop = Math.round((net * profitPct) / 100);
      farmerNet = net - ownerCrop;
      explanation.push(`سود خالص ${fmt(net)}؛ سهم مالک ${faDigits(profitPct)}٪ = ${fmt(ownerCrop)}`);
      break;
    }
    case "mixed": {
      ownerCash = Math.max(0, Math.round(input.guaranteedMin || 0));
      ownerCrop = Math.round((Math.max(0, revenue - (bearer === "split" ? costs : 0)) * pct) / 100);
      farmerNet = revenue - ownerCrop - (bearer === "farmer" ? costs : 0);
      explanation.push(`سهم محصول مالک ${faDigits(pct)}٪ = ${fmt(ownerCrop)}`);
      break;
    }
    case "guaranteed_bonus": {
      ownerCash = Math.max(0, Math.round(input.guaranteedMin || 0));
      const surplus = Math.max(0, revenue - ownerCash);
      ownerBonus = Math.round((surplus * Math.min(99, Math.max(0, input.bonusPercent || 0))) / 100);
      farmerNet = revenue - ownerCash - ownerBonus - (bearer === "farmer" ? costs : 0);
      explanation.push(`حداقل تضمینی ${fmt(ownerCash)} + ${faDigits(input.bonusPercent || 0)}٪ مازاد ${fmt(surplus)} = ${fmt(ownerBonus)}`);
      break;
    }
    default: {
      ownerCrop = 0;
      ownerBonus = 0;
      farmerNet = revenue - (bearer === "farmer" ? costs : 0);
      explanation.push("در اجاره نقدی، محصول کامل متعلق به مستاجر است و مالک فقط مال‌الاجاره می‌گیرد.");
    }
  }

  return {
    revenue,
    costs,
    ownerCash,
    ownerCrop,
    ownerBonus,
    ownerTotal: ownerCash + ownerCrop + ownerBonus,
    farmerNet,
    explanation,
  };
}
