import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  Check,
  CircleDollarSign,
  CreditCard,
  Landmark,
  Printer,
  Plus,
  Receipt,
  Scale,
  Search,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import { cn } from "../utils/cn";
import { Fingerprint } from "lucide-react";
import { chequeEntity, loanEntity } from "../lib/signable";
import { SignatureDialog } from "../components/SignatureDialog";
import { useSignatures } from "../lib/signatureContext";

import { formatJalali, toPersianDigits, todayJalali } from "../lib/format";
import { formatAmount } from "../lib/money-format";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  chequeTotals,
  financeTotals,
  loanSchedule,
  type Cheque,
  type FinanceEntry,
  type LedgerState,
  type Loan,
  type PaymentMethod,
} from "../lib/ledger";
import { AmountField, SelectField, TextField } from "../components/FormControls";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { Modal, Toast } from "../components/ui";
import { makeDocument } from "../lib/documents";
import { DocumentDialog } from "../components/PrintSheet";

// مبلغ/عدد با ارقام لاتین و جداکنندهٔ هزارگان (یکدست در کل برنامه)
const fa = (value: number) => formatAmount(value, { decimals: 0 });
const money = (value: number) => `${fa(value)} تومان`;
type Tab = "entries" | "cheques" | "loans";

const STATUS_LABELS: Record<Cheque["status"], { label: string; tone: string }> = {
  pending: { label: "در جریان", tone: "text-sand-300 bg-sand-300/10" },
  cleared: { label: "وصول‌شده", tone: "text-mint-300 bg-mint-300/10" },
  bounced: { label: "برگشتی", tone: "text-[#efad9f] bg-[#a25649]/15" },
};

export function FinancePage({
  ledger,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onAddCheque,
  onSetChequeStatus,
  onDeleteCheque,
  onUpdateCheque,
  onSettleCheque,
  onAddLoan,
  onPayLoan,
  onDeleteLoan,
  onPrintReport,
}: {
  ledger: LedgerState;
  onAddEntry: (entry: FinanceEntry) => void;
  onUpdateEntry: (entry: FinanceEntry) => void;
  onDeleteEntry: (id: string) => void;
  onAddCheque: (cheque: Cheque) => void;
  onSetChequeStatus: (id: string, status: Cheque["status"]) => void;
  onDeleteCheque: (id: string) => void;
  onUpdateCheque: (cheque: Cheque) => void;
  onSettleCheque: (id: string, status: Cheque["status"], date: ReturnType<typeof todayJalali>) => void;
  onAddLoan: (loan: Loan) => void;
  onPayLoan: (id: string) => void;
  onDeleteLoan: (id: string) => void;
  onPrintReport: () => void;
}) {
  const [tab, setTab] = useState<Tab>("entries");
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [chequeOpen, setChequeOpen] = useState(false);
  const [editCheque, setEditCheque] = useState<Cheque | null>(null);
  const [printCheque, setPrintCheque] = useState<Cheque | null>(null);
  const [loanOpen, setLoanOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [signTarget, setSignTarget] = useState<{ kind: "cheque"; id: string } | { kind: "loan"; id: string } | null>(null);
  const { audit } = useSignatures();

  const totals = financeTotals(ledger.entries);
  const cheques = chequeTotals(ledger.cheques);
  const filtered = ledger.entries
    .filter((entry) => `${entry.reason} ${entry.category} ${entry.note}`.includes(search.trim()))
    .sort((a, b) => (b.date.jy - a.date.jy) || (b.date.jm - a.date.jm) || (b.date.jd - a.date.jd));

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]">
            <Wallet className="h-3.5 w-3.5 text-mint-300" />
            دفتر مالی مزرعه
            <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] text-[#a8bfb3]">درآمد، هزینه، چک و قسط</span>
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">دفتر مالی</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] font-light leading-6 text-[#89a598]">
            هر دریافت و پرداخت با دلیل، تاریخ، دسته و روش پرداخت ثبت می‌شود. چک‌های دریافتی/پرداختی و اقساط وام هم در
            همین دفتر پیگیری می‌شوند.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onPrintReport} className="flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 py-2.5 text-[9px] text-[#b9cec3]"><Printer className="h-3.5 w-3.5" /> چاپ گزارش</button>
          <button type="button" onClick={() => setEntryOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-mint-400 px-3 py-2.5 text-[9px] font-bold text-[#07110d]"><Plus className="h-3.5 w-3.5" /> ثبت درآمد / هزینه</button>
          <button type="button" onClick={() => setChequeOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 py-2.5 text-[9px] text-[#b9cec3]"><Plus className="h-3.5 w-3.5" /> ثبت چک</button>
          <button type="button" onClick={() => setLoanOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 py-2.5 text-[9px] text-[#b9cec3]"><Plus className="h-3.5 w-3.5" /> ثبت وام</button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: "درآمد ثبت‌شده", value: money(totals.income), icon: ArrowDownLeft, tone: "mint" },
          { label: "هزینه ثبت‌شده", value: money(totals.expense), icon: ArrowUpRight, tone: "sand" },
          { label: "سود / زیان دوره", value: money(totals.profit), icon: Scale, tone: totals.profit >= 0 ? "mint" : "rose" },
          { label: "چک در سررسید نزدیک", value: `${toPersianDigits(cheques.dueSoon)} فقره`, icon: CalendarClock, tone: cheques.dueSoon > 0 ? "rose" : "mint" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass rounded-2xl p-3.5">
              <div className="flex items-center justify-between"><span className="text-[9px] text-[#91ad9f]">{stat.label}</span><Icon className={cn("h-3.5 w-3.5", stat.tone === "mint" ? "text-mint-300" : stat.tone === "sand" ? "text-sand-300" : "text-[#efad9f]")} /></div>
              <div className={cn("mt-1 truncate text-sm font-bold", stat.tone === "rose" ? "text-[#efad9f]" : stat.tone === "sand" ? "text-sand-300" : "text-[#eef8f1]")}>{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex w-full max-w-md items-center rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
        {([["entries", "درآمد و هزینه", Receipt], ["cheques", "چک‌ها", CreditCard], ["loans", "وام و اقساط", Banknote]] as [Tab, string, typeof Receipt][]).map(([value, label, Icon]) => (
          <button key={value} type="button" onClick={() => setTab(value)} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[9px] transition", tab === value ? "bg-[#1d402f] font-medium text-mint-300" : "text-[#819d90] hover:text-white")}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "entries" && (
        <section className="glass overflow-hidden rounded-[22px]">
          <div className="flex flex-col gap-2 border-b border-white/[0.06] p-3.5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6c897b]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجوی دلیل یا دسته…" className="field pr-9 py-2 text-[10px]" />
            </div>
            <span className="text-[8px] text-[#78968a]">{toPersianDigits(filtered.length)} ردیف</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right">
              <thead><tr className="bg-white/[0.025] text-[8px] text-[#7d9a8d]">{["تاریخ", "نوع", "دلیل", "دسته", "روش", "مبلغ", ""].map((head) => <th key={head} className="px-3 py-2.5 font-normal">{head}</th>)}</tr></thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id} className="border-b border-white/[0.04] text-[9px] hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 text-[#a8bfb3]">{formatJalali(entry.date, "short")}</td>
                    <td className="px-3 py-2.5"><span className={cn("rounded px-1.5 py-0.5 text-[8px]", entry.kind === "income" ? "bg-mint-300/10 text-mint-300" : "bg-sand-300/10 text-sand-300")}>{entry.kind === "income" ? "درآمد" : "هزینه"}</span></td>
                    <td className="px-3 py-2.5 text-[#d8e7df]">{entry.reason}{entry.note && <span className="block text-[7px] text-[#6f8c7f]">{entry.note}</span>}</td>
                    <td className="px-3 py-2.5 text-[#9fbfae]">{entry.category}</td>
                    <td className="px-3 py-2.5 text-[#9fbfae]">{PAYMENT_METHODS[entry.method]}</td>
                    <td className={cn("px-3 py-2.5 font-semibold", entry.kind === "income" ? "text-mint-300" : "text-sand-300")}>{entry.kind === "income" ? "+" : "−"} {money(entry.amount)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => { setEditingEntry(entry); setEntryOpen(true); }} className="text-[#78968a] hover:text-mint-300" aria-label="ویرایش ردیف"><Check className="h-3 w-3" /></button>
                        <button type="button" onClick={() => { if (window.confirm("این ردیف مالی حذف شود؟")) onDeleteEntry(entry.id); }} className="text-[#78968a] hover:text-[#efad9f]" aria-label="حذف ردیف"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <p className="px-4 py-10 text-center text-[10px] text-[#78968a]">ردیفی یافت نشد.</p>}
        </section>
      )}

      {tab === "cheques" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {[["چک‌های دریافتی", money(cheques.receivable)], ["چک‌های پرداختی", money(cheques.payable)], ["در جریان", `${toPersianDigits(cheques.pending)} فقره`], ["برگشتی", `${toPersianDigits(cheques.bounced)} فقره`]].map(([label, value]) => (
              <div key={label} className="glass rounded-2xl p-3"><div className="text-[8px] text-[#78968a]">{label}</div><div className="mt-1 text-[11px] font-semibold text-[#dcebe2]">{value}</div></div>
            ))}
          </div>
          {ledger.cheques.map((cheque) => (
            <article key={cheque.id} className="glass rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <span className={cn("grid h-9 w-9 place-items-center rounded-xl", cheque.direction === "received" ? "bg-mint-300/10 text-mint-300" : "bg-sand-300/10 text-sand-300")}><CreditCard className="h-4 w-4" /></span>
                  <div>
                    <h3 className="text-[11px] font-semibold text-[#e8f3ec]">{cheque.direction === "received" ? "چک دریافتی" : "چک پرداختی"} — {cheque.partyName}</h3>
                    <p className="mt-0.5 text-[8px] text-[#78968a]">سریال {cheque.serial} · {cheque.bank} · سررسید {formatJalali(cheque.due, "long")}</p>
                    <p className="mt-0.5 text-[8px] text-[#7f9b8e]">بابت: {cheque.reason}</p>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-[12px] font-bold text-[#dcebe2]">{money(cheque.amount)}</div>
                  <span className={cn("mt-1 inline-block rounded px-1.5 py-0.5 text-[8px]", STATUS_LABELS[cheque.status].tone)}>{STATUS_LABELS[cheque.status].label}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[0.05] pt-2.5">
                <button type="button" onClick={() => setSignTarget({ kind: "cheque", id: cheque.id })} className="flex items-center gap-1 rounded-lg border border-[#9fd4ee]/25 bg-[#9fd4ee]/[0.07] px-2.5 py-1.5 text-[8px] text-[#bfe6f7]"><Fingerprint className="h-3 w-3" /> امضا ({toPersianDigits(audit(chequeEntity(cheque)).signed)}/{toPersianDigits(audit(chequeEntity(cheque)).required)})</button>
                <button type="button" onClick={() => setPrintCheque(cheque)} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[8px] text-[#b6ccc0]"><Printer className="h-3 w-3" /> چاپ برگه چک</button>
                <button type="button" onClick={() => { setEditCheque(cheque); setChequeOpen(true); }} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[8px] text-[#b6ccc0]"><Check className="h-3 w-3" /> ویرایش</button>
                {cheque.status === "pending" && <button type="button" onClick={() => onSettleCheque(cheque.id, cheque.direction === "received" ? "cleared" : "cleared", todayJalali())} className="flex items-center gap-1 rounded-lg border border-mint-300/20 bg-mint-300/[0.06] px-2.5 py-1.5 text-[8px] text-mint-300"><Wallet className="h-3 w-3" /> ثبت وصول/پرداخت</button>}
                {cheque.status === "pending" && (
                  <>
                    <button type="button" onClick={() => onSetChequeStatus(cheque.id, "cleared")} className="flex items-center gap-1 rounded-lg bg-mint-300/[0.08] px-2.5 py-1.5 text-[8px] text-mint-300"><Check className="h-3 w-3" /> وصول شد</button>
                    <button type="button" onClick={() => onSetChequeStatus(cheque.id, "bounced")} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[8px] text-[#efad9f]"><XCircle className="h-3 w-3" /> برگشت</button>
                  </>
                )}
                <button type="button" onClick={() => onDeleteCheque(cheque.id)} className="mr-auto flex items-center gap-1 text-[8px] text-[#78968a] hover:text-[#efad9f]"><Trash2 className="h-3 w-3" /> حذف</button>
              </div>
            </article>
          ))}
          {ledger.cheques.length === 0 && <p className="rounded-2xl border border-dashed border-[#355344] px-4 py-10 text-center text-[10px] text-[#78968a]">چکی ثبت نشده است.</p>}
        </div>
      )}

      {tab === "loans" && (
        <div className="space-y-3">
          {ledger.loans.map((loan) => {
            const schedule = loanSchedule(loan);
            const paidAmount = schedule.filter((row) => row.paid).reduce((sum, row) => sum + row.amount, 0);
            const remaining = schedule.reduce((sum, row) => sum + row.amount, 0) - paidAmount;
            const next = schedule.find((row) => !row.paid);
            return (
              <article key={loan.id} className="glass rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#8ab6c9]/10 text-[#a9d1e2]"><Landmark className="h-4 w-4" /></span>
                    <div><h3 className="text-[11px] font-semibold text-[#e8f3ec]">{loan.title} — {loan.lender}</h3><p className="mt-0.5 text-[8px] text-[#78968a]">{toPersianDigits(loan.months)} قسط · نرخ {toPersianDigits(loan.rate)}٪ · شروع {formatJalali(loan.start, "short")}</p><p className="mt-0.5 text-[8px] text-[#7f9b8e]">بابت: {loan.reason}</p></div>
                  </div>
                  <div className="text-left"><div className="text-[11px] font-bold text-[#dcebe2]">{money(remaining)}</div><div className="text-[8px] text-[#78968a]">مانده از {money(loan.principal)}</div></div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg bg-white/[0.02] p-2"><div className="text-[7px] text-[#78968a]">قسط ماهانه</div><div className="mt-0.5 text-[9px] text-[#d3e4da]">{money(schedule[0]?.amount ?? 0)}</div></div>
                  <div className="rounded-lg bg-white/[0.02] p-2"><div className="text-[7px] text-[#78968a]">پرداخت‌شده</div><div className="mt-0.5 text-[9px] text-mint-300">{toPersianDigits(loan.paidInstallments)} قسط</div></div>
                  <div className="rounded-lg bg-white/[0.02] p-2"><div className="text-[7px] text-[#78968a]">قسط بعدی</div><div className="mt-0.5 text-[9px] text-sand-300">{next ? formatJalali(next.due, "long") : "تسویه"}</div></div>
                  <div className="rounded-lg bg-white/[0.02] p-2"><div className="text-[7px] text-[#78968a]">کل بازپرداخت</div><div className="mt-0.5 text-[9px] text-[#d3e4da]">{money(schedule.reduce((sum, row) => sum + row.amount, 0))}</div></div>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-white/[0.05] pt-2.5">
                  <button type="button" onClick={() => setSignTarget({ kind: "loan", id: loan.id })} className="flex items-center gap-1 rounded-lg border border-[#9fd4ee]/25 bg-[#9fd4ee]/[0.07] px-2.5 py-1.5 text-[8px] text-[#bfe6f7]"><Fingerprint className="h-3 w-3" /> امضا وام ({toPersianDigits(audit(loanEntity(loan)).signed)}/{toPersianDigits(audit(loanEntity(loan)).required)})</button>
                  <button type="button" disabled={!next} onClick={() => onPayLoan(loan.id)} className="flex items-center gap-1 rounded-lg bg-mint-300/[0.08] px-2.5 py-1.5 text-[8px] text-mint-300 disabled:opacity-40"><CircleDollarSign className="h-3 w-3" /> پرداخت قسط بعدی</button>
                  <button type="button" onClick={() => onDeleteLoan(loan.id)} className="mr-auto flex items-center gap-1 text-[8px] text-[#78968a] hover:text-[#efad9f]"><Trash2 className="h-3 w-3" /> حذف</button>
                </div>
                <div className="mt-2 overflow-hidden rounded-lg border border-white/[0.06]">
                  <table className="w-full text-right"><thead><tr className="bg-white/[0.03] text-[7px] text-[#7d9a8d]"><th className="px-2 py-1.5 font-normal">قسط</th><th className="px-2 py-1.5 font-normal">سررسید</th><th className="px-2 py-1.5 font-normal">مبلغ</th><th className="px-2 py-1.5 font-normal">وضعیت</th></tr></thead>
                    <tbody>{schedule.map((row) => <tr key={row.no} className="border-t border-white/[0.04] text-[8px]"><td className="px-2 py-1.5 text-[#9fbfae]">{toPersianDigits(row.no)}</td><td className="px-2 py-1.5 text-[#b7cdc1]">{formatJalali(row.due, "short")}</td><td className="px-2 py-1.5 text-[#d3e4da]">{money(row.amount)}</td><td className={cn("px-2 py-1.5", row.paid ? "text-mint-300" : "text-sand-300")}>{row.paid ? "پرداخت‌شده" : "باز"}</td></tr>)}</tbody>
                  </table>
                </div>
              </article>
            );
          })}
          {ledger.loans.length === 0 && <p className="rounded-2xl border border-dashed border-[#355344] px-4 py-10 text-center text-[10px] text-[#78968a]">وامی ثبت نشده است.</p>}
        </div>
      )}

      <EntryModal open={entryOpen} initial={editingEntry} onClose={() => { setEntryOpen(false); setEditingEntry(null); }} onSubmit={(entry) => { if (editingEntry) { onUpdateEntry(entry); setToast("تغییرات سند ذخیره شد"); } else { onAddEntry(entry); setToast("سند مالی ثبت شد"); } setEntryOpen(false); setEditingEntry(null); }} />
      <ChequeModal open={chequeOpen} initial={editCheque} onClose={() => { setChequeOpen(false); setEditCheque(null); }} onSubmit={(cheque) => { if (editCheque) { onUpdateCheque(cheque); setToast("تغییرات چک ذخیره شد"); } else { onAddCheque(cheque); setToast("چک ثبت شد"); } setChequeOpen(false); setEditCheque(null); }} />
      <LoanModal open={loanOpen} onClose={() => setLoanOpen(false)} onSubmit={(loan) => { onAddLoan(loan); setLoanOpen(false); setToast("وام و جدول اقساط ساخته شد"); }} />
      {printCheque && <DocumentDialog spec={makeDocument("cheque-sheet", { cheque: printCheque })} onClose={() => setPrintCheque(null)} />}
      <SignatureDialog entity={signTarget ? signTarget.kind === "cheque" ? chequeEntity(ledger.cheques.find((cheque) => cheque.id === signTarget.id)!) : loanEntity(ledger.loans.find((loan) => loan.id === signTarget.id)!) : null} open={Boolean(signTarget)} onClose={() => setSignTarget(null)} />
      <Toast open={Boolean(toast)} message={toast ?? ""} onClose={() => setToast(null)} />
    </div>
  );
}

function EntryModal({ open, onClose, onSubmit, initial }: { open: boolean; onClose: () => void; onSubmit: (entry: FinanceEntry) => void; initial?: FinanceEntry | null }) {
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [method, setMethod] = useState<PaymentMethod>("bank");
  const [date, setDate] = useState(todayJalali());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const categories = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setKind(initial.kind); setAmount(initial.amount); setReason(initial.reason);
      setCategory(initial.category); setMethod(initial.method); setDate(initial.date); setNote(initial.note);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const submit = () => {
    if (amount <= 0) return setError("مبلغ را وارد کنید.");
    if (reason.trim().length < 3) return setError("دلیل یا شرح تراکنش را بنویسید.");
    onSubmit({ id: initial?.id ?? `fin-${Date.now()}`, kind, amount, reason: reason.trim(), category, method, date, partyId: initial?.partyId ?? null, note: note.trim() });
    setAmount(0); setReason(""); setNote(""); setError("");
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "ویرایش سند مالی" : "ثبت درآمد / هزینه"} description="دلیل، تاریخ، دسته و روش پرداخت را وارد کنید." size="md">
      <div className="space-y-3.5 p-5">
        <div className="grid grid-cols-2 gap-2">
          {([["income", "درآمد", "پول دریافت‌شده"], ["expense", "هزینه", "پول پرداخت‌شده"]] as ["income" | "expense", string, string][]).map(([value, label, hint]) => (
            <button key={value} type="button" onClick={() => { setKind(value); setCategory((value === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0]); }} className={cn("rounded-xl border p-3 text-right transition", kind === value ? "border-mint-300/40 bg-mint-300/[0.08]" : "border-[#2b483a]")}>
              <div className="text-[11px] font-medium text-[#e7f3ec]">{label}</div><p className="mt-0.5 text-[8px] text-[#78968a]">{hint}</p>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <AmountField label="مبلغ" value={amount} onChange={setAmount} required />
          <SelectField label="دسته" value={categories.includes(category) ? category : "__custom__"} onChange={(value) => setCategory(value === "__custom__" ? "" : value)} options={categories.filter((item) => !item.startsWith("سایر")).map((item) => ({ value: item, label: item }))} searchable allowCustom customValue={categories.includes(category) ? "" : category} onCustomChange={setCategory} customPlaceholder="نام دسته دلخواه را بنویسید…" />
          <TextField label="دلیل / شرح" value={reason} onChange={setReason} placeholder="مثلاً فروش گندم یا خرید کود" required />
          <SelectField label="روش پرداخت" value={method} onChange={(value) => setMethod(value as PaymentMethod)} options={Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }))} />
          <JalaliDatePicker label="تاریخ" value={date} onChange={setDate} />
          <TextField label="یادداشت" value={note} onChange={setNote} placeholder="شماره فاکتور یا چک" />
        </div>
        {error && <p className="rounded-lg border border-[#8f4c44]/30 bg-[#8f4c44]/10 px-3 py-2 text-[10px] text-[#f0a59a]">{error}</p>}
        <button type="button" onClick={submit} className="w-full rounded-xl bg-mint-400 py-2.5 text-[11px] font-bold text-[#07110d]">{initial ? "ذخیره تغییرات" : "ثبت سند"}</button>
      </div>
    </Modal>
  );
}

function ChequeModal({ open, onClose, onSubmit, initial }: { open: boolean; onClose: () => void; onSubmit: (cheque: Cheque) => void; initial?: Cheque | null }) {
  const [direction, setDirection] = useState<"received" | "paid">("received");
  const [amount, setAmount] = useState(0);
  const [serial, setSerial] = useState("");
  const [bank, setBank] = useState("");
  const [branch, setBranch] = useState("");
  const [accountOwner, setAccountOwner] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [iban, setIban] = useState("");
  const [sayadId, setSayadId] = useState("");
  const [partyName, setPartyName] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [due, setDue] = useState(todayJalali());
  const [issueDate, setIssueDate] = useState(todayJalali());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setDirection(initial.direction); setAmount(initial.amount); setSerial(initial.serial); setBank(initial.bank);
      setBranch(initial.branch ?? ""); setAccountOwner(initial.accountOwner ?? ""); setNationalId(initial.nationalId ?? "");
      setAccountNo(initial.accountNo ?? ""); setIban(initial.iban ?? "");
      setSayadId(initial.sayadId ?? ""); setPartyName(initial.partyName); setReason(initial.reason); setNote(initial.note ?? "");
      setDue(initial.due); setIssueDate(initial.issueDate ?? todayJalali()); setError("");
      return;
    }
    setDirection("received"); setAmount(0); setSerial(""); setBank(""); setBranch(""); setAccountOwner(""); setNationalId(""); setAccountNo(""); setIban(""); setSayadId(""); setPartyName(""); setReason(""); setNote(""); setDue(todayJalali()); setIssueDate(todayJalali()); setError("");
  }, [open, initial]);

  const submit = () => {
    if (amount <= 0) return setError("مبلغ چک را وارد کنید.");
    if (partyName.trim().length < 3) return setError("نام طرف‌حساب را وارد کنید.");
    if (!serial.trim()) return setError("شماره سریال چک را وارد کنید.");
    if (!bank.trim()) return setError("نام بانک را وارد کنید.");
    if (!reason.trim()) return setError("بابت چک را بنویسید.");
    if (new Date(due.jy, due.jm - 1, due.jd).getTime() < new Date(issueDate.jy, issueDate.jm - 1, issueDate.jd).getTime()) return setError("سررسید نمی‌تواند قبل از تاریخ صدور باشد.");
    const cleanSayad = sayadId.replace(/\D/g, "");
    if (cleanSayad && cleanSayad.length !== 16) return setError("شناسهٔ صیاد باید دقیقاً ۱۶ رقم باشد؛ آن را از برگهٔ رسمی چک بخوانید.");
    onSubmit({ id: initial?.id ?? `chq-${Date.now()}`, direction, amount, serial: serial.trim(), bank: bank.trim(), branch: branch.trim(), accountOwner: accountOwner.trim() || partyName.trim(), nationalId: nationalId.trim(), accountNo: accountNo.trim(), iban: iban.trim(), sayadId: cleanSayad, partyName: partyName.trim(), reason: reason.trim(), due, issueDate, status: initial?.status ?? "pending", note: note.trim(), settledDate: initial?.settledDate ?? null });
    setError("");
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "ویرایش چک" : "ثبت اطلاعات چک"} description="این فرم فقط اطلاعات چک را در دفتر ثبت می‌کند؛ چک قانونی باید برگهٔ رسمی بانک داشته باشد و در سامانهٔ صیاد ثبت شود." size="md">
      <div className="space-y-3.5 p-5">
        <div className="rounded-xl border border-[#c5b97f]/25 bg-[#c5b97f]/[0.05] p-2.5 text-[8px] leading-5 text-[#d7cba1]">
          <b>چک چاپی A4 = چک بانکی نیست.</b> برای وصول و پیگیری قانونی، برگهٔ رسمی دسته‌چک، شناسهٔ ۱۶ رقمی صیاد، ثبت مبلغ/تاریخ/گیرنده در صیاد، تأیید گیرنده و امضای اصلی صاحب حساب مطابق نمونهٔ بانک لازم است. اطلاعات این فرم برای مدیریت داخلی است.
        </div>
        <div className="grid grid-cols-2 gap-2">
          {([["received", "چک دریافتی", "از طرف‌حساب به نفع ما"], ["paid", "چک پرداختی", "از سوی ما به طرف‌حساب"]] as ["received" | "paid", string, string][]).map(([value, label, hint]) => (
            <button key={value} type="button" onClick={() => setDirection(value)} className={cn("rounded-xl border p-3 text-right transition", direction === value ? "border-mint-300/40 bg-mint-300/[0.08]" : "border-[#2b483a]")}><div className="text-[11px] font-medium text-[#e7f3ec]">{label}</div><p className="mt-0.5 text-[8px] text-[#78968a]">{hint}</p></button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <AmountField label="مبلغ چک (تومان)" value={amount} onChange={setAmount} required />
          <TextField label="شماره سریال چک" value={serial} onChange={setSerial} numeric placeholder="۴۵۲۱۹۸۷" required />
          <TextField label="بانک" value={bank} onChange={setBank} placeholder="بانک کشاورزی" required />
          <TextField label="شعبه" value={branch} onChange={setBranch} placeholder="شعبه مرکزی" />
          <TextField label="نام صاحب حساب" value={accountOwner} onChange={setAccountOwner} suggestions={[partyName]} placeholder="نام صاحب حساب" />
          <TextField label="شناسه ملی صاحب حساب" value={nationalId} onChange={setNationalId} numeric placeholder="۱۰ رقم" />
          <TextField label="شماره حساب / شبا" value={iban} onChange={setIban} placeholder="IR… (اختیاری، برای هماهنگی با بانک)" />
          <TextField label="شماره حساب" value={accountNo} onChange={setAccountNo} numeric placeholder="اختیاری" />
          <TextField label="شناسهٔ یکتای صیاد (۱۶ رقم)" value={sayadId} onChange={setSayadId} numeric placeholder="از برگهٔ رسمی چک" />
          <TextField label="طرف‌حساب" value={partyName} onChange={setPartyName} placeholder="نام خریدار یا فروشنده" required />
          <TextField label="بابت" value={reason} onChange={setReason} placeholder="مانده فروش گندم" required />
          <JalaliDatePicker label="تاریخ صدور" value={issueDate} onChange={setIssueDate} />
          <JalaliDatePicker label="تاریخ سررسید" value={due} onChange={setDue} minDate={issueDate} />
          <TextField label="یادداشت" value={note} onChange={setNote} placeholder="توضیح اختیاری" />
        </div>
        {error && <p className="rounded-lg border border-[#8f4c44]/30 bg-[#8f4c44]/10 px-3 py-2 text-[10px] text-[#f0a59a]">{error}</p>}
        <button type="button" onClick={submit} className="w-full rounded-xl bg-mint-400 py-2.5 text-[11px] font-bold text-[#07110d]">{initial ? "ذخیره تغییرات" : "ثبت چک"}</button>
      </div>
    </Modal>
  );
}

function LoanModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (loan: Loan) => void }) {
  const [title, setTitle] = useState("");
  const [lender, setLender] = useState("");
  const [principal, setPrincipal] = useState(0);
  const [rate, setRate] = useState(4);
  const [months, setMonths] = useState(12);
  const [start, setStart] = useState(todayJalali());
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!title.trim() || !lender.trim()) return setError("عنوان وام و نام وام‌دهنده را وارد کنید.");
    if (principal <= 0) return setError("مبلغ وام را وارد کنید.");
    if (months < 1) return setError("تعداد اقساط باید حداقل یک باشد.");
    onSubmit({ id: `loan-${Date.now()}`, title: title.trim(), lender: lender.trim(), principal, rate, months, start, paidInstallments: 0, reason: reason.trim() });
    setTitle(""); setLender(""); setPrincipal(0); setReason(""); setError("");
  };

  return (
    <Modal open={open} onClose={onClose} title="ثبت وام و اقساط" description="جدول اقساط با سررسید شمسی خودکار ساخته می‌شود." size="md">
      <div className="space-y-3.5 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="عنوان وام" value={title} onChange={setTitle} placeholder="وام سرمایه در گردش" />
          <TextField label="وام‌دهنده" value={lender} onChange={setLender} placeholder="بانک کشاورزی" />
          <AmountField label="مبلغ وام" value={principal} onChange={setPrincipal} required />
          <TextField label="نرخ سالانه (درصد)" value={String(rate)} onChange={(value) => setRate(Number(toPersianDigits(value).replace(/[^\d.]/g, "")) || 0)} />
          <TextField label="تعداد اقساط (ماه)" value={String(months)} onChange={(value) => setMonths(Number(toPersianDigits(value).replace(/[^\d]/g, "")) || 0)} />
          <JalaliDatePicker label="تاریخ شروع" value={start} onChange={setStart} />
        </div>
        <TextField label="بابت" value={reason} onChange={setReason} placeholder="خرید نهاده و بذر" />
        {error && <p className="rounded-lg border border-[#8f4c44]/30 bg-[#8f4c44]/10 px-3 py-2 text-[10px] text-[#f0a59a]">{error}</p>}
        <button type="button" onClick={submit} className="w-full rounded-xl bg-mint-400 py-2.5 text-[11px] font-bold text-[#07110d]">ساخت وام و جدول اقساط</button>
      </div>
    </Modal>
  );
}
