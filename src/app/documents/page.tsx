import Link from "next/link";
import { Card, Icon, PageHeader } from "@/components/ui";
import { DocumentValidityGuide } from "@/components/DocumentValidity";
import { ReceiptUploader } from "@/components/Receipts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "اعتبار اسناد و مدارک | کشاورزحساب",
  description: "تحلیل اعتبار حقوقی اسناد تولیدشده در کشاورزحساب: سند عادی، مدرک حمایتی، یادداشت داخلی و اسناد بدون اعتبار.",
};

export default function DocumentsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="اعتبار اسناد و مدارک"
        subtitle="کدام سند در قانون ارزش دارد، کدام فقط مدرک حمایتی است و کدام یادداشت داخلی است — با مبنای قانونی و شرط‌های هر سند."
        icon="lock"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="card-pad">
          <p className="text-[11px] text-[#6a7a6d]">سند عادی قابل استناد</p>
          <p className="mt-1 text-lg font-bold text-farm-900">۴ سند</p>
          <p className="mt-1 text-[10px] leading-5 text-[#6a7a6d]">قرارداد فروش، تسویه، صورت‌حساب طرف‌حساب و رسید اجاره — فقط در برابر امضاکنندگان.</p>
        </Card>
        <Card className="card-pad">
          <p className="text-[11px] text-[#6a7a6d]">مدرک حمایتی / فنی</p>
          <p className="mt-1 text-lg font-bold text-[#7a6533]">۷ سند</p>
          <p className="mt-1 text-[10px] leading-5 text-[#6a7a6d]">قبض باسکول، کیفیت، صورت‌حساب فروش، فیش پرداخت، اجاره‌نامه بلندمدت، تحویل زمین و مدارک ثبتی.</p>
        </Card>
        <Card className="card-pad">
          <p className="text-[11px] text-[#6a7a6d]">یادداشت / بدون اعتبار حقوقی</p>
          <p className="mt-1 text-lg font-bold text-[#a33a1e]">۵ مورد</p>
          <p className="mt-1 text-[10px] leading-5 text-[#6a7a6d]">گزارش مالی، معاملات، بهای تمام‌شده، انبار و فرم چک. این‌ها حذف نمی‌شوند؛ فقط یادداشت‌اند.</p>
        </Card>
      </div>

      <DocumentValidityGuide />

      <ReceiptUploader
        section="documents"
        heading="آپلود رسید و مدرک برای پروندهٔ اسناد"
        subtitle="اسکن سند امضاشده، گواهی برابر اصل، قبض باسکول یا فیش پرداخت را در همین بخش نگه دارید تا همراه گزارش‌ها بایگانی شود."
      />

      <Card className="card-pad">
        <h2 className="flex items-center gap-2 text-sm font-bold text-farm-900">
          <Icon name="book" className="h-4 w-4" /> از کجا سند می‌سازید؟
        </h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/trade", title: "معامله محصول", text: "قرارداد فروش، قبض باسکول، تسویه و چاپ A4" },
            { href: "/contracts", title: "اجاره و قرارداد زمین", text: "قرارداد اجاره، رسید مال‌الاجاره و تحویل زمین" },
            { href: "/finance", title: "بدهی و چک", text: "صورت‌حساب طرف‌حساب، فرم چک و پیگیری صیاد" },
            { href: "/reports", title: "گزارش‌های مدیریتی", text: "یادداشت داخلی سود، بهای تمام‌شده و انبار" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl border border-[#eee9dc] bg-white p-2.5 transition hover:border-farm-300 hover:bg-farm-50/50">
              <p className="text-xs font-semibold text-[#26382c]">{item.title}</p>
              <p className="mt-1 text-[10px] leading-5 text-[#6a7a6d]">{item.text}</p>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
