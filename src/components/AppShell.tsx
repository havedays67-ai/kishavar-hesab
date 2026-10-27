import Link from "next/link";
import type { ReactNode } from "react";
import { BottomNav, SidebarNav } from "@/components/Nav";
import { Icon } from "@/components/ui";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1500px]">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-l border-[#e7e2d3] bg-white/70 px-3 py-4 backdrop-blur print:hidden md:flex">
        <Link href="/" className="mb-5 flex items-center gap-2.5 px-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-farm-600 to-farm-800 text-white shadow-md">
            <Icon name="sprout" className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-base font-extrabold text-farm-900">کشاورزحساب</span>
            <span className="block text-[10px] font-medium text-[#84907f]">حسابداری هوشمند کشاورزی</span>
          </span>
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <Link
          href="/assistant"
          className="mt-3 rounded-2xl bg-gradient-to-br from-farm-700 to-farm-900 p-3 text-white shadow-sm"
        >
          <span className="flex items-center gap-2 text-xs font-bold">
            <Icon name="sparkles" className="h-4 w-4" />
            پشتیبان و دستیار هوشمند
          </span>
          <span className="mt-1 block text-[10px] leading-5 text-farm-100">
            آموزش حسابداری کشاورزی، گزارش لحظه‌ای و ثبت اطلاعات با گفتگو.
          </span>
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[#e7e2d3] bg-[#f7f5ee]/90 px-3 py-2.5 backdrop-blur print:hidden sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <Link href="/" className="flex items-center gap-2 md:hidden">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-farm-700 text-white">
                <Icon name="sprout" className="h-5 w-5" />
              </span>
              <span className="text-sm font-extrabold text-farm-900">کشاورزحساب</span>
            </Link>
            <div className="hidden items-center gap-2 text-xs text-[#6a7a6d] md:flex">
              <span className="chip">
                <span className="h-1.5 w-1.5 rounded-full bg-farm-500" />
                داده‌ها روی همین سرور، فقط برای مزرعه شما
              </span>
              <span className="chip">نسخه وب و اندروید ۸+</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/knowledge" className="btn btn-sm hidden sm:inline-flex">
                <Icon name="book" className="h-3.5 w-3.5" />
                آموزش
              </Link>
              <Link href="/assistant" className="btn btn-primary btn-sm">
                <Icon name="sparkles" className="h-3.5 w-3.5" />
                دستیار
              </Link>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-3 pb-24 pt-3 print:p-0 sm:px-5 sm:pb-10 sm:pt-5">{children}</main>

        <footer className="hidden border-t border-[#e7e2d3] px-5 py-4 text-[11px] text-[#84907f] print:hidden sm:block">
          کشاورزحساب — حسابداری کشاورزی با معماری سبک برای اندروید؛ هوش مصنوعی فقط به داده‌های همین نرم‌افزار دسترسی دارد.
        </footer>
      </div>

      <div className="print:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
