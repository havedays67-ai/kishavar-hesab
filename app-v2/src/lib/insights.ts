import type { SavedContract } from "./data";
import type { CropPlot } from "./samples";
import { plotMetrics } from "./samples";
import { financeTotals, inventoryValue, ledgerTotals, loanSchedule, partyTotals, type LedgerState } from "./ledger";
import { PRODUCT_PROFILES, tradeBalance, type CropTrade } from "./trade";
import type { SignableEntity } from "./signatures";
import { jalaliToDate, todayJalali } from "./format";

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

  const today = todayJalali();
  const daysTo = (date: { jy: number; jm: number; jd: number }) => Math.round((jalaliToDate(date).getTime() - jalaliToDate(today).getTime()) / 86_400_000);
  const soonCheques = ledger.cheques.filter((cheque) => cheque.status === "pending" && daysTo(cheque.due) >= 0 && daysTo(cheque.due) <= 7);
  if (soonCheques.length > 0) {
    insights.push({ code: "cheque-due-7", severity: "critical", title: `${soonCheques.length} چک در ۷ روز آینده سررسید می‌شود`, detail: soonCheques.map((cheque) => `${cheque.direction === "paid" ? "پرداختی" : "دریافتی"} ${cheque.serial} — ${fmt(cheque.amount)} تومان — ${cheque.partyName}`).join(" · "), action: "موجودی حساب و هماهنگی با طرف‌حساب را کنترل کنید.", page: "finance" });
  }
  const loanOverdue = loans.filter((row) => row.next && daysTo(row.next.due) < 0);
  const loanSoon = loans.filter((row) => row.next && daysTo(row.next.due) >= 0 && daysTo(row.next.due) <= 7);
  if (loanOverdue.length > 0) {
    insights.push({ code: "loan-overdue", severity: "critical", title: `${loanOverdue.length} قسط وام سرگذشته`, detail: loanOverdue.map((row) => `${row.loan.title}: ${fmt(row.next?.amount ?? 0)} تومان`).join(" · "), action: "قسط را پرداخت و در جدول اقساط ثبت کنید.", page: "finance" });
  } else if (loanSoon.length > 0) {
    insights.push({ code: "loan-soon", severity: "warning", title: `${loanSoon.length} قسط وام در ۷ روز آینده`, detail: loanSoon.map((row) => `${row.loan.title}: ${fmt(row.next?.amount ?? 0)} تومان`).join(" · "), action: "برای پرداخت قسط بعدی برنامه‌ریزی کنید.", page: "finance" });
  }
  const paymentKeys = new Map<string, number>();
  ledger.payments.forEach((payment) => { const key = `${payment.partyId}|${payment.amount}|${payment.date.jy}/${payment.date.jm}/${payment.date.jd}`; paymentKeys.set(key, (paymentKeys.get(key) ?? 0) + 1); });
  const duplicatePayments = Array.from(paymentKeys.values()).filter((count) => count > 1).length;
  if (duplicatePayments > 0) {
    const duplicatePaymentsList = Array.from(paymentKeys.entries()).filter(([, count]) => count > 1).length;
    insights.push({ code: "duplicate-payment", severity: "warning", title: `${duplicatePaymentsList} پرداخت مشکوک به تکرار`, detail: "چند پرداخت با همان طرف‌حساب، مبلغ و تاریخ ثبت شده است.", action: "دفتر معین طرف‌حساب را بررسی و در صورت اشتباه رکورد تکراری را حذف کنید.", page: "parties" });
  }
  const entryKeys = new Map<string, number>();
  ledger.entries.forEach((entry) => { const key = `${entry.kind}|${entry.amount}|${entry.date.jy}/${entry.date.jm}/${entry.date.jd}|${entry.reason}`; entryKeys.set(key, (entryKeys.get(key) ?? 0) + 1); });
  const duplicateEntries = Array.from(entryKeys.values()).filter((count) => count > 1).length;
  if (duplicateEntries > 0) {
    insights.push({ code: "duplicate-entry", severity: "warning", title: `${duplicateEntries} سند مالی مشکوک به تکرار`, detail: "سندهایی با همان نوع، مبلغ، تاریخ و شرح چند بار ثبت شده‌اند.", action: "در دفتر مالی ردیف تکراری را بررسی و حذف کنید.", page: "finance" });
  }
  const tradeDuplicates = new Set(trades.map((trade) => trade.serial));
  if (tradeDuplicates.size !== trades.length) {
    insights.push({ code: "duplicate-trade", severity: "critical", title: "شماره سریال تکراری در معاملات", detail: `${trades.length - tradeDuplicates.size} شماره تکراری پیدا شد.`, action: "معاملات را بازبینی کنید؛ هر محموله باید شماره یکتا داشته باشد.", page: "trade" });
  }
  const expiring = contracts.filter((contract) => { const days = daysTo(contract.end); return days >= 0 && days <= 60; });
  if (expiring.length > 0) {
    insights.push({ code: "contract-expiring", severity: "warning", title: `${expiring.length} قرارداد زمین تا ۶۰ روز آینده تمام می‌شود`, detail: expiring.map((contract) => `${contract.landTitle} — ${contract.code}`).join(" · "), action: "برای تمدید یا تحویل زمین برنامه‌ریزی کنید.", page: "contracts" });
  }
  const overdueTrade = trades.filter((trade) => { const balance = tradeBalance(trade); return balance.remaining > 0 && daysTo(trade.dueDate) < 0; });
  if (overdueTrade.length > 0) {
    insights.push({ code: "trade-overdue", severity: "critical", title: `${overdueTrade.length} صورتحساب فروش سرگذشته`, detail: overdueTrade.map((trade) => `${trade.buyerName}: ${fmt(tradeBalance(trade).remaining)} تومان`).join(" · "), action: "برای دریافت مانده، پیگیری و صورتجلسه تسویه تنظیم کنید.", page: "trade" });
  }
  const margin = fin.income > 0 ? (fin.profit / fin.income) * 100 : 0;
  if (fin.income > 0 && margin < 10) {
    insights.push({ code: "low-margin", severity: "warning", title: `حاشیه سود پایین (${Math.round(margin)}٪)`, detail: "سود دفتر مالی نسبت به درآمد کم است.", action: "هزینه‌ها یا قیمت فروش را بازبینی کنید.", page: "reports" });
  }
  const noContact = ledger.parties.filter((party) => partyTotals(party, ledger.payments).balance > 0 && party.phone.replace(/\D/g, "").replace(/[۰-۹]/g, "").length < 8);
  if (noContact.length > 0) {
    insights.push({ code: "missing-contact", severity: "info", title: `${noContact.length} طرف‌حساب دارای مانده بدون شماره تماس`, detail: "برای پیگیری و ارسال صورتحساب، شماره تماس لازم است.", action: "شماره تماس را ویرایش و تکمیل کنید.", page: "parties" });
  }
  const futureEntries = ledger.entries.filter((entry) => entry.date.jy * 10000 + entry.date.jm * 100 + entry.date.jd > today.jy * 10000 + today.jm * 100 + today.jd);
  if (futureEntries.length > 0) {
    insights.push({ code: "future-entry", severity: "warning", title: `${futureEntries.length} سند مالی با تاریخ آینده`, detail: "تاریخ سند نمی‌تواند بعد از امروز باشد؛ احتمال اشتباه تاریخ وجود دارد.", action: "تاریخ اسناد را اصلاح کنید.", page: "finance" });
  }
  const rentDeposits = contracts.filter((contract) => contract.myRole === "tenant" && contract.deposit > 0 && contract.rent > 0 && contract.deposit > contract.rent * 2);
  if (rentDeposits.length > 0) {
    insights.push({ code: "deposit-risk", severity: "warning", title: "ودیعه‌های سنگین نسبت به اجاره", detail: rentDeposits.map((contract) => `${contract.landTitle}: ودیعه ${fmt(contract.deposit)} / اجاره ${fmt(contract.rent)}`).join(" · "), action: "شرایط استرداد ودیعه و ضمانت مالک را بررسی کنید.", page: "rentals" });
  }
  const productCropMap: Record<string, string> = { wheat: "گندم", barley: "جو", canola: "کلزا", corn: "ذرت" };
  const pricedTrades = trades.filter((trade) => trade.result.payableKg > 0);
  const saleAvg = pricedTrades.length ? pricedTrades.reduce((sum, trade) => sum + trade.result.netReceipt, 0) / pricedTrades.reduce((sum, trade) => sum + trade.result.payableKg, 0) : 0;
  const matchingPlots = plots.filter((plot) => pricedTrades.some((trade) => productCropMap[trade.productId] && plot.crop.includes(productCropMap[trade.productId])));
  const plotAvgCost = matchingPlots.length ? matchingPlots.reduce((sum, plot) => sum + plotMetrics(plot).costPerKg, 0) / matchingPlots.length : 0;
  if (saleAvg > 0 && plotAvgCost > 0 && saleAvg < plotAvgCost) {
    insights.push({ code: "sale-below-cost", severity: "critical", title: "نرخ فروش مؤثر کمتر از بهای تمام‌شده", detail: `میانگین فروش ${fmt(saleAvg)} تومان در کیلو در برابر بهای تمام‌شده ${fmt(plotAvgCost)} تومان.`, action: "قیمت، افت و درجه محصول را بازبینی کنید؛ فروش زیر بهای تمام‌شده زیان می‌دهد.", page: "trade" });
  }
  const cashBalance = fin.income - fin.expense - chequePayable - loans.reduce((sum, row) => sum + row.remaining, 0);
  const monthlyExpense = fin.expense > 0 ? fin.expense / Math.max(1, new Set(ledger.entries.filter((entry) => entry.kind === "expense").map((entry) => `${entry.date.jy}-${entry.date.jm}`)).size) : 0;
  if (monthlyExpense > 0 && cashBalance < monthlyExpense * 2) {
    insights.push({ code: "cash-runway", severity: "warning", title: "پوشش نقدینگی کمتر از دو ماه هزینه", detail: `مانده تقریبی پس از چک و اقساط ${fmt(cashBalance)} تومان؛ میانگین هزینه ماهانه ${fmt(monthlyExpense)} تومان.`, action: "دریافت مطالبات یا زمان‌بندی هزینه‌ها را بررسی کنید.", page: "reports" });
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
