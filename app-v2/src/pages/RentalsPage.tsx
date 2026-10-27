import { useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  FileSignature,
  FileText,
  Landmark,
  Printer,
  Receipt,
  Sprout,
  Trash2,
  Wallet,
} from "lucide-react";
import { cn } from "../utils/cn";
import {
  CONTRACT_TYPES,
  type SavedContract,
} from "../lib/data";
import {
  addJalaliMonths,
  formatJalali,
  formatNumber,
  jalaliToDate,
  toPersianDigits,
  todayJalali,
  type JDate,
} from "../lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "../lib/ledger";
import { makeDocument, type DocumentKind, type DocumentSpec } from "../lib/documents";
import { AmountField, SelectField, TextField } from "../components/FormControls";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { Modal, Toast } from "../components/ui";

const fa = (value: number) => toPersianDigits(Math.round(value).toLocaleString("en-US"));
const money = (value: number) => `${fa(value)} تومان`;

export interface RentPaymentRecord {
  id: string;
  contractId: string;
  date: JDate;
  amount: number;
  method: PaymentMethod;
  installmentNo: number;
  note: string;
}

export interface LeaseSignature {
  id: string;
  contractId: string;
  role: "landlord" | "tenant" | "witness";
  signerName: string;
  image: string;
  hash: string;
  date: JDate;
}

const PERIOD_MONTHS: Record<string, number> = { ماهانه: 1, فصلی: 3, "شش‌ماهه": 6, سالانه: 12, "یک‌جا": 0 };

export function leaseSchedule(contract: SavedContract) {
  if (contract.rent <= 0) return [];
  const stepMonths = PERIOD_MONTHS[contract.period] ?? 12;
  const startDate = jalaliToDate(contract.start);
  const endDate = jalaliToDate(contract.end);
  const totalMonths = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (30.44 * 86_400_000)));
  const count = stepMonths === 0 ? 1 : Math.max(1, Math.ceil(totalMonths / stepMonths));
  const amount = Math.round(contract.rent / count);
  return Array.from({ length: count }, (_, index) => ({
    no: index + 1,
    due: stepMonths === 0 ? contract.start : addJalaliMonths(contract.start, index * stepMonths),
    amount: index === count - 1 ? contract.rent - amount * (count - 1) : amount,
  }));
}

function hashSignature(data: string): string {
  let hash = 5381;
  for (let index = 0; index < data.length; index += 7) {
    hash = ((hash << 5) + hash + data.charCodeAt(index)) >>> 0;
  }
  return `S${hash.toString(16).toUpperCase()}`;
}

function SignaturePad({ onSave, defaultName }: { onSave: (data: string, name: string) => void; defaultName: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [name, setName] = useState(defaultName);
  const [empty, setEmpty] = useState(true);

  const position = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    drawing.current = true;
    const point = position(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const point = position(event);
    context.lineTo(point.x, point.y);
    context.strokeStyle = "#123326";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.stroke();
    setEmpty(false);
    event.preventDefault();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#fbfaf4";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
  };

  return (
    <div>
      <div className="label">امضای دستی روی کادر</div>
      <div className="rounded-xl border border-white/[0.1] bg-[#fbfaf4] p-1">
        <canvas
          ref={canvasRef}
          width={640}
          height={180}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={() => { drawing.current = false; }}
          onPointerLeave={() => { drawing.current = false; }}
          className="h-[140px] w-full touch-none rounded-lg"
          aria-label="کادر امضا"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="نام امضاکننده" className="field max-w-[220px] py-2 text-[10px]" />
        <button type="button" onClick={clear} className="rounded-lg border border-white/[0.09] px-2.5 py-2 text-[9px] text-[#a8bfb3]">پاک کردن</button>
        <button
          type="button"
          disabled={empty || name.trim().length < 2}
          onClick={() => {
            const data = canvasRef.current?.toDataURL("image/png") ?? "";
            if (data) onSave(data, name.trim());
          }}
          className="flex items-center gap-1.5 rounded-lg bg-mint-400 px-3 py-2 text-[9px] font-bold text-[#07110d] disabled:opacity-40"
        >
          <FileSignature className="h-3.5 w-3.5" /> ثبت امضا
        </button>
      </div>
      <p className="mt-1 text-[8px] text-[#708d80]">امضا فقط روی همین دستگاه ذخیره می‌شود و «کد اثر» برای تطبیق نسخه‌ها ساخته می‌شود.</p>
    </div>
  );
}

export function RentalsPage({
  contracts,
  payments,
  signatures,
  onAddPayment,
  onDeletePayment,
  onAddSignature,
  onDeleteContract,
  onOpenDocument,
}: {
  contracts: SavedContract[];
  payments: RentPaymentRecord[];
  signatures: LeaseSignature[];
  onAddPayment: (payment: RentPaymentRecord) => void;
  onDeletePayment: (id: string) => void;
  onAddSignature: (signature: LeaseSignature) => void;
  onDeleteContract: (id: string) => void;
  onOpenDocument: (spec: DocumentSpec) => void;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [signRole, setSignRole] = useState<"landlord" | "tenant" | "witness" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending" | "expired">("all");

  const detail = contracts.find((contract) => contract.id === detailId) ?? null;
  const detailPayments = payments.filter((payment) => payment.contractId === detailId);
  const detailSignatures = signatures.filter((signature) => signature.contractId === detailId);
  const schedule = detail ? leaseSchedule(detail) : [];
  const paidTotal = detailPayments.reduce((sum, payment) => sum + payment.amount, 0);

  const totals = useMemo(() => ({
    active: contracts.filter((contract) => contract.status === "active").length,
    income: contracts.filter((contract) => contract.myRole === "landlord").reduce((sum, contract) => sum + contract.rent, 0),
    expense: contracts.filter((contract) => contract.myRole === "tenant").reduce((sum, contract) => sum + contract.rent, 0),
    deposit: contracts.reduce((sum, contract) => sum + contract.deposit, 0),
    paid: payments.reduce((sum, payment) => sum + payment.amount, 0),
  }), [contracts, payments]);

  const openDoc = (contract: SavedContract, kind: DocumentKind) => onOpenDocument(makeDocument(kind, { contract }));

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]">
            <Landmark className="h-3.5 w-3.5 text-mint-300" />
            اجاره ملک کشاورزی
            <span className="rounded border border-mint-300/20 bg-mint-300/[0.07] px-1.5 py-0.5 text-[8px] text-mint-300">اقساط · پرداخت · امضا</span>
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">اجاره و مدیریت موجر/مستاجر</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] font-light leading-6 text-[#89a598]">
            قراردادهای زمین، جدول اقساط، ثبت پرداخت اجاره با رسید قابل چاپ، و امضای موجر/مستاجر/شاهد — همه در یک دفتر.
          </p>
        </div>
        <button type="button" onClick={() => { window.location.hash = "contracts"; }} className="flex items-center justify-center gap-2 rounded-xl bg-mint-400 px-4 py-2.5 text-[10px] font-bold text-[#07110d]">
          <FileText className="h-3.5 w-3.5" />
          قرارداد جدید زمین
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: "اجاره دریافتی (موجر)", value: money(totals.income), icon: Landmark, tone: "mint" },
          { label: "اجاره پرداختی (مستاجر)", value: money(totals.expense), icon: Wallet, tone: "sand" },
          { label: "پرداخت‌شده ثبت‌شده", value: money(totals.paid), icon: Receipt, tone: "mint" },
          { label: "ودیعه‌های نزد طرف‌ها", value: money(totals.deposit), icon: BadgeCheck, tone: "neutral" },
        ].map((stat) => {
          const IconComponent = stat.icon;
          return (
            <div key={stat.label} className="glass rounded-2xl p-3.5">
              <div className="flex items-center justify-between"><span className="text-[9px] text-[#91ad9f]">{stat.label}</span><IconComponent className={cn("h-3.5 w-3.5", stat.tone === "sand" ? "text-sand-300" : "text-mint-300/80")} /></div>
              <div className={cn("mt-1 truncate text-sm font-bold", stat.tone === "sand" ? "text-sand-300" : "text-[#eef8f1]")}>{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="mb-3 flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
        {([["all", "همه"], ["active", "جاری"], ["pending", "در انتظار امضا"], ["expired", "پایان‌یافته"]] as ["all" | "active" | "pending" | "expired", string][]).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setStatusFilter(value)} className={cn("shrink-0 rounded-lg px-3 py-2 text-[9px] transition", statusFilter === value ? "bg-[#1d402f] font-medium text-mint-300" : "text-[#7f9b8e]")}>{label}</button>
        ))}
      </div>

      <div className="space-y-3">
        {contracts.filter((contract) => statusFilter === "all" || contract.status === statusFilter).map((contract) => {
          const contractPayments = payments.filter((payment) => payment.contractId === contract.id);
          const contractSignatures = signatures.filter((signature) => signature.contractId === contract.id);
          const paid = contractPayments.reduce((sum, payment) => sum + payment.amount, 0);
          const scheduleRows = leaseSchedule(contract);
          const isComplete = contractSignatures.some((signature) => signature.role === "landlord") && contractSignatures.some((signature) => signature.role === "tenant");
          const type = CONTRACT_TYPES.find((item) => item.id === contract.type);
          return (
            <article key={contract.id} className="glass overflow-hidden rounded-2xl">
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-mint-300/15 bg-mint-300/[0.07] text-mint-300"><Sprout className="h-4.5 w-4.5" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="truncate text-[12px] font-semibold text-[#eaf5ee]">{contract.landTitle}</h2>
                      <span className={cn("rounded px-1.5 py-0.5 text-[8px]", contract.status === "active" ? "bg-mint-300/10 text-mint-300" : contract.status === "pending" ? "bg-sand-300/10 text-sand-300" : "bg-white/[0.05] text-[#9fb6aa]")}>{contract.status === "active" ? "جاری" : contract.status === "pending" ? "در انتظار" : "پایان‌یافته"}</span>
                      <span className={cn("rounded px-1.5 py-0.5 text-[8px]", isComplete ? "bg-mint-300/10 text-mint-300" : "bg-white/[0.05] text-[#a8bfb3]")}>{isComplete ? "امضا کامل" : "امضا ناقص"}</span>
                    </div>
                    <p className="mt-1 text-[8px] text-[#78968a]">{contract.code} · {type?.label} · {contract.partyName} ({contract.partyRole === "landlord" ? "مالک" : "مستاجر"})</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[8px] text-[#78968a]"><CalendarDays className="h-2.5 w-2.5" /> {formatJalali(contract.start, "long")} تا {formatJalali(contract.end, "long")} · {contract.period}</p>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-[12px] font-bold text-mint-300">{contract.rent ? money(contract.rent) : `${toPersianDigits(contract.cropShare)}٪ سهم محصول`}</div>
                  <div className="mt-0.5 text-[8px] text-[#78968a]">{contract.rent ? `پرداخت ${fa(paid)} از ${fa(contract.rent)}` : "بدون اجاره نقدی"} · ودیعه {money(contract.deposit)}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.05] px-3 py-2.5">
                <button type="button" onClick={() => setDetailId(contract.id)} className="rounded-lg bg-mint-300/[0.08] px-2.5 py-1.5 text-[8px] font-medium text-mint-300">جزئیات، اقساط و امضا</button>
                <button type="button" onClick={() => openDoc(contract, "lease-contract")} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[8px] text-[#b6ccc0]"><Printer className="h-3 w-3" /> قرارداد</button>
                <button type="button" onClick={() => openDoc(contract, "lease-receipt")} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[8px] text-[#b6ccc0]"><Receipt className="h-3 w-3" /> رسید اجاره</button>
                <button type="button" onClick={() => openDoc(contract, "lease-handover")} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[8px] text-[#b6ccc0]"><FileText className="h-3 w-3" /> تحویل زمین</button>
                <button type="button" onClick={() => { if (window.confirm(`قرارداد ${contract.code} حذف شود؟`)) onDeleteContract(contract.id); }} className="mr-auto flex items-center gap-1 rounded-lg border border-[#a25649]/20 px-2.5 py-1.5 text-[8px] text-[#efad9f]"><Trash2 className="h-3 w-3" /> حذف قرارداد</button>
                <span className="text-[8px] text-[#6f8c7f]">{toPersianDigits(scheduleRows.length)} قسط · {toPersianDigits(contractSignatures.length)} امضا</span>
              </div>
            </article>
          );
        })}
      </div>

      {contracts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#355344] px-4 py-12 text-center text-[10px] text-[#78968a]">قراردادی ثبت نشده است. از بخش «قرارداد زمین» اولین قرارداد را بسازید.</div>
      )}

      <Modal open={Boolean(detail)} onClose={() => setDetailId(null)} title={detail ? `اجاره — ${detail.landTitle}` : ""} description={detail ? `${detail.code} · ${detail.partyName}` : ""} size="lg">
        {detail && (
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["اجاره کل", money(detail.rent)], ["ودیعه", money(detail.deposit)], ["پرداخت‌شده", money(paidTotal)], ["مانده اجاره", money(Math.max(0, detail.rent - paidTotal))]].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2"><div className="text-[8px] text-[#78968a]">{label}</div><div className="mt-0.5 text-[10px] font-semibold text-[#dcebe2]">{value}</div></div>
              ))}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[10px] font-semibold text-[#e3f0e8]">جدول اقساط</h3>
                <button type="button" onClick={() => setPayOpen(true)} disabled={detail.rent <= 0} className="flex items-center gap-1 rounded-lg bg-mint-300/[0.08] px-2.5 py-1.5 text-[8px] text-mint-300 disabled:opacity-40"><Wallet className="h-3 w-3" /> ثبت پرداخت اجاره</button>
              </div>
              {schedule.length === 0 ? <p className="rounded-lg border border-dashed border-[#355344] px-3 py-4 text-center text-[9px] text-[#78968a]">این قرارداد اجاره نقدی ندارد (سهم محصول).</p> : (
                <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                  <table className="w-full text-right">
                    <thead><tr className="bg-white/[0.03] text-[8px] text-[#7d9a8d]"><th className="px-2 py-2 font-normal">قسط</th><th className="px-2 py-2 font-normal">سررسید</th><th className="px-2 py-2 font-normal">مبلغ</th><th className="px-2 py-2 font-normal">پرداخت‌شده</th></tr></thead>
                    <tbody>
                      {schedule.map((row) => {
                        const rowPaid = detailPayments.filter((payment) => payment.installmentNo === row.no).reduce((sum, payment) => sum + payment.amount, 0);
                        return (
                          <tr key={row.no} className="border-t border-white/[0.04] text-[8px]">
                            <td className="px-2 py-1.5 text-[#9fbfae]">{toPersianDigits(row.no)}</td>
                            <td className="px-2 py-1.5 text-[#b7cdc1]">{formatJalali(row.due, "long")}</td>
                            <td className="px-2 py-1.5 text-[#d3e4da]">{money(row.amount)}</td>
                            <td className="px-2 py-1.5"><span className={cn(rowPaid >= row.amount ? "text-mint-300" : rowPaid > 0 ? "text-sand-300" : "text-[#7f9b8e]")}>{rowPaid > 0 ? money(rowPaid) : "پرداخت‌نشده"}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-[10px] font-semibold text-[#e3f0e8]">پرداخت‌های ثبت‌شده</h3>
              {detailPayments.length === 0 ? <p className="rounded-lg border border-dashed border-[#355344] px-3 py-3 text-center text-[9px] text-[#78968a]">پرداختی ثبت نشده است.</p> : (
                <div className="space-y-1.5">
                  {detailPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-2.5 py-2 text-[8px]">
                      <span className="text-[#b7cdc1]">{formatJalali(payment.date, "long")} · قسط {toPersianDigits(payment.installmentNo)} · {PAYMENT_METHODS[payment.method]}</span>
                      <span className="text-[#dcebe2]">{money(payment.amount)}</span>
                      <button type="button" onClick={() => onDeletePayment(payment.id)} className="text-[#78968a] hover:text-[#efad9f]" aria-label="حذف پرداخت"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                <h3 className="text-[10px] font-semibold text-[#e3f0e8]">امضاها</h3>
                <div className="flex gap-1.5">
                  {([["landlord", "امضای موجر"], ["tenant", "امضای مستاجر"], ["witness", "امضای شاهد"]] as ["landlord" | "tenant" | "witness", string][]).map(([role, label]) => (
                    <button key={role} type="button" onClick={() => setSignRole(role)} className="rounded-lg border border-white/[0.08] px-2 py-1 text-[8px] text-[#b6ccc0]">{label}</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {detailSignatures.map((signature) => (
                  <div key={signature.id} className="w-[170px] rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
                    <img src={signature.image} alt={`امضای ${signature.signerName}`} className="h-14 w-full rounded bg-white object-contain" />
                    <div className="mt-1.5 text-[8px] font-medium text-[#d3e4da]">{signature.signerName}</div>
                    <div className="text-[7px] text-[#78968a]">{signature.role === "landlord" ? "موجر" : signature.role === "tenant" ? "مستاجر" : "شاهد"} · {formatJalali(signature.date, "short")}</div>
                    <div className="font-mono text-[7px] text-[#6f8c7f]">اثر: {signature.hash}</div>
                  </div>
                ))}
                {detailSignatures.length === 0 && <p className="text-[8px] text-[#78968a]">امضایی ثبت نشده است.</p>}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
              <button type="button" onClick={() => openDoc(detail, "lease-contract")} className="flex items-center gap-1 rounded-lg bg-mint-300/[0.08] px-2.5 py-2 text-[8px] text-mint-300"><Printer className="h-3 w-3" /> چاپ قرارداد</button>
              <button type="button" onClick={() => openDoc(detail, "lease-receipt")} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-2 text-[8px] text-[#b6ccc0]"><Receipt className="h-3 w-3" /> رسید پرداخت</button>
              <button type="button" onClick={() => openDoc(detail, "lease-handover")} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-2 text-[8px] text-[#b6ccc0]"><FileText className="h-3 w-3" /> صورتجلسه تحویل</button>
            </div>
          </div>
        )}
      </Modal>

      {detail && payOpen && (
        <RentPaymentModal
          contract={detail}
          schedule={schedule}
          onClose={() => setPayOpen(false)}
          onSubmit={(payment) => {
            onAddPayment(payment);
            setPayOpen(false);
            setToast("پرداخت اجاره ثبت شد");
          }}
        />
      )}

      {detail && signRole && (
        <Modal open onClose={() => setSignRole(null)} title={`ثبت امضای ${signRole === "landlord" ? "موجر" : signRole === "tenant" ? "مستاجر" : "شاهد"}`} description="با انگشت یا ماوس روی کادر بکشید." size="sm">
          <div className="p-5">
            <SignaturePad
              defaultName={signRole === "witness" ? "" : signRole === "landlord" ? (detail.partyRole === "landlord" ? detail.partyName : "کسب‌وکار من") : (detail.partyRole === "tenant" ? detail.partyName : "کسب‌وکار من")}
              onSave={(image, signerName) => {
                onAddSignature({ id: `sig-${Date.now()}`, contractId: detail.id, role: signRole, signerName: signerName || "امضاکننده", image, hash: hashSignature(image), date: todayJalali() });
                setSignRole(null);
                setToast("امضا ثبت شد");
              }}
            />
          </div>
        </Modal>
      )}

      <Toast open={Boolean(toast)} message={toast ?? ""} onClose={() => setToast(null)} />
    </div>
  );
}

function RentPaymentModal({ contract, schedule, onClose, onSubmit }: { contract: SavedContract; schedule: { no: number; due: JDate; amount: number }[]; onClose: () => void; onSubmit: (payment: RentPaymentRecord) => void }) {
  const [amount, setAmount] = useState(schedule[0]?.amount ?? 0);
  const [installmentNo, setInstallmentNo] = useState(1);
  const [method, setMethod] = useState<PaymentMethod>("bank");
  const [date, setDate] = useState(todayJalali());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (amount <= 0) return setError("مبلغ پرداخت را وارد کنید.");
    onSubmit({ id: `rent-${Date.now()}`, contractId: contract.id, date, amount, method, installmentNo, note: note.trim() });
  };

  return (
    <Modal open onClose={onClose} title={`ثبت پرداخت اجاره — ${contract.code}`} description="پس از ثبت، رسید قابل چاپ ساخته می‌شود." size="sm">
      <div className="space-y-3 p-5">
        <SelectField label="قسط" value={String(installmentNo)} onChange={(value) => { setInstallmentNo(Number(value)); const row = schedule.find((item) => item.no === Number(value)); if (row) setAmount(row.amount); }} options={schedule.map((row) => ({ value: String(row.no), label: `قسط ${toPersianDigits(row.no)} — ${formatJalali(row.due, "long")} — ${formatNumber(row.amount)} تومان` }))} />
        <AmountField label="مبلغ پرداخت" value={amount} onChange={setAmount} required />
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField label="روش پرداخت" value={method} onChange={(value) => setMethod(value as PaymentMethod)} options={Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }))} />
          <JalaliDatePicker label="تاریخ پرداخت" value={date} onChange={setDate} />
        </div>
        <TextField label="توضیح" value={note} onChange={setNote} placeholder="شماره حواله یا چک" />
        {error && <p className="text-[10px] text-[#f0a59a]">{error}</p>}
        <button type="button" onClick={submit} className="w-full rounded-xl bg-mint-400 py-2.5 text-[11px] font-bold text-[#07110d]">ثبت پرداخت</button>
      </div>
    </Modal>
  );
}
