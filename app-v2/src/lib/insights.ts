import type { SavedContract } from "./data";
import type { CropPlot } from "./samples";
import { plotMetrics } from "./samples";
import { financeTotals, inventoryValue, ledgerTotals, loanSchedule, partyTotals, type LedgerState } from "./ledger";
import { PRODUCT_PROFILES, tradeBalance, type CropTrade } from "./trade";
import type { SignableEntity } from "./signatures";
import { todayJalali } from "./format";

export type InsightSeverity = "critical" | "warning" | "info" | "good";

export interface Insight {
  code: string;
  title: string;
  detail: string;
  action: string;
  severity: InsightSeverity;
  page: string;
  value?: number;
}

export interface HealthReport {
  score: number;
  level: "ضعیف" | "متوسط" | "خوب" | "عالی";
  headline: string;
  insights: Insight[];
  counts: Record<InsightSeverity, number>;
  metrics: { label: string; value: string; tone: "good" | "warn" | "bad" | "neutral" }[];
  generatedAtJalali: string;
}

const fmt = (value: number) => Math.round(value).toLocaleString("en-US");

export function buildInsights(input: {
  ledger: LedgerState;
  trades: CropTrade[];
  plots: CropPlot[];
  contracts: SavedContract[];
  signableEntities: SignableEntity[];
  pendingSignatures: { entity: SignableEntity; required: number; signed: number; missing: number }[];
}): HealthReport {
  const { ledger, trades, plots, contracts } = input;
  const insights: Insight[] = [];
  const totals = ledgerTotals(ledger);
  const fin = financeTotals(ledger.entries);
  const inv = inventoryValue(ledger.items);
  const sales = trades.reduce((sum, trade) => sum + trade.result.netReceipt, 0);
  const saleRemaining = trades.reduce((sum, trade) => sum + tradeBalance(trade).remaining, 0);
  const chequePayable = ledger.cheques.filter((c) => c.direction === "paid" && c.status === "pending").reduce((sum, c) => sum + c.amount, 0);
  const bounced = ledger.cheques.filter((c) => c.status === "bounced");
  const loans = ledger.loans.map((loan) => {
    const schedule = loanSchedule(loan);
    const next = schedule.find((row) => !row.paid);
    const remaining = schedule.filter((row) => !row.paid).reduce((sum, row) => sum + row.amount, 0);
    return { loan, next, remaining };
  });
  const lowStock = ledger.items.filter((item) => item.stock <= item.min);

  if (bounced.length > 0) {
    insights.push({
      code: "bounced-cheque",
      severity: "critical",
      title: `${bounced.length} چک برگشتی نیازمند پیگیری فوری است`,
      detail: `مبلغ چک‌های برگشتی ${fmt(bounced.reduce((sum, c) => sum + c.amount, 0))} تومان است. برگشت چک هم ریسک مالی و هم ریسک اعتباری دارد.`,
      action: "در دفتر مالی وضعیت چک را بررسی و مدارک پیگیری را ثبت کنید.",
      page: "finance",
    });
  }
  if (totals.overdue > 0) {
    insights.push({
      code: "overdue-receivable",
      severity: "warning",
      title: `${fmt(totals.overdue)} تومان مطالبات سرگذشته`,
      detail: "بخشی از طلب‌ها از تاریخ یادآوری پیگیری گذشته و هنوز تسویه نشده است.",
      action: "با طرف‌حساب تماس بگیرید و تاریخ پرداخت جدید را ثبت کنید.",
      page: "parties",
    });
  }
  if (saleRemaining > 0) {
    insights.push({
      code: "trade-remaining",
      severity: "warning",
      title: `${fmt(saleRemaining)} تومان مانده فروش محصول`,
      detail: "برای محموله‌های تأییدشده، تسویه انجام نشده است.",
      action: "در بخش معامله محصول، پرداخت‌ها را ثبت و صورتجلسه تسویه را چاپ کنید.",
      page: "trade",
    });
  }
  const moistureRisks = trades.filter((trade) => trade.quality.moisture > PRODUCT_PROFILES[trade.productId].maxMoisture);
  if (moistureRisks.length > 0) {
    insights.push({
      code: "moisture",
      severity: "warning",
      title: `رطوبت ${moistureRisks.length} محموله بالاتر از حد پذیرش`,
      detail: "این محموله‌ها در معرض کسر قیمت یا رد شدن توسط خریدار هستند.",
      action: "پیش از تحویل بعدی، خشک‌کردن یا مذاکره کتبی با خریدار را انجام دهید.",
      page: "trade",
    });
  }
  if (fin.profit < 0) {
    insights.push({
      code: "negative-profit",
      severity: "critical",
      title: "هزینه‌ها از درآمد بیشتر است",
      detail: `سود دفتر مالی ${fmt(fin.profit)} تومان است.`,
      action: "سرفصل‌های پرهزینه را در گزارش‌ها بررسی و بودجه را اصلاح کنید.",
      page: "reports",
    });
  }
  if (chequePayable > 0) {
    insights.push({
      code: "cheque-payable",
      severity: chequePayable > fin.income ? "critical" : "warning",
      title: `${fmt(chequePayable)} تومان چک پرداختی در جریان`,
      detail: "سررسید و موجودی حساب را کنترل کنید تا چک برگشت نخورد.",
      action: "در دفتر مالی سررسید چک‌ها را بررسی کنید.",
      page: "finance",
    });
  }
  if (loans.some((row) => row.next)) {
    insights.push({
      code: "loan-installment",
      severity: "info",
      title: `${loans.filter((row) => row.next).length} وام دارای قسط بعدی`,
      detail: loans.map((row) => `${row.loan.title}: مانده ${fmt(row.remaining)} تومان`).join(" · "),
      action: "جدول اقساط را ببینید و پرداخت‌ها را کامل ثبت کنید.",
      page: "finance",
    });
  }
  if (lowStock.length > 0) {
    insights.push({
      code: "low-stock",
      severity: "warning",
      title: `${lowStock.length} قلم نهاده زیر حد سفارش`,
      detail: lowStock.map((item) => `${item.name}: ${item.stock} ${item.unit}`).join(" · "),
      action: "خرید نهاده را زمان‌بندی کنید تا عملیات کشت متوقف نشود.",
      page: "inventory",
    });
  }
  const budgets = ledger.budgets.map((budget) => {
    const spent = ledger.entries.filter((entry) => entry.kind === "expense" && entry.category === budget.category).reduce((sum, entry) => sum + entry.amount, 0);
    return { budget, spent, pct: budget.limit ? Math.round((spent / budget.limit) * 100) : 0 };
  });
  const over = budgets.filter((row) => row.pct > 100);
  if (over.length > 0) {
    insights.push({
      code: "budget-over",
      severity: "warning",
      title: `اضافه‌برداشت بودجه در ${over.length} سرفصل`,
      detail: over.map((row) => `${row.budget.category}: ${row.pct}%`).join(" · "),
      action: "سقف بودجه را بازبینی یا هزینه را کنترل کنید.",
      page: "inventory",
    });
  }
  const negativePlots = plots.map((plot) => ({ plot, metrics: plotMetrics(plot) })).filter((row) => row.metrics.profit < 0);
  if (negativePlots.length > 0) {
    insights.push({
      code: "negative-plot",
      severity: "warning",
      title: `${negativePlots.length} زمین با سود برآوردی منفی`,
      detail: negativePlots.map((row) => `${row.plot.title}: ${fmt(row.metrics.profit)} تومان`).join(" · "),
      action: "بهای تمام‌شده را بررسی و نرخ یا عملکرد را اصلاح کنید.",
      page: "crops",
    });
  }
  const pending = input.pendingSignatures.filter((row) => row.missing > 0);
  if (pending.length > 0) {
    insights.push({
      code: "signatures-pending",
      severity: "warning",
      title: `${pending.length} سند/تعهد امضای ناقص دارد`,
      detail: "بدون تکمیل امضاها، ارزش اثباتی سند پایین است.",
      action: "در «امضا و اعتبار» امضاهای ناقص را تکمیل کنید.",
      page: "signatures",
    });
  }
  const existingTop = ledger.parties
    .filter((party) => party.kind === "debtor")
    .map((party) => ({ party, totals: partyTotals(party, ledger.payments) }))
    .sort((a, b) => b.totals.balance - a.totals.balance)[0];
  if (existingTop && totals.receivable > 0 && existingTop.totals.balance / totals.receivable > 0.4) {
    insights.push({
      code: "concentration",
      severity: "warning",
      title: `تمرکز ریسک روی ${existingTop.party.name}`,
      detail: `حدود ${Math.round((existingTop.totals.balance / totals.receivable) * 100)}٪ طلب شما نزد یک طرف‌حساب است.`,
      action: "برای این طلب ضمانت یا زمان‌بندی دریافت تعیین کنید.",
      page: "parties",
    });
  }
  if (trades.length === 0) {
    insights.push({
      code: "start-trade",
      severity: "info",
      title: "اولین محموله محصول را ثبت کنید",
      detail: "با ماشین‌حساب فروش، وزن قابل پرداخت و ارزش محصول را دقیق کنید.",
      action: "از بخش معامله محصول شروع کنید.",
      page: "trade",
    });
  }
  if (plots.length === 0) {
    insights.push({
      code: "start-plot",
      severity: "info",
      title: "هزینه زمین و کشت را ثبت کنید",
      detail: "برای دانستن قیمت تمام‌شده هر کیلو، حداقل یک زمین با سرفصل هزینه ثبت کنید.",
      action: "در بخش زمین و کشت، زمین اضافه کنید.",
      page: "crops",
    });
  }
  if (contracts.length === 0) {
    insights.push({
      code: "start-contract",
      severity: "info",
      title: "قرارداد زمین ندارید",
      detail: "قرارداد اجاره/مزارعه/مساقات را با تاریخ شمسی و طرف‌حساب ثبت کنید.",
      action: "در بخش قرارداد زمین، قرارداد جدید بسازید.",
      page: "contracts",
    });
  }
  if (insights.every((insight) => insight.severity === "info")) {
    insights.push({
      code: "healthy",
      severity: "good",
      title: "ریسک مهمی شناسایی نشد",
      detail: "مانده‌ها، چک‌ها و امضاها در وضعیت قابل قبول‌اند.",
      action: "ثبت منظم اسناد و پشتیبان را ادامه دهید.",
      page: "backup",
    });
  }

  const counts: Record<InsightSeverity, number> = { critical: 0, warning: 0, info: 0, good: 0 };
  insights.forEach((insight) => { counts[insight.severity] += 1; });
  const score = Math.max(0, Math.min(100, 100 - counts.critical * 22 - counts.warning * 9));
  const level = score >= 85 ? "عالی" : score >= 70 ? "خوب" : score >= 50 ? "متوسط" : "ضعیف";
  const metrics = [
    { label: "طلب از بدهکاران", value: `${fmt(totals.receivable)} تومان`, tone: "neutral" as const },
    { label: "بدهی به بستانکاران", value: `${fmt(totals.payable)} تومان`, tone: totals.payable > totals.receivable ? "warn" as const : "good" as const },
    { label: "مانده فروش محصول", value: `${fmt(saleRemaining)} تومان`, tone: saleRemaining > 0 ? "warn" as const : "good" as const },
    { label: "ارزش انبار", value: `${fmt(inv.inputs + inv.products)} تومان`, tone: "neutral" as const },
    { label: "فروش ثبت‌شده", value: `${fmt(sales)} تومان`, tone: "good" as const },
    { label: "امضاهای ناقص", value: `${pending.length} سند`, tone: pending.length ? "warn" as const : "good" as const },
  ];
  return {
    score,
    level,
    headline: score >= 85 ? "وضعیت کسب‌وکار شفاف و کم‌ریسک است." : score >= 70 ? "وضعیت قابل قبول، با چند اقدام بهبود." : "چند ریسک مهم نیازمند اقدام دارد.",
    insights: [...insights].sort((a, b) => ({ critical: 0, warning: 1, info: 2, good: 3 }[a.severity] - { critical: 0, warning: 1, info: 2, good: 3 }[b.severity])),
    counts,
    metrics,
    generatedAtJalali: `${todayJalali().jy}/${todayJalali().jm}/${todayJalali().jd}`,
  };
}
