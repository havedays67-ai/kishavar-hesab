import { getCrops, getInventory, getMoves } from "@/lib/data";
import { formatDate, formatMoney, formatMoneyWords, formatNumber, todayISO } from "@/lib/format";
import { Amount, Badge, Card, Disclosure, EmptyState, Field, Icon, PageHeader, StatCard } from "@/components/ui";
import { createItem, createMove } from "@/app/actions";
import { RecordActions } from "@/components/RecordActions";

import { ReceiptUploader } from "@/components/Receipts";
export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [items, moves, crops] = await Promise.all([getInventory(), getMoves(40), getCrops()]);
  const totalValue = items.reduce((a, i) => a + i.quantity * i.unitCost, 0);
  const lowStock = items.filter((i) => i.quantity <= i.reorderLevel);

  return (
    <div className="space-y-4">
      <PageHeader
        title="انبار نهاده‌ها"
        subtitle="بذر، کود، سم، سوخت و بسته‌بندی را پایش کنید. خروج نهاده را به کشت نسبت دهید تا هزینه محصول دقیق شود."
        icon="box"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="اقلام انبار" value={formatNumber(items.length)} tone="slate" icon="box" />
        <StatCard label="ارزش موجودی" value={formatMoney(Math.round(totalValue))} hint={formatMoneyWords(Math.round(totalValue))} tone="farm" icon="wallet" />
        <StatCard label="زیر حد سفارش" value={formatNumber(lowStock.length)} tone={lowStock.length ? "red" : "farm"} icon="alert" />
        <StatCard label="حرکت‌های ثبت‌شده" value={formatNumber(moves.length)} tone="clay" icon="receipt" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Disclosure title="افزودن کالای جدید به انبار">
          <form action={createItem} className="grid gap-3 sm:grid-cols-2">
            <Field label="نام کالا *">
              <input name="name" required placeholder="کود اوره" className="input" />
            </Field>
            <Field label="واحد">
              <select name="unit" className="input" defaultValue="کیلوگرم">
                <option>کیلوگرم</option>
                <option>لیتر</option>
                <option>عدد</option>
                <option>بوته</option>
                <option>کیسه</option>
                <option>تن</option>
              </select>
            </Field>
            <Field label="گروه">
              <select name="category" className="input" defaultValue="نهاده">
                <option>بذر</option>
                <option>کود</option>
                <option>سم</option>
                <option>سوخت</option>
                <option>بسته‌بندی</option>
                <option>نهاده</option>
                <option>سایر</option>
              </select>
            </Field>
            <Field label="موجودی اولیه">
              <input name="quantity" type="number" step="0.1" min="0" className="input num" />
            </Field>
            <Field label="حد سفارش (هشدار)">
              <input name="reorderLevel" type="number" step="0.1" min="0" className="input num" />
            </Field>
            <Field label="بهای واحد (تومان)" hint="ورودی به تومان؛ نمایش به ریال.">
              <input name="unitCost" type="text" inputMode="numeric" className="input num" />
            </Field>
            <Field label="انبار">
              <input name="warehouse" defaultValue="انبار مرکزی" className="input" />
            </Field>
            <div className="flex items-end">
              <button type="submit" className="btn btn-primary w-full">
                <Icon name="plus" className="h-4 w-4" />
                ثبت کالا
              </button>
            </div>
          </form>
        </Disclosure>

        <Disclosure title="ثبت ورود / خروج انبار">
          {items.length ? (
            <form action={createMove} className="grid gap-3 sm:grid-cols-2">
              <Field label="کالا *">
                <select name="itemId" required className="input">
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} — موجودی {formatNumber(i.quantity, 1)} {i.unit}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="نوع حرکت">
                <select name="kind" className="input" defaultValue="out">
                  <option value="out">خروج (مصرف)</option>
                  <option value="in">ورود (خرید/رسید)</option>
                </select>
              </Field>
              <Field label="مقدار *">
                <input name="quantity" required type="number" step="0.1" min="0.1" className="input num" />
              </Field>
              <Field label="بهای واحد (اختیاری)">
                <input name="unitCost" type="text" inputMode="numeric" className="input num" />
              </Field>
              <Field label="تاریخ">
                <input name="date" type="date" defaultValue={todayISO()} className="input num" />
              </Field>
              <Field label="کشت مربوطه">
                <select name="cropId" className="input" defaultValue="">
                  <option value="">بدون کشت</option>
                  {crops.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.landName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="توضیح" className="sm:col-span-2">
                <input name="note" placeholder="مثلاً مصرف کود سرک گندم" className="input" />
              </Field>
              <div className="sm:col-span-2">
                <button type="submit" className="btn btn-primary w-full sm:w-auto">
                  <Icon name="check" className="h-4 w-4" />
                  ثبت حرکت انبار
                </button>
              </div>
            </form>
          ) : (
            <EmptyState title="ابتدا کالایی به انبار اضافه کنید" />
          )}
        </Disclosure>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>کالا</th>
                <th>گروه</th>
                <th>موجودی</th>
                <th>حد سفارش</th>
                <th>بهای واحد</th>
                <th>ارزش</th>
                <th>وضعیت</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const low = item.quantity <= item.reorderLevel;
                return (
                  <tr key={item.id} className={low ? "bg-red-50/40" : ""}>
                    <td className="text-xs font-semibold">{item.name}</td>
                    <td className="text-[11px] text-[#7c8a7f]">{item.category}</td>
                    <td className="num whitespace-nowrap text-xs font-bold">
                      {formatNumber(item.quantity, 1)} {item.unit}
                    </td>
                    <td className="num whitespace-nowrap text-[11px] text-[#7c8a7f]">{formatNumber(item.reorderLevel, 1)}</td>
                    <td><Amount value={item.unitCost} tone="muted" showWords={false} className="text-[11px]" /></td>
                    <td><Amount value={Math.round(item.quantity * item.unitCost)} showWords={false} className="text-xs" /></td>
                    <td>
                      <Badge tone={low ? "red" : "green"}>{low ? "نیاز به سفارش" : "کافی"}</Badge>
                    </td>
                    <td>
                      <RecordActions entity="inventory_items" id={item.id} label={`کالای ${item.name}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!items.length ? <div className="p-4"><EmptyState title="انبار خالی است" /></div> : null}
      </Card>

      <Card className="card-pad">
        <h2 className="section-title mb-2">آخرین حرکات انبار</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>کالا</th>
                <th>نوع</th>
                <th>مقدار</th>
                <th>توضیح</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id}>
                  <td className="num whitespace-nowrap text-[11px] text-[#7c8a7f]">{formatDate(m.date)}</td>
                  <td className="text-xs">{m.itemName}</td>
                  <td>
                    <Badge tone={m.kind === "in" ? "green" : "amber"}>{m.kind === "in" ? "ورود" : "خروج"}</Badge>
                  </td>
                  <td className="num whitespace-nowrap text-xs">
                    {formatNumber(m.quantity, 1)} {m.unit}
                  </td>
                  <td className="max-w-[240px] truncate text-[11px] text-[#7c8a7f]">{m.note || "—"}</td>
                  <td><RecordActions entity="inventory_moves" id={m.id} label={`حرکت انبار ${m.itemName}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!moves.length ? <EmptyState title="حرکتی ثبت نشده" /> : null}
      </Card>
      <ReceiptUploader
        section="inventory"
        heading="آپلود فاکتور و رسید انبار"
        subtitle="فاکتور خرید کود، بذر و سم، یا رسید تحویل نهاده را ضمیمه کنید."
      />

    </div>
  );
}
