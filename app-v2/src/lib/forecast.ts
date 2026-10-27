import type { LedgerState } from "./ledger";
import { loanSchedule, partyTotals } from "./ledger";
import { tradeBalance, type CropTrade } from "./trade";
import { plotMetrics, type CropPlot } from "./samples";
import { jalaliToDate, todayJalali } from "./format";
import type { SavedContract } from "./data";

const day = 86_400_000;
const todayMs = () => jalaliToDate(todayJalali()).getTime();
const toMs = (date: { jy: number; jm: number; jd: number }) => jalaliToDate(date).getTime();

export interface CashForecastBucket {
  label: string;
  days: number;
  inflow: number;
  outflow: number;
  net: number;
  items: string[];
}

export function cashForecast(ledger: LedgerState, trades: CropTrade[]): CashForecastBucket[] {
  const buckets: CashForecastBucket[] = [ { label: "۳۰ روز آینده", days: 30, inflow: 0, outflow: 0, net: 0, items: [] }, { label: "۳۱ تا ۶۰ روز", days: 60, inflow: 0, outflow: 0, net: 0, items: [] }, { label: "۶۱ تا ۹۰ روز", days: 90, inflow: 0, outflow: 0, net: 0, items: [] } ];
  const add = (ms: number, kind: "in" | "out", amount: number, reason: string) => {
    const diff = Math.ceil((ms - todayMs()) / day);
    if (diff < 0 || diff > 90) return;
    const bucket = diff <= 30 ? buckets[0] : diff <= 60 ? buckets[1] : buckets[2];
    if (kind === "in") bucket.inflow += amount; else bucket.outflow += amount;
    bucket.items.push(reason);
  };
  trades.forEach((trade) => { const remaining = tradeBalance(trade).remaining; if (remaining > 0) add(toMs(trade.dueDate), "in", remaining, `مانده فروش ${trade.serial}`); });
  ledger.parties.forEach((party) => {
    const balance = partyTotals(party, ledger.payments).balance;
    if (balance <= 0) return;
    const reference = party.dueDate ? toMs(party.dueDate) : toMs(party.date) + 7 * day;
    add(reference, party.kind === "debtor" ? "in" : "out", balance, `${party.kind === "debtor" ? "دریافت" : "پرداخت"} ${party.name}`);
  });
  ledger.cheques.filter((cheque) => cheque.status === "pending").forEach((cheque) => add(toMs(cheque.due), cheque.direction === "received" ? "in" : "out", cheque.amount, `چک ${cheque.serial}`));
  ledger.loans.forEach((loan) => loanSchedule(loan).filter((row) => !row.paid).forEach((row) => add(toMs(row.due), "out", row.amount, `قسط ${loan.title}`)));
  buckets.forEach((bucket) => { bucket.net = bucket.inflow - bucket.outflow; });
  return buckets;
}

export interface PartyRisk { id: string; name: string; balance: number; score: number; level: "کم" | "متوسط" | "زیاد"; reasons: string[]; }

export function partyRiskScores(ledger: LedgerState): PartyRisk[] {
  return ledger.parties.map((party) => {
    const totals = partyTotals(party, ledger.payments);
    let score = 0;
    const reasons: string[] = [];
    if (totals.overdue) { score += 30; reasons.push("پرداخت سرگذشته"); }
    if (totals.ratio < 20 && totals.original > 0) { score += 20; reasons.push("کمتر از ۲۰٪ تسویه"); }
    if (!party.phone || party.phone.replace(/\D/g, "").length < 8) { score += 10; reasons.push("شماره تماس ناقص"); }
    if (!party.dueDate) { score += 10; reasons.push("بدون تاریخ پیگیری"); }
    if (totals.balance > 100_000_000) { score += 20; reasons.push("مانده بالای ۱۰۰ میلیون تومان"); }
    const duplicate = ledger.payments.filter((payment) => payment.partyId === party.id).length === 0 && totals.original > 0;
    if (duplicate) { score += 5; reasons.push("بدون سابقه پرداخت"); }
    return { id: party.id, name: party.name, balance: totals.balance, score: Math.min(100, score), level: (score >= 60 ? "زیاد" : score >= 30 ? "متوسط" : "کم") as PartyRisk["level"], reasons };
  }).sort((a, b) => b.score - a.score);
}

export interface ContractRisk { id: string; title: string; code: string; score: number; level: "کم" | "متوسط" | "زیاد"; reasons: string[]; }

export function contractRiskScores(contracts: SavedContract[]): ContractRisk[] {
  return contracts.map((contract) => {
    let score = 0;
    const reasons: string[] = [];
    const daysLeft = Math.round((toMs(contract.end) - todayMs()) / day);
    if (daysLeft < 0) { score += 30; reasons.push("مدت قرارداد تمام شده"); }
    else if (daysLeft <= 60) { score += 15; reasons.push(`پایان در ${daysLeft} روز`); }
    if (!contract.signatures || contract.signatures.length < 2) { score += 25; reasons.push("امضای طرفین ناقص"); }
    if (!contract.plaque) { score += 10; reasons.push("پلاک ثبتی ثبت نشده"); }
    if (contract.cropShare > 70) { score += 15; reasons.push("سهم محصول نامتعارف"); }
    if (contract.deposit > contract.rent * 2 && contract.rent > 0) { score += 10; reasons.push("ودیعه سنگین"); }
    if (!contract.obligations) { score += 10; reasons.push("شرایط و تعهدات خالی"); }
    return { id: contract.id, title: contract.landTitle, code: contract.code, score, level: (score >= 60 ? "زیاد" : score >= 30 ? "متوسط" : "کم") as PartyRisk["level"], reasons };
  }).sort((a, b) => b.score - a.score);
}

export interface CropRanking { id: string; title: string; crop: string; revenue: number; cost: number; profit: number; margin: number; costPerKg: number; breakEven: number; rank: number; }

export function cropRanking(plots: CropPlot[]): CropRanking[] {
  return plots.map((plot) => { const metrics = plotMetrics(plot); return { id: plot.id, title: plot.title, crop: plot.crop, revenue: metrics.revenue, cost: metrics.cost, profit: metrics.profit, margin: metrics.margin, costPerKg: metrics.costPerKg, breakEven: metrics.breakEven, rank: 0 }; }).sort((a, b) => b.profit - a.profit).map((row, index) => ({ ...row, rank: index + 1 }));
}

export interface Reorder { id: string; name: string; stock: number; min: number; unit: string; qty: number; cost: number; }

export function reorderSuggestions(ledger: LedgerState): Reorder[] {
  return ledger.items.filter((item) => item.stock <= item.min).map((item) => ({ id: item.id, name: item.name, stock: item.stock, min: item.min, unit: item.unit, qty: Math.max(item.min * 2 - item.stock, item.min), cost: Math.max(item.min * 2 - item.stock, item.min) * item.cost })).sort((a, b) => b.cost - a.cost);
}

export interface AgingBucket { label: string; amount: number; count: number; }

export function agingBuckets(ledger: LedgerState): AgingBucket[] {
  const buckets: AgingBucket[] = [ { label: "جاری", amount: 0, count: 0 }, { label: "۱ تا ۳۰ روز", amount: 0, count: 0 }, { label: "۳۱ تا ۶۰ روز", amount: 0, count: 0 }, { label: "بیش از ۶۰ روز", amount: 0, count: 0 } ];
  ledger.parties.filter((party) => party.kind === "debtor").forEach((party) => {
    const totals = partyTotals(party, ledger.payments);
    if (totals.balance <= 0) return;
    const age = Math.max(0, Math.round((todayMs() - toMs(party.date)) / day));
    const bucket = age === 0 ? 0 : age <= 30 ? 1 : age <= 60 ? 2 : 3;
    buckets[bucket].amount += totals.balance; buckets[bucket].count += 1;
  });
  return buckets;
}

export function signatureCompliance(contracts: SavedContract[]): { total: number; signed: number; pending: number; percent: number } {
  const total = contracts.length;
  const signed = contracts.filter((contract) => (contract.signatures ?? []).some((signature) => signature.role === "landlord") && (contract.signatures ?? []).some((signature) => signature.role === "tenant")).length;
  return { total, signed, pending: total - signed, percent: total ? Math.round((signed / total) * 100) : 0 };
}
