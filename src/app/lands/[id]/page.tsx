import Link from "next/link";
import { notFound } from "next/navigation";
import { getCrops, getFarmOverview, getLabor, getLands, listTransactions } from "@/lib/data";
import { formatDate, formatMoney, formatMoneyWords, formatNumber, statusLabel } from "@/lib/format";
import { Badge, Card, EmptyState, Icon, PageHeader, Progress, StatCard } from "@/components/ui";
import { DeleteForm } from "@/components/record-actions";
import { deleteLabor, deleteTransaction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function LandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const landId = Number(id);
  if (!Number.isFinite(landId)) notFound();

  const [lands, o, cropRows, txnRows, laborRows] = await Promise.all([
    getLands(),
    getFarmOverview(),
    getCrops(landId),
    listTransactions({ landId, limit: 60 }),
    getLabor(120),
  ]);
  const land = lands.find((l) => l.id === landId);
  if (!land) notFound();

  const stat = o.landStats.find((s) => s.land.id === landId);
  const income = stat?.income ?? 0;
  const expense = stat?.expense ?? 0;
  const profit = income - expense;
  const landLabor = laborRows.filter((l) => l.landId === landId);

  return (
    <div className="space-y-4">
      <PageHeader
        title={land.name}
        subtitle={`${formatNumber(land.areaHa, 1)} هکتار · ${land.region || "منطقه نامشخص"} · ${land.irrigation || "آبیاری نامشخص"}`}
        icon="land"
        actions={
          <Link href="/lands" className="btn btn-sm">
            <Icon name="arrow" className="h-3.5 w-3.5" />
            همه زمین‌ها
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="درآمد این قطعه" value={formatMoney(income)} hint={formatMoneyWords(income)} tone="farm" icon="chart" />
        <StatCard label="هزینه این قطعه" value={formatMoney(expense)} hint={formatMoneyWords(expense)} tone="clay" icon="receipt" />
        <StatCard label="سود قطعه" value={formatMoney(profit)} hint={formatMoneyWords(profit)} tone={profit >= 0 ? "farm" : "red"} icon="wallet" />
        <StatCard label="هزینه هر هکتار" value={formatMoney(Math.round(stat?.costPerHa ?? 0))} tone="slate" icon="land" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="card-pad">
          <h2 className="section-title mb-2">مشخصات</h2>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-[#7c8a7f]">نوع مالکیت</dt>
              <dd className="font-medium">
                {land.ownership === "shared" ? `مشارکتی (${formatNumber(land.sharePercent)}٪)` : land.ownership === "leased" ? "اجاره‌ای" : "ملکی"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[#7c8a7f]">نوع خاک</dt>
              <dd className="font-medium">{land.soilType || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[#7c8a7f]">روش آبیاری</dt>
              <dd className="font-medium">{land.irrigation || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[#7c8a7f]">درآمد هر هکتار</dt>
              <dd className="num font-medium">{formatMoney(Math.round(stat?.incomePerHa ?? 0))}</dd>
            </div>
          </dl>
          {land.notes ? <p className="mt-3 rounded-xl bg-sand-50 p-3 text-[11px] leading-5 text-[#5b6a5e]">{land.notes}</p> : null}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[10px] text-[#7c8a7f]">
              <span>نسبت درآمد به کل گردش قطعه</span>
              <span className="num">{income + expense ? `${Math.round((income / (income + expense)) * 100)}٪` : "—"}</span>
            </div>
            <Progress value={income + expense ? income / (income + expense) : 0} />
          </div>
        </Card>

        <Card className="card-pad lg:col-span-2">
          <div className="section-title mb-2">
            <span>کشت‌های این قطعه</span>
            <Link href="/crops" className="link-quiet">همه کشت‌ها ←</Link>
          </div>
          {cropRows.length ? (
            <div className="space-y-2">
              {cropRows.map((crop) => {
                const cs = o.cropStats.find((c) => c.crop.id === crop.id);
                return (
                  <div key={crop.id} className="rounded-xl border border-[#f0ebdd] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-farm-900">
                        {crop.name} {crop.variety ? `· ${crop.variety}` : ""}
                      </span>
                      <Badge tone={crop.status === "harvested" ? "green" : crop.status === "planned" ? "neutral" : "amber"}>
                        {statusLabel(crop.status)}
                      </Badge>
                    </div>
                    <div className="num mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#7c8a7f]">
                      <span>کاشت: {formatDate(crop.plantingDate)}</span>
                      <span>برداشت: {formatDate(crop.harvestDate)}</span>
                      <span>عملکرد: {formatNumber(crop.actualYieldKg || crop.expectedYieldKg)} کیلو</span>
                      {cs ? <span>سود کشت: {formatMoney(cs.profit)}</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="کشتی در این زمین ثبت نشده" hint="از صفحه زمین و کشت، کشت جدید اضافه کنید." />
          )}
        </Card>
      </div>

      <Card className="card-pad">
        <div className="section-title mb-2">
          <span>تراکنش‌های این قطعه</span>
          <Link href={`/transactions?landId=${land.id}`} className="link-quiet">فیلتر در دفتر ←</Link>
        </div>
        {txnRows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>تاریخ</th>
                  <th>نوع</th>
                  <th>دسته</th>
                  <th>شرح</th>
                  <th>طرف حساب</th>
                  <th>مبلغ (ریال)</th>
                  <th>حذف</th>
                </tr>
              </thead>
              <tbody>
                {txnRows.slice(0, 12).map((t) => (
                  <tr key={t.id}>
                    <td className="num whitespace-nowrap text-[11px] text-[#7c8a7f]">{formatDate(t.date)}</td>
                    <td>
                      <Badge tone={t.kind === "income" ? "green" : "amber"}>{t.kind === "income" ? "درآمد" : "هزینه"}</Badge>
                    </td>
                    <td className="whitespace-nowrap text-xs">{t.categoryName ?? "—"}</td>
                    <td className="max-w-[200px] truncate text-xs">{t.description || "—"}</td>
                    <td className="whitespace-nowrap text-[11px] text-[#7c8a7f]">{t.party || "—"}</td>
                    <td className={`num whitespace-nowrap text-xs font-bold ${t.kind === "income" ? "text-farm-700" : "text-clay-600"}`}>
                      {formatMoney(t.amount)}
                      <span className="mt-0.5 block text-[9px] font-normal text-[#84907f]">{formatMoneyWords(t.amount)}</span>
                    </td>
                    <td>
                      <DeleteForm action={deleteTransaction} id={t.id} label="حذف تراکنش" confirmText={`تراکنش ${formatMoney(t.amount)} حذف شود؟`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="تراکنشی ثبت نشده" />
        )}
      </Card>

      <Card className="card-pad">
        <h2 className="section-title mb-2">دستمزدهای این قطعه</h2>
        {landLabor.length ? (
          <ul className="space-y-2">
            {landLabor.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 rounded-xl border border-[#f0ebdd] px-3 py-2 text-xs">
                <span className="truncate">
                  {l.workerName} — {l.task}
                </span>
                <span className="num shrink-0 font-semibold">{formatMoney(l.amount)}</span>
                <Badge tone={l.paid ? "green" : "red"}>{l.paid ? "پرداخت‌شده" : "پرداخت‌نشده"}</Badge>
                <DeleteForm action={deleteLabor} id={l.id} label="حذف دستمزد" confirmText="این دستمزد حذف شود؟" />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="دستمزدی برای این قطعه ثبت نشده" />
        )}
      </Card>
    </div>
  );
}
