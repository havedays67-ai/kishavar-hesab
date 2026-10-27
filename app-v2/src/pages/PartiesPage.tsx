import { useState } from "react";
import {
  CheckCircle2,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { cn } from "../utils/cn";
import { type Party, type Role, type SavedContract } from "../lib/data";
import { normalizeSearch, toPersianDigits } from "../lib/format";
import { AddPartyModal } from "../components/CounterpartyPicker";
import { Avatar, RoleBadge, Toast } from "../components/ui";

export function PartiesPage({
  parties,
  contracts,
  onCreateParty,
}: {
  parties: Party[];
  contracts: SavedContract[];
  onCreateParty: (party: Omit<Party, "id">) => Party;
}) {
  const [filter, setFilter] = useState<"all" | Role>("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const visibleParties = parties.filter((party) => {
    const matchesRole = filter === "all" || party.role === filter;
    const haystack = normalizeSearch(`${party.name} ${party.city} ${party.detail} ${party.phone}`);
    return matchesRole && haystack.includes(normalizeSearch(search));
  });

  const landlords = parties.filter((party) => party.role === "landlord").length;
  const tenants = parties.filter((party) => party.role === "tenant").length;

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]">
            <UsersRound className="h-3.5 w-3.5 text-mint-300" />
            دفتر طرف‌حساب‌ها
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">طرف‌حساب‌های مزرعه</h1>
          <p className="mt-1.5 text-[11px] font-light text-[#89a598]">
            مالک زمین، مستاجر و شریک‌ها؛ همه در یک دفتر تمیز و قابل انتخاب.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-mint-400 px-4 py-2.5 text-[10px] font-bold text-[#07110d] transition hover:bg-mint-300"
        >
          <Plus className="h-3.5 w-3.5" />
          افزودن طرف‌حساب
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2.5">
        {[
          ["همه", parties.length, "طرف‌حساب"],
          ["مالک زمین", landlords, "موجر"],
          ["مستاجر", tenants, "بهره‌بردار"],
        ].map(([label, count, tag], index) => (
          <button
            key={label}
            type="button"
            onClick={() => setFilter(index === 0 ? "all" : index === 1 ? "landlord" : "tenant")}
            className={cn(
              "rounded-2xl border p-3 text-right transition sm:p-4",
              (index === 0 && filter === "all") || (index === 1 && filter === "landlord") || (index === 2 && filter === "tenant")
                ? "border-mint-300/25 bg-mint-300/[0.055]"
                : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.035]"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-[#86a295]">{label}</span>
              <span className="text-base font-bold text-[#ecf6f0]">{toPersianDigits(count)}</span>
            </div>
            <span className="mt-1 block text-[8px] font-light text-[#678477]">{tag}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6c897b]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جست‌وجوی نام، شهر یا تلفن…"
            className="field pr-10 text-[11px]"
            aria-label="جست‌وجوی طرف‌حساب"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
          {[
            ["all", "همه"],
            ["landlord", "موجر"],
            ["tenant", "مستاجر"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value as "all" | Role)}
              className={cn(
                "rounded-lg px-3 py-2 text-[9px] transition",
                filter === value ? "bg-[#1d402f] font-medium text-mint-300" : "text-[#7f9b8e] hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleParties.map((party) => {
          const relatedContracts = contracts.filter((contract) => contract.partyId === party.id).length;
          return (
            <article key={party.id} className="glass group rounded-2xl p-4 transition hover:border-mint-300/20">
              <div className="flex items-start gap-3">
                <Avatar name={party.name} color={party.color} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h2 className="truncate text-[12px] font-semibold text-[#ebf5ef]">{party.name}</h2>
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-mint-300" />
                  </div>
                  <div className="mt-1.5">
                    <RoleBadge role={party.role} small />
                  </div>
                </div>
                <span className="text-[8px] text-[#617e70]">{toPersianDigits(relatedContracts)} قرارداد</span>
              </div>
              <div className="mt-4 space-y-2 rounded-xl border border-white/[0.05] bg-[#071510]/45 p-2.5">
                <div className="flex items-center gap-2 text-[9px] text-[#9bb5a8]">
                  <Phone className="h-3 w-3 shrink-0 text-[#6f8e80]" />
                  <span dir="ltr" className="text-right tracking-wide">{party.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-[#9bb5a8]">
                  <MapPin className="h-3 w-3 shrink-0 text-[#6f8e80]" />
                  {party.city}
                </div>
                <div className="flex items-center gap-2 text-[9px] font-light text-[#789689]">
                  <ShieldCheck className="h-3 w-3 shrink-0 text-[#6f8e80]" />
                  {party.detail}
                </div>
              </div>
              <a
                href={`tel:${party.phone.replace(/\s/g, "")}`}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.07] py-2 text-[9px] text-[#a1bbae] transition hover:border-mint-300/20 hover:text-mint-300"
              >
                <Phone className="h-3 w-3" />
                تماس با طرف‌حساب
              </a>
            </article>
          );
        })}
      </div>

      {visibleParties.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#355344] bg-white/[0.015] px-5 py-14 text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.035] text-[#6f8e80]">
            <UserRound className="h-6 w-6" />
          </span>
          <p className="text-xs font-medium text-[#c2d6cb]">طرف‌حسابی با این مشخصات پیدا نشد.</p>
          <p className="mt-1 text-[9px] text-[#78968a]">جست‌وجو را پاک کنید یا یک طرف‌حساب جدید بسازید.</p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilter("all");
              setAddOpen(true);
            }}
            className="mt-4 rounded-xl bg-mint-400 px-4 py-2 text-[10px] font-semibold text-[#07110d]"
          >
            افزودن طرف‌حساب
          </button>
        </div>
      )}

      <div className="mt-5 flex items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-[9px] font-light leading-5 text-[#738f82]">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-300" />
        هر طرف‌حساب فقط در قراردادهای سازگار با نقش خود ظاهر می‌شود؛ به همین دلیل هنگام تغییر نقش، فهرست طرف قرارداد
        نیز به‌صورت خودکار تغییر می‌کند.
      </div>

      <AddPartyModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        role="landlord"
        allowRoleSwitch
        onCreate={(party) => {
          onCreateParty(party);
          setAddOpen(false);
          setToast(`${party.name} به طرف‌حساب‌ها اضافه شد`);
          setFilter(party.role);
        }}
      />
      <Toast
        open={Boolean(toast)}
        message="طرف‌حساب جدید ثبت شد"
        detail={toast ?? undefined}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
