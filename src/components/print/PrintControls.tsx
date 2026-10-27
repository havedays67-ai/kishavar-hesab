"use client";

import Link from "next/link";
import { Icon } from "@/components/ui";

export function PrintControls({ tradeId, docType }: { tradeId: number; docType: string }) {
  return (
    <div className="no-print card card-pad flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => window.print()} className="btn btn-primary">
          <Icon name="receipt" className="h-4 w-4" />
          چاپ / ذخیره PDF
        </button>
        <Link href={`/trade/${tradeId}`} className="btn">
          <Icon name="arrow" className="h-4 w-4" />
          بازگشت به معامله
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        {[
          ["contract", "قرارداد"],
          ["weighing", "باسکول"],
          ["quality", "کیفیت"],
          ["invoice", "فاکتور"],
          ["settlement", "تسویه"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/trade/${tradeId}/print/${key}`}
            className={`rounded-full border px-2.5 py-1 ${docType === key ? "border-farm-700 bg-farm-700 text-white" : "border-[#dcd6c5] bg-white text-[#4a5a4c]"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <p className="w-full text-[10px] leading-5 text-[#84907f]">
        در پنجره چاپ، گزینه «Save as PDF» را انتخاب کنید تا نسخه رسمی A4 ذخیره شود. سرصفحه/پاصفحه مرورگر را خاموش کنید تا سند بدون آدرس
        اینترنتی چاپ شود.
      </p>
    </div>
  );
}
