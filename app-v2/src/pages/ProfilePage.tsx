import { useState } from "react";
import {
  BadgeCheck,
  Building2,
  Check,
  ClipboardCopy,
  Fingerprint,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  Wheat,
} from "lucide-react";
import { cn } from "../utils/cn";
import { TextField } from "../components/FormControls";
import { Avatar, Toast } from "../components/ui";
import {
  PROFILE_ROLES,
  PROFILE_ROLE_OTHER,
  isRoleSelected,
  validateCustomRole,
  isValidIranMobile,
  isValidNationalId,
  normalizePhone,
  profileDateLabel,
  profileDisplayName,
  profileFarmLine,
  useProfile,
  type UserProfile,
} from "../lib/profile";
import { toEnglishDigits, toPersianDigits } from "../lib/format";

const COLORS: UserProfile["color"][] = ["sand", "mint", "blue", "rose"];

export function ProfilePage({ onBack }: { onBack: () => void }) {
  const { profile, saveProfile, clearProfile } = useProfile();
  const [editing, setEditing] = useState(!profile.fullName);
  const [customRole, setCustomRole] = useState(isRoleSelected(PROFILE_ROLE_OTHER, profile.role) ? profile.role : "");
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const save = () => {
    if (draft.fullName.trim().length < 3) return setError("نام و نام خانوادگی را کامل وارد کنید.");
    if (!isValidIranMobile(draft.phone)) return setError("شماره موبایل معتبر ایران را وارد کنید (۰۹۱۲۱۲۳۴۵۶۷).");
    if (draft.nationalId && !isValidNationalId(draft.nationalId)) return setError("کد ملی معتبر نیست؛ ۱۰ رقم و با رقم کنترل درست وارد کنید.");
    if (draft.postalCode && !/^\d{10}$/.test(toEnglishDigits(draft.postalCode).replace(/\D/g, ""))) return setError("کد پستی باید ۱۰ رقم باشد.");
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) return setError("ایمیل معتبر نیست.");
    // نقش سفارشی («سایر») فقط با متن معتبر ذخیره می‌شود
    if (draft.role === PROFILE_ROLE_OTHER) {
      const checked = validateCustomRole(customRole);
      if (!checked.ok) return setError(checked.error ?? "نقش خود را بنویسید.");
      setCustomRole(checked.value);
      setDraft((current) => ({ ...current, role: checked.value }));
      saveProfile({ ...draft, role: checked.value, phone: normalizePhone(draft.phone), postalCode: toEnglishDigits(draft.postalCode), nationalId: toEnglishDigits(draft.nationalId) });
      setEditing(false);
      setToast("پروفایل با موفقیت ذخیره شد");
      return;
    }
    setError("");
    saveProfile({ ...draft, phone: normalizePhone(draft.phone), postalCode: toEnglishDigits(draft.postalCode), nationalId: toEnglishDigits(draft.nationalId) });
    setEditing(false);
    setToast("پروفایل با موفقیت ذخیره شد");
  };

  const copySummary = () => {
    const summary = [
      `نام: ${draft.fullName}`,
      `کسب‌وکار: ${profileDisplayName(draft)}`,
      `نقش: ${draft.role}`,
      `تلفن: ${draft.phone}`,
      `شناسه ملی: ${draft.nationalId || "—"}`,
      `استان/شهر: ${[draft.province, draft.city].filter(Boolean).join("، ") || "—"}`,
      `نشانی: ${draft.address || "—"}`,
      `کد پستی: ${draft.postalCode || "—"}`,
      `ایمیل: ${draft.email || "—"}`,
    ].join("\n");
    void navigator.clipboard?.writeText(summary);
    setToast("خلاصه پروفایل کپی شد");
  };

  const fields: { key: keyof UserProfile; label: string; placeholder?: string; numeric?: boolean; icon?: React.ReactNode }[] = [
    { key: "fullName", label: "نام و نام خانوادگی", placeholder: "مثلاً علی رضایی", icon: <UserRound className="h-3.5 w-3.5 text-[#7fa294]" /> },
    { key: "businessName", label: "نام کسب‌وکار", placeholder: "مثلاً مزرعه سبز دشت", icon: <Building2 className="h-3.5 w-3.5 text-[#7fa294]" /> },
    { key: "farmName", label: "نام مزرعه / محل فعالیت", placeholder: "مثلاً قطعه شمالی", icon: <Wheat className="h-3.5 w-3.5 text-[#7fa294]" /> },
    { key: "phone", label: "شماره موبایل", placeholder: "۰۹۱۲۱۲۳۴۵۶۷", numeric: true, icon: <Phone className="h-3.5 w-3.5 text-[#7fa294]" /> },
    { key: "nationalId", label: "کد ملی", placeholder: "۱۰ رقم", numeric: true, icon: <Fingerprint className="h-3.5 w-3.5 text-[#7fa294]" /> },
    { key: "economicCode", label: "کد اقتصادی", placeholder: "اختیاری", numeric: true },
    { key: "province", label: "استان", placeholder: "اردبیل", icon: <MapPin className="h-3.5 w-3.5 text-[#7fa294]" /> },
    { key: "city", label: "شهر / شهرستان", placeholder: "پارس‌آباد" },
    { key: "address", label: "نشانی کامل", placeholder: "روستا، جاده، پلاک…" },
    { key: "postalCode", label: "کد پستی", placeholder: "۱۰ رقم", numeric: true },
    { key: "email", label: "ایمیل", placeholder: "name@example.com" },
    { key: "landArea", label: "مساحت تحت کشت (هکتار)", placeholder: "مثلاً ۱۲٫۵", numeric: true },
    { key: "mainCrop", label: "محصول اصلی", placeholder: "مثلاً گندم" },
  ];

  return (
    <div className="animate-rise mx-auto max-w-5xl">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]"><UserRound className="h-3.5 w-3.5 text-mint-300" />پروفایل من</div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">پروفایل و مشخصات کسب‌وکار</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] font-light leading-6 text-[#89a598]">نام و شماره شما در سربرگ اسناد و به‌صورت «پیشنهاد» در فیلدهای نام و تلفن استفاده می‌شود؛ هیچ‌جا خودکار نوشته نمی‌شود.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={copySummary} className="flex items-center gap-1.5 rounded-xl border border-white/[0.09] px-3 py-2.5 text-[9px] text-[#b9cec3]"><ClipboardCopy className="h-3.5 w-3.5" /> کپی خلاصه</button>
          {!editing && <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-xl bg-mint-400 px-3 py-2.5 text-[9px] font-bold text-[#07110d]"><Pencil className="h-3.5 w-3.5" /> ویرایش پروفایل</button>}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-[22px] border border-[#527a52]/25 bg-gradient-to-br from-[#183b29] to-[#0e2419] p-5">
        <Avatar name={draft.fullName || "کاربر"} color={draft.color} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-extrabold text-white">{draft.fullName || "نام ثبت نشده"}</h2>
            <span className="flex items-center gap-1 rounded-full border border-mint-300/20 bg-mint-300/[0.08] px-2 py-0.5 text-[8px] text-mint-300"><BadgeCheck className="h-2.5 w-2.5" /> {draft.role}</span>
          </div>
          <p className="mt-1 text-[10px] text-[#a9c2b3]">{profileDisplayName(draft)} · {profileFarmLine(draft)}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-[#8fae9c]">
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {draft.phone || "—"}</span>
            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {draft.businessName || "—"}</span>
            <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {draft.email || "—"}</span>
            <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> عضویت: {profileDateLabel(draft)}</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          {COLORS.map((color) => (
            <button key={color} type="button" onClick={() => setDraft((current) => ({ ...current, color }))} className={cn("h-6 w-6 rounded-full border-2", draft.color === color ? "border-white" : "border-transparent", color === "sand" ? "bg-[#8d7547]" : color === "mint" ? "bg-[#3a8e6e]" : color === "blue" ? "bg-[#3a6575]" : "bg-[#7c5053]")} aria-label={`رنگ ${color}`} />
          ))}
        </div>
      </div>

      {editing ? (
        <div className="glass rounded-[22px]">
          <div className="border-b border-white/[0.06] px-4 py-3.5 sm:px-5">
            <h3 className="text-[12px] font-semibold text-white">ویرایش مشخصات</h3>
            <p className="mt-0.5 text-[8px] text-[#78968a]">همه موارد اختیاری‌اند به‌جز نام و شماره موبایل.</p>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {fields.map((field) => (
              <TextField key={field.key} label={field.label} value={String(draft[field.key] ?? "")} onChange={(value) => update(field.key, value as never)} placeholder={field.placeholder} numeric={field.numeric} icon={field.icon} />
            ))}
            <div className="sm:col-span-2">
              <div className="label">نقش</div>
              <div className="flex flex-wrap gap-1.5">
                {PROFILE_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => { update("role", role); setError(""); if (role === PROFILE_ROLE_OTHER) setCustomRole(isRoleSelected(PROFILE_ROLE_OTHER, profile.role) ? profile.role : customRole); }}
                    className={cn("rounded-lg border px-2.5 py-1.5 text-[9px]", isRoleSelected(role, draft.role) ? "border-mint-300/35 bg-mint-300/[0.08] text-mint-300" : "border-white/[0.08] text-[#9db5a8]")}
                  >{role}</button>
                ))}
              </div>
              {draft.role === PROFILE_ROLE_OTHER && (
                <div className="mt-2">
                  <TextField label="نقش خود را بنویسید" value={customRole} onChange={(value) => { setCustomRole(value); setError(""); }} placeholder="مثلاً دامدار، کارشناس بیمهٔ محصول، مسئول خرید شرکت" hint="این عنوان جای «سایر» در پروفایل و اسناد می‌نشیند." />
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <TextField label="یادداشت" value={draft.notes} onChange={(value) => update("notes", value)} placeholder="هر توضیح مفید درباره کسب‌وکار" textarea rows={2} />
            </div>
            {error && <p className="rounded-lg border border-[#8f4c44]/30 bg-[#8f4c44]/10 px-3 py-2 text-[10px] text-[#f0a59a] sm:col-span-2">{error}</p>}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="button" onClick={save} className="flex items-center gap-1.5 rounded-xl bg-mint-400 px-4 py-2.5 text-[10px] font-bold text-[#07110d]"><Save className="h-3.5 w-3.5" /> ذخیره پروفایل</button>
              <button type="button" onClick={() => { setDraft(profile); setCustomRole(isRoleSelected(PROFILE_ROLE_OTHER, profile.role) ? profile.role : ""); setEditing(false); setError(""); }} className="rounded-xl border border-white/[0.09] px-4 py-2.5 text-[10px] text-[#a9c1b5]">انصراف</button>
              <button type="button" onClick={onBack} className="rounded-xl px-3 py-2.5 text-[9px] text-[#7e9b8e]">بازگشت به برنامه</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["نام و نام خانوادگی", profile.fullName],
            ["نام کسب‌وکار", profile.businessName || "—"],
            ["مزرعه / محل فعالیت", profile.farmName || "—"],
            ["نقش", profile.role],
            ["شماره موبایل", profile.phone],
            ["کد ملی", profile.nationalId || "—"],
            ["کد اقتصادی", profile.economicCode || "—"],
            ["استان / شهر", [profile.province, profile.city].filter(Boolean).join("، ") || "—"],
            ["نشانی", profile.address || "—"],
            ["کد پستی", profile.postalCode || "—"],
            ["ایمیل", profile.email || "—"],
            ["مساحت / محصول", [profile.landArea && `${toPersianDigits(profile.landArea)} هکتار`, profile.mainCrop].filter(Boolean).join(" · ") || "—"],
          ].map(([label, value]) => (
            <div key={label} className="glass rounded-xl px-3.5 py-3">
              <div className="text-[8px] text-[#78968a]">{label}</div>
              <div className="mt-1 break-words text-[10px] font-medium text-[#dcebe2]">{value}</div>
            </div>
          ))}
          {profile.notes && <div className="glass rounded-xl px-3.5 py-3 md:col-span-2"><div className="text-[8px] text-[#78968a]">یادداشت</div><div className="mt-1 text-[10px] leading-5 text-[#b6cec1]">{profile.notes}</div></div>}
          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-2.5">
            <span className="flex items-center gap-1.5 text-[8px] text-[#78968a]"><Check className="h-3 w-3 text-mint-300" /> این اطلاعات فقط روی دستگاه شما ذخیره می‌شود.</span>
            <button type="button" onClick={() => { if (window.confirm("پروفایل و داده‌ها حذف شوند و ثبت‌نام دوباره شروع شود؟")) { clearProfile(); setDraft({ ...profile, fullName: "", phone: "" }); } }} className="flex items-center gap-1 text-[8px] text-[#efad9f]"><Trash2 className="h-3 w-3" /> حذف پروفایل</button>
          </div>
        </div>
      )}

      <Toast open={Boolean(toast)} message={toast ?? ""} onClose={() => setToast(null)} />
    </div>
  );
}
