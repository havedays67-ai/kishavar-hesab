/**
 * موتور «کشاورزیار» — ترکیب دفتر واقعی کاربر + دانشنامهٔ محلی + حافظهٔ دستگاه
 * -------------------------------------------------------------------------
 * ۱) پرسش فارسی نرمال‌سازی می‌شود (ي/ك، اعداد، نیم‌فاصله و مترادف‌ها).
 * ۲) اگر پرسش عددی باشد، پاسخ فقط از داده‌های واقعی دفتر ساخته می‌شود.
 * ۳) در غیر این صورت، دانشنامه با امتیازدهی واژگانی جست‌وجو می‌شود.
 * ۴) درصد اطمینان، بر اساس پوشش واژه‌ها و فاصلهٔ بهترین نتیجه محاسبه می‌شود.
 * ۵) حافظهٔ گفتگو در localStorage می‌ماند و هیچ داده‌ای ارسال نمی‌شود.
 */
import {
  EXPENSE_CATEGORIES,
  chequeTotals,
  entryTotalsByCategory,
  financeTotals,
  inventoryValue,
  ledgerTotals,
  loanSchedule,
  partyTotals,
  type LedgerState,
} from "../ledger";
import { plotMetrics, type CropPlot } from "../samples";
import { tradeBalance, type CropTrade, getProductProfile } from "../trade";
import type { SavedContract } from "../data";
import { formatJalali, toPersianDigits, todayJalali } from "../format";
import { LearnedCache } from "../nlu/learned-cache";
import { smallPack } from "../nlu/generated/pack-small";
import { routeFast, fastLayerMetrics, type RouteResult } from "../nlu/router";
import { findMarkedQA, markedSuggestions } from "./qa-bank";
import { solveMath } from "./math-engine";
import {
  ASSISTANT_GLOSSARY,
  KNOWLEDGE,
  LEGAL_DISCLAIMER,
  PERSIAN_SYNONYMS,
  knowledgeStats,
  type KnowledgeCategory,
  type KnowledgeEntry,
  type KnowledgeSource,
} from "./knowledge";
import { matchAuthorityQuestion } from "../document-validity";

export interface AssistantContext {
  ledger: LedgerState;
  trades: CropTrade[];
  plots: CropPlot[];
  contracts: SavedContract[];
}

export interface AssistantMeta {
  confidence: number;
  category: KnowledgeCategory | "دفتر مالی";
  sources: KnowledgeSource[];
  followUps: string[];
  matchedId: string;
  kind: "data" | "knowledge" | "fallback" | "social";
  highStakes?: boolean;
  /** از کدام موتور آمده: مدل زندهٔ ابری یا موتور محلی. */
  engine?: "cloud" | "local" | "cloud-error";
  /** نام مدل زنده (وقتی engine === "cloud"). */
  model?: string;
  /** لایهٔ فهم سریع که این پاسخ را مسیریابی کرد (قواعد/بسته/کش/بازیابی/مدل) */
  fastLayer?: string;
  fastIntent?: string;
  fastLatencyMs?: number;
  fastConfidence?: number;
}

export interface AssistantReply {
  text: string;
  meta: AssistantMeta;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  at: number;
  meta?: AssistantMeta;
}

const MEMORY_KEY = "kishavar.assistant.memory.v3";

/* ---------------- لایهٔ فهم سریع (قواعد → بسته/کش → بازیابی) ---------------- */
let nluCache: LearnedCache | null = null;
let nluPack = null as ReturnType<typeof smallPack> | null;

function fastUnderstand(raw: string): RouteResult {
  try {
    if (!nluCache) nluCache = new LearnedCache(undefined, 400);
    if (!nluPack) nluPack = smallPack();
    const result = routeFast(raw, { mode: "support", pack: nluPack, cache: nluCache });
    fastLayerMetrics.setPackBytes(nluPack.manifest.bytes);
    return result;
  } catch {
    return { layer: "clarify", intent: "unknown", slots: {}, confidence: 0, latencyMs: 0, normalized: "", matched: "error" };
  }
}

function withFast(reply: AssistantReply, fast: RouteResult): AssistantReply {
  return {
    ...reply,
    meta: {
      ...reply.meta,
      fastLayer: fast.layer,
      fastIntent: fast.intent,
      fastLatencyMs: fast.latencyMs,
      fastConfidence: fast.confidence,
    },
  };
}

export function fastLayerSnapshot() {
  return { pack: nluPack?.manifest ?? null, metrics: fastLayerMetrics.snapshot(), cache: nluCache?.stats() ?? null };
}


const STOPWORDS = new Set(
  [
    "از", "به", "با", "در", "که", "را", "این", "آن", "است", "هست", "برای", "چه", "چی", "چطور", "چگونه",
    "چقدر", "چند", "می", "می‌خواهم", "میخوام", "خواهم", "باید", "یک", "و", "یا", "هم", "من", "ما", "شما",
    "مال", "مربوط", "درباره", "باره", "کن", "کنم", "کنید", "شود", "شد", "باشد", "بود", "های", "هایی",
    "طور", "الان", "امروز", "لطفا", "لطفاً", "سلام", "خوبی", "هستم", "نیست", "دارم", "دارید", "دارد",
    "کرد", "کرده", "کنیم", "شده", "دیگر", "اگر", "تا", "بر", "پس", "همین", "کدام", "کی", "کجا", "آیا",
  ].map((word) => word.replace(/\u200c/g, ""))
);

const ARABIC_MAP: Record<string, string> = { ي: "ی", ى: "ی", ك: "ک", ة: "ه", ۀ: "ه", أ: "ا", إ: "ا", آ: "ا", ؤ: "و", ئ: "ی" };
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizePersian(input: string): string {
  return input
    .replace(/[\u200c\u200d\u200e\u200f]/g, " ")
    .replace(/[يىك ةۀأإآؤئ]/g, (character) => ARABIC_MAP[character] ?? character)
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[.,؟?!:;،؛()"'«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stem(word: string): string {
  if (word.length <= 3) return word;
  for (const suffix of ["هایی", "های", "هایی", "تری", "ترین", "ها", "تر", "ام", "ات", "اش", "مان", "شان", "تان", "ای", "ی"]) {
    if (word.length - suffix.length >= 3 && word.endsWith(suffix)) return word.slice(0, -suffix.length);
  }
  return word;
}

export function tokenize(input: string): string[] {
  const normalized = normalizePersian(input);
  const words = normalized
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => stem(word))
    .filter((word) => word.length >= 2 && !STOPWORDS.has(word));
  return Array.from(new Set(words));
}

const fa = (value: number) => toPersianDigits(Math.round(value).toLocaleString("en-US"));
const money = (value: number) => `${fa(value)} تومان`;

function hasAny(text: string, values: string[]): boolean {
  return values.some((value) => text.includes(value));
}

const TAG_CACHE = new Map<string, RegExp>();

/**
 * تطبیق واژه با «مرز واژه» و نه زیررشته.
 * چرا مهم است: پیش‌تر «دام» داخل «کدام» و «جو» داخل «موجودی» تطبیق داده می‌شد؛
 * نتیجه این بود که «کدام زمین سود بیشتری دارد؟» پرسش دام و مرغ می‌شد و
 * «موجودی انبار چقدر است؟» پاسخ «فروش جو» می‌گرفت. این تابع فقط وقتی تطبیق
 * می‌دهد که واژه از ابتدای یک کلمه شروع شود؛ پسوندهایی مثل «بدهکارم» برای
 * «بدهکار» همچنان پذیرفته می‌شوند.
 */
function hasTag(text: string, values: string[]): boolean {
  return values.some((value) => {
    const term = normalizePersian(value);
    if (!term) return false;
    let pattern = TAG_CACHE.get(term);
    if (!pattern) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}`, "u");
      TAG_CACHE.set(term, pattern);
    }
    return pattern.test(text);
  });
}

/**
 * پرسش کشاورزی/فنی است یا پرسش از دفتر خود کاربر؟
 * این تفکیک جلوی خطای واقعی را می‌گیرد: «آبیاری گندم چند نوبت؟» نباید
 * با پاسخ «معاملهٔ محصولی ثبت نشده» جواب داده شود.
 */
const AGRONOMY_TERMS = [
  "آبیاری", "آب دادن", "آبدهی", "نیاز آبی", "کود", "اوره", "فسفر", "پتاس", "بذر", "سم", "سمپاشی", "آفت", "بیماری",
  "علف", "برداشت", "رطوبت", "شوری", "خاک", "کشت", "داشت", "گندم", "جو", "ذرت", "کلزا", "زعفران", "پسته", "گوجه",
  "سیب زمینی", "سیب‌زمینی", "یونجه", "چغندر", "دام", "گاو", "گوسفند", "بره", "مرغ", "جوجه", "باغ", "عملکرد",
  "هکتار", "کارنس", "بیمه محصول", "بیمهٔ محصول", "گلخانه", "رقم", "پیاز", "کلاله", "علوفه", "جیره", "خوراک",
];

const OWN_LEDGER_TERMS = [
  "دفتر من", "حساب من", "مزرعه من", "برای من", "به من", "از من", "من چقدر", "چقدر طلب", "چقدر بدهی",
  "مانده", "باقی", "ثبت شده", "ثبت کردم", "فروختم", "خریدم", "پرداخت کردم", "دریافت کردم", "بدهکار", "بستانکار",
  "معوق", "موجودی انبار", "چک‌های من", "چک های من", "چک من", "اقساط من", "وام من", "سود من", "درآمد من",
  "هزینهٔ من", "هزینه من", "این فصل", "امسال", "تا امروز", "وضعیت مالی", "وضعیت انبار", "در دفتر", "در برنامه",
];

/** نشانه‌های پرسش از «پول و دفتر خود کاربر» — حتی اگر واژهٔ کشاورزی هم در جمله باشد. */
const LEDGER_SIGNALS = [
  "هزینه", "خرج", "پرداخت", "خرید", "خریدم", "فروش", "فروختم", "درآمد", "سود", "زیان", "ضرر",
  "تومان", "پول", "نقد", "دفتر", "حساب", "مانده", "بدهی", "طلب", "چک", "قسط", "وام", "انبار",
  "موجودی", "فاکتور", "رسید", "قیمت خرید", "قیمت فروش",
];

function isAgronomyQuestion(text: string): boolean {
  return hasTag(text, AGRONOMY_TERMS);
}

function isOwnLedgerQuestion(text: string): boolean {
  if (hasTag(text, OWN_LEDGER_TERMS)) return true;
  return /(^|\s)من(\s|$|\؟|\?)/.test(text) || /(طلبم|بدهیم|بدهی‌ام|بدهی ام|حسابم|دفترم|مزرعه‌ام|مزرعه ام|فروشم|خریدم)/.test(text);
}

function isDataQuestion(text: string): boolean {
  return hasTag(text, [
    "چقدر", "چند", "مانده", "جمع", "وضعیت", "هشدار", "ریسک", "کدام", "دفتر من", "حساب من", "سود", "هزینه", "درآمد",
    "طلب من", "بدهی من", "بدهی", "بدهکار", "بستانکار", "معوق", "سررسید", "موجودی", "انبار", "قسط", "وام", "تحلیل",
    "بیشترین", "بزرگ‌ترین", "بزرگترین", "نقد", "پول", "کارگر", "دستمزد", "کی بیشترین", "چه کسی",
  ]);
}

function signatureMeta(
  confidence: number,
  category: KnowledgeCategory | "دفتر مالی",
  sources: KnowledgeSource[],
  followUps: string[],
  matchedId: string,
  kind: AssistantMeta["kind"],
  highStakes = false
): AssistantMeta {
  return { confidence: Math.max(35, Math.min(98, Math.round(confidence))), category, sources, followUps, matchedId, kind, highStakes };
}

/* ------------------------------- داده‌ها ------------------------------- */

function snapshot(context: AssistantContext) {
  const totals = ledgerTotals(context.ledger);
  const finance = financeTotals(context.ledger.entries);
  const cheques = chequeTotals(context.ledger.cheques);
  const sale = context.trades.reduce((sum, trade) => sum + trade.result.netReceipt, 0);
  const saleRemaining = context.trades.reduce((sum, trade) => sum + tradeBalance(trade).remaining, 0);
  const cropCost = context.plots.reduce((sum, plot) => sum + plotMetrics(plot).cost, 0);
  const rentIncome = context.contracts.filter((contract) => contract.myRole === "landlord").reduce((sum, contract) => sum + contract.rent, 0);
  const rentExpense = context.contracts.filter((contract) => contract.myRole === "tenant").reduce((sum, contract) => sum + contract.rent, 0);
  const deposit = context.contracts.reduce((sum, contract) => sum + contract.deposit, 0);
  const lowItems = context.ledger.items.filter((item) => item.stock <= item.min);
  const nearestCheque = context.ledger.cheques
    .filter((cheque) => cheque.status === "pending")
    .slice()
    .sort((a, b) => `${a.due.jy}${a.due.jm}${a.due.jd}`.localeCompare(`${b.due.jy}${b.due.jm}${b.due.jd}`))[0];
  const nextInstallments = context.ledger.loans
    .map((loan) => ({ loan, next: loanSchedule(loan).find((row) => !row.paid) }))
    .filter((row) => row.next);
  const debtorRows = context.ledger.parties
    .filter((party) => party.kind === "debtor")
    .map((party) => ({ party, totals: partyTotals(party, context.ledger.payments) }))
    .sort((a, b) => b.totals.balance - a.totals.balance);
  const creditorRows = context.ledger.parties
    .filter((party) => party.kind === "creditor")
    .map((party) => ({ party, totals: partyTotals(party, context.ledger.payments) }))
    .sort((a, b) => b.totals.balance - a.totals.balance);
  const healthyPlots = context.plots.map((plot) => ({ plot, metrics: plotMetrics(plot) })).sort((a, b) => b.metrics.profit - a.metrics.profit);
  const alerts = [
    totals.overdue > 0 ? `ماندهٔ معوق ${money(totals.overdue)}` : null,
    saleRemaining > 0 ? `ماندهٔ فروش وصول‌نشده ${money(saleRemaining)}` : null,
    cheques.bounced > 0 ? `${toPersianDigits(cheques.bounced)} چک برگشتی` : null,
    cheques.dueSoon > 0 ? `${toPersianDigits(cheques.dueSoon)} چک نزدیک سررسید` : null,
    lowItems.length > 0 ? `${toPersianDigits(lowItems.length)} قلم کمبود انبار` : null,
    finance.profit < 0 ? "هزینه‌ها از درآمد دوره بیشتر است" : null,
  ].filter((alert): alert is string => Boolean(alert));
  return { totals, finance, cheques, sale, saleRemaining, cropCost, rentIncome, rentExpense, deposit, lowItems, nearestCheque, nextInstallments, debtorRows, creditorRows, healthyPlots, alerts };
}

function dataAnswer(text: string, context: AssistantContext): AssistantReply | null {
  const data = snapshot(context);
  const allCheques = context.ledger.cheques;
  const source: KnowledgeSource[] = [{ label: "دفتر مالی و اسناد ثبت‌شدهٔ شما در همین برنامه", note: "پاسخ عددی از دادهٔ واقعی، بدون تخمین" }];

  // «بدهی … به من» یعنی کسی به من بدهکار است (طلب)، نه بدهی من به دیگران.
  if (hasTag(text, ["طلب", "طلبکار", "دریافتنی", "مطالبات"]) || /(کسی به من بدهکار|بیشترین بدهکار|بزرگ.?ترین بدهکار|بدهکاران|بدهکار من|بدهی[^.]{0,25}به من)/.test(text)) {
    const top = data.debtorRows[0];
    const body = data.debtorRows.length
      ? `مجموع طلب شما ${money(data.totals.receivable)} است.${data.totals.overdue > 0 ? ` از این مبلغ، ${money(data.totals.overdue)} معوق است.` : " ماندهٔ معوق ندارید."}${top ? `\nبزرگ‌ترین بدهکار: ${top.party.name} — ${money(top.totals.balance)} — بابت: ${top.party.reason || "ثبت نشده"}.` : ""}`
      : "هنوز طرف‌حساب بدهکاری ثبت نشده است. در صفحهٔ «بدهکار و بستانکار» اولین طلب را با دلیل و تاریخ ثبت کنید.";
    return {
      text: `${body}\nپیشنهاد: ${data.totals.overdue > 0 ? "ابتدا ماندهٔ معوق را با صورت‌حساب و پیام کتبی پیگیری کنید؛ پرداخت‌ها را همان روز ثبت کنید." : "برای طلب‌های سررسیدنشده، سررسید و صورت‌حساب امضاشده تعیین کنید تا پیگیری ساده‌تر شود."}`,
      meta: signatureMeta(98, "دفتر مالی", source, ["بیشترین بدهکار من کیست؟", "مانده معوق را چطور پیگیری کنم؟", "صورت‌حساب طرف‌حساب را چاپ کن"], "data-receivable", "data"),
    };
  }

  if (hasTag(text, ["بدهی", "بستانکار", "بدهکارم", "پرداختنی"])) {
    const top = data.creditorRows[0];
    const body = data.creditorRows.length
      ? `مجموع بدهی شما به طرف‌حساب‌ها ${money(data.totals.payable)} است.${top ? `\nبیشترین بدهی: ${top.party.name} — ${money(top.totals.balance)} — بابت: ${top.party.reason || "ثبت نشده"}.` : ""}`
      : "هنوز بستانکاری (بدهی شما به دیگران) ثبت نشده است؛ آن را با دلیل، مانده و سررسید در دفتر مالی ثبت کنید.";
    return {
      text: `${body}\nبرای جلوگیری از جریمه و بدرفتاری مالی، بدهی‌های دارای سررسید را پیش از عیدها/فصل پرداخت دوره‌بندی کنید و برای هر پرداخت رسید بگیرید.`,
      meta: signatureMeta(98, "دفتر مالی", source, ["چک‌های نزدیک سررسید", "جریان نقدی این ماه را تحلیل کن", "اقساط وام چطور است؟"], "data-payable", "data"),
    };
  }

  // وام و قسط پیش از چک بررسی می‌شود؛ وگرنه جملهٔ «اقساط وام من کی سررسیده؟»
  // به‌خاطر واژهٔ «سررسید» با گزارش چک‌ها جواب می‌گرفت.
  if (hasTag(text, ["وام", "قسط", "اقساط", "تسهیلات", "بازپرداخت"])) {
    return {
      text: data.nextInstallments.length
        ? `شما ${toPersianDigits(context.ledger.loans.length)} وام دارید. قسط‌های بعدی:\n${data.nextInstallments.map(({ loan, next }) => `• ${loan.title}: ${next ? `${formatJalali(next.due, "long")} — ${money(next.amount)}` : "—"}`).join("\n")}\n\nقبل از سررسید، مبلغ قسط را در جریان نقدی هفته کنار بگذارید. نرخ مؤثر و هزینهٔ کل بازپرداخت را برای تصمیم جدید مقایسه کنید.`
        : "وام فعالی با قسط باقی‌مانده ثبت نشده است. برای خرید ماشین یا سرمایه در گردش، جدول بازپرداخت و نرخ مؤثر را قبل از پذیرش وام بسنجید.",
      meta: signatureMeta(98, "دفتر مالی", source, ["جریان نقدی این ماه", "چطور توان بازپرداخت وام را حساب کنم؟", "بدهی و طلب را کنار هم ببین"], "data-loans", "data"),
    };
  }

  if (hasTag(text, ["چک", "سررسید", "برگشتی"])) {
    const legalTone = hasTag(text, ["قانون", "معتبر", "صیاد", "چاپ", "امضا", "پشت", "انتقال"]);
    if (!legalTone) {
      const nearest = data.nearestCheque;
      const rows = allCheques.slice(0, 5).map((cheque) => `• ${cheque.serial} — ${cheque.bank} — ${money(cheque.amount)} — سررسید ${formatJalali(cheque.due, "long")} — ${cheque.status === "pending" ? "در جریان" : cheque.status === "cleared" ? "وصول‌شده" : "برگشتی"}`).join("\n");
      const warning = data.cheques.bounced > 0 ? `\n${toPersianDigits(data.cheques.bounced)} چک برگشتی دارید؛ پروندهٔ هر کدام را جدا پیگیری کنید. ` : "";
      return {
        text: `${data.totals ? `در دفتر شما ${toPersianDigits(allCheques.length)} چک ثبت شده است: ${toPersianDigits(data.cheques.pending)} فقره در جریان.\nچک‌های دریافتی در جریان: ${money(data.cheques.receivable)}؛ چک‌های پرداختی: ${money(data.cheques.payable)}.${warning}${data.cheques.dueSoon > 0 ? `\n${toPersianDigits(data.cheques.dueSoon)} فقره سررسید نزدیک دارد.` : ""}` : ""}${nearest ? `\nنزدیک‌ترین سررسید: ${formatJalali(nearest.due, "long")} — ${nearest.bank} — ${money(nearest.amount)}.` : ""}${rows ? `\n${rows}` : ""}\n\nیادآوری حقوقی: ثبت در برنامه فقط دفتر مدیریتی است. وضعیت نهایی چک را در سامانهٔ صیاد سامانهٔ بانک کنترل کنید؛ چک ثبت‌نشده مشمول قانون چک نیست.`,
        meta: signatureMeta(97, "دفتر مالی", source, ["چک چاپی معتبر است؟", "مراحل ثبت چک در صیاد", "چک‌های نزدیک سررسید را نشان بده"], "data-chest", "data"),
      };
    }
  }

  if (hasAny(text, ["اجاره", "موجر", "مستاجر", "ودیعه", "مال‌الاجاره", "قرارداد زمین"])) {
    return {
      text: `در دفتر شما ${toPersianDigits(context.contracts.length)} قرارداد زمین ثبت شده است.\nاجارهٔ دریافتی (به‌عنوان موجر): ${money(data.rentIncome)}\nاجارهٔ پرداختی (به‌عنوان مستاجر): ${money(data.rentExpense)}\nجمع ودیعه‌های ثبت‌شده: ${money(data.deposit)}\n\nپیشنهاد: برای هر قرارداد، نسخهٔ امضاشده، صورت‌جلسهٔ تحویل زمین و عکس تأسیسات را پیوست کنید. برای مدت طولانی یا مبلغ بالا، ثبت رسمی و بررسی سند مالکیت را جدی بگیرید.`,
      meta: signatureMeta(98, "دفتر مالی", source, ["قرارداد زمین چه ارکانی دارد؟", "ودیعه و حقابه را چطور بنویسم؟", "رسید پرداخت اجاره را چاپ کن"], "data-lease", "data"),
    };
  }

  if (hasTag(text, ["فروش", "محصول", "محموله", "گندم", "جو", "ذرت", "کلزا"]) && hasTag(text, ["چقدر", "چند", "مانده", "درآمد", "سود", "آخرین", "قیمت"])) {
    const latest = context.trades[0];
    const product = latest ? getProductProfile(latest.productId) : null;
    return {
      text: context.trades.length
        ? `در ${toPersianDigits(context.trades.length)} معاملهٔ ثبت‌شده، خالص فروش ${money(data.sale)} است و ${money(data.saleRemaining)} هنوز وصول نشده است.${latest && product ? `\nآخرین محموله: ${product.name} به ${latest.buyerName} با وزن قابل پرداخت ${fa(latest.result.payableKg)} کیلوگرم و نرخ مؤثر ${money(latest.result.effectivePricePerKg)}.` : ""}\n\nقیمت داخل برنامه مرجع مذاکره است، نه نرخ روز؛ نرخ روز بازار/مصوبه و افت خریدار را قبل از امضا کنترل کنید.`
        : "هنوز معاملهٔ محصولی ثبت نشده است. در صفحهٔ «معامله محصول» وزن، افت، کیفیت و خریدار را وارد کنید تا خالص دریافتی و نرخ مؤثر محاسبه شود.",
      meta: signatureMeta(98, "دفتر مالی", source, ["نرخ مؤثر بعد از افت", "سودآورترین زمین", "چطور قرارداد فروش محصول ببندم؟"], "data-sales", "data"),
    };
  }

  if (hasTag(text, ["انبار", "موجودی", "کمبود", "نهاده"])) {
    const value = inventoryValue(context.ledger.items);
    const low = data.lowItems;
    return {
      text: `ارزش ثبت‌شدهٔ انبار ${money(value.inputs + value.products)} است.${low.length ? `\n${toPersianDigits(low.length)} قلم کمبود:\n${low.map((item) => `• ${item.name}: موجودی ${fa(item.stock)} ${item.unit} — حد ${fa(item.min)}`).join("\n")}` : "\nهیچ قلمی زیر حد سفارش نیست."}\n\nپیشنهاد: مصرف متوسط هفتگی را با موجودی بسنجید و خرید را با زمان کار مورد نیاز زمین هماهنگ کنید. برای نهاده، فاکتور، پروانه و تاریخ انقضا را کنترل کنید.`,
      meta: signatureMeta(98, "دفتر مالی", source, ["هزینه کود را چطور کنترل کنم؟", "ارزش دارایی من چقدر است؟", "گزارش انبار را چاپ کن"], "data-inventory", "data"),
    };
  }

  // هزینهٔ یک سرفصل مشخص: «هزینهٔ کود چقدر بوده؟» باید از دفتر جواب بگیرد،
  // نه از راهنمای عمومی انبار.
  if (hasTag(text, ["هزینه", "خرج", "خرید"]) && hasTag(text, ["کود", "سم", "بذر", "آب", "آبیاری", "سوخت", "کارگر", "دستمزد", "اجاره", "حمل", "تعمیر", "مالیات", "ماشین آلات", "بسته بندی"])) {
    const aliases: [RegExp, string][] = [
      [/(کود|سم|اوره|سولفات|آفت.?کش|علف.?کش)/, "کود و سم"],
      [/(بذر|نهال|نشا)/, "بذر و نهال"],
      [/(آب|آبیاری|انرژی|برق|گازوئیل|سوخت|گاز)/, "آب و انرژی"],
      [/(کارگر|دستمزد|حقوق)/, "کارگر و دستمزد"],
      [/(تراکتور|ماشین|ادوات)/, "ماشین‌آلات"],
      [/(تعمیر|سرویس|قطعه)/, "تعمیرات"],
      [/(اجاره)/, "اجاره زمین"],
      [/(حمل|کرایه|باربری)/, "حمل و نقل"],
      [/(مالیات|عوارض)/, "مالیات و عوارض"],
    ];
    const wanted = aliases.find(([pattern]) => pattern.test(text))?.[1];
    if (wanted && EXPENSE_CATEGORIES.includes(wanted)) {
      const rows = entryTotalsByCategory(context.ledger.entries).filter((row) => row.category === wanted);
      const total = rows.reduce((sum, row) => sum + row.expense, 0);
      const count = context.ledger.entries.filter((entry) => entry.kind === "expense" && entry.category === wanted).length;
      const share = data.finance.expense > 0 ? Math.round((total / data.finance.expense) * 100) : 0;
      return {
        text: total > 0
          ? `هزینهٔ «${wanted}» در دفتر شما ${money(total)} است (${toPersianDigits(count)} سند، ${toPersianDigits(share)}٪ کل هزینه‌ها).\nکل هزینهٔ ثبت‌شده ${money(data.finance.expense)} است.\n\nپیشنهاد: برای مقایسهٔ درست با سال قبل، همین سرفصل را در بازهٔ زمانی یکسان ببینید و فاکتورها را ضمیمه کنید.`
          : `در سرفصل «${wanted}» هنوز هزینه‌ای ثبت نشده است. اگر خریدی انجام شده، آن را با همین دسته ثبت کنید تا گزارش هزینه و بهای تمام‌شده دقیق شود.`,
        meta: signatureMeta(97, "دفتر مالی", source, ["بزرگ‌ترین سرفصل هزینهٔ من کدام است؟", "تفکیک هزینه‌ها را نشان بده", "سود این ماه چقدر است؟"], "data-expense-category", "data"),
      };
    }
  }

  if (hasTag(text, ["کارگر", "دستمزد", "حقوق", "نفر روز", "نفرروز"])) {
    const labor = entryTotalsByCategory(context.ledger.entries).filter((row) => row.expense > 0 && /کارگر|دستمزد|حقوق/.test(row.category));
    const laborTotal = labor.reduce((sum, row) => sum + row.expense, 0);
    const laborCount = context.ledger.entries.filter((entry) => entry.kind === "expense" && /کارگر|دستمزد|حقوق/.test(entry.category)).length;
    return {
      text: laborTotal > 0
        ? `جمع دستمزد ثبت‌شده در دفتر شما ${money(laborTotal)} است (${toPersianDigits(laborCount)} سند).\nتفکیک: ${labor.map((row) => `${row.category}: ${money(row.expense)}`).join(" — ")}\n\nتوجه: برنامه دفتر کارگر مستقل ندارد؛ برای پیگیری نفر-روز هر کارگر، در یادداشت همان سند نام کارگر و تعداد روز را بنویسید.`
        : "هنوز سند دستمزدی با دستهٔ «کارگر و دستمزد» ثبت نشده است. در صفحهٔ «دفتر مالی» هزینه را با همان دسته ثبت کنید تا جمع دستمزد و سهم آن از هزینه‌ها دیده شود.",
      meta: signatureMeta(97, "دفتر مالی", source, ["هزینه کارگر چقدر است؟", "بهای تمام‌شدهٔ هر کیلو", "جریان نقدی این ماه"], "data-labor", "data"),
    };
  }

  if (hasTag(text, ["نقد", "پول نقد", "صندوق", "موجودی نقد", "پول دارم"])) {
    const cashTx = context.ledger.entries.filter((entry) => entry.method === "cash");
    const cashIn = cashTx.filter((entry) => entry.kind === "income").reduce((sum, entry) => sum + entry.amount, 0);
    const cashOut = cashTx.filter((entry) => entry.kind === "expense").reduce((sum, entry) => sum + entry.amount, 0);
    return {
      text: `ماندهٔ نقدی دفتر شما ${money(cashIn - cashOut)} است (دریافت نقدی ${money(cashIn)} − پرداخت نقدی ${money(cashOut)}).\n\nاین عدد فقط بر اساس سندهایی است که روش پرداختشان «نقدی» ثبت شده؛ اگر پرداخت‌های بانکی را هم می‌خواهید، روش «حواله بانکی» را در گزارش‌ها ببینید.`,
      meta: signatureMeta(97, "دفتر مالی", source, ["جریان نقدی این ماه را تحلیل کن", "چقدر پول لازم دارم؟", "چک‌های نزدیک سررسید"], "data-cash", "data"),
    };
  }

  if (hasTag(text, ["بیشترین", "بزرگ‌ترین", "بزرگترین", "سرفصل"]) && hasTag(text, ["هزینه", "خرج", "سرفصل"])) {
    const rows = entryTotalsByCategory(context.ledger.entries)
      .filter((row) => row.expense > 0)
      .sort((a, b) => b.expense - a.expense);
    return {
      text: rows.length
        ? `بزرگ‌ترین سرفصل هزینهٔ شما: «${rows[0].category}» با ${money(rows[0].expense)}.\n${rows.slice(0, 5).map((row, index) => `${toPersianDigits(index + 1)}. ${row.category}: ${money(row.expense)}`).join("\n")}\n\nجمع هزینهٔ ثبت‌شده ${money(data.finance.expense)} است. برای تصمیم، همین سرفصل را با ماه قبل مقایسه کنید و سهم آن از هر هکتار را ببینید.`
        : "هنوز هزینه‌ای در دفتر ثبت نشده است؛ با ثبت اولین سند، بزرگ‌ترین سرفصل هزینه مشخص می‌شود.",
      meta: signatureMeta(97, "دفتر مالی", source, ["تفکیک هزینه‌ها را نشان بده", "سود این ماه چقدر است؟", "جریان نقدی این ماه"], "data-top-expense", "data"),
    };
  }

  if (hasTag(text, ["زمین", "قطعه", "هکتار"])) {
    if (!data.healthyPlots.length) {
      return {
        text: `هنوز زمین یا کشتی در برنامه ثبت نشده است، بنابراین مقایسهٔ سود زمین ممکن نیست.\nدر صفحهٔ «زمین و کشت» هر قطعه را با مساحت و هزینه‌های واقعی ثبت کنید تا سود و بهای تمام‌شدهٔ هر کیلو محاسبه شود.\nسود کل دفتر شما در همین حال ${money(data.finance.profit)} است.`,
        meta: signatureMeta(95, "دفتر مالی", source, ["بهای تمام‌شدهٔ هر کیلو", "سود این ماه چقدر است؟", "نقطه سربه‌سر چطور حساب می‌شود؟"], "data-plots-empty", "data"),
      };
    }
  }

  if (hasTag(text, ["زمین", "سود", "هزینه", "سربه"])) {
    if (!data.healthyPlots.length) {
      return {
        text: `سود دورهٔ ثبت‌شده در دفتر شما ${money(data.finance.profit)} است (درآمد ${money(data.finance.income)} − هزینه ${money(data.finance.expense)}).\nخالص فروش محصول ${money(data.sale)} و ماندهٔ وصول‌نشده ${money(data.saleRemaining)} است.\nبرای محاسبهٔ بهای تمام‌شده و سود هر کیلو، در صفحهٔ «زمین و کشت» زمین و کشت را با هزینه‌های واقعی ثبت کنید.`,
        meta: signatureMeta(97, "دفتر مالی", source, ["کدام زمین زیان‌ده است؟", "بهای تمام‌شدهٔ هر کیلو", "جریان نقدی این ماه را تحلیل کن"], "data-profit", "data"),
      };
    }
    if (data.healthyPlots.length) {
      const top = data.healthyPlots[0];
      return {
        text: `بهای تولید ثبت‌شدهٔ زمین‌ها ${money(data.cropCost)} است. مقایسه:\n${data.healthyPlots.map(({ plot, metrics }) => `• ${plot.title} (${plot.crop}): سود ${money(metrics.profit)} — هزینهٔ هر کیلو ${money(metrics.costPerKg)} — حاشیه ${toPersianDigits(Math.round(metrics.margin))}٪`).join("\n")}\n\n${top ? `بالاترین سود متعلق به «${top.plot.title}» است؛` : ""} قبل از تصمیم، ببینید هزینه‌ها کامل ثبت شده‌اند؟ اجاره/دستمزد فرصت خودتان را هم محاسبه کنید.`,
        meta: signatureMeta(97, "دفتر مالی", source, ["نقطه سربه‌سر چطور حساب می‌شود؟", "کدام زمین زیان‌ده است؟", "گزارش بهای تمام‌شده را چاپ کن"], "data-plots", "data"),
      };
    }
  }

  if (hasAny(text, ["هشدار", "ریسک", "وضعیت", "تحلیل", "امروز", "چه خبر"])) {
    const alerts = data.alerts.length ? data.alerts.map((alert) => `• ${alert}`).join("\n") : "هشدار مهمی یافت نشد؛ اما داده‌ها را کامل و به‌روز نگه دارید.";
    return {
      text: `تصویر سریع دفتر شما:\n• طلب: ${money(data.totals.receivable)} (معوق ${money(data.totals.overdue)})\n• بدهی: ${money(data.totals.payable)}\n• سود دوره: ${money(data.finance.profit)}\n• چک نزدیک سررسید: ${toPersianDigits(data.cheques.dueSoon)} فقره\n• موجودی کم: ${toPersianDigits(data.lowItems.length)} قلم\n\n${alerts}\n\nپیشنهاد اول این هفته: ${data.totals.overdue > 0 ? "وصول مستند ماندهٔ معوق" : data.lowItems.length ? "خرید نهاده‌های زیر حد سفارش" : data.cheques.dueSoon > 0 ? "مدیریت چک‌های نزدیک سررسید" : "به‌روزرسانی پرداخت‌ها و کنترل اسناد نیمه‌آماده"}.`,
      meta: signatureMeta(97, "دفتر مالی", source, ["مانده معوق را چطور پیگیری کنم؟", "چک‌های نزدیک سررسید", "این ماه چقدر پول لازم دارم؟"], "data-alerts", "data"),
    };
  }

  return null;
}

/* --------------------------- جست‌وجوی دانشنامه --------------------------- */

function buildIndex() {
  return KNOWLEDGE.map((entry) => {
    const aliasText = normalizePersian(entry.aliases.join(" "));
    const keywordText = normalizePersian(entry.keywords.join(" "));
    const titleText = normalizePersian(entry.title);
    return {
      entry,
      tokens: new Set(tokenize(`${entry.title} ${entry.aliases.join(" ")} ${entry.keywords.join(" ")}`)),
      keywordText,
      aliasText,
      titleText,
    };
  });
}

const INDEX = buildIndex();

const EDITORIAL_BOOSTS: { test: RegExp; ids: string[]; amount: number }[] = [
  { test: /(چاپ|پرینت|صفحه سیاه|pdf|دانلود نمی|چاپ نمی|پرینتر)/, ids: ["app-print-fix"], amount: 0.32 },
  { test: /(دانلود امضا|چاپ امضا|امضا.*(ذخیره|دانلود|چاپ)|امضا نمی)/, ids: ["app-signature-fix"], amount: 0.4 },
  { test: /(چک چاپی|برگه چک|چک معتبر|صیاد|پشت نویسی|پشت‌نویسی|چک برگشتی|چک حامل)/, ids: ["legal-cheque", "legal-sayad", "legal-endorse", "legal-bounced"], amount: 0.2 },
  { test: /(امضای الکترونیکی|امضای دیجیتال|گواهی|ماده ۱۰|مطمئن)/, ids: ["legal-e-signature"], amount: 0.3 },
  { test: /(اجاره|موجر|مستاجر|ودیعه|حقابه)/, ids: ["legal-land-lease"], amount: 0.1 },
  { test: /(قرارداد|ارکان|سند عادی|قصد و رضا|اهلیت)/, ids: ["legal-contract-elements", "legal-printed-wet-sign"], amount: 0.1 },
  { test: /(مالیات|فاکتور|صورت.?حساب|مودیان)/, ids: ["legal-invoice-tax"], amount: 0.2 },
  { test: /(پشتیبان|بکاپ|بازیابی|انتقال داده|گوشی جدید)/, ids: ["app-backup"], amount: 0.35 },
  { test: /(سلام|درود|کشاورزیار|خودت را معرفی|چه کاری می.?کنی)/, ids: ["app-features"], amount: 0.3 },
  { test: /(رسید|فیش|آپلود|عکس.*(رسید|فیش|چک)|پیوست|مشاهده.*رسید|دانلود.*رسید|حذف.*رسید)/, ids: ["boost-receipt-where", "boost-receipt-evidence"], amount: 0.34 },
  { test: /(آبیاری|آب دادن|نیاز آبی|دور آبیاری|قطره.?ای|راندمان آب)/, ids: ["boost-irrigation-plan", "boost-drip-efficiency", "boost-water-salinity"], amount: 0.22 },
  { test: /(کود|اوره|فسفر|پتاس|آزمون خاک|شوری|EC)/i, ids: ["boost-fertilizer-plan", "boost-water-salinity"], amount: 0.24 },
  { test: /(سن گندم|زنگ|علف هرز|آفت|سم|کارنس)/, ids: ["boost-wheat-pests"], amount: 0.24 },
  { test: /(گندم|جوی|برداشت|رطوبت|انبار|باسکول|افت)/, ids: ["boost-harvest-moisture", "boost-irrigation-plan", "boost-fertilizer-plan"], amount: 0.2 },
  { test: /(زعفران|پسته|گوجه|سیب.?زمینی|باغ)/, ids: ["boost-saffron", "boost-pistachio", "boost-tomato-potato"], amount: 0.22 },
  { test: /(گاو|شیر|دام|گوسفند|بره|مرغ|طیور|جوجه|خوراک)/, ids: ["boost-dairy-cow", "boost-sheep-poultry"], amount: 0.26 },
  { test: /(بیمه|خسارت|خشکسالی|تگرگ|سرما)/, ids: ["boost-crop-insurance"], amount: 0.28 },
  { test: /(بهای تمام|تمام.?شده|هر کیلو|حاشیه سود|نقطه سربه)/, ids: ["boost-cost-per-kg"], amount: 0.3 },
  { test: /(نقدینگی|جریان نقدی|پول لازم|سررسید|اقساط|طلب معوق)/, ids: ["boost-cash-flow"], amount: 0.24 },
  { test: /(استهلاک|تراکتور|ماشین.?آلات|تعمیر)/, ids: ["boost-depreciation"], amount: 0.26 },
  { test: /(کارگر|دستمزد|حقوق|فصلی|بیمه.*کارگر)/, ids: ["boost-labor-cost"], amount: 0.26 },
];

/** گسترش پرسش با مترادف‌ها و اصطلاحات؛ «آب دادن» هم به «آبیاری» وصل می‌شود. */
function expandQueryTokens(normalized: string, queryTokens: string[]): string[] {
  const extra = new Set<string>();
  for (const [canonical, synonyms] of Object.entries(PERSIAN_SYNONYMS)) {
    const canonicalText = normalizePersian(canonical);
    const hit =
      normalized.includes(canonicalText) ||
      synonyms.some((synonym) => {
        const value = normalizePersian(synonym);
        return value.length > 2 && normalized.includes(value);
      });
    if (!hit) continue;
    [...tokenize(canonical), ...synonyms.flatMap((synonym) => tokenize(synonym))].forEach((token) => {
      if (token.length > 2) extra.add(token);
    });
  }
  for (const term of Object.keys(ASSISTANT_GLOSSARY)) {
    const value = normalizePersian(term);
    if (value.length > 2 && normalized.includes(value)) tokenize(term).forEach((token) => extra.add(token));
  }
  return Array.from(new Set([...queryTokens, ...extra])).slice(0, 40);
}

function retrieve(text: string) {
  const normalized = normalizePersian(text);
  const queryTokens = expandQueryTokens(normalized, tokenize(text));
  const scored = INDEX.map(({ entry, tokens, titleText }) => {
    let keywordHits = 0;
    for (const keyword of entry.keywords.map((word) => normalizePersian(word)).filter((word) => word.length > 2)) {
      if (normalized.includes(keyword)) keywordHits += 1;
    }
    let overlap = 0;
    for (const token of queryTokens) {
      if (tokens.has(token)) overlap += 1;
      else if (Array.from(tokens).some((candidate) => candidate.length > 3 && (candidate.startsWith(token) || token.startsWith(candidate)))) overlap += 0.6;
    }
    const coverage = queryTokens.length ? overlap / queryTokens.length : 0;
    const titleHit = normalized.includes(titleText) || entry.aliases.some((alias) => normalized.includes(normalizePersian(alias))) ? 1 : 0;
    let score = keywordHits * 0.085 + coverage * 0.5 + titleHit * 0.16;
    if (entry.aliases.some((alias) => normalizePersian(alias) === normalized)) score += 0.2;
    for (const boost of EDITORIAL_BOOSTS) {
      if (boost.test.test(normalized) && boost.ids.includes(entry.id)) score += boost.amount;
    }
    if (entry.highStakes && hasAny(normalized, ["قانون", "قانونی", "معتبر", "اعتبار", "دادگاه", "شکایت", "امضا"])) score += 0.04;
    return { entry, score };
  }).sort((a, b) => b.score - a.score);
  return { normalized, queryTokens, scored };
}

function knowledgeAnswer(match: { entry: KnowledgeEntry; score: number }, secondScore = 0, question = ""): AssistantReply {
  const { entry, score } = match;
  // اگر پاسخ با «خیر/بله» شروع می‌شود ولی کاربر پرسش بله/خیر نپرسیده،
  // عنوانِ همان مدخل را جلو می‌گذاریم تا جمله بی‌ربط به نظر نرسد.
  const yesNoQuestion = /(^|\s)(آیا|ایا)(\s|$)/.test(question) || /(معتبر است|درست است|هست)$/.test(question.trim());
  const lead = /^(خیر|بله|نه|آری)/.test(entry.answer.trim()) && !yesNoQuestion ? `«${entry.title}»\n` : "";
  const confidence = Math.min(99, Math.round(45 + Math.min(0.52, score) * 82 + Math.min(0.16, Math.max(0, score - secondScore)) * 40));
  const sources = [...entry.sources];
  if (entry.highStakes) sources.push({ label: "هشدار: راهنمای عمومی؛ برای پروندهٔ مشخص مشاورهٔ حقوقی بگیرید" });
  const disclaimer = entry.highStakes ? `\n\n${LEGAL_DISCLAIMER}` : "";
  return {
    text: `${lead}${entry.answer}${disclaimer}`,
    meta: signatureMeta(confidence, entry.category, sources, entry.followUps, entry.id, "knowledge", Boolean(entry.highStakes)),
  };
}

function fallbackAnswer(normalized: string, scored: { entry: KnowledgeEntry; score: number }[]): AssistantReply {
  const best = scored.slice(0, 3).filter((item) => item.score > 0.03);
  const bonus = Object.entries(PERSIAN_SYNONYMS).find(([key, values]) => normalized.includes(normalizePersian(key)) || values.some((value) => normalized.includes(normalizePersian(value))))?.[0];
  const glossaryEntry = Object.entries(ASSISTANT_GLOSSARY).find(([term]) => normalized.includes(normalizePersian(term)));
  const suggestions = best.length ? best.map((item) => item.entry.title) : ["طلب و بدهی", "وضعیت چک‌ها", "سود و بهای تمام‌شده", "اعتبار سند و امضا"];
  const text = [
    "برای این پرسش، پاسخ قطعی و متناسب در دانشنامهٔ محلی پیدا نکردم و ترجیح می‌دهم چیزی از خودم نسازم.",
    glossaryEntry ? `\nتعریف کوتاه «${glossaryEntry[0]}»: ${glossaryEntry[1]}` : bonus ? `\nنزدیک‌ترین موضوع: «${bonus}»؛ اگر منظورتان همین است، دقیق‌تر بپرسید.` : "",
    `\nنزدیک‌ترین موضوع‌هایی که می‌توانم با اطمینان پاسخ دهم:\n${suggestions.map((title) => `• ${title}`).join("\n")}`,
    "\nبرای پاسخ دقیق‌تر، محصول/سال، موضوع (مالی، حقوقی، کشاورزی) و اینکه عدد یا سند می‌خواهید را بنویسید. من اعداد را فقط از دفتر شما می‌خوانم.",
  ].join("");
  const followUps = best.length ? best.map((item) => item.entry.title).slice(0, 4) : ["چقدر طلب دارم؟", "چک چاپی معتبر است؟", "چطور سند را چاپ کنم؟"];
  return { text, meta: signatureMeta(35 + (best[0]?.score ?? 0) * 30, best[0]?.entry.category ?? "برنامه", [{ label: "دانشنامهٔ محلی کشاورزیار — نتیجهٔ پایین‌تر از آستانهٔ پاسخ قطعی" }], followUps, "fallback", "fallback") };
}

/* ------------------------------ پاسخ اصلی ------------------------------ */

export function askKeshavarYar(raw: string, context: AssistantContext): AssistantReply {
  const text = normalizePersian(raw);
  if (!text) {
    return { text: "سؤال‌تان را بنویسید؛ مثلاً «چقدر طلب دارم؟» یا «آیا چک چاپی معتبر است؟»", meta: signatureMeta(60, "برنامه", [], ["چقدر طلب دارم؟", "چک چاپی معتبر است؟"], "empty", "social") };
  }
  if (["سلام", "درود", "وقت بخیر", "صبح بخیر", "شب بخیر", "خوبی"].some((word) => text === word || text === `${word} کشاورزیار`)) {
    return { text: greeting(context), meta: signatureMeta(97, "برنامه", [{ label: "حافظهٔ محلی و دفتر واقعی شما" }], ["چقدر طلب دارم؟", "وضعیت چک‌ها", "اعتبار چک چاپی", "چطور سند را چاپ کنم؟"], "greeting", "social") };
  }
  if (hasAny(text, ["ممنون", "متشکرم", "مرسی", "خداحافظ", "دستت درد نکنه", "عالی بود"])) {
    return { text: "خواهش می‌کنم. هر وقت خواستید، وضعیت مالی، سند، چک یا تصمیم کشت را با هم مرور می‌کنیم. داده‌ها همان‌جا روی دستگاه خودتان می‌مانند.", meta: signatureMeta(96, "برنامه", [], ["امروز چه هشداری دارم؟", "پشتیبان بگیرم؟"], "thanks", "social") };
  }
  if (hasAny(text, ["هوا", "باران", "دما", "پیش بینی هوا", "پیش‌بینی هوا", "باد", "رطوبت هوا"])) {
    return {
      text: "من به اینترنت یا سرویس هواشناسی وصل نیستم و پیش‌بینی هوا را از خودم نمی‌سازم. برای تصمیم آبیاری/سم‌پاشی، پیش‌بینی رسمی هواشناسی استان و ایستگاه نزدیک مزرعه را ببینید.\nدر برنامه می‌توانید بارندگی و دمای هر روز را در یادداشت آبیاری ثبت کنید؛ همین سابقه به شما کمک می‌کند الگوی مصرف آب مزرعه را بهتر بفهمید. اگر بخواهید، برنامهٔ ثبت آبیاری و کاهش هزینهٔ پمپ را با هم مرور می‌کنیم.",
      meta: signatureMeta(95, "کشاورزی", [{ label: "دانشنامهٔ محلی کشاورزیار — بدون دسترسی به دادهٔ زندهٔ هوا" }], ["کاهش هزینه پمپ آب", "کارت آبیاری چه چیزهایی ثبت کند؟", "آبیاری را چطور بهینه کنم؟"], "weather-offline", "knowledge"),
    };
  }

  // ۰) ریاضی قطعی: اگر جمله یک مسئلهٔ حساب‌وکتاب باشد، با موتور BigInt حل می‌شود.
  //    هیچ مبلغی در حافظهٔ فهم ذخیره نمی‌شود؛ نتیجه فقط در همین پاسخ می‌آید.
  const math = solveMath(raw);
  if (math) {
    const steps = math.steps.map((step, index) => `${index + 1}) ${step.title}: ${step.detail}`).join("\n");
    const persianLine = math.persian ? `\nبه حروف: ${math.persian}` : "";
    const warning = math.warnings.length ? `\nتوجه: ${math.warnings.join("؛ ")}` : "";
    const reply: AssistantReply = {
      text: `نتیجهٔ قطعی: ${toPersianDigits(math.display)}${persianLine}\n\n${steps}${warning}\n\nمحاسبه با اعداد گویا و BigInt انجام شد؛ بدون خطای ممیز شناور.`,
      meta: {
        confidence: 99,
        category: "مالی و حسابداری",
        sources: [{ label: "موتور ریاضی قطعی (BigInt)", note: `نوع: ${math.kind}` }],
        followUps: ["۱۸ درصد از ۲۵ میلیون چقدر است؟", "۲ تن به کیلوگرم", "افت رطوبت ۱۰۰۰ کیلو با رطوبت ۱۶ و پایه ۱۴"],
        matchedId: `math-${math.kind}`,
        kind: "knowledge",
      },
    };
    return withFast(reply, fastUnderstand(raw));
  }

  // ۰.۴) راهنمای رویه‌ای «چطور ثبت کنم؟» — پرسش دربارهٔ خود برنامه است، نه دانش حقوقی.
  //    پیش‌تر «چطور سند ثبت کنم؟» با ارکان قرارداد اجاره جواب می‌گرفت.
  const howToRecord = /(چطور|چگونه|چه ?جور|راهنما|مراحل|قدم)/.test(text) && /(ثبت|وارد|اضافه|ایجاد|بزنم|بنویسم|بسازم)/.test(text);
  if (howToRecord && !isDataQuestion(text) && !/قانون|معتبر|اعتبار|دادگاه|شکایت|ماده/.test(text)) {
    const section = /چک/.test(text) ? { path: "دفتر مالی ← چک و وام", label: "چک" }
      : /وام|قسط|اقساط/.test(text) ? { path: "دفتر مالی ← چک و وام", label: "وام و قسط" }
      : /معامله|محصول|محموله|فروش محصول|خرید محصول|باسکول/.test(text) ? { path: "معامله محصول", label: "معاملهٔ محصول" }
      : /زمین|کشت|قطعه/.test(text) ? { path: "زمین و کشت", label: "زمین و کشت" }
      : /انبار|نهاده|موجودی/.test(text) ? { path: "انبار", label: "انبار" }
      : /طرف.?حساب|بدهکار|بستانکار/.test(text) ? { path: "بدهکار و بستانکار", label: "طرف‌حساب" }
      : /رسید|فیش|پیوست/.test(text) ? { path: "همان رکورد ← افزودن تصویر رسید", label: "رسید" }
      : { path: "دفتر مالی ← ثبت هزینه/درآمد", label: "سند مالی" };
    const reply: AssistantReply = {
      text:
        `برای ثبت ${section.label} این مسیر را برو: «${section.path}».\n` +
        `۱) نوع را انتخاب کن (${/چک|وام/.test(text) ? "دریافتی/پرداختی یا وام" : "هزینه/درآمد"}).\n` +
        `۲) تاریخ شمسی، مبلغ به تومان و نام طرف‌حساب را وارد کن؛ مبلغ را می‌توانی «۲۵ میلیون» هم بنویسی و خودش تبدیل می‌شود.\n` +
        `۳) اگر رسید یا فیش داری، زیر همان رکورد دکمهٔ «افزودن تصویر رسید» را بزن — هر رکورد چند رسید می‌گیرد.\n` +
        `۴) ذخیره کن؛ هر ثبتی قابل ویرایش و واگرد است و در گزارش‌ها فوراً دیده می‌شود.\n` +
        `می‌توانی همین را به من بسپاری: مثلاً بنویس «۲۵ میلیون کود اوره خریدم» تا پیش‌نویس بسازم.`,
      meta: {
        confidence: 95,
        category: "برنامه",
        sources: [{ label: "راهنمای داخلی برنامه — مسیر ثبت سند" }],
        followUps: ["۲۵ میلیون کود اوره خریدم، نسیه", "چک دریافتی ثبت کن", "پشتیبان بگیرم؟"],
        matchedId: "app-howto-record",
        kind: "knowledge",
      },
    };
    return withFast(reply, fastUnderstand(raw));
  }

  // ۰.۵) اعتبار اسناد: پاسخ قطعی از جدول تحلیل‌شدهٔ حقوقی (قانون مدنی، صیاد،
  // مؤدیان، ثبت رسمی معاملات). هیچ حدسی در این دسته تولید نمی‌شود.
  if (!isDataQuestion(text)) {
    const authority = matchAuthorityQuestion(raw);
    if (authority) {
      const authorityReply: AssistantReply = {
        text: authority.text,
        meta: {
          confidence: authority.confidence,
          category: "حقوقی",
          sources: authority.sources.map((source) => ({ label: source.label, note: source.note })),
          followUps: authority.followUps,
          matchedId: `authority-${authority.kind}`,
          kind: "knowledge",
          highStakes: true,
        },
      };
      return withFast(authorityReply, fastUnderstand(raw));
    }
  }

  // ۱) سؤال عددی/مالی: اول دفتر واقعی، مگر اینکه سؤال صریحاً حقوقی باشد.
  const fast = fastUnderstand(raw);
  const legalIntent = hasAny(text, ["قانون", "قانونی", "معتبر", "اعتبار", "دادگاه", "شکایت", "ماده", "امضای الکترونیکی", "سند عادی", "سند رسمی", "ثبت رسمی", "دفتر اسناد"]);
  // اگر جمله هم واژهٔ کشاورزی دارد و هم نشانهٔ پول/دفتر، پرسش از دفتر کاربر است.
  // نمونهٔ واقعی: «هزینهٔ کود چقدر بوده؟» قبلاً با راهنمای عمومی انبار جواب می‌گرفت.
  const ledgerSignal = isOwnLedgerQuestion(text) || hasTag(text, LEDGER_SIGNALS);
  const agronomyOnly = isAgronomyQuestion(text) && !ledgerSignal;
  if (isDataQuestion(text) && !legalIntent && !agronomyOnly) {
    const direct = dataAnswer(text, context);
    if (direct) return withFast(direct, fast);
  }

  // ۲) دانشنامهٔ حقوقی/آموزشی و پرسش‌های مفهومی.
  const { normalized, scored } = retrieve(raw);
  const [first, second] = scored;
  if (first && first.score >= 0.14) {
    const answer = knowledgeAnswer(first, second?.score ?? 0, text);
    // اگر کاربر عدد دفتر خودش را خواسته و داده‌ای هست، خلاصهٔ دفتر را هم اضافه کن.
    if (isDataQuestion(text) && !agronomyOnly) {
      const direct = dataAnswer(text, context);
      if (direct) {
        answer.text = `${direct.text}\n\n— راهنمای تکمیلی —\n${answer.text}`;
        answer.meta.category = "دفتر مالی";
        answer.meta.confidence = Math.max(answer.meta.confidence, 95);
      }
    }
    if (isDataQuestion(text)) return withFast(answer, fast);
    return withFast(answer, fast);
  }

  // ۳) پاسخ عددی برای جمله‌هایی که «چقدر» نداشته‌اند (به‌جز پرسش کشاورزی محض).
  const direct = agronomyOnly ? null : dataAnswer(text, context);
  if (direct) return withFast(direct, fast);

  // ۴) بانک سؤال/جواب نشان‌دار: پاسخ قطعی برای پرسش‌های پرتکرار
  const marked = findMarkedQA(raw);
  if (marked) {
    const reply: AssistantReply = {
      text: marked.a,
      meta: {
        confidence: 92,
        category: marked.tag === "برنامه" ? "برنامه" : marked.tag === "مالی" ? "مالی و حسابداری" : marked.tag === "کشت" || marked.tag === "انبار" ? "کشاورزی" : "حقوقی",
        sources: [{ label: `بانک پرسش/پاسخ نشان‌دار · ${marked.tag}` }],
        followUps: MARKED_FOLLOWUPS,
        matchedId: marked.id,
        kind: "knowledge",
      },
    };
    return withFast(reply, fast);
  }

  // ۵) پاسخ نزدیک: اگر مدخل مرتبط هست ولی امتیازش به آستانهٔ قطعی نرسیده،
  //    به‌جای «نمی‌دانم» همان پاسخ را با برچسب «راهنمای نزدیک» و صداقت کامل می‌دهد.
  const near = scored.find((item) => item.score >= 0.075);
  if (near) {
    const reply = knowledgeAnswer(near, scored[1]?.score ?? 0, text);
    reply.meta.confidence = Math.min(88, Math.max(55, reply.meta.confidence));
    reply.meta.matchedId = `near-${near.entry.id}`;
    reply.text = `${reply.text}\n\n— راهنمای نزدیک —\nاین پاسخ بر پایهٔ نزدیک‌ترین موضوع دانشنامه («${near.entry.title}») آماده شده است. اگر مزرعه، محصول یا مبلغ مشخصی دارید، همان را بنویسید تا دقیق‌تر بررسی کنیم.`;
    return withFast(reply, fast);
  }

  return withFast(fallbackAnswer(normalized, scored), fast);
}

const MARKED_FOLLOWUPS = ["چک‌های نزدیک سررسید", "بهای تمام‌شدهٔ هر کیلو", "راهنمای کامل", "پشتیبان‌گیری از برنامه"];

export function greeting(context: AssistantContext, profileName = ""): string {
  const data = snapshot(context);
  const name = profileName.trim() ? ` ${profileName.trim()}` : "";
  const warning = data.alerts[0];
  const today = formatJalali(todayJalali(), "long");
  return `سلام${name}؛ من کشاورزیار هستم. امروز ${today} است.\n${warning ? `یک نکتهٔ مهم دفتر شما: ${warning}.` : "هشدار بحرانی در دفتر شما دیده نمی‌شود؛ داده‌ها را به‌روز نگه داریم."}\nمی‌توانم اعداد واقعی دفتر، اعتبار اسناد و چک، مراحل چاپ/امضا، مدیریت انبار و تصمیم کشت را تحلیل کنم. چه چیزی را بررسی کنیم؟`;
}

export function assistantSuggestedQuestions(context: AssistantContext): string[] {
  const data = snapshot(context);
  const questions: string[] = [];
  if (data.totals.overdue > 0) questions.push("مانده معوق را چطور پیگیری کنم؟");
  if (data.cheques.dueSoon > 0) questions.push("چک‌های نزدیک سررسید را نشان بده");
  if (data.lowItems.length > 0) questions.push("انبار چه کمبودی دارد؟");
  if (context.plots.length > 0) questions.push("کدام زمین سود بیشتری دارد؟");
  if (context.trades.length > 0) questions.push("سود فروش محصول چقدر است؟");
  questions.push(...markedSuggestions(12));
  return Array.from(new Set(questions)).slice(0, 12);
}

export function assistantProfileStats(context: AssistantContext) {
  const stats = knowledgeStats();
  const data = snapshot(context);
  return {
    ...stats,
    records: context.ledger.parties.length + context.ledger.cheques.length + context.ledger.loans.length + context.ledger.items.length + context.trades.length + context.plots.length + context.contracts.length,
    alerts: data.alerts.length,
    glossaryLabel: `${toPersianDigits(stats.entries)} مدخل دانشنامه · ${toPersianDigits(stats.glossary)} اصطلاح · ${toPersianDigits(stats.patterns)} الگوی پرسش`,
  };
}

/* ------------------------------- حافظه ------------------------------- */

export function loadAssistantMessages(): AssistantMessage[] {
  try {
    const raw = window.localStorage.getItem(MEMORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AssistantMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((message) => message && (message.role === "user" || message.role === "bot") && typeof message.text === "string").slice(-32);
  } catch {
    return [];
  }
}

export function saveAssistantMessages(messages: AssistantMessage[]): void {
  try {
    window.localStorage.setItem(MEMORY_KEY, JSON.stringify(messages.slice(-32)));
  } catch {
    /* حافظه ممکن است در حالت ناشناس بسته باشد */
  }
}

export function clearAssistantMessages(): void {
  try {
    window.localStorage.removeItem(MEMORY_KEY);
  } catch {
    /* ignore */
  }
}

export function makeAssistantMessage(role: AssistantMessage["role"], text: string, meta?: AssistantMeta): AssistantMessage {
  return { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, text, at: Date.now(), meta };
}

export function assistantDataset() {
  return { entries: KNOWLEDGE, stats: knowledgeStats() };
}
