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

/**
 * قراردادهای زمین کشاورزی — از دید «کسب‌وکار ما».
 * perspective = lessee  → ما زمین را اجاره می‌کنیم (طرف مقابل مالک/مزارع است)
 * perspective = lessor  → ما زمین را اجاره می‌دهیم (طرف مقابل مستاجر/عامل است)
 */
export const agriContracts = pgTable("agri_contracts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  perspective: text("perspective").notNull().default("lessee"), // lessee | lessor
  type: text("type").notNull().default("cash"), // cash | crop_share | cash_share | mosaqat | partnership
  counterpartyName: text("counterparty_name").notNull().default(""),
  counterpartyPhone: text("counterparty_phone").notNull().default(""),
  crop: text("crop").notNull().default(""),
  areaHa: doublePrecision("area_ha").notNull().default(0),
  location: text("location").notNull().default(""),
  plate: text("plate").notNull().default(""),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  cycle: text("cycle").notNull().default("once"), // once | monthly | seasonal | annual
  totalRentToman: bigint("total_rent_toman", { mode: "number" }).notNull().default(0),
  depositToman: bigint("deposit_toman", { mode: "number" }).notNull().default(0),
  landownerSharePercent: doublePrecision("landowner_share_percent").notNull().default(0),
  waterShare: text("water_share").notNull().default(""),
  waterPaidBy: text("water_paid_by").notNull().default("farmer"), // farmer | landowner | split
  costsPaidBy: text("costs_paid_by").notNull().default("farmer"), // farmer | landowner | split
  status: text("status").notNull().default("draft"), // draft | active | ended | canceled
  witnesses: text("witnesses").notNull().default(""),
  terms: text("terms").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agriContractPayments = pgTable("agri_contract_payments", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id")
    .notNull()
    .references(() => agriContracts.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("rent"), // rent | deposit | deposit_refund | crop_share | other
  amountToman: bigint("amount_toman", { mode: "number" }).notNull().default(0),
  paidAt: date("paid_at").notNull(),
  account: text("account").notNull().default("bank"), // cash | bank
  installmentNo: integer("installment_no"),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------- معامله محصول و تسویه ------------------------- */

/**
 * یک معامله محصول (فروش گندم به کارخانه/سیلو یا خرید محصول).
 * مقادیر وزنی به کیلوگرم و مبالغ به تومان ذخیره می‌شوند.
 * ورودی و خروجی کامل موتور محاسبه در ستون‌های input/calc به‌صورت JSONB
 * نگهداری می‌شود تا سند چاپی بعداً «همان عدد زمان امضا» را نشان دهد.
 */
export const cropTrades = pgTable("crop_trades", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  direction: text("direction").notNull().default("sell"), // sell | buy
  mode: text("mode").notNull().default("factory"), // guaranteed | factory | custom
  cropKey: text("crop_key").notNull().default("wheat"),
  cropName: text("crop_name").notNull().default("گندم"),
  variety: text("variety").notNull().default(""),
  sellerName: text("seller_name").notNull().default(""),
  sellerNationalId: text("seller_national_id").notNull().default(""),
  sellerPhone: text("seller_phone").notNull().default(""),
  buyerName: text("buyer_name").notNull().default(""),
  buyerType: text("buyer_type").notNull().default("factory"),
  buyerNationalId: text("buyer_national_id").notNull().default(""),
  buyerPhone: text("buyer_phone").notNull().default(""),
  province: text("province").notNull().default(""),
  deliveryPlace: text("delivery_place").notNull().default(""),
  vehiclePlate: text("vehicle_plate").notNull().default(""),
  driverName: text("driver_name").notNull().default(""),
  landId: integer("land_id").references(() => lands.id, { onDelete: "set null" }),
  contractDate: date("contract_date").notNull(),
  deliveryDate: date("delivery_date"),
  dueDate: date("due_date"),
  unit: text("unit").notNull().default("ton"),
  quantityInput: doublePrecision("quantity_input").notNull().default(0),
  grossKg: doublePrecision("gross_kg").notNull().default(0),
  tareKg: doublePrecision("tare_kg").notNull().default(0),
  netKg: doublePrecision("net_kg").notNull().default(0),
  adjustedKg: doublePrecision("adjusted_kg").notNull().default(0),
  moisturePct: doublePrecision("moisture_pct").notNull().default(0),
  foreignMatterPct: doublePrecision("foreign_matter_pct").notNull().default(0),
  brokenPct: doublePrecision("broken_pct").notNull().default(0),
  pestPct: doublePrecision("pest_pct").notNull().default(0),
  hectoliter: doublePrecision("hectoliter").notNull().default(0),
  proteinPct: doublePrecision("protein_pct").notNull().default(0),
  pricePerKgToman: bigint("price_per_kg_toman", { mode: "number" }).notNull().default(0),
  grade: integer("grade").notNull().default(0),
  gradeLabel: text("grade_label").notNull().default(""),
  totalToman: bigint("total_toman", { mode: "number" }).notNull().default(0),
  prepaidToman: bigint("prepaid_toman", { mode: "number" }).notNull().default(0),
  paidToman: bigint("paid_toman", { mode: "number" }).notNull().default(0),
  status: text("status").notNull().default("draft"), // draft | confirmed | settled | canceled
  notes: text("notes").notNull().default(""),
  terms: text("terms").notNull().default(""),
  engineVersion: text("engine_version").notNull().default("1.0.0"),
  input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
  calc: jsonb("calc").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradePayments = pgTable("trade_payments", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id")
    .notNull()
    .references(() => cropTrades.id, { onDelete: "cascade" }),
  amountToman: bigint("amount_toman", { mode: "number" }).notNull().default(0),
  paidAt: date("paid_at").notNull(),
  method: text("method").notNull().default("bank"), // cash | bank | cheque | deduction
  reference: text("reference").notNull().default(""),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** سندهای رسمی صادرشده؛ هر سند شماره سریال یکتا و تصویر لحظه صدور دارد. */
export const tradeDocuments = pgTable("trade_documents", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id")
    .notNull()
    .references(() => cropTrades.id, { onDelete: "cascade" }),
  docType: text("doc_type").notNull(), // contract | weighing | quality | invoice | settlement
  serial: text("serial").notNull().unique(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull().default({}),
});

/* ------------------------------------------------------------------ */
/* Assistant brain: curated knowledge, training samples, feedback      */
/* (Seed: src/lib/ai/knowledge-data.ts — engine: knowledge-engine.ts)  */
/* ------------------------------------------------------------------ */

export const assistantKnowledge = pgTable("assistant_knowledge", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  category: text("category").notNull().default("عمومی"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  keywords: text("keywords").notNull().default(""),
  aliases: text("aliases").notNull().default(""),
  intent: text("intent").notNull().default("general"),
  source: text("source").notNull().default(""),
  authority: text("authority").notNull().default("curated"),
  weight: doublePrecision("weight").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("assistant_knowledge_slug_idx").on(t.slug),
  index("assistant_knowledge_category_idx").on(t.category),
]);

export const assistantTrainingSamples = pgTable("assistant_training_samples", {
  id: serial("id").primaryKey(),
  knowledgeId: integer("knowledge_id").references(() => assistantKnowledge.id, { onDelete: "set null" }),
  prompt: text("prompt").notNull(),
  completion: text("completion").notNull(),
  intent: text("intent").notNull().default("general"),
  split: text("split").notNull().default("train"), // train | val | test
  tokens: integer("tokens").notNull().default(0),
  source: text("source").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("assistant_training_intent_idx").on(t.intent),
  index("assistant_training_split_idx").on(t.split),
  uniqueIndex("assistant_training_prompt_intent_idx").on(t.prompt, t.intent),
]);

export const assistantInteractions = pgTable("assistant_interactions", {
  id: serial("id").primaryKey(),
  mode: text("mode").notNull().default("support"),
  question: text("question").notNull(),
  answer: text("answer").notNull().default(""),
  confidence: doublePrecision("confidence").notNull().default(0),
  knowledgeId: integer("knowledge_id").references(() => assistantKnowledge.id, { onDelete: "set null" }),
  source: text("source").notNull().default("engine"),
  helpful: boolean("helpful"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("assistant_interactions_created_idx").on(t.createdAt)]);
