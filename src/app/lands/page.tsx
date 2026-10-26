import Link from "next/link";
import { getFarmOverview } from "@/lib/data";
import { formatMoney, formatNumber, statusLabel } from "@/lib/format";
import { Card, Disclosure, EmptyState, Field, Icon, PageHeader, Badge, Progress } from "@/components/ui";
import { createLand, deleteLand } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function LandsPage() {
  const o = await getFarmOverview();
  const totalArea = o.totals.landArea;

  return (
    <div className="space-y-4">
      <PageHeader
        title="زمین‌ها و قطعات کشاورزی"
        subtitle="هر قطعه را با مساحت، نوع مالکیت و روش آبیاری ثبت کنید تا هزینه و سود همان قطعه دقیق محاسبه شود."
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
          <p className="num mt-1 text-lg font-extrabold text-farm-700">{formatMoney(o.totals.income)}</p>
        </Card>
        <Card className="card-pad">
          <span className="text-[11px] text-[#6a7a6d]">هزینه کل قطعات</span>
          <p className="num mt-1 text-lg font-extrabold text-clay-600">{formatMoney(o.totals.expense)}</p>
        </Card>
      </div>

      <Disclosure title="ثبت زمین یا قطعه جدید">
        <form action={createLand} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="نام زمین / قطعه *">
            <input name="name" required placeholder="مثلاً زمین شمالی" className="input" />
          </Field>
          <Field label="مساحت (هکتار)">
            <input name="areaHa" type="number" step="0.1" min="0" placeholder="12.5" className="input num" />
          </Field>
          <Field label="منطقه / روستا">
            <input name="region" placeholder="دشت مغان" className="input" />
          </Field>
          <Field label="نوع خاک">
            <input name="soilType" placeholder="لومی" className="input" />
          </Field>
          <Field label="روش آبیاری">
            <select name="irrigation" className="input" defaultValue="بارانی">
              <option>بارانی</option>
              <option>قطره‌ای</option>
              <option>غرقابی</option>
              <option>دیم</option>
              <option>چاه و پمپ</option>
            </select>
          </Field>
          <Field label="نوع مالکیت">
            <select name="ownership" className="input" defaultValue="owned">
              <option value="owned">ملکی</option>
              <option value="leased">اجاره‌ای</option>
              <option value="shared">مشارکتی (مزارعه)</option>
            </select>
          </Field>
          <Field label="درصد سهم شما" hint="برای زمین مشارکتی مهم است.">
            <input name="sharePercent" type="number" min="0" max="100" defaultValue={100} className="input num" />
          </Field>
          <Field label="یادداشت" className="sm:col-span-2">
            <input name="notes" placeholder="تناوب کشت، وضعیت چاه، ..." className="input" />
          </Field>
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
                <span className="num block text-xs font-bold text-farm-800">{formatMoney(income)}</span>
              </div>
              <div className="rounded-xl bg-[#fdf2e7] px-2 py-2">
                <span className="block text-[10px] text-clay-600">هزینه</span>
                <span className="num block text-xs font-bold text-clay-600">{formatMoney(expense)}</span>
              </div>
              <div className={`rounded-xl px-2 py-2 ${profit >= 0 ? "bg-farm-50" : "bg-red-50"}`}>
                <span className="block text-[10px] text-[#6a7a6d]">سود</span>
                <span className={`num block text-xs font-bold ${profit >= 0 ? "text-farm-800" : "text-red-600"}`}>{formatMoney(profit)}</span>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#6a7a6d]">
                <span>هزینه هر هکتار</span>
                <span className="num font-semibold text-[#2b3a2e]">{formatMoney(Math.round(costPerHa))} تومان</span>
              </div>
              <Progress value={incomePerHa + costPerHa > 0 ? incomePerHa / (incomePerHa + costPerHa) : 0} tone={profit >= 0 ? "farm" : "red"} />
              <div className="flex items-center justify-between text-[11px] text-[#6a7a6d]">
                <span>کشت‌های فعال: {formatNumber(activeCrops)}</span>
                <span>{land.soilType || "—"}</span>
              </div>
            </div>

            {land.notes ? <p className="mt-2 rounded-xl bg-sand-50 px-3 py-2 text-[11px] leading-5 text-[#5b6a5e]">{land.notes}</p> : null}

            <div className="mt-3 flex items-center justify-between gap-2">
              <Link href={`/lands/${land.id}`} className="btn btn-sm">
                جزئیات و کشت‌ها
                <Icon name="arrow" className="h-3.5 w-3.5" />
              </Link>
              <form action={deleteLand}>
                <input type="hidden" name="id" value={land.id} />
                <button type="submit" className="btn btn-sm text-red-600" title="حذف زمین و کشت‌های مرتبط">
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </Card>
        ))}
      </div>

      {!o.landStats.length ? (
        <EmptyState title="هنوز زمینی ثبت نشده است" hint="با فرم بالا اولین قطعه را اضافه کنید یا از دستیار هوشمند بخواهید ثبت کند." />
      ) : null}

      <Card className="card-pad bg-sand-50">
        <p className="text-xs leading-6 text-[#5b6a5e]">
          💡 نکته حسابداری: هزینه‌های مشترک بین قطعات (مثل استهلاک تراکتور) را می‌توانید در «هزینه متفرقه» ثبت کنید؛ اما برای تحلیل دقیق سود هر قطعه،
          هزینه‌هایی که مستقیماً مربوط به یک زمین است را هنگام ثبت، زمین و کشت مربوطه را انتخاب کنید. وضعیت مالکیت: {statusLabel("shared")} یعنی محصول طبق درصد
          توافق تقسیم می‌شود.
        </p>
      </Card>
    </div>
  );
}
