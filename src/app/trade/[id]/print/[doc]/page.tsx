import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintControls } from "@/components/print/PrintControls";
import { TradeDocument } from "@/components/print/TradeDocument";
import { DOC_ORDER, type DocType } from "@/lib/trade/engine";
import { ensureDocument, getPayments, getTrade } from "@/lib/trade/service";

export const dynamic = "force-dynamic";

export default async function TradePrintPage({ params }: { params: Promise<{ id: string; doc: string }> }) {
  const { id, doc } = await params;
  const tradeId = Number(id);
  if (!Number.isFinite(tradeId) || !DOC_ORDER.includes(doc as DocType)) notFound();
  const docType = doc as DocType;
  const trade = await getTrade(tradeId);
  if (!trade) notFound();

  const [{ serial, issuedAt }, payments] = await Promise.all([ensureDocument(trade, docType), getPayments(tradeId)]);
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const verifyUrl = `${proto}://${host}/verify?serial=${encodeURIComponent(serial)}`;
  const qrSvg = await QRCode.toString(verifyUrl, { type: "svg", margin: 0, width: 110, errorCorrectionLevel: "M" });

  return (
    <div className="mx-auto max-w-[860px] space-y-3">
      <PrintControls tradeId={tradeId} docType={docType} />
      <TradeDocument
        trade={trade}
        payments={payments}
        docType={docType}
        serial={serial}
        issuedAt={issuedAt}
        verifyUrl={verifyUrl}
        qrSvg={qrSvg}
      />
    </div>
  );
}
