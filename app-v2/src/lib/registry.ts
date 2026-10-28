import { makeDocument, type DocumentSpec } from "./documents";
import type { SavedContract } from "./data";
import { type CropTrade, getProductProfile } from "./trade";
import { plotMetrics, type CropPlot } from "./samples";
import type { LedgerState } from "./ledger";

/** همه اسناد قابل تولید از داده واقعی — بدون سند خالی */
export function buildDocumentRegistry(trades: CropTrade[], contracts: SavedContract[], plots: CropPlot[], cheques: LedgerState["cheques"] = []): DocumentSpec[] {
  const documents: DocumentSpec[] = [];
  for (const trade of trades) {
    for (const kind of ["sale-contract", "weigh-ticket", "quality-minutes", "sale-invoice", "settlement"] as const) {
      documents.push(makeDocument(kind, { trade }));
    }
  }
  for (const contract of contracts) {
    for (const kind of ["lease-contract", "lease-receipt", "lease-handover"] as const) {
      documents.push(makeDocument(kind, { contract }));
    }
  }
  for (const cheque of cheques) documents.push(makeDocument("cheque-sheet", { cheque }));
  if (trades.length > 0) documents.push(makeDocument("trades-report", { trades }));
  if (plots.length > 0) {
    const costRows = plots.map((plot) => {
      const metrics = plotMetrics(plot);
      return { title: plot.title, areaHa: plot.areaHa, crop: plot.crop, totalCost: metrics.cost, yieldKg: metrics.yieldKg, revenue: metrics.revenue, profit: metrics.profit };
    });
    documents.push(makeDocument("cost-report", { costRows }));
  }
  return documents;
}

export function tradeProductName(trade: CropTrade): string {
  return getProductProfile(trade.productId).name;
}
