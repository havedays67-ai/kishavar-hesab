import { getCrops, getInventory, getMoves } from "@/lib/data";
import { formatDate, formatMoney, formatMoneyWords, formatNumber, todayISO } from "@/lib/format";
import { Badge, Card, Disclosure, EmptyState, Field, Icon, PageHeader, StatCard } from "@/components/ui";
import { Money } from "@/components/money";
import { AmountInput } from "@/components/forms";
import { DeleteForm, EditPanel } from "@/components/record-actions";
import { createItem, createMove, deleteItem, deleteMove, updateItem } from "@/app/actions";

export const dynamic = "force-dynamic";

const UNITS = ["کیلوگرم", "لیتر", "عدد", "بوته", "کیسه", "تن"];
const GROUPS = ["بذر", "کود", "سم", "سوخت", "بسته‌بندی", "نهاده", "سایر"];

export default async function InventoryPage() {
  const [items, moves, crops] = await Promise.all([getInventory(), getMoves(40), getCrops()]);
  const totalValue = items.reduce((a, i) => a + i.quantity * i.unitCost, 0);
  const lowStock = items.filter((i) => i.quantity <= i.reorderLevel);

  const itemFields = (d: {
    id?: number;
    name?: string;
    unit?: string;
    category?: string;
    quantity?: number;
    reorderLevel?: number;
    unitCost?: number;
    warehouse?: string;
  }) => (
    <>
      {d.id ? <input type="hidden" name="id" value={d.id} /> : null}
      <Field label="نام کالا *">
        <input name="name" required defaultValue={d.name ?? ""} placeholder="کود اوره" className="input" />
      </Field>
      <Field label="واحد">
        <select name="unit" className="input" defaultValue={d.unit ?? "کیلوگرم"}>
          {UNITS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </Field>
      <Field label="گروه">
        <select name="category" className="input" defaultValue={d.category ?? "نهاده"}>
          {GROUPS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </Field>
      <Field label="موجودی">
        <input name="quantity" type="number" step="0.1" min="0" defaultValue={d.quantity ?? ""} className="input num" />
      </Field>
      <Field label="حد سفارش (هشدار)">
        <input name="reorderLevel" type="number" step="0.1" min="0" defaultValue={d.reorderLevel ?? ""} className="input num" />
      </Field>
      <Field label="بهای واحد به ریال" hint={d.id ? `حروفی: ${formatMoneyWords(d.unitCost ?? 0)}` : undefined}>
        <AmountInput name="unitCost" defaultValue={d.unitCost} placeholder="1,200,000" />
      </Field>
      <Field label="انبار">
        <input name="warehouse" defaultValue={d.warehouse ?? "انبار مرکزی"} className="input" />
      </Field>
    </>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="انبار نهاده‌ها"
        subtitle="بذر، کود، سم، سوخت و بسته‌بندی را پایش کنید. هر کالا و هر حرکت انبار قابل ویرایش و حذف است."
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
            {itemFields({})}
            <div className="flex items-end sm:col-span-2">
              <button type="submit" className="btn btn-primary w-full sm:w-auto">
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
              <Field label="بهای واحد به ریال (اختیاری)">
                <AmountInput name="unitCost" placeholder="1,200,000" />
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
                <th>عملیات</th>
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
                    <td>
                      <Money value={item.unitCost} size="xs" />
                    </td>
                    <td>
                      <Money value={Math.round(item.quantity * item.unitCost)} size="xs" tone={low ? "expense" : "neutral"} />
                    </td>
                    <td>
                      <Badge tone={low ? "red" : "green"}>{low ? "نیاز به سفارش" : "کافی"}</Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <EditPanel title="ویرایش کالا">
                          <form action={updateItem} className="grid gap-2 sm:grid-cols-2">
                            {itemFields({
                              id: item.id,
                              name: item.name,
                              unit: item.unit,
                              category: item.category,
                              quantity: item.quantity,
                              reorderLevel: item.reorderLevel,
                              unitCost: item.unitCost,
                              warehouse: item.warehouse,
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
                          action={deleteItem}
                          id={item.id}
                          label="حذف کالا"
                          confirmText={`کالای «${item.name}» و حرکت‌های انبار آن حذف شود؟`}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!items.length ? (
          <div className="p-4">
            <EmptyState title="انبار خالی است" />
          </div>
        ) : null}
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
                <th>عملیات</th>
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
                  <td>
                    <DeleteForm
                      action={deleteMove}
                      id={m.id}
                      label="حذف حرکت"
                      confirmText="این حرکت انبار حذف و موجودی کالا اصلاح شود؟"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!moves.length ? <EmptyState title="حرکتی ثبت نشده" /> : null}
      </Card>
    </div>
  );
}
