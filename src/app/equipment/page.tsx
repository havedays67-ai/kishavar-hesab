import { getEquipment } from "@/lib/data";
import { formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format";
import { Card, Disclosure, EmptyState, Field, Icon, PageHeader, StatCard, Badge } from "@/components/ui";
import { createEquipment, deleteEquipment } from "@/app/actions";

export const dynamic = "force-dynamic";

function depreciation(eq: { purchaseDate: string | null; purchasePrice: number; salvageValue: number; usefulLifeYears: number }) {
  const annual = Math.max(0, (eq.purchasePrice - eq.salvageValue) / Math.max(1, eq.usefulLifeYears));
  const ageYears = eq.purchaseDate
    ? Math.max(0, (Date.now() - new Date(`${eq.purchaseDate}T00:00:00Z`).getTime()) / (365.25 * 86_400_000))
    : 0;
  const accumulated = Math.min(eq.purchasePrice - eq.salvageValue, annual * ageYears);
  return { annual, accumulated, bookValue: eq.purchasePrice - accumulated, ageYears };
}

export default async function EquipmentPage() {
  const rows = await getEquipment();
  const totalValue = rows.reduce((a, e) => a + depreciation(e).bookValue, 0);
  const totalAnnual = rows.reduce((a, e) => a + depreciation(e).annual, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="ماشین‌آلات و استهلاک"
        subtitle="استهلاک را با روش خط مستقیم محاسبه کنید تا هزینه واقعی هر عملیات و هر هکتار مشخص شود."
        icon="tractor"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="تعداد ماشین" value={formatNumber(rows.length)} tone="slate" icon="tractor" />
        <StatCard label="ارزش دفتری" value={`${formatMoney(Math.round(totalValue))} تومان`} tone="farm" icon="wallet" />
        <StatCard label="استهلاک سالانه" value={`${formatMoney(Math.round(totalAnnual))} تومان`} tone="clay" icon="chart" />
        <StatCard
          label="ساعت کار ثبت‌شده"
          value={formatNumber(rows.reduce((a, e) => a + e.hoursUsed, 0))}
          tone="slate"
          icon="calendar"
          hint="برای سرشکست استهلاک روی ساعت"
        />
      </div>

      <Disclosure title="ثبت ماشین یا تجهیز جدید">
        <form action={createEquipment} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="نام ماشین *">
            <input name="name" required className="input" placeholder="تراکتور ITM 285" />
          </Field>
          <Field label="نوع">
            <select name="type" className="input" defaultValue="تراکتور">
              <option>تراکتور</option>
              <option>تیلر</option>
              <option>سمپاش</option>
              <option>کمباین</option>
              <option>تجهیزات آبیاری</option>
              <option>خودرو حمل</option>
              <option>سایر</option>
            </select>
          </Field>
          <Field label="تاریخ خرید">
            <input name="purchaseDate" type="date" defaultValue={todayISO()} className="input num" />
          </Field>
          <Field label="بهای خرید (تومان)">
            <input name="purchasePrice" inputMode="numeric" className="input num" placeholder="1450000000" />
          </Field>
          <Field label="ارزش اسقاط (تومان)">
            <input name="salvageValue" inputMode="numeric" className="input num" placeholder="350000000" />
          </Field>
          <Field label="عمر مفید (سال)">
            <input name="usefulLifeYears" type="number" min="1" step="0.5" defaultValue={10} className="input num" />
          </Field>
          <Field label="ساعت کارکرد">
            <input name="hoursUsed" type="number" min="0" className="input num" placeholder="1450" />
          </Field>
          <Field label="یادداشت" className="sm:col-span-2">
            <input name="notes" className="input" placeholder="وضعیت فنی، تعمیرات اخیر..." />
          </Field>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary w-full">
              <Icon name="plus" className="h-4 w-4" />
              ثبت ماشین
            </button>
          </div>
        </form>
      </Disclosure>

      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((eq) => {
          const d = depreciation(eq);
          const progress = eq.purchasePrice > 0 ? d.accumulated / eq.purchasePrice : 0;
          return (
            <Card key={eq.id} className="card-pad">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-farm-900">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-sand-100 text-farm-700">
                      <Icon name="tractor" className="h-4 w-4" />
                    </span>
                    {eq.name}
                  </h3>
                  <p className="num mt-1 text-[11px] text-[#7c8a7f]">
                    {eq.type} · خرید {formatDate(eq.purchaseDate)} · {formatNumber(eq.usefulLifeYears, 1)} سال عمر مفید
                  </p>
                </div>
                <Badge tone="neutral">{formatNumber(Math.floor(d.ageYears))} سال کارکرد</Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-sand-100 px-2 py-2 text-center">
                  <span className="block text-[10px] text-[#6a7a6d]">بهای خرید</span>
                  <span className="num block text-[11px] font-bold">{formatMoney(eq.purchasePrice)}</span>
                </div>
                <div className="rounded-xl bg-[#fdf2e7] px-2 py-2 text-center">
                  <span className="block text-[10px] text-clay-600">استهلاک سالانه</span>
                  <span className="num block text-[11px] font-bold text-clay-600">{formatMoney(Math.round(d.annual))}</span>
                </div>
                <div className="rounded-xl bg-red-50 px-2 py-2 text-center">
                  <span className="block text-[10px] text-red-600">استهلاک انباشته</span>
                  <span className="num block text-[11px] font-bold text-red-700">{formatMoney(Math.round(d.accumulated))}</span>
                </div>
                <div className="rounded-xl bg-farm-50 px-2 py-2 text-center">
                  <span className="block text-[10px] text-farm-700">ارزش دفتری</span>
                  <span className="num block text-[11px] font-bold text-farm-800">{formatMoney(Math.round(d.bookValue))}</span>
                </div>
              </div>

              <div className="mt-2.5">
                <div className="mb-1 flex items-center justify-between text-[10px] text-[#84907f]">
                  <span>درصد استهلاک‌شده</span>
                  <span className="num">{formatNumber(Math.round(Math.min(1, progress) * 100))}٪</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#eee9dc]">
                  <div className="h-full rounded-full bg-clay-500" style={{ width: `${Math.min(100, Math.max(2, progress * 100))}%` }} />
                </div>
              </div>

              {eq.notes ? <p className="mt-2 rounded-xl bg-sand-50 px-3 py-2 text-[11px] text-[#5b6a5e]">{eq.notes}</p> : null}

              <form action={deleteEquipment} className="mt-3">
                <input type="hidden" name="id" value={eq.id} />
                <button type="submit" className="flex items-center gap-1 text-[10px] font-medium text-red-600">
                  <Icon name="trash" className="h-3 w-3" />
                  حذف ماشین
                </button>
              </form>
            </Card>
          );
        })}
      </div>

      {!rows.length ? <EmptyState title="ماشینی ثبت نشده است" /> : null}

      <Card className="card-pad bg-sand-50">
        <p className="text-xs leading-6 text-[#5b6a5e]">
          💡 استهلاک سالانه = (بهای خرید − ارزش اسقاط) ÷ عمر مفید. برای محاسبه هزینه هر ساعت کار، استهلاک سالانه را بر ساعت کارکرد سالانه تقسیم کنید و هزینه سوخت،
          روغن و تعمیرات را جداگانه در دفتر عملیات ثبت کنید.
        </p>
      </Card>
    </div>
  );
}
