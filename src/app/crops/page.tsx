import Link from "next/link";
import { getCrops, getFarmOverview, getLands, listTransactions } from "@/lib/data";
import { formatDate, formatMoney, formatMoneyWords, formatNumber, statusLabel } from "@/lib/format";
import { Badge, Card, Disclosure, EmptyState, Field, Icon, PageHeader, StatCard } from "@/components/ui";
import { createCrop, updateCrop } from "@/app/actions";
import { RecordActions } from "@/components/RecordActions";

export const dynamic = "force-dynamic";

export default async function CropsPage() {
  const [cropRows, lands, o, txnRows] = await Promise.all([getCrops(), getLands(), getFarmOverview(), listTransactions({ limit: 1000 })]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="کشت‌ها و بهای تمام‌شده"
        subtitle="برای هر کشت، برداشت واقعی را ثبت کنید تا بهای تمام‌شده هر کیلوگرم و سود واقعی محاسبه شود."
        icon="sprout"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="کشت‌های فعال" value={formatNumber(o.totals.activeCrops)} tone="farm" icon="sprout" />
        <StatCard label="کل برداشت ثبت‌شده" value={`${formatNumber(cropRows.reduce((a, c) => a + c.actualYieldKg, 0))} کیلو`} tone="slate" icon="box" />
        <StatCard label="درآمد محصولات" value={formatMoney(o.totals.income)} hint={formatMoneyWords(o.totals.income)} tone="farm" icon="chart" />
        <StatCard label="سود محصولات" value={formatMoney(o.totals.profit)} hint={formatMoneyWords(o.totals.profit)} tone={o.totals.profit >= 0 ? "farm" : "red"} icon="wallet" />
      </div>

      <Disclosure title="ثبت کشت جدید">
        {lands.length ? (
          <form action={createCrop} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="زمین *">
              <select name="landId" required className="input">
                {lands.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({formatNumber(l.areaHa, 1)} هکتار)
                  </option>
                ))}
              </select>
            </Field>
            <Field label="نام محصول *">
              <input name="name" required placeholder="گندم / زعفران / گوجه" className="input" />
            </Field>
            <Field label="رقم یا رقم بومی">
              <input name="variety" placeholder="چمران" className="input" />
            </Field>
            <Field label="فصل">
              <select name="season" className="input" defaultValue="بهار">
                <option>بهار</option>
                <option>تابستان</option>
                <option>پاییز</option>
                <option>زمستان</option>
                <option>چندساله</option>
              </select>
            </Field>
            <Field label="تاریخ کاشت">
              <input name="plantingDate" type="date" className="input" />
            </Field>
            <Field label="تاریخ برداشت">
              <input name="harvestDate" type="date" className="input" />
            </Field>
            <Field label="برداشت پیش‌بینی‌شده (کیلوگرم)">
              <input name="expectedYieldKg" type="number" min="0" step="1" className="input num" />
            </Field>
            <Field label="برداشت واقعی (کیلوگرم)">
              <input name="actualYieldKg" type="number" min="0" step="1" className="input num" />
            </Field>
            <Field label="وضعیت">
              <select name="status" className="input" defaultValue="in_progress">
                <option value="planned">برنامه‌ریزی‌شده</option>
                <option value="in_progress">در حال کشت</option>
                <option value="harvested">برداشت‌شده</option>
              </select>
            </Field>
            <Field label="یادداشت" className="sm:col-span-2">
              <input name="notes" className="input" placeholder="آبیاری، کوددهی، ..." />
            </Field>
            <div className="flex items-end">
              <button type="submit" className="btn btn-primary w-full">
                <Icon name="plus" className="h-4 w-4" />
                ثبت کشت
              </button>
            </div>
          </form>
        ) : (
          <EmptyState title="ابتدا یک زمین ثبت کنید" hint="بدون زمین نمی‌توان کشت ثبت کرد." />
        )}
      </Disclosure>

      <div className="grid gap-3 lg:grid-cols-2">
        {cropRows.map((crop) => {
          const cs = o.cropStats.find((c) => c.crop.id === crop.id);
          const cropTxns = txnRows.filter((t) => t.cropId === crop.id);
          return (
            <Card key={crop.id} className="card-pad">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-farm-900">
                    {crop.name} {crop.variety ? <span className="text-[11px] font-medium text-[#7c8a7f]">· {crop.variety}</span> : null}
                  </h3>
                  <p className="num mt-1 text-[11px] text-[#7c8a7f]">
                    {crop.landName} · {formatNumber(crop.landAreaHa ?? 0, 1)} هکتار · {crop.season}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge tone={crop.status === "harvested" ? "green" : crop.status === "planned" ? "neutral" : "amber"}>{statusLabel(crop.status)}</Badge>
                  <RecordActions entity="crops" id={crop.id} label={`کشت ${crop.name}`} />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div className="rounded-xl bg-farm-50 px-2 py-2">
                  <span className="block text-[10px] text-farm-700">درآمد</span>
                  <span className="num block text-[11px] font-bold text-farm-800">{formatMoney(cs?.income ?? 0)}</span>
                  <span className="mt-0.5 block text-[9px] text-[#84907f]">{formatMoneyWords(cs?.income ?? 0)}</span>
                </div>
                <div className="rounded-xl bg-[#fdf2e7] px-2 py-2">
                  <span className="block text-[10px] text-clay-600">هزینه</span>
                  <span className="num block text-[11px] font-bold text-clay-600">{formatMoney(cs?.expense ?? 0)}</span>
                  <span className="mt-0.5 block text-[9px] text-[#84907f]">{formatMoneyWords(cs?.expense ?? 0)}</span>
                </div>
                <div className={`rounded-xl px-2 py-2 ${(cs?.profit ?? 0) >= 0 ? "bg-farm-50" : "bg-red-50"}`}>
                  <span className="block text-[10px] text-[#6a7a6d]">سود</span>
                  <span className="num block text-[11px] font-bold">{formatMoney(cs?.profit ?? 0)}</span>
                </div>
                <div className="rounded-xl bg-sand-100 px-2 py-2">
                  <span className="block text-[10px] text-[#6a7a6d]">بهای هر کیلو</span>
                  <span className="num block text-[11px] font-bold">{cs?.costPerKg ? formatMoney(Math.round(cs.costPerKg)) : "—"}</span>
                </div>
              </div>

              <div className="num mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#7c8a7f]">
                <span>کاشت: {formatDate(crop.plantingDate)}</span>
                <span>برداشت: {formatDate(crop.harvestDate)}</span>
                <span>پیش‌بینی: {formatNumber(crop.expectedYieldKg)} کیلو</span>
                <span>واقعی: {formatNumber(crop.actualYieldKg)} کیلو</span>
                <span>{formatNumber(cropTxns.length)} رکورد مالی</span>
              </div>

              <details className="mt-3 rounded-xl bg-sand-50 p-2">
                <summary className="cursor-pointer text-[11px] font-semibold text-farm-800">به‌روزرسانی برداشت و وضعیت</summary>
                <form action={updateCrop} className="mt-2 grid gap-2 sm:grid-cols-3">
                  <input type="hidden" name="id" value={crop.id} />
                  <Field label="برداشت واقعی (کیلو)">
                    <input name="actualYieldKg" type="number" min="0" defaultValue={crop.actualYieldKg} className="input num" />
                  </Field>
                  <Field label="تاریخ برداشت">
                    <input name="harvestDate" type="date" defaultValue={crop.harvestDate ?? ""} className="input num" />
                  </Field>
                  <Field label="وضعیت">
                    <select name="status" className="input" defaultValue={crop.status}>
                      <option value="planned">برنامه‌ریزی‌شده</option>
                      <option value="in_progress">در حال کشت</option>
                      <option value="harvested">برداشت‌شده</option>
                    </select>
                  </Field>
                  <div className="sm:col-span-3 flex items-center justify-between gap-2">
                    <button type="submit" className="btn btn-primary btn-sm">
                      <Icon name="check" className="h-3.5 w-3.5" />
                      ذخیره
                    </button>
                    <Link href={`/transactions?cropId=${crop.id}`} className="link-quiet">
                      تراکنش‌های این کشت ←
                    </Link>
                  </div>
                </form>
                <div className="mt-2 border-t border-[#e7e2d3] pt-2 text-[10px] text-[#84907f]">
                  برای ویرایش کامل مشخصات یا حذف کشت از دکمه‌های کنار وضعیت در بالای کارت استفاده کنید.
                </div>
              </details>
            </Card>
          );
        })}
      </div>

      {!cropRows.length ? <EmptyState title="کشتی ثبت نشده است" hint="با فرم بالا کشت جدید اضافه کنید." /> : null}

      <Card className="card-pad bg-sand-50">
        <p className="text-xs leading-6 text-[#5b6a5e]">
          💡 فرمول بهای تمام‌شده: مجموع هزینه‌های همین کشت ÷ برداشت واقعی (کیلوگرم). اگر قیمت فروش شما کمتر از این عدد باشد، فروش هر کیلو زیان‌ده است. برای
          محصولات چندساله مثل زعفران، هزینه سال‌های قبل را هم در تحلیل لحاظ کنید.
        </p>
      </Card>
    </div>
  );
}
