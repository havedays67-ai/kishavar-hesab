import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  BadgeCheck,
  CalendarRange,
  Check,
  ClipboardCheck,
  FileCheck2,
  FilePenLine,
  HandCoins,
  Hash,
  Info,
  LandPlot,
  Leaf,
  MapPinned,
  Ruler,
  ScrollText,
  ShieldCheck,
  FileSignature,
  Sprout,
  UserRound,
  Sparkles,
  UsersRound,
  Droplets,
} from "lucide-react";
import { cn } from "../utils/cn";
import {
  CONTRACT_TYPES,
  CROPS,
  PAYMENT_PERIODS,
  UTILITY_OPTIONS,
  defaultContractDates,
  type ContractTypeId,
  type Party,
  type Role,
  type SavedContract,
} from "../lib/data";
import {
  addJalaliYears,
  formatDuration,
  formatJalali,
  formatNumber,
  jalaliToDate,
  todayJalali,
  toPersianDigits,
  type JDate,
} from "../lib/format";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { AmountField, SelectField, TextField } from "./FormControls";
import { CounterpartyPicker } from "./CounterpartyPicker";
import type { ContractSignature } from "../lib/data";
import { PenLine, RotateCcw } from "lucide-react";
import { Avatar, Modal, Toast } from "./ui";
import { profileDisplayName, useProfile } from "../lib/profile";
import { contractSignatureHash } from "../lib/contracts";
import { signPayloadCrypto } from "../lib/crypto";
import { ContractPreview } from "./ContractPreview";

type Errors = Record<string, string>;

interface ContractFormProps {
  parties: Party[];
  contracts: SavedContract[];
  onCreateParty: (party: Omit<Party, "id">) => Party;
  onCreateContract: (contract: Omit<SavedContract, "id" | "code" | "createdAt">) => SavedContract;
}

function FormSection({
  number,
  title,
  description,
  icon,
  children,
  badge,
}: {
  number: string;
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  badge?: string;
}) {
  return (
    <section className="border-b border-white/[0.06] px-4 py-5 last:border-b-0 sm:px-6 sm:py-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-mint-300/15 bg-mint-300/[0.07] text-mint-300">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[13px] font-semibold text-[#eff8f2] sm:text-sm">{title}</h2>
            <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-light text-[#719082]">بخش {number}</span>
            {badge && (
              <span className="rounded-md border border-sand-300/15 bg-sand-300/[0.06] px-1.5 py-0.5 text-[8px] font-light text-sand-300/85">
                {badge}
              </span>
            )}
          </div>
          {description && <p className="mt-1 text-[10px] font-light leading-5 text-[#78968a]">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function RoleCard({
  active,
  role,
  onClick,
}: {
  active: boolean;
  role: Role;
  onClick: () => void;
}) {
  const tenant = role === "tenant";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-3.5 text-right transition-all sm:p-4",
        active
          ? "border-mint-300/45 bg-gradient-to-br from-[#16382a] to-[#0e281e] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_24px_rgba(0,0,0,0.12)]"
          : "border-[#253f34] bg-[#081711]/30 hover:border-[#3b6250] hover:bg-white/[0.025]"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition",
            active
              ? "border-mint-300/30 bg-mint-300/15 text-mint-300"
              : "border-white/[0.08] bg-white/[0.035] text-[#839e90]"
          )}
        >
          {tenant ? <Sprout className="h-5 w-5" /> : <LandPlot className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cn("text-[12px] font-semibold", active ? "text-[#f2fbf5]" : "text-[#cbdcd2]")}>
              {tenant ? "زمین را اجاره می‌کنم" : "زمین را اجاره می‌دهم"}
            </span>
            {active && <BadgeCheck className="h-3.5 w-3.5 text-mint-300" />}
          </span>
          <span className={cn("mt-1 block text-[10px]", active ? "text-[#9ed7bb]" : "text-[#78968a]")}>
            {tenant ? "من مستاجر هستم" : "من موجر هستم"}
          </span>
          <span className="mt-1.5 block text-[9px] font-light leading-4 text-[#708c7e]">
            {tenant ? "طرف قرارداد: مالک زمین" : "طرف قرارداد: مستاجر و بهره‌بردار"}
          </span>
        </span>
      </div>
      <div
        className={cn(
          "absolute left-3 top-3 grid h-[18px] w-[18px] place-items-center rounded-full border",
          active ? "border-mint-400 bg-mint-400 text-[#07110d]" : "border-[#466153] bg-[#0a1712] text-transparent"
        )}
      >
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </div>
    </button>
  );
}

export function ContractForm({ parties, contracts, onCreateParty, onCreateContract }: ContractFormProps) {
  const { profile } = useProfile();
  const dates = useMemo(() => defaultContractDates(), []);
  const [role, setRole] = useState<Role>("tenant");
  const [myName, setMyName] = useState("");
  const [partyId, setPartyId] = useState("");
  const [contractType, setContractType] = useState<ContractTypeId>("cash");
  const [landTitle, setLandTitle] = useState("");
  const [crop, setCrop] = useState("");
  const [area, setArea] = useState("");
  const [plaque, setPlaque] = useState("");
  const [start, setStart] = useState<JDate>(dates.start);
  const [end, setEnd] = useState<JDate>(dates.end);
  const [rent, setRent] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [period, setPeriod] = useState("سالانه");
  const [cropShare, setCropShare] = useState(0);
  const [waterShare, setWaterShare] = useState("");
  const [utilities, setUtilities] = useState("مستاجر");
  const [obligations, setObligations] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContract, setPreviewContract] = useState<SavedContract | null>(null);
  const [successContract, setSuccessContract] = useState<SavedContract | null>(null);
  const [copied, setCopied] = useState(false);
  const [signatures, setSignatures] = useState<ContractSignature[]>([]);
  const [signRole, setSignRole] = useState<"landlord" | "tenant" | "witness">("tenant");
  const [signerName, setSignerName] = useState("");
  const [signerPhone, setSignerPhone] = useState("");
  const [signatureError, setSignatureError] = useState("");

  const selectedParty = parties.find((party) => party.id === partyId) ?? null;
  const counterpartRole: Role = role === "tenant" ? "landlord" : "tenant";
  const typeInfo = CONTRACT_TYPES.find((type) => type.id === contractType);
  const rentNeeded = contractType === "cash" || contractType === "mixed";
  const shareNeeded = contractType !== "cash";
  const duration = formatDuration(start, end);

  const completedFields = [
    Boolean(selectedParty),
    Boolean(landTitle.trim()),
    Boolean(crop),
    Number(area) > 0,
    Boolean(start),
    Boolean(end),
    rentNeeded ? rent > 0 : cropShare > 0,
    obligations.trim().length > 10,
  ];
  const progress = Math.round((completedFields.filter(Boolean).length / completedFields.length) * 100);

  const clearError = (key: string) => {
    if (!errors[key]) return;
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const updateRole = (nextRole: Role) => {
    setRole(nextRole);
    const nextCounterpartRole = nextRole === "tenant" ? "landlord" : "tenant";
    const stillValid = parties.some((party) => party.id === partyId && party.role === nextCounterpartRole);
    if (!stillValid) {
      setPartyId(parties.find((party) => party.role === nextCounterpartRole)?.id ?? "");
    }
    setErrors((current) => ({ ...current, party: "" }));
  };

  const smartChecks = (() => {
    const checks: { label: string; status: "ok" | "warn" | "bad"; detail: string }[] = [];
    checks.push({ label: "نام طرف اول ثبت شده", status: myName.trim().length >= 3 ? "ok" : "bad", detail: myName.trim() ? `در سند: ${myName.trim()}` : "نام شما در سند خالی است؛ از پروفایل پیشنهاد بگیرید یا دستی بنویسید." });
    checks.push({ label: "طرف دوم انتخاب شده", status: selectedParty ? "ok" : "bad", detail: selectedParty ? `${selectedParty.name} — ${selectedParty.phone}` : "طرف قرارداد را انتخاب کنید." });
    checks.push({ label: "تاریخ و مدت", status: start && end && jalaliToDate(end).getTime() > jalaliToDate(start).getTime() ? "ok" : "bad", detail: `${formatJalali(start, "long")} تا ${formatJalali(end, "long")} (${duration})` });
    if (rentNeeded) {
      const rentPerHa = Number(area) > 0 ? Math.round(rent / Number(area)) : 0;
      const benchmarks = contracts.filter((contract) => contract.rent > 0 && Number(contract.area) > 0 && contract.type !== "share").map((contract) => contract.rent / Number(contract.area));
      const average = benchmarks.length ? benchmarks.reduce((sum, value) => sum + value, 0) / benchmarks.length : 0;
      const deviation = average > 0 ? Math.round(((rentPerHa - average) / average) * 100) : 0;
      checks.push({ label: "اجاره هر هکتار", status: rentPerHa > 0 && (!average || Math.abs(deviation) <= 60) ? "ok" : rentPerHa > 0 ? "warn" : "bad", detail: rentPerHa > 0 ? `${toPersianDigits(formatNumber(rentPerHa))} تومان در هکتار${average ? ` — اختلاف ${toPersianDigits(Math.abs(deviation))}٪ با میانگین قراردادهای شما` : " — هنوز قرارداد مشابه برای مقایسه نیست"}` : "مبلغ اجاره را وارد کنید." });
      if (deposit > 0 && rent > 0) checks.push({ label: "نسبت ودیعه به اجاره", status: deposit > rent * 3 ? "warn" : "ok", detail: deposit > rent * 3 ? "ودیعه بیش از سه برابر اجاره است؛ شرایط استرداد را دقیق بنویسید." : `ودیعه ${toPersianDigits(Math.round((deposit / rent) * 100))}٪ اجاره است.` });
    }
    if (shareNeeded) checks.push({ label: "سهم محصول", status: cropShare > 0 && cropShare < 90 ? "ok" : cropShare >= 90 ? "warn" : "bad", detail: cropShare >= 90 ? "سهم بالای ۹۰٪ برای مالک، تعادل قرارداد را زیر سؤال می‌برد." : cropShare > 0 ? `${toPersianDigits(cropShare)}٪ سهم مالک ثبت شده است.` : "درصد سهم را وارد کنید." });
    const overlapping = contracts.filter((contract) => contract.partyId === partyId && contract.status !== "expired" && jalaliToDate(contract.start).getTime() <= jalaliToDate(end).getTime() && jalaliToDate(contract.end).getTime() >= jalaliToDate(start).getTime());
    checks.push({ label: "تداخل با قرارداد قبلی", status: overlapping.length ? "warn" : "ok", detail: overlapping.length ? `${toPersianDigits(overlapping.length)} قرارداد هم‌زمان با همین طرف‌حساب ثبت شده است: ${overlapping.map((contract) => contract.code).join("، ")}` : "تداخلی با قراردادهای ثبت‌شده این طرف‌حساب پیدا نشد." });
    if (selectedParty) checks.push({ label: "اطلاعات تماس طرف‌حساب", status: selectedParty.phone.replace(/\D/g, "").length >= 8 ? "ok" : "warn", detail: selectedParty.phone ? `تلفن: ${selectedParty.phone}` : "شماره تماس طرف‌حساب خالی است؛ برای دعوت به امضا و پیگیری لازم است." });
    const roles = new Set(signatures.map((signature) => signature.role));
    checks.push({ label: "امضای موجر و مستاجر", status: roles.has("landlord") && roles.has("tenant") ? "ok" : signatures.length ? "warn" : "bad", detail: roles.has("landlord") && roles.has("tenant") ? "هر دو امضای الزامی داخل فرم ثبت شده است." : "برای نهایی‌کردن قرارداد، امضای موجر و مستاجر را در بخش امضای همان فرم ثبت کنید." });
    checks.push({ label: "شرایط و تعهدات", status: obligations.trim().length >= 15 ? "ok" : obligations.trim() ? "warn" : "bad", detail: obligations.trim().length >= 15 ? "شرایط قرارداد نوشته شده است." : "تعهدات و شرایط فسخ را بنویسید تا در سند چاپ شود." });
    return { checks, score: Math.round((checks.filter((check) => check.status === "ok").length / checks.length) * 100) };
  })();

  const buildDraft = (): SavedContract => ({
    id: "preview",
    code: "پیش‌نویس",
    trackingCode: "—",
    myName: myName.trim() || profileDisplayName(profile),
    signatures,
    myRole: role,
    partyId: selectedParty?.id ?? "",
    partyName: selectedParty?.name ?? "طرف قرارداد انتخاب نشده",
    partyRole: counterpartRole,
    landTitle: landTitle.trim() || "—",
    crop: crop || "—",
    type: contractType,
    start,
    end,
    rent,
    deposit,
    period,
    cropShare,
    waterShare,
    utilities,
    obligations,
    area,
    plaque,
    status: "pending",
    createdAt: todayJalali(),
  });

  const validate = (): boolean => {
    const nextErrors: Errors = {};
    if (!myName || myName.trim().length < 3) nextErrors.myName = "نام طرف اول (شما) را وارد کنید.";
    if (!selectedParty) nextErrors.party = "یک طرف قرارداد از فهرست انتخاب کنید.";
    if (landTitle.trim().length < 2) nextErrors.landTitle = "عنوان زمین یا ملک را وارد کنید.";
    if (!crop) nextErrors.crop = "محصول کشت را انتخاب کنید.";
    if (!area || Number(area) <= 0) nextErrors.area = "مساحت معتبر (بیش از صفر) وارد کنید.";
    if (jalaliToDate(end).getTime() <= jalaliToDate(start).getTime()) nextErrors.end = "تاریخ پایان باید بعد از تاریخ شروع باشد.";
    if (rentNeeded && rent <= 0) nextErrors.rent = "برای این نوع قرارداد، مبلغ اجاره را وارد کنید.";
    if (shareNeeded && cropShare <= 0) nextErrors.cropShare = "درصد سهم مالک را بین ۱ تا ۱۰۰ وارد کنید.";
    const signedRoles = new Set(signatures.map((signature) => signature.role));
    if (!signedRoles.has("landlord") || !signedRoles.has("tenant")) nextErrors.signatures = "امضای موجر و مستاجر را پایین همین فرم ثبت کنید.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      window.setTimeout(() => {
        document.querySelector(".field-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validate() || !selectedParty) return;
    const draft = buildDraft();
    const created = onCreateContract({
      ...draft,
      status: "pending",
    });
    setSuccessContract(created);
  };

  const resetForm = () => {
    const freshDates = defaultContractDates();
    setRole("tenant");
    setMyName("");
    setSignatures([]);
    setSignerName("");
    setSignerPhone("");
    setSignatureError("");
    setPartyId("");
    setContractType("cash");
    setLandTitle("");
    setCrop("");
    setArea("");
    setPlaque("");
    setStart(freshDates.start);
    setEnd(freshDates.end);
    setRent(0);
    setDeposit(0);
    setPeriod("سالانه");
    setCropShare(0);
    setWaterShare("");
    setUtilities("مستاجر");
    setObligations("");
    setErrors({});
    setSuccessContract(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_334px]">
        <article className="glass min-w-0 overflow-visible rounded-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-6 sm:py-5">
            <div>
              <div className="flex items-center gap-2">
                <FilePenLine className="h-4 w-4 text-mint-300" />
                <h2 className="text-[15px] font-bold text-white sm:text-base">قرارداد جدید</h2>
                <span className="flex items-center gap-1 rounded-full border border-sand-300/15 bg-sand-300/[0.06] px-2 py-0.5 text-[8px] font-light text-sand-300">
                  <span className="h-1 w-1 rounded-full bg-sand-300" />
                  پیش‌نویس
                </span>
              </div>
              <p className="mt-1 text-[10px] font-light text-[#819f91]">همه‌چیز شفاف؛ طرفین، مدت و مبلغ را یک‌جا مشخص کنید.</p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[9px] text-[#8ba598] transition hover:bg-white/[0.05] hover:text-white"
            >
              پاک کردن فرم
            </button>
          </div>

          <FormSection
            number="۱"
            title="جهت قرارداد و نقش شما"
            description="نقش خودتان را انتخاب کنید؛ فهرست طرف قرارداد به‌صورت خودکار مطابق همان نقش نمایش داده می‌شود."
            icon={<UsersRound className="h-4 w-4" />}
            badge="الزامی"
          >
            <div className="mb-2.5 flex items-center gap-1.5 text-[10px] text-[#a4c0b2]">
              <UserRound className="h-3 w-3 text-[#739384]" />
              جهت قرارداد (نقش من)
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <RoleCard role="tenant" active={role === "tenant"} onClick={() => updateRole("tenant")} />
              <RoleCard role="landlord" active={role === "landlord"} onClick={() => updateRole("landlord")} />
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-mint-300/10 bg-mint-300/[0.035] px-3 py-2.5">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-300" />
              <p className="text-[10px] font-light leading-5 text-[#9bb8aa]">
                {role === "tenant"
                  ? "شما مستاجر هستید و زمین را در اختیار می‌گیرید؛ طرف قرارداد باید مالک زمین (موجر) باشد."
                  : "شما موجر هستید و زمین را در اختیار می‌گذارید؛ طرف قرارداد باید مستاجر یا بهره‌بردار باشد."}
              </p>
            </div>
          </FormSection>

          <FormSection
            number="۲"
            title="نام شما در قرارداد (طرف اول)"
            description="این نام در سربرگ سند و کنار امضای شما چاپ می‌شود. از پروفایل پیشنهاد بگیرید یا دستی وارد کنید."
            icon={<UserRound className="h-4 w-4" />}
            badge="الزامی"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="نام / کسب‌وکار طرف اول" value={myName} onChange={(value) => { setMyName(value); clearError("myName"); }} placeholder="مثلاً علی رضایی یا مزرعه رضایی" suggestions={[profile.fullName, profile.businessName, profile.farmName]} required error={errors.myName} icon={<UserRound className="h-3.5 w-3.5 text-[#7fa294]" />} hint="هر نامی که اینجا بنویسید، در پیش‌نمایش و چاپ همان سند استفاده می‌شود؛ از پروفایل فقط پیشنهاد می‌شود." />
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-[9px] leading-5 text-[#8aa598]">
                <div className="mb-1 font-medium text-[#c7d9cf]">پیشنهادهای پروفایل</div>
                {[profile.fullName, profile.businessName, profile.farmName].filter(Boolean).map((value) => (
                  <button key={value} type="button" onClick={() => { setMyName(value); clearError("myName"); }} className="mb-1 block w-full rounded-lg border border-mint-300/15 bg-mint-300/[0.06] px-2 py-1 text-right text-[9px] text-mint-300">{value}</button>
                ))}
                {!profile.fullName && <a href="#profile" className="text-mint-300">ابتدا پروفایل را کامل کنید ←</a>}
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-white/[0.07] bg-[#071510]/40 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#c7d9cf]"><Sparkles className="h-3.5 w-3.5 text-mint-300" />بررسی هوشمند پیش از امضا</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[8px] font-bold", smartChecks.score >= 85 ? "bg-mint-300/10 text-mint-300" : smartChecks.score >= 60 ? "bg-sand-300/10 text-sand-300" : "bg-[#a25649]/15 text-[#efad9f]")}>{toPersianDigits(smartChecks.score)}٪ آماده</span>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {smartChecks.checks.map((check) => (
                  <div key={check.label} className="flex items-start gap-1.5 rounded-lg bg-white/[0.02] px-2 py-1.5">
                    <span className={cn("mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[7px]", check.status === "ok" ? "bg-mint-300/15 text-mint-300" : check.status === "warn" ? "bg-sand-300/15 text-sand-300" : "bg-[#a25649]/20 text-[#efad9f]")}>{check.status === "ok" ? "✓" : "!"}</span>
                    <span><span className="block text-[8px] font-medium text-[#c7d9cf]">{check.label}</span><span className="mt-0.5 block text-[8px] font-light leading-4 text-[#78968a]">{check.detail}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </FormSection>

          <FormSection
            number="۲"
            title="طرف قرارداد"
            description="یک شخص مشخص از فهرست واجد شرایط را انتخاب کنید یا طرف قرارداد جدید بسازید."
            icon={<UsersRound className="h-4 w-4" />}
            badge="اصلاح نسخه ۱"
          >
            <CounterpartyPicker
              role={role}
              parties={parties}
              selectedId={partyId}
              onSelect={(id) => {
                setPartyId(id);
                clearError("party");
              }}
              onCreateParty={onCreateParty}
            />
            {errors.party && <p className="mt-2 text-[11px] text-[#ef9c8f]">{errors.party}</p>}
          </FormSection>

          <FormSection
            number="۳"
            title="نوع قرارداد و مشخصات زمین"
            description="نوع توافق را انتخاب کنید تا شرایط مالی مناسب همان قرارداد راهنمایی شود."
            icon={<ScrollText className="h-4 w-4" />}
          >
            <div className="label">نوع قرارداد</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CONTRACT_TYPES.map((type) => {
                const selected = type.id === contractType;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setContractType(type.id);
                      if (type.id === "cash") setCropShare(0);
                      else if (cropShare === 0) setCropShare(type.id === "mixed" ? 25 : 40);
                      setErrors((current) => ({ ...current, cropShare: "", rent: "" }));
                    }}
                    aria-pressed={selected}
                    className={cn(
                      "relative rounded-xl border p-2.5 text-right transition",
                      selected
                        ? "border-mint-300/35 bg-mint-300/[0.08]"
                        : "border-[#2b483a] bg-[#081711]/35 hover:border-[#456755] hover:bg-white/[0.025]"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "grid h-4 w-4 shrink-0 place-items-center rounded-full border text-transparent",
                          selected ? "border-mint-400 bg-mint-400 text-[#07110d]" : "border-[#4a6658]"
                        )}
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                      <span className={cn("truncate text-[10px] font-medium", selected ? "text-mint-300" : "text-[#c7d9cf]")}>
                        {type.label}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-white/[0.025] px-2.5 py-2 text-[9px] font-light leading-5 text-[#7f9c8e]">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              {typeInfo?.description}
            </div>

            <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
              <TextField
                label="عنوان ملک / زمین"
                value={landTitle}
                onChange={(value) => {
                  setLandTitle(value);
                  clearError("landTitle");
                }}
                placeholder="مثلاً قطعه شمالی — چشمه"
                icon={<MapPinned className="h-3.5 w-3.5 text-[#7fa294]" />}
                error={errors.landTitle}
                required
              />
              <SelectField
                label="محصول"
                value={CROPS.includes(crop) ? crop : crop ? "__custom__" : ""}
                onChange={(value) => {
                  setCrop(value === "__custom__" ? "" : value);
                  clearError("crop");
                }}
                options={CROPS.filter((item) => item !== "سایر").map((item) => ({ value: item, label: item }))}
                icon={<Leaf className="h-3.5 w-3.5 text-[#7fa294]" />}
                error={errors.crop}
                required
                searchable
                allowCustom
                customValue={CROPS.includes(crop) ? "" : crop}
                onCustomChange={(value) => { setCrop(value); clearError("crop"); }}
                customPlaceholder="نام محصول را بنویسید (مثلاً کینوا)…"
              />
              <TextField
                label="مساحت (هکتار)"
                value={area}
                onChange={(value) => {
                  setArea(value.replace(/[^\d.]/g, ""));
                  clearError("area");
                }}
                placeholder="۱۲٫۵"
                hint="مساحت را به هکتار وارد کنید؛ اعشار مجاز است."
                icon={<Ruler className="h-3.5 w-3.5 text-[#7fa294]" />}
                error={errors.area}
                required
              />
              <TextField
                label="پلاک ثبتی"
                value={plaque}
                onChange={setPlaque}
                placeholder="مثلاً ۱۴۰۲/۸۴"
                hint="اختیاری — برای پیوست سند رسمی."
                icon={<Hash className="h-3.5 w-3.5 text-[#7fa294]" />}
              />
            </div>
          </FormSection>

          <FormSection
            number="۴"
            title="مدت قرارداد"
            description="تاریخ‌ها کاملاً شمسی‌اند و در سند نهایی نیز به همین شکل نمایش داده می‌شوند."
            icon={<CalendarRange className="h-4 w-4" />}
            badge="شمسی"
          >
            <div className="grid gap-3.5 sm:grid-cols-2">
              <JalaliDatePicker
                label="تاریخ شروع"
                value={start}
                onChange={(value) => {
                  setStart(value);
                  if (jalaliToDate(value).getTime() >= jalaliToDate(end).getTime()) {
                    setEnd(addJalaliYears(value, 1));
                  }
                  clearError("end");
                }}
              />
              <JalaliDatePicker
                label="تاریخ پایان"
                value={end}
                minDate={start}
                onChange={(value) => {
                  setEnd(value);
                  clearError("end");
                }}
                error={errors.end}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#2d4a3c] bg-[#081711]/40 px-2.5 py-1.5 text-[9px] text-[#9db7ab]">
                <CalendarRange className="h-3 w-3 text-mint-300" />
                مدت قرارداد: {duration}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-[9px] text-[#79968a]">
                <Check className="h-3 w-3 text-mint-300" />
                تاریخ‌ها به تقویم هجری شمسی
              </span>
            </div>
          </FormSection>

          <FormSection
            number="۵"
            title="شرایط مالی"
            description="مبلغ‌ها به تومان ذخیره می‌شوند؛ ودیعه از اجاره جدا است."
            icon={<HandCoins className="h-4 w-4" />}
          >
            <div className="grid gap-3.5 sm:grid-cols-2">
              <AmountField
                label={contractType === "cash" ? "مبلغ کل اجاره" : "اجاره نقدی"}
                value={rent}
                onChange={(value) => {
                  setRent(value);
                  clearError("rent");
                }}
                required={rentNeeded}
                error={errors.rent}
                helper={`${formatNumber(rent)} تومان در ${period} پرداخت می‌شود`}
              />
              <AmountField
                label="ودیعه قابل استرداد"
                value={deposit}
                onChange={setDeposit}
                placeholder="اختیاری"
                helper="ودیعه پس از تحویل زمین مسترد می‌شود"
              />
              <AmountField
                label="سهم مالک از محصول"
                value={cropShare}
                onChange={(value) => {
                  setCropShare(value);
                  clearError("cropShare");
                }}
                suffix="درصد"
                max={100}
                required={shareNeeded}
                error={errors.cropShare}
                helper="درصد سهم مالک از محصول برداشت‌شده"
              />
              <SelectField
                label="دوره پرداخت"
                value={period}
                onChange={setPeriod}
                options={PAYMENT_PERIODS.map((item) => ({ value: item, label: item }))}
              />
            </div>

            <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
              <TextField
                label="حقابه / سهم آب"
                value={waterShare}
                onChange={setWaterShare}
                placeholder="مثلاً ۶ ساعت در هفته از چاه مشترک"
                icon={<Droplets className="h-3.5 w-3.5 text-[#7fa294]" />}
                hint="مقدار، منبع و برنامه حقابه را مشخص کنید."
              />
              <SelectField
                label="هزینه آب، برق و پمپ بر عهده"
                value={utilities}
                onChange={setUtilities}
                options={UTILITY_OPTIONS.map((item) => ({ value: item, label: item === "مستاجر" ? "مستاجر" : item === "موجر" ? "موجر" : "مشترک" }))}
              />
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[9px] font-light leading-5 text-[#7f9c8e]">
              <ClipboardCheck className="mt-0.5 h-3 w-3 shrink-0 text-sand-300" />
              {role === "tenant"
                ? "اجاره‌ی پرداختی شما به‌عنوان هزینه و ودیعه به‌عنوان دارایی ثبت می‌شود."
                : "اجاره‌ی دریافتی شما به‌عنوان درآمد و ودیعه به‌عنوان بدهی ثبت می‌شود."}
            </div>
          </FormSection>

          <FormSection
            number="۶"
            title="تعهدات و شرایط"
            description="شرایط مهم را بنویسید؛ این متن در پیش‌نویس قرارداد چاپ می‌شود."
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            <TextField
              label="شرایط و تعهدات طرفین"
              value={obligations}
              onChange={setObligations}
              placeholder="مثلاً زمین شخم‌زده تحویل شود؛ تغییر کاربری ممنوع؛ شرایط فسخ…"
              textarea
              rows={4}
              hint={`${toPersianDigits(obligations.length)} نویسه — سند پیش‌نویس است و جایگزین سند رسمی نیست.`}
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {["زمین در وضعیت قابل کشت تحویل شود", "شرایط فسخ یک‌ماهه پیش‌بینی شود", "هزینه انتقال آب با مستاجر است"].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setObligations((current) => `${current}${current.trim() ? " " : ""}${suggestion}.`)}
                  className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[9px] text-[#8ea99c] transition hover:border-mint-300/25 hover:text-mint-300"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </FormSection>

          <FormSection
            number="۷"
            title="امضای الکترونیکی داخل همین قرارداد"
            description="امضای شما به همین سند می‌چسبد و در پیش‌نمایش و چاپ همان قرارداد دیده می‌شود. امضای موجر و مستاجر برای نهایی‌کردن لازم است."
            icon={<FileSignature className="h-4 w-4" />}
            badge="الزامی"
          >
            <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-2.5">
                <SelectField label="نقش امضاکننده" value={signRole} onChange={(value) => { setSignRole(value as "landlord" | "tenant" | "witness"); setSignatureError(""); }} options={[{ value: "landlord", label: `موجر / مالک${role === "landlord" ? " (شما)" : ""}` }, { value: "tenant", label: `مستاجر / بهره‌بردار${role === "tenant" ? " (شما)" : ""}` }, { value: "witness", label: "شاهد (اختیاری)" }]} />
                <TextField label="نام امضاکننده" value={signerName} onChange={setSignerName} placeholder="نام و نام خانوادگی" suggestions={signRole === "landlord" ? [profile.fullName, ...parties.filter((party) => party.role === "landlord").map((party) => party.name)] : [profile.fullName, ...parties.filter((party) => party.role === "tenant").map((party) => party.name)]} required />
                <TextField label="شماره تماس امضاکننده" value={signerPhone} onChange={setSignerPhone} numeric placeholder="۰۹۱۲۱۲۳۴۵۶۷" suggestions={[profile.phone, ...parties.map((party) => party.phone)]} />
                <ContractSignaturePad
                  onSave={(image) => {
                    if (signerName.trim().length < 3) return setSignatureError("نام امضاکننده را کامل وارد کنید.");
                    if (signerPhone.replace(/\D/g, "").length < 8) return setSignatureError("شماره تماس امضاکننده معتبر نیست.");
                    void (async () => {
                    const signature: ContractSignature = {
                      id: `csig-${Date.now()}`,
                      role: signRole,
                      signerName: signerName.trim(),
                      phone: signerPhone,
                      image,
                      hash: contractSignatureHash({ code: myName, role: signRole, signerName, date: `${start.jy}/${start.jm}/${start.jd}` }),
                      signedAt: todayJalali(),
                    };
                    signature.crypto = await signPayloadCrypto(JSON.stringify({ name: signature.signerName, role: signature.role, phone: signature.phone, hash: signature.hash, image }));
                    setSignatures((current) => [...current.filter((row) => row.role !== signRole), signature]);
                    setSignatureError("");
                    })();
                  }}
                />
                {signatureError && <p className="text-[9px] text-[#f0a59a]">{signatureError}</p>}
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-medium text-[#c7d9cf]">امضاهای ثبت‌شده در این سند</span><span className={cn("rounded px-1.5 py-0.5 text-[8px]", signatures.some((s) => s.role === "landlord") && signatures.some((s) => s.role === "tenant") ? "bg-mint-300/10 text-mint-300" : "bg-sand-300/10 text-sand-300")}>{signatures.some((s) => s.role === "landlord") && signatures.some((s) => s.role === "tenant") ? "امضا کامل" : "امضای ناقص"}</span></div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["landlord", "tenant", "witness"] as const).map((signatureRole) => {
                    const signature = signatures.find((row) => row.role === signatureRole);
                    return (
                      <div key={signatureRole} className={cn("rounded-xl border p-2.5", signature ? "border-mint-300/25 bg-mint-300/[0.05]" : "border-dashed border-white/[0.12] bg-white/[0.02]")}>
                        <div className="flex items-center justify-between gap-1"><span className="text-[8px] font-medium text-[#c7d9cf]">{signatureRole === "landlord" ? "موجر / مالک" : signatureRole === "tenant" ? "مستاجر / بهره‌بردار" : "شاهد"}</span>{signature && <button type="button" onClick={() => setSignatures((current) => current.filter((row) => row.id !== signature.id))} className="text-[8px] text-[#efad9f]">حذف</button>}</div>
                        {signature ? <><img src={signature.image} alt={`امضای ${signature.signerName}`} className="mt-1 h-14 w-full rounded bg-white object-contain" /><div className="mt-1 text-[8px] text-[#d3e4da]">{signature.signerName}</div><div className="text-[7px] text-[#78968a]">{formatJalali(signature.signedAt, "long")} · کد اثر {signature.crypto?.keyFingerprint || signature.hash}</div></> : <div className="mt-2 flex h-14 items-center justify-center rounded bg-white/[0.02] text-[8px] text-[#6f8c7f]">هنوز امضا نشده</div>}
                      </div>
                    );
                  })}
                </div>
                {errors.signatures && <p className="mt-2 text-[9px] text-[#f0a59a]">{errors.signatures}</p>}
                <div className="mt-2 rounded-lg border border-[#c5b97f]/20 bg-[#c5b97f]/[0.05] px-2.5 py-2 text-[8px] leading-4 text-[#d7cba1]">این امضا در برنامه و روی این سند به‌صورت الکترونیکی ثبت می‌شود و در چاپ همان سند می‌آید. «امضای الکترونیکی مطمئن» طبق ماده ۱۰ قانون تجارت الکترونیکی به گواهی معتبر مرکز صدور گواهی نیاز دارد؛ برای مبالغ بالا امضای حضوری و ثبت رسمی هم لازم است.</div>
              </div>
            </div>
          </FormSection>

          <div className="flex flex-col gap-3 border-t border-white/[0.07] bg-[#0a1913]/70 p-4 sm:flex-row sm:items-center sm:p-5">
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center justify-center gap-2 rounded-xl bg-mint-400 px-5 py-3 text-xs font-bold text-[#07110d] shadow-[0_8px_24px_rgba(85,201,159,0.14)] transition hover:bg-mint-300 active:scale-[0.99]"
            >
              <FileCheck2 className="h-4 w-4" />
              ثبت قرارداد
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPreviewContract(buildDraft());
                setPreviewOpen(true);
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.025] px-5 py-3 text-xs text-[#c7dcd1] transition hover:border-mint-300/25 hover:bg-white/[0.05] hover:text-white"
            >
              <FilePenLine className="h-4 w-4" />
              پیش‌نمایش سند
            </button>
            <p className="text-[9px] font-light leading-5 text-[#6f8b7e] sm:mr-auto sm:text-left">
              نسخه ۱.۰.۰
              <br />
              تاریخ امروز: {formatJalali(todayJalali(), "long")}
            </p>
          </div>
        </article>

        <aside className="space-y-4 xl:sticky xl:top-[92px]">
          <div className="glass overflow-hidden rounded-[22px]">
            <div className="border-b border-white/[0.07] bg-gradient-to-br from-[#143326] to-[#0d2119] px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-mint-300/10 text-mint-300">
                    <FileCheck2 className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <h3 className="text-xs font-semibold text-white">خلاصه قرارداد</h3>
                    <p className="mt-0.5 text-[8px] text-[#7c9b8c]">پیش‌نمایش زنده</p>
                  </div>
                </div>
                <span className="rounded-full border border-sand-300/20 bg-sand-300/[0.08] px-2 py-0.5 text-[8px] text-sand-300">پیش‌نویس</span>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-center gap-1.5">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-1">
                    <span className="text-[8px] text-[#7a988b]">نقش من</span>
                    <span className="h-1 w-1 rounded-full bg-mint-300/60" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar name="کسب‌وکار من" color="mint" size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-medium text-[#e7f3ec]">کسب‌وکار من</div>
                      <div className="mt-0.5 truncate text-[8px] text-[#83a092]">{role === "tenant" ? "مستاجر" : "موجر"}</div>
                    </div>
                  </div>
                </div>
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[#719082]">
                  <ArrowLeftRight className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-1 text-[8px] text-[#7a988b]">
                    طرف قرارداد
                    <span className="rounded-full bg-mint-300/10 px-1 py-px text-[7px] text-mint-300">
                      {toPersianDigits(parties.filter((party) => party.role === counterpartRole).length)} گزینه
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar name={selectedParty?.name ?? "؟"} color={selectedParty?.color ?? "sand"} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-medium text-[#e7f3ec]">{selectedParty?.name ?? "انتخاب نشده"}</div>
                      <div className="mt-0.5 truncate text-[8px] text-[#83a092]">
                        {counterpartRole === "landlord" ? "مالک زمین" : "بهره‌بردار"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="my-3.5 h-px bg-white/[0.06]" />

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-light text-[#7f9c8e]">نوع قرارداد</span>
                  <span className="text-[10px] font-medium text-[#dcebe2]">{typeInfo?.label}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-light text-[#7f9c8e]">زمین و محصول</span>
                  <span className="truncate text-[10px] font-medium text-[#dcebe2]">{landTitle || "—"} · {crop}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-light text-[#7f9c8e]">مدت</span>
                  <span className="text-[10px] font-medium text-[#dcebe2]">{duration}</span>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-[#071510]/60 p-2.5">
                  <div className="flex items-center justify-between text-[8px] text-[#7f9c8e]">
                    <span>شروع</span>
                    <span>پایان</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[9px] font-medium text-[#d6e9de]">
                    <span>{formatJalali(start, "short")}</span>
                    <ArrowLeft className="h-3 w-3 text-[#526f61]" />
                    <span>{formatJalali(end, "short")}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.06] pt-2.5">
                  <span className="text-[9px] font-light text-[#7f9c8e]">اجاره کل</span>
                  <span className="text-[11px] font-bold text-mint-300">{rent ? `${formatNumber(rent)} تومان` : "سهم محصول"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-light text-[#7f9c8e]">ودیعه</span>
                  <span className="text-[10px] text-[#dcebe2]">{formatNumber(deposit)} تومان</span>
                </div>
                {shareNeeded && (
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-light text-[#7f9c8e]">سهم مالک از محصول</span>
                    <span className="text-[10px] text-sand-300">{toPersianDigits(cropShare)}٪</span>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[8px]">
                  <span className="text-[#7f9c8e]">کامل بودن اطلاعات</span>
                  <span className={cn(progress === 100 ? "text-mint-300" : "text-sand-300")}>{toPersianDigits(progress)}٪</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-gradient-to-l from-mint-400 to-[#b3e3a8] transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-mint-300/25 bg-mint-300/[0.08] py-2.5 text-[10px] font-semibold text-mint-300 transition hover:bg-mint-300/[0.14]"
              >
                <BadgeCheck className="h-3.5 w-3.5" />
                ثبت و ایجاد پیش‌نویس
              </button>
            </div>
          </div>

          <div className="rounded-[20px] border border-[#75964f]/20 bg-gradient-to-br from-[#1b3423]/80 to-[#10251b] p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#b3d693]/10 text-[#c5e6a8]">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div>
                <h3 className="text-[11px] font-semibold text-[#e4f0da]">این بخش اصلاح شد</h3>
                <p className="mt-0.5 text-[8px] text-[#8ea78d]">نسخه ۱.۰.۰ · بدون تغییر شماره نسخه</p>
              </div>
            </div>
            <ul className="space-y-2.5">
              {[
                "هر دو نقش موجر و مستاجر قابل انتخاب است.",
                "حداقل دو طرف قرارداد برای هر نقش نمایش داده می‌شود.",
                "با تغییر نقش، فهرست طرف قرارداد به‌درستی عوض می‌شود.",
                "همه تاریخ‌ها شمسی و مبلغ‌ها با جداکننده هزارگان‌اند.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[9px] font-light leading-5 text-[#bdcdb7]">
                  <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-[#a6d489]/15 text-[#b9df9c]">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-[#b9cec3]">
              <ShieldCheck className="h-3.5 w-3.5 text-mint-300" />
              یادآوری سند
            </div>
            <p className="text-[9px] font-light leading-5 text-[#7f9b8e]">
              ثبت در نرم‌افزار، سند حقوقی رسمی نیست. برای معاملات بلندمدت، پیش‌نویس را با مشاور حقوقی و دفتر اسناد رسمی
              بازبینی کنید.
            </p>
          </div>
        </aside>
      </div>

      <ContractPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        contract={previewContract}
        onCopy={(code) => {
          void navigator.clipboard?.writeText(code);
          setCopied(true);
        }}
      />

      <Modal
        open={Boolean(successContract)}
        onClose={() => setSuccessContract(null)}
        title="قرارداد با موفقیت ثبت شد"
        description="پیش‌نویس قرارداد در فهرست قراردادهای شما ذخیره شد."
        size="sm"
      >
        {successContract && (
          <div className="p-5 sm:p-6">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-mint-300/25 bg-mint-300/10 text-mint-300">
              <BadgeCheck className="h-7 w-7" />
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-center">
              <p className="text-[10px] text-[#83a092]">شماره قرارداد</p>
              <p className="mt-1 text-base font-bold tracking-wide text-white">{successContract.code}</p>
              <div className="my-3 h-px bg-white/[0.06]" />
              <div className="flex items-center justify-center gap-2 text-[10px] text-[#c6d9cf]">
                <span>{successContract.partyName}</span>
                <ArrowLeftRight className="h-3 w-3 text-[#6f8e80]" />
                <span>{successContract.myRole === "tenant" ? "مستاجر" : "موجر"}</span>
              </div>
              <p className="mt-2 text-[9px] font-light text-[#78968a]">
                {formatJalali(successContract.start, "long")} تا {formatJalali(successContract.end, "long")}
              </p>
            </div>
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPreviewContract(successContract);
                  setSuccessContract(null);
                  setPreviewOpen(true);
                }}
                className="flex-1 rounded-xl bg-mint-400 px-4 py-2.5 text-[11px] font-semibold text-[#07110d] transition hover:bg-mint-300"
              >
                مشاهده سند
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 rounded-xl border border-white/[0.1] px-4 py-2.5 text-[11px] text-[#c2d7cc] transition hover:bg-white/[0.05]"
              >
                قرارداد جدید
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Toast
        open={copied}
        message="شماره قرارداد کپی شد"
        detail={previewContract?.code}
        onClose={() => setCopied(false)}
      />
    </>
  );
}


function ContractSignaturePad({ onSave }: { onSave: (image: string) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = ref.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * canvas.width, y: ((event.clientY - rect.top) / rect.height) * canvas.height };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const p = point(event);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#123326";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
    setEmpty(false);
  };
  const clear = () => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#fbfaf4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
  };
  return (
    <div>
      <div className="label"><PenLine className="h-3.5 w-3.5 text-[#7fa294]" />امضای دستی روی کادر همین فرم</div>
      <div className="rounded-xl border border-white/[0.1] bg-[#fbfaf4] p-1">
        <canvas ref={ref} width={640} height={160} onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = false; }} onPointerLeave={() => { drawing.current = false; }} className="h-[120px] w-full touch-none rounded-lg" aria-label="کادر امضای قرارداد" />
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={clear} className="flex items-center gap-1 rounded-lg border border-white/[0.09] px-2.5 py-2 text-[9px] text-[#a8bfb3]"><RotateCcw className="h-3 w-3" /> پاک کردن</button>
        <button type="button" disabled={empty} onClick={() => { const data = ref.current?.toDataURL("image/png") ?? ""; if (data) onSave(data); clear(); }} className="flex items-center gap-1.5 rounded-lg bg-mint-400 px-3 py-2 text-[9px] font-bold text-[#07110d] disabled:opacity-40"><PenLine className="h-3.5 w-3.5" /> ثبت این امضا در سند</button>
      </div>
    </div>
  );
}
