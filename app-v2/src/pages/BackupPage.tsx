import { useState } from "react";
import {
  Bot,
  Check,
  ClipboardCopy,
  Database,
  Download,
  HelpCircle,
  History,
  Info,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { cn } from "../utils/cn";
import { MY_BUSINESS, type SavedContract } from "../lib/data";
import { formatJalali, toPersianDigits, todayJalali } from "../lib/format";
import {
  chequeTotals,
  financeTotals,
  inventoryValue,
  ledgerTotals,
  loanSchedule,
  partyTotals,
  type LedgerState,
} from "../lib/ledger";
import { PRODUCT_PROFILES, tradeBalance, type CropTrade } from "../lib/trade";
import { plotMetrics, type CropPlot } from "../lib/samples";
import type { LeaseSignature, RentPaymentRecord } from "./RentalsPage";
import { Toast } from "../components/ui";

const fa = (value: number) => toPersianDigits(Math.round(value).toLocaleString("en-US"));
const money = (value: number) => `${fa(value)} تومان`;

type Tab = "assistant" | "backup" | "help" | "settings";

export interface BackupBundle {
  version: 1;
  savedAt: string;
  parties: unknown;
  contracts: unknown;
  trades: unknown;
  plots: unknown;
  ledger: unknown;
  rentPayments: unknown;
  signatures: unknown;
}

export function BackupPage({
  ledger,
  trades,
  plots,
  contracts,
  rentPayments,
  signatures,
  onRestore,
  onReset,
  onLoadDemo,
}: {
  ledger: LedgerState;
  trades: CropTrade[];
  plots: CropPlot[];
  contracts: SavedContract[];
  rentPayments: RentPaymentRecord[];
  signatures: LeaseSignature[];
  onRestore: (bundle: BackupBundle) => void;
  onReset: () => void;
  onLoadDemo: () => void;
}) {
  const [tab, setTab] = useState<Tab>("assistant");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string }[]>([
    {
      role: "bot",
      text: "سلام! من دستیار محلی مزرعه هستم. اعداد را از دفتر واقعی شما می‌خوانم و چیزی حدس نمی‌زنم. می‌توانید بپرسید: «چقدر طلب دارم؟»، «مانده بدهی‌ها چقدر است؟»، «وضعیت اجاره چطور است؟»، «سود فروش محصول چقدر است؟» یا «چه هشدارهایی دارم؟».",
    },
  ]);
  const [copied, setCopied] = useState(false);
  const [payload, setPayload] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const totals = ledgerTotals(ledger);
  const fin = financeTotals(ledger.entries);
  const cheques = chequeTotals(ledger.cheques);
  const sale = trades.reduce((sum, trade) => sum + trade.result.netReceipt, 0);
  const saleRemaining = trades.reduce((sum, trade) => sum + tradeBalance(trade).remaining, 0);
  const cost = plots.reduce((sum, plot) => sum + plotMetrics(plot).cost, 0);
  const rentIncome = contracts.filter((contract) => contract.myRole === "landlord").reduce((sum, contract) => sum + contract.rent, 0);
  const rentExpense = contracts.filter((contract) => contract.myRole === "tenant").reduce((sum, contract) => sum + contract.rent, 0);
  const lowItems = ledger.items.filter((item) => item.stock <= item.min);
  const dueLoans = ledger.loans.map((loan) => ({ loan, next: loanSchedule(loan).find((row) => !row.paid) })).filter((row) => row.next);

  const answer = (raw: string): string => {
    const text = raw.replace(/[يى]/g, "ی").replace(/ك/g, "ک");
    const has = (...words: string[]) => words.some((word) => text.includes(word));
    if (has("طلب", "بدهکار")) {
      const top = ledger.parties.filter((party) => party.kind === "debtor").map((party) => ({ party, totals: partyTotals(party, ledger.payments) })).sort((a, b) => b.totals.balance - a.totals.balance);
      return `کل طلب شما از بدهکاران ${money(totals.receivable)} است. ${top.length ? `بزرگ‌ترین بدهکار: ${top[0].party.name} با ${money(top[0].totals.balance)} — دلیل: ${top[0].party.reason}` : "بدهکاری ثبت نشده است."}${totals.overdue > 0 ? `\nمانده معوق: ${money(totals.overdue)}؛ پیگیری الزامی است.` : ""}`;
    }
    if (has("بستانکار", "بدهی")) {
      const top = ledger.parties.filter((party) => party.kind === "creditor").map((party) => ({ party, totals: partyTotals(party, ledger.payments) })).sort((a, b) => b.totals.balance - a.totals.balance);
      return `کل بدهی شما به بستانکاران ${money(totals.payable)} است. ${top.length ? `بیشترین بدهی: ${top[0].party.name} با ${money(top[0].totals.balance)} — دلیل: ${top[0].party.reason}` : "بدهی ثبت نشده است."}`;
    }
    if (has("اجاره", "موجر", "مستاجر")) {
      return `اجاره دریافتی (به‌عنوان موجر): ${money(rentIncome)}\nاجاره پرداختی (به‌عنوان مستاجر): ${money(rentExpense)}\nودیعه‌های نزد طرف‌ها: ${money(contracts.reduce((sum, contract) => sum + contract.deposit, 0))}\n${toPersianDigits(contracts.length)} قرارداد زمین ثبت شده است.`;
    }
    if (has("فروش", "محصول", "گندم")) {
      return `خالص فروش محصولات ثبت‌شده ${money(sale)} است؛ مانده دریافتنی ${money(saleRemaining)}.${trades.length ? ` آخرین محموله: ${PRODUCT_PROFILES[trades[0].productId].name} به ${trades[0].buyerName} با وزن قابل پرداخت ${fa(trades[0].result.payableKg)} کیلوگرم.` : ""}`;
    }
    if (has("سود", "هزینه", "زیان")) {
      return `درآمد دفتر مالی ${money(fin.income)}، هزینه ${money(fin.expense)} و ${fin.profit >= 0 ? "سود" : "زیان"} دوره ${money(Math.abs(fin.profit))} است.\nبهای تولید زمین‌ها ${money(cost)} برآورد شده است.`;
    }
    if (has("چک", "سررسید")) {
      return `${toPersianDigits(cheques.pending)} چک در جریان دارید. چک‌های دریافتی ${money(cheques.receivable)} و پرداختی ${money(cheques.payable)}. ${cheques.dueSoon > 0 ? `${toPersianDigits(cheques.dueSoon)} فقره سررسید نزدیک دارد.` : "سررسید نزدیکی ثبت نشده است."}${cheques.bounced > 0 ? ` ${toPersianDigits(cheques.bounced)} چک برگشتی نیاز به پیگیری دارد.` : ""}`;
    }
    if (has("قسط", "وام")) {
      return dueLoans.length
        ? `شما ${toPersianDigits(ledger.loans.length)} وام دارید. ${dueLoans.map(({ loan, next }) => `${loan.title}: قسط بعدی ${next ? formatJalali(next.due, "long") : "-"} به مبلغ ${money(next?.amount ?? 0)}`).join("\n")}`
        : "وام فعالی ثبت نشده است.";
    }
    if (has("انبار", "موجودی", "کمبود")) {
      const value = inventoryValue(ledger.items);
      return `ارزش انبار ${money(value.inputs + value.products)} و ${toPersianDigits(value.low)} قلم کمبود است.${lowItems.length ? `\nاقلام نیازمند خرید: ${lowItems.map((item) => `${item.name} (موجودی ${fa(item.stock)} ${item.unit}، حد ${fa(item.min)})`).join("، ")}` : ""}`;
    }
    if (has("زمین", "بهای تمام", "سربه")) {
      const top = plots.map((plot) => ({ plot, metrics: plotMetrics(plot) })).sort((a, b) => b.metrics.profit - a.metrics.profit);
      return top.length
        ? `بهای تولید کل ${money(cost)} است. سود هر زمین:\n${top.map(({ plot, metrics }) => `${plot.title}: سود ${money(metrics.profit)} · هزینه هر کیلو ${money(metrics.costPerKg)} · سربه‌سر ${money(metrics.breakEven)}`).join("\n")}`
        : "زمینی ثبت نشده است.";
    }
    if (has("هشدار", "وضعیت", "تحلیل")) {
      const alerts = [
        totals.overdue > 0 ? `مانده معوق ${money(totals.overdue)}` : null,
        saleRemaining > 0 ? `مانده فروش ${money(saleRemaining)}` : null,
        cheques.bounced > 0 ? `${toPersianDigits(cheques.bounced)} چک برگشتی` : null,
        cheques.dueSoon > 0 ? `${toPersianDigits(cheques.dueSoon)} چک نزدیک سررسید` : null,
        lowItems.length > 0 ? `${toPersianDigits(lowItems.length)} قلم کمبود انبار` : null,
        fin.profit < 0 ? "هزینه‌ها از درآمد بیشتر است" : null,
      ].filter(Boolean);
      return alerts.length ? `تحلیل و هشدارها:\n${alerts.map((alert) => `• ${alert}`).join("\n")}\n\nپیشنهاد: ابتدا مانده‌های معوق را پیگیری و سپس خرید نهاده‌های کم‌موجود را زمان‌بندی کنید.` : "هشدار مهمی پیدا نشد؛ مانده‌ها و موجودی‌ها در وضعیت عادی‌اند.";
    }
    if (has("چاپ", "سند", "قرارداد")) {
      return `برای چاپ: بخش «اسناد و چاپ» را باز کنید، سند را انتخاب و «دانلود PDF» یا «چاپ» را بزنید. برای قرارداد زمین، در صفحه «اجاره» هم دکمه‌های قرارداد، رسید و تحویل وجود دارد.`;
    }
    if (has("نرخ", "قیمت گندم")) {
      return `آخرین نرخ مصوب در برنامه ${money(PRODUCT_PROFILES.wheat.basePrice)} برای هر کیلوگرم با افت ۳٪ مفید و ۱٪ غیرمفید است. نرخ فصل جاری و شرایط خریدار را قبل از امضا تطبیق دهید.`;
    }
    return "درباره یکی از این موضوع‌ها بپرسید: طلب و بدهی، اجاره، فروش محصول، سود و هزینه، چک، وام و اقساط، انبار، زمین و بهای تمام‌شده، یا هشدارهای مدیریتی.";
  };

  const ask = (text: string) => {
    const value = text.trim();
    if (!value) return;
    setMessages((current) => [...current, { role: "user", text: value }, { role: "bot", text: answer(value) }]);
    setQuestion("");
  };

  const buildBundle = (): BackupBundle => ({
    version: 1,
    savedAt: new Date().toISOString(),
    parties: ledger.parties,
    contracts,
    trades,
    plots,
    ledger,
    rentPayments,
    signatures,
  });

  const exportBackup = () => {
    const json = JSON.stringify(buildBundle(), null, 2);
    setPayload(json);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kishavar-backup-${formatJalali(todayJalali(), "short").replace(/\//g, "-")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 6000);
    setToast("فایل پشتیبان ساخته شد؛ نسخه متنی هم در کادر زیر آماده است.");
  };

  const copyBackup = () => {
    const json = payload || JSON.stringify(buildBundle(), null, 2);
    setPayload(json);
    void navigator.clipboard?.writeText(json);
    setCopied(true);
    setToast("متن پشتیبان کپی شد؛ در جای امن نگه دارید.");
    window.setTimeout(() => setCopied(false), 2200);
  };

  const restore = () => {
    try {
      const parsed = JSON.parse(payload) as BackupBundle;
      if (!parsed || parsed.version !== 1) throw new Error("نسخه پشتیبان پشتیبانی نمی‌شود.");
      onRestore(parsed);
      setToast("پشتیبان بازیابی شد.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "فایل پشتیبان معتبر نیست.");
    }
  };

  const modules = [
    { title: "پیشخوان", text: "نمای فروش، بهای تولید، مانده‌ها و اقدام‌های پیش‌رو." },
    { title: "معامله محصول", text: "ماشین‌حساب قطعی فروش گندم/جو/کلزا/ذرت، معاملات و تسویه، شرایط خرید." },
    { title: "قرارداد زمین", text: "ساخت قرارداد موجر/مستاجر با طرف‌حساب، تاریخ شمسی، مالی و تعهدات." },
    { title: "اجاره", text: "جدول اقساط، ثبت پرداخت اجاره، رسید و قرارداد، امضای موجر/مستاجر/شاهد." },
    { title: "زمین و کشت", text: "هفت سرفصل هزینه، بهای تمام‌شده هر کیلو، سربه‌سر و سود." },
    { title: "دفتر مالی", text: "درآمد و هزینه با دلیل و تاریخ، چک دریافتی/پرداختی، وام و اقساط." },
    { title: "بدهکار و بستانکار", text: "دلیل بدهی، تاریخ ایجاد و سررسید، دفتر معین، ثبت پرداخت و صورتحساب." },
    { title: "انبار، دارایی، بودجه", text: "گردش انبار، حد سفارش، استهلاک خط مستقیم و کنترل بودجه." },
    { title: "اسناد و چاپ", text: "اسناد A4 با سریال، QR، مبلغ به حروف و دانلود PDF." },
    { title: "گزارش‌ها", text: "فروش به تفکیک محصول، دفتر معاملات، بهای تمام‌شده و اجاره." },
    { title: "معماری", text: "فرمول‌ها، آزمون‌های موتور و منابع." },
  ];

  const tabs: { id: Tab; label: string; icon: typeof Bot }[] = [
    { id: "assistant", label: "دستیار مالی", icon: Bot },
    { id: "backup", label: "پشتیبان و بازیابی", icon: Database },
    { id: "help", label: "راهنمای کامل", icon: HelpCircle },
    { id: "settings", label: "تنظیمات و وضعیت", icon: UserRound },
  ];

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]"><Sparkles className="h-3.5 w-3.5 text-mint-300" />دستیار، پشتیبان و راهنما</div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">پشتیبان و دستیار مزرعه</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] font-light leading-6 text-[#89a598]">پاسخ‌های عددی از همان دفتر و موتور برنامه ساخته می‌شوند؛ نه از تخمین. پشتیبان کامل هم فقط روی دستگاه شماست.</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-xl border border-mint-300/15 bg-mint-300/[0.05] px-3 py-2 text-[9px] text-mint-300"><ShieldCheck className="h-3.5 w-3.5" /> داده‌ها روی دستگاه</span>
      </div>

      <div className="mb-4 flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
        {tabs.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[9px] transition", tab === item.id ? "bg-[#1d402f] font-medium text-mint-300" : "text-[#819d90]")}><Icon className="h-3.5 w-3.5" />{item.label}</button>; })}
      </div>

      {tab === "assistant" && (
        <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="glass flex h-[520px] flex-col overflow-hidden rounded-[22px]">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-mint-300/10 text-mint-300"><Bot className="h-4 w-4" /></span><div><h2 className="text-[11px] font-semibold text-white">دستیار مالی محلی</h2><p className="text-[8px] text-[#78968a]">بدون ارسال داده به اینترنت · پاسخ عددی</p></div></div>
            <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
              {messages.map((message, index) => (
                <div key={index} className={cn("max-w-[92%] whitespace-pre-line rounded-2xl px-3 py-2 text-[9px] leading-6", message.role === "user" ? "mr-auto bg-mint-300/[0.1] text-[#dcebe8]" : "bg-white/[0.03] text-[#bcd2c6]")}>{message.text}</div>
              ))}
            </div>
            <div className="border-t border-white/[0.06] p-2.5">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {["چقدر طلب دارم؟", "مانده بدهی‌ها چقدر است؟", "هشدارهای مزرعه", "وضعیت اجاره", "انبار چه کمبودی دارد؟"].map((sample) => <button key={sample} type="button" onClick={() => ask(sample)} className="rounded-lg border border-white/[0.07] px-2 py-1 text-[8px] text-[#93ad9f] transition hover:text-mint-300">{sample}</button>)}
              </div>
              <form onSubmit={(event) => { event.preventDefault(); ask(question); }} className="flex gap-2">
                <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="سؤال خود را بنویسید…" className="field flex-1 py-2 text-[10px]" />
                <button type="submit" className="grid h-9 w-9 place-items-center rounded-xl bg-mint-400 text-[#07110d]" aria-label="ارسال"><Send className="h-4 w-4" /></button>
              </form>
            </div>
          </section>
          <section className="glass rounded-[22px] p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-white"><History className="h-3.5 w-3.5 text-mint-300" /> وضعیت لحظه‌ای</h2>
            <div className="space-y-2">
              {[["مانده طلب", money(totals.receivable)], ["مانده بدهی", money(totals.payable)], ["سود دفتر مالی", money(fin.profit)], ["مانده فروش محصول", money(saleRemaining)], ["چک‌های نزدیک سررسید", `${toPersianDigits(cheques.dueSoon)} فقره`], ["اقلام کم‌موجود", `${toPersianDigits(lowItems.length)} قلم`]].map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-white/[0.05] pb-1.5 text-[9px] last:border-0"><span className="text-[#819d90]">{label}</span><span className="font-medium text-[#dcebe2]">{value}</span></div>)}
            </div>
            <p className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[8px] leading-5 text-[#78968a]"><Info className="ml-1 inline h-3 w-3" /> دستیار محلی است و به اینترنت متصل نمی‌شود؛ برای پرسش‌های حقوقی، نظر مشاور رسمی را بگیرید.</p>
          </section>
        </div>
      )}

      {tab === "backup" && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <section className="glass rounded-[22px] p-4">
            <h2 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-white"><Download className="h-3.5 w-3.5 text-mint-300" /> تهیه پشتیبان</h2>
            <p className="mb-3 text-[8px] leading-5 text-[#78968a]">همه طرف‌حساب‌ها، قراردادها، معاملات، زمین‌ها، دفتر مالی، پرداخت اجاره و امضاها در یک فایل JSON.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportBackup} className="flex items-center gap-1.5 rounded-xl bg-mint-400 px-3 py-2.5 text-[9px] font-bold text-[#07110d]"><Download className="h-3.5 w-3.5" /> ساخت و دانلود فایل</button>
              <button type="button" onClick={copyBackup} className="flex items-center gap-1.5 rounded-xl border border-white/[0.09] px-3 py-2.5 text-[9px] text-[#b9cec3]">{copied ? <Check className="h-3.5 w-3.5 text-mint-300" /> : <ClipboardCopy className="h-3.5 w-3.5" />} کپی متن پشتیبان</button>
            </div>
            <textarea value={payload} onChange={(event) => setPayload(event.target.value)} rows={10} placeholder="متن پشتیبان اینجا نمایش داده می‌شود…" className="field mt-3 w-full resize-y text-left font-mono text-[8px]" dir="ltr" />
          </section>
          <section className="glass rounded-[22px] p-4">
            <h2 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-white"><Upload className="h-3.5 w-3.5 text-mint-300" /> بازیابی / بازنشانی</h2>
            <p className="mb-3 text-[8px] leading-5 text-[#78968a]">متن JSON پشتیبان را در کادر زیر بگذارید و بازیابی کنید. این کار داده‌های فعلی را جایگزین می‌کند.</p>
            <button type="button" onClick={restore} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-mint-300/25 bg-mint-300/[0.08] py-2.5 text-[9px] font-medium text-mint-300"><RefreshCw className="h-3.5 w-3.5" /> بازیابی از متن کادر</button>
            <button type="button" onClick={() => { if (window.confirm("همه داده‌های ثبت‌شده پاک شوند؟ این کار قابل بازگشت نیست.")) { onReset(); setToast("همه داده‌ها پاک شد؛ برنامه خالی است."); } }} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#a25649]/25 bg-[#a25649]/[0.08] py-2.5 text-[9px] text-[#efad9f]"><Trash2 className="h-3.5 w-3.5" /> پاک کردن همه داده‌ها</button>
            <button type="button" onClick={() => { if (window.confirm("داده نمونه فقط برای آزمایش روی این نصب بارگذاری شود؟")) { onLoadDemo(); setToast("داده نمونه آزمایشی بارگذاری شد."); } }} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-sand-300/20 bg-sand-300/[0.06] py-2.5 text-[9px] text-sand-300"><Database className="h-3.5 w-3.5" /> بارگذاری داده نمونه (فقط آزمایش)</button>
            <div className="mt-3 rounded-xl border border-sand-300/15 bg-sand-300/[0.05] p-2.5 text-[8px] leading-5 text-[#d5caa9]">هشدار: نصب تازه کاملاً خالی است و هیچ داده نمونه‌ای نمایش داده نمی‌شود. داده نمونه فقط با دکمه بالا و صرفاً برای آزمایش بارگذاری می‌شود. پیش از هر پاک‌سازی، پشتیبان بگیرید.</div>
          </section>
        </div>
      )}

      {tab === "help" && (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => <div key={module.title} className="glass rounded-2xl p-3.5"><h3 className="text-[10px] font-semibold text-[#e3f0e8]">{module.title}</h3><p className="mt-1 text-[8px] leading-5 text-[#819d90]">{module.text}</p></div>)}
        </div>
      )}

      {tab === "settings" && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <section className="glass rounded-[22px] p-4">
            <h2 className="mb-3 text-[11px] font-semibold text-white">مشخصات کسب‌وکار</h2>
            <div className="space-y-2">
              {[["نام کسب‌وکار", MY_BUSINESS.name], ["مالک / مدیر", MY_BUSINESS.owner], ["شناسه ملی", MY_BUSINESS.nationalId], ["مزرعه", MY_BUSINESS.farm], ["موقعیت", MY_BUSINESS.location], ["نسخه برنامه", toPersianDigits("1.0.0")], ["موتور معامله", toPersianDigits("1.0.0")], ["تاریخ امروز", formatJalali(todayJalali(), "long")]].map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-2.5 py-2 text-[9px]"><span className="text-[#819d90]">{label}</span><span className="text-[#d3e4da]">{value}</span></div>)}
            </div>
          </section>
          <section className="glass rounded-[22px] p-4">
            <h2 className="mb-2 text-[11px] font-semibold text-white">وضعیت ذخیره‌سازی</h2>
            <div className="space-y-2 text-[9px]">
              {[["طرف‌حساب‌های مالی", ledger.parties.length], ["قرارداد زمین", contracts.length], ["معامله محصول", trades.length], ["زمین و کشت", plots.length], ["پرداخت اجاره", rentPayments.length], ["امضا", signatures.length], ["چک", ledger.cheques.length], ["وام", ledger.loans.length]].map(([label, count]) => <div key={String(label)} className="flex items-center justify-between border-b border-white/[0.05] pb-1.5"><span className="text-[#819d90]">{label}</span><span className="text-[#d3e4da]">{toPersianDigits(Number(count))} رکورد</span></div>)}
            </div>
            <p className="mt-2 rounded-lg bg-white/[0.02] px-2.5 py-2 text-[8px] leading-5 text-[#78968a]">ذخیره‌سازی محلی (localStorage) با نسخه‌بندی. برای نسخه چندکاربره، اتصال به PostgreSQL در معماری پیش‌بینی شده است.</p>
          </section>
        </div>
      )}

      <Toast open={Boolean(toast)} message={toast ?? ""} onClose={() => setToast(null)} />
    </div>
  );
}
