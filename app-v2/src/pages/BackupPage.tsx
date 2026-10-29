import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  BrainCircuit,
  CalendarDays,
  Check,
  ClipboardCopy,
  Database,
  Download,
  Eraser,
  HelpCircle,
  History,
  ImagePlus,
  Lightbulb,
  Percent,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "../utils/cn";
import type { SavedContract } from "../lib/data";
import { useProfile, profileDisplayName, profileFarmLine } from "../lib/profile";
import { formatJalali, toPersianDigits, todayJalali } from "../lib/format";
import { formatAmount } from "../lib/money-format";
import {
  chequeTotals,
  financeTotals,
  ledgerTotals,
  partyTotals,
  type DebtParty,
  type FinanceEntry,
  type LedgerState,
  type PartyPayment,
} from "../lib/ledger";
import { tradeBalance, type CropTrade } from "../lib/trade";
import type { CropPlot } from "../lib/samples";
import {
  assistantSuggestedQuestions,
  clearAssistantMessages,
  greeting,
  loadAssistantMessages,
  makeAssistantMessage,
  saveAssistantMessages,
  type AssistantMessage,
} from "../lib/ai/engine";
import { askCloud, type CloudSection } from "../lib/ai/cloud-chat";
import { parseActionPlan } from "../lib/ai/actions";
import type { LeaseSignature, RentPaymentRecord } from "./RentalsPage";
import { loadReceipts, replaceReceipts, type StoredReceipt } from "../lib/receipts";
import { Toast } from "../components/ui";
import { GuideCenter } from "../components/GuideCenter";

// مبلغ/عدد با ارقام لاتین و جداکنندهٔ هزارگان (یکدست در کل برنامه)
const fa = (value: number) => formatAmount(value, { decimals: 0 });
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
  /** رسیدها و تصاویر base64 هم باید در پشتیبان بیایند؛ در نسخهٔ قبل جا افتاده بودند. */
  receipts?: StoredReceipt[];
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
  onAddParty,
  onAddPayment,
  onAddEntry,
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
  onAddParty: (party: DebtParty) => void;
  onAddPayment: (payment: PartyPayment) => void;
  onAddEntry: (entry: FinanceEntry) => void;
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
  const suggestions = useMemo(() => assistantSuggestedQuestions(assistantContext), [assistantContext]);
  const lastBot = [...messages].reverse().find((message) => message.role === "bot" && message.meta?.followUps?.length);

  useEffect(() => {
    saveAssistantMessages(messages);
  }, [messages]);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, thinking]);

  // کشاورزیار: پاسخ متنی یا ثبت واقعی در دفتر — موتور محلی در چت خاموش است.
  const [section, setSection] = useState<CloudSection>("assistant");
  const [attachment, setAttachment] = useState<{ dataUrl: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const partyFacts = useMemo(
    () => ledger.parties.slice(0, 40).map((party) => ({ id: party.id, name: party.name, kind: party.kind, balance: partyTotals(party, ledger.payments).balance })),
    [ledger]
  );

  const pickImage = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setToast("فقط فایل تصویری مجاز است."); return; }
    if (file.size > 3_500_000) { setToast("حجم تصویر زیاد است؛ حداکثر ۳.۵ مگابایت."); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read-failed"));
      reader.readAsDataURL(file);
    }).catch(() => "");
    if (dataUrl) setAttachment({ dataUrl, name: file.name });
  };

  /** اجرای برنامهٔ کنش؛ فقط کنش‌های مجاز و اعتبارسنجی‌شده. */
  const runPlan = (raw: unknown): { say: string; done: string[]; question?: string } => {
    const validation = parseActionPlan(JSON.stringify(raw));
    if (!validation.ok || !validation.plan) {
      return { say: "نتوانستم این درخواست را به ثبت امن تبدیل کنم.", done: [], question: validation.errors.join("، ") || undefined };
    }
    const plan = validation.plan;
    const done: string[] = [];
    const today = todayJalali();
    plan.actions.forEach((action, index) => {
      if (action.type === "party.create") {
        const party: DebtParty = {
          id: `party-${Date.now()}-${index}`,
          name: action.name,
          phone: action.phone ?? "",
          city: action.city ?? profile.city ?? "",
          kind: action.kind,
          amount: action.amount,
          reason: action.reason,
          date: today,
          dueDate: null,
          note: "",
          color: "mint",
        };
        onAddParty(party);
        done.push(`${action.kind === "debtor" ? "بدهکار" : "بستانکار"} ثبت شد: ${action.name} — ${formatAmount(action.amount)} تومان بابت ${action.reason}`);
        return;
      }
      if (action.type === "party.payment.add") {
        const payment: PartyPayment = { id: `pay-${Date.now()}-${index}`, partyId: action.partyId, date: today, amount: action.amount, method: action.method === "card" ? "credit" : action.method, note: action.note ?? "" };
        onAddPayment(payment);
        done.push(`پرداخت ثبت شد: ${formatAmount(action.amount)} تومان`);
        return;
      }
      if (action.type === "entry.add") {
        const entry: FinanceEntry = {
          id: `fin-${Date.now()}-${index}`,
          kind: action.kind,
          date: today,
          amount: action.amount,
          reason: action.reason,
          category: action.category ?? (action.kind === "income" ? "سایر درآمد" : "سایر هزینه"),
          method: "cash",
          partyId: null,
          note: "",
        };
        onAddEntry(entry);
        done.push(`${action.kind === "income" ? "درآمد" : "هزینه"} ثبت شد: ${formatAmount(action.amount)} تومان بابت ${action.reason}`);
        return;
      }
      if (action.type === "answer") done.push(action.text);
    });
    return { say: plan.say, done, question: plan.question };
  };

  const ask = async (text: string) => {
    const value = text.trim();
    if ((!value && !attachment) || thinking) return;
    const history = messages.slice(-8).map((message) => ({ role: (message.role === "bot" ? "assistant" : "user") as "user" | "assistant", content: message.text }));
    const shown = attachment ? `${value || "این تصویر را تحلیل کن"} · 📷 ${attachment.name}` : value;
    setMessages((current) => [...current, makeAssistantMessage("user", shown)]);
    setQuestion("");
    setThinking(true);

    const result = await askCloud({
      message: value || "این تصویر را تحلیل کن.",
      history,
      section,
      mode: "auto",
      image: attachment?.dataUrl,
      context: {
        today: formatJalali(todayJalali(), "short"),
        parties: partyFacts,
        profile: { city: profile.city },
      },
    });

    if (!result.ok) {
      setMessages((current) => [
        ...current,
        makeAssistantMessage("bot", `کشاورزیار الان جواب نداد (موتور محلی خاموش است).\n${result.error}\n\nاینترنت یا VPN را بررسی کن و دوباره بفرست.`, {
          confidence: 0, category: "برنامه", sources: [], followUps: [], matchedId: "cloud-error", kind: "fallback", engine: "cloud-error",
        }),
      ]);
      setThinking(false);
      return;
    }

    if (result.mode === "text") {
      setMessages((current) => [
        ...current,
        makeAssistantMessage("bot", result.text, { confidence: 86, category: "کشاورزی", sources: [], followUps: [], matchedId: "keshavaryar", kind: "knowledge", engine: "cloud", model: "کشاورزیار" }),
      ]);
    } else {
      const executed = runPlan(result.plan);
      const lines = [executed.say, ...executed.done].filter(Boolean);
      const body = lines.length ? lines.join("\n") : "انجام شد.";
      setMessages((current) => [
        ...current,
        makeAssistantMessage("bot", executed.question ? `${body}\n\n${executed.question}` : body, {
          confidence: 92, category: "دفتر مالی", sources: [], followUps: [], matchedId: "keshavaryar-action", kind: "data", engine: "cloud", model: "کشاورزیار",
        }),
      ]);
      if (executed.done.length) setToast("کشاورزیار رکورد را ثبت کرد.");
    }
    setAttachment(null);
    setThinking(false);
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
    receipts: loadReceipts(),
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
      let restoredReceipts = 0;
      if (Array.isArray(parsed.receipts)) {
        const receiptResult = replaceReceipts(parsed.receipts);
        if (!receiptResult.ok) throw new Error(receiptResult.error ?? "بازیابی رسیدها ممکن نشد.");
        restoredReceipts = receiptResult.count;
      }
      onRestore(parsed);
      setToast(`پشتیبان بازیابی شد${restoredReceipts > 0 ? `؛ ${toPersianDigits(restoredReceipts)} رسید هم بازگردانده شد` : ""}.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "فایل پشتیبان معتبر نیست.");
    }
  };

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
          <p className="mt-1.5 max-w-2xl text-[11px] font-light leading-6 text-[#89a598]">کشاورزیار: ثبت در دفتر، مشاور کشت و نهاده، خواندن تصویر و پاسخ به پرسش‌های دفتری؛ تحلیل‌ها از مغز زنده می‌آید و اعداد دفتر از خود برنامه. حافظهٔ گفتگو روی دستگاه می‌ماند.</p>
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
                <h2 className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-white">کشاورزیار <span className="rounded bg-mint-300/10 px-1.5 py-0.5 text-[7px] font-medium text-mint-300">دستیار هوشمند</span></h2>
                <p className="mt-0.5 truncate text-[8px] text-[#78968a]">کشاورزیار · ثبت مستقیم در دفتر · تحلیل تصویر</p>
              </div>
              <button type="button" onClick={() => { window.location.hash = "#crop-plan"; }} className="flex shrink-0 items-center gap-1 rounded-lg border border-mint-300/25 bg-mint-300/[0.08] px-2 py-1.5 text-[8px] text-mint-300 transition hover:bg-mint-300/15" aria-label="رفتن به تقویم کشت و نهاده"><CalendarDays className="h-3 w-3" /> تقویم کشت</button>
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
                      <span className={cn("rounded px-1.5 py-0.5", message.meta.engine === "cloud" ? "bg-[#60a5fa]/[0.1] text-[#9cc4f5]" : message.meta.engine === "cloud-error" ? "bg-[#f87171]/[0.1] text-[#f0a59a]" : "bg-white/[0.04] text-[#93ad9f]")}>{message.meta.engine === "cloud" ? (message.meta.model ?? "کشاورزیار") : message.meta.engine === "cloud-error" ? "بدون پاسخ" : "آفلاین · محلی"}</span>
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
              {thinking && <div className="inline-flex items-center gap-1.5 rounded-2xl bg-white/[0.03] px-3 py-2 text-[8px] text-[#9fb6aa]"><span className="flex gap-0.5"><span className="h-1 w-1 animate-pulse rounded-full bg-mint-300" /><span className="h-1 w-1 animate-pulse rounded-full bg-mint-300 [animation-delay:150ms]" /><span className="h-1 w-1 animate-pulse rounded-full bg-mint-300 [animation-delay:300ms]" /></span>کشاورزیار در حال تفکر است…</div>}
            </div>
            <div className="border-t border-white/[0.06] p-2.5">
              <div className="mb-2 flex flex-wrap items-center gap-1">
                <span className="ml-1 text-[7px] text-[#5f7d70]">حوزهٔ تحلیل:</span>
                {([["assistant", "عمومی"], ["crops", "کشت و نهاده"], ["parties", "دفتر"], ["finance", "مالی"], ["inventory", "انبار"], ["trade", "بازار"], ["documents", "اسناد"]] as const).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setSection(key)} className={cn("rounded-lg px-2 py-1 text-[8px] transition", section === key ? "bg-mint-400/15 text-mint-300" : "text-[#78968a] hover:text-white")}>{label}</button>
                ))}
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {(lastBot?.meta?.followUps?.length ? lastBot.meta.followUps : suggestions).slice(0, 5).map((sample) => <button key={sample} type="button" onClick={() => ask(sample)} className="rounded-lg border border-white/[0.07] px-2 py-1 text-[8px] text-[#93ad9f] transition hover:border-mint-300/20 hover:text-mint-300">{sample}</button>)}
              </div>
              {attachment && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-mint-300/20 bg-mint-300/[0.05] px-2 py-1.5">
                  <img src={attachment.dataUrl} alt="تصویر پیوست" className="h-8 w-8 rounded object-cover" />
                  <span className="flex-1 truncate text-[8px] text-[#a9c1b5]">{attachment.name}</span>
                  <button type="button" onClick={() => setAttachment(null)} className="text-[#93ad9f] hover:text-white" aria-label="حذف تصویر"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}
              <form onSubmit={(event) => { event.preventDefault(); ask(question); }} className="flex gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void pickImage(event.target.files?.[0]); event.target.value = ""; }} aria-label="انتخاب تصویر" />
                <button type="button" onClick={() => fileRef.current?.click()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] text-[#93ad9f] transition hover:text-white" aria-label="ارسال تصویر به کشاورزیار"><ImagePlus className="h-4 w-4" /></button>
                <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="مثلاً: برای رضا ۲ میلیون بدهی ثبت کن / چقدر طلب دارم؟ / این برگه را بخوان" className="field flex-1 py-2 text-[10px]" aria-label="سؤال از کشاورزیار" />
                <button type="submit" disabled={thinking || (!question.trim() && !attachment)} className="grid h-9 w-9 place-items-center rounded-xl bg-mint-400 text-[#07110d] disabled:opacity-40" aria-label="ارسال"><Send className="h-4 w-4" /></button>
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

      {tab === "help" && <GuideCenter />}

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
