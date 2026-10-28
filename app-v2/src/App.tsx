import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { AppShell } from "./components/AppShell";
import { DocumentDialog } from "./components/PrintSheet";
import {
  initialContracts,
  initialParties,
  type Page,
  type Party,
  type SavedContract,
} from "./lib/data";
import { initialPlots, initialTrades, type CropPlot } from "./lib/samples";
import {
  LEDGER_STORAGE_KEY,
  emptyLedger,
  initialLedger,
  DEMO_FLAG_KEY,
  type Asset,
  type Budget,
  type Cheque,
  type DebtParty,
  type FinanceEntry,
  type InventoryItem,
  type InventoryMove,
  type LedgerState,
  type Loan,
  type PartyPayment,
} from "./lib/ledger";
import { todayJalali } from "./lib/format";
import { makeDocument, type DocumentSpec } from "./lib/documents";
import type { CropTrade } from "./lib/trade";

import { BackupPage, type BackupBundle } from "./pages/BackupPage";
import { ContractsPage } from "./pages/ContractsPage";
import { CropsPage } from "./pages/CropsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { DownloadPage } from "./pages/DownloadPage";
import { FinancePage } from "./pages/FinancePage";
import { InventoryPage } from "./pages/InventoryPage";
import { PartiesPage } from "./pages/PartiesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SignaturesPage } from "./pages/SignaturesPage";
import { RemindersPage } from "./lib/reminders";
import { buildDocumentRegistry } from "./lib/registry";
import { contractTrackingCode, nextContractCode } from "./lib/contracts";
import { useSignatures } from "./lib/signatureContext";
import { buildSignableEntities } from "./lib/signable";
import { buildInsights } from "./lib/insights";
import { useMemo } from "react";
import { ReceiptsPage } from "./pages/ReceiptsPage";
import { RentalsPage, type LeaseSignature, type RentPaymentRecord } from "./pages/RentalsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { TradePage } from "./pages/TradePage";
import { QuickSalePage } from "./pages/QuickSalePage";

const AVAILABLE_PAGES: Page[] = [
  "dashboard",
  "trade",
  "quick-sale",
  "contracts",
  "rentals",
  "crops",
  "finance",
  "parties",
  "inventory",
  "documents",
  "receipts",
  "reports",
  "backup",
  "signatures",
  "reminders",
  "profile",
  "architecture",
  "download",
];

function wantsDemo(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      window.localStorage.setItem(DEMO_FLAG_KEY, "1");
      return true;
    }
    return window.localStorage.getItem(DEMO_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

const DEMO_MODE = wantsDemo();

const STORAGE_PARTIES = "kishavar.parties.v3";
const STORAGE_CONTRACTS = "kishavar.contracts.v3";
const STORAGE_TRADES = "kishavar.trades.v3";
const STORAGE_PLOTS = "kishavar.plots.v3";
const STORAGE_RENTS = "kishavar.rents.v1";
const STORAGE_SIGNATURES = "kishavar.signatures.v1";

const PAGE_TITLES: Record<Page, string> = {
  dashboard: "پیشخوان",
  trade: "معامله محصول",
  "quick-sale": "فروش ساده",
  contracts: "قرارداد زمین کشاورزی",
  rentals: "اجاره و اقساط",
  crops: "زمین و کشت",
  finance: "دفتر مالی",
  parties: "بدهکار و بستانکار",
  inventory: "انبار، دارایی و بودجه",
  documents: "اسناد و چاپ",
  receipts: "رسید و فیش",
  reports: "گزارش‌های مدیریتی",
  backup: "دستیار و پشتیبان",
  signatures: "امضا و اعتبار",
  reminders: "یادآوری و هشدار",
  profile: "پروفایل",
  architecture: "معماری و فرمول‌ها",
  download: "دریافت برنامه",
};

function readPageFromHash(): Page {
  const hash = window.location.hash.replace("#", "").split("?")[0] as Page;
  if (hash === "download" && Capacitor.isNativePlatform()) return "dashboard";
  if (hash === "architecture") return "dashboard";
  return AVAILABLE_PAGES.includes(hash) ? hash : "dashboard";
}

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadList<T>(key: string, fallback: T[]): T[] {
  const value = loadStored<T[] | null>(key, null);
  return Array.isArray(value) && value.length > 0 ? value : fallback;
}

export default function App() {
  const [page, setPage] = useState<Page>(readPageFromHash);
  const [parties, setParties] = useState<Party[]>(() => loadList(STORAGE_PARTIES, DEMO_MODE ? initialParties : []));
  const [contracts, setContracts] = useState<SavedContract[]>(() => loadList(STORAGE_CONTRACTS, DEMO_MODE ? initialContracts : []));
  const [trades, setTrades] = useState<CropTrade[]>(() => loadList(STORAGE_TRADES, DEMO_MODE ? initialTrades : []));
  const [plots, setPlots] = useState<CropPlot[]>(() => loadList(STORAGE_PLOTS, DEMO_MODE ? initialPlots : []));
  const [ledger, setLedger] = useState<LedgerState>(() => loadStored<LedgerState>(LEDGER_STORAGE_KEY, DEMO_MODE ? initialLedger() : emptyLedger()));
  const [rentPayments, setRentPayments] = useState<RentPaymentRecord[]>(() => loadList(STORAGE_RENTS, []));
  const [signatures, setSignatures] = useState<LeaseSignature[]>(() => loadList(STORAGE_SIGNATURES, []));
  const [activeDocument, setActiveDocument] = useState<DocumentSpec | null>(null);
  const documents = buildDocumentRegistry(trades, contracts, plots, ledger.cheques);
  const { audit } = useSignatures();
  const health = useMemo(() => {
    const entities = buildSignableEntities({ ledger, trades, documents });
    return buildInsights({ ledger, trades, plots, contracts, signableEntities: entities, pendingSignatures: entities.map((entity) => { const report = audit(entity); return { entity, required: report.required, signed: report.signed, missing: report.missing.length }; }) });
  }, [ledger, trades, documents, plots, contracts, audit]);

  useEffect(() => {
    document.title = `${PAGE_TITLES[page]} | کشاورزحساب`;
    setActiveDocument(null);
  }, [page]);

  useEffect(() => {
    const onHashChange = () => setPage(readPageFromHash());
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("popstate", onHashChange);
    };
  }, []);

  const persist = (key: string, value: unknown) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage may be unavailable */
    }
  };

  useEffect(() => persist(STORAGE_PARTIES, parties), [parties]);
  useEffect(() => persist(STORAGE_CONTRACTS, contracts), [contracts]);
  useEffect(() => persist(STORAGE_TRADES, trades), [trades]);
  useEffect(() => persist(STORAGE_PLOTS, plots), [plots]);
  useEffect(() => persist(LEDGER_STORAGE_KEY, ledger), [ledger]);
  useEffect(() => persist(STORAGE_RENTS, rentPayments), [rentPayments]);
  useEffect(() => persist(STORAGE_SIGNATURES, signatures), [signatures]);

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    if (window.location.hash !== `#${nextPage}`) {
      window.history.replaceState(null, "", `#${nextPage}`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const createParty = (party: Omit<Party, "id">): Party => {
    const created: Party = { ...party, id: `party-${Date.now()}-${Math.floor(Math.random() * 1000)}` };
    setParties((current) => [...current, created]);
    return created;
  };

  const createContract = (contract: Omit<SavedContract, "id" | "code" | "createdAt">): SavedContract => {
    const today = todayJalali();
    const code = nextContractCode(contracts, today.jy);
    const created: SavedContract = {
      ...contract,
      id: `contract-${Date.now()}`,
      code,
      trackingCode: contractTrackingCode({ code, partyName: contract.partyName, start: contract.start, rent: contract.rent, area: contract.area ?? "" }),
      createdAt: today,
    };
    setContracts((current) => [created, ...current]);
    return created;
  };

  const updateLedger = (patch: Partial<LedgerState>) => setLedger((current) => ({ ...current, ...patch }));

  const addPartyAccount = (party: DebtParty) => updateLedger({ parties: [party, ...ledger.parties] });
  const updatePartyAccount = (party: DebtParty) => updateLedger({ parties: ledger.parties.map((row) => (row.id === party.id ? party : row)) });
  const deletePartyAccount = (id: string) => updateLedger({
    parties: ledger.parties.filter((party) => party.id !== id),
    payments: ledger.payments.filter((payment) => payment.partyId !== id),
  });
  const addPartyPayment = (payment: PartyPayment) => updateLedger({ payments: [payment, ...ledger.payments] });
  const deletePartyPayment = (id: string) => updateLedger({ payments: ledger.payments.filter((payment) => payment.id !== id) });

  const addEntry = (entry: FinanceEntry) => updateLedger({ entries: [entry, ...ledger.entries] });
  const updateEntry = (entry: FinanceEntry) => updateLedger({ entries: ledger.entries.map((row) => (row.id === entry.id ? entry : row)) });
  const deleteEntry = (id: string) => updateLedger({ entries: ledger.entries.filter((entry) => entry.id !== id) });
  const addCheque = (cheque: Cheque) => updateLedger({ cheques: [cheque, ...ledger.cheques] });
  const setChequeStatus = (id: string, status: Cheque["status"]) => updateLedger({ cheques: ledger.cheques.map((cheque) => (cheque.id === id ? { ...cheque, status } : cheque)) });
  const updateCheque = (cheque: Cheque) => updateLedger({ cheques: ledger.cheques.map((row) => (row.id === cheque.id ? cheque : row)) });
  const settleCheque = (id: string, status: Cheque["status"], date: import("./lib/format").JDate) => {
    const cheque = ledger.cheques.find((row) => row.id === id);
    if (!cheque) return;
    updateLedger({
      cheques: ledger.cheques.map((row) => (row.id === id ? { ...row, status, settledDate: date } : row)),
      entries: cheque.status === "pending" ? [{ id: `fin-${Date.now()}`, kind: cheque.direction === "received" ? "income" : "expense", date, amount: cheque.amount, reason: `${cheque.direction === "received" ? "وصول چک دریافتی" : "پرداخت چک"} — ${cheque.serial}`, category: cheque.direction === "received" ? "فروش محصول" : "سایر هزینه", method: "cheque", partyId: null, note: cheque.bank }, ...ledger.entries] : ledger.entries,
    });
  };
  const deleteCheque = (id: string) => updateLedger({ cheques: ledger.cheques.filter((cheque) => cheque.id !== id) });
  const addLoan = (loan: Loan) => updateLedger({ loans: [loan, ...ledger.loans] });
  const payLoan = (id: string) => updateLedger({ loans: ledger.loans.map((loan) => (loan.id === id ? { ...loan, paidInstallments: Math.min(loan.months, loan.paidInstallments + 1) } : loan)) });
  const deleteLoan = (id: string) => updateLedger({ loans: ledger.loans.filter((loan) => loan.id !== id) });

  const addItem = (item: InventoryItem) => updateLedger({ items: [item, ...ledger.items] });
  const updateItem = (item: InventoryItem) => updateLedger({ items: ledger.items.map((row) => (row.id === item.id ? item : row)) });
  const deleteItem = (id: string) => updateLedger({ items: ledger.items.filter((item) => item.id !== id), moves: ledger.moves.filter((move) => move.itemId !== id) });
  const addMove = (move: InventoryMove) => updateLedger({
    moves: [move, ...ledger.moves],
    items: ledger.items.map((item) => (item.id === move.itemId ? { ...item, stock: Math.max(0, item.stock + (move.kind === "in" ? move.qty : -move.qty)) } : item)),
  });
  const addAsset = (asset: Asset) => updateLedger({ assets: [asset, ...ledger.assets] });
  const deleteAsset = (id: string) => updateLedger({ assets: ledger.assets.filter((asset) => asset.id !== id) });
  const addBudget = (budget: Budget) => updateLedger({ budgets: [...ledger.budgets.filter((row) => row.category !== budget.category), budget] });
  const deleteBudget = (id: string) => updateLedger({ budgets: ledger.budgets.filter((budget) => budget.id !== id) });

  const restore = (bundle: BackupBundle) => {
    setParties(Array.isArray(bundle.parties) ? (bundle.parties as Party[]) : []);
    setContracts(Array.isArray(bundle.contracts) ? (bundle.contracts as SavedContract[]) : []);
    setTrades(Array.isArray(bundle.trades) ? (bundle.trades as CropTrade[]) : []);
    setPlots(Array.isArray(bundle.plots) ? (bundle.plots as CropPlot[]) : []);
    setLedger(bundle.ledger ? (bundle.ledger as LedgerState) : emptyLedger());
    setRentPayments(Array.isArray(bundle.rentPayments) ? (bundle.rentPayments as RentPaymentRecord[]) : []);
    setSignatures(Array.isArray(bundle.signatures) ? (bundle.signatures as LeaseSignature[]) : []);
  };

  const resetAll = () => {
    try { window.localStorage.removeItem(DEMO_FLAG_KEY); } catch { /* ignore */ }
    setParties([]);
    setContracts([]);
    setTrades([]);
    setPlots([]);
    setLedger(emptyLedger());
    setRentPayments([]);
    setSignatures([]);
  };

  const loadDemo = () => {
    try { window.localStorage.setItem(DEMO_FLAG_KEY, "1"); } catch { /* ignore */ }
    setParties(initialParties);
    setContracts(initialContracts);
    setTrades(initialTrades);
    setPlots(initialPlots);
    setLedger(initialLedger());
  };

  return (
    <>
      <AppShell page={page} onNavigate={navigate}>
        {page === "dashboard" && (
          <DashboardPage contracts={contracts} trades={trades} plots={plots} health={health} onNavigate={navigate} onOpenDocument={setActiveDocument} />
        )}
        {page === "trade" && (
          <TradePage
            trades={trades}
            contacts={ledger.parties.map((party) => ({ name: party.name, phone: party.phone }))}
            onSaveTrade={(trade) => setTrades((current) => [trade, ...current])}
            onDeleteTrade={(id) => setTrades((current) => current.filter((trade) => trade.id !== id))}
            onUpdateTrade={(id, patch) => setTrades((current) => current.map((trade) => (trade.id === id ? { ...trade, ...patch } : trade)))}
            onOpenDocument={setActiveDocument}
          />
        )}
        {page === "quick-sale" && <QuickSalePage />}
        {page === "contracts" && (
          <ContractsPage parties={parties} contracts={contracts} onCreateParty={createParty} onCreateContract={createContract} onNavigate={navigate} />
        )}
        {page === "rentals" && (
          <RentalsPage
            contracts={contracts}
            payments={rentPayments}
            signatures={signatures}
            onAddPayment={(payment) => setRentPayments((current) => [payment, ...current])}
            onDeletePayment={(id) => setRentPayments((current) => current.filter((payment) => payment.id !== id))}
            onAddSignature={(signature) => setSignatures((current) => [signature, ...current])}
            onDeleteContract={(id) => setContracts((current) => current.filter((contract) => contract.id !== id))}
            onDeleteSignature={(id) => setSignatures((current) => current.filter((signature) => signature.id !== id))}
            onOpenDocument={setActiveDocument}
          />
        )}
        {page === "crops" && (
          <CropsPage
            plots={plots}
            onAddPlot={(plot) => setPlots((current) => [plot, ...current])}
            onDeletePlot={(id) => setPlots((current) => current.filter((plot) => plot.id !== id))}
            onUpdatePlot={(plot) => setPlots((current) => current.map((row) => (row.id === plot.id ? plot : row)))}
            onOpenDocument={setActiveDocument}
          />
        )}
        {page === "finance" && (
          <FinancePage
            ledger={ledger}
            onAddEntry={addEntry}
            onUpdateEntry={updateEntry}
            onDeleteEntry={deleteEntry}
            onAddCheque={addCheque}
            onSetChequeStatus={setChequeStatus}
            onDeleteCheque={deleteCheque}
            onUpdateCheque={updateCheque}
            onSettleCheque={settleCheque}
            onAddLoan={addLoan}
            onPayLoan={payLoan}
            onDeleteLoan={deleteLoan}
            onPrintReport={() => setActiveDocument(makeDocument("finance-report", { entries: ledger.entries }))}
          />
        )}
        {page === "signatures" && <SignaturesPage ledger={ledger} trades={trades} documents={documents} />}
        {page === "parties" && (
          <PartiesPage
            ledger={ledger}
            onAddParty={addPartyAccount}
            onUpdateParty={updatePartyAccount}
            onDeleteParty={deletePartyAccount}
            onAddPayment={addPartyPayment}
            onDeletePayment={deletePartyPayment}
            onPrintParty={(party) => setActiveDocument(makeDocument("party-statement", party.id === "all" ? { parties: ledger.parties, payments: ledger.payments } : { party, payments: ledger.payments }))}
          />
        )}
        {page === "inventory" && (
          <InventoryPage
            ledger={ledger}
            onAddItem={addItem}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
            onAddMove={addMove}
            onAddAsset={addAsset}
            onDeleteAsset={deleteAsset}
            onAddBudget={addBudget}
            onDeleteBudget={deleteBudget}
            onDeleteMove={(id) => updateLedger({ moves: ledger.moves.filter((move) => move.id !== id) })}
            onPrintReport={() => setActiveDocument(makeDocument("inventory-report", { items: ledger.items, assets: ledger.assets, budgets: ledger.budgets, entries: ledger.entries }))}
          />
        )}
        {page === "documents" && (
          <DocumentsPage trades={trades} contracts={contracts} plots={plots} onOpenDocument={setActiveDocument} />
        )}
        {page === "receipts" && <ReceiptsPage />}
        {page === "reports" && (
          <ReportsPage trades={trades} plots={plots} contracts={contracts} health={health} onOpenDocument={setActiveDocument} onNavigateTrade={() => navigate("trade")} ledger={ledger} />
        )}
        {page === "backup" && (
          <BackupPage
            onLoadDemo={loadDemo}
            ledger={ledger}
            trades={trades}
            plots={plots}
            contracts={contracts}
            rentPayments={rentPayments}
            signatures={signatures}
            onRestore={restore}
            onReset={resetAll}
          />
        )}
        {page === "reminders" && <RemindersPage />}
        {page === "profile" && <ProfilePage onBack={() => navigate("dashboard")} />}
        {page === "download" && !Capacitor.isNativePlatform() && <DownloadPage />}
      </AppShell>

      {activeDocument && (
        <DocumentDialog spec={activeDocument} onClose={() => setActiveDocument(null)} />
      )}
    </>
  );
}
