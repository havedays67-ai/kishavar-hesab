import { getCheques, getDebts, getFarmOverview } from "@/lib/data";
import { daysUntil, formatDate, formatMoney, formatMoneyWords, statusLabel, todayISO } from "@/lib/format";
import { Amount, Badge, Card, Disclosure, EmptyState, Field, Icon, PageHeader, StatCard } from "@/components/ui";
import { createCheque, createDebt, setChequeStatus, toggleDebtPaid } from "@/app/actions";
import { RecordActions } from "@/components/RecordActions";

import { ReceiptUploader } from "@/components/Receipts";
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const [debts, cheques, o] = await Promise.all([getDebts(), getCheques(), getFarmOverview()]);
  const payable = debts.filter((d) => d.direction === "payable" && !d.paid);
  const receivable = debts.filter((d) => d.direction === "receivable" && !d.paid);
  const issued = cheques.filter((c) => c.status === "pending" && c.direction === "issued");
  const received = cheques.filter((c) => c.status === "pending" && c.direction === "received");

  return (
    <div className="space-y-4">
      <PageHeader
        title="بدهی، طلب و چک"
        subtitle="سررسیدها را مدیریت کنید تا نقدینگی مزرعه در فصل پرداخت‌ها دچار مشکل نشود."
        icon="wallet"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="بدهی ما (تسویه‌نشده)" value={formatMoney(o.totals.payable)} hint={formatMoneyWords(o.totals.payable)} tone="red" icon="wallet" />
        <StatCard label="طلب ما (وصول‌نشده)" value={formatMoney(o.totals.receivable)} hint={formatMoneyWords(o.totals.receivable)} tone="farm" icon="phone" />
        <StatCard label="چک‌های صادره در انتظار" value={formatMoney(issued.reduce((a, c) => a + c.amount, 0))} hint={formatMoneyWords(issued.reduce((a, c) => a + c.amount, 0))} tone="clay" icon="receipt" />
        <StatCard label="چک‌های دریافتی در انتظار" value={formatMoney(received.reduce((a, c) => a + c.amount, 0))} hint={formatMoneyWords(received.reduce((a, c) => a + c.amount, 0))} tone="slate" icon="check" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Disclosure title="ثبت بدهی یا طلب جدید">
          <form action={createDebt} className="grid gap-3 sm:grid-cols-2">
            <Field label="طرف حساب *">
              <input name="party" required className="input" placeholder="فروشگاه نهاده، بانک، خریدار" />
            </Field>
            <Field label="نوع">
              <select name="direction" className="input" defaultValue="payable">
                <option value="payable">بدهی ما (پرداختنی)</option>
                <option value="receivable">طلب ما (دریافتنی)</option>
              </select>
            </Field>
            <Field label="مبلغ (تومان) *">
              <input name="amount" required inputMode="numeric" className="input num" placeholder="44500000" />
            </Field>
            <Field label="سررسید">
              <input name="dueDate" type="date" defaultValue={todayISO()} className="input num" />
            </Field>
            <Field label="بابت">
              <input name="title" className="input" placeholder="خرید نسیه کود و سم" />
            </Field>
            <Field label="یادداشت">
              <input name="notes" className="input" />
            </Field>
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
            <Field label="طرف حساب *">
              <input name="party" required className="input" placeholder="نام دریافت‌کننده یا صادرکننده" />
            </Field>
            <Field label="نوع چک">
              <select name="direction" className="input" defaultValue="issued">
                <option value="issued">صادره (ما پرداخت می‌کنیم)</option>
                <option value="received">دریافتی (ما دریافت می‌کنیم)</option>
              </select>
            </Field>
            <Field label="مبلغ (تومان) *">
              <input name="amount" required inputMode="numeric" className="input num" />
            </Field>
            <Field label="سررسید">
              <input name="dueDate" type="date" defaultValue={todayISO()} className="input num" />
            </Field>
            <Field label="بانک">
              <input name="bank" className="input" placeholder="بانک ملت" />
            </Field>
            <Field label="شماره سریال / شناسه">
              <input name="serial" className="input num" placeholder="745123" />
            </Field>
            <Field label="یادداشت" className="sm:col-span-2">
              <input name="notes" className="input" />
            </Field>
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
                <th />
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
                    <td><Amount value={d.amount} tone={d.direction === "payable" ? "expense" : "income"} /></td>
                    <td className="num whitespace-nowrap text-[11px]">
                      {formatDate(d.dueDate)}
                      {!d.paid && days !== null ? (
                        <span className={`mr-1 ${overdue ? "text-red-600" : "text-[#84907f]"}`}>
                          ({overdue ? `${Math.abs(days)} روز تأخیر` : `${days} روز مانده`})
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <Badge tone={d.paid ? "green" : "amber"}>{d.paid ? "تسویه‌شده" : "باز"}</Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <form action={toggleDebtPaid}>
                          <input type="hidden" name="id" value={d.id} />
                          <button type="submit" className="btn btn-sm" title="تغییر وضعیت تسویه">
                            <Icon name="check" className="h-3.5 w-3.5" />
                          </button>
                        </form>
                        <RecordActions entity="debts" id={d.id} label={`${d.direction === "payable" ? "بدهی" : "طلب"} ${d.party}`} />
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
          <span className="chip">{cheques.filter((c) => c.status === "pending").length} در انتظار</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>طرف حساب</th>
                <th>نوع</th>
                <th>مبلغ</th>
                <th>سررسید</th>
                <th>بانک</th>
                <th>سریال</th>
                <th>وضعیت</th>
                <th>تغییر وضعیت</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cheques.map((c) => {
                const days = daysUntil(c.dueDate);
                const urgent = c.status === "pending" && days !== null && days <= 7;
                return (
                  <tr key={c.id} className={urgent ? "bg-amber-50/50" : ""}>
                    <td className="text-xs font-semibold">{c.party}</td>
                    <td>
                      <Badge tone={c.direction === "issued" ? "amber" : "blue"}>{c.direction === "issued" ? "صادره" : "دریافتی"}</Badge>
                    </td>
                    <td><Amount value={c.amount} tone={c.direction === "issued" ? "expense" : "income"} /></td>
                    <td className="num whitespace-nowrap text-[11px]">
                      {formatDate(c.dueDate)}
                      {c.status === "pending" && days !== null ? (
                        <span className={`mr-1 ${days < 0 ? "text-red-600" : "text-[#84907f]"}`}>({days < 0 ? `${Math.abs(days)} روز گذشته` : `${days} روز`})</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap text-[11px]">{c.bank || "—"}</td>
                    <td className="num whitespace-nowrap text-[11px]">{c.serial || "—"}</td>
                    <td>
                      <Badge tone={c.status === "passed" ? "green" : c.status === "bounced" ? "red" : "amber"}>{statusLabel(c.status)}</Badge>
                    </td>
                    <td>
                      <form action={setChequeStatus} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={c.id} />
                        <select name="status" defaultValue={c.status} className="rounded-lg border border-[#ddd7c7] bg-white px-1.5 py-1 text-[10px]">
                          <option value="pending">در انتظار</option>
                          <option value="passed">پاس‌شده</option>
                          <option value="bounced">برگشتی</option>
                        </select>
                        <button type="submit" className="btn btn-sm">
                          ثبت
                        </button>
                      </form>
                    </td>
                    <td>
                      <RecordActions entity="cheques" id={c.id} label={`چک ${c.party}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!cheques.length ? <EmptyState title="چکی ثبت نشده" /> : null}
      </Card>

      <Card className="card-pad bg-sand-50">
        <p className="text-xs leading-6 text-[#5b6a5e]">
          💡 نسبت نقدینگی ساده: (موجودی نقد + طلب‌های سررسیدشده) ÷ (بدهی‌ها + چک‌های ۳۰ روز آینده). اگر کمتر از ۱ شد، پیش از سررسید برای فروش محصول یا تمدید
          برنامه‌ریزی کنید. چک برگشتی را حتماً با توضیح در «هزینه متفرقه» ثبت کنید تا هزینه واقعی مشخص بماند.
        </p>
      </Card>
      <ReceiptUploader
        section="finance"
        heading="آپلود رسید پرداخت و چک"
        subtitle="فیش واریز، کارت‌به‌کارت، رسید دریافت بدهی یا تصویر چک را با شمارهٔ پیگیری ثبت کنید."
      />

    </div>
  );
}
