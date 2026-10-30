import { useEffect, useState } from "react";
import { Check, Loader2, LocateFixed, MapPin, ShieldAlert, X } from "lucide-react";
import { Modal } from "./ui";
import {
  checkLocationPermission,
  getCurrentCoordinates,
  requestLocationPermission,
} from "../lib/device/permissions";
import { reversePlace, type ReversePlace } from "../lib/ai/place";

type Step = "ask" | "locating" | "permission" | "gps" | "failed";

/** وقتی پروفایل ناقص/مشکوک است، با اجازهٔ کاربر موقعیت را به استان/شهر تبدیل می‌کند. */
export function ProfileLocationDialog({
  open,
  personalIssue,
  onClose,
  onReject,
  onResolved,
}: {
  open: boolean;
  personalIssue?: boolean;
  onClose: () => void;
  onReject: () => void;
  onResolved: (place: ReversePlace) => void;
}) {
  const [step, setStep] = useState<Step>("ask");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      setStep("ask");
      setMessage("");
    }
  }, [open]);

  const locate = async () => {
    setStep("locating");
    setMessage("");
    const state = await checkLocationPermission();
    if (state === "denied") {
      setStep("permission");
      return;
    }
    if (state === "prompt" || state === "unavailable") {
      const requested = await requestLocationPermission();
      if (requested === "denied") {
        setStep("permission");
        setMessage("دسترسی موقعیت رد شد. برای ادامه باید از تنظیمات گوشی اجازه بدهی.");
        return;
      }
    }
    const position = await getCurrentCoordinates();
    if (!position.ok) {
      if (position.kind === "denied") {
        setStep("permission");
        setMessage("اجازهٔ موقعیت داده نشد. از تنظیمات برنامه، دسترسی موقعیت را روشن کن.");
      } else {
        setStep("gps");
        setMessage(position.kind === "timeout" ? "یافتن موقعیت طول کشید؛ مکان‌یاب را روشن و دوباره تلاش کن." : "مکان‌یاب یا دسترسی موقعیت آماده نیست؛ اگر مکان‌یاب روشن است، یک بار دیگر تلاش کن.");
      }
      return;
    }
    setStep("locating");
    const place = await reversePlace(position.coords.latitude, position.coords.longitude);
    if (!place.ok) {
      setStep("failed");
      setMessage(place.message);
      return;
    }
    onResolved(place);
  };

  return (
    <Modal open={open} onClose={onClose} title="بررسی اطلاعات شما" size="sm">
      <div className="p-5">
        {step === "ask" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 rounded-xl border border-sand-300/20 bg-sand-300/[0.05] p-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sand-300" />
              <p className="text-[10px] leading-5 text-[#e6dcc0]">
                اطلاعات شما یافت نشد یا کامل نیست. آیا اجازه می‌دهید کشاورزیار با توجه به موقعیت مکانی شما استان و شهر را بررسی و اطلاعات را وارد کند؟
              </p>
            </div>
            {personalIssue && <p className="rounded-lg bg-white/[0.03] px-2.5 py-2 text-[8px] leading-4 text-[#a9c1b5]">نام یا شمارهٔ پروفایل هم ناقص است؛ بعد از این مرحله می‌توانی از بخش پروفایل اصلاحش کنی.</p>}
            <p className="text-[8px] leading-4 text-[#78968a]">موقعیت فقط برای تشخیص استان/شهر استفاده می‌شود و روی دستگاه می‌ماند. اگر اجازه ندهی، می‌توانی اقلیم و منطقه را دستی انتخاب کنی.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void locate()} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-mint-300 px-3 py-2.5 text-[10px] font-semibold text-[#10201a]">
                <LocateFixed className="h-3.5 w-3.5" /> تایید و بررسی موقعیت
              </button>
              <button type="button" onClick={onReject} className="rounded-xl border border-white/10 px-3 py-2.5 text-[10px] text-[#a9c1b5]">رد کردن</button>
            </div>
          </div>
        )}

        {step === "locating" && (
          <div className="py-5 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-mint-300" />
            <h3 className="mt-3 text-[11px] font-semibold text-white">کشاورزیار موقعیت شما را بررسی می‌کند</h3>
            <p className="mt-1 text-[9px] leading-5 text-[#93ad9f]">اگر مکان‌یاب روشن باشد، استان و شهر به پروفایل اضافه می‌شود.</p>
          </div>
        )}

        {step === "permission" && (
          <div className="space-y-3 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-sand-300/10 text-sand-300"><MapPin className="h-5 w-5" /></span>
            <h3 className="text-[11px] font-semibold text-white">اجازهٔ دسترسی به موقعیت لازم است</h3>
            <p className="text-[9px] leading-5 text-[#93ad9f]">{message || "برای تشخیص استان و شهر، اجازهٔ موقعیت را بده. این دسترسی اختیاری است."}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void locate()} className="flex-1 rounded-xl bg-mint-300 px-3 py-2.5 text-[10px] font-semibold text-[#10201a]">اجازه می‌دهم</button>
              <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-3 py-2.5 text-[10px] text-[#a9c1b5]">بستن</button>
            </div>
          </div>
        )}

        {step === "gps" && (
          <div className="space-y-3 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#f0a59a]/10 text-[#f0a59a]"><MapPin className="h-5 w-5" /></span>
            <h3 className="text-[11px] font-semibold text-white">مکان‌یاب آماده نشد</h3>
            <p className="text-[9px] leading-5 text-[#93ad9f]">{message} مکان‌یاب گوشی را روشن کن و دوباره تلاش کن.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void locate()} className="flex-1 rounded-xl bg-mint-300 px-3 py-2.5 text-[10px] font-semibold text-[#10201a]">روشن کردم، دوباره تلاش کن</button>
              <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-3 py-2.5 text-[10px] text-[#a9c1b5]">بعداً</button>
            </div>
            <p className="text-[8px] leading-4 text-[#78968a]">اگر چند بار آماده نشد، استان/شهر را در پروفایل دستی وارد کن؛ تحلیل با همان اطلاعات ادامه پیدا می‌کند.</p>
          </div>
        )}

        {step === "failed" && (
          <div className="space-y-3 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#f0a59a]/10 text-[#f0a59a]"><X className="h-5 w-5" /></span>
            <h3 className="text-[11px] font-semibold text-white">موقعیت به شهر تبدیل نشد</h3>
            <p className="text-[9px] leading-5 text-[#93ad9f]">{message || "سرویس موقعیت پاسخ نداد. می‌توانی استان/شهر را در پروفایل دستی وارد کنی."}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void locate()} className="flex-1 rounded-xl border border-mint-300/25 px-3 py-2.5 text-[10px] text-mint-300">تلاش دوباره</button>
              <button type="button" onClick={onClose} className="rounded-xl bg-mint-300 px-3 py-2.5 text-[10px] font-semibold text-[#10201a]">باشه</button>
            </div>
          </div>
        )}

        {step === "ask" && (
          <button type="button" onClick={onClose} className="mt-2 flex w-full items-center justify-center gap-1 py-1 text-[8px] text-[#78968a]"><Check className="h-3 w-3" /> بعداً از پروفایل تکمیل می‌کنم</button>
        )}
      </div>
    </Modal>
  );
}
