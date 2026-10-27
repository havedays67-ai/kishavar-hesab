import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  uniqueIndex,
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Farms / lands / crops                                               */
/* ------------------------------------------------------------------ */

export const lands = pgTable("lands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  areaHa: doublePrecision("area_ha").notNull().default(0),
  region: text("region").notNull().default(""),
  soilType: text("soil_type").notNull().default(""),
  irrigation: text("irrigation").notNull().default(""),
  ownership: text("ownership").notNull().default("owned"), // owned | shared | leased
  sharePercent: doublePrecision("share_percent").notNull().default(100),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const crops = pgTable("crops", {
  id: serial("id").primaryKey(),
  landId: integer("land_id")
    .notNull()
    .references(() => lands.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  variety: text("variety").notNull().default(""),
  season: text("season").notNull().default("بهار"),
  plantingDate: date("planting_date"),
  harvestDate: date("harvest_date"),
  expectedYieldKg: doublePrecision("expected_yield_kg").notNull().default(0),
  actualYieldKg: doublePrecision("actual_yield_kg").notNull().default(0),
  status: text("status").notNull().default("in_progress"), // planned | in_progress | harvested
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("crop_land_idx").on(t.landId),
  check("crop_status_valid", sql`${t.status} in ('planned','in_progress','harvested')`),
  check("crop_area_positive", sql`${t.expectedYieldKg} >= 0 and ${t.actualYieldKg} >= 0`),
]);

/* ------------------------------------------------------------------ */
/* Ledger                                                              */
/* ------------------------------------------------------------------ */

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // income | expense
  icon: text("icon").notNull().default("•"),
  isSystem: boolean("is_system").notNull().default(false),
}, (t) => [uniqueIndex("category_name_kind_idx").on(t.name, t.kind)]);

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // income | expense
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  landId: integer("land_id").references(() => lands.id, { onDelete: "set null" }),
  cropId: integer("crop_id").references(() => crops.id, { onDelete: "set null" }),
  amount: bigint("amount", { mode: "number" }).notNull().default(0), // Toman
  date: date("date").notNull(),
  description: text("description").notNull().default(""),
  party: text("party").notNull().default(""),
  method: text("method").notNull().default("cash"), // cash | bank | credit
  done: boolean("done").notNull().default(true),
  source: text("source").notNull().default("manual"), // manual | assistant | seed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("txn_date_idx").on(t.date),
  index("txn_land_idx").on(t.landId),
  index("txn_crop_idx").on(t.cropId),
  check("txn_amount_positive", sql`${t.amount} >= 0`),
  check("txn_kind_valid", sql`${t.kind} in ('income','expense')`),
  check("txn_method_valid", sql`${t.method} in ('cash','bank','credit')`),
]);

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("کیلوگرم"),
  category: text("category").notNull().default("نهاده"),
  quantity: doublePrecision("quantity").notNull().default(0),
  reorderLevel: doublePrecision("reorder_level").notNull().default(0),
  unitCost: bigint("unit_cost", { mode: "number" }).notNull().default(0),
  warehouse: text("warehouse").notNull().default("انبار مرکزی"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("inventory_quantity_positive", sql`${t.quantity} >= 0`)]);

export const inventoryMoves = pgTable("inventory_moves", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // in | out
  quantity: doublePrecision("quantity").notNull().default(0),
  unitCost: bigint("unit_cost", { mode: "number" }).notNull().default(0),
  date: date("date").notNull(),
  note: text("note").notNull().default(""),
  cropId: integer("crop_id").references(() => crops.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Labor & machinery                                                   */
/* ------------------------------------------------------------------ */

export const workers = pgTable("workers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().default("کارگر عمومی"),
  phone: text("phone").notNull().default(""),
  dailyWage: bigint("daily_wage", { mode: "number" }).notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const laborLogs = pgTable("labor_logs", {
  id: serial("id").primaryKey(),
  workerId: integer("worker_id").references(() => workers.id, { onDelete: "set null" }),
  workerName: text("worker_name").notNull().default(""),
  landId: integer("land_id").references(() => lands.id, { onDelete: "set null" }),
  cropId: integer("crop_id").references(() => crops.id, { onDelete: "set null" }),
  date: date("date").notNull(),
  days: doublePrecision("days").notNull().default(1),
  dailyWage: bigint("daily_wage", { mode: "number" }).notNull().default(0),
  amount: bigint("amount", { mode: "number" }).notNull().default(0),
  task: text("task").notNull().default(""),
  paid: boolean("paid").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("ماشین"),
  purchaseDate: date("purchase_date"),
  purchasePrice: bigint("purchase_price", { mode: "number" }).notNull().default(0),
  salvageValue: bigint("salvage_value", { mode: "number" }).notNull().default(0),
  usefulLifeYears: doublePrecision("useful_life_years").notNull().default(10),
  hoursUsed: doublePrecision("hours_used").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Debts, cheques, tasks                                               */
/* ------------------------------------------------------------------ */

export const debts = pgTable("debts", {
  id: serial("id").primaryKey(),
  party: text("party").notNull(),
  direction: text("direction").notNull().default("payable"), // payable (بدهی ما) | receivable (طلب ما)
  title: text("title").notNull().default(""),
  amount: bigint("amount", { mode: "number" }).notNull().default(0),
  dueDate: date("due_date"),
  paid: boolean("paid").notNull().default(false),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("debt_paid_idx").on(t.paid),
  check("debt_direction_valid", sql`${t.direction} in ('payable','receivable')`),
  check("debt_amount_positive", sql`${t.amount} >= 0`),
]);

export const cheques = pgTable("cheques", {
  id: serial("id").primaryKey(),
  party: text("party").notNull(),
  direction: text("direction").notNull().default("issued"), // issued (صادره) | received (دریافتی)
  amount: bigint("amount", { mode: "number" }).notNull().default(0),
  dueDate: date("due_date"),
  bank: text("bank").notNull().default(""),
  serial: text("serial").notNull().default(""),
  status: text("status").notNull().default("pending"), // pending | passed | bounced
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("cheque_due_idx").on(t.dueDate),
  check("cheque_status_valid", sql`${t.status} in ('pending','passed','bounced')`),
  check("cheque_direction_valid", sql`${t.direction} in ('issued','received')`),
  check("cheque_amount_positive", sql`${t.amount} >= 0`),
]);

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  dueDate: date("due_date"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("open"),
  landId: integer("land_id").references(() => lands.id, { onDelete: "set null" }),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Knowledge base + assistant                                          */
/* ------------------------------------------------------------------ */

export const knowledge = pgTable("knowledge", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),
  title: text("title").notNull(),
  tags: text("tags").notNull().default(""),
  content: text("content").notNull(),
  level: text("level").notNull().default("پایه"),
});

export const chatThreads = pgTable("chat_threads", {
  id: serial("id").primaryKey(),
  mode: text("mode").notNull().default("support"), // support | assistant
  title: text("title").notNull().default("گفتگوی جدید"),
  state: jsonb("state").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id")
    .notNull()
    .references(() => chatThreads.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user | assistant
  content: text("content").notNull(),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assistantNotes = pgTable("assistant_notes", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull().default("insight"),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  confidence: doublePrecision("confidence").notNull().default(0.8),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});
