"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui";

export const NAV_ITEMS = [
  { href: "/", label: "داشبورد", icon: "home" },
  { href: "/lands", label: "زمین و کشت", icon: "land" },
  { href: "/trade", label: "معامله و تسویه محصول", icon: "wallet" },
  { href: "/contracts", label: "اجاره و قرارداد زمین", icon: "land" },
  { href: "/transactions", label: "دفتر عملیات", icon: "receipt" },
  { href: "/inventory", label: "انبار نهاده", icon: "box" },
  { href: "/labor", label: "کارگر و دستمزد", icon: "users" },
  { href: "/equipment", label: "ماشین‌آلات", icon: "tractor" },
  { href: "/finance", label: "بدهی و چک", icon: "wallet" },
  { href: "/documents", label: "اعتبار اسناد", icon: "lock" },
  { href: "/receipts", label: "رسیدها و فیش‌ها", icon: "receipt" },
  { href: "/reports", label: "گزارش‌ها", icon: "chart" },
  { href: "/assistant", label: "دستیار هوشمند", icon: "sparkles" },
  { href: "/diagnostics", label: "تست و عیب‌یابی", icon: "alert" },
  { href: "/settings", label: "تنظیمات", icon: "settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
              active
                ? "bg-farm-700 font-semibold text-white shadow-sm"
                : "text-[#3d4c41] hover:bg-farm-50 hover:text-farm-800"
            }`}
          >
            <Icon name={item.icon} className="h-4.5 w-4.5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const MOBILE_PRIMARY = [
  { href: "/", label: "داشبورد", icon: "home" },
  { href: "/trade", label: "معامله", icon: "wallet" },
  { href: "/contracts", label: "قرارداد", icon: "land" },
  { href: "/assistant", label: "دستیار", icon: "sparkles" },
  { href: "/reports", label: "گزارش", icon: "chart" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 bg-[#123019]/40 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 pb-24 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold text-farm-900">همه بخش‌ها</span>
              <button type="button" className="btn btn-sm" onClick={() => setOpen(false)} aria-label="بستن">
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {NAV_ITEMS.filter((item) => !MOBILE_PRIMARY.some((p) => p.href === item.href)).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center text-[11px] font-medium ${
                    isActive(pathname, item.href)
                      ? "border-farm-200 bg-farm-50 text-farm-800"
                      : "border-[#eee9dc] bg-white text-[#5b6a5e]"
                  }`}
                >
                  <Icon name={item.icon} className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e4ddcb] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE_PRIMARY.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-2 text-[10px] font-medium ${
                  active ? "text-farm-700" : "text-[#84907f]"
                }`}
              >
                <span className={`grid h-8 w-10 place-items-center rounded-xl ${active ? "bg-farm-50" : ""}`}>
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex flex-col items-center gap-1 py-2 text-[10px] font-medium text-[#84907f]"
            aria-expanded={open}
          >
            <span className="grid h-8 w-10 place-items-center rounded-xl">
              <Icon name="settings" className="h-5 w-5" />
            </span>
            بیشتر
          </button>
        </div>
      </nav>
    </>
  );
}
