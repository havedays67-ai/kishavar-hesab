import Link from "next/link";
import { getFarmOverview, getTasks } from "@/lib/data";
import { formatDate, formatMoney, formatMoneyWords, formatNumber, pct, todayISO, statusLabel } from "@/lib/format";
import { Card, Icon, StatCard, Badge, Progress, EmptyState } from "@/components/ui";
import { MonthlyBars, Donut } from "@/components/charts";
import { toggleTask } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [o, tasks] = await Promise.all([getFarmOverview(), getTasks()]);
  const openTasks = tasks.filter((t) => t.status === "open").slice(0, 4);
  const profitTone = o.totals.profit >= 0 ? "farm" : "red";

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl border border-farm-800/20 bg-gradient-to-br from-farm-800 via-farm-700 to-farm-900 p-4 text-white shadow-lg sm:p-6">
        <div className="absolute -left-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 right-10 h-40 w-40 rounded-full bg-[#d8a24a]/20 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">
              <Icon name="calendar" className="h-3.5 w-3.5" />
              {formatDate(todayISO())}
            </span>
            <h1 className="mt-2.5 text-xl font-extrabold sm:text-2xl">سلام کشاورز عزیز 🌾</h1>
            <p className="mt-1 max-w-lg text-xs leading-6 text-farm-100 sm:text-sm">
              {o.totals.landArea > 0
                ? `${formatNumber(o.totals.landArea, 1)} هکتار زمین، ${formatNumber(o.totals.activeCrops)} کشت فعال. سود خالص تا امروز ${formatMoney(
                    o.totals.profit,
                  )} است (${formatMoneyWords(o.totals.profit)}).`
                : "برای شروع، زمین و کشت خود را ثبت کنید یا از دستیار هوشمند بخواهید اطلاعات را وارد کند."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/assistant" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-farm-800 shadow-sm">
                <Icon name="sparkles" className="h-4 w-4" />
                گفتگو با دستیار هوشمند
              </Link>
              <Link href="/transactions" className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 px-3 py-2 text-xs font-semibold text-white">
                <Icon name="plus" className="h-4 w-4" />
                ثبت سریع هزینه
              </Link>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-2">
            <div className="rounded-xl bg-white/10 p-3">
              <span className="block text-[10px] text-farm-100">درآمد کل</span>
              <span className="num mt-1 block text-sm font-bold">{formatMoney(o.totals.income)}</span>
              <span className="num mt-0.5 block text-[9px] text-farm-100/90">{formatMoneyWords(o.totals.income)}</span>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <span className="block text-[10px] text-farm-100">هزینه کل</span>
              <span className="num mt-1 block text-sm font-bold">{formatMoney(o.totals.expense)}</span>
              <span className="num mt-0.5 block text-[9px] text-farm-100/90">{formatMoneyWords(o.totals.expense)}</span>
            </div>
            <div className="col-span-2 rounded-xl bg-[#d8a24a]/20 p-3">
              <span className="block text-[10px] text-farm-100">حاشیه سود</span>
              <span className="num mt-1 block text-lg font-extrabold">{pct(o.totals.profit > 0 ? o.totals.profit : 0, o.totals.income)}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="سود / زیان خالص" value={`${formatMoney(o.totals.profit)}`} tone={profitTone} icon="chart" hint={`درآمد منهای هزینه · ${formatMoneyWords(o.totals.profit)}`} />
        <StatCard label="هزینه هر هکتار" value={o.totals.landArea ? `${formatMoney(Math.round(o.totals.expense / o.totals.landArea))}` : "—"} tone="clay" icon="land" hint={o.totals.landArea ? formatMoneyWords(Math.round(o.totals.expense / o.totals.landArea)) : "برای مقایسه قطعات"} />
        <StatCard label="بدهی + چک نزدیک" value={`${formatMoney(o.totals.payable + o.totals.chequeUpcoming)}`} tone="red" icon="wallet" hint={formatMoneyWords(o.totals.payable + o.totals.chequeUpcoming)} />
        <StatCard label="طلب از دیگران" value={`${formatMoney(o.totals.receivable)}`} tone="slate" icon="phone" hint={formatMoneyWords(o.totals.receivable)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="card-pad lg:col-span-2">
          <div className="section-title mb-3">
            <span className="flex items-center gap-1.5">
              <Icon name="chart" className="h-4 w-4 text-farm-600" />
              روند درآمد و هزینه ماهانه
            </span>
            <Link href="/reports" className="link-quiet">
              گزارش کامل ←
            </Link>
          </div>
          <MonthlyBars data={o.monthly} height={170} />
        </Card>

        <Card className="card-pad">
          <div className="section-title mb-3">
            <span className="flex items-center gap-1.5">
              <Icon name="receipt" className="h-4 w-4 text-clay-600" />
              ترکیب هزینه‌ها
            </span>
          </div>
          <Donut
            data={o.expenseBreakdown}
            centerLabel="سرفصل"
            centerValue={`${formatNumber(o.expenseBreakdown.length)} مورد`}
          />
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="card-pad lg:col-span-2">
          <div className="section-title mb-3">
            <span className="flex items-center gap-1.5">
              <Icon name="alert" className="h-4 w-4 text-amber-600" />
              هشدارهای هوشمند
            </span>
            <span className="chip">{formatNumber(o.alerts.length)} مورد</span>
          </div>
          {o.alerts.length ? (
            <ul className="space-y-2">
              {o.alerts.map((alert, index) => (
                <li key={`${alert.title}-${index}`}>
                  <Link
                    href={alert.href}
                    className={`flex items-center justify-between gap-2 rounded-xl bg-sand-50 px-3 py-2.5 text-xs transition hover:bg-sand-100 ${
                      alert.severity === "high" ? "alert-high" : alert.severity === "medium" ? "alert-medium" : "alert-low"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-[#2b3a2e]">{alert.title}</span>
                      <span className="num mt-0.5 block text-[10px] text-[#7c8a7f]">{alert.detail}</span>
                    </span>
                    <Icon name="arrow" className="h-4 w-4 shrink-0 text-[#84907f]" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="هشداری وجود ندارد" hint="موجودی انبار، چک‌ها و بدهی‌ها در وضعیت مناسب هستند." />
          )}
        </Card>

        <Card className="card-pad">
          <div className="section-title mb-3">
            <span className="flex items-center gap-1.5">
              <Icon name="check" className="h-4 w-4 text-farm-600" />
              کارهای پیش‌رو
            </span>
          </div>
          {openTasks.length ? (
            <ul className="space-y-2">
              {openTasks.map((task) => (
                <li key={task.id} className="flex items-start justify-between gap-2 rounded-xl border border-[#f0ebdd] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#2b3a2e]">{task.title}</p>
                    <p className="num mt-0.5 text-[10px] text-[#84907f]">
                      {task.dueDate ? formatDate(task.dueDate) : "بدون موعد"} · {statusLabel(task.priority)}
                    </p>
                  </div>
                  <form action={toggleTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <button type="submit" className="btn btn-sm" title="انجام شد">
                      <Icon name="check" className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="کار بازی نیست" hint="می‌توانید از دستیار بخواهید یادآوری بسازد." />
          )}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="card-pad">
          <div className="section-title mb-3">
            <span className="flex items-center gap-1.5">
              <Icon name="land" className="h-4 w-4 text-farm-600" />
              اقتصاد قطعات زمین
            </span>
            <Link href="/lands" className="link-quiet">
              همه زمین‌ها ←
            </Link>
          </div>
          <div className="space-y-3">
            {o.landStats.map((l) => (
              <div key={l.land.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <Link href={`/lands/${l.land.id}`} className="truncate font-semibold text-farm-900 hover:underline">
                    {l.land.name}
                    <span className="num mr-1 font-normal text-[#84907f]">({formatNumber(l.land.areaHa, 1)} هکتار)</span>
                  </Link>
                  <span className={`num shrink-0 font-bold ${l.profit >= 0 ? "text-farm-700" : "text-red-600"}`}>
                    {formatMoney(l.profit)}
                  </span>
                </div>
                <Progress
                  value={l.income + l.expense > 0 ? Math.min(1, l.income / Math.max(l.income + l.expense, 1)) : 0}
                  tone={l.profit >= 0 ? "farm" : "red"}
                />
              </div>
            ))}
            {!o.landStats.length ? <EmptyState title="زمینی ثبت نشده" hint="از صفحه زمین و کشت شروع کنید." /> : null}
          </div>
        </Card>

        <Card className="card-pad">
          <div className="section-title mb-3">
            <span className="flex items-center gap-1.5">
              <Icon name="receipt" className="h-4 w-4 text-farm-600" />
              آخرین عملیات مالی
            </span>
            <Link href="/transactions" className="link-quiet">
              دفتر کامل ←
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>تاریخ</th>
                  <th>شرح</th>
                  <th>دسته</th>
                  <th>مبلغ</th>
                </tr>
              </thead>
              <tbody>
                {o.recent.map((t) => (
                  <tr key={t.id}>
                    <td className="num whitespace-nowrap text-[11px] text-[#7c8a7f]">{formatDate(t.date)}</td>
                    <td className="max-w-[140px] truncate text-xs">{t.description || t.party || "—"}</td>
                    <td className="whitespace-nowrap">
                      <Badge tone={t.kind === "income" ? "green" : "amber"}>
                        {t.categoryIcon} {t.categoryName ?? "—"}
                      </Badge>
                    </td>
                    <td className={`num whitespace-nowrap text-xs font-bold ${t.kind === "income" ? "text-farm-700" : "text-clay-600"}`}>
                      {t.kind === "income" ? "+" : "−"} {formatMoney(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!o.recent.length ? <EmptyState title="هنوز تراکنشی ثبت نشده" /> : null}
        </Card>
      </div>

      {o.lowStock.length ? (
        <Card className="card-pad">
          <div className="section-title mb-3">
            <span className="flex items-center gap-1.5">
              <Icon name="box" className="h-4 w-4 text-red-500" />
              نیاز فوری به تأمین نهاده
            </span>
            <Link href="/inventory" className="link-quiet">
              انبار ←
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {o.lowStock.map((item) => (
              <div key={item.id} className="rounded-xl border border-red-100 bg-red-50/60 px-3 py-2">
                <p className="text-xs font-semibold text-red-800">{item.name}</p>
                <p className="num mt-0.5 text-[10px] text-red-700">
                  موجودی {formatNumber(item.quantity, 1)} {item.unit} — حد سفارش {formatNumber(item.reorderLevel, 1)} {item.unit}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
