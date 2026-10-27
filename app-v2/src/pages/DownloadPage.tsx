import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  BadgeCheck,
  CalendarDays,
  Check,
  FileText,
  Fingerprint,
  HardDriveDownload,
  Leaf,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRound,
  UsersRound,
  WifiOff,
} from "lucide-react";
import { BrandMark } from "../components/ui";
import { MY_BUSINESS } from "../lib/data";
import { formatFileSize, formatIsoInJalali, todayJalali, formatJalali, toPersianDigits } from "../lib/format";

const APK_URL =
  "https://github.com/havedays67-ai/kishavar-hesab/releases/latest/download/KishavarHesab-1.0.0.apk";

type ReleaseInfo = {
  date: string;
  size: number;
  downloads: number;
  digest: string;
};

const FALLBACK_RELEASE: ReleaseInfo = {
  date: "2026-10-27T14:03:38Z",
  size: 4087973,
  downloads: 0,
  digest: "a3a222b6670a0b3202b2e42f0cee4a5deb4d50328a377569baec49163ea9512f",
};

export function DownloadPage() {
  const [release, setRelease] = useState<ReleaseInfo>(FALLBACK_RELEASE);

  useEffect(() => {
    let cancelled = false;
    fetch("https://api.github.com/repos/havedays67-ai/kishavar-hesab/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("release unavailable"))))
      .then((data: {
        updated_at?: string;
        published_at?: string;
        assets?: { name?: string; size?: number; download_count?: number; digest?: string }[];
      }) => {
        if (cancelled) return;
        const asset = data.assets?.find((item) => item.name?.endsWith(".apk"));
        setRelease({
          date: asset ? data.updated_at ?? data.published_at ?? FALLBACK_RELEASE.date : data.published_at ?? FALLBACK_RELEASE.date,
          size: asset?.size ?? FALLBACK_RELEASE.size,
          downloads: asset?.download_count ?? FALLBACK_RELEASE.downloads,
          digest: asset?.digest?.replace("sha256:", "") ?? FALLBACK_RELEASE.digest,
        });
      })
      .catch(() => {
        // The local fallback keeps the single download route available if GitHub API is unreachable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="animate-rise mx-auto max-w-5xl">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]">
            <Smartphone className="h-3.5 w-3.5 text-mint-300" />
            نسخه اندروید
            <span className="rounded-md border border-mint-300/15 bg-mint-300/[0.07] px-1.5 py-0.5 text-[8px] text-mint-300">
              یک دانلود، یک نسخه
            </span>
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">دریافت برنامه</h1>
          <p className="mt-1.5 text-[11px] font-light text-[#89a598]">
            نسخه ۱.۰.۰ برای اندروید ۸ و بالاتر؛ پیش‌نمایش وب شامل ماشین‌حساب فروش محصول و اسناد چاپی است.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[9px] text-[#9eb8ab] sm:self-auto">
          <CalendarDays className="h-3.5 w-3.5 text-mint-300" />
          {formatJalali(todayJalali(), "weekday")}
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[26px] border border-[#527a52]/25 bg-gradient-to-br from-[#183b29] via-[#102b1e] to-[#0b1e16] shadow-[0_30px_90px_rgba(0,0,0,0.24)]">
        <div className="grid-texture pointer-events-none absolute inset-0 opacity-25" />
        <div className="pointer-events-none absolute -right-10 -top-20 h-80 w-80 rounded-full bg-mint-300/[0.08] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-sand-300/[0.06] blur-3xl" />
        <div className="relative grid gap-7 p-5 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-10 lg:p-10">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <BrandMark size="lg" />
              <div>
                <p className="text-[10px] font-light text-[#a6c2b1]">کسب‌وکار من</p>
                <p className="mt-0.5 text-lg font-extrabold tracking-tight text-white">همراه مزرعه</p>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d7e9ba]/20 bg-[#d7e9ba]/[0.08] px-2.5 py-1 text-[9px] text-[#d8e9bd]">
                <BadgeCheck className="h-3 w-3" />
                نسخه ۱.۰.۰
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] text-[#adc4b7]">شماره نسخه ۱</span>
              <span className="flex items-center gap-1 rounded-full border border-mint-300/20 bg-mint-300/[0.07] px-2.5 py-1 text-[9px] text-mint-300">
                <Check className="h-3 w-3" />
                اصلاح‌شده و ساخته‌شده
              </span>
            </div>
            <h2 className="max-w-md text-[24px] font-extrabold leading-[1.55] text-[#f2f8ec] sm:text-[30px]">
              همه‌چیز برای یک فصل آرام،
              <span className="block text-[#d4e8b1]">در یک نسخه.</span>
            </h2>
            <p className="mt-3 max-w-md text-[10px] font-light leading-6 text-[#a8c0af] sm:text-[11px]">
              قرارداد زمین با انتخاب دوطرفه‌ی طرف قرارداد، تاریخ‌های شمسی و مبالغ خوانا؛ همراه با دفتر طرف‌حساب‌ها و
              گزارش اجاره. همه از یک مسیر، بدون لینک‌های پراکنده.
            </p>

            <div className="mt-6">
              <a
                href={APK_URL}
                className="group inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#d9edb4] px-6 py-3.5 text-[12px] font-extrabold text-[#17321e] shadow-[0_12px_32px_rgba(0,0,0,0.16)] transition hover:bg-[#e8f6ce] active:scale-[0.995] sm:w-auto"
              >
                <ArrowDownToLine className="h-[18px] w-[18px] transition group-hover:translate-y-0.5" />
                دانلود مستقیم APK · نسخه ۱.۰.۰
              </a>
              <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[8px] font-light text-[#82a08f]">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-[#bad99a]" />
                  تنها مقصد دانلود رسمی
                </span>
                <span className="text-[#476758]">·</span>
                <span>اندروید ۸ به بالا</span>
                <span className="text-[#476758]">·</span>
                <span>{formatFileSize(release.size)}</span>
              </p>
              <div className="mt-4 rounded-xl border border-mint-300/20 bg-mint-300/[0.06] p-3">
                <p className="flex items-start gap-2 text-[9px] font-light leading-5 text-[#c4e2cf]">
                  <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-300" />
                  <span>
                    <strong className="font-semibold text-[#e5f6ea]">درباره نسخه‌ها:</strong> بسته APK از آخرین کد اصلاح‌شده در
                    `main` ساخته شده و رفع باگ طرف قرارداد و تاریخ شمسی را دارد. ماشین‌حساب پیشرفته فروش محصول، مرکز
                    اسناد چاپی و گزارش‌های مدیریتی، بخش‌های نسخه وب این پیش‌نمایش‌اند. لینک بالا تنها مقصد دانلود رسمی
                    APK است.
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/[0.09] pt-4">
              <div>
                <p className="text-[8px] font-light text-[#84a191]">آخرین به‌روزرسانی</p>
                <p className="mt-1 text-[10px] font-medium text-[#e3eee5]">{formatIsoInJalali(release.date, "long")}</p>
              </div>
              <div className="border-r border-white/[0.08] pr-3">
                <p className="text-[8px] font-light text-[#84a191]">تاریخ شمسی</p>
                <p className="mt-1 text-[10px] font-medium text-[#e3eee5]">{formatIsoInJalali(release.date, "short")}</p>
              </div>
              <div className="border-r border-white/[0.08] pr-3">
                <p className="text-[8px] font-light text-[#84a191]">تعداد دریافت</p>
                <p className="mt-1 text-[10px] font-medium text-[#e3eee5]">{toPersianDigits(release.downloads)} بار</p>
              </div>
            </div>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <div className="absolute bottom-8 h-40 w-48 rounded-full bg-[#c6de9a]/10 blur-2xl" />
            <div className="relative w-[238px] rotate-[2deg] rounded-[36px] border-[7px] border-[#233c2f] bg-[#07110d] p-1.5 shadow-[0_35px_70px_rgba(0,0,0,0.45)] sm:w-[260px]">
              <div className="absolute right-1/2 top-2 z-20 h-1.5 w-16 translate-x-1/2 rounded-full bg-[#2c4437]" />
              <div className="relative min-h-[430px] overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#0a1712] pb-5 pt-5">
                <div className="pointer-events-none absolute -left-8 top-32 h-40 w-40 rounded-full bg-mint-300/[0.06] blur-2xl" />
                <div className="flex items-center justify-between px-4">
                  <div className="flex items-center gap-2">
                    <BrandMark size="sm" />
                    <div>
                      <p className="text-[9px] font-bold text-white">کسب‌وکار من</p>
                      <p className="mt-0.5 text-[6px] text-[#78968a]">دفتر کل آرام</p>
                    </div>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-mint-400" />
                </div>
                <div className="mx-3 mt-4 rounded-xl border border-[#2d513c] bg-gradient-to-br from-[#1a3b2a] to-[#10281d] p-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[5px] text-[#b9d1c2]">قرارداد جدید</span>
                    <FileText className="h-3 w-3 text-[#bdda9c]" />
                  </div>
                  <p className="mt-2 text-[8px] font-semibold text-[#edf6e5]">قرارداد زمین کشاورزی</p>
                  <p className="mt-0.5 text-[5px] font-light text-[#93b0a0]">طرف قرارداد را دقیق انتخاب کنید</p>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    <div className="rounded-md border border-[#badc98]/25 bg-[#b8d99a]/[0.08] px-1.5 py-1.5">
                      <Leaf className="h-2 w-2 text-[#c5e4a7]" />
                      <p className="mt-1 text-[5px] font-medium text-[#e1eeda]">مستاجر هستم</p>
                    </div>
                    <div className="rounded-md border border-white/[0.08] bg-white/[0.025] px-1.5 py-1.5">
                      <Leaf className="h-2 w-2 text-[#78968a]" />
                      <p className="mt-1 text-[5px] text-[#9fb9ab]">موجر هستم</p>
                    </div>
                  </div>
                </div>
                <div className="mx-3 mt-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[6px] text-[#a8c1b4]">طرف قرارداد · مالک زمین</span>
                    <span className="rounded-full bg-[#b3d693]/10 px-1 py-px text-[4px] text-[#b9d99f]">۲ گزینه</span>
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    {[
                      ["ح", "حاج رضا کاویانی"],
                      ["م", "محمدامین شفیعی"],
                    ].map(([initial, name]) => (
                      <div key={name} className="flex flex-1 items-center gap-1 rounded-lg border border-[#284535] bg-[#071510]/60 p-1.5">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#745f36] text-[5px] text-[#fff1cf]">{initial}</span>
                        <span className="min-w-0 truncate text-[5px] text-[#d7e5dc]">{name}</span>
                        <span className="mr-auto h-2 w-2 shrink-0 rounded-full border border-[#4a6b58]" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mx-3 mt-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5">
                  <div className="flex items-center justify-between text-[6px]">
                    <span className="text-[#78968a]">تاریخ شروع</span>
                    <span className="text-[#78968a]">تاریخ پایان</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[6px] text-[#dbe9df]">
                    <span>{toPersianDigits("1405/08/05")}</span>
                    <ArrowDownToLine className="h-2 w-2 rotate-90 text-[#557364]" />
                    <span>{toPersianDigits("1406/08/04")}</span>
                  </div>
                </div>
                <div className="mx-3 mt-2.5 flex items-center justify-between rounded-lg bg-[#b8d99a]/[0.09] px-2.5 py-2">
                  <span className="text-[6px] text-[#cbdcb9]">اجاره ماهانه</span>
                  <span className="text-[7px] font-bold text-[#d9e9c5]">۳۰,۰۰۰,۰۰۰</span>
                </div>
                <div className="mx-3 mt-2 rounded-xl bg-[#d9edb4] py-2 text-center text-[7px] font-bold text-[#19331f]">ثبت قرارداد</div>
                <div className="mx-3 mt-4 flex justify-around border-t border-white/[0.06] pt-2">
                  {[FileText, UsersRound, ArrowDownToLine].map((Icon, index) => (
                    <Icon key={index} className={index === 1 ? "h-3 w-3 text-[#c3d7cb]" : "h-3 w-3 text-[#617f6f]"} />
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -left-2 bottom-14 hidden items-center gap-1.5 rounded-xl border border-[#badc98]/20 bg-[#1d3b2b] px-2.5 py-2 text-[8px] text-[#d3e9bf] shadow-lg sm:flex">
              <Check className="h-3 w-3" />
              پیش‌نمایش اصلاح‌شده
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {[
          { icon: UsersRound, title: "طرف قرارداد دوطرفه", text: "هر دو نقش موجر و مستاجر با چند گزینه معتبر" },
          { icon: CalendarDays, title: "تاریخ کاملاً شمسی", text: "انتخاب و نمایش جلالی در فرم و سند" },
          { icon: WifiOff, title: "دفتر همراه", text: "داده‌های اصلی روی دستگاه شما می‌مانند" },
        ].map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition hover:bg-white/[0.035]">
              <div className="mb-2 grid h-8 w-8 place-items-center rounded-lg bg-mint-300/[0.07] text-mint-300">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="text-[11px] font-medium text-[#dcebe2]">{feature.title}</h3>
              <p className="mt-1 text-[9px] font-light leading-5 text-[#78968a]">{feature.text}</p>
              <span className="mt-1.5 inline-block rounded bg-mint-300/[0.07] px-1.5 py-0.5 text-[7px] text-mint-300/80">
                در پیش‌نمایش وب
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="glass rounded-[22px] p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint-300/[0.07] text-mint-300">
              <HardDriveDownload className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[12px] font-semibold text-white">نصب در سه گام</h2>
              <p className="mt-0.5 text-[8px] text-[#79968a]">برنامه در چند ثانیه روی گوشی آماده می‌شود</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {[
              ["روی دکمه دانلود بالا بزنید", "فایل APK نسخه ۱.۰.۰ را دریافت کنید."],
              ["اجازه نصب را فعال کنید", "اگر اندروید خواست، برای مرورگر یا فایل‌منیجر «نصب از منابع ناشناس» را فعال کنید."],
              ["برنامه را باز کنید", "وارد بخش قرارداد زمین شوید؛ طرف قرارداد اکنون چند گزینه دارد."],
            ].map(([title, text], index) => (
              <div key={title} className="flex gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-mint-300/20 bg-mint-300/[0.06] text-[9px] font-bold text-mint-300">
                  {toPersianDigits(index + 1)}
                </span>
                <div>
                  <div className="text-[10px] font-medium text-[#d8e8df]">{title}</div>
                  <div className="mt-0.5 text-[8px] font-light leading-5 text-[#78968a]">{text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[22px] border border-sand-300/15 bg-gradient-to-br from-[#332e1e] to-[#232418] p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-sand-300" />
            <h2 className="text-[12px] font-semibold text-[#f0ead6]">شفافیت نسخه</h2>
          </div>
          <div className="space-y-2">
            {[
              ["نام فایل", "KishavarHesab-1.0.0.apk"],
              ["حجم فایل", formatFileSize(release.size)],
              ["تاریخ انتشار (شمسی)", formatIsoInJalali(release.date, "long")],
              ["حداقل اندروید", "اندروید ۸ (API ۲۶)"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2 last:border-0 last:pb-0">
                <span className="text-[8px] font-light text-[#a8a58d]">{label}</span>
                <span className="text-[9px] font-medium text-[#eee6ce]">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-black/15 px-2.5 py-2">
            <div className="mb-1 flex items-center gap-1 text-[7px] text-[#a9a68e]">
              <ShieldCheck className="h-2.5 w-2.5" />
              اثر SHA-256 فایل
            </div>
            <p dir="ltr" className="truncate font-mono text-[7px] tracking-wide text-[#c5c0a7]">{release.digest}</p>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[8px] font-light leading-5 text-[#a7a38b]">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#d6c68f]" />
            همین صفحه تنها مسیر دریافت نسخه ۱ است. نسخه‌های قدیمی‌تر را از گوشی حذف نکنید تا داده‌ها حفظ شوند.
          </p>
        </section>
      </div>

      <div className="mt-4 flex flex-col items-start justify-between gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3 text-[8px] font-light text-[#6e8b7d] sm:flex-row sm:items-center">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-mint-300" />
          این نسخه آزمایشی است و با کلید debug منتشر شده؛ برای انتشار عمومی، امضای اختصاصی لازم است.
        </span>
        <span className="flex items-center gap-1.5">
          <UserRound className="h-3 w-3" />
          {MY_BUSINESS.farm}
        </span>
      </div>
    </div>
  );
}
