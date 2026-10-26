import { getCrops, getLabor, getLands, getWorkers } from "@/lib/data";
import { formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format";
import { Badge, Card, Disclosure, EmptyState, Field, Icon, PageHeader, StatCard } from "@/components/ui";
import { createLabor, createWorker, deleteLabor, toggleLaborPaid } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function LaborPage() {
  const [workers, logs, lands, crops] = await Promise.all([getWorkers(), getLabor(160), getLands(), getCrops()]);
  const paid = logs.filter((l) => l.paid).reduce((a, l) => a + l.amount, 0);
  const unpaid = logs.filter((l) => !l.paid).reduce((a, l) => a + l.amount, 0);
  const totalDays = logs.reduce((a, l) => a + l.days, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="کارگران و دستمزد"
        subtitle="نفر-روز، دستمزد روزانه و وضعیت تسویه را ثبت کنید. دستمزد پرداخت‌نشده بخشی از بدهی جاری مزرعه است."
        icon="users"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="کارگران ثبت‌شده" value={formatNumber(workers.length)} tone="slate" icon="users" />
        <StatCard label="نفر-روز ثبت‌شده" value={formatNumber(totalDays, 1)} tone="farm" icon="calendar" />
        <StatCard label="دستمزد پرداخت‌شده" value={`${formatMoney(paid)} تومان`} tone="farm" icon="check" />
        <StatCard label="دستمزد پرداخت‌نشده" value={`${formatMoney(unpaid)} تومان`} tone={unpaid ? "red" : "farm"} icon="alert" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Disclosure title="ثبت کارگر جدید">
          <form action={createWorker} className="grid gap-3 sm:grid-cols-2">
            <Field label="نام و نام خانوادگی *">
              <input name="name" required className="input" placeholder="حسن رضایی" />
            </Field>
            <Field label="نقش">
              <input name="role" className="input" placeholder="کارگر عمومی / اپراتور تراکتور" />
            </Field>
            <Field label="تلفن">
              <input name="phone" className="input num" inputMode="tel" placeholder="0915..." />
            </Field>
            <Field label="دستمزد روزانه (تومان)">
              <input name="dailyWage" inputMode="numeric" className="input num" placeholder="1300000" />
            </Field>
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary w-full sm:w-auto">
                <Icon name="plus" className="h-4 w-4" />
                ثبت کارگر
              </button>
            </div>
          </form>
        </Disclosure>

        <Disclosure title="ثبت دستمزد / نفر-روز">
          <form action={createLabor} className="grid gap-3 sm:grid-cols-2">
            <Field label="کارگر *">
              <select name="workerId" required className="input">
                <option value="">انتخاب کنید</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} — {w.role} ({formatMoney(w.dailyWage)})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="نام کارگر (اگر در لیست نیست)">
              <input name="workerName" className="input" placeholder="کارگر فصلی" />
            </Field>
            <Field label="تعداد روز *">
              <input name="days" required type="number" step="0.5" min="0.5" defaultValue={1} className="input num" />
            </Field>
            <Field label="دستمزد روزانه (تومان) *">
              <input name="dailyWage" required inputMode="numeric" className="input num" placeholder="1300000" />
            </Field>
            <Field label="زمین">
              <select name="landId" className="input" defaultValue="">
                <option value="">بدون زمین</option>
                {lands.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="کشت">
              <select name="cropId" className="input" defaultValue="">
                <option value="">بدون کشت</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.landName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="تاریخ">
              <input name="date" type="date" defaultValue={todayISO()} className="input num" />
            </Field>
            <Field label="نوع کار">
              <input name="task" className="input" placeholder="وجین، برداشت، سم‌پاشی..." />
            </Field>
            <label className="flex items-center gap-2 text-xs text-[#5b6a5e] sm:col-span-2">
              <input type="checkbox" name="paid" className="h-4 w-4 accent-farm-600" />
              دستمزد همین حالا پرداخت شد
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary w-full sm:w-auto">
                <Icon name="check" className="h-4 w-4" />
                ثبت دستمزد
              </button>
            </div>
          </form>
        </Disclosure>
      </div>

      <Card className="card-pad">
        <h2 className="section-title mb-2">تیم کاری</h2>
        {workers.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {workers.map((w) => (
              <div key={w.id} className="rounded-xl border border-[#f0ebdd] p-3">
                <p className="text-xs font-bold text-farm-900">{w.name}</p>
                <p className="mt-0.5 text-[10px] text-[#7c8a7f]">{w.role}</p>
                <p className="num mt-1 text-[11px] font-semibold text-[#2b3a2e]">{formatMoney(w.dailyWage)} تومان / روز</p>
                {w.phone ? <p className="num mt-0.5 text-[10px] text-[#84907f]">{w.phone}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="کارگری ثبت نشده" />
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>کارگر</th>
                <th>کار</th>
                <th>زمین / کشت</th>
                <th>روز</th>
                <th>دستمزد روز</th>
                <th>جمع</th>
                <th>وضعیت</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="num whitespace-nowrap text-[11px] text-[#7c8a7f]">{formatDate(l.date)}</td>
                  <td className="whitespace-nowrap text-xs font-medium">{l.workerName}</td>
                  <td className="max-w-[160px] truncate text-[11px]">{l.task}</td>
                  <td className="whitespace-nowrap text-[10px] text-[#7c8a7f]">
                    {l.landName ?? "—"} / {l.cropName ?? "—"}
                  </td>
                  <td className="num text-xs">{formatNumber(l.days, 1)}</td>
                  <td className="num whitespace-nowrap text-[11px]">{formatMoney(l.dailyWage)}</td>
                  <td className="num whitespace-nowrap text-xs font-bold">{formatMoney(l.amount)}</td>
                  <td>
                    <Badge tone={l.paid ? "green" : "red"}>{l.paid ? "پرداخت‌شده" : "پرداخت‌نشده"}</Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <form action={toggleLaborPaid}>
                        <input type="hidden" name="id" value={l.id} />
                        <button type="submit" className="btn btn-sm" title={l.paid ? "برگشت به پرداخت‌نشده" : "تسویه"}>
                          <Icon name="check" className="h-3.5 w-3.5" />
                        </button>
                      </form>
                      <form action={deleteLabor}>
                        <input type="hidden" name="id" value={l.id} />
                        <button type="submit" className="text-red-500" title="حذف">
                          <Icon name="trash" className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!logs.length ? <div className="p-4"><EmptyState title="دستمزدی ثبت نشده" /></div> : null}
      </Card>
    </div>
  );
}
