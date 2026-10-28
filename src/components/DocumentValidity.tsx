"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui";
import {
  AUTHORITY,
  AUTHORITY_LEVELS,
  AUTHORITY_ORDER,
  RECEIPT_NOTE,
  VALIDITY_DISCLAIMER,
  VALIDITY_METHOD,
  authorityFor,
  type AuthorityLevel,
} from "@/lib/document-validity";

const toneClass: Record<"green" | "amber" | "slate" | "red", string> = {
  green: "border-farm-300 bg-farm-50 text-farm-800",
  amber: "border-[#e8d8ab] bg-[#fbf5e4] text-[#7a6533]",
  slate: "border-[#dfe3dc] bg-[#f4f6f3] text-[#4a5a4c]",
  red: "border-[#eecac0] bg-[#fdf1ee] text-[#a33a1e]",
};

export function ValidityBadge({ kind, small = false }: { kind: string; small?: boolean }) {
  const entry = authorityFor(kind);
  const tone = AUTHORITY_LEVELS[entry.level].tone;
  return (
    <span
      title={`${entry.levelLabel} — ${entry.short}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${toneClass[tone]} ${
        small ? "text-[10px]" : "text-[11px]"
      }`}
    >
      <Icon name="lock" className="h-3 w-3" />
      سطح {entry.level} · {entry.level === 1 ? "بین طرفین" : entry.level === 2 ? "حمایتی" : entry.level === 3 ? "یادداشت" : "بدون اعتبار"}
    </span>
  );
}

export function DocumentValidityGuide({ highlight = "receipt" }: { highlight?: string }) {
  const [filter, setFilter] = useState<"all" | AuthorityLevel>("all");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const list = AUTHORITY_ORDER.map((kind) => AUTHORITY[kind]);
    const normalized = query.trim();
    return list.filter((entry) => {
      const levelOk = filter === "all" || entry.level === filter;
      const textOk =
        !normalized ||
        entry.title.includes(normalized) ||
        entry.short.includes(normalized) ||
        entry.legalBasis.includes(normalized);
      return levelOk && textOk;
    });
  }, [filter, query]);

  return (
    <section className="space-y-3">
      <div className="card card-pad border-farm-200 bg-farm-50/60">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-farm-900">
              <Icon name="lock" className="h-4 w-4" /> راهنمای اعتبار اسناد کشاورزحساب
            </h2>
            <p className="mt-1 max-w-3xl text-[11px] leading-6 text-[#4a5a4c]">
              هر سند در برنامه یک «سطح اعتبار» دارد. این سطح از قانون مدنی، قانون صدور چک و سامانهٔ صیاد، سامانهٔ مؤدیان و
              قانون ثبت رسمی معاملات گرفته شده است؛ نه از حدس برنامه.
            </p>
          </div>
          <span className="chip border-farm-300 bg-white text-farm-800">۴ سطح اعتبار</span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {([1, 2, 3, 4] as AuthorityLevel[]).map((level) => {
            const meta = AUTHORITY_LEVELS[level];
            return (
              <div key={level} className={`rounded-xl border p-2.5 ${toneClass[meta.tone]}`}>
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>سطح {level}</span>
                  <span>{meta.tone === "green" ? "قوی" : meta.tone === "amber" ? "حمایتی" : meta.tone === "slate" ? "داخلی" : "بدون اعتبار"}</span>
                </div>
                <p className="mt-1 text-[10px] leading-5 opacity-90">{meta.label}</p>
                <p className="mt-1 text-[10px] leading-5 opacity-75">{meta.description}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-3 rounded-xl border border-[#eecac0] bg-[#fdf1ee] p-3 text-[#7d2f1b]">
          <p className="flex items-center gap-1.5 text-[11px] font-bold">
            <Icon name="alert" className="h-3.5 w-3.5" /> این اسناد فقط «یادداشت» هستند و به همین دلیل در برنامه می‌مانند
          </p>
          <p className="mt-1 text-[10px] leading-5">
            گزارش دفتر مالی، گزارش معاملات، بهای تمام‌شده و گزارش انبار سند اثبات حق نیستند؛ فرم اطلاعات چک هم چک بانکی
            محسوب نمی‌شود. این‌ها حذف نمی‌شوند: برای مدیریت و بایگانی شما می‌مانند، ولی برای دادگاه/اداره باید سند رسمی،
            ثبت صیاد، فاکتور مؤدیان یا سند رسمی اجاره ضمیمه شود.
          </p>
        </div>
      </div>

      <div className="card card-pad">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                ["all", "همه اسناد"],
                [1, "سطح ۱"],
                [2, "سطح ۲"],
                [3, "سطح ۳"],
                [4, "بدون اعتبار"],
              ] as ["all" | AuthorityLevel, string][]
            ).map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setFilter(value)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition ${
                  filter === value
                    ? "border-farm-500 bg-farm-600 text-white"
                    : "border-[#e2dccb] bg-sand-50 text-[#4a5a4c] hover:bg-sand-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="relative block sm:w-64">
            <span className="sr-only">جست‌وجوی سند</span>
            <input
              className="input pr-8 text-xs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجو: باسکول، اجاره، چک…"
            />
            <Icon name="search" className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a9a8d]" />
          </label>
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {rows.map((entry) => (
            <details
              key={entry.kind}
              className={`group rounded-xl border bg-white p-3 ${highlight === entry.kind ? "border-farm-400" : "border-[#eee9dc]"}`}
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-xs font-bold text-[#26382c]">{entry.title}</h3>
                  <p className="mt-1 text-[10px] leading-5 text-[#6a7a6d]">{entry.short}</p>
                </div>
                <ValidityBadge kind={entry.kind} small />
              </summary>
              <div className="mt-2 space-y-2 border-t border-[#f1ecdf] pt-2 text-[10px] leading-5 text-[#4a5a4c]">
                <p>
                  <strong className="text-farm-800">در برابر طرفین:</strong> {entry.betweenParties}
                </p>
                <p>
                  <strong className="text-farm-800">در برابر اشخاص ثالث:</strong> {entry.againstThird}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-farm-50 p-2">
                    <p className="mb-1 font-bold text-farm-800">ثابت می‌کند</p>
                    <ul className="list-disc pr-4">
                      {entry.proves.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-[#fdf1ee] p-2">
                    <p className="mb-1 font-bold text-[#a33a1e]">ثابت نمی‌کند</p>
                    <ul className="list-disc pr-4">
                      {entry.doesNotProve.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div>
                  <p className="mb-1 font-bold text-farm-800">برای معتبرتر شدن</p>
                  <ul className="list-disc pr-4">
                    {entry.needsToBeStronger.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 font-bold text-farm-800">شرایط لازم</p>
                  <ul className="space-y-1">
                    {entry.requirements.map((req) => (
                      <li key={`${entry.kind}-${req.label}`} className="rounded-lg bg-sand-50 px-2 py-1">
                        <span className={req.importance === "الزامی" ? "font-bold text-[#a33a1e]" : "font-semibold text-[#7a6533]"}>
                          {req.importance}:
                        </span>{" "}
                        {req.label} — {req.note}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="rounded-lg bg-[#f7f9f6] px-2 py-1">
                  <strong>مبنای حقوقی:</strong> {entry.legalBasis}
                </p>
                {entry.references.length > 0 && (
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-farm-800">منابع:</span>
                    {entry.references.map((ref) =>
                      ref.url ? (
                        <a
                          key={ref.label}
                          href={ref.url}
                          target="_blank"
                          rel="noreferrer"
                          className="link-quiet chip py-0"
                        >
                          {ref.label}
                        </a>
                      ) : (
                        <span key={ref.label} className="chip py-0">
                          {ref.label}
                        </span>
                      ),
                    )}
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card card-pad">
          <h3 className="flex items-center gap-2 text-sm font-bold text-farm-900">
            <Icon name="book" className="h-4 w-4" /> روش چهار مرحله‌ای بررسی اعتبار
          </h3>
          <ol className="mt-2 space-y-2">
            {VALIDITY_METHOD.map((step) => (
              <li key={step.title} className="rounded-xl border border-[#eee9dc] bg-sand-50 p-2.5">
                <p className="text-[11px] font-bold text-[#33463a]">{step.title}</p>
                <p className="mt-0.5 text-[10px] leading-5 text-[#5b6a5e]">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="card card-pad">
          <h3 className="flex items-center gap-2 text-sm font-bold text-farm-900">
            <Icon name="receipt" className="h-4 w-4" /> رسیدها چطور زنجیرهٔ اثبات را کامل می‌کنند؟
          </h3>
          <p className="mt-2 text-[11px] leading-6 text-[#5b6a5e]">{RECEIPT_NOTE}</p>
          <ul className="mt-2 space-y-1.5 text-[10px] leading-5 text-[#5b6a5e]">
            <li>• قرارداد امضاشده + قبض باسکول + رسید پرداخت = پروندهٔ قابل ارائه.</li>
            <li>• رسید بدون شمارهٔ پیگیری یا نام پرداخت‌کننده ارزش کمتری دارد.</li>
            <li>• در توضیح واریز، شمارهٔ قرارداد/فاکتور را بنویسید تا علت پرداخت روشن باشد.</li>
            <li>• هر رسید را به بخش مربوط (معامله، اجاره، مالی، انبار) وصل کنید تا در گزارش پیدا شود.</li>
          </ul>
          <a href="/receipts" className="btn btn-primary btn-sm mt-3">
            رفتن به مرکز رسیدها
          </a>
        </div>
      </div>

      <p className="rounded-xl border border-sand-300 bg-sand-50 p-3 text-[10px] leading-6 text-[#6a5a3a]">
        {VALIDITY_DISCLAIMER}
      </p>
    </section>
  );
}
