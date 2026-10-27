import { useState } from "react";
import {
  ArrowLeft,
  Search,
  CalendarRange,
  FileCheck2,
  FilePlus2,
  Files,
  Info,
  LandPlot,
  ScrollText,
  UsersRound,
} from "lucide-react";
import { cn } from "../utils/cn";
import {
  CONTRACT_TYPES,
  type Page,
  type Party,
  type SavedContract,
} from "../lib/data";
import { formatJalali, formatNumber, toPersianDigits } from "../lib/format";
import { ContractForm } from "../components/ContractForm";
import { ContractPreview } from "../components/ContractPreview";
import { RoleBadge, StatusPill, Toast } from "../components/ui";

type Tab = "new" | "list";

export function ContractsPage({
  parties,
  contracts,
  onCreateParty,
  onCreateContract,
  onNavigate,
}: {
  parties: Party[];
  contracts: SavedContract[];
  onCreateParty: (party: Omit<Party, "id">) => Party;
  onCreateContract: (contract: Omit<SavedContract, "id" | "code" | "createdAt">) => SavedContract;
  onNavigate: (page: Page) => void;
}) {
  const [tab, setTab] = useState<Tab>("new");
  const [previewContract, setPreviewContract] = useState<SavedContract | null>(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:mb-6 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]">
            <ScrollText className="h-3.5 w-3.5 text-mint-300" />
            قراردادهای کشاورزی
            <span className="rounded-md border border-mint-300/15 bg-mint-300/[0.07] px-1.5 py-0.5 text-[8px] text-mint-300">
              امضای الکترونیکی
            </span>
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">قرارداد زمین کشاورزی</h1>
          <p className="mt-1.5 max-w-xl text-[11px] font-light leading-6 text-[#89a598]">
            نقش خودتان را انتخاب کنید، طرف مقابل را از فهرست واجد شرایط بردارید و شرایط مالی را با تاریخ شمسی ثبت کنید.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("new")}
            className="hidden items-center gap-2 rounded-xl bg-mint-400 px-4 py-2.5 text-[10px] font-bold text-[#07110d] transition hover:bg-mint-300 sm:flex"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            قرارداد جدید
          </button>
        </div>
      </div>

      <div className="mb-4 flex w-full max-w-sm items-center rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
        <button
          type="button"
          onClick={() => setTab("new")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] transition",
            tab === "new" ? "bg-[#1d402f] font-medium text-mint-300" : "text-[#819d90] hover:text-[#c4d8cd]"
          )}
        >
          <FilePlus2 className="h-3.5 w-3.5" />
          قرارداد جدید
        </button>
        <button
          type="button"
          onClick={() => setTab("list")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] transition",
            tab === "list" ? "bg-[#1d402f] font-medium text-mint-300" : "text-[#819d90] hover:text-[#c4d8cd]"
          )}
        >
          <Files className="h-3.5 w-3.5" />
          قراردادهای من
          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[8px] text-[#9eb4a9]">{toPersianDigits(contracts.length)}</span>
        </button>
      </div>

      {tab === "list" && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6c897b]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجوی شماره قرارداد، طرف‌حساب، زمین یا کد پیگیری…" className="field pr-9 py-2 text-[10px]" aria-label="جست‌وجوی قرارداد" />
        </div>
      )}

      {tab === "new" ? (
        <ContractForm parties={parties} contracts={contracts} onCreateParty={onCreateParty} onCreateContract={onCreateContract} />
      ) : (
        <div className="space-y-3">
          {contracts.filter((contract) => { const haystack = `${contract.code} ${contract.trackingCode ?? ""} ${contract.partyName} ${contract.landTitle} ${contract.crop} ${contract.myName ?? ""}`; return !search.trim() || haystack.includes(search.trim()); }).map((contract) => {
            const type = CONTRACT_TYPES.find((item) => item.id === contract.type);
            return (
              <div
                key={contract.id}
                className="glass rounded-2xl p-4 transition hover:border-mint-300/20 sm:flex sm:items-center sm:gap-4 sm:p-5"
              >
                <div className="mb-3 flex items-center justify-between sm:mb-0 sm:block sm:w-28 sm:shrink-0">
                  <div className="text-[11px] font-bold tracking-wide text-white">{contract.code}</div>
                  <div className="mt-1.5">
                    <StatusPill status={contract.status} />
                  </div>
                </div>
                <div className="min-w-0 flex-1 sm:border-r sm:border-white/[0.07] sm:pr-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[12px] font-semibold text-[#eaf5ee]">{contract.landTitle}</h3>
                    <RoleBadge role={contract.myRole} small />
                    <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[9px] text-[#99b1a5]">{type?.label}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[#7f9c8e]">
                    <span className="flex items-center gap-1">
                      <UsersRound className="h-3 w-3" />
                      {contract.partyName}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarRange className="h-3 w-3" />
                      {formatJalali(contract.start, "short")} تا {formatJalali(contract.end, "short")}
                    </span>
                    <span className="flex items-center gap-1">
                      <LandPlot className="h-3 w-3" />
                      {contract.crop}
                    </span>
                  </div>
                </div>
                {contract.signatures && contract.signatures.length > 0 && (
                  <div className="mt-2 flex w-full flex-wrap items-center gap-2 rounded-lg border border-mint-300/15 bg-mint-300/[0.04] px-2.5 py-2">
                    <span className="text-[8px] text-[#9fbfae]">امضای ثبت‌شده:</span>
                    {contract.signatures.map((signature) => (
                      <span key={signature.id} className="flex items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-1">
                        <img src={signature.image} alt={`امضای ${signature.signerName}`} className="h-5 w-10 rounded-sm bg-white object-contain" />
                        <span className="text-[7px] text-[#b7cdc1]">{signature.role === "landlord" ? "موجر" : signature.role === "tenant" ? "مستاجر" : "شاهد"} · {signature.signerName}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3 sm:mt-0 sm:block sm:border-0 sm:pt-0 sm:text-left">
                  <div>
                    <div className="text-[11px] font-semibold text-mint-300">
                      {contract.rent ? `${formatNumber(contract.rent)} تومان` : `${toPersianDigits(contract.cropShare)}٪ سهم محصول`}
                    </div>
                    <div className="mt-0.5 text-[8px] text-[#718e81]">ودیعه {formatNumber(contract.deposit)} تومان</div>
                    <div className="mt-1 text-[7px] font-mono text-[#6f8c7f]">{contract.trackingCode || contract.code} · {toPersianDigits(contract.signatures?.length ?? 0)} امضا</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewContract(contract)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-1.5 text-[9px] text-[#b8cec3] transition hover:border-mint-300/25 hover:text-mint-300 sm:mt-2"
                  >
                    <FileCheck2 className="h-3 w-3" />
                    مشاهده امضا و سند
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setTab("new")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#355344] bg-white/[0.015] py-4 text-[10px] text-[#89a598] transition hover:border-mint-300/30 hover:text-mint-300"
          >
            <FilePlus2 className="h-4 w-4" />
            ثبت قرارداد جدید
          </button>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-[9px] font-light text-[#728f82] sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1.5">
          <Info className="h-3 w-3" />
          این پیش‌نویس داخلی است و جایگزین سند رسمی یا نظر حقوقی نیست.
        </span>
        <button type="button" onClick={() => onNavigate("download")} className="flex items-center gap-1 text-[#a5c0b2] transition hover:text-mint-300">
          نسخه اندروید: {toPersianDigits("1.0.0")}
          <ArrowLeft className="h-3 w-3" />
        </button>
      </div>

      <ContractPreview
        open={Boolean(previewContract)}
        onClose={() => setPreviewContract(null)}
        contract={previewContract}
        onCopy={(code) => {
          void navigator.clipboard?.writeText(code);
          setCopied(true);
        }}
      />
      <Toast open={copied} message="شماره قرارداد کپی شد" onClose={() => setCopied(false)} />
    </div>
  );
}
