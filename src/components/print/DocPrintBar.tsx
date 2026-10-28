"use client";

import Link from "next/link";
import { Icon } from "@/components/ui";

export function DocPrintBar({ backHref, hint }: { backHref: string; hint?: string }) {
  return (
    <div className="no-print card card-pad flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => window.print()} className="btn btn-primary">
          <Icon name="receipt" className="h-4 w-4" />
          چاپ / ذخیره PDF
        </button>
        <Link href={backHref} className="btn">
          <Icon name="arrow" className="h-4 w-4" />
          بازگشت
        </Link>
      </div>
      <p className="text-[10px] leading-5 text-[#84907f]">
        {hint ?? "برای نسخه رسمی، در پنجره چاپ گزینه Save as PDF را انتخاب و سرصفحه مرورگر را خاموش کنید."}
      </p>
      <p className="w-full rounded-xl border border-[#efe9d9] bg-[#faf7ee] p-2 text-[10px] leading-5 text-[#5b6a5e]">
        <b className="text-farm-900">اعتبار حقوقی چاپ:</b> نسخهٔ چاپی با مشخصات کامل و امضای دستی طرفین، «سند عادی معتبر» بین همان‌هاست
        (قانون مدنی، مواد ۱۰، ۲۱۹ و ۱۲۵۷). برای معاملات زمین و مبالغ بالا، ثبت در دفتر اسناد رسمی لازم است. فرم چاپی چک، چک بانکی
        نیست؛ چک قانونی فقط روی برگهٔ رسمی بانک با شناسهٔ ۱۶ رقمی صیاد، ثبت/تأیید در سامانهٔ صیاد و امضای مطابق نمونهٔ بانک معتبر است.
      </p>
    </div>
  );
}
