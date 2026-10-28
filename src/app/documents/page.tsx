import Link from "next/link";
import { Card, Icon, PageHeader } from "@/components/ui";
import { DocumentValidityGuide } from "@/components/DocumentValidity";
import { ReceiptUploader } from "@/components/Receipts";
import { authorityLevelCounts, noteOnlyEntries } from "@/lib/document-validity";

const fa = (value: number): string => value.toLocaleString("fa-IR");

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
          <p className="text-[11px] text-[#6a7a6d]">سند عادی قابل استناد (سطح ۱)</p>
          <p className="mt-1 text-lg font-bold text-farm-900">{fa(authorityLevelCounts()[1])} سند</p>
          <p className="mt-1 text-[10px] leading-5 text-[#6a7a6d]">قرارداد فروش، تسویه، صورت‌حساب طرف‌حساب و رسید اجاره — فقط در برابر امضاکنندگان، نه اشخاص ثالث.</p>
        </Card>
        <Card className="card-pad">
          <p className="text-[11px] text-[#6a7a6d]">مدرک حمایتی / فنی (سطح ۲)</p>
          <p className="mt-1 text-lg font-bold text-[#7a6533]">{fa(authorityLevelCounts()[2])} سند</p>
          <p className="mt-1 text-[10px] leading-5 text-[#6a7a6d]">قبض باسکول، کیفیت، صورت‌حساب فروش، فیش پرداخت، اجاره‌نامه بلندمدت، تحویل زمین و مدارک ثبتی — به‌تنهایی کافی نیست.</p>
        </Card>
        <Card className="card-pad">
          <p className="text-[11px] text-[#6a7a6d]">یادداشت / بدون اعتبار حقوقی (سطح ۳ و ۴)</p>
          <p className="mt-1 text-lg font-bold text-[#a33a1e]">{fa(authorityLevelCounts()[3] + authorityLevelCounts()[4])} مورد</p>
          <p className="mt-1 text-[10px] leading-5 text-[#6a7a6d]">همه با برچسب «فقط یادداشت» علامت خورده‌اند؛ حذف نمی‌شوند و برای مدیریت و بایگانی می‌مانند.</p>
        </Card>
      </div>

      <Card className="card-pad border-[#eecac0] bg-[#fdf7f4]">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#7d2f1b]">
          <Icon name="alert" className="h-4 w-4" /> فهرست اسناد کم‌اعتبار که فقط به‌عنوان یادداشت ذخیره می‌شوند
        </h2>
        <p className="mt-1 text-[10.5px] leading-6 text-[#7d4b3a]">
          این مدارک در برنامه ساخته می‌شوند و بایگانی‌شان مفید است، اما در دادگاه یا اداره «سند اثبات حق» نیستند.
          کنار هر مورد نوشته‌ایم چه چیزی را ثابت نمی‌کند و برای معتبر شدن چه چیزی لازم دارد.
        </p>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {noteOnlyEntries().map((entry) => (
            <li key={entry.kind} className="rounded-xl border border-[#eecac0] bg-white p-2 text-[10px] leading-5 text-[#5b4a43]">
              <span className="chip border-[#eecac0] bg-[#fdf1ee] py-0 text-[10px] text-[#a33a1e]">فقط یادداشت</span>{" "}
              <strong className="text-[#7d2f1b]">{entry.title}</strong> (سطح {entry.level})
              <p className="mt-1">ثابت نمی‌کند: {entry.why.slice(0, 3).join("، ")}.</p>
              <p className="mt-1 text-[#6a7a6d]">برای اعتبار بیشتر: {entry.toBeValid.slice(0, 3).join("، ")}.</p>
            </li>
          ))}
        </ul>
      </Card>

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
