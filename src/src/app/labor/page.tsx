import { getCrops, getLabor, getLands, getWorkers } from "@/lib/data";
import { formatDate, formatMoney, formatMoneyWords, formatNumber, todayISO } from "@/lib/format";
import { Badge, Card, Disclosure, EmptyState, Field, Icon, PageHeader, StatCard } from "@/components/ui";
import { Money } from "@/components/money";
import { AmountInput } from "@/components/forms";
import { DeleteForm, EditPanel } from "@/components/record-actions";
import {
  createLabor,
  createWorker,
  deleteLabor,
  deleteWorker,
  toggleLaborPaid,
  updateLabor,
  updateWorker,
} from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function LaborPage() {
  const [workers, logs, lands, crops] = await Promise.all([getWorkers(), getLabor(160), getLands(), getCrops()]);
  const paid = logs.filter((l) => l.paid).reduce((a, l) => a + l.amount, 0);
  const unpaid = logs.filter((l) => !l.paid).reduce((a, l) => a + l.amount, 0);
  const totalDays = logs.reduce((a, l) => a + l.days, 0);

  const workerFields = (d: { id?: number; name?: string; role?: string; phone?: string; dailyWage?: number; active?: boolean }) => (
    <>
      {d.id ? <input type="hidden" name="id" value={d.id} /> : null}
      <Field label="نام و نام خانوادگی *">
        <input name="name" required defaultValue={d.name ?? ""} className="input" placeholder="حسن رضایی" />
      </Field>
      <Field label="نقش">
        <input name="role" defaultValue={d.role ?? ""} className="input" placeholder="کارگر عمومی / اپراتور تراکتور" />
      </Field>
      <Field label="تلفن">
        <input name="phone" defaultValue={d.phone ?? ""} className="input num" inputMode="tel" placeholder="0915..." />
      </Field>
      <Field label="دستمزد روزانه به ریال" hint={d.id ? `حروفی: ${formatMoneyWords(d.dailyWage ?? 0)}` : undefined}>
        <AmountInput name="dailyWage" defaultValue={d.dailyWage} placeholder="13,000,000" />
      </Field>
      {d.id ? (
        <label className="flex items-center gap-2 text-xs text-[#5b6a5e] sm:col-span-2">
          <input type="checkbox" name="active" defaultChecked={d.active ?? true} className="h-4 w-4 accent-farm-600" />
          این کارگر فعال است
        </label>
      ) : null}
    </>
  );

  const laborFields = (d: {
    id?: number;
    workerId?: number | null;
    workerName?: string;
    days?: number;
    dailyWage?: number;
    landId?: number | null;
    cropId?: number | null;
    date?: string;
    task?: string;
    paid?: boolean;
  }) => (
    <>
      {d.id ? <input type="hidden" name="id" value={d.id} /> : null}
      <Field label="کارگر (از لیست)">
        <select name="workerId" className="input" defaultValue={d.workerId ?? ""}>
          <option value="">— کارگر لیست‌نشده —</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} — {w.role}
            </option>
          ))}
        </select>
      </Field>
      <Field label="نام کارگر (اگر در لیست نیست)">
        <input name="workerName" defaultValue={d.workerName ?? ""} className="input" placeholder="کارگر فصلی" />
      </Field>
      <Field label="تعداد روز *">
        <input name="days" required type="number" step="0.5" min="0.5" defaultValue={d.days ?? 1} className="input num" />
      </Field>
      <Field label="دستمزد روزانه به ریال *" hint={d.id ? `حروفی: ${formatMoneyWords(d.dailyWage ?? 0)}` : undefined}>
        <AmountInput name="dailyWage" defaultValue={d.dailyWage} required placeholder="13,000,000" />
      </Field>
      <Field label="زمین">
        <select name="landId" className="input" defaultValue={d.landId ?? ""}>
          <option value="">بدون زمین</option>
          {lands.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="کشت">
        <select name="cropId" className="input" defaultValue={d.cropId ?? ""}>
          <option value="">بدون کشت</option>
          {crops.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.landName}
            </option>
          ))}
        </select>
      </Field>
      <Field label="تاریخ">
        <input name="date" type="date" defaultValue={d.date ?? todayISO()} className="input num" />
      </Field>
      <Field label="نوع کار">
        <input name="task" defaultValue={d.task ?? ""} className="input" placeholder="وجین، برداشت، سم‌پاشی..." />
      </Field>
      <label className="flex items-center gap-2 text-xs text-[#5b6a5e] sm:col-span-2">
        <input type="checkbox" name="paid" defaultChecked={d.paid ?? false} className="h-4 w-4 accent-farm-600" />
        دستمزد پرداخت شده است
      </label>
    </>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="کارگران و دستمزد"
        subtitle="نفر-روز، دستمزد روزانه و وضعیت تسویه را ثبت کنید. هر کارگر و هر دستمزد قابل ویرایش و حذف است."
        icon="users"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="کارگران ثبت‌شده" value={formatNumber(workers.length)} tone="slate" icon="users" />
        <StatCard label="نفر-روز ثبت‌شده" value={formatNumber(totalDays, 1)} tone="farm" icon="calendar" />
        <StatCard label="دستمزد پرداخت‌شده" value={formatMoney(paid)} hint={formatMoneyWords(paid)} tone="farm" icon="check" />
        <StatCard label="دستمزد پرداخت‌نشده" value={formatMoney(unpaid)} hint={formatMoneyWords(unpaid)} tone={unpaid ? "red" : "farm"} icon="alert" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Disclosure title="ثبت کارگر جدید">
          <form action={createWorker} className="grid gap-3 sm:grid-cols-2">
            {workerFields({})}
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
            {laborFields({})}
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
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {workers.map((w) => (
              <div key={w.id} className="rounded-xl border border-[#f0ebdd] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-farm-900">{w.name}</p>
                    <p className="mt-0.5 text-[10px] text-[#7c8a7f]">
                      {w.role} {w.active ? "" : "· غیرفعال"}
                    </p>
                  </div>
                  <DeleteForm action={deleteWorker} id={w.id} label="حذف کارگر" confirmText={`کارگر «${w.name}» حذف شود؟ دستمزدهای ثبت‌شده حفظ می‌شوند.`} />
                </div>
                <Money value={w.dailyWage} size="xs" className="mt-1" />
                {w.phone ? <p className="num mt-1 text-[10px] text-[#84907f]">{w.phone}</p> : null}
                <EditPanel title="ویرایش کارگر">
                  <form action={updateWorker} className="grid gap-2">
                    {workerFields({ id: w.id, name: w.name, role: w.role, phone: w.phone, dailyWage: w.dailyWage, active: w.active })}
                    <button type="submit" className="btn btn-primary btn-sm w-full">
                      <Icon name="check" className="h-3.5 w-3.5" />
                      ذخیره
                    </button>
                  </form>
                </EditPanel>
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
                <th>عملیات</th>
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
                  <td>
                    <Money value={l.dailyWage} size="xs" />
                  </td>
                  <td>
                    <Money value={l.amount} size="xs" tone="expense" />
                  </td>
                  <td>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={l.paid ? "green" : "red"}>{l.paid ? "پرداخت‌شده" : "پرداخت‌نشده"}</Badge>
                      <form action={toggleLaborPaid}>
                        <input type="hidden" name="id" value={l.id} />
                        <button type="submit" className="text-[10px] font-semibold text-farm-700 hover:underline">
                          {l.paid ? "برگشت به پرداخت‌نشده" : "تسویه کن"}
                        </button>
                      </form>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <EditPanel title="ویرایش دستمزد">
                        <form action={updateLabor} className="grid gap-2 sm:grid-cols-2">
                          {laborFields({
                            id: l.id,
                            workerId: l.workerId,
                            workerName: l.workerName,
                            days: l.days,
                            dailyWage: l.dailyWage,
                            landId: l.landId,
                            cropId: l.cropId,
                            date: l.date,
                            task: l.task,
                            paid: l.paid,
                          })}
                          <div className="sm:col-span-2">
                            <button type="submit" className="btn btn-primary w-full sm:w-auto">
                              <Icon name="check" className="h-4 w-4" />
                              ذخیره ویرایش
                            </button>
                          </div>
                        </form>
                      </EditPanel>
                      <DeleteForm
                        action={deleteLabor}
                        id={l.id}
                        label="حذف دستمزد"
                        confirmText={`دستمزد ${l.workerName} به مبلغ ${formatMoney(l.amount)} حذف شود؟`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!logs.length ? (
          <div className="p-4">
            <EmptyState title="دستمزدی ثبت نشده" />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
