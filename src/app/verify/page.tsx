import Link from "next/link";
import { Card, Icon, PageHeader } from "@/components/ui";
import { formatDate, formatJalaliNumeric, formatMoney, formatNumber } from "@/lib/format";
import { DOC_TYPES, type DocType } from "@/lib/trade/engine";
import { findDocumentBySerial } from "@/lib/trade/service";

export const dynamic = "force-dynamic";

function maskName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "—";
  if (trimmed.length <= 4) return `${trimmed.slice(0, 1)}***`;
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-2)}`;
}

function maskId(value: string): string {
  if (!value) return "—";
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ serial?: string }> }) {
  const sp = await searchParams;
  const serial = (sp.serial ?? "").trim();
  const result = serial ? await findDocumentBySerial(serial) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="استعلام اصالت سند"
        subtitle="سریال درج‌شده در پایین سند را وارد کنید تا صحت و شماره معامله بررسی شود."
        icon="lock"
      />

      <Card className="card-pad">
        <form className="flex flex-col gap-2 sm:flex-row" action="/verify" method="get">
          <input name="serial" defaultValue={serial} className="input num flex-1" placeholder="KH-1405-0001/INV" />
          <button type="submit" className="btn btn-primary">
            <Icon name="search" className="h-4 w-4" />
            بررسی سند
          </button>
        </form>
      </Card>

      {serial && !result ? (
        <Card className="card-pad border-red-200 bg-red-50">
          <p className="text-sm font-bold text-red-800">سندی با این سریال در سامانه ثبت نشده است.</p>
          <p className="mt-1 text-[11px] leading-5 text-red-700">
            سریال را دقیقاً همان‌گونه که در پایین سند چاپ شده وارد کنید (نمونه: KH-1405-0001/INV). اگر سند تازه صادر شده، ممکن است چند
            لحظه زمان لازم باشد.
          </p>
        </Card>
      ) : null}

      {result ? (
        <Card className="card-pad border-farm-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title text-farm-900">
              <span className="flex items-center gap-2">
                <Icon name="check" className="h-5 w-5 text-farm-700" />
                سند معتبر و ثبت‌شده است
              </span>
            </h2>
            <span className="chip">سریال {result.doc.serial}</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Info label="نوع سند" value={DOC_TYPES[result.doc.docType as DocType]?.title ?? result.doc.docType} />
            <Info label="کد معامله" value={result.trade.code} />
            <Info label="تاریخ صدور" value={formatJalaliNumeric(result.doc.issuedAt)} />
            <Info label="تاریخ قرارداد" value={formatJalaliNumeric(result.trade.contractDate)} />
            <Info label="محصول" value={`${result.trade.cropName} — ${result.trade.gradeLabel}`} />
            <Info label="مبلغ کل" value={formatMoney(result.trade.totalToman)} />
            <Info label="وزن خالص" value={`${formatNumber(result.trade.netKg)} کیلوگرم`} />
            <Info label="مبلغ به حروف" value={`${formatNumber(result.trade.totalToman)} تومان`} />
            <Info label="فروشنده" value={`${maskName(result.trade.sellerName)} (${maskId(result.trade.sellerNationalId)})`} />
            <Info label="خریدار" value={`${maskName(result.trade.buyerName)} (${maskId(result.trade.buyerNationalId)})`} />
            <Info label="موتور محاسبه" value={result.trade.engineVersion} />
            <Info label="ثبت در سامانه" value={formatDate(result.doc.issuedAt)} />
          </div>
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[10px] leading-5 text-amber-900">
            این صفحه فقط وجود سند و مشخصات خلاصه را تأیید می‌کند. برای بررسی کامل متن و امضاها، نسخه چاپی سند نزد طرفین معامله معتبر است.
            مشخصات هویتی برای حفظ حریم خصوصی پوشیده شده‌اند.
          </p>
          <div className="mt-2">
            <Link href={`/trade/${result.trade.id}`} className="btn btn-sm">
              مشاهده معامله در سامانه
              <Icon name="arrow" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-sand-50 px-2 py-1.5">
      <span className="block text-[10px] text-[#84907f]">{label}</span>
      <span className="block text-[11px] font-medium text-[#22331f]">{value}</span>
    </div>
  );
}
