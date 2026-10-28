import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  ClipboardCopy,
  Database,
  Download,
  Eraser,
  HelpCircle,
  History,
  Lightbulb,
  Percent,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { cn } from "../utils/cn";
import type { SavedContract } from "../lib/data";
import { useProfile, profileDisplayName, profileFarmLine } from "../lib/profile";
import { formatJalali, toPersianDigits, todayJalali } from "../lib/format";
import {
  chequeTotals,
  financeTotals,
  ledgerTotals,
  type LedgerState,
} from "../lib/ledger";
import { tradeBalance, type CropTrade } from "../lib/trade";
import type { CropPlot } from "../lib/samples";
import {
  askKeshavarYar,
  assistantProfileStats,
  assistantSuggestedQuestions,
  clearAssistantMessages,
  greeting,
  loadAssistantMessages,
  makeAssistantMessage,
  saveAssistantMessages,
  type AssistantMessage,
} from "../lib/ai/engine";
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
  const { profile } = useProfile();
  const assistantContext = useMemo(() => ({ ledger, trades, plots, contracts }), [ledger, trades, plots, contracts]);
  const [tab, setTab] = useState<Tab>("assistant");
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>(() => {
    const saved = loadAssistantMessages();
    return saved.length ? saved : [makeAssistantMessage("bot", greeting(assistantContext, profile.fullName))];
  });
  const [copied, setCopied] = useState(false);
  const [payload, setPayload] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const totals = ledgerTotals(ledger);
  const fin = financeTotals(ledger.entries);
  const cheques = chequeTotals(ledger.cheques);
  const saleRemaining = trades.reduce((sum, trade) => sum + tradeBalance(trade).remaining, 0);
  const lowItems = ledger.items.filter((item) => item.stock <= item.min);
  const assistantStats = useMemo(() => assistantProfileStats(assistantContext), [assistantContext]);
  const suggestions = useMemo(() => assistantSuggestedQuestions(assistantContext), [assistantContext]);
  const lastBot = [...messages].reverse().find((message) => message.role === "bot" && message.meta?.followUps?.length);

  useEffect(() => {
    saveAssistantMessages(messages);
  }, [messages]);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, thinking]);

  const ask = (text: string) => {
    const value = text.trim();
    if (!value || thinking) return;
    setMessages((current) => [...current, makeAssistantMessage("user", value)]);
    setQuestion("");
    setThinking(true);
    window.setTimeout(() => {
      const reply = askKeshavarYar(value, assistantContext);
      setMessages((current) => [...current, makeAssistantMessage("bot", reply.text, reply.meta)]);
      setThinking(false);
    }, 360);
  };

  const resetMemory = () => {
    clearAssistantMessages();
    setMessages([makeAssistantMessage("bot", greeting(assistantContext, profile.fullName))]);
    setToast("حافظهٔ گفتگو پاک شد؛ دانشنامه و داده‌های دفتر دست‌نخورده‌اند.");
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
    { title: "پشتیبان", text: "خروجی و بازیابی کامل داده‌ها؛ داده نمونه فقط برای آزمایش." },
    { title: "پروفایل", text: "نام، تلفن، کسب‌وکار، نشانی و مشخصات شما؛ قابل ویرایش و پیشنهاد در فیلدها." },
  ];

  const tabs: { id: Tab; label: string; icon: typeof Bot }[] = [
    { id: "assistant", label: "کشاورزیار", icon: Bot },
    { id: "backup", label: "پشتیبان و بازیابی", icon: Database },
    { id: "help", label: "راهنمای کامل", icon: HelpCircle },
    { id: "settings", label: "تنظیمات و وضعیت", icon: UserRound },
  ];

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]"><Sparkles className="h-3.5 w-3.5 text-mint-300" />کشاورزیار، پشتیبان و راهنما</div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">کشاورزیار — دستیار هوشمند مزرعه</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] font-light leading-6 text-[#89a598]">حسابدار محلی، دانشنامهٔ حقوقی چک و سند، مشاور کشاورزی و دستیار گزارش‌گیری؛ اعداد از دفتر واقعی شما، بدون ارسال داده به اینترنت. حافظهٔ گفتگو روی دستگاه می‌ماند.</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-xl border border-mint-300/15 bg-mint-300/[0.05] px-3 py-2 text-[9px] text-mint-300"><ShieldCheck className="h-3.5 w-3.5" /> داده‌ها روی دستگاه</span>
      </div>

      <div className="mb-4 flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
        {tabs.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[9px] transition", tab === item.id ? "bg-[#1d402f] font-medium text-mint-300" : "text-[#819d90]")}><Icon className="h-3.5 w-3.5" />{item.label}</button>; })}
      </div>

      {tab === "assistant" && (
        <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="glass flex h-[610px] flex-col overflow-hidden rounded-[22px]">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-mint-300/15 bg-mint-300/10 text-mint-300"><BrainCircuit className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-white">کشاورزیار <span className="rounded bg-mint-300/10 px-1.5 py-0.5 text-[7px] font-medium text-mint-300">دستیار هوشمند محلی</span></h2>
                <p className="mt-0.5 truncate text-[8px] text-[#78968a]">{assistantStats.glossaryLabel} · حافظه روی دستگاه</p>
              </div>
              <button type="button" onClick={resetMemory} className="flex shrink-0 items-center gap-1 rounded-lg border border-white/[0.08] px-2 py-1.5 text-[8px] text-[#93ad9f] transition hover:text-white" aria-label="پاک کردن حافظهٔ گفتگو"><Eraser className="h-3 w-3" /> حافظه</button>
            </div>
            <div ref={chatScrollRef} className="flex-1 space-y-3 overflow-y-auto p-3.5">
              {messages.map((message) => (
                <div key={message.id} className={cn("max-w-[94%]", message.role === "user" && "mr-auto")}>
                  <div className={cn("whitespace-pre-line rounded-2xl px-3 py-2 text-[9px] leading-6", message.role === "user" ? "bg-mint-300/[0.1] text-[#dcebe8]" : "border border-white/[0.04] bg-white/[0.03] text-[#c3d8cc]")}>{message.text}</div>
                  {message.role === "bot" && message.meta && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[7px]">
                      <span className={cn("flex items-center gap-1 rounded px-1.5 py-0.5", message.meta.confidence >= 80 ? "bg-mint-300/[0.08] text-mint-300" : message.meta.confidence >= 55 ? "bg-sand-300/[0.08] text-sand-300" : "bg-white/[0.04] text-[#9fb6aa]")}><Percent className="h-2.5 w-2.5" />اطمینان {toPersianDigits(message.meta.confidence)}٪</span>
                      <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[#9fb6aa]">{message.meta.category}</span>
                      {message.meta.highStakes && <span className="rounded bg-[#c5b97f]/[0.08] px-1.5 py-0.5 text-[#d8c896]">نیازمند احتیاط حقوقی</span>}
                      {message.meta.sources.length > 0 && (
                        <details className="w-full">
                          <summary className="cursor-pointer text-[#78968a] hover:text-[#a9c1b5]">{toPersianDigits(message.meta.sources.length)} منبع و مبنا — مشاهده</summary>
                          <ul className="mt-1 space-y-1 rounded-lg border border-white/[0.05] bg-[#071510]/50 px-2 py-1.5 text-[7px] leading-4 text-[#8ba79a]">
                            {message.meta.sources.map((source, index) => <li key={`${source.label}-${index}`}>• {source.label}{source.note ? <span className="text-[#6f8c7f]"> — {source.note}</span> : null}</li>)}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {thinking && <div className="inline-flex items-center gap-1.5 rounded-2xl bg-white/[0.03] px-3 py-2 text-[8px] text-[#9fb6aa]"><span className="flex gap-0.5"><span className="h-1 w-1 animate-pulse rounded-full bg-mint-300" /><span className="h-1 w-1 animate-pulse rounded-full bg-mint-300 [animation-delay:150ms]" /><span className="h-1 w-1 animate-pulse rounded-full bg-mint-300 [animation-delay:300ms]" /></span>کشاورزیار دفتر و دانشنامه را بررسی می‌کند…</div>}
            </div>
            <div className="border-t border-white/[0.06] p-2.5">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {(lastBot?.meta?.followUps?.length ? lastBot.meta.followUps : suggestions).slice(0, 5).map((sample) => <button key={sample} type="button" onClick={() => ask(sample)} className="rounded-lg border border-white/[0.07] px-2 py-1 text-[8px] text-[#93ad9f] transition hover:border-mint-300/20 hover:text-mint-300">{sample}</button>)}
              </div>
              <form onSubmit={(event) => { event.preventDefault(); ask(question); }} className="flex gap-2">
                <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="مثلاً: آیا چک چاپی معتبر است؟ / چقدر طلب دارم؟" className="field flex-1 py-2 text-[10px]" aria-label="سؤال از کشاورزیار" />
                <button type="submit" disabled={thinking || !question.trim()} className="grid h-9 w-9 place-items-center rounded-xl bg-mint-400 text-[#07110d] disabled:opacity-40" aria-label="ارسال"><Send className="h-4 w-4" /></button>
              </form>
              <p className="mt-1.5 text-[7px] leading-4 text-[#6f8c7f]"><ShieldCheck className="ml-1 inline h-2.5 w-2.5" />پاسخ عددی فقط از دفتر شما؛ پاسخ حقوقی راهنمای عمومی است و جای مشاورهٔ رسمی را نمی‌گیرد.</p>
            </div>
          </section>
          <div className="space-y-3">
            <section className="glass rounded-[22px] p-4">
              <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-white"><History className="h-3.5 w-3.5 text-mint-300" /> وضعیت لحظه‌ای دفتر</h2>
              <div className="space-y-2">
                {[["مانده طلب", money(totals.receivable)], ["مانده بدهی", money(totals.payable)], ["سود دفتر مالی", money(fin.profit)], ["مانده فروش محصول", money(saleRemaining)], ["چک‌های نزدیک سررسید", `${toPersianDigits(cheques.dueSoon)} فقره`], ["اقلام کم‌موجود", `${toPersianDigits(lowItems.length)} قلم`]].map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-white/[0.05] pb-1.5 text-[9px] last:border-0"><span className="text-[#819d90]">{label}</span><span className="font-medium text-[#dcebe2]">{value}</span></div>)}
              </div>
            </section>
            <section className="glass rounded-[22px] p-4">
              <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-white"><BookOpen className="h-3.5 w-3.5 text-mint-300" /> مغز و حافظهٔ کشاورزیار</h2>
              <div className="grid grid-cols-3 gap-1.5">
                {[[assistantStats.entries, "دانشنامه"], [assistantStats.glossary, "اصطلاح"], [assistantStats.patterns, "الگوی پرسش"]].map(([value, label]) => <div key={label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-1.5 py-2 text-center"><div className="text-sm font-bold text-mint-300">{toPersianDigits(Number(value))}</div><div className="mt-0.5 text-[7px] text-[#819d90]">{label}</div></div>)}
              </div>
              <p className="mt-2 text-[8px] leading-5 text-[#8ba79a]">پاسخ‌های عددی از {toPersianDigits(assistantStats.records)} رکورد دفتر شما و راهنماها از دانشنامهٔ حقوقی/کشاورزی ساخته می‌شوند. حافظه فقط روی همین دستگاه می‌ماند و هیچ متن یا سندی به اینترنت فرستاده نمی‌شود.</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <a href="#documents" className="rounded-lg border border-mint-300/15 bg-mint-300/[0.05] px-2 py-1.5 text-center text-[8px] text-mint-300">بازبینی حقوقی اسناد</a>
                <a href="#signatures" className="rounded-lg border border-white/[0.07] px-2 py-1.5 text-center text-[8px] text-[#b9cec3]">امضا و چاپ</a>
              </div>
            </section>
            <section className="rounded-2xl border border-sand-300/15 bg-sand-300/[0.04] p-3">
              <h2 className="mb-1 flex items-center gap-1.5 text-[9px] font-semibold text-sand-300"><Lightbulb className="h-3.5 w-3.5" /> پیشنهاد پرسش</h2>
              <div className="flex flex-wrap gap-1.5">{suggestions.slice(0, 4).map((sample) => <button key={sample} type="button" onClick={() => ask(sample)} className="rounded border border-white/[0.06] px-1.5 py-1 text-[7px] text-[#a9c1b5]">{sample}</button>)}</div>
            </section>
          </div>
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
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[11px] font-semibold text-white">مشخصات پروفایل</h2>
              <a href="#profile" className="rounded-lg border border-mint-300/20 bg-mint-300/[0.06] px-2.5 py-1 text-[8px] text-mint-300">ویرایش پروفایل</a>
            </div>
            <div className="space-y-2">
              {(() => { const rows: [string, string][] = [["نام کسب‌وکار", profileDisplayName(profile)], ["مالک / مدیر", profile.fullName || "—"], ["شناسه ملی", profile.nationalId || "—"], ["مزرعه", profile.farmName || "—"], ["موقعیت", profileFarmLine(profile)], ["نسخه برنامه", toPersianDigits("1.0.0")], ["تاریخ امروز", formatJalali(todayJalali(), "long")]]; return rows.map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-2.5 py-2 text-[9px]"><span className="text-[#819d90]">{label}</span><span className="text-[#d3e4da]">{value}</span></div>); })()}
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
