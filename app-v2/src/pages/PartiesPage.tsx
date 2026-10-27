import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  Copy,
  HandCoins,
  Phone,
  Printer,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  Wallet,
} from "lucide-react";
import { cn } from "../utils/cn";
import { formatJalali, numberToPersianWords, toPersianDigits, todayJalali, type JDate } from "../lib/format";
import {
  PAYMENT_METHODS,
  buildLedgerAccountText,
  ledgerTotals,
  partyTotals,
  type DebtParty,
  type LedgerState,
  type PartyKind,
  type PartyPayment,
  type PaymentMethod,
} from "../lib/ledger";
import { AmountField, SelectField, TextField } from "../components/FormControls";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { Avatar, Modal, Toast } from "../components/ui";
import { useProfile } from "../lib/profile";

const fa = (value: number) => toPersianDigits(value.toLocaleString("en-US"));
const money = (value: number) => `${fa(Math.round(value))} تومان`;

type Filter = "all" | PartyKind;

export function PartiesPage({
  ledger,
  onAddParty,
  onUpdateParty,
  onDeleteParty,
  onAddPayment,
  onDeletePayment,
  onPrintParty,
}: {
  ledger: LedgerState;
  onAddParty: (party: DebtParty) => void;
  onUpdateParty: (party: DebtParty) => void;
  onDeleteParty: (id: string) => void;
  onAddPayment: (payment: PartyPayment) => void;
  onDeletePayment: (id: string) => void;
  onPrintParty: (party: DebtParty) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const { profile } = useProfile();
  const [addOpen, setAddOpen] = useState(false);
  const [editParty, setEditParty] = useState<DebtParty | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [settleId, setSettleId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const totals = ledgerTotals(ledger);
  const details = ledger.parties.find((party) => party.id === detailId) ?? null;
  const settlement = ledger.parties.find((party) => party.id === settleId) ?? null;

  const visible = ledger.parties.filter((party) => {
    const matchesFilter = filter === "all" || party.kind === filter;
    const haystack = `${party.name} ${party.phone} ${party.city} ${party.reason}`.trim();
    return matchesFilter && haystack.includes(search.trim());
  });

  const copyStatement = (party: DebtParty) => {
    const text = buildLedgerAccountText(party, ledger.payments);
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setToast("صورتحساب کپی شد و آماده ارسال است");
    window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]">
            <UsersRound className="h-3.5 w-3.5 text-mint-300" />
            دفتر بدهکاران و بستانکاران
            <span className="rounded border border-mint-300/20 bg-mint-300/[0.07] px-1.5 py-0.5 text-[8px] text-mint-300">با دلیل، تاریخ و دفتر معین</span>
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">بدهکار و بستانکار</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] font-light leading-6 text-[#89a598]">
            هر بدهی با نام، مبلغ، <b className="text-[#b9d3c5]">دلیل بدهی</b>، تاریخ ایجاد و سررسید ثبت می‌شود؛ پرداخت‌ها
            جدا ثبت و مانده هر طرف‌حساب خودکار به‌روز می‌شود.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onPrintParty({ id: "all", name: "گزارش بدهکاران و بستانکاران", phone: "", city: "", kind: "debtor", amount: 0, reason: "گزارش کامل دفتر", date: todayJalali(), dueDate: null, note: "", color: "mint" })} className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 py-2.5 text-[9px] text-[#b9cec3]">
            <Printer className="h-3.5 w-3.5" /> چاپ گزارش کل
          </button>
          <button type="button" onClick={() => setAddOpen(true)} className="flex items-center justify-center gap-2 rounded-xl bg-mint-400 px-4 py-2.5 text-[10px] font-bold text-[#07110d] transition hover:bg-mint-300">
            <Plus className="h-3.5 w-3.5" />
            ثبت بدهکار / بستانکار
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: "طلب از بدهکاران", value: money(totals.receivable), note: `${toPersianDigits(totals.debtorCount)} طرف‌حساب`, icon: ArrowDownLeft, tone: "mint" },
          { label: "بدهی به بستانکاران", value: money(totals.payable), note: `${toPersianDigits(totals.creditorCount)} طرف‌حساب`, icon: ArrowUpRight, tone: "sand" },
          { label: "مانده خالص", value: money(Math.abs(totals.net)), note: totals.net >= 0 ? "به نفع شما" : "به زیان شما", icon: Scale, tone: totals.net >= 0 ? "mint" : "rose" },
          { label: "سررسید گذشته", value: money(totals.overdue), note: `پرداخت‌شده: ${money(ledger.payments.reduce((sum, payment) => sum + payment.amount, 0))}`, icon: CalendarDays, tone: totals.overdue > 0 ? "rose" : "mint" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass rounded-2xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#91ad9f]">{stat.label}</span>
                <Icon className={cn("h-3.5 w-3.5", stat.tone === "mint" ? "text-mint-300" : stat.tone === "sand" ? "text-sand-300" : "text-[#efad9f]")} />
              </div>
              <div className={cn("mt-1 truncate text-sm font-bold", stat.tone === "rose" ? "text-[#efad9f]" : stat.tone === "sand" ? "text-sand-300" : "text-[#eef8f1]")}>{stat.value}</div>
              <div className="mt-1 text-[8px] font-light text-[#6f8c7f]">{stat.note}</div>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6c897b]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجوی نام، دلیل بدهی یا شهر…" className="field pr-10 text-[11px]" aria-label="جست‌وجوی طرف‌حساب" />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
          {([["all", "همه"], ["debtor", "بدهکاران"], ["creditor", "بستانکاران"]] as [Filter, string][]).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={cn("rounded-lg px-3 py-2 text-[9px] transition", filter === value ? "bg-[#1d402f] font-medium text-mint-300" : "text-[#7f9b8e] hover:text-white")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((party) => {
          const totalsParty = partyTotals(party, ledger.payments);
          const isDebtor = party.kind === "debtor";
          return (
            <article key={party.id} className="glass flex flex-col rounded-2xl p-4 transition hover:border-mint-300/20">
              <div className="flex items-start gap-2.5">
                <Avatar name={party.name} color={party.color} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h2 className="truncate text-[12px] font-semibold text-[#ebf5ef]">{party.name}</h2>
                    {partyTotals(party, ledger.payments).overdue && <span className="shrink-0 rounded bg-[#a25649]/15 px-1.5 py-0.5 text-[7px] text-[#efad9f]">معوق</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[8px] text-[#78968a]">
                    <span dir="ltr">{party.phone}</span>
                    <span className="h-1 w-1 rounded-full bg-[#4f6b5e]" />
                    {party.city}
                  </div>
                  <span className={cn("mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-medium", isDebtor ? "bg-mint-300/10 text-mint-300" : "bg-sand-300/10 text-sand-300")}>
                    {isDebtor ? <ArrowDownLeft className="h-2.5 w-2.5" /> : <ArrowUpRight className="h-2.5 w-2.5" />}
                    {isDebtor ? "بدهکار به شما" : "شما بدهکار هستید"}
                  </span>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-white/[0.05] bg-[#071510]/45 p-2.5">
                <div className="text-[8px] text-[#78968a]">دلیل / شرح بدهی</div>
                <p className="mt-1 line-clamp-2 min-h-[30px] text-[9px] leading-5 text-[#c5d9cf]">{party.reason || "بدون توضیح"}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-2 text-[8px]">
                  <div><span className="text-[#6f8c7f]">تاریخ ایجاد: </span><span className="text-[#b7cdc1]">{formatJalali(party.date, "short")}</span></div>
                  <div><span className="text-[#6f8c7f]">یادآوری: </span><span className="text-[#b7cdc1]">{party.dueDate ? formatJalali(party.dueDate, "short") : "—"}</span></div>
                </div>
              </div>

              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-[8px] text-[#78968a]">مانده</div>
                  <div className={cn("mt-0.5 text-[13px] font-bold", totalsParty.balance === 0 ? "text-[#8ea99a]" : isDebtor ? "text-mint-300" : "text-sand-300")}>{money(totalsParty.balance)}</div>
                  <div className="mt-0.5 text-[8px] text-[#6f8c7f]">از {money(party.amount)} · پرداخت {toPersianDigits(totalsParty.ratio)}٪</div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setEditParty(party)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] text-[#a8c0b4] transition hover:text-mint-300" aria-label="ویرایش طرف‌حساب"><Check className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setDetailId(party.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] text-[#a8c0b4] transition hover:text-mint-300" aria-label="دفتر معین"><BookOpen className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setSettleId(party.id)} disabled={totalsParty.balance === 0} className="flex items-center gap-1 rounded-lg bg-mint-300/[0.08] px-2 py-2 text-[8px] font-medium text-mint-300 transition hover:bg-mint-300/[0.14] disabled:opacity-40"><Wallet className="h-3 w-3" />پرداخت</button>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className={cn("h-full rounded-full", isDebtor ? "bg-mint-400" : "bg-sand-300")} style={{ width: `${Math.max(2, totalsParty.ratio)}%` }} />
              </div>
            </article>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#355344] bg-white/[0.015] px-5 py-14 text-center">
          <UserRound className="mb-2 h-7 w-7 text-[#6f8e80]" />
          <p className="text-xs text-[#c2d6cb]">طرف‌حسابی با این مشخصات پیدا نشد.</p>
          <button type="button" onClick={() => setAddOpen(true)} className="mt-3 rounded-xl bg-mint-400 px-4 py-2 text-[9px] font-bold text-[#07110d]">ثبت بدهکار / بستانکار</button>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-2.5 text-[9px] font-light leading-5 text-[#738f82]">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-300" />
        بدهکار = طرف‌حسابی که به شما بدهکار است (طلب شما). بستانکار = طرف‌حسابی که شما به او بدهکار هستید (بدهی شما).
        دلیل و تاریخ هر ثبت در دفتر معین و صورتحساب قابل کپی نمایش داده می‌شود.
      </div>

      <AddPartyModal open={addOpen} onClose={() => setAddOpen(false)} nameSuggestions={[profile.fullName, ...ledger.parties.map((party) => party.name)]} phoneSuggestions={[profile.phone, ...ledger.parties.map((party) => party.phone)]} onCreate={(party) => { onAddParty(party); setAddOpen(false); setToast("طرف‌حساب ثبت شد"); }} />
      <AddPartyModal
        open={Boolean(editParty)}
        initial={editParty}
        nameSuggestions={[profile.fullName, ...ledger.parties.map((party) => party.name)]}
        phoneSuggestions={[profile.phone, ...ledger.parties.map((party) => party.phone)]}
        onClose={() => setEditParty(null)}
        onCreate={(party) => {
          onUpdateParty(party);
          setEditParty(null);
          setToast("تغییرات طرف‌حساب ذخیره شد");
        }}
      />

      <Modal open={Boolean(details)} onClose={() => setDetailId(null)} title={details ? `دفتر معین — ${details.name}` : ""} description="گردش کامل بدهی/طلب، دلیل ثبت و پرداخت‌ها" size="lg">
        {details && <PartyLedger party={details} payments={ledger.payments} onCopy={() => copyStatement(details)} copied={copied} onDeletePayment={onDeletePayment} onSettle={() => setSettleId(details.id)} onDelete={() => { onDeleteParty(details.id); setDetailId(null); setToast("طرف‌حساب حذف شد"); }} onPrint={() => { onPrintParty(details); setDetailId(null); }} />}
      </Modal>

      <SettleModal
        party={settlement}
        payments={ledger.payments}
        onClose={() => setSettleId(null)}
        onSubmit={(payment) => {
          onAddPayment(payment);
          setSettleId(null);
          setToast("پرداخت ثبت و مانده به‌روز شد");
        }}
      />

      <Toast open={Boolean(toast)} message={toast ?? ""} onClose={() => setToast(null)} />
    </div>
  );
}

function AddPartyModal({ open, onClose, onCreate, initial, nameSuggestions = [], phoneSuggestions = [] }: { open: boolean; onClose: () => void; onCreate: (party: DebtParty) => void; initial?: DebtParty | null; nameSuggestions?: string[]; phoneSuggestions?: string[] }) {
  const [kind, setKind] = useState<PartyKind>("debtor");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayJalali());
  const [reminder, setReminder] = useState<JDate | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setKind("debtor"); setName(""); setPhone(""); setCity(""); setAmount(0); setReason("");
    setDate(todayJalali()); setReminder(null); setNote(""); setError("");
  };

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setKind(initial.kind); setName(initial.name); setPhone(initial.phone === "—" ? "" : initial.phone);
      setCity(initial.city === "—" ? "" : initial.city); setAmount(initial.amount); setReason(initial.reason);
      setDate(initial.date); setReminder(initial.dueDate); setNote(initial.note); setError("");
      return;
    }
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const submit = () => {
    if (name.trim().length < 3) return setError("نام طرف‌حساب را کامل وارد کنید.");
    if (amount <= 0) return setError("مبلغ بدهی/طلب باید بیشتر از صفر باشد.");
    if (reason.trim().length < 5) return setError("دلیل بدهی/طلب را بنویسید (حداقل ۵ نویسه).");
    const colors: DebtParty["color"][] = ["mint", "sand", "blue", "rose"];
    onCreate({
      id: initial?.id ?? `party-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim() || "—",
      city: city.trim() || "—",
      kind,
      amount,
      reason: reason.trim(),
      date,
      dueDate: reminder,
      note: note.trim(),
      color: colors[Math.floor(Math.random() * colors.length)],
    });
    reset();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "ویرایش بدهکار / بستانکار" : "ثبت بدهکار / بستانکار"} description="نوع، دلیل، تاریخ و مبلغ را دقیق وارد کنید تا دفتر معین درست ساخته شود." size="md">
      <div className="space-y-3.5 p-5">
        <div className="grid grid-cols-2 gap-2">
          {([["debtor", "بدهکار به من", "طلب من از این شخص"], ["creditor", "بستانکار از من", "بدهی من به این شخص"]] as [PartyKind, string, string][]).map(([value, label, hint]) => (
            <button key={value} type="button" onClick={() => setKind(value)} className={cn("rounded-xl border p-3 text-right transition", kind === value ? "-mint" : "", kind === value ? "border-mint-300/40 bg-mint-300/[0.08]" : "border-[#2b483a] hover:border-[#456755]")}>
              <div className="flex items-center gap-1.5">
               {value === "debtor" ? <ArrowDownLeft className={cn("h-3.5 w-3.5", kind === value ? "text-mint-300" : "text-[#7f9b8e]")} /> : <ArrowUpRight className={cn("h-3.5 w-3.5", kind === value ? "text-sand-300" : "text-[#7f9b8e]")} />}
                <span className={cn("text-[11px] font-medium", kind === value ? "text-white" : "text-[#c7d9cf]")}>{label}</span>
              </div>
              <p className="mt-1 text-[8px] font-light text-[#78968a]">{hint}</p>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="نام طرف‌حساب" value={name} onChange={setName} placeholder="مثلاً نهاده‌های زاگرس" required suggestions={nameSuggestions} />
          <TextField label="شماره تماس" value={phone} onChange={setPhone} placeholder="۰۹۱۲۱۲۳۴۵۶۷" numeric suggestions={phoneSuggestions} />
          <TextField label="شهر / روستا" value={city} onChange={setCity} placeholder="پارس‌آباد" />
          <AmountField label="مبلغ اولیه" value={amount} onChange={setAmount} required helper={`${numberToPersianWords(amount)} تومان`} />
          <JalaliDatePicker label="تاریخ ثبت بدهی / طلب" value={date} onChange={setDate} />
        </div>
        <TextField label="دلیل بدهی / طلب" value={reason} onChange={setReason} placeholder="مثلاً خرید ۱۸ کیسه کود اوره — فاکتور ۴۴۸۲" textarea rows={2} required hint="این متن در صورتحساب و دفتر معین نمایش داده می‌شود." />
        <TextField label="یادداشت تکمیلی" value={note} onChange={setNote} placeholder="شماره چک، توافق پرداخت، …" />
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium text-[#c7d9cf]">تاریخ یادآوری پیگیری (اختیاری)</span>
            {reminder && <button type="button" onClick={() => setReminder(null)} className="text-[8px] text-[#efad9f]">حذف</button>}
          </div>
          <p className="mb-2 text-[8px] leading-4 text-[#78968a]">این تاریخ برای آماده‌سازی طلب/بدهی است و ثبت آن اختیاری است. پرداخت با تاریخ خودش ثبت می‌شود.</p>
          {reminder ? <JalaliDatePicker label="تاریخ یادآوری" value={reminder} onChange={(value) => setReminder(value)} minDate={date} quickToday={false} /> : <button type="button" onClick={() => setReminder(todayJalali())} className="rounded-lg border border-mint-300/20 bg-mint-300/[0.06] px-2.5 py-1.5 text-[9px] text-mint-300">تعیین تاریخ یادآوری</button>}
        </div>
        {error && <p className="rounded-lg border border-[#8f4c44]/30 bg-[#8f4c44]/10 px-3 py-2 text-[10px] text-[#f0a59a]">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={submit} className="flex-1 rounded-xl bg-mint-400 py-2.5 text-[11px] font-bold text-[#07110d]">{initial ? "ذخیره تغییرات" : "ثبت طرف‌حساب"}</button>
          <button type="button" onClick={() => { reset(); onClose(); }} className="rounded-xl border border-white/[0.09] px-4 py-2.5 text-[10px] text-[#a9c1b5]">انصراف</button>
        </div>
      </div>
    </Modal>
  );
}

function PartyLedger({ party, payments, onCopy, copied, onDeletePayment, onSettle, onDelete, onPrint }: {
  party: DebtParty;
  payments: PartyPayment[];
  onCopy: () => void;
  copied: boolean;
  onDeletePayment: (id: string) => void;
  onSettle: () => void;
  onDelete: () => void;
  onPrint: () => void;
}) {
  const rows = payments.filter((payment) => payment.partyId === party.id);
  const totals = partyTotals(party, payments);
  return (
    <div className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className={cn("rounded-full px-2.5 py-1 text-[9px]", party.kind === "debtor" ? "bg-mint-300/10 text-mint-300" : "bg-sand-300/10 text-sand-300")}>
          {party.kind === "debtor" ? "بدهکار به شما" : "شما بدهکار هستید"} · {formatJalali(party.date, "long")}
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={onPrint} className="flex items-center gap-1 rounded-lg bg-mint-300/[0.08] px-2.5 py-1.5 text-[8px] text-mint-300">{copied ? <Check className="h-3 w-3" /> : <Printer className="h-3 w-3" />} چاپ / PDF صورتحساب</button>
          <button type="button" onClick={onCopy} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[8px] text-[#b6ccc0]">{copied ? <Check className="h-3 w-3 text-mint-300" /> : <Copy className="h-3 w-3" />} کپی صورتحساب</button>
          <button type="button" onClick={onSettle} disabled={totals.balance === 0} className="flex items-center gap-1 rounded-lg bg-mint-300/[0.08] px-2.5 py-1.5 text-[8px] text-mint-300 disabled:opacity-40"><HandCoins className="h-3 w-3" /> ثبت پرداخت</button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {[["مبلغ اولیه", money(party.amount)], ["پرداخت‌شده", money(totals.paid)], ["مانده", money(totals.balance)]].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
            <div className="text-[8px] text-[#78968a]">{label}</div>
            <div className="mt-1 text-[11px] font-semibold text-[#dcebe2]">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-white/[0.06] bg-[#071510]/40 p-3">
        <div className="text-[8px] text-[#78968a]">دلیل ثبت</div>
        <p className="mt-1 text-[10px] leading-6 text-[#d3e4da]">{party.reason}</p>
        {party.note && <p className="mt-1 text-[8px] font-light text-[#7f9b8e]">یادداشت: {party.note}</p>}
        <div className="mt-2 flex flex-wrap gap-3 text-[8px] text-[#7f9b8e]">
          <span>تاریخ: {formatJalali(party.date, "long")}</span>
          <span>سررسید: {party.dueDate ? formatJalali(party.dueDate, "long") : "ندارد"}</span>
          <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {party.phone}</span>
        </div>
      </div>
      <h3 className="mb-2 mt-4 text-[10px] font-semibold text-[#e3f0e8]">گردش پرداخت‌ها</h3>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#355344] px-3 py-6 text-center text-[9px] text-[#78968a]">هنوز پرداختی ثبت نشده است.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-right">
            <thead><tr className="bg-white/[0.03] text-[8px] text-[#7d9a8d]"><th className="px-2 py-2 font-normal">تاریخ</th><th className="px-2 py-2 font-normal">مبلغ</th><th className="px-2 py-2 font-normal">روش</th><th className="px-2 py-2 font-normal">توضیح</th><th className="px-2 py-2 font-normal" /></tr></thead>
            <tbody>
              {rows.map((payment) => (
                <tr key={payment.id} className="border-t border-white/[0.04] text-[8px]">
                  <td className="px-2 py-2 text-[#b7cdc1]">{formatJalali(payment.date, "short")}</td>
                  <td className="px-2 py-2 font-medium text-[#dcebe2]">{money(payment.amount)}</td>
                  <td className="px-2 py-2 text-[#9fbfae]">{PAYMENT_METHODS[payment.method]}</td>
                  <td className="px-2 py-2 text-[#7f9b8e]">{payment.note || "—"}</td>
                  <td className="px-2 py-2"><button type="button" onClick={() => onDeletePayment(payment.id)} className="text-[#78968a] transition hover:text-[#efad9f]" aria-label="حذف پرداخت"><Trash2 className="h-3 w-3" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" onClick={onDelete} className="mt-3 flex items-center gap-1 text-[8px] text-[#8a6b63] transition hover:text-[#efad9f]"><Trash2 className="h-3 w-3" /> حذف کل طرف‌حساب</button>
    </div>
  );
}

function SettleModal({ party, payments, onClose, onSubmit }: {
  party: DebtParty | null;
  payments: PartyPayment[];
  onClose: () => void;
  onSubmit: (payment: PartyPayment) => void;
}) {
  const remaining = party ? partyTotals(party, payments).balance : 0;
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("bank");
  const [date, setDate] = useState(todayJalali());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setAmount(remaining);
    setError("");
  }, [remaining, party?.id]);

  if (!party) return null;

  const submit = () => {
    if (amount <= 0) return setError("مبلغ پرداخت را وارد کنید.");
    if (amount > remaining) return setError("مبلغ پرداخت از مانده بیشتر است.");
    onSubmit({ id: `pay-${Date.now()}`, partyId: party.id, amount, method, date, note: note.trim() });
    setNote("");
  };

  return (
    <Modal open onClose={onClose} title={`ثبت پرداخت — ${party.name}`} description={`مانده فعلی: ${money(remaining)}`} size="sm">
      <div className="space-y-3.5 p-5">
        <AmountField label="مبلغ پرداخت" value={amount} onChange={setAmount} max={remaining} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="روش پرداخت" value={method} onChange={(value) => setMethod(value as PaymentMethod)} options={Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }))} />
          <JalaliDatePicker label="تاریخ پرداخت" value={date} onChange={setDate} />
        </div>
        <TextField label="توضیح" value={note} onChange={setNote} placeholder="شماره حواله / چک" />
        {error && <p className="rounded-lg border border-[#8f4c44]/30 bg-[#8f4c44]/10 px-3 py-2 text-[10px] text-[#f0a59a]">{error}</p>}
        <button type="button" onClick={submit} className="w-full rounded-xl bg-mint-400 py-2.5 text-[11px] font-bold text-[#07110d]">ثبت پرداخت</button>
      </div>
    </Modal>
  );
}
