import { getEquipment } from "@/lib/data";
import { formatDate, formatMoney, formatMoneyWords, formatNumber, todayISO } from "@/lib/format";
import { Card, Disclosure, EmptyState, Field, Icon, PageHeader, StatCard, Badge } from "@/components/ui";
import { Money } from "@/components/money";
import { AmountInput } from "@/components/forms";
import { DeleteForm, EditPanel } from "@/components/record-actions";
import { createEquipment, deleteEquipment, updateEquipment } from "@/app/actions";

export const dynamic = "force-dynamic";

const TYPES = ["تراکتور", "کمباین", "تیلر", "ماشین", "ادوات", "پمپ آب", "سایر"];

function depreciation(eq: { purchaseDate: string | null; purchasePrice: number; salvageValue: number; usefulLifeYears: number }) {
  const annual = Math.max(0, (eq.purchasePrice - eq.salvageValue) / Math.max(1, eq.usefulLifeYears));
  const ageYears = eq.purchaseDate
    ? Math.max(0, (Date.now() - new Date(`${eq.purchaseDate}T00:00:00Z`).getTime()) / (365.25 * 86_400_000))
    : 0;
  const accumulated = Math.min(Math.max(0, eq.purchasePrice - eq.salvageValue), annual * ageYears);
  return { annual, accumulated, bookValue: eq.purchasePrice - accumulated, ageYears };
}

export default async function EquipmentPage() {
  const rows = await getEquipment();
  const totalValue = rows.reduce((a, e) => a + depreciation(e).bookValue, 0);
  const totalAnnual = rows.reduce((a, e) => a + depreciation(e).annual, 0);

  const fields = (d: {
    id?: number;
    name?: string;
    type?: string;
    purchaseDate?: string | null;
    purchasePrice?: number;
    salvageValue?: number;
    usefulLifeYears?: number;
    hoursUsed?: number;
    notes?: string;
  }) => (
    <>
      {d.id ? <input type="hidden" name="id" value={d.id} /> : null}
      <Field label="نام ماشین / ادوات *">
        <input name="name" required defaultValue={d.name ?? ""} className="input" placeholder="تراکتور یونتای ۱۶۰" />
      </Field>
      <Field label="نوع">
        <select name="type" className="input" defaultValue={d.type ?? "تراکتور"}>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="تاریخ خرید">
        <input name="purchaseDate" type="date" defaultValue={d.purchaseDate ?? todayISO()} className="input num" />
      </Field>
      <Field label="بهای خرید به ریال" hint={d.id ? `حروفی: ${formatMoneyWords(d.purchasePrice ?? 0)}` : undefined}>
        <AmountInput name="purchasePrice" defaultValue={d.purchasePrice} placeholder="20,000,000,000" />
      </Field>
      <Field label="ارزش اسقاط به ریال">
        <AmountInput name="salvageValue" defaultValue={d.salvageValue} placeholder="2,000,000,000" />
      </Field>
      <Field label="عمر مفید (سال)">
        <input name="usefulLifeYears" type="number" step="0.5" min="1" defaultValue={d.usefulLifeYears ?? 10} className="input num" />
      </Field>
      <Field label="ساعت کارکرد">
        <input name="hoursUsed" type="number" step="1" min="0" defaultValue={d.hoursUsed ?? 0} className="input num" />
      </Field>
      <Field label="یادداشت" className="sm:col-span-2">
        <input name="notes" defaultValue={d.notes ?? ""} className="input" placeholder="شماره پلاک، بیمه، ..." />
      </Field>
    </>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="ماشین‌آلات و استهلاک"
        subtitle="استهلاک خط مستقیم محاسبه می‌شود؛ هر ماشین را ثبت، ویرایش یا حذف کنید."
        icon="tractor"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="تعداد ماشین‌آلات" value={formatNumber(rows.length)} tone="slate" icon="tractor" />
        <StatCard label="ارزش دفتری" value={formatMoney(Math.round(totalValue))} hint={formatMoneyWords(Math.round(totalValue))} tone="farm" icon="wallet" />
        <StatCard label="استهلاک سالانه" value={formatMoney(Math.round(totalAnnual))} hint={formatMoneyWords(Math.round(totalAnnual))} tone="clay" icon="chart" />
        <StatCard label="ساعت کارکرد کل" value={formatNumber(rows.reduce((a, e) => a + e.hoursUsed, 0))} tone="red" icon="calendar" />
      </div>

      <Disclosure title="ثبت ماشین یا ادوات جدید">
        <form action={createEquipment} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields({})}
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" className="btn btn-primary w-full sm:w-auto">
              <Icon name="plus" className="h-4 w-4" />
              ثبت ماشین
            </button>
          </div>
        </form>
      </Disclosure>

      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((eq) => {
          const d = depreciation(eq);
          return (
            <Card key={eq.id} className="card-pad">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 text-sm font-bold text-farm-900">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-farm-50 text-farm-700">
                      <Icon name="tractor" className="h-4 w-4" />
                    </span>
                    {eq.name}
                  </p>
                  <p className="num mt-1.5 text-[11px] text-[#7c8a7f]">
                    {eq.type} · خرید {formatDate(eq.purchaseDate)} · {formatNumber(d.ageYears, 1)} سال کارکرد
                  </p>
                </div>
                <Badge tone={eq.hoursUsed > 0 ? "blue" : "neutral"}>{formatNumber(eq.hoursUsed)} ساعت</Badge>
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-xl bg-sand-50 px-2 py-2">
                  <dt className="text-[10px] text-[#7c8a7f]">بهای خرید</dt>
                  <dd>
                    <Money value={eq.purchasePrice} size="xs" showWords={false} />
                  </dd>
                </div>
                <div className="rounded-xl bg-sand-50 px-2 py-2">
                  <dt className="text-[10px] text-[#7c8a7f]">استهلاک سالانه</dt>
                  <dd>
                    <Money value={Math.round(d.annual)} size="xs" showWords={false} />
                  </dd>
                </div>
                <div className="rounded-xl bg-farm-50 px-2 py-2">
                  <dt className="text-[10px] text-farm-700">ارزش دفتری</dt>
                  <dd>
                    <Money value={Math.round(d.bookValue)} size="xs" showWords={false} />
                  </dd>
                </div>
              </dl>

              <p className="num mt-2 text-[10px] text-[#84907f]">
                ارزیابی: {formatMoney(Math.round(d.bookValue))} ({formatMoneyWords(Math.round(d.bookValue))})
              </p>
              {eq.notes ? <p className="mt-2 rounded-xl bg-sand-50 px-3 py-2 text-[11px] text-[#5b6a5e]">{eq.notes}</p> : null}

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="num text-[10px] text-[#84907f]">استهلاک انباشته: {formatMoney(Math.round(d.accumulated))}</span>
                <DeleteForm action={deleteEquipment} id={eq.id} label="حذف ماشین" variant="button" confirmText={`ماشین «${eq.name}» حذف شود؟`} />
              </div>

              <EditPanel title="ویرایش ماشین">
                <form action={updateEquipment} className="grid gap-2 sm:grid-cols-2">
                  {fields({
                    id: eq.id,
                    name: eq.name,
                    type: eq.type,
                    purchaseDate: eq.purchaseDate,
                    purchasePrice: eq.purchasePrice,
                    salvageValue: eq.salvageValue,
                    usefulLifeYears: eq.usefulLifeYears,
                    hoursUsed: eq.hoursUsed,
                    notes: eq.notes,
                  })}
                  <div className="sm:col-span-2">
                    <button type="submit" className="btn btn-primary w-full sm:w-auto">
                      <Icon name="check" className="h-4 w-4" />
                      ذخیره ویرایش
                    </button>
                  </div>
                </form>
              </EditPanel>
            </Card>
          );
        })}
      </div>

      {!rows.length ? <EmptyState title="ماشینی ثبت نشده" hint="اولین تراکتور یا ادوات خود را اضافه کنید." /> : null}
    </div>
  );
}
