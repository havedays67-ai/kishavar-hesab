import { describe, it, expect } from "vitest";
import { detectIntent, normalizeFa, parseAmount, parseDueDate, isConfirm, isCancel, guessCategoryName } from "@/lib/ai/nlu";
import { LOCAL_PRAGMAS, LOCAL_SCHEMA_VERSION, MIGRATIONS, pendingMigrations } from "@/lib/engine/localdb";

describe("detectIntent — دستورهای واقعی کشاورز", () => {
  const cases: [string, string][] = [
    ["۲۵ میلیون تومان کود اوره برای زمین شمالی خریدم نسیه", "add_expense"],
    ["۵ میلیون گازوئیل خریدم", "add_expense"],
    ["۳ میلیون بابت تعمیر تراکتور پرداخت کردم", "add_expense"],
    ["برای فروشگاه نهاده ۴۴ میلیون چک ۱۰ روز بعد بنویس", "add_cheque"],
    ["چک فروشگاه نهاده پاس شد", "settle_cheque"],
    ["دستمزد حسن ۳ روز کار برداشت را ثبت کن", "add_labor"],
    ["مریم ۲۱ روز گل‌چینی کرد دستمزدش رو ثبت کن", "add_labor"],
    ["۵۰ کیلو کود اوره از انبار برای کشت گندم کم کن", "inventory_out"],
    ["۱۰۰ کیلو بذر وارد انبار کردم", "inventory_in"],
    ["یادم باشه هفته بعد بیمه را تمدید کنم", "add_task"],
    ["من به فروشگاه نهاده ۴۴ میلیون بدهکارم", "add_debt"],
    ["از صنایع تبدیلی ۹۶ میلیون طلب دارم", "add_receivable"],
    ["بدهی به مکانیکی را تسویه کردم", "settle_debt"],
    ["زمین جدید ۵ هکتار خریدم", "add_land"],
    ["گزارش سود و زیان بده", "report"],
    ["چقدر سود کردم؟", "report"],
    ["استهلاک تراکتور چطور محاسبه می‌شود؟", "learn"],
    ["فرق هزینه مستقیم و سربار چیست؟", "learn"],
    ["سلام خوبی", "unknown"],
    ["", "unknown"],
  ];
  it.each(cases)("«%s» → %s", (input, expected) => {
    expect(detectIntent(input)).toBe(expected);
  });
});

describe("normalizeFa", () => {
  it.each([
    ["ميخواهم", "میخواهم"],
    ["۱۲۳", "123"],
    ["می‌خواهم", "می خواهم"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeFa(input)).toBe(expected);
  });
});

describe("تطبیق NLU با موتور پول", () => {
  it.each([
    ["۲۵ میلیون", 25_000_000],
    ["دو میلیون و پانصد هزار", 2_500_000],
    ["۴۴ میلیون", 44_000_000],
  ])("مبلغ «%s» در NLU", (input, expected) => {
    expect(parseAmount(input)?.amount).toBe(expected);
  });
});

describe("تاریخ شمسی و نسبی", () => {
  it("امروز را می‌شناسد", () => {
    expect(parseDueDate("امروز")).toBe(new Date().toISOString().slice(0, 10));
  });
  it("فردا را می‌شناسد", () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    expect(parseDueDate("فردا")).toBe(d.toISOString().slice(0, 10));
  });
  it("«۱۰ روز بعد» را می‌شناسد", () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 10);
    expect(parseDueDate("۱۰ روز بعد")).toBe(d.toISOString().slice(0, 10));
  });
  it.each([
    ["۱۵ آبان", 11],
    ["۱ فروردین", 3],
  ])("تاریخ شمسی «%s» در ماه میلادی %d", (input, month) => {
    const parsed = parseDueDate(input);
    expect(parsed).toBeTruthy();
    expect(Number(parsed!.slice(5, 7))).toBe(month);
  });
  it("متن بی‌ربط null است", () => {
    expect(parseDueDate("سلام")).toBeNull();
  });
});

describe("تأیید و لغو", () => {
  it.each(["بله", "تأیید", "تایید", "ثبت کن", "اوکی", "درسته"])("«%s» تأیید است", (t) => {
    expect(isConfirm(t)).toBe(true);
  });
  it.each(["لغو", "نمیخوام", "بیخیال", "انصراف"])("«%s» لغو است", (t) => {
    expect(isCancel(t)).toBe(true);
  });
});

describe("تشخیص دسته", () => {
  it.each([
    ["خرید کود اوره", "کود و سم"],
    ["خرید بذر گندم", "بذر و نهال"],
    ["دستمزد کارگر", "دستمزد کارگر"],
    ["کرایه حمل محصول", "حمل و نقل"],
    ["قبض برق پمپ", "سوخت و انرژی"],
    ["خرید کارتن", "بسته‌بندی"],
  ])("«%s» → %s", (input, expected) => {
    expect(guessCategoryName(input)).toBe(expected);
  });
});

describe("اسکیمای SQLite آفلاین", () => {
  it("نسخه اسکیما مثبت است", () => {
    expect(LOCAL_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("نسخه مهاجرت‌ها یکتا و صعودی است", () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect([...versions].sort((a, b) => a - b)).toEqual(versions);
    expect(Math.max(...versions)).toBe(LOCAL_SCHEMA_VERSION);
  });

  it.each(MIGRATIONS.map((m) => [m.name, m] as const))("مهاجرت «%s» محتوای SQL دارد", (_name, migration) => {
    expect(migration.sql.length).toBeGreaterThan(0);
    for (const statement of migration.sql) expect(statement.trim().length).toBeGreaterThan(10);
  });

  it("جدول‌های اصلی ساخته می‌شوند", () => {
    const all = MIGRATIONS.flatMap((m) => m.sql).join("\n");
    for (const table of [
      "lands",
      "crops",
      "categories",
      "transactions",
      "inventory_items",
      "inventory_moves",
      "workers",
      "labor_logs",
      "equipment",
      "debts",
      "cheques",
      "tasks",
      "knowledge",
      "chat_threads",
      "chat_messages",
      "memory",
      "mutation_log",
      "download_state",
    ]) {
      expect(all).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("قیدهای امنیتی روی مبلغ و نوع وجود دارند", () => {
    const all = MIGRATIONS.flatMap((m) => m.sql).join("\n");
    expect(all).toContain("CHECK (amount > 0");
    expect(all).toContain("CHECK (kind IN ('income','expense'))");
    expect(all).toContain("CHECK (method IN ('cash','bank','credit'))");
    expect(all).toContain("CHECK (quantity >= 0)");
    expect(all).toContain("CHECK (days > 0 AND days <= 365)");
    expect(all).toContain("CHECK (status IN ('pending','passed','bounced'))");
  });

  it("ایندکس‌های کارایی وجود دارند", () => {
    const all = MIGRATIONS.flatMap((m) => m.sql).join("\n");
    for (const idx of ["txn_date_idx", "txn_land_idx", "txn_crop_idx", "cheque_due_idx", "debt_paid_idx", "crop_land_idx", "mutation_time_idx"]) {
      expect(all).toContain(idx);
    }
  });

  it("جستجوی متنی آفلاین (FTS5) برای RAG ساخته می‌شود", () => {
    const all = MIGRATIONS.flatMap((m) => m.sql).join("\n");
    expect(all).toContain("knowledge_fts");
    expect(all).toContain("fts5");
  });

  it("وضعیت دانلود مدل، قابل ادامه پس از قطعی است", () => {
    const all = MIGRATIONS.flatMap((m) => m.sql).join("\n");
    expect(all).toContain("bytes_done");
    expect(all).toContain("sha256");
    expect(all).toContain("etag");
  });

  it("به‌روزرسانی نسخه در settings ثبت می‌شود", () => {
    const all = MIGRATIONS.flatMap((m) => m.sql).join("\n");
    expect(all).toContain("schema_version");
  });

  it("pendingMigrations از نسخه جاری به بعد را برمی‌گرداند", () => {
    expect(pendingMigrations(LOCAL_SCHEMA_VERSION)).toHaveLength(0);
    expect(pendingMigrations(0)).toHaveLength(MIGRATIONS.length);
    expect(pendingMigrations(1).map((m) => m.version)).toEqual([2, 3]);
    expect(pendingMigrations(2).map((m) => m.version)).toEqual([3]);
  });

  it("PRAGMAهای کارایی موبایل تنظیم شده‌اند", () => {
    expect(LOCAL_PRAGMAS).toContain("PRAGMA journal_mode = WAL;");
    expect(LOCAL_PRAGMAS).toContain("PRAGMA foreign_keys = ON;");
    expect(LOCAL_PRAGMAS.some((p) => p.includes("cache_size"))).toBe(true);
  });
});
