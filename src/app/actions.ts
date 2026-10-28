"use server";

import { db } from "@/db";
import {
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
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toEnDigits } from "@/lib/format";
import { isEntityKey } from "@/lib/records";
import { attachReceiptsFromForm, detachReceipts, type ReceiptRefType } from "@/lib/receipts-server";

const cleanNumber = (raw: string) =>
  toEnDigits(raw)
    .replace(/[,٬\s]/g, "")
    .replace(/[^\d.-]/g, "");

const s = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const n = (fd: FormData, key: string) => {
  const value = Number(cleanNumber(s(fd, key)));
  return Number.isFinite(value) ? Math.round(value) : 0;
};
const f = (fd: FormData, key: string) => {
  const value = Number(cleanNumber(s(fd, key)));
  return Number.isFinite(value) ? value : 0;
};
const date = (fd: FormData, key: string) => {
  const value = s(fd, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
};
const id = (fd: FormData, key = "id") => {
  const value = Number(cleanNumber(s(fd, key)));
  return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * رسیدهای ضمیمه‌شده در همان فرم ثبت را به رکورد تازه پیوند می‌زند.
 * اگر کاربر عکسی انتخاب نکرده باشد، هیچ کاری انجام نمی‌شود.
 */
async function attach(formData: FormData, refType: ReceiptRefType, refId: number | undefined, title?: string) {
  if (!refId) return;
  try {
    await attachReceiptsFromForm(formData, refType, refId, { title });
  } catch (error) {
    console.error("attach receipts failed", error);
  }
}

function refresh() {
  const paths = [
    "/",
    "/lands",
    "/crops",
    "/transactions",
    "/inventory",
    "/labor",
    "/equipment",
    "/finance",
    "/reports",
    "/assistant",
  ];
  for (const path of paths) revalidatePath(path);
}

/* ------------------------------ ledger ------------------------------ */

export async function createTransaction(formData: FormData) {
  const kind = s(formData, "kind") === "income" ? "income" : "expense";
  const amount = n(formData, "amount");
  if (amount <= 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const [row] = await db
    .insert(transactions)
    .values({
      kind,
      categoryId: id(formData, "categoryId"),
      landId: id(formData, "landId"),
      cropId: id(formData, "cropId"),
      amount,
      date: date(formData, "date") ?? today,
      description: s(formData, "description"),
      party: s(formData, "party"),
      method: ["cash", "bank", "credit"].includes(s(formData, "method")) ? s(formData, "method") : "cash",
      source: "manual",
    })
    .returning({ id: transactions.id });
  await attach(formData, "transaction", row?.id, s(formData, "description") || s(formData, "party"));
  refresh();
}

export async function deleteTransaction(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  await detachReceipts("transaction", recordId);
  await db.delete(transactions).where(eq(transactions.id, recordId));
  refresh();
}

/* ------------------------------- lands ------------------------------ */

export async function createLand(formData: FormData) {
  const name = s(formData, "name");
  if (!name) return;
  const [row] = await db
    .insert(lands)
    .values({
      name,
      areaHa: Math.max(0, f(formData, "areaHa")),
      region: s(formData, "region"),
      soilType: s(formData, "soilType"),
      irrigation: s(formData, "irrigation"),
      ownership: ["owned", "shared", "leased"].includes(s(formData, "ownership")) ? s(formData, "ownership") : "owned",
      sharePercent: Math.min(100, Math.max(0, f(formData, "sharePercent") || 100)),
      notes: s(formData, "notes"),
    })
    .returning({ id: lands.id });
  await attach(formData, "land", row?.id, name);
  refresh();
}

export async function deleteLand(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  await detachReceipts("land", recordId);
  await db.delete(lands).where(eq(lands.id, recordId));
  refresh();
}

/* ------------------------------- crops ------------------------------ */

export async function createCrop(formData: FormData) {
  const name = s(formData, "name");
  const landId = id(formData, "landId");
  if (!name || !landId) return;
  const [row] = await db
    .insert(crops)
    .values({
      landId,
      name,
      variety: s(formData, "variety"),
      season: s(formData, "season") || "بهار",
      plantingDate: date(formData, "plantingDate"),
      harvestDate: date(formData, "harvestDate"),
      expectedYieldKg: Math.max(0, f(formData, "expectedYieldKg")),
      actualYieldKg: Math.max(0, f(formData, "actualYieldKg")),
      status: ["planned", "in_progress", "harvested"].includes(s(formData, "status")) ? s(formData, "status") : "in_progress",
      notes: s(formData, "notes"),
    })
    .returning({ id: crops.id });
  await attach(formData, "crop", row?.id, name);
  refresh();
}

export async function updateCrop(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  await db
    .update(crops)
    .set({
      actualYieldKg: Math.max(0, f(formData, "actualYieldKg")),
      harvestDate: date(formData, "harvestDate"),
      status: ["planned", "in_progress", "harvested"].includes(s(formData, "status")) ? s(formData, "status") : "in_progress",
    })
    .where(eq(crops.id, recordId));
  refresh();
}

export async function deleteCrop(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  await detachReceipts("crop", recordId);
  await db.delete(crops).where(eq(crops.id, recordId));
  refresh();
}

/* ----------------------------- inventory ---------------------------- */

export async function createItem(formData: FormData) {
  const name = s(formData, "name");
  if (!name) return;
  const [row] = await db
    .insert(inventoryItems)
    .values({
      name,
      unit: s(formData, "unit") || "کیلوگرم",
      category: s(formData, "category") || "نهاده",
      quantity: Math.max(0, f(formData, "quantity")),
      reorderLevel: Math.max(0, f(formData, "reorderLevel")),
      unitCost: Math.max(0, n(formData, "unitCost")),
      warehouse: s(formData, "warehouse") || "انبار مرکزی",
    })
    .returning({ id: inventoryItems.id });
  await attach(formData, "inventory-item", row?.id, name);
  refresh();
}

export async function createMove(formData: FormData) {
  const itemId = id(formData, "itemId");
  const quantity = f(formData, "quantity");
  const kind = s(formData, "kind") === "in" ? "in" : "out";
  if (!itemId || quantity <= 0) return;
  const rows = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemId));
  const item = rows[0];
  if (!item) return;
  if (kind === "out" && quantity > item.quantity) return;
  const [move] = await db
    .insert(inventoryMoves)
    .values({
      itemId,
      kind,
      quantity,
      unitCost: n(formData, "unitCost") || item.unitCost,
      date: date(formData, "date") ?? new Date().toISOString().slice(0, 10),
      note: s(formData, "note"),
      cropId: id(formData, "cropId"),
    })
    .returning({ id: inventoryMoves.id });
  await attach(formData, "inventory-move", move?.id, item.name);
  await db
    .update(inventoryItems)
    .set({ quantity: kind === "in" ? item.quantity + quantity : item.quantity - quantity })
    .where(eq(inventoryItems.id, itemId));
  refresh();
}

export async function deleteItem(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  await detachReceipts("inventory-item", recordId);
  await db.delete(inventoryItems).where(eq(inventoryItems.id, recordId));
  refresh();
}

/* -------------------------------- labor ----------------------------- */

export async function createWorker(formData: FormData) {
  const name = s(formData, "name");
  if (!name) return;
  const [row] = await db
    .insert(workers)
    .values({
      name,
      role: s(formData, "role") || "کارگر عمومی",
      phone: s(formData, "phone"),
      dailyWage: Math.max(0, n(formData, "dailyWage")),
    })
    .returning({ id: workers.id });
  await attach(formData, "worker", row?.id, name);
  refresh();
}

export async function createLabor(formData: FormData) {
  const days = Math.max(0, f(formData, "days"));
  const dailyWage = Math.max(0, n(formData, "dailyWage"));
  const workerId = id(formData, "workerId");
  const workerName = s(formData, "workerName");
  if (days <= 0 || dailyWage <= 0) return;
  if (!workerId && !workerName) return;
  let name = workerName;
  if (workerId) {
    const rows = await db.select().from(workers).where(eq(workers.id, workerId));
    name = rows[0]?.name ?? workerName;
  }
  const [row] = await db
    .insert(laborLogs)
    .values({
      workerId,
      workerName: name,
      landId: id(formData, "landId"),
      cropId: id(formData, "cropId"),
      date: date(formData, "date") ?? new Date().toISOString().slice(0, 10),
      days,
      dailyWage,
      amount: Math.round(days * dailyWage),
      task: s(formData, "task") || "کار مزرعه",
      paid: s(formData, "paid") === "on",
    })
    .returning({ id: laborLogs.id });
  await attach(formData, "labor", row?.id, `${name} — ${s(formData, "task") || "کار مزرعه"}`);
  refresh();
}

export async function toggleLaborPaid(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  const rows = await db.select().from(laborLogs).where(eq(laborLogs.id, recordId));
  const row = rows[0];
  if (!row) return;
  await db.update(laborLogs).set({ paid: !row.paid }).where(eq(laborLogs.id, recordId));
  refresh();
}

export async function deleteLabor(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  await detachReceipts("labor", recordId);
  await db.delete(laborLogs).where(eq(laborLogs.id, recordId));
  refresh();
}

/* ------------------------------ equipment --------------------------- */

export async function createEquipment(formData: FormData) {
  const name = s(formData, "name");
  if (!name) return;
  const [row] = await db
    .insert(equipment)
    .values({
      name,
      type: s(formData, "type") || "ماشین",
      purchaseDate: date(formData, "purchaseDate"),
      purchasePrice: Math.max(0, n(formData, "purchasePrice")),
      salvageValue: Math.max(0, n(formData, "salvageValue")),
      usefulLifeYears: Math.max(1, f(formData, "usefulLifeYears") || 10),
      hoursUsed: Math.max(0, f(formData, "hoursUsed")),
      notes: s(formData, "notes"),
    })
    .returning({ id: equipment.id });
  await attach(formData, "equipment", row?.id, name);
  refresh();
}

export async function deleteEquipment(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  await detachReceipts("equipment", recordId);
  await db.delete(equipment).where(eq(equipment.id, recordId));
  refresh();
}

/* --------------------------- debts & cheques ------------------------ */

export async function createDebt(formData: FormData) {
  const party = s(formData, "party");
  const amount = n(formData, "amount");
  if (!party || amount <= 0) return;
  const [row] = await db
    .insert(debts)
    .values({
      party,
      direction: s(formData, "direction") === "receivable" ? "receivable" : "payable",
      title: s(formData, "title"),
      amount,
      dueDate: date(formData, "dueDate"),
      notes: s(formData, "notes"),
    })
    .returning({ id: debts.id });
  await attach(formData, "debt", row?.id, `${s(formData, "title") || (s(formData, "direction") === "receivable" ? "طلب از" : "بدهی به")} ${party}`);
  refresh();
}

export async function toggleDebtPaid(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  const rows = await db.select().from(debts).where(eq(debts.id, recordId));
  const row = rows[0];
  if (!row) return;
  await db.update(debts).set({ paid: !row.paid }).where(eq(debts.id, recordId));
  refresh();
}

export async function deleteDebt(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  await detachReceipts("debt", recordId);
  await db.delete(debts).where(eq(debts.id, recordId));
  refresh();
}

export async function createCheque(formData: FormData) {
  const party = s(formData, "party");
  const amount = n(formData, "amount");
  if (!party || amount <= 0) return;
  const [row] = await db
    .insert(cheques)
    .values({
      party,
      direction: s(formData, "direction") === "received" ? "received" : "issued",
      amount,
      dueDate: date(formData, "dueDate"),
      bank: s(formData, "bank"),
      serial: s(formData, "serial"),
      notes: s(formData, "notes"),
      status: "pending",
    })
    .returning({ id: cheques.id });
  await attach(formData, "cheque", row?.id, `چک ${party}`);
  refresh();
}

export async function setChequeStatus(formData: FormData) {
  const recordId = id(formData);
  const status = s(formData, "status");
  if (!recordId || !["pending", "passed", "bounced"].includes(status)) return;
  await db.update(cheques).set({ status }).where(eq(cheques.id, recordId));
  refresh();
}

export async function deleteCheque(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  await detachReceipts("cheque", recordId);
  await db.delete(cheques).where(eq(cheques.id, recordId));
  refresh();
}

/* -------------------------------- tasks ----------------------------- */

export async function createTask(formData: FormData) {
  const title = s(formData, "title");
  if (!title) return;
  const [taskRow] = await db
    .insert(tasks)
    .values({
      title,
      dueDate: date(formData, "dueDate"),
      priority: ["low", "normal", "high"].includes(s(formData, "priority")) ? s(formData, "priority") : "normal",
      landId: id(formData, "landId"),
      source: "manual",
    })
    .returning({ id: tasks.id });
  await attach(formData, "task", taskRow?.id, title);
  refresh();
}

export async function toggleTask(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  const rows = await db.select().from(tasks).where(eq(tasks.id, recordId));
  const row = rows[0];
  if (!row) return;
  await db.update(tasks).set({ status: row.status === "open" ? "done" : "open" }).where(eq(tasks.id, recordId));
  revalidatePath("/");
}

/* ------------------------------------------------------------------ */
/* ویرایش و حذف عمومی همه بخش‌ها                                        */
/* ------------------------------------------------------------------ */

const oneOf = (value: string, allowed: readonly string[], fallback: string) =>
  allowed.includes(value) ? value : fallback;

const positive = (value: number) => Math.max(0, value);

/** ویرایش یک رکورد از هر بخش؛ پس از ذخیره به همان بخش برمی‌گردد. */
export async function updateRecord(formData: FormData) {
  const entity = s(formData, "entity");
  const recordId = id(formData);
  if (!recordId || !isEntityKey(entity)) return;

  switch (entity) {
    case "transactions": {
      const amount = n(formData, "amount");
      if (amount <= 0) return;
      await db
        .update(transactions)
        .set({
          kind: oneOf(s(formData, "kind"), ["income", "expense"], "expense"),
          categoryId: id(formData, "categoryId"),
          landId: id(formData, "landId"),
          cropId: id(formData, "cropId"),
          amount,
          date: date(formData, "date") ?? new Date().toISOString().slice(0, 10),
          description: s(formData, "description"),
          party: s(formData, "party"),
          method: oneOf(s(formData, "method"), ["cash", "bank", "credit"], "cash"),
          done: s(formData, "done") === "on",
        })
        .where(eq(transactions.id, recordId));
      break;
    }
    case "lands": {
      const name = s(formData, "name");
      if (!name) return;
      await db
        .update(lands)
        .set({
          name,
          areaHa: positive(f(formData, "areaHa")),
          region: s(formData, "region"),
          soilType: s(formData, "soilType"),
          irrigation: s(formData, "irrigation"),
          ownership: oneOf(s(formData, "ownership"), ["owned", "shared", "leased"], "owned"),
          sharePercent: Math.min(100, Math.max(0, f(formData, "sharePercent"))),
          notes: s(formData, "notes"),
        })
        .where(eq(lands.id, recordId));
      break;
    }
    case "crops": {
      const name = s(formData, "name");
      const landId = id(formData, "landId");
      if (!name || !landId) return;
      await db
        .update(crops)
        .set({
          landId,
          name,
          variety: s(formData, "variety"),
          season: s(formData, "season") || "بهار",
          plantingDate: date(formData, "plantingDate"),
          harvestDate: date(formData, "harvestDate"),
          expectedYieldKg: positive(f(formData, "expectedYieldKg")),
          actualYieldKg: positive(f(formData, "actualYieldKg")),
          status: oneOf(s(formData, "status"), ["planned", "in_progress", "harvested"], "in_progress"),
          notes: s(formData, "notes"),
        })
        .where(eq(crops.id, recordId));
      break;
    }
    case "inventory_items": {
      const name = s(formData, "name");
      if (!name) return;
      await db
        .update(inventoryItems)
        .set({
          name,
          unit: s(formData, "unit") || "کیلوگرم",
          category: s(formData, "category") || "نهاده",
          quantity: positive(f(formData, "quantity")),
          reorderLevel: positive(f(formData, "reorderLevel")),
          unitCost: positive(n(formData, "unitCost")),
          warehouse: s(formData, "warehouse") || "انبار مرکزی",
        })
        .where(eq(inventoryItems.id, recordId));
      break;
    }
    case "inventory_moves": {
      const itemId = id(formData, "itemId");
      const quantity = f(formData, "quantity");
      const kind = s(formData, "kind") === "in" ? "in" : "out";
      if (!itemId || quantity <= 0) return;
      const oldRows = await db.select().from(inventoryMoves).where(eq(inventoryMoves.id, recordId));
      const old = oldRows[0];
      if (old) {
        const oldItemRows = await db.select().from(inventoryItems).where(eq(inventoryItems.id, old.itemId));
        const oldItem = oldItemRows[0];
        if (oldItem) {
          const reverted = oldItem.quantity + (old.kind === "in" ? -old.quantity : old.quantity);
          await db.update(inventoryItems).set({ quantity: Math.max(0, reverted) }).where(eq(inventoryItems.id, oldItem.id));
        }
      }
      const itemRows = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemId));
      const item = itemRows[0];
      if (!item) return;
      if (kind === "out" && quantity > item.quantity) {
        // برگرداندن اثر حرکت قبلی تا موجودی با رکورد ذخیره‌شده هم‌خوان بماند
        if (old) {
          const rollbackRows = await db.select().from(inventoryItems).where(eq(inventoryItems.id, old.itemId));
          const rollback = rollbackRows[0];
          if (rollback) {
            const restored = rollback.quantity + (old.kind === "in" ? old.quantity : -old.quantity);
            await db.update(inventoryItems).set({ quantity: Math.max(0, restored) }).where(eq(inventoryItems.id, rollback.id));
          }
        }
        return;
      }
      await db
        .update(inventoryMoves)
        .set({
          itemId,
          kind,
          quantity,
          unitCost: n(formData, "unitCost") || item.unitCost,
          date: date(formData, "date") ?? new Date().toISOString().slice(0, 10),
          note: s(formData, "note"),
          cropId: id(formData, "cropId"),
        })
        .where(eq(inventoryMoves.id, recordId));
      await db
        .update(inventoryItems)
        .set({ quantity: kind === "in" ? item.quantity + quantity : item.quantity - quantity })
        .where(eq(inventoryItems.id, itemId));
      break;
    }
    case "workers": {
      const name = s(formData, "name");
      if (!name) return;
      await db
        .update(workers)
        .set({
          name,
          role: s(formData, "role") || "کارگر عمومی",
          phone: s(formData, "phone"),
          dailyWage: positive(n(formData, "dailyWage")),
          active: s(formData, "active") === "on",
        })
        .where(eq(workers.id, recordId));
      break;
    }
    case "labor_logs": {
      const days = positive(f(formData, "days"));
      const dailyWage = positive(n(formData, "dailyWage"));
      const workerId = id(formData, "workerId");
      let workerName = s(formData, "workerName");
      if (days <= 0 || dailyWage <= 0) return;
      if (workerId) {
        const rows = await db.select().from(workers).where(eq(workers.id, workerId));
        workerName = rows[0]?.name ?? workerName;
      }
      if (!workerId && !workerName) return;
      await db
        .update(laborLogs)
        .set({
          workerId,
          workerName,
          landId: id(formData, "landId"),
          cropId: id(formData, "cropId"),
          date: date(formData, "date") ?? new Date().toISOString().slice(0, 10),
          days,
          dailyWage,
          amount: Math.round(days * dailyWage),
          task: s(formData, "task") || "کار مزرعه",
          paid: s(formData, "paid") === "on",
        })
        .where(eq(laborLogs.id, recordId));
      break;
    }
    case "equipment": {
      const name = s(formData, "name");
      if (!name) return;
      await db
        .update(equipment)
        .set({
          name,
          type: s(formData, "type") || "ماشین",
          purchaseDate: date(formData, "purchaseDate"),
          purchasePrice: positive(n(formData, "purchasePrice")),
          salvageValue: positive(n(formData, "salvageValue")),
          usefulLifeYears: Math.max(1, f(formData, "usefulLifeYears") || 10),
          hoursUsed: positive(f(formData, "hoursUsed")),
          notes: s(formData, "notes"),
        })
        .where(eq(equipment.id, recordId));
      break;
    }
    case "debts": {
      const party = s(formData, "party");
      const amount = n(formData, "amount");
      if (!party || amount <= 0) return;
      await db
        .update(debts)
        .set({
          party,
          direction: oneOf(s(formData, "direction"), ["payable", "receivable"], "payable"),
          title: s(formData, "title"),
          amount,
          dueDate: date(formData, "dueDate"),
          paid: s(formData, "paid") === "on",
          notes: s(formData, "notes"),
        })
        .where(eq(debts.id, recordId));
      break;
    }
    case "cheques": {
      const party = s(formData, "party");
      const amount = n(formData, "amount");
      if (!party || amount <= 0) return;
      await db
        .update(cheques)
        .set({
          party,
          direction: oneOf(s(formData, "direction"), ["issued", "received"], "issued"),
          amount,
          dueDate: date(formData, "dueDate"),
          bank: s(formData, "bank"),
          serial: s(formData, "serial"),
          status: oneOf(s(formData, "status"), ["pending", "passed", "bounced"], "pending"),
          notes: s(formData, "notes"),
        })
        .where(eq(cheques.id, recordId));
      break;
    }
    case "tasks": {
      const title = s(formData, "title");
      if (!title) return;
      await db
        .update(tasks)
        .set({
          title,
          dueDate: date(formData, "dueDate"),
          priority: oneOf(s(formData, "priority"), ["low", "normal", "high"], "normal"),
          status: oneOf(s(formData, "status"), ["open", "done"], "open"),
          landId: id(formData, "landId"),
        })
        .where(eq(tasks.id, recordId));
      break;
    }
    default:
      return;
  }

  refresh();
  const back = s(formData, "redirectTo");
  redirect(back.startsWith("/") ? back : "/");
}

/** حذف رکورد از هر بخش؛ در صورت نیاز کاربر را به فهرست همان بخش برمی‌گرداند. */
export async function deleteRecord(formData: FormData) {
  const entity = s(formData, "entity");
  const recordId = id(formData);
  if (!recordId || !isEntityKey(entity)) return;

  switch (entity) {
    case "transactions":
      await db.delete(transactions).where(eq(transactions.id, recordId));
      break;
    case "lands":
      await db.delete(lands).where(eq(lands.id, recordId));
      break;
    case "crops":
      await db.delete(crops).where(eq(crops.id, recordId));
      break;
    case "inventory_items":
      await db.delete(inventoryItems).where(eq(inventoryItems.id, recordId));
      break;
    case "inventory_moves": {
      const rows = await db.select().from(inventoryMoves).where(eq(inventoryMoves.id, recordId));
      const move = rows[0];
      if (move) {
        const itemRows = await db.select().from(inventoryItems).where(eq(inventoryItems.id, move.itemId));
        const item = itemRows[0];
        if (item) {
          const reverted = item.quantity + (move.kind === "in" ? -move.quantity : move.quantity);
          await db.update(inventoryItems).set({ quantity: Math.max(0, reverted) }).where(eq(inventoryItems.id, item.id));
        }
      }
      await db.delete(inventoryMoves).where(eq(inventoryMoves.id, recordId));
      break;
    }
    case "workers":
      await db.delete(workers).where(eq(workers.id, recordId));
      break;
    case "labor_logs":
      await db.delete(laborLogs).where(eq(laborLogs.id, recordId));
      break;
    case "equipment":
      await db.delete(equipment).where(eq(equipment.id, recordId));
      break;
    case "debts":
      await db.delete(debts).where(eq(debts.id, recordId));
      break;
    case "cheques":
      await db.delete(cheques).where(eq(cheques.id, recordId));
      break;
    case "tasks":
      await db.delete(tasks).where(eq(tasks.id, recordId));
      break;
    default:
      return;
  }

  refresh();
  const back = s(formData, "redirectTo");
  if (back.startsWith("/")) redirect(back);
}
