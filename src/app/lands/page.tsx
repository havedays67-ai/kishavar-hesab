import Link from "next/link";
import { getFarmOverview } from "@/lib/data";
import { formatMoney, formatMoneyWords, formatNumber, statusLabel } from "@/lib/format";
import { Card, Disclosure, EmptyState, Field, Icon, PageHeader, Badge, Progress } from "@/components/ui";
import { Money } from "@/components/money";
import { DeleteForm, EditPanel } from "@/components/record-actions";
import { createLand, deleteLand, updateLand } from "@/app/actions";

export const dynamic = "force-dynamic";

const IRRIGATION = ["بارانی", "قطره‌ای", "غرقابی", "دیم", "چاه و پمپ"];

export default async function LandsPage() {
  const o = await getFarmOverview();
  const totalArea = o.totals.landArea;

  const landFields = (d: {
    id?: number;
    name?: string;
    areaHa?: number;
    region?: string;
    soilType?: string;
    irrigation?: string;
    ownership?: string;
    sharePercent?: number;
    notes?: string;
  }) => (
    <>
      {d.id ? <input type="hidden" name="id" value={d.id} /> : null}
      <Field label="نام زمین / قطعه *">
        <input name="name" required defaultValue={d.name ?? ""} placeholder="مثلاً زمین شمالی" className="input" />
      </Field>
      <Field label="مساحت (هکتار)">
        <input name="areaHa" type="number" step="0.1" min="0" defaultValue={d.areaHa ?? ""} className="input num" />
      </Field>
      <Field label="منطقه / روستا">
        <input name="region" defaultValue={d.region ?? ""} placeholder="دشت مغان" className="input" />
      </Field>
      <Field label="نوع خاک">
        <input name="soilType" defaultValue={d.soilType ?? ""} placeholder="لومی" className="input" />
      </Field>
      <Field label="روش آبیاری">
        <select name="irrigation" className="input" defaultValue={d.irrigation ?? "بارانی"}>
          {IRRIGATION.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="نوع مالکیت">
        <select name="ownership" className="input" defaultValue={d.ownership ?? "owned"}>
          <option value="owned">ملکی</option>
          <option value="leased">اجاره‌ای</option>
          <option value="shared">مشارکتی (مزارعه)</option>
        </select>
      </Field>
      <Field label="درصد سهم شما" hint="برای زمین مشارکتی مهم است.">
        <input name="sharePercent" type="number" min="0" max="100" defaultValue={d.sharePercent ?? 100} className="input num" />
      </Field>
      <Field label="یادداشت" className="sm:col-span-2">
        <input name="notes" defaultValue={d.notes ?? ""} placeholder="تناوب کشت، وضعیت چاه، ..." className="input" />
      </Field>
    </>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="زمین‌ها و قطعات کشاورزی"
        subtitle="هر قطعه را ثبت، ویرایش یا حذف کنید تا هزینه و سود همان قطعه دقیق محاسبه شود."
        icon="land"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="card-pad">
          <span className="text-[11px] text-[#6a7a6d]">تعداد قطعات</span>
          <p className="num mt-1 text-lg font-extrabold text-farm-900">{formatNumber(o.landStats.length)}</p>
        </Card>
        <Card className="card-pad">
          <span className="text-[11px] text-[#6a7a6d]">سطح کل</span>
          <p className="num mt-1 text-lg font-extrabold text-farm-900">{formatNumber(totalArea, 1)} هکتار</p>
        </Card>
        <Card className="card-pad">
          <span className="text-[11px] text-[#6a7a6d]">درآمد کل قطعات</span>
          <Money value={o.totals.income} tone="income" size="md" className="mt-1" />
        </Card>
        <Card className="card-pad">
          <span className="text-[11px] text-[#6a7a6d]">هزینه کل قطعات</span>
          <Money value={o.totals.expense} tone="expense" size="md" className="mt-1" />
        </Card>
      </div>

      <Disclosure title="ثبت زمین یا قطعه جدید">
        <form action={createLand} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {landFields({})}
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" className="btn btn-primary w-full sm:w-auto">
              <Icon name="plus" className="h-4 w-4" />
              ثبت زمین
            </button>
          </div>
        </form>
      </Disclosure>

      <div className="grid gap-3 lg:grid-cols-2">
        {o.landStats.map(({ land, income, expense, profit, activeCrops, costPerHa, incomePerHa }) => (
          <Card key={land.id} className="card-pad">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link href={`/lands/${land.id}`} className="flex items-center gap-2 text-sm font-bold text-farm-900 hover:underline">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-farm-50 text-farm-700">
                    <Icon name="land" className="h-4 w-4" />
                  </span>
                  {land.name}
                </Link>
                <p className="num mt-1.5 text-[11px] text-[#7c8a7f]">
                  {formatNumber(land.areaHa, 1)} هکتار · {land.region || "منطقه نامشخص"} · {land.irrigation || "آبیاری نامشخص"}
                </p>
              </div>
              <Badge tone={land.ownership === "shared" ? "blue" : land.ownership === "leased" ? "amber" : "green"}>
                {land.ownership === "shared" ? `مشارکتی ${formatNumber(land.sharePercent)}٪` : land.ownership === "leased" ? "اجاره‌ای" : "ملکی"}
              </Badge>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-farm-50 px-2 py-2">
                <span className="block text-[10px] text-farm-700">درآمد</span>
                <Money value={income} tone="income" size="xs" />
              </div>
              <div className="rounded-xl bg-[#fdf2e7] px-2 py-2">
                <span className="block text-[10px] text-clay-600">هزینه</span>
                <Money value={expense} tone="expense" size="xs" />
              </div>
              <div className={`rounded-xl px-2 py-2 ${profit >= 0 ? "bg-farm-50" : "bg-red-50"}`}>
                <span className="block text-[10px] text-[#6a7a6d]">سود</span>
                <Money value={profit} tone={profit >= 0 ? "profit" : "expense"} size="xs" />
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2 text-[11px] text-[#6a7a6d]">
                <span>هزینه هر هکتار</span>
                <Money value={Math.round(costPerHa)} size="xs" showWords={false} />
              </div>
              <Progress value={incomePerHa + costPerHa > 0 ? incomePerHa / (incomePerHa + costPerHa) : 0} tone={profit >= 0 ? "farm" : "red"} />
              <div className="flex items-center justify-between text-[11px] text-[#6a7a6d]">
                <span>کشت‌های فعال: {formatNumber(activeCrops)}</span>
                <span>{land.soilType || "—"}</span>
              </div>
              <p className="num text-[10px] text-[#84907f]">
                سود خالص: {formatMoney(profit)} ({formatMoneyWords(profit)})
              </p>
            </div>

            {land.notes ? <p className="mt-2 rounded-xl bg-sand-50 px-3 py-2 text-[11px] leading-5 text-[#5b6a5e]">{land.notes}</p> : null}

            <div className="mt-3 flex items-center justify-between gap-2">
              <Link href={`/lands/${land.id}`} className="btn btn-sm">
                جزئیات و کشت‌ها
                <Icon name="arrow" className="h-3.5 w-3.5" />
              </Link>
              <DeleteForm
                action={deleteLand}
                id={land.id}
                label="حذف زمین"
                variant="button"
                confirmText={`زمین «${land.name}» و کشت‌های مرتبط آن حذف شود؟`}
              />
            </div>

            <EditPanel title="ویرایش زمین">
              <form action={updateLand} className="grid gap-2 sm:grid-cols-2">
                {landFields({
                  id: land.id,
                  name: land.name,
                  areaHa: land.areaHa,
                  region: land.region,
                  soilType: land.soilType,
                  irrigation: IRRIGATION.includes(land.irrigation) ? land.irrigation : "بارانی",
                  ownership: land.ownership,
                  sharePercent: land.sharePercent,
                  notes: land.notes,
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
        ))}
      </div>

      {!o.landStats.length ? (
        <EmptyState title="هنوز زمینی ثبت نشده است" hint="با فرم بالا اولین قطعه را اضافه کنید یا از دستیار هوشمند بخواهید ثبت کند." />
      ) : null}

      <Card className="card-pad bg-sand-50">
        <p className="text-xs leading-6 text-[#5b6a5e]">
          💡 نکته: هزینه‌های مستقیماً مرتبط با یک زمین را هنگام ثبت، به همان زمین و کشت نسبت دهید. وضعیت {statusLabel("shared")} یعنی محصول طبق درصد توافق
          تقسیم می‌شود. هر قطعه با دکمهٔ «حذف زمین» یا فرم «ویرایش زمین» قابل اصلاح است.
        </p>
      </Card>
    </div>
  );
}
