import Link from "next/link";
import { notFound } from "next/navigation";
import { addTradePayment, deleteTrade, deleteTradePayment, setTradeStatus } from "@/app/trade/actions";
import { Amount, Card, Field, Icon, PageHeader, Progress } from "@/components/ui";
import { formatDate, formatMoney, formatMoneyWords, formatNumber, todayJalali } from "@/lib/format";
import {
  DOC_ORDER,
  DOC_TYPES,
  TRADE_MODE_META,
  TRADE_STATUS_META,
  type DocType,
  type TradeCalc,
  type TradeStatus,
} from "@/lib/trade/engine";
import { balanceOf, calcOf, getDocuments, getPayments, getTrade, paidOf, progressOf } from "@/lib/trade/service";

export const dynamic = "force-dynamic";

const toman = (value: number) => `${formatNumber(value)} تومان`;

export default async function TradeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; paid?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tradeId = Number(id);
  if (!Number.isFinite(tradeId) || tradeId <= 0) notFound();
  const trade = await getTrade(tradeId);
  if (!trade) notFound();
  const [payments, documents] = await Promise.all([getPayments(tradeId), getDocuments(tradeId)]);
  const calc = calcOf(trade) as TradeCalc;
  const status = trade.status as TradeStatus;
  const balance = balanceOf(trade);
  const progress = progressOf(trade);
  const issued = new Map(documents.map((doc) => [doc.docType, doc]));

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${trade.cropName} — ${trade.code}`}
        subtitle={`${trade.sellerName} ← ${trade.buyerName} · ${TRADE_MODE_META[trade.mode as keyof typeof TRADE_MODE_META]?.label ?? trade.mode}`}
        icon="receipt"
        actions={
          <>
            <Link href={`/trade/${trade.id}/print/contract`} className="btn btn-primary">
              <Icon name="receipt" className="h-4 w-4" />
              چاپ اسناد
            </Link>
            <Link href="/trade" className="btn">
              <Icon name="arrow" className="h-4 w-4" />
              فهرست معاملات
            </Link>
          </>
        }
      />

      {sp.created ? <div className="rounded-xl border border-farm-200 bg-farm-50 p-3 text-xs text-farm-800">معامله با موفقیت ثبت شد و اسناد آن آماده چاپ است.</div> : null}
      {sp.paid ? <div className="rounded-xl border border-farm-200 bg-farm-50 p-3 text-xs text-farm-800">دریافتی ثبت و مانده حساب به‌روزرسانی شد.</div> : null}
      {sp.error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{sp.error}</div> : null}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Card className="card-pad">
          <span className="text-[10px] text-[#7d8b80]">مبلغ قابل تسویه</span>
          <Amount value={trade.totalToman} />
        </Card>
        <Card className="card-pad">
          <span className="text-[10px] text-[#7d8b80]">دریافتی</span>
          <Amount value={paidOf(trade)} tone="income" showWords={false} />
          <div className="mt-1.5">
            <Progress value={progress / 100} tone={progress >= 100 ? "farm" : "clay"} />
            <span className="mt-1 block text-[10px] text-[#84907f] num">{progress}٪ تسویه‌شده</span>
          </div>
        </Card>
        <Card className="card-pad">
          <span className="text-[10px] text-[#7d8b80]">مانده طلب</span>
          <Amount value={balance} tone={balance > 0 ? "expense" : "income"} />
        </Card>
        <Card className="card-pad">
          <span className="text-[10px] text-[#7d8b80]">وضعیت / سررسید</span>
          <span className="mt-1 block text-xs font-bold text-farm-900">{TRADE_STATUS_META[status]?.label ?? status}</span>
          <span className="mt-1 block text-[10px] text-[#84907f]">سررسید: {trade.dueDate ? formatDate(trade.dueDate) : "تعیین نشده"}</span>
          <span className="mt-1 block text-[10px] text-[#84907f]">تاریخ قرارداد: {formatDate(trade.contractDate)}</span>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <Card className="card-pad">
            <h2 className="section-title">خلاصه معامله</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Info label="فروشنده" value={`${trade.sellerName}${trade.sellerNationalId ? ` — ${trade.sellerNationalId}` : ""}`} />
              <Info label="خریدار" value={`${trade.buyerName}${trade.buyerNationalId ? ` — ${trade.buyerNationalId}` : ""}`} />
              <Info label="محصول / رقم" value={`${trade.cropName}${trade.variety ? ` — ${trade.variety}` : ""}`} />
              <Info label="محل تحویل" value={trade.deliveryPlace || "—"} />
              <Info label="تاریخ تحویل" value={trade.deliveryDate ? formatDate(trade.deliveryDate) : "—"} />
              <Info label="پلاک خودرو / راننده" value={[trade.vehiclePlate, trade.driverName].filter(Boolean).join(" — ") || "—"} />
              <Info label="قیمت هر کیلو" value={`${formatNumber(trade.pricePerKgToman)} تومان`} />
              <Info label="درجه کیفی" value={`${trade.gradeLabel} · کیفیت ${calc.quality?.score ?? "—"}/۱۰۰`} />
            </div>
            {trade.notes ? <p className="mt-2 rounded-lg bg-sand-50 p-2 text-[11px] leading-5 text-[#4a5a4c]">{trade.notes}</p> : null}
          </Card>

          <Card className="card-pad">
            <h2 className="section-title">وزن و کسرات</h2>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Mini label="وزن خالص" value={`${formatNumber(trade.netKg)} kg`} />
              <Mini label="وزن تعدیل‌شده" value={`${formatNumber(trade.adjustedKg)} kg`} />
              <Mini label="کل کسر" value={`${formatNumber(Math.max(0, trade.netKg - trade.adjustedKg))} kg`} />
              <Mini label="ضریب" value={`${(Number(calc.weights?.factor ?? 0) * 100).toFixed(1)}٪`} />
            </div>
            <table className="table mt-2">
              <thead>
                <tr>
                  <th>شرح</th>
                  <th>جزئیات</th>
                  <th>اثر</th>
                </tr>
              </thead>
              <tbody>
                {(calc.steps ?? []).map((step) => (
                  <tr key={step.key}>
                    <td className="text-[11px] font-medium">{step.label}</td>
                    <td className="text-[10px] leading-5 text-[#6a7a6d]">{step.detail}</td>
                    <td className="num text-[11px]">
                      {step.weightKg !== undefined ? `${formatNumber(step.weightKg)} kg` : null}
                      {step.amountToman !== undefined && step.amountToman !== 0 ? <span className="block">{formatMoney(step.amountToman)}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {calc.errors?.length ? (
              <ul className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] leading-5 text-red-800">
                {calc.errors.map((error) => <li key={error}>• {error}</li>)}
              </ul>
            ) : null}
            {calc.warnings?.length ? (
              <ul className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">
                {calc.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
              </ul>
            ) : null}
          </Card>

          <Card className="card-pad">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="section-title">دریافتی‌ها و تسویه</h2>
              <span className="chip">مانده {toman(balance)}</span>
            </div>
            {payments.length === 0 ? (
              <p className="mt-2 rounded-lg bg-sand-50 p-2 text-[11px] text-[#6a7a6d]">هنوز دریافتی ثبت نشده است. پیش‌پرداخت زمان قرارداد: {toman(trade.prepaidToman)}</p>
            ) : (
              <table className="table mt-2">
                <thead>
                  <tr>
                    <th>تاریخ</th>
                    <th>روش</th>
                    <th>مبلغ</th>
                    <th>مرجع / یادداشت</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="text-[11px]">{formatDate(payment.paidAt)}</td>
                      <td className="text-[11px]">{{ cash: "نقدی", bank: "بانکی", cheque: "چک", deduction: "تهاتر" }[payment.method] ?? payment.method}</td>
                      <td className="num text-[11px] font-bold">{formatMoney(payment.amountToman)}</td>
                      <td className="text-[10px] text-[#6a7a6d]">{[payment.reference, payment.note].filter(Boolean).join(" — ") || "—"}</td>
                      <td>
                        <form action={deleteTradePayment}>
                          <input type="hidden" name="id" value={payment.id} />
                          <input type="hidden" name="tradeId" value={trade.id} />
                          <button type="submit" className="btn btn-sm text-red-700">
                            <Icon name="trash" className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {balance > 0 ? (
              <form action={addTradePayment} className="mt-3 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="tradeId" value={trade.id} />
                <Field label="مبلغ دریافتی (تومان) *">
                  <input name="amountToman" required inputMode="numeric" className="input num" placeholder={String(balance)} />
                </Field>
                <Field label="تاریخ دریافت (شمسی) *">
                  <input name="paidAt" required defaultValue={todayJalali()} className="input num" placeholder="۱۴۰۴/۰۳/۱۵" />
                </Field>
                <Field label="روش">
                  <select name="method" className="input" defaultValue="bank">
                    <option value="bank">واریز بانکی</option>
                    <option value="cash">نقدی</option>
                    <option value="cheque">چک</option>
                    <option value="deduction">تهاتر / کسر از بدهی</option>
                  </select>
                </Field>
                <Field label="شماره پیگیری / چک">
                  <input name="reference" className="input num" />
                </Field>
                <Field label="یادداشت" className="sm:col-span-2">
                  <input name="note" className="input" placeholder="مثلاً علی‌الحساب کارخانه" />
                </Field>
                <div className="sm:col-span-2">
                  <button className="btn btn-primary w-full sm:w-auto" type="submit">
                    <Icon name="plus" className="h-4 w-4" />
                    ثبت دریافتی
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-2 rounded-lg border border-farm-200 bg-farm-50 p-2 text-[11px] font-medium text-farm-800">این معامله کامل تسویه شده است. مبلغ به حروف: {formatMoneyWords(trade.totalToman)}</p>
            )}
          </Card>
        </div>

        <div className="space-y-3">
          <Card className="card-pad">
            <h2 className="section-title">اسناد رسمی</h2>
            <p className="mt-1 text-[10px] leading-5 text-[#84907f]">هر سند در اولین بازدید شماره سریال می‌گیرد و در پایگاه داده ثبت می‌شود.</p>
            <div className="mt-2 space-y-2">
              {DOC_ORDER.map((docType: DocType) => {
                const doc = issued.get(docType);
                return (
                  <div key={docType} className="flex items-center justify-between gap-2 rounded-xl border border-[#eee9dc] p-2">
                    <div className="min-w-0">
                      <span className="block truncate text-[11px] font-bold text-farm-900">{DOC_TYPES[docType].title}</span>
                      <span className="block truncate text-[10px] text-[#84907f]">
                        {doc ? `سریال ${doc.serial} · ${formatDate(doc.issuedAt)}` : "صادر نشده — با باز کردن، صادر می‌شود"}
                      </span>
                    </div>
                    <Link href={`/trade/${trade.id}/print/${docType}`} className={`btn btn-sm ${doc ? "" : "btn-primary"}`}>
                      <Icon name="receipt" className="h-3.5 w-3.5" />
                      {doc ? "چاپ مجدد" : "صدور"}
                    </Link>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="card-pad">
            <h2 className="section-title">تغییر وضعیت</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["draft", "confirmed", "settled", "canceled"] as TradeStatus[]).map((next) => (
                <form key={next} action={setTradeStatus}>
                  <input type="hidden" name="id" value={trade.id} />
                  <input type="hidden" name="status" value={next} />
                  <button type="submit" disabled={status === next} className={`btn btn-sm ${next === "settled" ? "btn-primary" : ""}`}>
                    {TRADE_STATUS_META[next].label}
                  </button>
                </form>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-5 text-[#84907f]">
              وضعیت «تسویه‌شده» تنها وقتی پذیرفته می‌شود که مجموع دریافتی‌ها به مبلغ کل برسد. اعداد سند پس از ثبت تغییر نمی‌کنند تا اسناد چاپی
              معتبر بمانند.
            </p>
            <details className="mt-2 rounded-lg border border-red-100 bg-red-50/40 p-2">
              <summary className="cursor-pointer text-[11px] font-semibold text-red-800">حذف این معامله</summary>
              <p className="mt-1 text-[10px] leading-5 text-red-800">حذف، دریافتی‌ها و اسناد مرتبط را هم پاک می‌کند و قابل بازگشت نیست.</p>
              <form action={deleteTrade} className="mt-2">
                <input type="hidden" name="id" value={trade.id} />
                <button type="submit" className="btn btn-sm text-red-700">
                  <Icon name="trash" className="h-3.5 w-3.5" />
                  حذف قطعی
                </button>
              </form>
            </details>
          </Card>

          <Card className="card-pad bg-sand-50">
            <h2 className="section-title">هوش محاسبه</h2>
            <ul className="mt-2 space-y-1 text-[11px] leading-5 text-[#4a5a4c]">
              <li>• موتور محاسبه نسخه {trade.engineVersion} — قطعی و بدون وابستگی به هوش مصنوعی.</li>
              <li>• کیفیت {calc.quality?.score ?? "—"} از ۱۰۰ و درجه {trade.gradeLabel}.</li>
              <li>• اختلاف قیمت با نرخ مرجع: {calc.price?.gapToBenchmarkPct ?? 0}٪</li>
              <li>• حق بیمه: {toman(calc.money?.insuranceToman ?? 0)} · مالیات: {toman(calc.money?.vatToman ?? 0)}</li>
              <li>• کارمزد و هزینه‌های کسرشده: {toman(calc.money?.sellerFeesToman ?? 0)}</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-sand-50 px-2 py-1.5">
      <span className="block text-[10px] text-[#84907f]">{label}</span>
      <span className="block text-[11px] font-medium text-[#22331f]">{value}</span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#eee9dc] px-2 py-1.5">
      <span className="block text-[10px] text-[#84907f]">{label}</span>
      <span className="num block text-[11px] font-bold text-[#22331f]">{value}</span>
    </div>
  );
}
