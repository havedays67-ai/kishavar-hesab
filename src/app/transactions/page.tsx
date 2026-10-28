import Link from "next/link";
import { getCategories, getCrops, getLands, listTransactions } from "@/lib/data";
import { formatDate, formatMoney, formatMoneyWords, formatNumber, statusLabel, todayISO } from "@/lib/format";
import { Amount, Badge, Card, Disclosure, EmptyState, Field, Icon, PageHeader, StatCard } from "@/components/ui";
import { RecordActions } from "@/components/RecordActions";
import { createTransaction } from "@/app/actions";

import { ReceiptUploader } from "@/components/Receipts";
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ kind?: string; landId?: string; categoryId?: string; from?: string; to?: string; q?: string; cropId?: string }>;

export default async function TransactionsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const lands = await getLands();
  const crops = await getCrops();
  const categories = await getCategories();
  const landId = sp.landId ? Number(sp.landId) : undefined;
  const categoryId = sp.categoryId ? Number(sp.categoryId) : undefined;
  const cropId = sp.cropId ? Number(sp.cropId) : undefined;

  const rows = await listTransactions({
    kind: sp.kind,
    landId: Number.isFinite(landId) ? landId : undefined,
    categoryId: Number.isFinite(categoryId) ? categoryId : undefined,
    from: sp.from,
    to: sp.to,
    q: sp.q,
    limit: 400,
  });
  const filtered = cropId ? rows.filter((r) => r.cropId === cropId) : rows;

  const income = filtered.filter((r) => r.kind === "income").reduce((a, r) => a + r.amount, 0);
  const expense = filtered.filter((r) => r.kind === "expense").reduce((a, r) => a + r.amount, 0);
  const expenseCats = categories.filter((c) => c.kind === "expense");
  const incomeCats = categories.filter((c) => c.kind === "income");

  const transactionForm = (kind: "income" | "expense") => (
    <form action={createTransaction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="kind" value={kind} />
      <Field label="مبلغ (تومان) *" hint="اعداد را به تومان وارد کنید؛ نمایش به ریال (مثلاً 100,000,000 ریال) و حروفی تومانی است.">
        <input name="amount" required type="text" inputMode="numeric" placeholder="۵٬۰۰۰٬۰۰۰" className="input num" />
      </Field>
      <Field label="دسته *">
        <select name="categoryId" required className="input" defaultValue="">
          <option value="" disabled>
            انتخاب دسته
          </option>
          {(kind === "income" ? incomeCats : expenseCats).map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="تاریخ">
        <input name="date" type="date" defaultValue={todayISO()} className="input num" />
      </Field>
      <Field label="روش پرداخت">
        <select name="method" className="input" defaultValue="cash">
          <option value="cash">نقدی</option>
          <option value="bank">بانکی / کارت</option>
          <option value="credit">اعتباری (بدهی)</option>
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
      <Field label="طرف حساب">
        <input name="party" placeholder="فروشگاه، خریدار، ..." className="input" />
      </Field>
      <Field label="شرح">
        <input name="description" placeholder={kind === "income" ? "فروش ۲ تن گندم" : "خرید کود اوره"} className="input" />
      </Field>
      <div className="sm:col-span-2 lg:col-span-4">
        <button type="submit" className="btn btn-primary w-full sm:w-auto">
          <Icon name="plus" className="h-4 w-4" />
          ثبت {kind === "income" ? "درآمد" : "هزینه"}
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="دفتر عملیات مالی"
        subtitle="هر درآمد و هزینه را با دسته، زمین و طرف حساب ثبت کنید. ثبت دقیق یعنی گزارش درست."
        icon="receipt"
        actions={
          <Link href="/assistant" className="btn btn-sm">
            <Icon name="sparkles" className="h-3.5 w-3.5" />
            ثبت با دستیار
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="تعداد رکورد" value={formatNumber(filtered.length)} tone="slate" icon="receipt" />
        <StatCard label="جمع درآمد فیلتر" value={formatMoney(income)} hint={formatMoneyWords(income)} tone="farm" icon="chart" />
        <StatCard label="جمع هزینه فیلتر" value={formatMoney(expense)} hint={formatMoneyWords(expense)} tone="clay" icon="wallet" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Disclosure title="ثبت هزینه جدید" icon="receipt">
          {transactionForm("expense")}
        </Disclosure>
        <Disclosure title="ثبت درآمد جدید" icon="chart">
          {transactionForm("income")}
        </Disclosure>
      </div>

      <Card className="card-pad">
        <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7" method="get">
          <Field label="نوع">
            <select name="kind" defaultValue={sp.kind ?? ""} className="input">
              <option value="">همه</option>
              <option value="income">درآمد</option>
              <option value="expense">هزینه</option>
            </select>
          </Field>
          <Field label="زمین">
            <select name="landId" defaultValue={sp.landId ?? ""} className="input">
              <option value="">همه</option>
              {lands.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="دسته">
            <select name="categoryId" defaultValue={sp.categoryId ?? ""} className="input">
              <option value="">همه</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="از تاریخ">
            <input name="from" type="date" defaultValue={sp.from ?? ""} className="input num" />
          </Field>
          <Field label="تا تاریخ">
            <input name="to" type="date" defaultValue={sp.to ?? ""} className="input num" />
          </Field>
          <Field label="جستجو">
            <input name="q" defaultValue={sp.q ?? ""} placeholder="شرح یا طرف حساب" className="input" />
          </Field>
          <div className="flex items-end gap-1">
            <button type="submit" className="btn btn-primary flex-1">
              <Icon name="search" className="h-4 w-4" />
              فیلتر
            </button>
            <Link href="/transactions" className="btn" title="پاک‌کردن فیلتر">
              <Icon name="close" className="h-4 w-4" />
            </Link>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>نوع</th>
                <th>دسته</th>
                <th>شرح</th>
                <th>زمین</th>
                <th>کشت</th>
                <th>طرف حساب</th>
                <th>روش</th>
                <th>مبلغ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-sand-50/60">
                  <td className="num whitespace-nowrap text-[11px] text-[#7c8a7f]">{formatDate(t.date)}</td>
                  <td>
                    <Badge tone={t.kind === "income" ? "green" : "amber"}>{t.kind === "income" ? "درآمد" : "هزینه"}</Badge>
                  </td>
                  <td className="whitespace-nowrap text-xs">{t.categoryName ?? "—"}</td>
                  <td className="max-w-[180px] truncate text-xs">{t.description || "—"}</td>
                  <td className="whitespace-nowrap text-[11px]">{t.landName ?? "—"}</td>
                  <td className="whitespace-nowrap text-[11px]">{t.cropName ?? "—"}</td>
                  <td className="max-w-[120px] truncate text-[11px] text-[#7c8a7f]">{t.party || "—"}</td>
                  <td className="whitespace-nowrap text-[11px]">{statusLabel(t.method)}</td>
                  <td>
                    <Amount value={t.amount} tone={t.kind === "income" ? "income" : "expense"} />
                  </td>
                  <td>
                    <RecordActions
                      entity="transactions"
                      id={t.id}
                      label={`${t.kind === "income" ? "درآمد" : "هزینه"} ${formatMoney(t.amount)}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length ? <div className="p-4"><EmptyState title="رکوردی با این فیلتر پیدا نشد" hint="فیلترها را تغییر دهید یا هزینه جدید ثبت کنید." /></div> : null}
      </Card>

      <p className="text-[11px] leading-6 text-[#7c8a7f]">
        نکته: خرید نسیه را با روش «اعتباری» ثبت کنید تا در بدهی‌ها لحاظ شود. هزینه شخصی خانوار را با مزرعه مخلوط نکنید. برای گزارش بهای تمام‌شده، حتماً زمین و کشت
        را انتخاب کنید.
      </p>
      <ReceiptUploader
        section="finance"
        heading="آپلود رسید عملیات مالی"
        subtitle="برای هر درآمد یا هزینه، فیش بانکی یا فاکتور را با شمارهٔ پیگیری پیوست کنید."
      />

    </div>
  );
}
