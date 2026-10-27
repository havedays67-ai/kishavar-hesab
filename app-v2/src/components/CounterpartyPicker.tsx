import { useEffect, useState } from "react";
import { Check, MapPin, Phone, Plus, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "../utils/cn";
import { initialParties, type Party, type Role } from "../lib/data";
import { Avatar, Modal } from "./ui";
import { TextField } from "./FormControls";

function compatibleRole(role: Role): Role {
  return role === "tenant" ? "landlord" : "tenant";
}

export function CounterpartyPicker({
  role,
  parties,
  selectedId,
  onSelect,
  onCreateParty,
}: {
  role: Role;
  parties: Party[];
  selectedId: string;
  onSelect: (partyId: string) => void;
  onCreateParty: (party: Omit<Party, "id">) => Party;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const targetRole = compatibleRole(role);
  const eligible = parties.filter((party) => party.role === targetRole);
  const roleTitle = targetRole === "landlord" ? "مالک زمین (موجر)" : "مستاجر (بهره‌بردار)";

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="label mb-0">
          <UserRound className="h-3.5 w-3.5 text-[#7fa294]" />
          طرف قرارداد — {roleTitle}
          <span className="text-[#c9967e]">*</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md border border-mint-300/15 bg-mint-300/[0.07] px-2 py-1 text-[9px] text-mint-300">
          <ShieldCheck className="h-3 w-3" />
          {eligible.length} گزینه واجد شرایط
        </span>
      </div>

      <p className="mb-3 text-[10px] font-light leading-5 text-[#7e9b8e]">
        چون {role === "tenant" ? "مستاجر هستید" : "موجر هستید"}، فقط {roleTitle} نمایش داده می‌شود. برای دیدن گزینه‌های
        طرف مقابل، نقش خود را در بخش بالا تغییر دهید.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {eligible.map((party) => {
          const selected = party.id === selectedId;
          return (
            <button
              key={party.id}
              type="button"
              onClick={() => onSelect(party.id)}
              aria-pressed={selected}
              className={cn(
                "group relative flex items-start gap-3 rounded-2xl border p-3 text-right transition-all",
                selected
                  ? "border-mint-300/45 bg-mint-300/[0.075] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  : "border-[#253f34] bg-[#081711]/45 hover:border-[#3d6350] hover:bg-white/[0.035]"
              )}
            >
              <Avatar name={party.name} color={party.color} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[12px] font-medium text-[#edf7f1]">{party.name}</span>
                  {party.id === "party-landlord-1" && (
                    <span className="rounded bg-sand-300/10 px-1 py-0.5 text-[8px] font-light text-sand-300">پیشنهادی</span>
                  )}
                </span>
                <span className="mt-1 flex items-center gap-1 text-[9px] text-[#809e90]">
                  <Phone className="h-2.5 w-2.5" />
                  {party.phone}
                  <span className="text-[#395346]">·</span>
                  <MapPin className="h-2.5 w-2.5" />
                  {party.city}
                </span>
                <span className="mt-1 block truncate text-[9px] font-light text-[#6d8b7d]">{party.detail}</span>
              </span>
              <span
                className={cn(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition",
                  selected
                    ? "border-mint-400 bg-mint-400 text-[#07110d]"
                    : "border-[#486456] bg-[#0a1a13] text-transparent group-hover:border-[#6c9280]"
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            </button>
          );
        })}

        {eligible.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-[#365445] bg-white/[0.02] p-5 text-center">
            <UserRound className="mx-auto mb-2 h-6 w-6 text-[#6f8e80]" />
            <p className="text-xs text-[#c4d7cc]">هنوز {roleTitle} ثبت نشده است.</p>
            <p className="mt-1 text-[10px] text-[#769285]">با دکمه زیر اولین طرف قرارداد را بسازید.</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className={cn(
            "flex min-h-[88px] items-center justify-center gap-2 rounded-2xl border border-dashed border-[#3b5b4b] bg-[#081711]/20 p-3 text-[11px] text-[#8eac9d] transition hover:border-mint-300/40 hover:bg-mint-300/[0.035] hover:text-mint-300",
            eligible.length === 0 && "sm:col-span-2"
          )}
        >
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-current/20">
            <Plus className="h-3.5 w-3.5" />
          </span>
          افزودن {roleTitle} جدید
        </button>
      </div>

      <AddPartyModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        role={targetRole}
        onCreate={(party) => {
          const created = onCreateParty(party);
          onSelect(created.id);
          setAddOpen(false);
        }}
      />
    </div>
  );
}

export function AddPartyModal({
  open,
  onClose,
  role,
  onCreate,
  allowRoleSwitch = false,
}: {
  open: boolean;
  onClose: () => void;
  role: Role;
  onCreate: (party: Omit<Party, "id">) => void;
  allowRoleSwitch?: boolean;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [detail, setDetail] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>(role);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setCity("");
      setDetail("");
      setSelectedRole(role);
      setError("");
    }
  }, [open, role]);

  const roleTitle = selectedRole === "landlord" ? "مالک زمین (موجر)" : "مستاجر (بهره‌بردار)";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`افزودن ${roleTitle}`}
      description="این طرف قرارداد بلافاصله در فهرست قابل انتخاب قرار می‌گیرد."
      size="sm"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim().length < 3) {
            setError("نام و نام خانوادگی را کامل وارد کنید.");
            return;
          }
          if (phone.replace(/\D/g, "").length < 8) {
            setError("شماره تماس معتبر وارد کنید.");
            return;
          }
          const colors: Party["color"][] = ["mint", "sand", "blue", "rose"];
          onCreate({
            name: name.trim(),
            phone,
            city: city.trim() || "نامشخص",
            detail: detail.trim() || (selectedRole === "landlord" ? "مالک زمین" : "بهره‌بردار زمین"),
            role: selectedRole,
            color: colors[Math.floor(Math.random() * colors.length)],
          });
        }}
      >
        <div className="space-y-4 p-5 sm:p-6">
          {allowRoleSwitch ? (
            <div>
              <div className="label">نقش این شخص</div>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.07] bg-[#071510]/60 p-1">
                {([
                  ["landlord", "مالک زمین (موجر)"],
                  ["tenant", "مستاجر (بهره‌بردار)"],
                ] as [Role, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedRole(value)}
                    className={cn(
                      "rounded-lg px-2 py-2.5 text-[10px] transition",
                      selectedRole === value
                        ? "bg-[#21483a] font-medium text-mint-300"
                        : "text-[#7f9b8e] hover:bg-white/[0.04] hover:text-[#d3e3da]"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-sand-300/15 bg-sand-300/[0.05] px-3 py-2.5 text-[10px] text-sand-300/90">
              نقش این شخص در قرارداد: {roleTitle}
            </div>
          )}
          <TextField
            label="نام و نام خانوادگی"
            value={name}
            onChange={setName}
            placeholder="مثلاً علی احمدی"
            required
          />
          <TextField
            label="شماره تماس"
            value={phone}
            onChange={setPhone}
            numeric
            placeholder="۰۹۱۲۱۲۳۴۵۶۷"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="شهر / روستا" value={city} onChange={setCity} placeholder="پارس‌آباد" />
            <TextField label="توضیح کوتاه" value={detail} onChange={setDetail} placeholder="مالک ۶ هکتار" />
          </div>
          {error && <p className="rounded-xl border border-[#8f4c44]/30 bg-[#8f4c44]/10 px-3 py-2 text-[11px] text-[#f0a59a]">{error}</p>}
          <div className="flex gap-2.5 pt-1">
            <button
              type="submit"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-mint-400 px-4 py-3 text-xs font-semibold text-[#07110d] transition hover:bg-mint-300"
            >
              <Plus className="h-4 w-4" />
              ثبت و انتخاب
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/[0.09] px-4 py-3 text-xs text-[#a3bbaf] transition hover:bg-white/[0.05] hover:text-white"
            >
              انصراف
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// A sensible starting contact if the user clears every landlord.
export const fallbackParty = initialParties[0];
