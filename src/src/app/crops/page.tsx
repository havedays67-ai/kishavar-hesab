import Link from "next/link";
import { getCrops, getFarmOverview, getLands } from "@/lib/data";
import { formatDate, formatMoney, formatMoneyWords, formatNumber, statusLabel, todayISO } from "@/lib/format";
import { Badge, Card, Disclosure, EmptyState, Field, Icon, PageHeader, StatCard } from "@/components/ui";
import { Money } from "@/components/money";
import { DeleteForm, EditPanel } from "@/components/record-actions";
import { createCrop, deleteCrop, updateCrop } from "@/app/actions";

export const dynamic = "force-dynamic";

const SEASONS = ["بهار", "تابستان", "پاییز", "زمستان", "کشت پاییزه", "کشت بهاره"];

export default async function CropsPage() {
  const [cropRows, lands, o] = await Promise.all([getCrops(), getLands(), getFarmOverview()]);
  const statsById = new Map(o.cropStats.map((cs) => [cs.crop.id, cs]));

  const fields = (d: {
    id?: number;
    landId?: number;
    name?: string;
    variety?: string;
    season?: string;
    plantingDate?: string | null;
    harvestDate?: string | null;
    expectedYieldKg?: number;
    actualYieldKg?: number;
    status?: string;
    notes?: string;
  }) => (
    <>
      {d.id ? <input type="hidden" name="id" value={d.id} /> : null}
      <Field label="زمین *">
        <select name="landId" required className="input" defaultValue={d.landId ?? ""}>
          <option value="" disabled>
            انتخاب زمین
          </option>
          {lands.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({formatNumber(l.areaHa, 1)} هکتار)
            </option>
          ))}
        </select>
      </Field>
      <Field label="نام محصول *">
        <input name="name" required defaultValue={d.name ?? ""} className="input" placeholder="گندم، جو، پنبه..." />
      </Field>
      <Field label="رقم / واریته">
        <input name="variety" defaultValue={d.variety ?? ""} className="input" placeholder="چمران، گلدشت..." />
      </Field>
      <Field label="فصل">
        <select name="season" className="input" defaultValue={d.season ?? "کشت پاییزه"}>
          {SEASONS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field label="تاریخ کاشت">
        <input name="plantingDate" type="date" defaultValue={d.plantingDate ?? ""} className="input num" />
      </Field>
      <Field label="تاریخ برداشت">
        <input name="harvestDate" type="date" defaultValue={d.harvestDate ?? ""} className="input num" />
      </Field>
      <Field label="برداشت پیش‌بینی‌شده (کیلو)">
        <input name="expectedYieldKg" type="number" step="1" min="0" defaultValue={d.expectedYieldKg ?? ""} className="input num" />
      </Field>
      <Field label="برداشت واقعی (کیلو)">
        <input name="actualYieldKg" type="number" step="1" min="0" defaultValue={d.actualYieldKg ?? ""} className="input num" />
      </Field>
      <Field label="وضعیت">
        <select name="status" className="input" defaultValue={d.status ?? "in_progress"}>
          <option value="planned">برنامه‌ریزی‌شده</option>
          <option value="in_progress">در حال کشت</option>
          <option value="harvested">برداشت‌شده</option>
        </select>
      </Field>
      <Field label="یادداشت" className="sm:col-span-2">
        <input name="notes" defaultValue={d.notes ?? ""} className="input" placeholder="تناوب، مساحت زیر کشت، ..." />
      </Field>
    </>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="کشت‌ها و بهای تمام‌شده"
        subtitle="برای هر کشت، برداشت واقعی را ثبت کنید تا بهای تمام‌شده هر کیلوگرم و سود واقعی محاسبه شود. هر کشت قابل ویرایش و حذف است."
        icon="sprout"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="کشت‌های فعال" value={formatNumber(o.totals.activeCrops)} tone="farm" icon="sprout" />
        <StatCard label="کل برداشت ثبت‌شده" value={`${formatNumber(cropRows.reduce((a, c) => a + c.actualYieldKg, 0))} کیلو`} tone="slate" icon="box" />
        <StatCard label="درآمد محصولات" value={formatMoney(o.totals.income)} hint={formatMoneyWords(o.totals.income)} tone="farm" icon="chart" />
        <StatCard
          label="سود محصولات"
          value={formatMoney(o.totals.profit)}
          hint={formatMoneyWords(o.totals.profit)}
          tone={o.totals.profit >= 0 ? "farm" : "red"}
          icon="wallet"
        />
      </div>

      <Disclosure title="ثبت کشت جدید">
        {lands.length ? (
          <form action={createCrop} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields({ plantingDate: todayISO(), status: "in_progress" })}
            <div className="sm:col-span-2 lg:col-span-3">
              <button type="submit" className="btn btn-primary w-full sm:w-auto">
                <Icon name="plus" className="h-4 w-4" />
                ثبت کشت
              </button>
            </div>
          </form>
        ) : (
          <EmptyState title="ابتدا یک زمین ثبت کنید" hint="کشت به زمین وابسته است؛ از صفحهٔ «زمین و کشت» شروع کنید." />
        )}
      </Disclosure>

      <div className="grid gap-3 lg:grid-cols-2">
        {cropRows.map((crop) => {
          const cs = statsById.get(crop.id);
          const progress = crop.expectedYieldKg > 0 ? crop.actualYieldKg / crop.expectedYieldKg : 0;
          return (
            <Card key={crop.id} className="card-pad">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-farm-900">
                    {crop.name} <span className="text-[11px] font-normal text-[#7c8a7f]">{crop.variety}</span>
                  </p>
                  <p className="num mt-1 text-[11px] text-[#7c8a7f]">
                    {crop.landName} · {crop.season} · کاشت {formatDate(crop.plantingDate)}
                  </p>
                </div>
                <Badge tone={crop.status === "harvested" ? "green" : crop.status === "planned" ? "neutral" : "amber"}>{statusLabel(crop.status)}</Badge>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-farm-50 px-2 py-2">
                  <span className="block text-[10px] text-farm-700">درآمد</span>
                  <Money value={cs?.income ?? 0} size="xs" />
                </div>
                <div className="rounded-xl bg-[#fdf2e7] px-2 py-2">
                  <span className="block text-[10px] text-clay-600">هزینه</span>
                  <Money value={cs?.expense ?? 0} size="xs" />
                </div>
                <div className={`rounded-xl px-2 py-2 ${(cs?.profit ?? 0) >= 0 ? "bg-farm-50" : "bg-red-50"}`}>
                  <span className="block text-[10px] text-[#6a7a6d]">سود</span>
                  <Money value={cs?.profit ?? 0} size="xs" tone={(cs?.profit ?? 0) >= 0 ? "profit" : "expense"} />
                </div>
              </div>

              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[#6a7a6d]">
                  <span>
                    برداشت: {formatNumber(crop.actualYieldKg)} / پیش‌بینی {formatNumber(crop.expectedYieldKg)} کیلو
                  </span>
                  <span>{formatNumber(progress * 100)}٪</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eee9dc]">
                  <div className="h-full rounded-full bg-farm-500" style={{ width: `${Math.min(100, Math.max(2, progress * 100))}%` }} />
                </div>
                <p className="num text-[10px] text-[#84907f]">
                  بهای تمام‌شده هر کیلو: {cs && cs.costPerKg > 0 ? `${formatMoney(Math.round(cs.costPerKg))} (${formatMoneyWords(Math.round(cs.costPerKg))})` : "—"}
                </p>
                <p className="num text-[10px] text-[#84907f]">
                  درآمد هر هکتار: {cs && cs.revenuePerHa > 0 ? formatMoney(Math.round(cs.revenuePerHa)) : "—"}
                </p>
              </div>

              {crop.notes ? <p className="mt-2 rounded-xl bg-sand-50 px-3 py-2 text-[11px] text-[#5b6a5e]">{crop.notes}</p> : null}

              <div className="mt-3 flex items-center justify-between gap-2">
                <Link href={`/lands/${crop.landId}`} className="btn btn-sm">
                  زمین مربوطه
                  <Icon name="arrow" className="h-3.5 w-3.5" />
                </Link>
                <DeleteForm action={deleteCrop} id={crop.id} label="حذف کشت" variant="button" confirmText={`کشت «${crop.name}» حذف شود؟`} />
              </div>

              <EditPanel title="ویرایش کشت">
                <form action={updateCrop} className="grid gap-2 sm:grid-cols-2">
                  {fields({
                    id: crop.id,
                    landId: crop.landId,
                    name: crop.name,
                    variety: crop.variety,
                    season: crop.season,
                    plantingDate: crop.plantingDate,
                    harvestDate: crop.harvestDate,
                    expectedYieldKg: crop.expectedYieldKg,
                    actualYieldKg: crop.actualYieldKg,
                    status: crop.status,
                    notes: crop.notes,
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

      {!cropRows.length ? <EmptyState title="کشتی ثبت نشده" hint="اولین کشت را با فرم بالا اضافه کنید." /> : null}
    </div>
  );
}
