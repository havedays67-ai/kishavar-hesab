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
    </div>
  );
}
