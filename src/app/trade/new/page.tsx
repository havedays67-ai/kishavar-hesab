import Link from "next/link";
import { TradeCalculator } from "@/components/TradeCalculator";
import { Icon, PageHeader } from "@/components/ui";
import { listLands } from "@/lib/trade/service";

export const dynamic = "force-dynamic";

export default async function NewTradePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const lands = await listLands();

  return (
    <div className="space-y-4">
      <PageHeader
        title="ثبت معامله محصول"
        subtitle="وزن، کیفیت و شرایط توافق‌شده را وارد کنید؛ مبلغ تسویه و ردّ محاسبه بلافاصله نشان داده می‌شود."
        icon="plus"
        actions={
          <Link href="/trade" className="btn">
            <Icon name="arrow" className="h-4 w-4" />
            بازگشت
          </Link>
        }
      />
      <div className="rounded-2xl border border-farm-200 bg-farm-50 p-3 text-[11px] leading-5 text-farm-900">
        <strong>پیش از ثبت بخوانید:</strong> هر رقمی که در برگه باسکول و آزمایشگاه آمده عیناً وارد کنید. سامانه اصلاحات را ثبت می‌کند و
        اسناد رسمی با همان اعداد ساخته می‌شوند؛ پس از ثبت هم می‌توانید دریافتی‌ها را در صفحه معامله اضافه کنید.
      </div>
      <TradeCalculator lands={lands} initialError={sp.error} />
    </div>
  );
}
