import { useEffect, useMemo, useState } from "react";
import {
  X,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  FileText,
  Gauge,
  Info,
  Package,
  Plus,
  Printer,
  Receipt,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  Wallet,
  Wheat,
} from "lucide-react";
import { cn } from "../utils/cn";
import {
  addJalaliMonths,
  formatJalali,
  formatNumber,
  numberToPersianWords,
  toEnglishDigits,
  toPersianDigits,
  todayJalali,
  type JDate,
} from "../lib/format";
import {
  PAYMENT_METHOD_LABELS,
  PRODUCT_PROFILES,
  calculateTrade,
  makeTradeSerial,
  tradeBalance,
  type CropTrade,
  type CostInput,
  type PaymentMethod,
  type ProductId,
  type QualityInput,
  type TradeResult,
  type TradeWarning,
} from "../lib/trade";
import { makeDocument, type DocumentKind, type DocumentSpec } from "../lib/documents";
import { AmountField, SegmentedOptions, SelectField, TextField } from "../components/FormControls";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { Modal, Toast } from "../components/ui";
import { useProfile } from "../lib/profile";


type Tab = "calc" | "list" | "standards";
type Step = 1 | 2 | 3 | 4;

interface FormState {
  productId: ProductId | null;
  buyerName: string;
  buyerType: string;
  buyerNationalId: string;
  buyerAddress: string;
  farmTitle: string;
  date: JDate;
  grossKg: number;
  tareKg: number;
  moisture: number;
  usefulLossPercent: number;
  nonUsefulLossPercent: number;
  impurity: number;
  sprouted: number;
  broken: number;
  hectoliter: number;
  protein: number;
  unitPrice: number;
  transport: number;
  loading: number;
  commissionRate: number;
  insurance: number;
  delayPenalty: number;
  other: number;
  taxExempt: boolean;
  taxRate: number;
  paymentMethod: PaymentMethod;
  paid: number;
  chequeNo: string;
  dueDate: JDate;
  notes: string;
  vehiclePlate: string;
  driverName: string;
  driverPhone: string;
  weighbridgeNo: string;
}

const BUYER_TYPES = [
  "کارخانه آرد", "سیلو", "انبار غله", "دامداری", "مرغداری", "کارخانه روغن‌کشی", "کارخانه قند", "کارخانه نشاسته",
  "کارخانه خوراک دام", "بازار محلی", "میوه‌فروشی", "سردخانه", "تعاونی روستایی", "صادرکننده", "واسطه / دلال", "سایر",
];

const QUALITY_PRESETS: { label: string; patch: Partial<FormState>; hint: string }[] = [
  {
    label: "کیفیت درجه یک",
    hint: "هکتولیتر ≥۷۸ · پروتئین ≥۱۲٫۵",
    patch: { moisture: 13.2, hectoliter: 79, protein: 12.9, sprouted: 0.2, broken: 1.2, impurity: 0.6, usefulLossPercent: 3, nonUsefulLossPercent: 1 },
  },
  {
    label: "کیفیت متوسط",
    hint: "هکتولیتر ۷۵ تا ۷۸",
    patch: { moisture: 15.2, hectoliter: 76.5, protein: 12.1, sprouted: 0.6, broken: 2.2, impurity: 1.1, usefulLossPercent: 3, nonUsefulLossPercent: 1.2 },
  },
  {
    label: "کیفیت پایین",
    hint: "هکتولیتر زیر ۷۵ · رطوبت بالا",
    patch: { moisture: 17, hectoliter: 72.5, protein: 10.8, sprouted: 2.4, broken: 6.2, impurity: 3.4, usefulLossPercent: 4.5, nonUsefulLossPercent: 3.5 },
  },
];

const initialForm: FormState = {
  productId: null,
  buyerName: "",
  buyerType: "",
  buyerNationalId: "",
  buyerAddress: "",
  farmTitle: "",
  date: todayJalali(),
  grossKg: 0,
  tareKg: 0,
  moisture: 0,
  usefulLossPercent: 0,
  nonUsefulLossPercent: 0,
  impurity: 0,
  sprouted: 0,
  broken: 0,
  hectoliter: 0,
  protein: 0,
  unitPrice: 0,
  transport: 0,
  loading: 0,
  commissionRate: 0,
  insurance: 0,
  delayPenalty: 0,
  other: 0,
  taxExempt: true,
  taxRate: 0,
  paymentMethod: "cash",
  paid: 0,
  chequeNo: "",
  dueDate: addJalaliMonths(todayJalali(), 1),
  notes: "",
  vehiclePlate: "",
  driverName: "",
  driverPhone: "",
  weighbridgeNo: "",
};

const fa = (value: number) => toPersianDigits(formatNumber(Math.round(value)));
const money = (value: number) => `${fa(value)} تومان`;
const mass = (value: number) => `${toPersianDigits(formatNumber(Math.round(value * 100) / 100))} کیلو`;

const STATUS_LABELS: Record<CropTrade["status"], string> = {
  draft: "پیش‌نویس",
  confirmed: "ثبت‌شده",
  settled: "تسویه‌شده",
};

function qualityWarnings(result: TradeResult): TradeWarning[] {
  return result.warnings.filter((warning) => warning.severity !== "info");
}

function StepHeader({ current, onStep, canOpen }: { current: Step; onStep: (step: Step) => void; canOpen: (step: Step) => boolean }) {
  const steps: { number: Step; title: string; hint: string }[] = [
    { number: 1, title: "طرفین و محصول", hint: "خریدار، تاریخ، محل" },
    { number: 2, title: "وزن و کیفیت", hint: "باسکول، رطوبت، افت‌ها" },
    { number: 3, title: "قیمت و هزینه", hint: "نرخ، کرایه، مالیات" },
    { number: 4, title: "بازبینی و ثبت", hint: "پرداخت، اسناد" },
  ];
  return (
    <div className="mb-4 grid grid-cols-4 gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1.5">
      {steps.map((step) => {
        const active = current === step.number;
        const done = current > step.number;
        const enabled = canOpen(step.number);
        return (
          <button
            key={step.number}
            type="button"
            disabled={!enabled}
            onClick={() => onStep(step.number)}
            className={cn(
              "rounded-xl px-2 py-2 text-right transition",
              active ? "bg-[#1b3f2e]" : enabled ? "hover:bg-white/[0.04]" : "cursor-not-allowed opacity-45"
            )}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold",
                  active ? "bg-mint-400 text-[#07110d]" : done ? "bg-mint-300/15 text-mint-300" : "border border-[#456254] text-[#78968a]"
                )}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={3} /> : toPersianDigits(step.number)}
              </span>
              <span className={cn("truncate text-[10px] font-medium", active ? "text-white" : "text-[#a9bfb3]")}>{step.title}</span>
            </span>
            <span className="mt-1 hidden truncate pr-6 text-[8px] font-light text-[#708d80] sm:block">{step.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

function CardSection({
  icon,
  title,
  description,
  children,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <section className="border-b border-white/[0.06] px-4 py-4 last:border-0 sm:px-5 sm:py-5">
      <div className="mb-3.5 flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-mint-300/15 bg-mint-300/[0.07] text-mint-300">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[13px] font-semibold text-[#eff8f2]">{title}</h2>
            {badge && <span className="rounded bg-sand-300/10 px-1.5 py-0.5 text-[8px] text-sand-300">{badge}</span>}
          </div>
          {description && <p className="mt-1 text-[9px] font-light leading-5 text-[#78968a]">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function DecimalField({
  label,
  value,
  onChange,
  suffix,
  helper,
  error,
  min = 0,
  max = 100,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix: string;
  helper?: string;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [raw, setRaw] = useState(value ? String(value) : "");
  useEffect(() => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed !== value) {
      setRaw(value ? String(value) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div>
      <div className="label">{label}</div>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          dir="ltr"
          value={raw}
          onChange={(event) => {
            const cleaned = toEnglishDigits(event.target.value)
              .replace(/٫/g, ".")
              .replace(/[^\d.]/g, "");
            const firstDot = cleaned.indexOf(".");
            const normalized = firstDot === -1 ? cleaned : `${cleaned.slice(0, firstDot)}.${cleaned.slice(firstDot + 1).replace(/\./g, "")}`;
            setRaw(normalized);
            if (normalized === "" || normalized === ".") {
              onChange(0);
              return;
            }
            const parsed = Number(normalized);
            if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
          }}
          onBlur={() => {
            if (raw === "" || raw === ".") setRaw("");
          }}
          step={step}
          className={cn("field pl-16 text-right font-medium tabular-nums", error && "field-error")}
          aria-label={label}
        />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 border-r border-white/10 pr-2 text-[9px] text-[#759486]">{suffix}</span>
      </div>
      {error ? <p className="mt-1.5 text-[10px] text-[#ef9c8f]">{error}</p> : helper ? <p className="mt-1 text-[9px] font-light text-[#708d80]">{helper}</p> : null}
    </div>
  );
}

function WarningItem({ warning }: { warning: TradeWarning }) {
  const tone =
    warning.severity === "danger"
      ? "border-[#a25649]/25 bg-[#a25649]/10 text-[#efad9f]"
      : warning.severity === "warning"
        ? "border-sand-300/20 bg-sand-300/[0.07] text-[#e5d3a0]"
        : "border-sky-300/15 bg-sky-300/[0.05] text-[#b3d3de]";
  return (
    <div className={cn("rounded-lg border px-2.5 py-2", tone)}>
      <div className="flex items-start gap-1.5 text-[9px] font-medium leading-5">
        {warning.severity === "danger" ? <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> : <Info className="mt-0.5 h-3 w-3 shrink-0" />}
        <span>{warning.title}</span>
      </div>
      <p className="mt-0.5 pr-4 text-[8px] font-light leading-4 opacity-80">{warning.detail}</p>
    </div>
  );
}

function EmptyTrades({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#355344] bg-white/[0.015] px-5 py-16 text-center">
      <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-mint-300/[0.07] text-mint-300">
        <Scale className="h-7 w-7" />
      </span>
      <p className="text-sm font-semibold text-[#d9e8df]">هنوز معامله‌ای ثبت نشده است</p>
      <p className="mt-1 max-w-sm text-[10px] font-light leading-5 text-[#78968a]">
        با ماشین‌حساب، وزن و کیفیت محموله را وارد کنید تا وزن قابل پرداخت، ارزش، هزینه‌ها و خالص دریافتی محاسبه شود.
      </p>
      <button type="button" onClick={onStart} className="mt-4 rounded-xl bg-mint-400 px-4 py-2.5 text-[10px] font-bold text-[#07110d]">
        شروع محاسبه
      </button>
    </div>
  );
}

export function TradePage({
  trades,
  contacts,
  onSaveTrade,
  onUpdateTrade,
  onDeleteTrade,
  onOpenDocument,
}: {
  trades: CropTrade[];
  contacts: { name: string; phone: string }[];
  onSaveTrade: (trade: CropTrade) => void;
  onUpdateTrade: (id: string, patch: Partial<CropTrade>) => void;
  onDeleteTrade: (id: string) => void;
  onOpenDocument: (spec: DocumentSpec) => void;
}) {
  const { profile: userProfile } = useProfile();
  const [tab, setTab] = useState<Tab>("calc");
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedTrade, setSavedTrade] = useState<CropTrade | null>(null);
  const [settleTrade, setSettleTrade] = useState<CropTrade | null>(null);
  const [settleAmount, setSettleAmount] = useState(0);
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>("bank");
  const [settleCheque, setSettleCheque] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const profile = form.productId ? PRODUCT_PROFILES[form.productId] : PRODUCT_PROFILES.wheat;

  const openTradeDoc = (kind: DocumentKind, trade: CropTrade) => onOpenDocument(makeDocument(kind, { trade }));

  const quality: QualityInput = {
    grossKg: form.grossKg,
    tareKg: form.tareKg,
    moisture: form.moisture,
    usefulLossPercent: form.usefulLossPercent,
    nonUsefulLossPercent: form.nonUsefulLossPercent,
    impurity: form.impurity,
    sprouted: form.sprouted,
    broken: form.broken,
    hectoliter: form.hectoliter,
    protein: form.protein,
  };
  const costs: CostInput = {
    transport: form.transport,
    loading: form.loading,
    commissionRate: form.commissionRate,
    insurance: form.insurance,
    delayPenalty: form.delayPenalty,
    other: form.other,
  };

  const result = useMemo(
    () =>
      calculateTrade({
        productId: form.productId ?? "wheat",
        quality,
        unitPrice: form.unitPrice,
        costs,
        taxExempt: form.taxExempt,
        taxRate: form.taxRate,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form]
  );

  const visibleWarnings = qualityWarnings(result);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const changeProduct = (productId: ProductId) => {
    const nextProfile = PRODUCT_PROFILES[productId];
    setForm((current) => ({
      ...current,
      productId,
      unitPrice: nextProfile.basePrice,
      usefulLossPercent: nextProfile.baseUsefulLoss,
      nonUsefulLossPercent: nextProfile.baseNonUsefulLoss,
      hectoliter: productId === "wheat" ? current.hectoliter || 77 : 0,
      protein: productId === "wheat" ? current.protein || 12 : 0,
    }));
    setErrors({});
  };

  const stepOneValid = () => {
    const next: Record<string, string> = {};
    if (!form.productId) next.productId = "محصول را انتخاب کنید.";
    if (form.buyerName.trim().length < 3) next.buyerName = "نام خریدار یا کارخانه را وارد کنید.";
    if (!form.farmTitle.trim()) next.farmTitle = "عنوان زمین / منشأ محموله را وارد کنید.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const stepTwoValid = () => {
    const next: Record<string, string> = {};
    if (form.grossKg <= 0) next.grossKg = "وزن پر (باسکول اول) را وارد کنید.";
    if (form.tareKg <= 0) next.tareKg = "وزن خالی خودرو را وارد کنید.";
    if (form.tareKg >= form.grossKg) next.tareKg = "وزن خالی باید کمتر از وزن پر باشد.";
    if (form.moisture <= 0) next.moisture = "درصد رطوبت اندازه‌گیری‌شده را وارد کنید.";
    if (form.moisture > 40) next.moisture = "رطوبت بیش از ۴۰٪ معتبر نیست؛ دوباره بررسی کنید.";
    if (form.productId === "wheat" && (form.hectoliter < 50 || form.hectoliter > 90)) next.hectoliter = "وزن هکتولیتر گندم معمولاً بین ۵۰ و ۹۰ است.";
    if (form.productId === "wheat" && (form.protein < 6 || form.protein > 20)) next.protein = "پروتئین را بین ۶ تا ۲۰ درصد وارد کنید.";
    if (form.nonUsefulLossPercent > 20) next.nonUsefulLossPercent = "افت غیرمفید بیش از ۲۰٪ غیرعادی است.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const stepThreeValid = () => {
    const next: Record<string, string> = {};
    if (form.unitPrice <= 0) next.unitPrice = "نرخ هر کیلو را وارد کنید.";
    if (form.commissionRate < 0 || form.commissionRate > 10) next.commissionRate = "کارمزد را بین ۰ تا ۱۰ درصد وارد کنید.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goStep = (target: Step) => {
    if (target === step) return;
    if (step === 1 && target > 1 && !stepOneValid()) return;
    if (step === 2 && target > 2 && !stepTwoValid()) return;
    if (step === 3 && target > 3 && !stepThreeValid()) return;
    setStep(target);
    document.getElementById("trade-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const canOpen = (target: Step) => target <= step || (target === step + 1);

  const saveTrade = () => {
    if (!stepOneValid()) {
      setStep(1);
      return;
    }
    if (!stepTwoValid()) {
      setStep(2);
      return;
    }
    if (!stepThreeValid()) {
      setStep(3);
      return;
    }
    const sequence = trades.filter((trade) => trade.date.jy === form.date.jy && trade.date.jm === form.date.jm && trade.date.jd === form.date.jd).length + 1;
    const created: CropTrade = {
      id: `trade-${Date.now()}`,
      serial: makeTradeSerial(form.date, form.productId ?? "wheat", sequence),
      productId: form.productId ?? "wheat",
      date: form.date,
      createdAt: todayJalali(),
      sellerName: `${userProfile.fullName || "کاربر"}${userProfile.farmName ? ` — ${userProfile.farmName}` : ""}`,
      sellerNationalId: userProfile.nationalId || "—",
      sellerPhone: userProfile.phone || "—",
      buyerName: form.buyerName.trim(),
      buyerNationalId: form.buyerNationalId,
      buyerAddress: form.buyerAddress,
      buyerType: form.buyerType,
      farmTitle: form.farmTitle.trim(),
      vehiclePlate: form.vehiclePlate,
      driverName: form.driverName,
      driverPhone: form.driverPhone,
      weighbridgeNo: form.weighbridgeNo,
      quality,
      unitPrice: form.unitPrice,
      costs,
      taxExempt: form.taxExempt,
      taxRate: form.taxRate,
      paymentMethod: form.paymentMethod,
      chequeNo: form.chequeNo,
      dueDate: form.dueDate,
      paid: Math.min(form.paid, result.netReceipt),
      notes: form.notes,
      status: form.paid >= result.netReceipt && result.netReceipt > 0 ? "settled" : "confirmed",
      result,
    };
    onSaveTrade(created);
    setSavedTrade(created);
    setTab("list");
    setToast("معامله ثبت شد و اسناد آن آماده چاپ است");
  };

  const openSettle = (trade: CropTrade) => {
    setSettleTrade(trade);
    setSettleAmount(tradeBalance(trade).remaining);
    setSettleMethod(trade.paymentMethod);
    setSettleCheque(trade.chequeNo);
  };

  const applySettlement = () => {
    if (!settleTrade) return;
    const balance = tradeBalance(settleTrade);
    const nextPaid = Math.min(balance.paid + Math.max(0, settleAmount), balance.remaining + balance.paid);
    onUpdateTrade(settleTrade.id, {
      paid: nextPaid,
      paymentMethod: settleMethod,
      chequeNo: settleCheque,
      status: nextPaid >= settleTrade.result.netReceipt ? "settled" : "confirmed",
    });
    setSettleTrade(null);
    setToast("پرداخت ثبت و مانده قرارداد به‌روز شد");
  };

  const filteredTrades = trades.filter((trade) => {
    const haystack = `${trade.serial} ${trade.buyerName} ${PRODUCT_PROFILES[trade.productId].name} ${trade.farmTitle}`;
    return haystack.includes(search.trim());
  });

  const totalReceipt = trades.reduce((sum, trade) => sum + trade.result.netReceipt, 0);
  const totalRemaining = trades.reduce((sum, trade) => sum + tradeBalance(trade).remaining, 0);
  const totalPayable = trades.reduce((sum, trade) => sum + trade.result.payableKg, 0);

  return (
    <div className="animate-rise" id="trade-top">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]">
            <Scale className="h-3.5 w-3.5 text-mint-300" />
            معامله و تسویه محصول
            <span className="rounded border border-sand-300/20 bg-sand-300/[0.07] px-1.5 py-0.5 text-[8px] text-sand-300">موتور قطعی v1.0</span>
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">فروش محصول را دقیق حساب کن</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] font-light leading-6 text-[#89a598]">
            از وزن باسکول تا مبلغ نهایی: افت رطوبت، افت مفید و غیرمفید، درجه کیفی، کرایه و کارمزد، مالیات و مانده —
            همه قدم‌به‌قدم و با ردّ محاسبه. مناسب فروش گندم به کارخانه آرد و سیلو.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("standards")}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 py-2.5 text-[9px] text-[#b9cec3] transition hover:text-white"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-mint-300" />
            شرایط و استانداردها
          </button>
          <button
            type="button"
            onClick={() => setTab("list")}
            className="flex items-center gap-1.5 rounded-xl border border-mint-300/20 bg-mint-300/[0.07] px-3 py-2.5 text-[9px] font-medium text-mint-300"
          >
            <Receipt className="h-3.5 w-3.5" />
            معاملات من ({toPersianDigits(trades.length)})
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: "معاملات ثبت‌شده", value: toPersianDigits(trades.length), unit: "محموله", icon: Truck },
          { label: "وزن قابل پرداخت", value: fa(totalPayable), unit: "کیلوگرم", icon: Scale },
          { label: "خالص ارزش معاملات", value: fa(totalReceipt), unit: "تومان", icon: Wallet },
          { label: "مانده دریافتنی", value: fa(totalRemaining), unit: "تومان", icon: Receipt, tone: totalRemaining > 0 ? "sand" : "mint" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="glass rounded-2xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#91ad9f]">{item.label}</span>
                <Icon className={cn("h-3.5 w-3.5", item.tone === "sand" ? "text-sand-300" : "text-mint-300/80")} />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className={cn("truncate text-base font-bold", item.tone === "sand" ? "text-sand-300" : "text-[#eef8f1]")}>{item.value}</span>
                <span className="text-[8px] text-[#738f82]">{item.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex w-full max-w-md items-center rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
        {[
          { id: "calc" as Tab, label: "ماشین‌حساب", icon: Calculator },
          { id: "list" as Tab, label: "معاملات و تسویه", icon: Receipt },
          { id: "standards" as Tab, label: "شرایط خرید", icon: ShieldCheck },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] transition",
                tab === item.id ? "bg-[#1d402f] font-medium text-mint-300" : "text-[#819d90] hover:text-[#c4d8cd]"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "calc" && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
          <div className="min-w-0">
            <StepHeader current={step} onStep={goStep} canOpen={canOpen} />
            <article className="glass overflow-visible rounded-[22px]">
              {step === 1 && (
                <>
                  <CardSection icon={<Wheat className="h-4 w-4" />} title="محصول و خریدار" description="محصول را انتخاب کنید تا استاندارد رطوبت، افت و نرخ مرجع همان محصول بارگذاری شود." badge="گام ۱">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(Object.keys(PRODUCT_PROFILES) as ProductId[]).map((id) => {
                        const item = PRODUCT_PROFILES[id];
                        const active = form.productId === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => changeProduct(id)}
                            className={cn(
                              "relative rounded-xl border p-2.5 text-right transition",
                              active ? "border-mint-300/40 bg-mint-300/[0.08]" : "border-[#2b483a] bg-[#081711]/35 hover:border-[#456755]"
                            )}
                          >
                            <span className={cn("mb-1.5 grid h-7 w-7 place-items-center rounded-lg", active ? "bg-mint-300/15 text-mint-300" : "bg-white/[0.04] text-[#8ba598]")}>
                              <Package className="h-3.5 w-3.5" />
                            </span>
                            <span className={cn("block text-[10px] font-medium", active ? "text-mint-300" : "text-[#c7d9cf]")}>{item.name}</span>
                            <span className="mt-0.5 block text-[8px] font-light text-[#6f8c7f]">رطوبت پایه {toPersianDigits(item.baseMoisture)}٪</span>
                            {active && <Check className="absolute left-2 top-2 h-3 w-3 text-mint-300" />}
                          </button>
                        );
                      })}
                    </div>
                    {errors.productId && <p className="mt-2 text-[10px] text-[#ef9c8f]">{errors.productId}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[8px] text-[#8aa79a]">
                      <span>فروشنده (از پروفایل):</span>
                      <span className="text-[#d3e4da]">{userProfile.fullName || "—"}</span>
                      <span className="text-[#4f6b5e]">·</span>
                      <span>{userProfile.phone || "شماره ثبت نشده"}</span>
                      <a href="#profile" className="mr-auto text-mint-300">ویرایش پروفایل</a>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <TextField label="نام خریدار / کارخانه" value={form.buyerName} onChange={(value) => update("buyerName", value)} placeholder="مثلاً کارخانه آرد آذربایجان" icon={<Building2 className="h-3.5 w-3.5 text-[#7fa294]" />} error={errors.buyerName} required suggestions={contacts.map((contact) => contact.name)} />
                      <SelectField label="نوع خریدار" value={form.buyerType} onChange={(value) => update("buyerType", value === "__custom__" ? "" : value)} options={BUYER_TYPES.filter((type) => type !== "سایر").map((type) => ({ value: type, label: type }))} searchable allowCustom customValue={form.buyerType} onCustomChange={(value) => update("buyerType", value)} customPlaceholder="نام نوع خریدار را بنویسید…" />
                      <TextField label="شناسه ملی / اقتصادی خریدار" value={form.buyerNationalId} onChange={(value) => update("buyerNationalId", value)} placeholder="مثلاً ۱۴۰۰۳۲۵۶۷۸۹" numeric />
                      <TextField label="نشانی تحویل" value={form.buyerAddress} onChange={(value) => update("buyerAddress", value)} placeholder="مثلاً شهرک صنعتی، جاده سیلو" />
                      <TextField label="عنوان زمین / منشأ محموله" value={form.farmTitle} onChange={(value) => update("farmTitle", value)} placeholder="مثلاً قطعه شمالی — گندم چمران" error={errors.farmTitle} icon={<Wheat className="h-3.5 w-3.5 text-[#7fa294]" />} required />
                      <JalaliDatePicker label="تاریخ معامله" value={form.date} onChange={(value) => update("date", value)} />
                    </div>
                  </CardSection>
                  <CardSection icon={<Truck className="h-4 w-4" />} title="حمل و باسکول" description="این اطلاعات در قبض باسکول و رسید تحویل چاپ می‌شود." badge="اختیاری">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <TextField label="شماره پلاک خودرو" value={form.vehiclePlate} onChange={(value) => update("vehiclePlate", value)} />
                      <TextField label="نام راننده" value={form.driverName} onChange={(value) => update("driverName", value)} />
                      <TextField label="شماره باسکول" value={form.weighbridgeNo} onChange={(value) => update("weighbridgeNo", value)} />
                    </div>
                  </CardSection>
                </>
              )}

              {step === 2 && (
                <>
                  <CardSection icon={<Scale className="h-4 w-4" />} title="وزن باسکول" description="وزن پر و خالی باید از یک باسکول معتبر و در حضور طرفین ثبت شود." badge="قطعیت بالا">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <AmountField label="وزن کامیون پر (باسکول اول)" value={form.grossKg} onChange={(value) => update("grossKg", value)} suffix="کیلوگرم" error={errors.grossKg} required max={80_000} />
                      <AmountField label="وزن کامیون خالی (تار)" value={form.tareKg} onChange={(value) => update("tareKg", value)} suffix="کیلوگرم" error={errors.tareKg} required max={40_000} />
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-mint-300/15 bg-mint-300/[0.06] px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-[10px] text-[#b5d3c2]"><Scale className="h-3.5 w-3.5 text-mint-300" /> وزن خالص محموله</span>
                      <span className="text-sm font-bold text-mint-300">{mass(result.netKg)}</span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <TextField label="شماره پلاک خودرو" value={form.vehiclePlate} onChange={(value) => update("vehiclePlate", value)} />
                      <TextField label="نام راننده" value={form.driverName} onChange={(value) => update("driverName", value)} />
                      <TextField label="شماره باسکول" value={form.weighbridgeNo} onChange={(value) => update("weighbridgeNo", value)} />
                    </div>
                  </CardSection>

                  <CardSection icon={<Droplets className="h-4 w-4" />} title="رطوبت و افت‌ها" description={`پایه ${profile.name}: رطوبت ${toPersianDigits(profile.baseMoisture)}٪ · افت مفید ${toPersianDigits(profile.baseUsefulLoss)}٪ · افت غیرمفید ${toPersianDigits(profile.baseNonUsefulLoss)}٪`} badge="مطابق استاندارد">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <DecimalField label="رطوبت اندازه‌گیری‌شده" value={form.moisture} onChange={(value) => update("moisture", value)} suffix="درصد" error={errors.moisture} helper={`حداکثر پذیرش: ${toPersianDigits(profile.maxMoisture)}٪`} max={40} />
                      <DecimalField label="افت مفید (پایه قرارداد)" value={form.usefulLossPercent} onChange={(value) => update("usefulLossPercent", value)} suffix="درصد" helper="دانه شکسته، جوانه‌زده قابل مصرف" max={20} />
                      <DecimalField label="افت غیرمفید (پایه)" value={form.nonUsefulLossPercent} onChange={(value) => update("nonUsefulLossPercent", value)} suffix="درصد" error={errors.nonUsefulLossPercent} helper="ناخالصی، کاه، سنگ و مواد خارجی" max={20} />
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <DecimalField label="ناخالصی اندازه‌گیری‌شده" value={form.impurity} onChange={(value) => update("impurity", value)} suffix="درصد" helper="در محاسبه افت غیرمفید لحاظ می‌شود" max={20} />
                      <DecimalField label="سن‌زدگی / جوانه‌زنی" value={form.sprouted} onChange={(value) => update("sprouted", value)} suffix="درصد" max={20} />
                      <DecimalField label="دانه شکسته" value={form.broken} onChange={(value) => update("broken", value)} suffix="درصد" max={20} />
                    </div>
                    {form.productId === "wheat" && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <DecimalField label="وزن هکتولیتر" value={form.hectoliter} onChange={(value) => update("hectoliter", value)} suffix="kg/hl" error={errors.hectoliter} helper="درجه یک ≥۷۸ · درجه دو ≥۷۵ · درجه سه ≥۷۲" max={100} />
                        <DecimalField label="پروتئین دانه" value={form.protein} onChange={(value) => update("protein", value)} suffix="درصد" error={errors.protein} helper="درجه یک ≥۱۲٫۵ · درجه دو ≥۱۱٫۵" max={25} />
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {QUALITY_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, ...preset.patch }))}
                          className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-1.5 text-[9px] text-[#a9c1b5] transition hover:border-mint-300/25 hover:text-mint-300"
                        >
                          <span className="font-medium">{preset.label}</span>
                          <span className="mr-1 text-[8px] font-light text-[#6f8c7f]">{preset.hint}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#071510]/45 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#c9ddd2]">
                          <Gauge className="h-3.5 w-3.5 text-mint-300" />
                          پیش‌بینی درجه کیفی
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[9px] font-bold",
                            result.quality.grade === 1
                              ? "border-mint-400/25 bg-mint-400/10 text-mint-300"
                              : result.quality.grade === 0
                                ? "border-[#a25649]/25 bg-[#a25649]/10 text-[#efad9f]"
                                : "border-sand-300/25 bg-sand-300/[0.08] text-sand-300"
                          )}
                        >
                          {result.quality.label} · ضریب {toPersianDigits(result.quality.factor)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {result.quality.metrics.map((metric) => (
                          <div key={metric.label} className="rounded-lg bg-white/[0.025] px-2 py-1.5">
                            <div className="text-[8px] text-[#78968a]">{metric.label}</div>
                            <div className={cn("mt-0.5 text-[10px] font-semibold", metric.status === "good" ? "text-mint-300" : metric.status === "warn" ? "text-sand-300" : "text-[#efad9f]")}>
                              {metric.value}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[8px] font-light leading-4 text-[#78968a]">{result.quality.limitingFactor}</p>
                    </div>
                  </CardSection>
                </>
              )}

              {step === 3 && (
                <>
                  <CardSection icon={<Wallet className="h-4 w-4" />} title="نرخ خرید" description="نرخ توافقی با خریدار را وارد کنید. نرخ مرجع صرفاً راهنمای شروع است.">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <AmountField label="نرخ هر کیلوگرم" value={form.unitPrice} onChange={(value) => update("unitPrice", value)} suffix="تومان" error={errors.unitPrice} helper={`آخرین نرخ مصوب ${profile.priceYear}: ${fa(profile.basePrice)} تومان — نرخ قرارداد خود را وارد کنید`} required />
                      <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                        <div className="mb-1 text-[9px] text-[#8da89b]">اثر درجه کیفی</div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#a9c1b5]">{result.quality.label}</span>
                          <span className="font-semibold text-mint-300">{money(result.adjustedUnitPrice)} / کیلو</span>
                        </div>
                        <p className="mt-1 text-[8px] font-light text-[#6f8c7f]">پس از اعمال ضریب مدل داخلی {toPersianDigits(result.quality.factor)} روی نرخ واردشده</p>
                      </div>
                    </div>
                  </CardSection>
                  <CardSection icon={<Truck className="h-4 w-4" />} title="هزینه‌های فروشنده" description="کرایه حمل و تخلیه، کارمزد و بیمه از خالص دریافتی کسر می‌شود.">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <AmountField label="کرایه حمل" value={form.transport} onChange={(value) => update("transport", value)} suffix="تومان" />
                      <AmountField label="هزینه تخلیه و بارگیری" value={form.loading} onChange={(value) => update("loading", value)} suffix="تومان" />
                      <DecimalField label="کارمزد / دلالی" value={form.commissionRate} onChange={(value) => update("commissionRate", value)} suffix="درصد" error={errors.commissionRate} helper="از ارزش محصول" max={10} />
                      <AmountField label="بیمه محموله" value={form.insurance} onChange={(value) => update("insurance", value)} suffix="تومان" />
                      <AmountField label="جریمه تأخیر / کسر توافقی" value={form.delayPenalty} onChange={(value) => update("delayPenalty", value)} suffix="تومان" />
                      <AmountField label="سایر هزینه‌ها" value={form.other} onChange={(value) => update("other", value)} suffix="تومان" />
                    </div>
                  </CardSection>
                  <CardSection icon={<ShieldCheck className="h-4 w-4" />} title="مالیات و وضعیت محصول" description="محصولات کشاورزی فرآوری‌نشده با استناد به بند ۱ بند الف ماده ۹ قانون مالیات بر ارزش افزوده ۱۴۰۰ معاف‌اند.">
                    <SegmentedOptions
                      value={form.taxExempt ? "exempt" : "taxable"}
                      onChange={(value) => update("taxExempt", value === "exempt")}
                      options={[
                        { value: "exempt", label: "معاف از مالیات" },
                        { value: "taxable", label: "مشمول مالیات" },
                      ]}
                    />
                    {!form.taxExempt && (
                      <div className="mt-3 sm:max-w-[240px]">
                        <DecimalField label="نرخ مالیات" value={form.taxRate} onChange={(value) => update("taxRate", value)} suffix="درصد" max={30} />
                      </div>
                    )}
                  </CardSection>
                </>
              )}

              {step === 4 && (
                <>
                  <CardSection icon={<ClipboardCheck className="h-4 w-4" />} title="وضعیت پرداخت" description="اگر خریدار بخشی را پرداخته است، همان مبلغ را ثبت کنید تا مانده و سند تسویه درست ساخته شود.">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SelectField
                        label="روش پرداخت"
                        value={form.paymentMethod}
                        onChange={(value) => update("paymentMethod", value as PaymentMethod)}
                        options={(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => ({ value: method, label: PAYMENT_METHOD_LABELS[method] }))}
                      />
                      <AmountField label="مبلغ پرداخت‌شده تا امروز" value={form.paid} onChange={(value) => update("paid", value)} suffix="تومان" max={result.netReceipt} helper={`خالص قابل پرداخت: ${money(result.netReceipt)}`} />
                      {(form.paymentMethod === "cheque" || form.paymentMethod === "bank") && (
                        <TextField label="شماره چک / حواله" value={form.chequeNo} onChange={(value) => update("chequeNo", value)} placeholder="۴۵۲۱۹۸۷" />
                      )}
                      <JalaliDatePicker label="سررسید پرداخت" value={form.dueDate} onChange={(value) => update("dueDate", value)} minDate={form.date} />
                    </div>
                    <div className="mt-3">
                      <TextField label="توضیحات و شرایط توافقی" value={form.notes} onChange={(value) => update("notes", value)} textarea rows={3} hint="این متن در قرارداد فروش محصول چاپ می‌شود." />
                    </div>
                  </CardSection>
                  <CardSection icon={<BadgeCheck className="h-4 w-4" />} title="بازبینی نهایی" description="شماره سریال، تاریخ و همه اعداد یک‌بار دیگر بررسی می‌شوند.">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        ["خریدار", form.buyerName],
                        ["محصول", `${profile.name} — ${form.farmTitle}`],
                        ["تاریخ", formatJalali(form.date, "long")],
                        ["شماره سریال", makeTradeSerial(form.date, form.productId ?? "wheat", trades.length + 1)],
                        ["وزن قابل پرداخت", mass(result.payableKg)],
                        ["درجه کیفی", `${result.quality.label} (ضریب ${toPersianDigits(result.quality.factor)})`],
                        ["خالص دریافتی", money(result.netReceipt)],
                        ["مانده", money(Math.max(0, result.netReceipt - form.paid))],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-start justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                          <span className="text-[9px] text-[#7e9b8e]">{label}</span>
                          <span className="text-left text-[10px] font-medium text-[#dcebe2]">{value}</span>
                        </div>
                      ))}
                    </div>
                    {result.warnings.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {result.warnings.slice(0, 3).map((warning) => <WarningItem key={warning.code} warning={warning} />)}
                      </div>
                    )}
                    <div className="mt-3 rounded-xl border border-sand-300/15 bg-sand-300/[0.05] px-3 py-2.5 text-[9px] font-light leading-5 text-[#d8cba4]">
                      با ثبت معامله، پنج سند آماده چاپ ساخته می‌شود: قرارداد فروش، قبض باسکول، صورتجلسه کیفیت، صورت‌حساب فروش و برگه تسویه.
                      این اسناد داخلی و قابل ارائه‌اند؛ برای اعتبار در برابر اشخاص ثالث، ثبت رسمی لازم است.
                    </div>
                  </CardSection>
                </>
              )}

              <div className="flex flex-wrap items-center gap-2.5 border-t border-white/[0.07] bg-[#0a1913]/70 p-4">
                {step > 1 && (
                  <button type="button" onClick={() => goStep((step - 1) as Step)} className="flex items-center gap-1.5 rounded-xl border border-white/[0.1] px-4 py-2.5 text-[10px] text-[#c7dcd1] transition hover:bg-white/[0.05]">
                    <ArrowRight className="h-3.5 w-3.5" />
                    مرحله قبل
                  </button>
                )}
                {step < 4 ? (
                  <button type="button" onClick={() => goStep((step + 1) as Step)} className="flex items-center gap-1.5 rounded-xl bg-mint-400 px-4 py-2.5 text-[10px] font-bold text-[#07110d] transition hover:bg-mint-300">
                    مرحله بعد
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button type="button" onClick={saveTrade} className="flex items-center gap-1.5 rounded-xl bg-mint-400 px-4 py-2.5 text-[10px] font-bold text-[#07110d] transition hover:bg-mint-300">
                    <Check className="h-3.5 w-3.5" />
                    ثبت معامله و ساخت اسناد
                  </button>
                )}
                <button type="button" onClick={() => setForm(initialForm)} className="px-2 py-2.5 text-[9px] text-[#7e9b8e] transition hover:text-white">
                  بازنشانی فرم
                </button>
                <span className="mr-auto hidden items-center gap-1 text-[8px] text-[#658275] sm:flex">
                  <ShieldCheck className="h-3 w-3" />
                  محاسبه در دستگاه شما انجام می‌شود
                </span>
              </div>
            </article>
          </div>

          <aside className="space-y-3 xl:sticky xl:top-[92px]">
            <div className="glass overflow-hidden rounded-[22px]">
              <div className="border-b border-white/[0.07] bg-gradient-to-br from-[#143326] to-[#0d2119] px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-mint-300/10 text-mint-300"><Calculator className="h-3.5 w-3.5" /></span>
                    <div>
                      <h3 className="text-xs font-semibold text-white">خلاصه زنده محاسبه</h3>
                      <p className="mt-0.5 text-[8px] text-[#7c9b8c]">{profile.name} · {toPersianDigits(profile.baseMoisture)}٪ رطوبت پایه</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-mint-300/20 bg-mint-300/[0.08] px-2 py-0.5 text-[8px] text-mint-300">قطعی</span>
                </div>
              </div>
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between text-[9px]">
                  <span className="text-[#7f9c8e]">وزن خالص باسکول</span>
                  <span className="font-medium text-[#dcebe2]">{mass(result.netKg)}</span>
                </div>
                <div className="mb-1 flex items-center justify-between text-[8px]">
                  <span className="text-[#7f9c8e]">وزن قابل پرداخت</span>
                  <span className={cn("font-semibold", result.quality.grade === 0 ? "text-[#efad9f]" : "text-mint-300")}>{mass(result.payableKg)}</span>
                </div>
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-gradient-to-l from-mint-400 to-[#c4e391]" style={{ width: `${Math.max(2, Math.min(100, result.payableRatio))}%` }} />
                </div>
                <div className="mb-3 rounded-xl border border-white/[0.07] bg-[#071510]/50 p-2.5">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-[#8da89b]">درجه کیفی</span>
                    <span className={cn("font-semibold", result.quality.grade === 1 ? "text-mint-300" : result.quality.grade === 0 ? "text-[#efad9f]" : "text-sand-300")}>{result.quality.label}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[9px]">
                    <span className="text-[#8da89b]">نرخ پس از ضریب</span>
                    <span className="font-medium text-[#dcebe2]">{money(result.adjustedUnitPrice)}</span>
                  </div>
                </div>
                <div className="space-y-1.5 border-t border-white/[0.06] pt-3 text-[9px]">
                  <div className="flex items-center justify-between"><span className="text-[#7f9c8e]">ارزش محصول</span><span className="text-[#dcebe2]">{money(result.grossValue)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-[#7f9c8e]">افت وزن + هزینه‌ها</span><span className="text-[#e0b3a6]">− {money((result.netKg - result.payableKg) * result.adjustedUnitPrice + result.costs.total)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-[#7f9c8e]">مالیات</span><span className="text-[#dcebe2]">{form.taxExempt ? "معاف" : money(result.tax)}</span></div>
                </div>
                <div className="mt-3 rounded-xl border border-mint-300/20 bg-mint-300/[0.07] p-3">
                  <div className="text-[8px] text-[#9fbfae]">خالص دریافتی فروشنده</div>
                  <div className="mt-1 text-lg font-extrabold tracking-tight text-mint-300">{fa(result.netReceipt)} <span className="text-[9px] font-normal text-[#9fbfae]">تومان</span></div>
                  <div className="mt-1 text-[8px] text-[#8ea99a]">{numberToPersianWords(result.netReceipt)} تومان</div>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-lg border border-white/[0.06] px-2.5 py-2 text-[8px]">
                  <span className="text-[#7f9c8e]">نرخ مؤثر هر کیلو</span>
                  <span className="font-semibold text-[#dcebe2]">{money(result.effectivePricePerKg)}</span>
                </div>

                {visibleWarnings.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {visibleWarnings.slice(0, 2).map((warning) => <WarningItem key={warning.code} warning={warning} />)}
                  </div>
                )}

                <button
                  type="button"
                  onClick={saveTrade}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-mint-400 py-2.5 text-[10px] font-bold text-[#07110d] transition hover:bg-mint-300"
                >
                  <FileText className="h-3.5 w-3.5" />
                  ثبت و ساخت اسناد
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium text-[#b9cec3]">
                <Sparkles className="h-3.5 w-3.5 text-sand-300" />
                ردّ حسابرسی
              </div>
              <div className="space-y-2">
                {result.steps.map((item) => (
                  <div key={item.key} className="flex items-start justify-between gap-2 border-b border-white/[0.05] pb-1.5 last:border-0">
                    <div className="min-w-0">
                      <div className="text-[8px] font-medium text-[#aec5b9]">{item.title}</div>
                      <div className="mt-0.5 truncate font-mono text-[7px] text-[#6f8c7f]" dir="rtl">{item.formula}</div>
                    </div>
                    <span className={cn("shrink-0 text-[8px] font-medium", item.effectKg !== undefined ? "text-[#d9c48f]" : item.effectToman !== undefined ? "text-[#d9c48f]" : "text-[#aec5b9]")}>
                      {item.effectKg !== undefined ? `${item.effectKg > 0 ? "+" : ""}${toPersianDigits(formatNumber(item.effectKg))} kg` : item.effectToman !== undefined ? `${item.effectToman > 0 ? "+" : ""}${fa(item.effectToman)}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setTab("standards")} className="mt-3 flex items-center gap-1 text-[8px] text-mint-300">
                دیدن فرمول‌ها و منابع
                <ArrowLeft className="h-3 w-3" />
              </button>
            </div>
          </aside>
        </div>
      )}

      {tab === "list" && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6c897b]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجوی سریال، خریدار یا محصول…" className="field pr-10 text-[11px]" aria-label="جست‌وجوی معامله" />
            </div>
            <button type="button" onClick={() => { setTab("calc"); setStep(1); }} className="flex items-center justify-center gap-1.5 rounded-xl bg-mint-400 px-4 py-2.5 text-[10px] font-bold text-[#07110d]">
              <Plus className="h-3.5 w-3.5" />
              معامله جدید
            </button>
          </div>

          {filteredTrades.length === 0 ? (
            <EmptyTrades onStart={() => { setTab("calc"); setStep(1); }} />
          ) : (
            filteredTrades.map((trade) => {
              const balance = tradeBalance(trade);
              const product = PRODUCT_PROFILES[trade.productId];
              return (
                <article key={trade.id} className="glass overflow-hidden rounded-2xl">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.05] px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-mint-300/15 bg-mint-300/[0.07] text-mint-300">
                        <Wheat className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-[12px] font-semibold text-[#eaf5ee]">{product.name} — {trade.buyerName}</h3>
                          <span className={cn("rounded px-1.5 py-0.5 text-[8px]", trade.status === "settled" ? "bg-mint-300/10 text-mint-300" : trade.status === "draft" ? "bg-white/[0.06] text-[#a8bfb3]" : "bg-sand-300/10 text-sand-300")}>
                            {STATUS_LABELS[trade.status]}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[8px] text-[#7e9b8e]">{trade.serial} · {formatJalali(trade.date, "long")} · {trade.farmTitle}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-[13px] font-bold text-mint-300">{fa(trade.result.netReceipt)} <span className="text-[8px] font-normal text-[#8ea99a]">تومان</span></div>
                      <div className={cn("mt-0.5 text-[8px]", balance.remaining > 0 ? "text-sand-300" : "text-[#8ea99a]")}>
                        {balance.remaining > 0 ? `مانده ${fa(balance.remaining)} تومان` : "تسویه کامل"}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-4">
                    {[
                      ["وزن خالص", mass(trade.result.netKg)],
                      ["قابل پرداخت", mass(trade.result.payableKg)],
                      ["درجه کیفی", `${trade.result.quality.label} · ${toPersianDigits(trade.result.quality.factor)}`],
                      ["نرخ مؤثر", money(trade.result.effectivePricePerKg)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-white/[0.02] px-2 py-1.5">
                        <div className="text-[8px] text-[#78968a]">{label}</div>
                        <div className="mt-0.5 text-[9px] font-medium text-[#d3e4da]">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 pb-2">
                    <div className="mb-1 flex items-center justify-between text-[8px]">
                      <span className="text-[#78968a]">پیشرفت تسویه</span>
                      <span className={balance.status === "settled" ? "text-mint-300" : "text-sand-300"}>{toPersianDigits(balance.ratio)}٪</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className={cn("h-full rounded-full", balance.status === "settled" ? "bg-mint-400" : "bg-sand-300")} style={{ width: `${balance.ratio}%` }} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.05] px-3 py-2.5">
                    <button type="button" onClick={() => openTradeDoc("sale-invoice", trade)} className="flex items-center gap-1 rounded-lg bg-mint-300/[0.08] px-2.5 py-1.5 text-[9px] text-mint-300 transition hover:bg-mint-300/[0.14]">
                      <Receipt className="h-3 w-3" />
                      صورت‌حساب
                    </button>
                    <button type="button" onClick={() => openTradeDoc("sale-contract", trade)} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[9px] text-[#b6ccc0] transition hover:text-white">
                      <FileText className="h-3 w-3" />
                      قرارداد
                    </button>
                    <button type="button" onClick={() => openTradeDoc("weigh-ticket", trade)} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[9px] text-[#b6ccc0] transition hover:text-white">
                      <Scale className="h-3 w-3" />
                      قبض باسکول
                    </button>
                    <button type="button" onClick={() => openTradeDoc("quality-minutes", trade)} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[9px] text-[#b6ccc0] transition hover:text-white">
                      <Gauge className="h-3 w-3" />
                      کیفیت
                    </button>
                    <button type="button" onClick={() => openTradeDoc("settlement", trade)} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[9px] text-[#b6ccc0] transition hover:text-white">
                      <ClipboardCheck className="h-3 w-3" />
                      تسویه
                    </button>
                    <button type="button" onClick={() => openSettle(trade)} disabled={balance.remaining === 0} className="mr-auto flex items-center gap-1 rounded-lg border border-sand-300/20 bg-sand-300/[0.07] px-2.5 py-1.5 text-[9px] text-sand-300 transition hover:bg-sand-300/[0.12] disabled:cursor-not-allowed disabled:opacity-50">
                      <Wallet className="h-3 w-3" />
                      ثبت پرداخت
                    </button>
                    <button type="button" onClick={() => { if (window.confirm(`معامله ${trade.serial} حذف شود؟`)) onDeleteTrade(trade.id); }} className="grid h-7 w-7 place-items-center rounded-lg border border-white/[0.08] text-[#78968a] transition hover:text-[#efad9f]" aria-label="حذف معامله"><X className="h-3 w-3" /></button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {tab === "standards" && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="glass rounded-[22px] p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint-300/[0.08] text-mint-300"><ShieldCheck className="h-4 w-4" /></span>
              <div>
                <h2 className="text-[13px] font-semibold text-white">شرایط خرید گندم — مرور سریع</h2>
                <p className="mt-0.5 text-[8px] text-[#78968a]">بر پایه مصوبه ۱۴۰۵ و رویه مراکز خرید؛ نرخ قرارداد خود را جایگزین کنید.</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                ["رطوبت پایه", "۱۴٪", "رطوبت بیش از پایه با فرمول وزنی کسر می‌شود؛ حد پذیرش ۱۴٪ است."],
                ["افت مفید پایه", "۳٪", "شامل دانه شکسته و جوانه‌زده قابل مصرف؛ در قرارداد خریدار قابل تغییر است."],
                ["افت غیرمفید پایه", "۱٪", "شامل ناخالصی، کاه، سنگ و بذر علف هرز؛ سقف معمول ۷٪."],
                ["افزایش افت", "کاهش قیمت", "هر درصد افت بیشتر، وزن قابل پرداخت و در نتیجه مبلغ را کم می‌کند."],
                ["آخرین نرخ مصوب", "۴۹٬۵۰۰ تومان/کیلو", "مربوط به فصل ۱۴۰۴–۱۴۰۵ با افت ۳+۱؛ نرخ فصل جاری را از ابلاغیه روز جایگزین کنید."],
                ["مالیات", "معاف", "محصول کشاورزی فرآوری‌نشده — بند ۱ جزء الف ماده ۹ قانون مالیات بر ارزش افزوده ۱۴۰۰."],
                ["اسناد لازم", "۵ سند", "قرارداد فروش، قبض باسکول، صورتجلسه کیفیت، صورت‌حساب، تسویه."],
              ].map(([title, value, detail]) => (
                <div key={title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium text-[#d6e7dd]">{title}</span>
                    <span className="shrink-0 rounded bg-mint-300/10 px-2 py-0.5 text-[9px] font-bold text-mint-300">{value}</span>
                  </div>
                  <p className="mt-1 text-[8px] font-light leading-4 text-[#7f9c8e]">{detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-[22px] border border-sand-300/20 bg-gradient-to-br from-[#332e1e] to-[#232418] p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-sand-300" />
                <h2 className="text-[12px] font-semibold text-[#f0ead6]">چک‌لیست پیش از امضای قرارداد فروش</h2>
              </div>
              <ul className="space-y-2 text-[9px] font-light leading-5 text-[#c3bfa6]">
                {[
                  "نرخ روز و شرایط افت را از خریدار کتبی بگیرید و در قرارداد بنویسید.",
                  "شماره باسکول، وزن پر و خالی و راننده را قبل از تخلیه ثبت کنید.",
                  "در نمونه‌برداری حاضر باشید و نمونه کنترلی را نگه دارید.",
                  "مالیات را با وضعیت فرآوری‌نشده بودن محصول تطبیق دهید.",
                  "سررسید، شماره چک و ضمانت پرداخت خریدار را مشخص کنید.",
                  "برای مبالغ بزرگ، قرارداد را با مشاور حقوقی بازبینی کنید.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-[#d8c894]/20 text-[#e5d59f]"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.02] p-4">
              <h2 className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[#dcebe2]"><FileText className="h-4 w-4 text-mint-300" /> منابع و مبنای حقوقی</h2>
              <ul className="space-y-1.5 text-[8px] font-light leading-5 text-[#819d90]">
                <li>• مصوبه شورای قیمت‌گذاری محصولات کشاورزی برای خرید تضمینی گندم ۱۴۰۵ (نرخ پایه ۴۹٬۵۰۰ تومان، افت ۳+۱).</li>
                <li>• آیین‌نامه بند (ب) تبصره (۱۳) قانون بودجه ۱۴۰۴ — خرید تضمینی گندم.</li>
                <li>• استاندارد ملی ایران ۱۰۴۳ (گندم — ویژگی‌ها) و دستورالعمل نمونه‌برداری مراکز خرید.</li>
                <li>• بند ۱ جزء (الف) ماده ۹ قانون مالیات بر ارزش افزوده ۱۴۰۰ — معافیت محصول فرآوری‌نشده.</li>
                <li>• مواد ۱۰، ۱۹۰، ۲۱۹، ۲۲۰، ۳۳۸، ۳۴۸، ۳۶۷ و ۴۲۲ قانون مدنی.</li>
                <li>• این اعداد برای مقایسه و برنامه‌ریزی است؛ سند رسمی خریدار ملاک نهایی است.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <Modal open={Boolean(savedTrade)} onClose={() => setSavedTrade(null)} title="معامله ثبت شد" description="پنج سند این معامله آماده پیش‌نمایش و چاپ است." size="md">
        {savedTrade && (
          <div className="p-5">
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-mint-300/20 bg-mint-300/[0.06] p-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint-400 text-[#07110d]"><CheckCircle2 className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] text-mint-300">{savedTrade.serial}</div>
                <div className="mt-0.5 text-[11px] text-[#e5f2ea]">{savedTrade.buyerName} · {formatJalali(savedTrade.date, "long")}</div>
                <div className="mt-0.5 text-[9px] text-[#9fbfae]">{fa(savedTrade.result.netReceipt)} تومان خالص · {savedTrade.result.quality.label}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { kind: "sale-contract" as DocumentKind, label: "قرارداد فروش" },
                { kind: "sale-invoice" as DocumentKind, label: "صورت‌حساب" },
                { kind: "weigh-ticket" as DocumentKind, label: "قبض باسکول" },
                { kind: "quality-minutes" as DocumentKind, label: "کیفیت" },
                { kind: "settlement" as DocumentKind, label: "تسویه" },
              ].map((doc) => (
                <button
                  key={doc.kind}
                  type="button"
                  onClick={() => {
                    openTradeDoc(doc.kind, savedTrade);
                    setSavedTrade(null);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-[9px] text-[#c3d8cd] transition hover:border-mint-300/25 hover:text-mint-300"
                >
                  <Printer className="h-3 w-3" />
                  {doc.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(settleTrade)}
        onClose={() => setSettleTrade(null)}
        title="ثبت پرداخت جدید"
        description="پرداخت دریافتی از خریدار ثبت و مانده اسناد به‌روز می‌شود."
        size="sm"
      >
        {settleTrade && (
          <div className="space-y-3.5 p-5">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-[10px]">
              <div className="flex justify-between"><span className="text-[#8da89b]">خریدار</span><span className="text-[#dcebe2]">{settleTrade.buyerName}</span></div>
              <div className="mt-1.5 flex justify-between"><span className="text-[#8da89b]">خالص معامله</span><span className="text-[#dcebe2]">{money(settleTrade.result.netReceipt)}</span></div>
              <div className="mt-1.5 flex justify-between"><span className="text-[#8da89b]">مانده فعلی</span><span className="text-sand-300">{money(tradeBalance(settleTrade).remaining)}</span></div>
            </div>
            <AmountField label="مبلغ پرداختی جدید" value={settleAmount} onChange={setSettleAmount} suffix="تومان" max={tradeBalance(settleTrade).remaining} />
            <SelectField label="روش پرداخت" value={settleMethod} onChange={(value) => setSettleMethod(value as PaymentMethod)} options={(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => ({ value: method, label: PAYMENT_METHOD_LABELS[method] }))} />
            {(settleMethod === "cheque" || settleMethod === "bank") && (
              <TextField label="شماره چک / حواله" value={settleCheque} onChange={setSettleCheque} />
            )}
            <button type="button" onClick={applySettlement} className="w-full rounded-xl bg-mint-400 py-2.5 text-[11px] font-bold text-[#07110d]">
              ثبت پرداخت و به‌روزرسانی مانده
            </button>
          </div>
        )}
      </Modal>

      <Toast open={Boolean(toast)} message={toast ?? ""} onClose={() => setToast(null)} />
    </div>
  );
}
