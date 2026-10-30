import { useEffect, useState } from "react";
import { BellRing, Check, LocateFixed, Loader2, ShieldCheck } from "lucide-react";
import { Modal } from "./ui";
import { useProfile } from "../lib/profile";
import { reversePlace } from "../lib/ai/place";
import {
  checkLocationPermission,
  checkNotificationPermission,
  getCurrentCoordinates,
  requestLocationPermission,
  requestNotificationPermission,
  type PermissionState,
} from "../lib/device/permissions";

const PREFS_KEY = "kishavar.permissions.prefs.v2";

type Prefs = {
  asked: boolean;
  notifications: boolean;
  location: boolean;
  notifyState: PermissionState;
  locationState: PermissionState;
};

const DEFAULTS: Prefs = { asked: false, notifications: false, location: false, notifyState: "prompt", locationState: "prompt" };

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return { ...DEFAULTS, ...parsed, asked: Boolean(parsed.asked) };
  } catch {
    return DEFAULTS;
  }
}

function writePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* حافظهٔ دستگاه در دسترس نیست؛ وضعیت همین نشست معتبر است. */
  }
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition ${checked ? "border-mint-300/60 bg-mint-300/80" : "border-white/15 bg-white/[0.06]"}`}
    >
      <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-all ${checked ? "right-0.5" : "right-[22px]"}`} style={{ height: 18, width: 18 }} />
    </button>
  );
}

/** اولین ورود و پنل تنظیمات: انتخاب مستقل اعلان و موقعیت، با ثبت واقعی وضعیت. */
export function FirstRunPermissions() {
  const { hasProfile, profile, saveProfile } = useProfile();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notifyOn, setNotifyOn] = useState(false);
  const [locationOn, setLocationOn] = useState(false);
  const [notify, setNotify] = useState<PermissionState>("prompt");
  const [location, setLocation] = useState<PermissionState>("prompt");
  const [message, setMessage] = useState("");

  const openPanel = async () => {
    const prefs = readPrefs();
    const [n, l] = await Promise.all([checkNotificationPermission(), checkLocationPermission()]);
    setNotify(n);
    setLocation(l);
    setNotifyOn(prefs.asked ? prefs.notifications : n === "granted" || n === "prompt");
    setLocationOn(prefs.asked ? prefs.location : l === "granted" || l === "prompt");
    setMessage("");
    setOpen(true);
  };

  useEffect(() => {
    if (!hasProfile) return;
    const prefs = readPrefs();
    if (!prefs.asked) void openPanel();
    const openFromSettings = () => { void openPanel(); };
    window.addEventListener("kishavar:open-permissions", openFromSettings);
    return () => window.removeEventListener("kishavar:open-permissions", openFromSettings);
    // openPanel پایدار نیست ولی عمداً فقط با تغییر پروفایل دوباره ساخته می‌شود.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProfile]);

  const apply = async () => {
    setBusy(true);
    setMessage("");
    try {
      let nextNotify: PermissionState = await checkNotificationPermission();
      if (notifyOn && nextNotify !== "granted") {
        setMessage("در حال گرفتن اجازهٔ اعلان…");
        nextNotify = await requestNotificationPermission();
      }
      let nextLocation: PermissionState = await checkLocationPermission();
      if (locationOn && nextLocation !== "granted") {
        setMessage("در حال گرفتن اجازهٔ موقعیت…");
        nextLocation = await requestLocationPermission();
      }

      const problems: string[] = [];
      if (notifyOn && nextNotify !== "granted") {
        problems.push(nextNotify === "unavailable" ? "اعلان روی این دستگاه در دسترس نیست؛ اگر بعداً فعال شد از همین پنل دوباره امتحان کن." : "اجازهٔ اعلان داده نشد. اگر اشتباهی رد شد، از تنظیمات گوشی یا همین پنل دوباره تلاش کن.");
      }

      if (locationOn && nextLocation === "granted") {
        setMessage("اجازهٔ موقعیت گرفته شد؛ در حال خواندن موقعیت…");
        const coords = await getCurrentCoordinates();
        if (!coords.ok) {
          problems.push(coords.kind === "disabled" ? "اجازهٔ موقعیت ثبت شد، اما مکان‌یاب گوشی خاموش است یا سیگنال ندارد. مکان‌یاب را روشن کن و دوباره تایید بزن." : "اجازهٔ موقعیت ثبت شد، اما خواندن مختصات الان ممکن نشد. دوباره تلاش کن.");
        } else {
          try {
            localStorage.setItem("kishavar.device.location.v1", JSON.stringify({ ...coords.coords, at: Date.now() }));
          } catch {
            /* ذخیرهٔ مختصات اختیاری است؛ اجازهٔ خودش ثبت شده. */
          }
          // تبدیل مختصات به استان/شهر در پس‌زمینه انجام می‌شود تا دکمهٔ تایید بی‌دلیل منتظر نماند.
          void reversePlace(coords.coords.latitude, coords.coords.longitude).then((place) => {
            if (!place.ok) return;
            const current = readPrefs();
            if (current.asked) {
              const p = profile;
              if (!p.province || !p.city) saveProfile({ ...p, province: p.province || place.province, city: p.city || place.city });
            }
          });
        }
      } else if (locationOn) {
        problems.push(nextLocation === "unavailable" ? "اجازهٔ موقعیت گرفته نشد؛ ممکن است مکان‌یاب گوشی خاموش باشد. آن را روشن کن و دوباره تایید بزن." : "اجازهٔ موقعیت داده نشد. اگر اشتباهی رد شد، از تنظیمات گوشی یا همین پنل دوباره تلاش کن.");
      }

      setNotify(nextNotify);
      setLocation(nextLocation);
      setNotifyOn(notifyOn);
      setLocationOn(locationOn);
      writePrefs({
        asked: true,
        notifications: notifyOn && nextNotify === "granted",
        location: locationOn && nextLocation === "granted",
        notifyState: nextNotify,
        locationState: nextLocation,
      });
      window.dispatchEvent(new Event("kishavar:permissions-updated"));
      window.dispatchEvent(new Event("kishavar:location-updated"));
      if (problems.length) {
        setMessage(problems.join(" "));
      } else {
        setMessage("دسترسی‌های انتخاب‌شده واقعاً فعال و ذخیره شد.");
        setOpen(false);
      }
    } catch {
      setMessage("گرفتن اجازه با خطا مواجه شد؛ دوباره تلاش کن.");
    } finally {
      setBusy(false);
    }
  };

  const decline = () => {
    const prefs = readPrefs();
    writePrefs({ ...prefs, asked: true, notifications: false, location: false, notifyState: "denied", locationState: "denied" });
    setOpen(false);
    window.dispatchEvent(new Event("kishavar:permissions-updated"));
  };

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="دسترسی‌های اعلان و موقعیت" description="هر کدام را جدا روشن یا خاموش کن؛ با زدن «تایید و اعمال» اجازهٔ واقعی از دستگاه گرفته و همان وضعیت ذخیره می‌شود." size="sm">
      <div className="space-y-3 p-5">
        <div className="flex items-start gap-3 rounded-xl border border-mint-300/15 bg-mint-300/[0.04] p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-300/10 text-mint-300"><BellRing className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold text-[#e8f5ed]">اعلان موضوعات مهم</p>
              <Toggle checked={notifyOn} onChange={setNotifyOn} label="اعلان موضوعات مهم" />
            </div>
            <p className="mt-0.5 text-[8px] leading-4 text-[#93ad9f]">سررسید چک، طلب سرگذشته، کمبود انبار و هشدارهای مالی. وضعیت فعلی: {notify === "granted" ? "فعال" : notify === "denied" ? "رد شده" : notify === "unavailable" ? "در دسترس نیست" : "هنوز اجازه گرفته نشده"}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-sand-300/15 bg-sand-300/[0.04] p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sand-300/10 text-sand-300"><LocateFixed className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold text-[#f0ead7]">موقعیت مکانی</p>
              <Toggle checked={locationOn} onChange={setLocationOn} label="موقعیت مکانی" />
            </div>
            <p className="mt-0.5 text-[8px] leading-4 text-[#b9ad84]">برای تشخیص استان/شهر و تحلیل منطقه‌ای. اگر خاموش باشد، برنامه از استان و شهر پروفایل استفاده می‌کند. وضعیت فعلی: {location === "granted" ? "فعال" : location === "denied" ? "رد شده" : location === "unavailable" ? "در دسترس نیست" : "هنوز اجازه گرفته نشده"}</p>
          </div>
        </div>

        {message && <p className="rounded-lg border border-sand-300/25 bg-sand-300/[0.06] px-2.5 py-2 text-[8px] leading-4 text-[#e3d39a]">{message}</p>}

        <p className="flex items-start gap-1 text-[7px] leading-4 text-[#6f8c7f]"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" /> داده‌های پروفایل و موقعیت فقط روی همین دستگاه ذخیره می‌شود؛ فقط نام شهر برای پیش‌بینی هوا به سرور می‌رود.</p>

        <div className="flex gap-2">
          <button type="button" onClick={() => void apply()} disabled={busy} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-mint-300 px-3 py-2.5 text-[10px] font-semibold text-[#10201a] disabled:opacity-60">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{busy ? "در حال گرفتن اجازه…" : "تایید و اعمال"}
          </button>
          <button type="button" onClick={decline} disabled={busy} className="rounded-xl border border-white/10 px-3 py-2.5 text-[10px] text-[#a9c1b5]">فعلاً نه</button>
        </div>
        {notify === "granted" && location === "granted" && <p className="flex items-center justify-center gap-1 text-[8px] text-mint-300"><Check className="h-3 w-3" /> هر دو دسترسی واقعاً فعال و ذخیره شد.</p>}
      </div>
    </Modal>
  );
}
