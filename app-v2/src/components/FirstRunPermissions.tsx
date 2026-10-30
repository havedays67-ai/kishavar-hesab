import { useEffect, useState } from "react";
import { BellRing, Check, LocateFixed, ShieldCheck } from "lucide-react";
import { Modal } from "./ui";
import { useProfile } from "../lib/profile";
import {
  checkLocationPermission,
  checkNotificationPermission,
  requestLocationPermission,
  requestNotificationPermission,
  type PermissionState,
} from "../lib/device/permissions";

const ASKED_KEY = "kishavar.permissions.asked.v1";

/** اولین ورود: اجازهٔ اعلان و موقعیت را با توضیح شفاف می‌پرسد. */
export function FirstRunPermissions() {
  const { hasProfile } = useProfile();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notify, setNotify] = useState<PermissionState>("prompt");
  const [location, setLocation] = useState<PermissionState>("prompt");

  useEffect(() => {
    if (!hasProfile) return;
    let asked = false;
    try {
      asked = localStorage.getItem(ASKED_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (asked) return;
    void Promise.all([checkNotificationPermission(), checkLocationPermission()]).then(([n, l]) => {
      setNotify(n);
      setLocation(l);
      setOpen(true);
    });
  }, [hasProfile]);

  const finish = (granted: boolean) => {
    try {
      localStorage.setItem(ASKED_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
    window.dispatchEvent(new Event("kishavar:permissions-updated"));
    if (!granted) return;
  };

  const allow = async () => {
    setBusy(true);
    const n = await requestNotificationPermission();
    const l = await requestLocationPermission();
    setNotify(n);
    setLocation(l);
    setBusy(false);
    finish(n === "granted" || l === "granted");
  };

  return (
    <Modal open={open} onClose={() => finish(false)} title="دسترسی‌های لازم" description="کشاورزیار برای هشدارهای مهم و تشخیص منطقه به این اجازه‌ها نیاز دارد. موقعیت مکانی اختیاری است." size="sm">
      <div className="space-y-3 p-5">
        <div className="flex items-start gap-3 rounded-xl border border-mint-300/15 bg-mint-300/[0.04] p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-300/10 text-mint-300"><BellRing className="h-4 w-4" /></span>
          <div>
            <p className="text-[10px] font-semibold text-[#e8f5ed]">اعلان موضوعات مهم</p>
            <p className="mt-0.5 text-[8px] leading-4 text-[#93ad9f]">سررسید چک، طلب سرگذشته، کمبود انبار و هشدارهای مالی را اطلاع می‌دهد. وضعیت: {notify === "granted" ? "فعال" : notify === "denied" ? "رد شده" : "در انتظار اجازه"}</p>
          </div>
          {notify === "granted" && <Check className="mr-auto h-4 w-4 text-mint-300" />}
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-sand-300/15 bg-sand-300/[0.04] p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sand-300/10 text-sand-300"><LocateFixed className="h-4 w-4" /></span>
          <div>
            <p className="text-[10px] font-semibold text-[#f0ead7]">موقعیت مکانی (اختیاری)</p>
            <p className="mt-0.5 text-[8px] leading-4 text-[#b9ad84]">اگر پروفایل ناقص باشد، استان و شهر را از موقعیت تشخیص می‌دهد. اگر اجازه ندهی، از اطلاعات پروفایل استفاده می‌شود. وضعیت: {location === "granted" ? "فعال" : location === "denied" ? "رد شده" : "در انتظار اجازه"}</p>
          </div>
          {location === "granted" && <Check className="mr-auto h-4 w-4 text-mint-300" />}
        </div>

        <p className="flex items-start gap-1 text-[7px] leading-4 text-[#6f8c7f]"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" /> داده‌های پروفایل و موقعیت فقط روی همین دستگاه ذخیره می‌شود و برای ساخت تقویم به سرور ارسال نمی‌شود؛ فقط نام شهر برای پیش‌بینی هوا استفاده می‌شود.</p>

        <div className="flex gap-2">
          <button type="button" onClick={() => void allow()} disabled={busy} className="flex-1 rounded-xl bg-mint-300 px-3 py-2.5 text-[10px] font-semibold text-[#10201a] disabled:opacity-60">{busy ? "در حال گرفتن اجازه…" : "اجازه می‌دهم"}</button>
          <button type="button" onClick={() => finish(false)} className="rounded-xl border border-white/10 px-3 py-2.5 text-[10px] text-[#a9c1b5]">فعلاً نه</button>
        </div>
      </div>
    </Modal>
  );
}
