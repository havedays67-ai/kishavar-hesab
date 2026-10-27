import { useMemo, useState, type ReactNode } from "react";
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
  Sparkles,
  Sprout,
  UserRound,
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
import { Avatar, Modal, Toast } from "./ui";
import { ContractPreview } from "./ContractPreview";

type Errors = Record<string, string>;

interface ContractFormProps {
  parties: Party[];
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

export function ContractForm({ parties, onCreateParty, onCreateContract }: ContractFormProps) {
  const dates = useMemo(() => defaultContractDates(), []);
  const [role, setRole] = useState<Role>("tenant");
  const [partyId, setPartyId] = useState(() => parties.find((party) => party.role === "landlord")?.id ?? "");
  const [contractType, setContractType] = useState<ContractTypeId>("cash");
  const [landTitle, setLandTitle] = useState("قطعه شمالی — چشمه");
  const [crop, setCrop] = useState("گندم");
  const [area, setArea] = useState("12.5");
  const [plaque, setPlaque] = useState("۱۴۰۲/۸۴");
  const [start, setStart] = useState<JDate>(dates.start);
  const [end, setEnd] = useState<JDate>(dates.end);
  const [rent, setRent] = useState(360000000);
  const [deposit, setDeposit] = useState(100000000);
  const [period, setPeriod] = useState("ماهانه");
  const [cropShare, setCropShare] = useState(0);
  const [waterShare, setWaterShare] = useState("۶ ساعت در هفته از چاه مشترک");
  const [utilities, setUtilities] = useState("مستاجر");
  const [obligations, setObligations] = useState(
    "بهره‌بردار متعهد است زمین را فقط برای کشت محصول توافق‌شده استفاده کند و پس از برداشت، زمین را در وضعیت قابل کشت تحویل دهد."
  );
  const [errors, setErrors] = useState<Errors>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContract, setPreviewContract] = useState<SavedContract | null>(null);
  const [successContract, setSuccessContract] = useState<SavedContract | null>(null);
  const [copied, setCopied] = useState(false);

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

  const buildDraft = (): SavedContract => ({
    id: "preview",
    code: "پیش‌نویس",
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
    if (!selectedParty) nextErrors.party = "یک طرف قرارداد از فهرست انتخاب کنید.";
    if (landTitle.trim().length < 2) nextErrors.landTitle = "عنوان زمین یا ملک را وارد کنید.";
    if (!crop) nextErrors.crop = "محصول کشت را انتخاب کنید.";
    if (!area || Number(area) <= 0) nextErrors.area = "مساحت معتبر (بیش از صفر) وارد کنید.";
    if (jalaliToDate(end).getTime() <= jalaliToDate(start).getTime()) nextErrors.end = "تاریخ پایان باید بعد از تاریخ شروع باشد.";
    if (rentNeeded && rent <= 0) nextErrors.rent = "برای این نوع قرارداد، مبلغ اجاره را وارد کنید.";
    if (shareNeeded && cropShare <= 0) nextErrors.cropShare = "درصد سهم مالک را بین ۱ تا ۱۰۰ وارد کنید.";
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
    setPartyId(parties.find((party) => party.role === "landlord")?.id ?? "");
    setContractType("cash");
    setLandTitle("قطعه شمالی — چشمه");
    setCrop("گندم");
    setArea("12.5");
    setPlaque("۱۴۰۲/۸۴");
    setStart(freshDates.start);
    setEnd(freshDates.end);
    setRent(360000000);
    setDeposit(100000000);
    setPeriod("ماهانه");
    setCropShare(0);
    setWaterShare("۶ ساعت در هفته از چاه مشترک");
    setUtilities("مستاجر");
    setObligations(
      "بهره‌بردار متعهد است زمین را فقط برای کشت محصول توافق‌شده استفاده کند و پس از برداشت، زمین را در وضعیت قابل کشت تحویل دهد."
    );
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
                value={crop}
                onChange={(value) => {
                  setCrop(value);
                  clearError("crop");
                }}
                options={CROPS.map((item) => ({ value: item, label: item }))}
                icon={<Leaf className="h-3.5 w-3.5 text-[#7fa294]" />}
                error={errors.crop}
                required
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
              placeholder="تعهدات، شرایط فسخ، نحوه تحویل زمین و …"
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
