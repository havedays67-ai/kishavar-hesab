import { sha256, stableStringify } from "./hash";
import type { JDate } from "./format";

/* --------------------------------- انواع --------------------------------- */

export type SignatureMethod = "draw";
export type SignatureRole =
  | "seller"
  | "buyer"
  | "landlord"
  | "tenant"
  | "witness"
  | "weighbridge"
  | "sampler"
  | "laboratory"
  | "driver"
  | "receiver"
  | "payer"
  | "payee"
  | "drawer"
  | "borrower"
  | "lender"
  | "manager"
  | "counterparty"
  | "issuer";

export type SignableType =
  | "document"
  | "party"
  | "cheque"
  | "loan"
  | "trade"
  | "asset"
  | "inventory-move";

export interface SignatureRoleRequirement {
  role: SignatureRole;
  label: string;
  required: boolean;
  why: string;
  signer: "me" | "counterparty";
}

export interface SignatureRecord {
  id: string;
  entityType: SignableType;
  entityId: string;
  role: SignatureRole;
  signerName: string;
  signerPhone: string;
  signerNationalId: string;
  method: SignatureMethod;
  image: string;
  crypto: {
    algorithm: string;
    publicKey: string;
    signature: string;
    keyFingerprint: string;
  };
  signedAt: JDate;
  signedAtIso: string;
  payloadHash: string;
  previousHash: string;
  signatureHash: string;
  verifyCode: string;
  note: string;
}

export interface SignableEntity {
  id: string;
  type: SignableType;
  title: string;
  subtitle: string;
  serial: string;
  amount: number;
  payload: unknown;
  roles: SignatureRoleRequirement[];
  createdAt: JDate;
}

export interface ChainCheck {
  index: number;
  role: SignatureRole;
  signerName: string;
  valid: boolean;
  expected: string;
  actual: string;
}

export interface SignatureAudit {
  entityId: string;
  payloadHash: string;
  signed: number;
  required: number;
  complete: boolean;
  records: SignatureRecord[];
  chain: ChainCheck[];
  chainValid: boolean;
  missing: SignatureRoleRequirement[];
  tier: "simple" | "cryptographic";
  tierLabel: string;
  legalNote: string;
}

/* ---------------------------- ماتریس امضاها ---------------------------- */

const req = (
  role: SignatureRole,
  label: string,
  why: string,
  signer: "me" | "counterparty",
  required = true
): SignatureRoleRequirement => ({ role, label, why, signer, required });

export const DOCUMENT_SIGNATURE_ROLES: Record<string, SignatureRoleRequirement[]> = {
  "sale-contract": [
    req("seller", "فروشنده محصول", "تعهد به تحویل محموله با مشخصات توافقی", "me"),
    req("buyer", "خریدار / کارخانه", "تعهد به پرداخت بهاء و پذیرش وزن و کیفیت", "counterparty"),
    req("witness", "شاهد (اختیاری)", "تقویت ارزش اثباتی در اختلاف احتمالی", "counterparty", false),
  ],
  "weigh-ticket": [
    req("weighbridge", "مسئول باسکول", "تأیید وزن پر، خالی و خالص", "counterparty"),
    req("seller", "فروشنده / تحویل‌دهنده", "تأیید تحویل محموله", "me"),
  ],
  "quality-minutes": [
    req("sampler", "نمونه‌بردار", "تأیید روش و اصالت نمونه", "counterparty"),
    req("seller", "فروشنده", "تأیید حضور و پذیرش روش نمونه‌برداری", "me"),
    req("laboratory", "مسئول آزمایشگاه", "تأیید نتایج رطوبت، افت و درجه", "counterparty"),
  ],
  "sale-invoice": [
    req("seller", "فروشنده", "تأیید مقدار، نرخ و کسورات", "me"),
    req("buyer", "خریدار", "تأیید بدهی و شرایط پرداخت", "counterparty"),
  ],
  settlement: [
    req("seller", "فروشنده / طلبکار", "تأیید دریافت یا مانده", "me"),
    req("buyer", "خریدار / بدهکار", "تأیید پرداخت و مانده بدهی", "counterparty"),
  ],
  "lease-contract": [
    req("landlord", "موجر / مالک زمین", "تعهد به واگذاری زمین و حقابه", "me"),
    req("tenant", "مستاجر / بهره‌بردار", "تعهد به پرداخت اجاره و حفظ کاربری", "counterparty"),
    req("witness", "شاهد (اختیاری)", "کاهش ریسک اختلاف در آینده", "counterparty", false),
  ],
  "lease-receipt": [req("receiver", "دریافت‌کننده اجاره", "تأیید دریافت مبلغ", "me")],
  "lease-handover": [
    req("landlord", "تحویل‌دهنده زمین", "تأیید وضعیت زمین و تأسیسات", "me"),
    req("tenant", "تحویل‌گیرنده زمین", "تأیید تحویل و شروع بهره‌برداری", "counterparty"),
  ],
  "party-statement": [
    req("issuer", "صادرکننده صورتحساب", "تأیید مانده و گردش پرداخت", "me"),
    req("counterparty", "طرف‌حساب", "تأیید بدهی/طلب و پرداخت‌های ثبت‌شده", "counterparty"),
  ],
  "finance-report": [req("manager", "مدیر مالی / مزرعه", "تأیید گزارش مدیریتی", "me")],
  "inventory-report": [req("manager", "مدیر مزرعه", "تأیید موجودی و بودجه", "me")],
  "trades-report": [req("manager", "مدیر مزرعه", "تأیید گزارش معاملات", "me")],
  "cost-report": [req("manager", "مدیر مزرعه", "تأیید گزارش بهای تمام‌شده", "me")],
};

export const ENTITY_SIGNATURE_ROLES: Record<SignableType, SignatureRoleRequirement[]> = {
  document: [],
  party: [
    req("issuer", "ثبت‌کننده (شما)", "تأیید ثبت دلیل، تاریخ و مبلغ", "me"),
    req("counterparty", "طرف بدهی/طلب", "تأیید بدهی یا طلب و مبلغ", "counterparty"),
  ],
  cheque: [
    req("drawer", "صادرکننده چک", "امضای چک در قانون صدور چک الزامی است", "counterparty"),
    req("payee", "دریافت‌کننده چک", "تأیید دریافت چک و مشخصات آن", "me"),
  ],
  loan: [
    req("borrower", "وام‌گیرنده", "تعهد به بازپرداخت اقساط", "me"),
    req("lender", "وام‌دهنده", "تعهد به پرداخت وام و شرایط آن", "counterparty"),
    req("witness", "شاهد (اختیاری)", "تقویت اعتبار در اختلاف", "counterparty", false),
  ],
  trade: [
    req("seller", "فروشنده محصول", "تأیید فروش و تحویل", "me"),
    req("buyer", "خریدار", "تأیید خرید و پرداخت", "counterparty"),
  ],
  asset: [req("issuer", "ثبت‌کننده دارایی", "تأیید بهای خرید و استهلاک", "me")],
  "inventory-move": [req("issuer", "ثبت‌کننده گردش انبار", "تأیید ورود یا خروج کالا", "me")],
};

export function rolesForDocument(kind: string): SignatureRoleRequirement[] {
  return DOCUMENT_SIGNATURE_ROLES[kind] ?? [req("manager", "مدیر", "تأیید سند مدیریتی", "me")];
}

/* ------------------------------ محاسبات ------------------------------ */

export function entityPayloadHash(payload: unknown): string {
  return sha256(stableStringify(payload));
}

export function computeSignatureHash(input: {
  entityType: SignableType;
  entityId: string;
  role: SignatureRole;
  signerName: string;
  signedAtIso: string;
  payloadHash: string;
  previousHash: string;
}): string {
  return sha256(
    [
      "KISHAVAR-SIG-V1",
      input.entityType,
      input.entityId,
      input.role,
      input.signerName.trim(),
      input.signedAtIso,
      input.payloadHash,
      input.previousHash,
    ].join("|")
  );
}

export function shortHash(hash: string, size = 12): string {
  return hash ? `${hash.slice(0, size)}…` : "—";
}

export function verifySignatureChain(entityId: string, payloadHash: string, records: SignatureRecord[]): ChainCheck[] {
  const sorted = [...records].sort((a, b) => a.signedAtIso.localeCompare(b.signedAtIso));
  return sorted.map((record, index) => {
    const previousHash = index === 0 ? payloadHash : sorted[index - 1].signatureHash;
    const expected = computeSignatureHash({
      entityType: record.entityType,
      entityId,
      role: record.role,
      signerName: record.signerName,
      signedAtIso: record.signedAtIso,
      payloadHash: index === 0 ? payloadHash : record.payloadHash,
      previousHash,
    });
    return {
      index: index + 1,
      role: record.role,
      signerName: record.signerName,
      valid: expected === record.signatureHash && record.previousHash === previousHash,
      expected,
      actual: record.signatureHash,
    };
  });
}

export function auditEntity(entity: SignableEntity, allRecords: SignatureRecord[]): SignatureAudit {
  const records = allRecords.filter((record) => record.entityId === entity.id).sort((a, b) => a.signedAtIso.localeCompare(b.signedAtIso));
  const payloadHash = entityPayloadHash(entity.payload);
  const chain = verifySignatureChain(entity.id, payloadHash, records);
  const requiredRoles = entity.roles.filter((role) => role.required);
  const signedRoles = new Set(records.map((record) => record.role));
  const missing = requiredRoles.filter((role) => !signedRoles.has(role.role));
  const cryptographic = records.some((record) => Boolean(record.crypto?.signature));
  const tier = cryptographic ? "cryptographic" : "simple";
  return {
    entityId: entity.id,
    payloadHash,
    signed: requiredRoles.filter((role) => signedRoles.has(role.role)).length,
    required: requiredRoles.length,
    complete: missing.length === 0,
    records,
    chain,
    chainValid: chain.every((item) => item.valid),
    missing,
    tier,
    tierLabel:
      tier === "cryptographic"
        ? "امضای الکترونیکی ساده + امضای رمزنگاری‌شده روی دستگاه"
        : "امضای الکترونیکی ساده",
    legalNote:
      "این امضا در برنامه ثبت می‌شود و hash محتوا، زمان، نام امضاکننده و زنجیره امضاها را نگه می‌دارد؛ برای اثبات بهتر است اسناد با QR و نسخه چاپی نگه‌داری شوند. «امضای الکترونیکی مطمئن» طبق ماده ۱۰ قانون تجارت الکترونیکی شرایط ویژه‌ای دارد و به گواهی مرکز صدور گواهی الکترونیکی معتبر نیاز دارد؛ امضای این برنامه فاقد چنین گواهی است و جایگزین سند رسمی، ثبت اسناد رسمی یا دسته‌چک کاغذی نیست.",
  };
}

export function signatureTierExplanation(): string[] {
  return [
    "امضای ساده الکترونیکی: کشیدن امضا روی صفحه، نام، تلفن، زمان و hash محتوا. در دعوا می‌تواند به‌عنوان اماره و قرینه ارائه شود، اما به‌تنهایی «امضای الکترونیکی مطمئن» قانون تجارت الکترونیکی نیست.",
    "امضای ساده + امضای رمزنگاری‌شده: کلید خصوصی روی همین دستگاه ساخته می‌شود و hash سند با آن امضا می‌شود؛ هر تغییری در سند یا امضا با بررسی کلید عمومی قابل کشف است. این سطح از امضای تصویری قوی‌تر است، اما هنوز گواهی مرکز صدور گواهی (CA) ندارد.",
    "امضای الکترونیکی مطمئن (ماده ۱۰ قانون تجارت الکترونیکی): نیازمند گواهی الکترونیکی معتبر و امکان تشخیص تغییر داده است؛ این برنامه علاوه بر hash، باید به مرکز صدور گواهی متصل شود تا این سطح محقق شود.",
    "برای قرارداد زمین با مبلغ بالا، چک و تعهدات سنگین، امضای حضوری و ثبت رسمی/دفتر اسناد رسمی یا سامانه‌های دولتی توصیه می‌شود. چک نیز تا وقتی دسته‌چک کاغذی و شرایط قانون صدور چک رعایت نشود، صرفاً الکترونیکی نیست.",
  ];
}

/* ------------------------------- آزمون ------------------------------- */

export interface SignatureCheck {
  name: string;
  pass: boolean;
  detail: string;
}

export function runSignatureSelfTest(): SignatureCheck[] {
  const payload = { amount: 1000, title: "سند آزمایشی" };
  const payloadHash = entityPayloadHash(payload);
  const base = {
    entityType: "trade" as const,
    entityId: "trade-test-1",
    role: "seller" as const,
    signerName: "فروشنده آزمایشی",
    signedAtIso: "2026-10-27T10:00:00.000Z",
    payloadHash,
    previousHash: payloadHash,
  };
  const first = computeSignatureHash(base);
  const second = computeSignatureHash({ ...base, signerName: "طرف دوم" });
  const tampered = computeSignatureHash({ ...base, payloadHash: entityPayloadHash({ ...payload, amount: 999999 }) });
  const record: SignatureRecord = {
    id: "sig-test",
    entityType: "trade",
    entityId: "trade-test-1",
    role: "seller",
    signerName: "فروشنده آزمایشی",
    signerPhone: "09120000000",
    signerNationalId: "",
    method: "draw",
    image: "",
    crypto: { algorithm: "ECDSA-P256-SHA256", publicKey: "test", signature: "test", keyFingerprint: "test" },
    signedAt: { jy: 1405, jm: 8, jd: 5 },
    signedAtIso: base.signedAtIso,
    payloadHash,
    previousHash: payloadHash,
    signatureHash: first,
    verifyCode: first.slice(0, 10).toUpperCase(),
    note: "",
  };
  const chain = verifySignatureChain("trade-test-1", payloadHash, [record]);
  const tamperChain = verifySignatureChain("trade-test-1", entityPayloadHash({ ...payload, amount: 999999 }), [record]);
  return [
    { name: "هش سند قطعی و تکرارپذیر است", pass: payloadHash === entityPayloadHash({ title: "سند آزمایشی", amount: 1000 }) && payloadHash.length === 64, detail: `SHA-256: ${payloadHash.slice(0, 16)}…` },
    { name: "هر امضاکننده هش متفاوت می‌گیرد", pass: first !== second, detail: `${first.slice(0, 10)} ≠ ${second.slice(0, 10)}` },
    { name: "تغییر مبلغ سند، hash را تغییر می‌دهد", pass: first !== tampered, detail: `hash قبلی: ${payloadHash.slice(0, 10)} · بعد از تغییر: ${tampered.slice(0, 10)}` },
    { name: "زنجیره امضای دست‌نخورده معتبر است", pass: chain.every((item) => item.valid), detail: `${chain.length} امضا` },
    { name: "دست‌کاری سند در بررسی زنجیره کشف می‌شود", pass: tamperChain.some((item) => !item.valid), detail: "hash محتوا با hash امضا نمی‌خواند" },
    { name: "امضای الزامی فروشنده/خریدار تعریف شده است", pass: (DOCUMENT_SIGNATURE_ROLES["sale-contract"] ?? []).length >= 2, detail: "قرارداد فروش: فروشنده + خریدار + شاهد اختیاری" },
    { name: "چک، صادرکننده و دریافت‌کننده دارد", pass: (ENTITY_SIGNATURE_ROLES.cheque ?? []).every((role) => ["drawer", "payee"].includes(role.role)), detail: "صادرکننده چک و دریافت‌کننده" },
    { name: "سطح حقوقی امضا صادقانه اعلام می‌شود", pass: signatureTierExplanation().some((line) => line.includes("گواهی")), detail: "امضای مطمئن نیازمند CA معرفی شده است" },
  ];
}
