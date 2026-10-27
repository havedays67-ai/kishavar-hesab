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
import { toEnDigits } from "@/lib/format";

const cleanNumber = (raw: string) =>
  toEnDigits(raw)
    .replace(/[,٬\s]/g, "")
    .replace(/[^\d.-]/g, "");

const s = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const n = (fd: FormData, key: string) => {
  const value = Number(cleanNumber(s(fd, key)));
  return Number.isFinite(value) ? Math.round(value) : 0;
};
/** مبالغ به ریال وارد می‌شوند و به تومان (عدد صحیح) ذخیره می‌شوند. */
const rial = (fd: FormData, key: string) => {
  const value = Number(cleanNumber(s(fd, key)));
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value / 10);
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
    "/knowledge",
    "/settings",
  ];
  for (const path of paths) revalidatePath(path);
}

/* ------------------------------ ledger ------------------------------ */

export async function createTransaction(formData: FormData) {
  const kind = s(formData, "kind") === "income" ? "income" : "expense";
  const amount = rial(formData, "amount");
  if (amount <= 0) return;
  const today = new Date().toISOString().slice(0, 10);
  await db.insert(transactions).values({
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
  });
  refresh();
}

export async function deleteTransaction(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  await db.delete(transactions).where(eq(transactions.id, recordId));
  refresh();
}

/* ------------------------------- lands ------------------------------ */

export async function createLand(formData: FormData) {
  const name = s(formData, "name");
  if (!name) return;
  await db.insert(lands).values({
    name,
    areaHa: Math.max(0, f(formData, "areaHa")),
    region: s(formData, "region"),
    soilType: s(formData, "soilType"),
    irrigation: s(formData, "irrigation"),
    ownership: ["owned", "shared", "leased"].includes(s(formData, "ownership")) ? s(formData, "ownership") : "owned",
    sharePercent: Math.min(100, Math.max(0, f(formData, "sharePercent") || 100)),
    notes: s(formData, "notes"),
  });
  refresh();
}

export async function deleteLand(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  await db.delete(lands).where(eq(lands.id, recordId));
  refresh();
}

/* ------------------------------- crops ------------------------------ */

export async function createCrop(formData: FormData) {
  const name = s(formData, "name");
  const landId = id(formData, "landId");
  if (!name || !landId) return;
  await db.insert(crops).values({
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
  });
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
  await db.delete(crops).where(eq(crops.id, recordId));
  refresh();
}

/* ----------------------------- inventory ---------------------------- */

export async function createItem(formData: FormData) {
  const name = s(formData, "name");
  if (!name) return;
  await db.insert(inventoryItems).values({
    name,
    unit: s(formData, "unit") || "کیلوگرم",
    category: s(formData, "category") || "نهاده",
    quantity: Math.max(0, f(formData, "quantity")),
    reorderLevel: Math.max(0, f(formData, "reorderLevel")),
    unitCost: Math.max(0, rial(formData, "unitCost")),
    warehouse: s(formData, "warehouse") || "انبار مرکزی",
  });
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
  await db.insert(inventoryMoves).values({
    itemId,
    kind,
    quantity,
    unitCost: rial(formData, "unitCost") || item.unitCost,
    date: date(formData, "date") ?? new Date().toISOString().slice(0, 10),
    note: s(formData, "note"),
    cropId: id(formData, "cropId"),
  });
  await db
    .update(inventoryItems)
    .set({ quantity: kind === "in" ? item.quantity + quantity : item.quantity - quantity })
    .where(eq(inventoryItems.id, itemId));
  refresh();
}

export async function deleteItem(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  await db.delete(inventoryItems).where(eq(inventoryItems.id, recordId));
  refresh();
}

/* -------------------------------- labor ----------------------------- */

export async function createWorker(formData: FormData) {
  const name = s(formData, "name");
  if (!name) return;
  await db.insert(workers).values({
    name,
    role: s(formData, "role") || "کارگر عمومی",
    phone: s(formData, "phone"),
    dailyWage: Math.max(0, rial(formData, "dailyWage")),
  });
  refresh();
}

export async function createLabor(formData: FormData) {
  const days = Math.max(0, f(formData, "days"));
  const dailyWage = Math.max(0, rial(formData, "dailyWage"));
  const workerId = id(formData, "workerId");
  const workerName = s(formData, "workerName");
  if (days <= 0 || dailyWage <= 0) return;
  if (!workerId && !workerName) return;
  let name = workerName;
  if (workerId) {
    const rows = await db.select().from(workers).where(eq(workers.id, workerId));
    name = rows[0]?.name ?? workerName;
  }
  await db.insert(laborLogs).values({
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
  });
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
  await db.delete(laborLogs).where(eq(laborLogs.id, recordId));
  refresh();
}

/* ------------------------------ equipment --------------------------- */

export async function createEquipment(formData: FormData) {
  const name = s(formData, "name");
  if (!name) return;
  await db.insert(equipment).values({
    name,
    type: s(formData, "type") || "ماشین",
    purchaseDate: date(formData, "purchaseDate"),
    purchasePrice: Math.max(0, rial(formData, "purchasePrice")),
    salvageValue: Math.max(0, rial(formData, "salvageValue")),
    usefulLifeYears: Math.max(1, f(formData, "usefulLifeYears") || 10),
    hoursUsed: Math.max(0, f(formData, "hoursUsed")),
    notes: s(formData, "notes"),
  });
  refresh();
}

export async function deleteEquipment(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  await db.delete(equipment).where(eq(equipment.id, recordId));
  refresh();
}

/* --------------------------- debts & cheques ------------------------ */

export async function createDebt(formData: FormData) {
  const party = s(formData, "party");
  const amount = rial(formData, "amount");
  if (!party || amount <= 0) return;
  await db.insert(debts).values({
    party,
    direction: s(formData, "direction") === "receivable" ? "receivable" : "payable",
    title: s(formData, "title"),
    amount,
    dueDate: date(formData, "dueDate"),
    notes: s(formData, "notes"),
  });
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
  await db.delete(debts).where(eq(debts.id, recordId));
  refresh();
}

export async function createCheque(formData: FormData) {
  const party = s(formData, "party");
  const amount = rial(formData, "amount");
  if (!party || amount <= 0) return;
  await db.insert(cheques).values({
    party,
    direction: s(formData, "direction") === "received" ? "received" : "issued",
    amount,
    dueDate: date(formData, "dueDate"),
    bank: s(formData, "bank"),
    serial: s(formData, "serial"),
    notes: s(formData, "notes"),
    status: "pending",
  });
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
  await db.delete(cheques).where(eq(cheques.id, recordId));
  refresh();
}

/* -------------------------------- tasks ----------------------------- */

export async function createTask(formData: FormData) {
  const title = s(formData, "title");
  if (!title) return;
  await db.insert(tasks).values({
    title,
    dueDate: date(formData, "dueDate"),
    priority: ["low", "normal", "high"].includes(s(formData, "priority")) ? s(formData, "priority") : "normal",
    landId: id(formData, "landId"),
    source: "manual",
  });
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
/* ویرایش و حذف کامل — همهٔ بخش‌ها                                     */
/* ------------------------------------------------------------------ */

export async function updateLand(formData: FormData) {
  const recordId = id(formData);
  const name = s(formData, "name");
  if (!recordId || !name) return;
  await db
    .update(lands)
    .set({
      name,
      areaHa: Math.max(0, f(formData, "areaHa")),
      region: s(formData, "region"),
      soilType: s(formData, "soilType"),
      irrigation: s(formData, "irrigation"),
      ownership: ["owned", "shared", "leased"].includes(s(formData, "ownership")) ? s(formData, "ownership") : "owned",
      sharePercent: Math.min(100, Math.max(0, f(formData, "sharePercent") || 100)),
      notes: s(formData, "notes"),
    })
    .where(eq(lands.id, recordId));
  refresh();
}

export async function updateTransaction(formData: FormData) {
  const recordId = id(formData);
  const amount = rial(formData, "amount");
  if (!recordId || amount <= 0) return;
  await db
    .update(transactions)
    .set({
      kind: s(formData, "kind") === "income" ? "income" : "expense",
      categoryId: id(formData, "categoryId"),
      landId: id(formData, "landId"),
      cropId: id(formData, "cropId"),
      amount,
      date: date(formData, "date") ?? new Date().toISOString().slice(0, 10),
      description: s(formData, "description"),
      party: s(formData, "party"),
      method: ["cash", "bank", "credit"].includes(s(formData, "method")) ? s(formData, "method") : "cash",
    })
    .where(eq(transactions.id, recordId));
  refresh();
}

export async function updateItem(formData: FormData) {
  const recordId = id(formData);
  const name = s(formData, "name");
  if (!recordId || !name) return;
  await db
    .update(inventoryItems)
    .set({
      name,
      unit: s(formData, "unit") || "کیلوگرم",
      category: s(formData, "category") || "نهاده",
      quantity: Math.max(0, f(formData, "quantity")),
      reorderLevel: Math.max(0, f(formData, "reorderLevel")),
      unitCost: rial(formData, "unitCost"),
      warehouse: s(formData, "warehouse") || "انبار مرکزی",
    })
    .where(eq(inventoryItems.id, recordId));
  refresh();
}

export async function deleteMove(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  const rows = await db.select().from(inventoryMoves).where(eq(inventoryMoves.id, recordId));
  const move = rows[0];
  if (!move) return;
  const itemRows = await db.select().from(inventoryItems).where(eq(inventoryItems.id, move.itemId));
  const item = itemRows[0];
  if (item) {
    const next = move.kind === "in" ? item.quantity - move.quantity : item.quantity + move.quantity;
    await db.update(inventoryItems).set({ quantity: Math.max(0, next) }).where(eq(inventoryItems.id, item.id));
  }
  await db.delete(inventoryMoves).where(eq(inventoryMoves.id, recordId));
  refresh();
}

export async function updateWorker(formData: FormData) {
  const recordId = id(formData);
  const name = s(formData, "name");
  if (!recordId || !name) return;
  await db
    .update(workers)
    .set({
      name,
      role: s(formData, "role") || "کارگر عمومی",
      phone: s(formData, "phone"),
      dailyWage: rial(formData, "dailyWage"),
      active: s(formData, "active") === "on",
    })
    .where(eq(workers.id, recordId));
  refresh();
}

export async function deleteWorker(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  await db.delete(workers).where(eq(workers.id, recordId));
  refresh();
}

export async function updateLabor(formData: FormData) {
  const recordId = id(formData);
  const days = Math.max(0, f(formData, "days"));
  const dailyWage = rial(formData, "dailyWage");
  if (!recordId || days <= 0 || dailyWage <= 0) return;
  const workerId = id(formData, "workerId");
  const typedName = s(formData, "workerName");
  let workerName = typedName;
  if (workerId) {
    const rows = await db.select().from(workers).where(eq(workers.id, workerId));
    workerName = rows[0]?.name ?? typedName;
  }
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
  refresh();
}

export async function updateEquipment(formData: FormData) {
  const recordId = id(formData);
  const name = s(formData, "name");
  if (!recordId || !name) return;
  await db
    .update(equipment)
    .set({
      name,
      type: s(formData, "type") || "ماشین",
      purchaseDate: date(formData, "purchaseDate"),
      purchasePrice: rial(formData, "purchasePrice"),
      salvageValue: rial(formData, "salvageValue"),
      usefulLifeYears: Math.max(1, f(formData, "usefulLifeYears") || 10),
      hoursUsed: Math.max(0, f(formData, "hoursUsed")),
      notes: s(formData, "notes"),
    })
    .where(eq(equipment.id, recordId));
  refresh();
}

export async function updateDebt(formData: FormData) {
  const recordId = id(formData);
  const party = s(formData, "party");
  const amount = rial(formData, "amount");
  if (!recordId || !party || amount <= 0) return;
  await db
    .update(debts)
    .set({
      party,
      direction: s(formData, "direction") === "receivable" ? "receivable" : "payable",
      title: s(formData, "title"),
      amount,
      dueDate: date(formData, "dueDate"),
      paid: s(formData, "paid") === "on",
      notes: s(formData, "notes"),
    })
    .where(eq(debts.id, recordId));
  refresh();
}

export async function updateCheque(formData: FormData) {
  const recordId = id(formData);
  const party = s(formData, "party");
  const amount = rial(formData, "amount");
  if (!recordId || !party || amount <= 0) return;
  const status = s(formData, "status");
  await db
    .update(cheques)
    .set({
      party,
      direction: s(formData, "direction") === "received" ? "received" : "issued",
      amount,
      dueDate: date(formData, "dueDate"),
      bank: s(formData, "bank"),
      serial: s(formData, "serial"),
      status: ["pending", "passed", "bounced"].includes(status) ? status : "pending",
      notes: s(formData, "notes"),
    })
    .where(eq(cheques.id, recordId));
  refresh();
}

export async function updateTask(formData: FormData) {
  const recordId = id(formData);
  const title = s(formData, "title");
  if (!recordId || !title) return;
  await db
    .update(tasks)
    .set({
      title,
      dueDate: date(formData, "dueDate"),
      priority: ["low", "normal", "high"].includes(s(formData, "priority")) ? s(formData, "priority") : "normal",
      status: s(formData, "status") === "done" ? "done" : "open",
      landId: id(formData, "landId"),
    })
    .where(eq(tasks.id, recordId));
  refresh();
}

export async function deleteTask(formData: FormData) {
  const recordId = id(formData);
  if (!recordId) return;
  await db.delete(tasks).where(eq(tasks.id, recordId));
  refresh();
}
