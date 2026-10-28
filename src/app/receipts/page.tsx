import { db } from "@/db";
import { receipts } from "@/db/schema";
import { Card, Icon, PageHeader } from "@/components/ui";
import { RECEIPT_PRIVACY_NOTE, RECEIPT_SECTIONS, formatBytes } from "@/lib/receipt-sections";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "رسیدها و فیش‌ها | کشاورزحساب",
  description: "آپلود و بایگانی رسید پرداخت، فیش واریز، قبض باسکول و مدارک حمایتی در تمام بخش‌های کشاورزحساب.",
};

export default async function ReceiptsPage() {
  let rows: { id: number; sizeBytes: number; amount: number | null; section: string }[] = [];
  try {
    rows = await db
      .select({ id: receipts.id, sizeBytes: receipts.sizeBytes, amount: receipts.amount, section: receipts.section })
      .from(receipts)
      .orderBy(desc(receipts.id))
      .limit(200);
  } catch {
    rows = [];
  }
  const totalAmount = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const totalSize = rows.reduce((sum, row) => sum + row.sizeBytes, 0);
  const usedSections = new Set(rows.map((row) => row.section)).size;
  const money = new Intl.NumberFormat("fa-IR").format(Math.round(totalAmount));

  return (
    <div className="space-y-4">
      <PageHeader
        title="بایگانی همهٔ رسیدها"
        subtitle="همهٔ رسیدهای پیوست‌شده به بدهی، چک، معامله، قرارداد، زمین، کشت، انبار و کارگر در یک جا. آپلود جداگانه وجود ندارد: زیر همان رکوردی که اطلاعاتش را می‌نویسید، دکمهٔ «افزودن تصویر رسید» را بزنید؛ هر رکورد چند رسید می‌گیرد و کنار خودش مشاهده، دانلود و حذف دارد."
        icon="receipt"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="card-pad">
          <p className="text-[11px] text-[#6a7a6d]">تعداد رسید</p>
          <p className="num mt-1 text-lg font-bold text-farm-900">{new Intl.NumberFormat("fa-IR").format(rows.length)}</p>
        </Card>
        <Card className="card-pad">
          <p className="text-[11px] text-[#6a7a6d]">جمع مبالغ رسیدها</p>
          <p className="num mt-1 text-lg font-bold text-farm-900">{money} تومان</p>
        </Card>
        <Card className="card-pad">
          <p className="text-[11px] text-[#6a7a6d]">حجم بایگانی</p>
          <p className="num mt-1 text-lg font-bold text-farm-900">{formatBytes(totalSize)}</p>
        </Card>
        <Card className="card-pad">
          <p className="text-[11px] text-[#6a7a6d]">بخش‌های دارای رسید</p>
          <p className="num mt-1 text-lg font-bold text-farm-900">{new Intl.NumberFormat("fa-IR").format(usedSections)}</p>
        </Card>
      </div>

      <Card className="card-pad">
        <h2 className="flex items-center gap-2 text-sm font-bold text-farm-900">
          <Icon name="receipt" className="h-4 w-4" /> رسید را همان‌جا که اطلاعات را می‌نویسید ضمیمه کنید
        </h2>
        <p className="mt-2 text-[11px] leading-6 text-[#5b6a5e]">
          این صفحه فقط بایگانی و جست‌وجوی رسیدهاست. برای ثبت رسید جدید، به همان رکورد بروید: هر ردیف درآمد/هزینه، هر چک و وام
          در «دفتر مالی»؛ هر طرف‌حساب (مثلاً «از مهدی طلب دارم») در «طرف‌حساب»؛ هر معامله، قرارداد، زمین، کشت و کالای انبار.
          هر رکورد چند رسید می‌گیرد و هر رسید دکمهٔ مشاهده، دانلود و حذف دارد.
        </p>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="card-pad">
          <h2 className="flex items-center gap-2 text-sm font-bold text-farm-900">
            <Icon name="lock" className="h-4 w-4" /> رسید چه چیزی را ثابت می‌کند؟
          </h2>
          <p className="mt-2 text-[11px] leading-6 text-[#5b6a5e]">
            رسید و فیش، «وقوع پرداخت» را نشان می‌دهد؛ اما علت پرداخت را قرارداد یا صورت‌جلسهٔ تسویه اثبات می‌کند. رسید
            بدون شمارهٔ پیگیری، نام پرداخت‌کننده و اتصال به قرارداد، مدرک ضعیفی است.
          </p>
          <a className="btn btn-sm btn-ghost mt-2" href="/documents">
            راهنمای کامل اعتبار اسناد
          </a>
        </Card>
        <Card className="card-pad">
          <h2 className="flex items-center gap-2 text-sm font-bold text-farm-900">
            <Icon name="search" className="h-4 w-4" /> رسید را در کدام بخش بگذارم؟
          </h2>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {RECEIPT_SECTIONS.map((section) => (
              <li key={section.id} className="rounded-lg bg-sand-50 px-2 py-1.5 text-[10px] leading-5 text-[#5b6a5e]">
                <span className="font-semibold text-[#33463a]">{section.label}:</span> {section.hint}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] leading-5 text-[#7a8a7d]">{RECEIPT_PRIVACY_NOTE}</p>
        </Card>
      </div>
    </div>
  );
}
