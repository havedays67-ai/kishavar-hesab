import { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  FileCheck2,
  FilePlus2,
  Files,
  Info,
  LandPlot,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { cn } from "../utils/cn";
import {
  CONTRACT_TYPES,
  type Page,
  type Party,
  type SavedContract,
} from "../lib/data";
import { formatJalali, formatNumber, todayJalali, toPersianDigits } from "../lib/format";
import { ContractForm } from "../components/ContractForm";
import { ContractPreview } from "../components/ContractPreview";
import { RoleBadge, StatusPill, Toast } from "../components/ui";

type Tab = "new" | "list";

const BUG_FIXES = [
  {
    title: "فهرست طرف قرارداد یک‌گزینه‌ای و خالی بود",
    before: "فقط placeholder «انتخاب…» دیده می‌شد و شخص دیگری قابل انتخاب نبود.",
    after: "برای هر نقش حداقل دو طرف قرارداد معتبر نمایش داده می‌شود و امکان ساخت طرف جدید هم وجود دارد.",
  },
  {
    title: "جهت قرارداد فقط یک حالت داشت",
    before: "فیلد «نقش من» فقط یک مقدار نشان می‌داد و امکان جابه‌جایی موجر/مستاجر واضح نبود.",
    after: "دو کارت جداگانه برای «زمین را اجاره می‌کنم» و «زمین را اجاره می‌دهم» اضافه شد.",
  },
  {
    title: "تاریخ‌ها میلادی نمایش داده می‌شدند",
    before: "نمونه‌ها 2026/10/27 و 2027/10/27 بودند.",
    after: "انتخابگر تقویم شمسی و نمایش کوتاه/بلند جلالی در فرم و سند قرار گرفت.",
  },
  {
    title: "سهم محصول به شکل ۰۱۰۰۰۰۰ بود",
    before: "فیلد درصد، جداکننده و محدوده‌ی درست نداشت.",
    after: "درصد سهم از مبلغ جدا شد، بین ۰ تا ۱۰۰ محدود است و جداکننده هزارگان روی مبلغ اعمال می‌شود.",
  },
  {
    title: "لینک دانلود تکراری و مبهم",
    before: "در مستندات و صفحه اصلی چند مسیر دانلود مختلف وجود داشت.",
    after: "یک مقصد دانلود واحد برای نسخه ۱.۰.۰ در صفحه «دریافت برنامه» قرار گرفت.",
  },
];

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
  const [fixOpen, setFixOpen] = useState(false);
  const [previewContract, setPreviewContract] = useState<SavedContract | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:mb-6 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#84a294]">
            <ScrollText className="h-3.5 w-3.5 text-mint-300" />
            قراردادهای کشاورزی
            <span className="rounded-md border border-mint-300/15 bg-mint-300/[0.07] px-1.5 py-0.5 text-[8px] text-mint-300">
              نسخه اصلاح‌شده
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
            onClick={() => setFixOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-[#93ae6b]/25 bg-[#b3d693]/[0.06] px-3 py-2.5 text-[10px] font-medium text-[#c6e2ad] transition hover:bg-[#b3d693]/10"
          >
            <Sparkles className="h-3.5 w-3.5" />
            گزارش اصلاح باگ‌ها
          </button>
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

      <div className="mb-5 overflow-hidden rounded-2xl border border-[#7fa35a]/25 bg-gradient-to-l from-[#1a3523]/80 via-[#142d20]/75 to-[#11271b]/60 p-3.5 sm:flex sm:items-center sm:gap-3 sm:p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#bbd99d]/20 bg-[#b3d693]/10 text-[#c6e6a9]">
            <BadgeCheck className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-[#e7f3d7]">باگ بخش طرف قرارداد رفع شد؛ حالا انتخاب دوطرفه است.</p>
            <p className="mt-1 text-[9px] font-light leading-5 text-[#a1b99a]">
              برای هر نقش، دو طرف قرارداد نمایش داده می‌شود. با تغییر نقش، فهرست نیز مطابق آن عوض می‌شود.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFixOpen(true)}
          className="mt-2.5 flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#bcd7a1]/20 bg-[#b3d693]/[0.06] px-3 py-2 text-[9px] font-medium text-[#c8e4b1] sm:mt-0 sm:w-auto"
        >
          جزئیات بررسی
          <ArrowLeft className="h-3 w-3" />
        </button>
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

      {tab === "new" ? (
        <ContractForm parties={parties} onCreateParty={onCreateParty} onCreateContract={onCreateContract} />
      ) : (
        <div className="space-y-3">
          {contracts.map((contract) => {
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
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3 sm:mt-0 sm:block sm:border-0 sm:pt-0 sm:text-left">
                  <div>
                    <div className="text-[11px] font-semibold text-mint-300">
                      {contract.rent ? `${formatNumber(contract.rent)} تومان` : `${toPersianDigits(contract.cropShare)}٪ سهم محصول`}
                    </div>
                    <div className="mt-0.5 text-[8px] text-[#718e81]">ودیعه {formatNumber(contract.deposit)} تومان</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewContract(contract)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-1.5 text-[9px] text-[#b8cec3] transition hover:border-mint-300/25 hover:text-mint-300 sm:mt-2"
                  >
                    <FileCheck2 className="h-3 w-3" />
                    مشاهده سند
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

      {fixOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-5">
          <button
            type="button"
            className="absolute inset-0 bg-[#020806]/80 backdrop-blur-sm"
            onClick={() => setFixOpen(false)}
            aria-label="بستن گزارش اصلاح"
          />
          <div className="animate-rise relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[26px] border border-[#29483b] bg-[#0d1d16] sm:rounded-[24px]">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#b6d397]/25 bg-[#b3d693]/10 text-[#c5e5a9]">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-white sm:text-base">گزارش بررسی و اصلاح</h2>
                  <p className="mt-1 text-[10px] font-light leading-5 text-[#8ba69a]">
                    پنج مشکل قابل مشاهده در فرم و مسیر انتشار بررسی و اصلاح شد. شماره نسخه روی ۱.۰.۰ باقی مانده است.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFixOpen(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] text-[#91aa9e] hover:bg-white/[0.05]"
                aria-label="بستن"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 sm:p-5">
              <div className="space-y-2.5">
                {BUG_FIXES.map((item, index) => (
                  <div key={item.title} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-300/10 text-[9px] font-bold text-mint-300">
                        {toPersianDigits(index + 1)}
                      </span>
                      <h3 className="text-[11px] font-semibold text-[#e1eee6]">{item.title}</h3>
                      <span className="mr-auto rounded bg-[#a8d48b]/10 px-1.5 py-0.5 text-[8px] text-[#b8df9c]">رفع شد</span>
                    </div>
                    <div className="grid gap-2 text-[9px] font-light leading-5 sm:grid-cols-2">
                      <div className="rounded-lg border border-[#8b584f]/15 bg-[#8b584f]/[0.06] px-2.5 py-2 text-[#d4a79d]">
                        <span className="mb-0.5 block text-[8px] font-medium text-[#bb8e84]">وضعیت قبلی</span>
                        {item.before}
                      </div>
                      <div className="rounded-lg border border-[#6f9564]/15 bg-[#6f9564]/[0.07] px-2.5 py-2 text-[#bad4b0]">
                        <span className="mb-0.5 block text-[8px] font-medium text-[#9cc18f]">وضعیت اصلاح‌شده</span>
                        {item.after}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[9px] font-light leading-5 text-[#819d90]">
                <div className="mb-1 flex items-center gap-1.5 font-medium text-[#b5cabd]">
                  <ShieldCheck className="h-3 w-3 text-mint-300" />
                  درباره نسخه و انتشار
                </div>
                نسخه ۱.۰.۰ حفظ شده و APK آن با همین اصلاحات در GitHub Actions ساخته و در Release عمومی قرار گرفته است.
                لینک دانلود صفحه دریافت برنامه، یک مسیر ثابت و رسمی است.
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] p-4">
              <span className="flex items-center gap-1.5 text-[9px] text-[#78968a]">
                <CalendarDays className="h-3 w-3" />
                امروز: {formatJalali(todayJalali(), "long")}
              </span>
              <button
                type="button"
                onClick={() => setFixOpen(false)}
                className="rounded-xl bg-mint-400 px-5 py-2.5 text-[10px] font-semibold text-[#07110d] transition hover:bg-mint-300"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        </div>
      )}

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
