import Link from "next/link";
import { getCrops, getLands, listTransactions } from "@/lib/data";
import { formatMoney, formatNumber, monthKey, monthLabel, pct, formatDate } from "@/lib/format";
import { Card, EmptyState, Field, Icon, PageHeader, StatCard, Badge, Progress } from "@/components/ui";
import { AreaChart, Donut, HBar } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; landId?: string }>;
}) {
  const sp = await searchParams;
  const landId = sp.landId ? Number(sp.landId) : undefined;
  const [lands, crops, rows] = await Promise.all([
    getLands(),
    getCrops(),
    listTransactions({ from: sp.from, to: sp.to, landId: Number.isFinite(landId) ? landId : undefined, limit: 5000 }),
  ]);

  const income = rows.filter((r) => r.kind === "income").reduce((a, r) => a + r.amount, 0);
  const expense = rows.filter((r) => r.kind === "expense").reduce((a, r) => a + r.amount, 0);
  const profit = income - expense;
  const margin = income > 0 ? profit / income : 0;
  const selectedLand = lands.find((l) => l.id === landId);
  const area = selectedLand ? selectedLand.areaHa : lands.reduce((a, l) => a + l.areaHa, 0);
  const cashIncome = rows.filter((r) => r.kind === "income" && r.method !== "credit").reduce((a, r) => a + r.amount, 0);
  const cashExpense = rows.filter((r) => r.kind === "expense" && r.method !== "credit").reduce((a, r) => a + r.amount, 0);

  const group = (kind: "income" | "expense") => {
    const list = rows.filter((r) => r.kind === kind);
    const total = list.reduce((a, r) => a + r.amount, 0) || 1;
    const map = new Map<string, number>();
    for (const r of list) {
      const key = r.categoryName ?? "بدون دسته";
      map.set(key, (map.get(key) ?? 0) + r.amount);
    }
    return [...map.entries()]
      .map(([name, amount]) => ({ name, amount, share: amount / total }))
      .sort((a, b) => b.amount - a.amount);
  };
  const expenseGroups = group("expense");
  const incomeGroups = group("income");

  const monthMap = new Map<string, { income: number; expense: number }>();
  for (const r of rows) {
    const key = monthKey(r.date);
    const cur = monthMap.get(key) ?? { income: 0, expense: 0 };
    if (r.kind === "income") cur.income += r.amount;
    else cur.expense += r.amount;
    monthMap.set(key, cur);
  }
  const monthly = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({ label: monthLabel(key), profit: v.income - v.expense, income: v.income }));

  const landPerformance = lands
    .filter((l) => !selectedLand || l.id === selectedLand.id)
    .map((land) => {
      const lRows = rows.filter((r) => r.landId === land.id);
      const lIncome = lRows.filter((r) => r.kind === "income").reduce((a, r) => a + r.amount, 0);
      const lExpense = lRows.filter((r) => r.kind === "expense").reduce((a, r) => a + r.amount, 0);
      return {
        land,
        income: lIncome,
        expense: lExpense,
        profit: lIncome - lExpense,
        costPerHa: land.areaHa ? lExpense / land.areaHa : 0,
        incomePerHa: land.areaHa ? lIncome / land.areaHa : 0,
        roi: lExpense ? (lIncome - lExpense) / lExpense : 0,
      };
    })
    .sort((a, b) => b.profit - a.profit);

  const cropPerformance = crops
    .filter((c) => !selectedLand || c.landId === selectedLand.id)
    .map((crop) => {
      const cRows = rows.filter((r) => r.cropId === crop.id);
      const cIncome = cRows.filter((r) => r.kind === "income").reduce((a, r) => a + r.amount, 0);
      const cExpense = cRows.filter((r) => r.kind === "expense").reduce((a, r) => a + r.amount, 0);
      const yieldKg = crop.actualYieldKg || crop.expectedYieldKg || 0;
      return {
        crop,
        income: cIncome,
        expense: cExpense,
        profit: cIncome - cExpense,
        yieldKg,
        costPerKg: yieldKg ? cExpense / yieldKg : 0,
        salePerKg: yieldKg ? cIncome / yieldKg : 0,
      };
    });

  const printHref = `/reports?${new URLSearchParams({ ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}), ...(sp.landId ? { landId: sp.landId } : {}) }).toString()}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="گزارش‌های مالی و تحلیلی"
        subtitle="سود و زیان دوره، بهای تمام‌شده هر محصول، جریان نقدی و عملکرد زمین‌ها؛ همه بر اساس داده‌های ثبت‌شده شما."
        icon="chart"
        actions={
          <Link href={printHref} className="btn btn-sm">
            <Icon name="calendar" className="h-3.5 w-3.5" />
            بازخوانی گزارش
          </Link>
        }
      />

      <Card className="card-pad">
        <form method="get" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="از تاریخ">
            <input name="from" type="date" defaultValue={sp.from ?? ""} className="input num" />
          </Field>
          <Field label="تا تاریخ">
            <input name="to" type="date" defaultValue={sp.to ?? ""} className="input num" />
          </Field>
          <Field label="زمین">
            <select name="landId" defaultValue={sp.landId ?? ""} className="input">
              <option value="">همه زمین‌ها</option>
              {lands.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary w-full">
              <Icon name="search" className="h-4 w-4" />
              اعمال فیلتر
            </button>
          </div>
          <div className="flex items-end">
            <Link href="/reports" className="btn w-full">
              حذف فیلتر
            </Link>
          </div>
        </form>
        <p className="mt-2 text-[10px] text-[#84907f]">
          {sp.from || sp.to ? `دوره: ${formatDate(sp.from)} تا ${formatDate(sp.to)}` : "دوره: همه رکوردهای ثبت‌شده"} ·{" "}
          {selectedLand ? `زمین: ${selectedLand.name}` : "همه زمین‌ها"} · {formatNumber(rows.length)} رکورد
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="درآمد دوره" value={formatMoney(income)} tone="farm" icon="chart" />
        <StatCard label="هزینه دوره" value={formatMoney(expense)} tone="clay" icon="receipt" />
        <StatCard label="سود دوره" value={formatMoney(profit)} tone={profit >= 0 ? "farm" : "red"} icon="wallet" />
        <StatCard label="حاشیه سود" value={pct(profit > 0 ? profit : 0, income)} tone="slate" icon="bolt" hint="سود ÷ درآمد" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="card-pad lg:col-span-2">
          <h2 className="section-title mb-2">صورت سود و زیان</h2>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-[11px] font-semibold text-farm-800">درآمدها</p>
              <ul className="divide-y divide-[#f3efe5]">
                {incomeGroups.map((g) => (
                  <li key={g.name} className="flex items-center justify-between gap-2 py-1.5 text-[11px]">
                    <span className="text-[#4a5a4c]">{g.name}</span>
                    <span className="num font-semibold text-farm-700">{formatMoney(g.amount)}</span>
                  </li>
                ))}
                {!incomeGroups.length ? <li className="py-1.5 text-[11px] text-[#84907f]">درآمدی در این دوره نیست</li> : null}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold text-clay-600">هزینه‌ها</p>
              <ul className="divide-y divide-[#f3efe5]">
                {expenseGroups.map((g) => (
                  <li key={g.name} className="flex items-center justify-between gap-2 py-1.5 text-[11px]">
                    <span className="text-[#4a5a4c]">{g.name}</span>
                    <span className="num font-semibold text-clay-600">{formatMoney(g.amount)}</span>
                  </li>
                ))}
                {!expenseGroups.length ? <li className="py-1.5 text-[11px] text-[#84907f]">هزینه‌ای در این دوره نیست</li> : null}
              </ul>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-farm-50 px-3 py-2.5">
              <span className="text-xs font-bold text-farm-900">سود / زیان دوره</span>
              <span className={`num text-sm font-extrabold ${profit >= 0 ? "text-farm-800" : "text-red-600"}`}>{formatMoney(profit)} تومان</span>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="card-pad">
            <h2 className="section-title mb-2 text-sm">نسبت‌های کلیدی</h2>
            <dl className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <dt className="text-[#7c8a7f]">نسبت هزینه به درآمد</dt>
                <dd className="num font-bold">{pct(expense, income)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#7c8a7f]">درآمد نقدی</dt>
                <dd className="num font-bold text-farm-700">{formatMoney(cashIncome)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#7c8a7f]">هزینه نقدی</dt>
                <dd className="num font-bold text-clay-600">{formatMoney(cashExpense)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#7c8a7f]">جریان نقدی خالص</dt>
                <dd className={`num font-bold ${cashIncome - cashExpense >= 0 ? "text-farm-700" : "text-red-600"}`}>
                  {formatMoney(cashIncome - cashExpense)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#7c8a7f]">سطح زیرکشت</dt>
                <dd className="num font-bold">{formatNumber(area, 1)} هکتار</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#7c8a7f]">هزینه هر هکتار</dt>
                <dd className="num font-bold">{area ? formatMoney(Math.round(expense / area)) : "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#7c8a7f]">درآمد هر هکتار</dt>
                <dd className="num font-bold">{area ? formatMoney(Math.round(income / area)) : "—"}</dd>
              </div>
            </dl>
          </Card>
          <Card className="card-pad">
            <h2 className="section-title mb-2 text-sm">ترکیب هزینه</h2>
            <Donut data={expenseGroups} centerLabel="سرفصل" centerValue={formatNumber(expenseGroups.length)} size={116} />
          </Card>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="card-pad">
          <h2 className="section-title mb-2 text-sm">جریان سود ماهانه</h2>
          <AreaChart points={monthly.map((m) => ({ label: m.label, value: m.profit }))} height={140} />
          <div className="mt-3">
            <HBar
              rows={expenseGroups.slice(0, 5).map((g) => ({ label: g.name, value: g.amount, hint: formatMoney(g.amount) }))}
            />
          </div>
        </Card>

        <Card className="card-pad">
          <h2 className="section-title mb-2 text-sm">عملکرد محصولات</h2>
          {cropPerformance.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>محصول</th>
                    <th>درآمد</th>
                    <th>هزینه</th>
                    <th>سود</th>
                    <th>بهای هر کیلو</th>
                    <th>فروش هر کیلو</th>
                  </tr>
                </thead>
                <tbody>
                  {cropPerformance.map((c) => (
                    <tr key={c.crop.id}>
                      <td className="text-xs font-semibold">{c.crop.name}</td>
                      <td className="num whitespace-nowrap text-[11px] text-farm-700">{formatMoney(c.income)}</td>
                      <td className="num whitespace-nowrap text-[11px] text-clay-600">{formatMoney(c.expense)}</td>
                      <td className={`num whitespace-nowrap text-[11px] font-bold ${c.profit >= 0 ? "text-farm-800" : "text-red-600"}`}>{formatMoney(c.profit)}</td>
                      <td className="num whitespace-nowrap text-[11px]">{c.costPerKg ? formatMoney(Math.round(c.costPerKg)) : "—"}</td>
                      <td className="num whitespace-nowrap text-[11px]">{c.salePerKg ? formatMoney(Math.round(c.salePerKg)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="محصولی ثبت نشده" />
          )}
          <p className="mt-2 text-[10px] leading-5 text-[#84907f]">
            بهای هر کیلو = هزینه‌های اختصاص‌یافته به همان کشت ÷ برداشت واقعی. برای پوشش هزینه‌های مشترک، هزینه‌ها را به کشت مربوطه نسبت دهید.
          </p>
        </Card>
      </div>

      <Card className="card-pad">
        <h2 className="section-title mb-2 text-sm">مقایسه اقتصادی زمین‌ها</h2>
        {landPerformance.length ? (
          <div className="space-y-3">
            {landPerformance.map((l) => (
              <div key={l.land.id} className="rounded-xl border border-[#f0ebdd] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-farm-900">
                    {l.land.name}
                    <span className="num mr-1 text-[10px] font-normal text-[#84907f]">({formatNumber(l.land.areaHa, 1)} هکتار)</span>
                  </span>
                  <Badge tone={l.profit >= 0 ? "green" : "red"}>{l.profit >= 0 ? "سودده" : "زیان‌ده"}</Badge>
                </div>
                <div className="num mt-2 grid grid-cols-2 gap-2 text-[10px] text-[#5b6a5e] sm:grid-cols-5">
                  <span>درآمد: {formatMoney(l.income)}</span>
                  <span>هزینه: {formatMoney(l.expense)}</span>
                  <span>سود: {formatMoney(l.profit)}</span>
                  <span>هزینه/هکتار: {formatMoney(Math.round(l.costPerHa))}</span>
                  <span>بازده سرمایه: {formatNumber(Math.round(l.roi * 100))}٪</span>
                </div>
                <div className="mt-2">
                  <Progress value={l.income + l.expense ? l.income / (l.income + l.expense) : 0} tone={l.profit >= 0 ? "farm" : "red"} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="زمینی ثبت نشده" />
        )}
      </Card>

      <Card className="card-pad bg-sand-50">
        <p className="text-xs leading-6 text-[#5b6a5e]">
          💡 خواندن گزارش: اگر حاشیه سود پایین و سرفصل «دستمزد کارگر» بزرگ‌ترین هزینه است، روی بهره‌وری برداشت کار کنید. اگر «هزینه هر هکتار» یک زمین
          بسیار بیشتر از بقیه است، آن قطعه را جدا بررسی کنید. سود مثبت با جریان نقدی منفی یعنی پول در فروش نسیه و طلب قفل شده است.
        </p>
      </Card>
    </div>
  );
}
