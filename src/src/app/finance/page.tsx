import { getCheques, getDebts, getFarmOverview, getLands, getTasks } from "@/lib/data";
import { daysUntil, formatDate, formatMoney, formatMoneyWords, formatNumber, statusLabel, todayISO } from "@/lib/format";
import { Badge, Card, Disclosure, EmptyState, Field, Icon, PageHeader, StatCard } from "@/components/ui";
import { Money } from "@/components/money";
import { AmountInput } from "@/components/forms";
import { DeleteForm, EditPanel } from "@/components/record-actions";
import {
  createCheque,
  createDebt,
  createTask,
  deleteCheque,
  deleteDebt,
  deleteTask,
  setChequeStatus,
  toggleDebtPaid,
  toggleTask,
  updateCheque,
  updateDebt,
  updateTask,
} from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const [debts, cheques, o, tasks, lands] = await Promise.all([getDebts(), getCheques(), getFarmOverview(), getTasks(), getLands()]);
  const issued = cheques.filter((c) => c.status === "pending" && c.direction === "issued");
  const received = cheques.filter((c) => c.status === "pending" && c.direction === "received");

  const debtFields = (d: {
    id?: number;
    party?: string;
    direction?: string;
    title?: string;
    amount?: number;
    dueDate?: string | null;
    paid?: boolean;
    notes?: string;
  }) => (
    <>
      {d.id ? <input type="hidden" name="id" value={d.id} /> : null}
      <Field label="طرف حساب *">
        <input name="party" required defaultValue={d.party ?? ""} className="input" placeholder="فروشگاه نهاده، بانک، خریدار" />
      </Field>
      <Field label="نوع">
        <select name="direction" className="input" defaultValue={d.direction ?? "payable"}>
          <option value="payable">بدهی ما (پرداختنی)</option>
          <option value="receivable">طلب ما (دریافتنی)</option>
        </select>
      </Field>
      <Field label="مبلغ به ریال *">
        <AmountInput defaultValue={d.amount} required />
      </Field>
      <Field label="سررسید">
        <input name="dueDate" type="date" defaultValue={d.dueDate ?? todayISO()} className="input num" />
      </Field>
      <Field label="بابت">
        <input name="title" defaultValue={d.title ?? ""} className="input" placeholder="خرید نسیه کود و سم" />
      </Field>
      <Field label="یادداشت">
        <input name="notes" defaultValue={d.notes ?? ""} className="input" />
      </Field>
      {d.id ? (
        <label className="flex items-center gap-2 text-xs text-[#5b6a5e] sm:col-span-2">
          <input type="checkbox" name="paid" defaultChecked={d.paid} className="h-4 w-4 accent-farm-600" />
          تسویه شده است
        </label>
      ) : null}
    </>
  );

  const chequeFields = (c: {
    id?: number;
    party?: string;
    direction?: string;
    amount?: number;
    dueDate?: string | null;
    bank?: string;
    serial?: string;
    status?: string;
    notes?: string;
  }) => (
    <>
      {c.id ? <input type="hidden" name="id" value={c.id} /> : null}
      <Field label="طرف حساب *">
        <input name="party" required defaultValue={c.party ?? ""} className="input" placeholder="نام دریافت‌کننده یا صادرکننده" />
      </Field>
      <Field label="نوع چک">
        <select name="direction" className="input" defaultValue={c.direction ?? "issued"}>
          <option value="issued">صادره (ما پرداخت می‌کنیم)</option>
          <option value="received">دریافتی (ما دریافت می‌کنیم)</option>
        </select>
      </Field>
      <Field label="مبلغ به ریال *">
        <AmountInput defaultValue={c.amount} required />
      </Field>
      <Field label="سررسید">
        <input name="dueDate" type="date" defaultValue={c.dueDate ?? todayISO()} className="input num" />
      </Field>
      <Field label="بانک">
        <input name="bank" defaultValue={c.bank ?? ""} className="input" placeholder="بانک ملت" />
      </Field>
      <Field label="شماره سریال / شناسه">
        <input name="serial" defaultValue={c.serial ?? ""} className="input num" placeholder="745123" />
      </Field>
      {c.id ? (
        <Field label="وضعیت چک">
          <select name="status" className="input" defaultValue={c.status ?? "pending"}>
            <option value="pending">در انتظار</option>
            <option value="passed">پاس‌شده</option>
            <option value="bounced">برگشتی</option>
          </select>
        </Field>
      ) : null}
      <Field label="یادداشت" className="sm:col-span-2">
        <input name="notes" defaultValue={c.notes ?? ""} className="input" />
      </Field>
    </>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="بدهی، طلب و چک"
        subtitle="سررسیدها را مدیریت کنید و هر رکورد را ویرایش یا حذف کنید تا نقدینگی مزرعه دقیق بماند."
        icon="wallet"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="بدهی ما (تسویه‌نشده)" value={formatMoney(o.totals.payable)} hint={formatMoneyWords(o.totals.payable)} tone="red" icon="wallet" />
        <StatCard label="طلب ما (وصول‌نشده)" value={formatMoney(o.totals.receivable)} hint={formatMoneyWords(o.totals.receivable)} tone="farm" icon="phone" />
        <StatCard
          label="چک‌های صادره در انتظار"
          value={formatMoney(issued.reduce((a, c) => a + c.amount, 0))}
          hint={formatMoneyWords(issued.reduce((a, c) => a + c.amount, 0))}
          tone="clay"
          icon="receipt"
        />
        <StatCard
          label="چک‌های دریافتی در انتظار"
          value={formatMoney(received.reduce((a, c) => a + c.amount, 0))}
          hint={formatMoneyWords(received.reduce((a, c) => a + c.amount, 0))}
          tone="slate"
          icon="check"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Disclosure title="ثبت بدهی یا طلب جدید">
          <form action={createDebt} className="grid gap-3 sm:grid-cols-2">
            {debtFields({})}
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary w-full sm:w-auto">
                <Icon name="plus" className="h-4 w-4" />
                ثبت بدهی / طلب
              </button>
            </div>
          </form>
        </Disclosure>

        <Disclosure title="ثبت چک جدید">
          <form action={createCheque} className="grid gap-3 sm:grid-cols-2">
            {chequeFields({})}
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary w-full sm:w-auto">
                <Icon name="plus" className="h-4 w-4" />
                ثبت چک
              </button>
            </div>
          </form>
        </Disclosure>
      </div>

      <Card className="card-pad">
        <h2 className="section-title mb-2">
          <span>بدهی‌ها و طلب‌ها</span>
          <span className="chip">{debts.length ? `${debts.filter((d) => !d.paid).length} تسویه‌نشده` : "خالی"}</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>طرف حساب</th>
                <th>نوع</th>
                <th>بابت</th>
                <th>مبلغ</th>
                <th>سررسید</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {debts.map((d) => {
                const days = daysUntil(d.dueDate);
                const overdue = !d.paid && days !== null && days < 0;
                return (
                  <tr key={d.id} className={overdue ? "bg-red-50/50" : ""}>
                    <td className="text-xs font-semibold">{d.party}</td>
                    <td>
                      <Badge tone={d.direction === "payable" ? "red" : "green"}>{d.direction === "payable" ? "بدهی ما" : "طلب ما"}</Badge>
                    </td>
                    <td className="max-w-[160px] truncate text-[11px] text-[#7c8a7f]">{d.title || "—"}</td>
                    <td>
                      <Money value={d.amount} tone={d.direction === "payable" ? "expense" : "income"} />
                    </td>
                    <td className="num whitespace-nowrap text-[11px]">
                      {formatDate(d.dueDate)}
                      {!d.paid && days !== null ? (
                        <span className={`mr-1 ${overdue ? "text-red-600" : "text-[#84907f]"}`}>
                          ({overdue ? `${Math.abs(days)} روز تأخیر` : `${days} روز مانده`})
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={d.paid ? "green" : "amber"}>{d.paid ? "تسویه‌شده" : "باز"}</Badge>
                        <form action={toggleDebtPaid}>
                          <input type="hidden" name="id" value={d.id} />
                          <button type="submit" className="text-[10px] font-semibold text-farm-700 hover:underline">
                            {d.paid ? "برگشت به باز" : "تسویه"}
                          </button>
                        </form>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <EditPanel title="ویرایش بدهی">
                          <form action={updateDebt} className="grid gap-2 sm:grid-cols-2">
                            {debtFields({
                              id: d.id,
                              party: d.party,
                              direction: d.direction,
                              title: d.title,
                              amount: d.amount,
                              dueDate: d.dueDate,
                              paid: d.paid,
                              notes: d.notes,
                            })}
                            <div className="sm:col-span-2">
                              <button type="submit" className="btn btn-primary w-full sm:w-auto">
                                <Icon name="check" className="h-4 w-4" />
                                ذخیره ویرایش
                              </button>
                            </div>
                          </form>
                        </EditPanel>
                        <DeleteForm action={deleteDebt} id={d.id} label="حذف" confirmText={`${statusLabel(d.direction)} «${d.party}» حذف شود؟`} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!debts.length ? <EmptyState title="بدهی یا طلبی ثبت نشده" /> : null}
      </Card>

      <Card className="card-pad">
        <h2 className="section-title mb-2">
          <span>چک‌ها</span>
          <span className="chip">{cheques.filter((c) => c.status === "pending").length ? `${cheques.filter((c) => c.status === "pending").length} در انتظار` : "خالی"}</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>طرف حساب</th>
                <th>نوع</th>
                <th>مبلغ</th>
                <th>سررسید</th>
                <th>بانک / سریال</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {cheques.map((c) => (
                <tr key={c.id}>
                  <td className="text-xs font-semibold">{c.party}</td>
                  <td>
                    <Badge tone={c.direction === "issued" ? "amber" : "green"}>{statusLabel(c.direction)}</Badge>
                  </td>
                  <td>
                    <Money value={c.amount} />
                  </td>
                  <td className="num whitespace-nowrap text-[11px]">{formatDate(c.dueDate)}</td>
                  <td className="whitespace-nowrap text-[11px] text-[#7c8a7f]">
                    {c.bank || "—"} / {c.serial || "—"}
                  </td>
                  <td>
                    <form action={setChequeStatus} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={c.id} />
                      <select name="status" defaultValue={c.status} className="input h-8 w-24 py-0 text-[11px]">
                        <option value="pending">در انتظار</option>
                        <option value="passed">پاس‌شده</option>
                        <option value="bounced">برگشتی</option>
                      </select>
                      <button type="submit" className="btn btn-sm" title="ثبت وضعیت">
                        <Icon name="check" className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <EditPanel title="ویرایش چک">
                        <form action={updateCheque} className="grid gap-2 sm:grid-cols-2">
                          {chequeFields({
                            id: c.id,
                            party: c.party,
                            direction: c.direction,
                            amount: c.amount,
                            dueDate: c.dueDate,
                            bank: c.bank,
                            serial: c.serial,
                            status: c.status,
                            notes: c.notes,
                          })}
                          <div className="sm:col-span-2">
                            <button type="submit" className="btn btn-primary w-full sm:w-auto">
                              <Icon name="check" className="h-4 w-4" />
                              ذخیره ویرایش
                            </button>
                          </div>
                        </form>
                      </EditPanel>
                      <DeleteForm action={deleteCheque} id={c.id} label="حذف" confirmText={`چک «${c.party}» به مبلغ ${formatMoney(c.amount)} حذف شود؟`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!cheques.length ? <EmptyState title="چکی ثبت نشده" /> : null}
      </Card>

      <Card className="card-pad">
        <h2 className="section-title mb-2">کارهای پیش‌رو</h2>
        <form action={createTask} className="mb-3 grid gap-2 sm:grid-cols-4">
          <Field label="عنوان کار *">
            <input name="title" required className="input" placeholder="آبیاری قطعه شمالی" />
          </Field>
          <Field label="سررسید">
            <input name="dueDate" type="date" defaultValue={todayISO()} className="input num" />
          </Field>
          <Field label="اولویت">
            <select name="priority" className="input" defaultValue="normal">
              <option value="low">کم</option>
              <option value="normal">معمولی</option>
              <option value="high">زیاد</option>
            </select>
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
          <div className="sm:col-span-4">
            <button type="submit" className="btn btn-primary w-full sm:w-auto">
              <Icon name="plus" className="h-4 w-4" />
              افزودن کار
            </button>
          </div>
        </form>

        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="rounded-xl border border-[#f0ebdd] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <form action={toggleTask}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="btn btn-sm" title="تغییر وضعیت">
                      <Icon name="check" className="h-3.5 w-3.5" />
                    </button>
                  </form>
                  <div>
                    <p className={`text-xs font-semibold ${t.status === "done" ? "text-[#84907f] line-through" : "text-farm-900"}`}>{t.title}</p>
                    <p className="num text-[10px] text-[#84907f]">
                      {formatDate(t.dueDate)} · {statusLabel(t.priority)} · {statusLabel(t.status)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone={t.status === "done" ? "green" : t.priority === "high" ? "red" : "amber"}>
                    {t.status === "done" ? "انجام‌شده" : statusLabel(t.priority)}
                  </Badge>
                  <DeleteForm action={deleteTask} id={t.id} label="حذف کار" confirmText={`کار «${t.title}» حذف شود؟`} />
                </div>
              </div>
              <EditPanel title="ویرایش کار">
                <form action={updateTask} className="grid gap-2 sm:grid-cols-2">
                  <input type="hidden" name="id" value={t.id} />
                  <Field label="عنوان">
                    <input name="title" defaultValue={t.title} className="input" required />
                  </Field>
                  <Field label="سررسید">
                    <input name="dueDate" type="date" defaultValue={t.dueDate ?? ""} className="input num" />
                  </Field>
                  <Field label="اولویت">
                    <select name="priority" defaultValue={t.priority} className="input">
                      <option value="low">کم</option>
                      <option value="normal">معمولی</option>
                      <option value="high">زیاد</option>
                    </select>
                  </Field>
                  <Field label="وضعیت">
                    <select name="status" defaultValue={t.status} className="input">
                      <option value="open">باز</option>
                      <option value="done">انجام‌شده</option>
                    </select>
                  </Field>
                  <Field label="زمین">
                    <select name="landId" defaultValue={t.landId ?? ""} className="input">
                      <option value="">بدون زمین</option>
                      {lands.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="sm:col-span-2">
                    <button type="submit" className="btn btn-primary w-full sm:w-auto">
                      <Icon name="check" className="h-4 w-4" />
                      ذخیره
                    </button>
                  </div>
                </form>
              </EditPanel>
            </div>
          ))}
          {!tasks.length ? <EmptyState title="کاری ثبت نشده" /> : null}
        </div>
        <p className="num mt-3 text-[11px] text-[#84907f]">
          جمع بدهی و چک نزدیک: {formatMoney(o.totals.payable + o.totals.chequeUpcoming)} · {formatNumber(tasks.filter((t) => t.status !== "done").length)} کار باز
        </p>
      </Card>
    </div>
  );
}
