import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  cheques,
  crops,
  debts,
  equipment,
  inventoryItems,
  inventoryMoves,
  laborLogs,
  lands,
  tasks,
  transactions,
  workers,
} from "@/db/schema";
import { updateRecord } from "@/app/actions";
import { Card, Field, Icon, PageHeader } from "@/components/ui";
import { RecordActions } from "@/components/RecordActions";
import { formatMoney, formatMoneyWords, formatNumber } from "@/lib/format";
import { ENTITIES, entityDef, isEntityKey, type EntityKey, type FieldDef, type OptionSource } from "@/lib/records";

export const dynamic = "force-dynamic";

type Params = Promise<{ entity: string; id: string }>;

async function loadRecord(entity: EntityKey, recordId: number): Promise<Record<string, unknown> | null> {
  const pick = async <T,>(rows: T[]) => (rows[0] as Record<string, unknown> | undefined) ?? null;
  switch (entity) {
    case "transactions":
      return pick(await db.select().from(transactions).where(eq(transactions.id, recordId)).limit(1));
    case "lands":
      return pick(await db.select().from(lands).where(eq(lands.id, recordId)).limit(1));
    case "crops":
      return pick(await db.select().from(crops).where(eq(crops.id, recordId)).limit(1));
    case "inventory_items":
      return pick(await db.select().from(inventoryItems).where(eq(inventoryItems.id, recordId)).limit(1));
    case "inventory_moves":
      return pick(await db.select().from(inventoryMoves).where(eq(inventoryMoves.id, recordId)).limit(1));
    case "workers":
      return pick(await db.select().from(workers).where(eq(workers.id, recordId)).limit(1));
    case "labor_logs":
      return pick(await db.select().from(laborLogs).where(eq(laborLogs.id, recordId)).limit(1));
    case "equipment":
      return pick(await db.select().from(equipment).where(eq(equipment.id, recordId)).limit(1));
    case "debts":
      return pick(await db.select().from(debts).where(eq(debts.id, recordId)).limit(1));
    case "cheques":
      return pick(await db.select().from(cheques).where(eq(cheques.id, recordId)).limit(1));
    case "tasks":
      return pick(await db.select().from(tasks).where(eq(tasks.id, recordId)).limit(1));
    default:
      return null;
  }
}

async function loadOptions(source: OptionSource): Promise<{ value: string; label: string }[]> {
  switch (source) {
    case "lands": {
      const rows = await db.select().from(lands);
      return rows.map((row) => ({ value: String(row.id), label: row.name }));
    }
    case "crops": {
      const rows = await db.select().from(crops);
      return rows.map((row) => ({ value: String(row.id), label: `${row.name} — ${row.season}` }));
    }
    case "workers": {
      const rows = await db.select().from(workers);
      return rows.map((row) => ({ value: String(row.id), label: `${row.name}${row.role ? ` (${row.role})` : ""}` }));
    }
    case "categories": {
      const rows = await db.select().from(categories);
      return rows.map((row) => ({ value: String(row.id), label: `${row.icon} ${row.name} — ${row.kind === "income" ? "درآمد" : "هزینه"}` }));
    }
    case "items": {
      const rows = await db.select().from(inventoryItems);
      return rows.map((row) => ({ value: String(row.id), label: `${row.name} (${row.unit})` }));
    }
    default:
      return [];
  }
}

function toInputValue(field: FieldDef, raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (field.type === "date") return String(raw).slice(0, 10);
  if (field.type === "number") {
    const value = Number(raw);
    return Number.isFinite(value) ? String(value) : "0";
  }
  return String(raw);
}

const MONEY_FIELDS = new Set(["amount", "unitCost", "purchasePrice", "salvageValue", "dailyWage"]);

export default async function EditRecordPage({ params }: { params: Params }) {
  const { entity, id } = await params;
  if (!isEntityKey(entity)) notFound();
  const recordId = Number(id);
  if (!Number.isInteger(recordId) || recordId <= 0) notFound();

  const def = entityDef(entity);
  if (!def) notFound();
  const record = await loadRecord(entity, recordId);
  if (!record) notFound();

  const sources = [...new Set(def.fields.map((field) => field.optionsFrom).filter(Boolean))] as OptionSource[];
  const optionEntries = await Promise.all(sources.map(async (source) => [source, await loadOptions(source)] as const));
  const optionsBySource = Object.fromEntries(optionEntries) as Record<OptionSource, { value: string; label: string }[]>;

  const amountField = def.fields.find((field) => MONEY_FIELDS.has(field.name));
  const amountValue = amountField ? Number(record[amountField.name] ?? 0) : null;
  const recordTitle = [
    String(record.name ?? record.title ?? record.party ?? record.description ?? "").trim(),
    record.workerName ? String(record.workerName) : "",
  ]
    .filter(Boolean)
    .join(" · ") || `${def.label} #${formatNumber(recordId)}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`ویرایش ${def.label}`}
        subtitle={`${def.description} — پس از ذخیره، فهرست به‌روزرسانی می‌شود.`}
        icon="edit"
        actions={
          <Link href={def.listPath} className="btn btn-sm">
            <Icon name="arrow" className="h-3.5 w-3.5" />
            بازگشت به فهرست
          </Link>
        }
      />

      <Card className="card-pad">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0ebdd] pb-3">
          <div>
            <p className="text-[11px] text-[#84907f]">رکورد انتخاب‌شده</p>
            <p className="text-sm font-bold text-farm-900">{recordTitle}</p>
          </div>
          <span className="chip num">شناسه: {formatNumber(recordId)}</span>
        </div>

        {amountValue !== null ? (
          <div className="mt-3 rounded-xl bg-farm-50 px-3 py-2">
            <p className="num text-sm font-extrabold text-farm-800">{formatMoney(amountValue)}</p>
            <p className="mt-0.5 text-[11px] text-farm-700">{formatMoneyWords(amountValue)}</p>
          </div>
        ) : null}

        <form action={updateRecord} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="entity" value={entity} />
          <input type="hidden" name="id" value={recordId} />
          <input type="hidden" name="redirectTo" value={def.listPath} />

          {def.fields.map((field) => {
            const value = toInputValue(field, record[field.name]);
            const options = field.optionsFrom ? optionsBySource[field.optionsFrom] ?? [] : field.options ?? [];
            const isWide = field.type === "textarea" || field.name === "description" || field.name === "notes";
            if (field.type === "checkbox") {
              return (
                <label key={field.name} className="flex items-center gap-2 self-end rounded-xl border border-[#f0ebdd] px-3 py-2.5 text-xs text-[#5b6a5e]">
                  <input
                    type="checkbox"
                    name={field.name}
                    defaultChecked={Boolean(record[field.name])}
                    className="h-4 w-4 accent-farm-600"
                  />
                  {field.label}
                </label>
              );
            }
            return (
              <Field
                key={field.name}
                label={`${field.label}${field.required ? " *" : ""}`}
                hint={field.hint}
                className={isWide ? "sm:col-span-2" : ""}
              >
                {field.type === "select" ? (
                  <select name={field.name} defaultValue={value} required={field.required} className="input">
                    <option value="">— بدون انتخاب —</option>
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea name={field.name} defaultValue={value} rows={2} className="input" />
                ) : (
                  <input
                    name={field.name}
                    type={field.type}
                    step={field.step}
                    defaultValue={value}
                    required={field.required}
                    placeholder={field.placeholder}
                    className={field.type === "number" || field.type === "date" ? "input num" : "input"}
                  />
                )}
              </Field>
            );
          })}

          <div className="sm:col-span-2 flex flex-wrap items-center gap-2 border-t border-[#f0ebdd] pt-3">
            <button type="submit" className="btn btn-primary">
              <Icon name="check" className="h-4 w-4" />
              ذخیره تغییرات
            </button>
            <Link href={def.listPath} className="btn">
              انصراف
            </Link>
            <span className="text-[10px] leading-5 text-[#84907f]">
              مبالغ به تومان وارد می‌شوند و در گزارش‌ها به ریال (با حروفی تومانی) نمایش داده می‌شوند.
            </span>
          </div>
        </form>
      </Card>

      <Card className="card-pad">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="section-title mb-1">حذف {def.label}</h2>
            <p className="text-[11px] leading-6 text-[#7c8a7f]">
              اگر این رکورد را اشتباه ثبت کرده‌اید، می‌توانید آن را برای همیشه حذف کنید. رکوردهای مرتبط در بخش‌های دیگر (مثل تراکنش‌های یک زمین) حفظ می‌شوند ولی
              ارتباط آن‌ها با این رکورد قطع می‌شود.
            </p>
          </div>
          <RecordActions
            entity={entity}
            id={recordId}
            label={recordTitle}
            redirectTo={def.listPath}
            hideEdit
          />
        </div>
      </Card>

      <p className="text-[11px] leading-6 text-[#7c8a7f]">بخش‌های قابل ویرایش: {Object.values(ENTITIES).map((item) => item.label).join(" · ")}</p>
    </div>
  );
}
