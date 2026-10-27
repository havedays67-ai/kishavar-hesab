import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { DocumentDialog } from "./components/PrintSheet";
import {
  initialContracts,
  initialParties,
  type Page,
  type Party,
  type SavedContract,
} from "./lib/data";
import {
  initialPlots,
  initialTrades,
  type CropPlot,
} from "./lib/samples";
import { todayJalali, toPersianDigits } from "./lib/format";
import type { DocumentSpec } from "./lib/documents";
import type { CropTrade } from "./lib/trade";
import { ArchitecturePage } from "./pages/ArchitecturePage";
import { ContractsPage } from "./pages/ContractsPage";
import { CropsPage } from "./pages/CropsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { DownloadPage } from "./pages/DownloadPage";
import { PartiesPage } from "./pages/PartiesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { TradePage } from "./pages/TradePage";

const AVAILABLE_PAGES: Page[] = [
  "dashboard",
  "trade",
  "contracts",
  "crops",
  "documents",
  "parties",
  "reports",
  "architecture",
  "download",
];

const STORAGE_PARTIES = "kishavar.parties.v1";
const STORAGE_CONTRACTS = "kishavar.contracts.v1";
const STORAGE_TRADES = "kishavar.trades.v2";
const STORAGE_PLOTS = "kishavar.plots.v2";

const PAGE_TITLES: Record<Page, string> = {
  dashboard: "پیشخوان",
  trade: "معامله محصول",
  contracts: "قرارداد زمین کشاورزی",
  crops: "زمین و کشت",
  documents: "اسناد و چاپ",
  parties: "طرف‌حساب‌ها",
  reports: "گزارش‌های مدیریتی",
  architecture: "معماری و فرمول‌ها",
  download: "دریافت برنامه",
};

function readPageFromHash(): Page {
  const hash = window.location.hash.replace("#", "").split("?")[0] as Page;
  return AVAILABLE_PAGES.includes(hash) ? hash : "dashboard";
}

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [page, setPage] = useState<Page>(readPageFromHash);
  const [parties, setParties] = useState<Party[]>(() => loadStored(STORAGE_PARTIES, initialParties));
  const [contracts, setContracts] = useState<SavedContract[]>(() => loadStored(STORAGE_CONTRACTS, initialContracts));
  const [trades, setTrades] = useState<CropTrade[]>(() => loadStored(STORAGE_TRADES, initialTrades));
  const [plots, setPlots] = useState<CropPlot[]>(() => loadStored(STORAGE_PLOTS, initialPlots));
  const [activeDocument, setActiveDocument] = useState<DocumentSpec | null>(null);

  useEffect(() => {
    document.title = `${PAGE_TITLES[page]} | کسب‌وکار من`;
  }, [page]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_PARTIES, JSON.stringify(parties));
    } catch {
      /* storage may be unavailable */
    }
  }, [parties]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_CONTRACTS, JSON.stringify(contracts));
    } catch {
      /* storage may be unavailable */
    }
  }, [contracts]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_TRADES, JSON.stringify(trades));
    } catch {
      /* storage may be unavailable */
    }
  }, [trades]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_PLOTS, JSON.stringify(plots));
    } catch {
      /* storage may be unavailable */
    }
  }, [plots]);

  useEffect(() => {
    const onHashChange = () => setPage(readPageFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

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

  const createContract = (
    contract: Omit<SavedContract, "id" | "code" | "createdAt">
  ): SavedContract => {
    const today = todayJalali();
    const sequence = String(contracts.length + 1).padStart(3, "0");
    const created: SavedContract = {
      ...contract,
      id: `contract-${Date.now()}`,
      code: toPersianDigits(`${today.jy}-${sequence}`),
      createdAt: today,
    };
    setContracts((current) => [created, ...current]);
    return created;
  };

  const saveTrade = (trade: CropTrade) => {
    setTrades((current) => [trade, ...current]);
  };

  const updateTrade = (id: string, patch: Partial<CropTrade>) => {
    setTrades((current) => current.map((trade) => (trade.id === id ? { ...trade, ...patch } : trade)));
  };

  return (
    <>
      <AppShell page={page} onNavigate={navigate}>
        {page === "dashboard" && (
          <DashboardPage
            contracts={contracts}
            trades={trades}
            plots={plots}
            onNavigate={navigate}
            onOpenDocument={setActiveDocument}
          />
        )}
        {page === "trade" && (
          <TradePage
            trades={trades}
            onSaveTrade={saveTrade}
            onUpdateTrade={updateTrade}
            onOpenDocument={setActiveDocument}
          />
        )}
        {page === "contracts" && (
          <ContractsPage
            parties={parties}
            contracts={contracts}
            onCreateParty={createParty}
            onCreateContract={createContract}
            onNavigate={navigate}
          />
        )}
        {page === "crops" && (
          <CropsPage
            plots={plots}
            onAddPlot={(plot) => setPlots((current) => [plot, ...current])}
            onDeletePlot={(id) => setPlots((current) => current.filter((plot) => plot.id !== id))}
            onOpenDocument={setActiveDocument}
          />
        )}
        {page === "documents" && (
          <DocumentsPage
            trades={trades}
            contracts={contracts}
            plots={plots}
            onOpenDocument={setActiveDocument}
          />
        )}
        {page === "parties" && (
          <PartiesPage parties={parties} contracts={contracts} onCreateParty={createParty} />
        )}
        {page === "reports" && (
          <ReportsPage
            trades={trades}
            plots={plots}
            contracts={contracts}
            onOpenDocument={setActiveDocument}
            onNavigateTrade={() => navigate("trade")}
          />
        )}
        {page === "architecture" && <ArchitecturePage />}
        {page === "download" && <DownloadPage />}
      </AppShell>

      {activeDocument && (
        <DocumentDialog
          spec={activeDocument}
          onClose={() => setActiveDocument(null)}
          onPrint={() => window.print()}
        />
      )}
    </>
  );
}
