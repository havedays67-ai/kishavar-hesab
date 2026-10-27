/**
 * فهرست مرکزی رکوردهای قابل ویرایش.
 * یک صفحه ویرایش عمومی (/edit/[entity]/[id]) از همین تعریف استفاده می‌کند
 * تا همه بخش‌ها (مالی، زمین، کشت، انبار، کارگر، ماشین، بدهی، چک و کارها)
 * هم دکمه ویرایش داشته باشند و هم دکمه حذف.
 */

export type FieldType = "text" | "number" | "date" | "textarea" | "select" | "checkbox";

export type OptionSource = "lands" | "crops" | "workers" | "categories" | "items";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  optionsFrom?: OptionSource;
  step?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}

export interface EntityDef {
  label: string;
  description: string;
  listPath: string;
  fields: FieldDef[];
}

const METHOD_OPTIONS = [
  { value: "cash", label: "نقدی" },
  { value: "bank", label: "بانکی / کارت" },
  { value: "credit", label: "اعتباری (بدهی)" },
];

export const ENTITIES = {
  transactions: {
    label: "رکورد مالی",
    description: "درآمد یا هزینه ثبت‌شده در دفتر عملیات",
    listPath: "/transactions",
    fields: [
      { name: "kind", label: "نوع", type: "select", required: true, options: [
        { value: "expense", label: "هزینه" },
        { value: "income", label: "درآمد" },
      ] },
      { name: "amount", label: "مبلغ (تومان)", type: "number", required: true, hint: "در گزارش‌ها به ریال و حروفی نمایش داده می‌شود." },
      { name: "categoryId", label: "دسته", type: "select", optionsFrom: "categories" },
      { name: "landId", label: "زمین", type: "select", optionsFrom: "lands" },
      { name: "cropId", label: "کشت", type: "select", optionsFrom: "crops" },
      { name: "date", label: "تاریخ", type: "date" },
      { name: "party", label: "طرف حساب", type: "text", placeholder: "فروشگاه، خریدار، ..." },
      { name: "description", label: "شرح", type: "textarea" },
      { name: "method", label: "روش پرداخت", type: "select", options: METHOD_OPTIONS },
      { name: "done", label: "قطعیت‌یافته (ثبت‌شده)", type: "checkbox" },
    ],
  },
  lands: {
    label: "زمین",
    description: "مشخصات قطعه زمین و نوع مالکیت",
    listPath: "/lands",
    fields: [
      { name: "name", label: "نام زمین", type: "text", required: true },
      { name: "areaHa", label: "مساحت (هکتار)", type: "number", step: "0.01" },
      { name: "region", label: "منطقه", type: "text" },
      { name: "soilType", label: "نوع خاک", type: "text" },
      { name: "irrigation", label: "روش آبیاری", type: "text" },
      { name: "ownership", label: "مالکیت", type: "select", options: [
        { value: "owned", label: "ملکی" },
        { value: "shared", label: "مشارکتی" },
        { value: "leased", label: "اجاره‌ای" },
      ] },
      { name: "sharePercent", label: "درصد سهم", type: "number", step: "0.1" },
      { name: "notes", label: "یادداشت", type: "textarea" },
    ],
  },
  crops: {
    label: "کشت",
    description: "اطلاعات کشت، برداشت و وضعیت",
    listPath: "/crops",
    fields: [
      { name: "landId", label: "زمین", type: "select", required: true, optionsFrom: "lands" },
      { name: "name", label: "محصول", type: "text", required: true },
      { name: "variety", label: "رقم / رقم بذر", type: "text" },
      { name: "season", label: "فصل", type: "text" },
      { name: "plantingDate", label: "تاریخ کاشت", type: "date" },
      { name: "harvestDate", label: "تاریخ برداشت", type: "date" },
      { name: "expectedYieldKg", label: "برداشت پیش‌بینی‌شده (کیلو)", type: "number", step: "0.1" },
      { name: "actualYieldKg", label: "برداشت واقعی (کیلو)", type: "number", step: "0.1" },
      { name: "status", label: "وضعیت", type: "select", options: [
        { value: "planned", label: "برنامه‌ریزی‌شده" },
        { value: "in_progress", label: "در حال کشت" },
        { value: "harvested", label: "برداشت‌شده" },
      ] },
      { name: "notes", label: "یادداشت", type: "textarea" },
    ],
  },
  inventory_items: {
    label: "کالای انبار",
    description: "نام، موجودی و بهای واحد کالا",
    listPath: "/inventory",
    fields: [
      { name: "name", label: "نام کالا", type: "text", required: true },
      { name: "unit", label: "واحد", type: "text" },
      { name: "category", label: "گروه", type: "text" },
      { name: "quantity", label: "موجودی", type: "number", step: "0.1" },
      { name: "reorderLevel", label: "حد سفارش", type: "number", step: "0.1" },
      { name: "unitCost", label: "بهای واحد (تومان)", type: "number" },
      { name: "warehouse", label: "انبار", type: "text" },
    ],
  },
  inventory_moves: {
    label: "حرکت انبار",
    description: "ورود یا خروج کالا از انبار",
    listPath: "/inventory",
    fields: [
      { name: "itemId", label: "کالا", type: "select", required: true, optionsFrom: "items" },
      { name: "kind", label: "نوع حرکت", type: "select", required: true, options: [
        { value: "in", label: "ورود به انبار" },
        { value: "out", label: "خروج از انبار" },
      ] },
      { name: "quantity", label: "مقدار", type: "number", step: "0.1", required: true },
      { name: "unitCost", label: "بهای واحد (تومان)", type: "number" },
      { name: "date", label: "تاریخ", type: "date" },
      { name: "cropId", label: "کشت مرتبط", type: "select", optionsFrom: "crops" },
      { name: "note", label: "توضیح", type: "textarea" },
    ],
  },
  workers: {
    label: "کارگر",
    description: "مشخصات و دستمزد روزانه نیروی کار",
    listPath: "/labor",
    fields: [
      { name: "name", label: "نام و نام خانوادگی", type: "text", required: true },
      { name: "role", label: "نقش", type: "text" },
      { name: "phone", label: "شماره تماس", type: "text" },
      { name: "dailyWage", label: "دستمزد روزانه (تومان)", type: "number" },
      { name: "active", label: "فعال", type: "checkbox" },
    ],
  },
  labor_logs: {
    label: "دستمزد",
    description: "ثبت روزهای کار و مبلغ دستمزد",
    listPath: "/labor",
    fields: [
      { name: "workerId", label: "کارگر", type: "select", optionsFrom: "workers" },
      { name: "workerName", label: "نام کارگر (دستی)", type: "text" },
      { name: "landId", label: "زمین", type: "select", optionsFrom: "lands" },
      { name: "cropId", label: "کشت", type: "select", optionsFrom: "crops" },
      { name: "date", label: "تاریخ", type: "date" },
      { name: "days", label: "تعداد روز", type: "number", step: "0.5" },
      { name: "dailyWage", label: "دستمزد روزانه (تومان)", type: "number" },
      { name: "task", label: "شرح کار", type: "textarea" },
      { name: "paid", label: "پرداخت شد", type: "checkbox" },
    ],
  },
  equipment: {
    label: "ماشین‌آلات",
    description: "اطلاعات خرید و استهلاک ماشین",
    listPath: "/equipment",
    fields: [
      { name: "name", label: "نام ماشین", type: "text", required: true },
      { name: "type", label: "نوع", type: "text" },
      { name: "purchaseDate", label: "تاریخ خرید", type: "date" },
      { name: "purchasePrice", label: "بهای خرید (تومان)", type: "number" },
      { name: "salvageValue", label: "ارزش اسقاط (تومان)", type: "number" },
      { name: "usefulLifeYears", label: "عمر مفید (سال)", type: "number", step: "0.1" },
      { name: "hoursUsed", label: "ساعت کارکرد", type: "number", step: "0.1" },
      { name: "notes", label: "یادداشت", type: "textarea" },
    ],
  },
  debts: {
    label: "بدهی / طلب",
    description: "بدهی یا طلب با سررسید و وضعیت تسویه",
    listPath: "/finance",
    fields: [
      { name: "party", label: "طرف حساب", type: "text", required: true },
      { name: "direction", label: "نوع", type: "select", options: [
        { value: "payable", label: "بدهی ما" },
        { value: "receivable", label: "طلب ما" },
      ] },
      { name: "title", label: "بابت", type: "text" },
      { name: "amount", label: "مبلغ (تومان)", type: "number", required: true },
      { name: "dueDate", label: "سررسید", type: "date" },
      { name: "paid", label: "تسویه‌شده", type: "checkbox" },
      { name: "notes", label: "یادداشت", type: "textarea" },
    ],
  },
  cheques: {
    label: "چک",
    description: "چک صادره یا دریافتی و وضعیت آن",
    listPath: "/finance",
    fields: [
      { name: "party", label: "طرف حساب", type: "text", required: true },
      { name: "direction", label: "نوع", type: "select", options: [
        { value: "issued", label: "صادره" },
        { value: "received", label: "دریافتی" },
      ] },
      { name: "amount", label: "مبلغ (تومان)", type: "number", required: true },
      { name: "dueDate", label: "سررسید", type: "date" },
      { name: "bank", label: "بانک", type: "text" },
      { name: "serial", label: "سریال", type: "text" },
      { name: "status", label: "وضعیت", type: "select", options: [
        { value: "pending", label: "در انتظار" },
        { value: "passed", label: "پاس‌شده" },
        { value: "bounced", label: "برگشتی" },
      ] },
      { name: "notes", label: "یادداشت", type: "textarea" },
    ],
  },
  tasks: {
    label: "کار / یادآور",
    description: "کارهای باز و انجام‌شده مزرعه",
    listPath: "/",
    fields: [
      { name: "title", label: "عنوان", type: "text", required: true },
      { name: "dueDate", label: "سررسید", type: "date" },
      { name: "priority", label: "اولویت", type: "select", options: [
        { value: "low", label: "کم" },
        { value: "normal", label: "معمولی" },
        { value: "high", label: "زیاد" },
      ] },
      { name: "status", label: "وضعیت", type: "select", options: [
        { value: "open", label: "باز" },
        { value: "done", label: "انجام‌شده" },
      ] },
      { name: "landId", label: "زمین", type: "select", optionsFrom: "lands" },
    ],
  },
} as const satisfies Record<string, EntityDef>;

export type EntityKey = keyof typeof ENTITIES;

export function isEntityKey(value: string): value is EntityKey {
  return Object.prototype.hasOwnProperty.call(ENTITIES, value);
}

export function entityDef(value: string): EntityDef | null {
  return isEntityKey(value) ? ENTITIES[value] : null;
}
