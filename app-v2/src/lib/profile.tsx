import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BadgeCheck, Building2, MapPin, Phone, ShieldCheck, UserRound } from "lucide-react";
import { formatJalali, toEnglishDigits, todayJalali } from "./format";
import { TextField } from "../components/FormControls";
import { Modal, Toast } from "../components/ui";

export interface UserProfile {
  fullName: string;
  businessName: string;
  farmName: string;
  role: string;
  phone: string;
  nationalId: string;
  economicCode: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
  email: string;
  landArea: string;
  mainCrop: string;
  notes: string;
  color: "mint" | "sand" | "blue" | "rose";
  createdAt: string;
}

export const EMPTY_PROFILE: UserProfile = {
  fullName: "",
  businessName: "",
  farmName: "",
  role: "کشاورز / مدیر مزرعه",
  phone: "",
  nationalId: "",
  economicCode: "",
  province: "",
  city: "",
  address: "",
  postalCode: "",
  email: "",
  landArea: "",
  mainCrop: "",
  notes: "",
  color: "sand",
  createdAt: "",
};

export const PROFILE_STORAGE_KEY = "kishavar.profile.v2";
export { PROFILE_ROLE_CHOICES, PROFILE_ROLE_OTHER, isCustomRole, isRoleSelected, normalizeStoredRole, validateCustomRole } from "./profile-role";
import { PROFILE_ROLE_CHOICES, PROFILE_ROLE_OTHER, isRoleSelected, normalizeStoredRole, validateCustomRole } from "./profile-role";

/** فهرست نقش‌ها؛ آخرین گزینه «سایر» است و کادر نوشتن را باز می‌کند. */
export const PROFILE_ROLES: string[] = [...PROFILE_ROLE_CHOICES];

export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Partial<UserProfile>) };
    // نقش قدیمی/خالی به مقدار معتبر نگاشت می‌شود تا در رابط «سایر» دیده نشود
    parsed.role = normalizeStoredRole(parsed.role) || EMPTY_PROFILE.role;
    if (!parsed.fullName?.trim() || !parsed.phone?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function normalizePhone(value: string): string {
  const digits = toEnglishDigits(value).replace(/\D/g, "");
  if (digits.startsWith("0098")) return `0${digits.slice(4)}`;
  if (digits.startsWith("98") && digits.length > 10) return `0${digits.slice(2)}`;
  if (digits.startsWith("9") && digits.length === 10) return `0${digits}`;
  return digits;
}

export function isValidIranMobile(value: string): boolean {
  return /^09\d{9}$/.test(normalizePhone(value));
}

export function normalizeNationalId(value: string): string {
  return toEnglishDigits(value).replace(/\D/g, "");
}

/** اعتبارسنجی شناسه ملی ۱۰ رقمی (الگوریتم کنترل رقمی) */
export function isValidNationalId(value: string): boolean {
  const digits = normalizeNationalId(value);
  if (digits.length !== 10 || /^(\d)\1{9}$/.test(digits)) return false;
  const check = Number(digits[9]);
  const sum = digits.slice(0, 9).split("").reduce((acc, digit, index) => acc + Number(digit) * (10 - index), 0);
  const rem = sum % 11;
  return rem < 2 ? check === rem : check === 11 - rem;
}

interface ProfileContextValue {
  profile: UserProfile;
  hasProfile: boolean;
  saveProfile: (profile: UserProfile) => void;
  clearProfile: () => void;
  openOnboarding: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<UserProfile | null>(() => loadProfile());
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    if (!stored) setOnboarding(true);
  }, [stored]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile: stored ?? EMPTY_PROFILE,
      hasProfile: Boolean(stored),
      saveProfile: (next) => {
        const clean = { ...next, fullName: next.fullName.trim(), phone: normalizePhone(next.phone), createdAt: next.createdAt || todayJalali().jy + "/" + String(todayJalali().jm).padStart(2, "0") + "/" + String(todayJalali().jd).padStart(2, "0") };
        setStored(clean);
        try {
          localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(clean));
        } catch {
          /* ignore */
        }
      },
      clearProfile: () => {
        setStored(null);
        try {
          localStorage.removeItem(PROFILE_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setOnboarding(true);
      },
      openOnboarding: () => setOnboarding(true),
    }),
    [stored]
  );

  return (
    <ProfileContext.Provider value={value}>
      {children}
      <OnboardingModal open={onboarding && !stored} onDone={(profile) => { value.saveProfile(profile); setOnboarding(false); }} />
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used inside ProfileProvider");
  return context;
}

function OnboardingModal({ open, onDone }: { open: boolean; onDone: (profile: UserProfile) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [role, setRole] = useState<string>(PROFILE_ROLES[0]);
  const [customRole, setCustomRole] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const customRoleBox = useRef<HTMLDivElement | null>(null);
  // با انتخاب «سایر»، کادر نوشتن در دید کاربر قرار می‌گیرد (در موبایل پایین صفحه بود)
  useEffect(() => {
    if (role !== PROFILE_ROLE_OTHER) return;
    customRoleBox.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // فوکوس روی کادر نوشتن تا کاربر فوراً بتواند نقش سفارشی را تایپ کند
    window.setTimeout(() => customRoleBox.current?.querySelector("input")?.focus(), 120);
  }, [role]);

  const finish = () => {
    if (fullName.trim().length < 3) return setError("نام و نام خانوادگی خود را کامل وارد کنید.");
    if (!isValidIranMobile(phone)) return setError("شماره موبایل معتبر ایران را وارد کنید؛ مثلاً ۰۹۱۲۱۲۳۴۵۶۷.");
    let finalRole = role;
    if (role === PROFILE_ROLE_OTHER) {
      const checked = validateCustomRole(customRole);
      if (!checked.ok) return setError(checked.error ?? "نقش خود را بنویسید.");
      finalRole = checked.value;
    }
    onDone({
      ...EMPTY_PROFILE,
      fullName,
      phone,
      businessName: businessName.trim() || fullName.trim(),
      farmName: farmName.trim(),
      province: province.trim(),
      city: city.trim(),
      role: finalRole,
    });
    setToast("پروفایل شما ساخته شد");
  };

  return (
    <>
      <Modal open={open} onClose={() => setToast("برای استفاده از برنامه، نام و شماره تماس لازم است.")} title="خوش آمدید — پروفایل شما" description="این اطلاعات فقط روی همین دستگاه ذخیره می‌شود و در اسناد و پیشنهادهای نام/تلفن استفاده می‌شود." size="md">
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            {[1, 2].map((index) => (
              <span key={index} className={`h-1.5 flex-1 rounded-full ${step >= index ? "bg-mint-400" : "bg-white/10"}`} />
            ))}
          </div>
          {step === 1 ? (
            <>
              <div className="rounded-xl border border-mint-300/15 bg-mint-300/[0.05] p-3 text-[9px] leading-5 text-[#a9c5b8]">
                <ShieldCheck className="ml-1 inline h-3 w-3 text-mint-300" />
                نام و شماره شما در پیشنهادهای فیلد نام/تلفن و در سربرگ اسناد استفاده می‌شود. هیچ داده‌ای به سرور ارسال نمی‌شود.
              </div>
              <TextField label="نام و نام خانوادگی" value={fullName} onChange={(value) => { setFullName(value); setError(""); }} placeholder="مثلاً علی رضایی" icon={<UserRound className="h-3.5 w-3.5 text-[#7fa294]" />} required />
              <TextField label="شماره موبایل" value={phone} onChange={(value) => { setPhone(value); setError(""); }} placeholder="۰۹۱۲۱۲۳۴۵۶۷" numeric icon={<Phone className="h-3.5 w-3.5 text-[#7fa294]" />} required hint="برای پیشنهاد در فیلدهای تلفن و پشتیبان‌گیری استفاده می‌شود." />
              <div>
                <div className="label">نقش شما</div>
                <div className="flex flex-wrap gap-1.5">
                  {PROFILE_ROLES.map((item) => (
                    <button key={item} type="button" onClick={() => { setRole(item); setError(""); }} className={`rounded-lg border px-2.5 py-1.5 text-[9px] ${isRoleSelected(item, role) ? "border-mint-300/35 bg-mint-300/[0.08] text-mint-300" : "border-white/[0.08] text-[#9db5a8]"}`}>{item}</button>
                  ))}
                </div>
                {role === PROFILE_ROLE_OTHER && (
                  <div className="mt-2" ref={customRoleBox}>
                    <TextField label="نقش خود را بنویسید" value={customRole} onChange={(value) => { setCustomRole(value); setError(""); }} placeholder="مثلاً دامدار، کارشناس بیمهٔ محصول، مسئول خرید شرکت" hint="این عنوان در پروفایل و سربرگ اسناد استفاده می‌شود." />
                  </div>
                )}
              </div>
              {error && <p className="rounded-lg border border-[#8f4c44]/30 bg-[#8f4c44]/10 px-3 py-2 text-[10px] text-[#f0a59a]">{error}</p>}
              <button type="button" onClick={() => { if (fullName.trim().length < 3) { setError("نام و نام خانوادگی خود را کامل وارد کنید."); return; } if (!isValidIranMobile(phone)) { setError("شماره موبایل معتبر ایران را وارد کنید."); return; } setError(""); setStep(2); }} className="w-full rounded-xl bg-mint-400 py-2.5 text-[11px] font-bold text-[#07110d]">ادامه</button>
            </>
          ) : (
            <>
              <div className="text-[10px] font-medium text-[#dcebe2]">جزئیات کسب‌وکار (اختیاری ولی مفید)</div>
              <TextField label="نام کسب‌وکار" value={businessName} onChange={setBusinessName} placeholder="مثلاً مزرعه سبز دشت" icon={<Building2 className="h-3.5 w-3.5 text-[#7fa294]" />} />
              <TextField label="نام مزرعه / محل فعالیت" value={farmName} onChange={setFarmName} placeholder="مثلاً قطعه شمالی" />
              <div className="grid grid-cols-2 gap-2">
                <TextField label="استان" value={province} onChange={setProvince} placeholder="اردبیل" icon={<MapPin className="h-3.5 w-3.5 text-[#7fa294]" />} />
                <TextField label="شهر / شهرستان" value={city} onChange={setCity} placeholder="پارس‌آباد" />
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[8px] leading-5 text-[#7f9b8e]">ویرایش همه این موارد در بخش «پروفایل» امکان‌پذیر است. هر وقت خواستید می‌توانید جزئیات بیشتری اضافه کنید.</div>
              <button type="button" onClick={finish} className="w-full rounded-xl bg-mint-400 py-2.5 text-[11px] font-bold text-[#07110d]">ساخت پروفایل و ورود</button>
              <button type="button" onClick={() => setStep(1)} className="w-full py-1 text-[9px] text-[#819d90]">مرحله قبل</button>
            </>
          )}
        </div>
      </Modal>
      <Toast open={Boolean(toast)} message={toast ?? ""} onClose={() => setToast(null)} />
    </>
  );
}

export function profileDisplayName(profile: UserProfile): string {
  return profile.businessName.trim() || profile.fullName.trim() || "کسب‌وکار من";
}

export function profileFarmLine(profile: UserProfile): string {
  const place = [profile.city, profile.province].filter(Boolean).join("، ");
  const farm = profile.farmName.trim();
  return [farm, place].filter(Boolean).join(" · ") || "موقعیت ثبت نشده";
}

export function profileDateLabel(profile: UserProfile): string {
  if (!profile.createdAt) return "—";
  const [year, month, day] = profile.createdAt.split("/").map(Number);
  return formatJalali({ jy: year, jm: month, jd: day }, "long");
}

export { BadgeCheck };
