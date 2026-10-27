import type { ReactNode } from "react";
import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CreditCard,
  FileText,
  Files,
  Landmark,
  LayoutDashboard,
  Leaf,
  Menu,
  Package,
  Scale,
  ShieldCheck,
  Smartphone,
  Sprout,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "../utils/cn";
import { MY_BUSINESS, type Page } from "../lib/data";
import { formatJalali, toPersianDigits, todayJalali } from "../lib/format";
import { Avatar, BrandMark } from "./ui";

const NAV_ITEMS: {
  id: Page;
  label: string;
  short: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  group: "work" | "ledger" | "system";
}[] = [
  { id: "dashboard", label: "پیشخوان مزرعه", short: "پیشخوان", icon: LayoutDashboard, group: "work" },
  { id: "trade", label: "معامله محصول", short: "معامله", icon: Scale, badge: "جدید", group: "work" },
  { id: "contracts", label: "قرارداد زمین", short: "قرارداد", icon: FileText, group: "work" },
  { id: "rentals", label: "اجاره و اقساط", short: "اجاره", icon: Landmark, group: "work" },
  { id: "crops", label: "زمین و کشت", short: "زمین", icon: Sprout, group: "work" },
  { id: "finance", label: "دفتر مالی", short: "مالی", icon: Wallet, group: "ledger" },
  { id: "parties", label: "بدهکار و بستانکار", short: "طرف‌حساب", icon: UsersRound, group: "ledger" },
  { id: "inventory", label: "انبار، دارایی، بودجه", short: "انبار", icon: Package, group: "ledger" },
  { id: "documents", label: "اسناد و چاپ", short: "اسناد", icon: Files, badge: "A4", group: "ledger" },
  { id: "reports", label: "گزارش‌های مدیریتی", short: "گزارش", icon: BarChart3, group: "ledger" },
  { id: "backup", label: "دستیار و پشتیبان", short: "پشتیبان", icon: CreditCard, group: "system" },
  { id: "architecture", label: "معماری و فرمول‌ها", short: "معماری", icon: BookOpen, group: "system" },
  { id: "download", label: "دریافت برنامه", short: "دریافت اپ", icon: Smartphone, group: "system" },
];

const PAGE_LABELS: Record<Page, string> = {
  dashboard: "پیشخوان",
  trade: "معامله محصول",
  contracts: "قرارداد زمین",
  rentals: "اجاره و اقساط",
  crops: "زمین و کشت",
  finance: "دفتر مالی",
  parties: "بدهکار و بستانکار",
  inventory: "انبار، دارایی و بودجه",
  documents: "اسناد و چاپ",
  reports: "گزارش‌ها",
  backup: "دستیار و پشتیبان",
  architecture: "معماری",
  download: "دریافت برنامه",
};

const GROUPS: { key: "work" | "ledger" | "system"; label: string }[] = [
  { key: "work", label: "کار روزانه" },
  { key: "ledger", label: "دفتر و اسناد" },
  { key: "system", label: "راهنما و برنامه" },
];

const MOBILE_PRIMARY: Page[] = ["dashboard", "trade", "parties", "documents"];

export function AppShell({
  page,
  onNavigate,
  children,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}) {
  const today = todayJalali();
  const [moreOpen, setMoreOpen] = useState(false);
  const isNative = Capacitor.isNativePlatform();
  const items = isNative ? NAV_ITEMS.filter((item) => item.id !== "download") : NAV_ITEMS;

  const go = (next: Page) => {
    setMoreOpen(false);
    onNavigate(next);
  };

  return (
    <div className="app-shell min-h-screen bg-transparent text-[#eff7f1]">
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-[282px] flex-col overflow-y-auto border-l border-white/[0.07] bg-[#091611]/95 px-4 pb-4 pt-5 backdrop-blur-xl lg:flex">
        <button type="button" onClick={() => go("dashboard")} className="mb-4 flex items-center gap-3 px-1 text-right">
          <BrandMark />
          <span className="min-w-0">
            <span className="block text-[17px] font-extrabold tracking-tight text-white">کسب‌وکار من</span>
            <span className="mt-0.5 block text-[10px] font-light tracking-wide text-[#87a497]">
              دفتر کل آرام · حسابداری کشاورزی
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => go("crops")}
          className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-3 py-2.5 text-right transition hover:border-mint-300/20"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-300/10 text-mint-300">
            <Leaf className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-[#e7f4ec]">{MY_BUSINESS.farm}</span>
            <span className="mt-0.5 block truncate text-[10px] text-[#78968a]">{MY_BUSINESS.location}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-[#69887b]" />
        </button>

        <nav className="space-y-4" aria-label="ناوبری اصلی">
          {GROUPS.map((group) => {
            const groupItems = items.filter((item) => item.group === group.key);
            if (groupItems.length === 0) return null;
            return (
              <div key={group.key}>
                <div className="mb-1.5 px-3 text-[9px] font-medium tracking-wide text-[#658275]">{group.label}</div>
                <div className="space-y-0.5">
                  {groupItems.map((item) => {
                    const Icon = item.icon;
                    const active = page === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => go(item.id)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-right text-[12px] transition",
                          active
                            ? "bg-[#153426] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(121,223,183,0.13)]"
                            : "text-[#9db3a8] hover:bg-white/[0.035] hover:text-[#deeee5]"
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition",
                            active ? "bg-mint-300/15 text-mint-300" : "text-[#78998a] group-hover:text-mint-300"
                          )}
                        >
                          <Icon className="h-[16px] w-[16px]" strokeWidth={active ? 2.1 : 1.7} />
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className="rounded bg-mint-300/10 px-1.5 py-0.5 text-[8px] font-medium text-mint-300">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2.5 pt-5">
          <div className="rounded-2xl border border-[#77975c]/20 bg-gradient-to-br from-[#1b3525] to-[#10251b] p-3.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[#c2e0aa]">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="text-[9px] font-medium">محاسبه‌ی قطعی و قابل حسابرسی</span>
            </div>
            <p className="text-[9px] font-light leading-5 text-[#9eb59c]">
              هر عدد معامله، فرمول و ردّ محاسبه دارد. حدود کیفیت را با قرارداد خریدار تطبیق دهید.
            </p>
            <button
              type="button"
              onClick={() => go("architecture")}
              className="mt-2 text-[9px] font-medium text-[#c9e6b1] transition hover:text-white"
            >
              دیدن معماری و فرمول‌ها ←
            </button>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-2.5">
            <Avatar name={MY_BUSINESS.owner} color="sand" size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-[#dcebe2]">{MY_BUSINESS.owner}</p>
              <p className="mt-0.5 truncate text-[9px] text-[#78968a]"></p>
            </div>
            <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
          </div>
        </div>
      </aside>

      <div className="lg:mr-[282px]">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07110d]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1460px] items-center gap-3 px-4 sm:px-6 lg:h-[70px] lg:px-8">
            <button type="button" onClick={() => setMoreOpen(true)} className="lg:hidden" aria-label="منوی بیشتر">
              <Menu className="h-5 w-5 text-[#b7cdc1]" />
            </button>
            <div className="flex items-center gap-2.5 lg:hidden">
              <BrandMark size="sm" />
              <div>
                <p className="text-[13px] font-extrabold leading-4 text-white">کسب‌وکار من</p>
                <p className="mt-0.5 text-[9px] text-[#78968a]">{PAGE_LABELS[page]}</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 text-[11px] lg:flex">
              <span className="text-[#78968a]">کسب‌وکار من</span>
              <span className="text-[#456055]">/</span>
              <span className="font-medium text-[#c9ddd2]">{PAGE_LABELS[page]}</span>
            </div>
            <div className="mr-auto flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] text-[#9bb4a8] sm:flex">
                <CalendarDays className="h-3.5 w-3.5 text-[#7fa294]" />
                <span>{formatJalali(today, "weekday")}</span>
              </div>
              <button
                type="button"
                className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-[#9bb4a8] transition hover:bg-white/[0.06] hover:text-white"
                aria-label="اعلان‌ها"
                onClick={() => go("reports")}
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2.5 top-2 h-1.5 w-1.5 rounded-full border border-[#07110d] bg-sand-300" />
              </button>
              <button
                type="button"
                onClick={() => go("trade")}
                className="flex items-center gap-2 rounded-xl border border-mint-300/20 bg-mint-300/[0.08] px-3 py-2 text-[10px] font-semibold text-mint-300 transition hover:bg-mint-300/[0.14]"
              >
                <Scale className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">محاسبه فروش محصول</span>
                <span className="sm:hidden">محاسبه</span>
              </button>
              <button
                type="button"
                onClick={() => go("parties")}
                className="rounded-full ring-offset-2 ring-offset-[#07110d] transition hover:ring-1 hover:ring-mint-300/40"
                aria-label="پروفایل"
              >
                <Avatar name={MY_BUSINESS.owner} color="sand" size="sm" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1460px] px-4 pb-28 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>

        <footer className="no-print mx-auto hidden max-w-[1460px] flex-wrap items-center justify-between gap-2 px-8 pb-6 text-[10px] text-[#607d70] lg:flex">
          <span>کسب‌وکار من ·  · موتور معامله {toPersianDigits("1.0.0")}</span>
          <span>تاریخ‌ها شمسی · مبالغ به تومان · محاسبات قطعی و قابل حسابرسی</span>
        </footer>
      </div>

      <nav
        className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-[#0a1712]/95 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur-xl lg:hidden"
        aria-label="ناوبری موبایل"
      >
        <div className="mx-auto grid max-w-xl grid-cols-5 px-2 pt-2">
          {MOBILE_PRIMARY.map((id) => {
            const item = NAV_ITEMS.find((nav) => nav.id === id)!;
            const Icon = item.icon;
            const active = page === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 rounded-xl py-1.5 text-[9px] transition",
                  active ? "text-mint-300" : "text-[#78968a]"
                )}
              >
                <span className={cn("grid h-8 w-10 place-items-center rounded-xl transition", active && "bg-mint-300/[0.12]")}>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.7} />
                </span>
                <span className={cn(active && "font-semibold")}>{item.short}</span>
                {item.badge && !active && <span className="absolute left-[24%] top-1 h-1.5 w-1.5 rounded-full bg-sand-300" />}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-[9px] text-[#78968a]"
          >
            <span className="grid h-8 w-10 place-items-center rounded-xl">
              <Menu className="h-[18px] w-[18px]" />
            </span>
            <span>بیشتر</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <button type="button" className="absolute inset-0 bg-[#020806]/80 backdrop-blur-sm" onClick={() => setMoreOpen(false)} aria-label="بستن منو" />
          <div className="animate-rise relative z-10 w-full max-w-lg rounded-t-[26px] border border-[#29483b] bg-[#0d1d16] p-5 pb-[max(env(safe-area-inset-bottom),20px)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">همه بخش‌ها</h2>
                <p className="mt-0.5 text-[9px] text-[#78968a]">{MY_BUSINESS.farm} · </p>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-[#9fb6aa]"
                aria-label="بستن"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {items.filter((item) => !MOBILE_PRIMARY.includes(item.id)).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => go(item.id)}
                    className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-right transition hover:border-mint-300/20"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-mint-300/[0.08] text-mint-300">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 text-[10px] font-medium text-[#dcebe2]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
