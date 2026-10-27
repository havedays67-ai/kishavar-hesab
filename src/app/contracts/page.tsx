import Link from "next/link";
import { db } from "@/db";
import { agriContractPayments, agriContracts } from "@/db/schema";
import { desc } from "drizzle-orm";
import { addContractPayment, createContract, deleteContract, deleteContractPayment, setContractStatus } from "@/app/contracts/actions";
import { Card, Disclosure, EmptyState, Field, Icon, PageHeader, StatCard } from "@/components/ui";
import { formatDate, formatMoney, formatMoneyWords, formatNumber, todayJalali, todayJalaliNextYear } from "@/lib/format";
import { getContractStats } from "@/lib/contracts/service";
import { contractTypeLabel, perspectiveLabel } from "@/lib/contracts/model";

export const dynamic = "force-dynamic";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const [contracts, payments, stats] = await Promise.all([
    db.select().from(agriContracts).orderBy(desc(agriContracts.startDate), desc(agriContracts.id)),
    db.select().from(agriContractPayments),
    getContractStats(),
  ]);
  const paidByContract = new Map<number, number>();
  for (const payment of payments) {
    if (payment.kind === "rent") paidByContract.set(payment.contractId, (paidByContract.get(payment.contractId) ?? 0) + Number(payment.amountToman || 0));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="قرارداد زمین و اجاره"
        subtitle="اجاره نقدی، مزارعه، مساقات و مشارکت — با تاریخ شمسی، اقساط، سند قابل چاپ و ثبت پرداخت‌ها."
        icon="land"
        actions={
          <Link href="/trade" className="btn">
            <Icon name="wallet" className="h-4 w-4" />
            معامله محصول
          </Link>
        }
      />

      {sp.created ? <div className="rounded-xl border border-farm-200 bg-farm-50 p-3 text-xs text-farm-800">قرارداد ثبت شد.</div> : null}
      {sp.error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{sp.error}</div> : null}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard label="قراردادهای فعال" value={`${formatNumber(stats.active)} از ${formatNumber(stats.total)}`} hint={`مستأجر: ${formatNumber(stats.asLessee)} · موجر: ${formatNumber(stats.asLessor)}`} icon="land" />
        <StatCard label="اجاره پرداخت‌شده" value={`${formatNumber(stats.cashOutgoing)} تومان`} hint={formatMoneyWords(stats.cashOutgoing)} tone="clay" icon="wallet" />
        <StatCard label="اجاره دریافتی" value={`${formatNumber(stats.cashIncoming)} تومان`} hint={formatMoneyWords(stats.cashIncoming)} tone="farm" icon="check" />
        <StatCard label="مانده تعهد اجاره (ما مستأجر)" value={`${formatNumber(stats.overdue)} تومان`} hint={formatMoneyWords(stats.overdue)} tone="red" icon="alert" />
      </div>

      <Disclosure title="ثبت قرارداد جدید (اجاره، مزارعه، مساقات، مشارکت)" defaultOpen={contracts.length === 0}>
        <form action={createContract} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="عنوان قرارداد *">
            <input name="title" required className="input" placeholder="مثلاً اجاره زمین شمالی برای گندم ۱۴۰۵" />
          </Field>
          <Field label="نقش شما *">
            <select name="perspective" className="input" defaultValue="lessee">
              <option value="lessee">زمین را اجاره می‌کنم (من مستأجر)</option>
              <option value="lessor">زمین را اجاره می‌دهم (من موجر)</option>
            </select>
          </Field>
          <Field label="نوع قرارداد *">
            <select name="type" className="input" defaultValue="cash">
              <option value="cash">اجاره نقدی</option>
              <option value="crop_share">مزارعه (سهم محصول)</option>
              <option value="cash_share">اجاره نقدی + سهم محصول</option>
              <option value="mosaqat">مساقات (باغ و درختان)</option>
              <option value="partnership">مشارکت در کشت</option>
            </select>
          </Field>
          <Field label="نام طرف قرارداد *">
            <input name="counterpartyName" required className="input" placeholder={contracts[0]?.perspective === "lessor" ? "نام مستأجر" : "نام مالک / موجر"} />
          </Field>
          <Field label="تلفن طرف قرارداد">
            <input name="counterpartyPhone" className="input num" inputMode="tel" />
          </Field>
          <Field label="محصول مورد کشت">
            <input name="crop" className="input" placeholder="گندم، جو، زعفران" />
          </Field>
          <Field label="مساحت (هکتار)">
            <input name="areaHa" className="input num" inputMode="decimal" placeholder="12.5" />
          </Field>
          <Field label="آدرس / آبادی">
            <input name="location" className="input" />
          </Field>
          <Field label="شماره پلاک / قطعه">
            <input name="plate" className="input" />
          </Field>
          <Field label="تاریخ شروع (شمسی) *">
            <input name="startDate" required className="input num" defaultValue={todayJalali()} placeholder="۱۴۰۴/۰۳/۱۵" />
          </Field>
          <Field label="تاریخ پایان (شمسی) *">
            <input name="endDate" required className="input num" defaultValue={todayJalaliNextYear()} placeholder="۱۴۰۶/۰۳/۱۵" />
          </Field>
          <Field label="دوره پرداخت">
            <select name="cycle" className="input" defaultValue="once">
              <option value="once">یک‌باره</option>
              <option value="monthly">ماهانه</option>
              <option value="seasonal">فصلی</option>
              <option value="annual">سالانه</option>
            </select>
          </Field>
          <Field label="اجاره کل (تومان)">
            <input name="totalRentToman" className="input num" inputMode="numeric" placeholder="500000000" />
          </Field>
          <Field label="ودیعه (تومان)">
            <input name="depositToman" className="input num" inputMode="numeric" />
          </Field>
          <Field label="سهم مالک از محصول (٪)">
            <input name="landownerSharePercent" className="input num" inputMode="decimal" placeholder="30" />
          </Field>
          <Field label="سهم آب">
            <input name="waterShare" className="input" placeholder="مثلاً یک سوم / نوبت دوم" />
          </Field>
          <Field label="هزینه آب بر عهده">
            <select name="waterPaidBy" className="input" defaultValue="farmer">
              <option value="farmer">کشاورز</option>
              <option value="landowner">مالک</option>
              <option value="split">تقسیم مساوی</option>
            </select>
          </Field>
          <Field label="هزینه‌های کشت بر عهده">
            <select name="costsPaidBy" className="input" defaultValue="farmer">
              <option value="farmer">کشاورز</option>
              <option value="landowner">مالک</option>
              <option value="split">تقسیم مساوی</option>
            </select>
          </Field>
          <Field label="شهود / امضاکنندگان">
            <input name="witnesses" className="input" />
          </Field>
          <Field label="وضعیت">
            <select name="status" className="input" defaultValue="active">
              <option value="draft">پیش‌نویس</option>
              <option value="active">فعال</option>
              <option value="ended">پایان‌یافته</option>
              <option value="canceled">لغوشده</option>
            </select>
          </Field>
          <Field label="شرایط توافقی" className="sm:col-span-2 lg:col-span-3">
            <textarea name="terms" className="input min-h-16" placeholder="شرایط تحویل زمین، آب، بیمه محصول، خسارت تأخیر و ..." />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" className="btn btn-primary">
              <Icon name="plus" className="h-4 w-4" />
              ثبت قرارداد
            </button>
            <span className="mr-2 text-[10px] text-[#84907f]">پس از ثبت، سند رسمی قابل چاپ و پرداخت‌ها قابل ثبت است.</span>
          </div>
        </form>
      </Disclosure>

      <div className="space-y-3">
        {contracts.length === 0 ? (
          <Card className="card-pad">
            <EmptyState title="هنوز قراردادی ثبت نشده است" hint="فرم بالا را پر کنید تا قرارداد با تاریخ شمسی و سند قابل چاپ ساخته شود." />
          </Card>
        ) : null}
        {contracts.map((contract) => {
          const paid = paidByContract.get(contract.id) ?? 0;
          const remaining = Math.max(0, Number(contract.totalRentToman) - paid);
          const contractPayments = payments.filter((payment) => payment.contractId === contract.id);
          return (
            <Card key={contract.id} className="card-pad">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold text-farm-900">{contract.title}</h2>
                  <p className="mt-0.5 text-[11px] text-[#6a7a6d]">
                    {perspectiveLabel(contract.perspective)} · {contractTypeLabel(contract.type)} · طرف مقابل: {contract.counterpartyName}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#84907f]">
                    {formatDate(contract.startDate)} تا {formatDate(contract.endDate)} · {contract.areaHa ? `${formatNumber(contract.areaHa)} هکتار` : "مساحت نامشخص"}
                    {contract.crop ? ` · ${contract.crop}` : ""}{contract.location ? ` · ${contract.location}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`chip ${contract.status === "active" ? "border-farm-200 text-farm-800" : ""}`}>
                    {{ draft: "پیش‌نویس", active: "فعال", ended: "پایان‌یافته", canceled: "لغوشده" }[contract.status] ?? contract.status}
                  </span>
                  <Link href={`/contracts/${contract.id}/print`} className="btn btn-sm btn-primary">
                    <Icon name="receipt" className="h-3.5 w-3.5" />
                    سند رسمی
                  </Link>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                <div className="rounded-lg bg-sand-50 px-2 py-1.5">
                  <span className="block text-[10px] text-[#84907f]">اجاره کل</span>
                  <span className="num block font-bold">{formatNumber(contract.totalRentToman)} تومان</span>
                </div>
                <div className="rounded-lg bg-sand-50 px-2 py-1.5">
                  <span className="block text-[10px] text-[#84907f]">پرداخت‌شده</span>
                  <span className="num block font-bold text-farm-700">{formatNumber(paid)} تومان</span>
                </div>
                <div className="rounded-lg bg-sand-50 px-2 py-1.5">
                  <span className="block text-[10px] text-[#84907f]">مانده</span>
                  <span className="num block font-bold text-clay-600">{formatNumber(remaining)} تومان</span>
                </div>
                <div className="rounded-lg bg-sand-50 px-2 py-1.5">
                  <span className="block text-[10px] text-[#84907f]">ودیعه / سهم مالک</span>
                  <span className="num block font-bold">{formatNumber(contract.depositToman)} / {contract.landownerSharePercent}٪</span>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <Disclosure title="ثبت پرداخت / دریافت اجاره">
                  <form action={addContractPayment} className="grid gap-2 sm:grid-cols-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <Field label="نوع *">
                      <select name="kind" className="input" defaultValue="rent">
                        <option value="rent">اجاره</option>
                        <option value="deposit">ودیعه</option>
                        <option value="deposit_refund">برگشت ودیعه</option>
                        <option value="crop_share">تسویه سهم محصول</option>
                        <option value="other">سایر</option>
                      </select>
                    </Field>
                    <Field label="مبلغ (تومان) *">
                      <input name="amountToman" required className="input num" inputMode="numeric" />
                    </Field>
                    <Field label="تاریخ (شمسی) *">
                      <input name="paidAt" required className="input num" defaultValue={todayJalali()} />
                    </Field>
                    <Field label="حساب">
                      <select name="account" className="input" defaultValue="bank">
                        <option value="bank">بانکی</option>
                        <option value="cash">نقدی</option>
                      </select>
                    </Field>
                    <Field label="یادداشت" className="sm:col-span-2">
                      <input name="note" className="input" />
                    </Field>
                    <div className="sm:col-span-2">
                      <button type="submit" className="btn btn-sm btn-primary">
                        <Icon name="plus" className="h-3.5 w-3.5" />
                        ثبت
                      </button>
                    </div>
                  </form>
                  {contractPayments.length > 0 ? (
                    <table className="table mt-2">
                      <thead>
                        <tr>
                          <th>تاریخ</th>
                          <th>نوع</th>
                          <th>مبلغ</th>
                          <th>یادداشت</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {contractPayments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="text-[11px]">{formatDate(payment.paidAt)}</td>
                            <td className="text-[11px]">{{ rent: "اجاره", deposit: "ودیعه", deposit_refund: "برگشت ودیعه", crop_share: "سهم محصول", other: "سایر" }[payment.kind] ?? payment.kind}</td>
                            <td className="num text-[11px]">{formatMoney(payment.amountToman)}</td>
                            <td className="text-[10px] text-[#6a7a6d]">{payment.note || "—"}</td>
                            <td>
                              <form action={deleteContractPayment}>
                                <input type="hidden" name="id" value={payment.id} />
                                <input type="hidden" name="contractId" value={contract.id} />
                                <button type="submit" className="btn btn-sm text-red-700" aria-label="حذف پرداخت">
                                  <Icon name="trash" className="h-3.5 w-3.5" />
                                </button>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                </Disclosure>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(["active", "ended", "canceled"] as const).map((status) => (
                    <form key={status} action={setContractStatus}>
                      <input type="hidden" name="id" value={contract.id} />
                      <input type="hidden" name="status" value={status} />
                      <button type="submit" className="btn btn-sm" disabled={contract.status === status}>
                        {{ active: "فعال", ended: "پایان", canceled: "لغو" }[status]}
                      </button>
                    </form>
                  ))}
                  <form action={deleteContract}>
                    <input type="hidden" name="id" value={contract.id} />
                    <button type="submit" className="btn btn-sm text-red-700">
                      <Icon name="trash" className="h-3.5 w-3.5" />
                      حذف
                    </button>
                  </form>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="card-pad bg-sand-50">
        <h2 className="section-title">مبنای حقوقی</h2>
        <p className="mt-1 text-[10.5px] leading-6 text-[#4a5a4c]">
          اجاره و مزارعه و مساقات در قانون مدنی ایران دارای احکام ویژه‌اند (از جمله مواد ۴۶۶، ۵۱۹، ۵۲۰، ۵۴۰، ۵۴۱، ۵۴۳ تا ۵۴۵ و ۵۷۱). ثبت
          مدت، مورد اجاره، مال‌الاجاره، سهم محصول، سهم آب و تکلیف هزینه‌ها در سند ضروری است. اسناد این بخش برای توافق خصوصی طرفین است؛
          برای تنظیم سند رسمی، دفتر اسناد رسمی و مشاوره حقوقی لازم است.
        </p>
      </Card>
    </div>
  );
}
