import type { DocumentSpec } from "./documents";
import type { DebtParty, Cheque, Loan, LedgerState } from "./ledger";
import type { CropTrade } from "./trade";
import { ENTITY_SIGNATURE_ROLES, entityPayloadHash, rolesForDocument, type SignableEntity } from "./signatures";
import { todayJalali } from "./format";

function base(id: string, type: SignableEntity["type"], title: string, subtitle: string, serial: string, amount: number, payload: unknown, roles: SignableEntity["roles"], createdAt = todayJalali()): SignableEntity {
  return { id, type, title, subtitle, serial, amount, payload, roles, createdAt };
}

export function documentEntity(spec: DocumentSpec): SignableEntity {
  return base(
    `doc:${spec.serial}`,
    "document",
    spec.meta.title,
    `سند ${spec.serial} · ${spec.meta.description}`,
    spec.serial,
    spec.payload.trade?.result.netReceipt ?? spec.payload.contract?.rent ?? 0,
    { kind: spec.kind, serial: spec.serial, date: spec.date, payload: spec.payload },
    rolesForDocument(spec.kind),
    spec.date
  );
}

export function partyEntity(party: DebtParty): SignableEntity {
  return base(
    `party:${party.id}`,
    "party",
    `تعهد ${party.kind === "debtor" ? "طلب" : "بدهی"} — ${party.name}`,
    `${party.reason} · ثبت ${party.date.jy}/${party.date.jm}/${party.date.jd}`,
    `PARTY-${party.id}`,
    party.amount,
    { name: party.name, amount: party.amount, reason: party.reason, date: party.date, phone: party.phone },
    ENTITY_SIGNATURE_ROLES.party,
    party.date
  );
}

export function chequeEntity(cheque: Cheque): SignableEntity {
  return base(
    `cheque:${cheque.id}`,
    "cheque",
    `چک ${cheque.direction === "received" ? "دریافتی" : "پرداختی"} — ${cheque.serial}`,
    `${cheque.partyName} · ${cheque.bank} · سررسید ${cheque.due.jy}/${cheque.due.jm}/${cheque.due.jd}`,
    `CHQ-${cheque.serial}`,
    cheque.amount,
    { ...cheque },
    ENTITY_SIGNATURE_ROLES.cheque
  );
}

export function loanEntity(loan: Loan): SignableEntity {
  return base(
    `loan:${loan.id}`,
    "loan",
    `وام — ${loan.title}`,
    `${loan.lender} · ${loan.months} قسط · اصل ${loan.principal.toLocaleString("en-US")} تومان`,
    `LOAN-${loan.id}`,
    loan.principal,
    { ...loan },
    ENTITY_SIGNATURE_ROLES.loan
  );
}

export function tradeEntity(trade: CropTrade): SignableEntity {
  return base(
    `trade:${trade.id}`,
    "trade",
    `معامله محصول — ${trade.buyerName}`,
    `${trade.serial} · ${trade.result.quality.label} · ${Math.round(trade.result.payableKg).toLocaleString("en-US")} کیلوگرم`,
    trade.serial,
    trade.result.netReceipt,
    { serial: trade.serial, buyer: trade.buyerName, seller: trade.sellerName, payableKg: trade.result.payableKg, netReceipt: trade.result.netReceipt, date: trade.date },
    ENTITY_SIGNATURE_ROLES.trade,
    trade.date
  );
}

export function entityHash(entity: SignableEntity): string {
  return entityPayloadHash(entity.payload);
}

export function buildSignableEntities(input: {
  ledger: LedgerState;
  trades: CropTrade[];
  documents: DocumentSpec[];
}): SignableEntity[] {
  return [
    ...input.documents.map(documentEntity),
    ...input.trades.map(tradeEntity),
    ...input.ledger.parties.map(partyEntity),
    ...input.ledger.cheques.map(chequeEntity),
    ...input.ledger.loans.map(loanEntity),
  ];
}
