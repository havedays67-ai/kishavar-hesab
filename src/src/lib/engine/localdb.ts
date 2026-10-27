/**
 * اسکیمای SQLite آفلاین (نسخه‌دار) برای اپ اندروید.
 * همان قواعد امنیتی نسخه PostgreSQL: مبلغ صحیح، CHECK، ایندکس.
 * اجرا با wa-sqlite / better-sqlite3 / expo-sqlite بدون تغییر.
 */

export const LOCAL_SCHEMA_VERSION = 3;

export interface Migration {
  version: number;
  name: string;
  sql: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "core-ledger",
    sql: [
      `PRAGMA foreign_keys = ON;`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
      );`,
      `CREATE TABLE IF NOT EXISTS lands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        area_ha REAL NOT NULL DEFAULT 0 CHECK (area_ha >= 0),
        region TEXT NOT NULL DEFAULT '',
        soil_type TEXT NOT NULL DEFAULT '',
        irrigation TEXT NOT NULL DEFAULT '',
        ownership TEXT NOT NULL DEFAULT 'owned' CHECK (ownership IN ('owned','shared','leased')),
        share_percent REAL NOT NULL DEFAULT 100 CHECK (share_percent >= 0 AND share_percent <= 100),
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS crops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        land_id INTEGER NOT NULL REFERENCES lands(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        variety TEXT NOT NULL DEFAULT '',
        season TEXT NOT NULL DEFAULT 'بهار',
        planting_date TEXT,
        harvest_date TEXT,
        expected_yield_kg REAL NOT NULL DEFAULT 0 CHECK (expected_yield_kg >= 0),
        actual_yield_kg REAL NOT NULL DEFAULT 0 CHECK (actual_yield_kg >= 0),
        status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('planned','in_progress','harvested')),
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS crop_land_idx ON crops(land_id);`,
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('income','expense')),
        icon TEXT NOT NULL DEFAULT '•',
        is_system INTEGER NOT NULL DEFAULT 0
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS category_name_kind_idx ON categories(name, kind);`,
      `CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL CHECK (kind IN ('income','expense')),
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        land_id INTEGER REFERENCES lands(id) ON DELETE SET NULL,
        crop_id INTEGER REFERENCES crops(id) ON DELETE SET NULL,
        amount INTEGER NOT NULL CHECK (amount > 0 AND amount <= 100000000000000),
        date TEXT NOT NULL CHECK (length(date) = 10),
        description TEXT NOT NULL DEFAULT '',
        party TEXT NOT NULL DEFAULT '',
        method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','bank','credit')),
        source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','assistant','seed')),
        created_at TEXT NOT NULL,
        deleted_at TEXT
      );`,
      `CREATE INDEX IF NOT EXISTS txn_date_idx ON transactions(date DESC);`,
      `CREATE INDEX IF NOT EXISTS txn_land_idx ON transactions(land_id);`,
      `CREATE INDEX IF NOT EXISTS txn_crop_idx ON transactions(crop_id);`,
      `CREATE INDEX IF NOT EXISTS txn_kind_idx ON transactions(kind);`,
    ],
  },
  {
    version: 2,
    name: "inventory-labor-equipment",
    sql: [
      `CREATE TABLE IF NOT EXISTS inventory_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT 'کیلوگرم',
        category TEXT NOT NULL DEFAULT 'نهاده',
        quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
        reorder_level REAL NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
        unit_cost INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
        warehouse TEXT NOT NULL DEFAULT 'انبار مرکزی',
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS inventory_name_idx ON inventory_items(name);`,
      `CREATE TABLE IF NOT EXISTS inventory_moves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('in','out')),
        quantity REAL NOT NULL CHECK (quantity > 0),
        unit_cost INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
        date TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        crop_id INTEGER REFERENCES crops(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS move_item_idx ON inventory_moves(item_id);`,
      `CREATE TABLE IF NOT EXISTS workers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'کارگر عمومی',
        phone TEXT NOT NULL DEFAULT '',
        daily_wage INTEGER NOT NULL DEFAULT 0 CHECK (daily_wage >= 0),
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS labor_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
        worker_name TEXT NOT NULL DEFAULT '',
        land_id INTEGER REFERENCES lands(id) ON DELETE SET NULL,
        crop_id INTEGER REFERENCES crops(id) ON DELETE SET NULL,
        date TEXT NOT NULL,
        days REAL NOT NULL CHECK (days > 0 AND days <= 365),
        daily_wage INTEGER NOT NULL CHECK (daily_wage > 0),
        amount INTEGER NOT NULL CHECK (amount >= 0),
        task TEXT NOT NULL DEFAULT '',
        paid INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS labor_date_idx ON labor_logs(date DESC);`,
      `CREATE TABLE IF NOT EXISTS equipment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'ماشین',
        purchase_date TEXT,
        purchase_price INTEGER NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
        salvage_value INTEGER NOT NULL DEFAULT 0 CHECK (salvage_value >= 0),
        useful_life_years REAL NOT NULL DEFAULT 10 CHECK (useful_life_years > 0),
        hours_used REAL NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );`,
    ],
  },
  {
    version: 3,
    name: "finance-tasks-ai",
    sql: [
      `CREATE TABLE IF NOT EXISTS debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        party TEXT NOT NULL,
        direction TEXT NOT NULL DEFAULT 'payable' CHECK (direction IN ('payable','receivable')),
        title TEXT NOT NULL DEFAULT '',
        amount INTEGER NOT NULL CHECK (amount > 0),
        due_date TEXT,
        paid INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS debt_paid_idx ON debts(paid);`,
      `CREATE TABLE IF NOT EXISTS cheques (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        party TEXT NOT NULL,
        direction TEXT NOT NULL DEFAULT 'issued' CHECK (direction IN ('issued','received')),
        amount INTEGER NOT NULL CHECK (amount > 0),
        due_date TEXT NOT NULL,
        bank TEXT NOT NULL DEFAULT '',
        serial TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','passed','bounced')),
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS cheque_due_idx ON cheques(due_date);`,
      `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        due_date TEXT,
        priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
        land_id INTEGER REFERENCES lands(id) ON DELETE SET NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT NOT NULL,
        title TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'پایه',
        embedding BLOB
      );`,
      `CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(title, tags, content, content='knowledge', content_rowid='id', tokenize='unicode61 remove_diacritics 2');`,
      `CREATE TABLE IF NOT EXISTS chat_threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mode TEXT NOT NULL CHECK (mode IN ('support','assistant')),
        title TEXT NOT NULL DEFAULT 'گفتگوی جدید',
        state TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id INTEGER NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
        content TEXT NOT NULL,
        meta TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS message_thread_idx ON chat_messages(thread_id);`,
      `CREATE TABLE IF NOT EXISTS memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        confidence REAL NOT NULL DEFAULT 0.8,
        hits INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS mutation_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('create','update','delete')),
        before_json TEXT,
        after_json TEXT,
        actor TEXT NOT NULL DEFAULT 'user' CHECK (actor IN ('user','assistant')),
        at TEXT NOT NULL,
        undone INTEGER NOT NULL DEFAULT 0
      );`,
      `CREATE INDEX IF NOT EXISTS mutation_time_idx ON mutation_log(at DESC);`,
      `CREATE TABLE IF NOT EXISTS download_state (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        bytes_total INTEGER NOT NULL DEFAULT 0,
        bytes_done INTEGER NOT NULL DEFAULT 0,
        etag TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','downloading','verifying','ready','failed')),
        updated_at TEXT NOT NULL
      );`,
      `INSERT INTO settings(key, value) VALUES ('schema_version','3') ON CONFLICT(key) DO UPDATE SET value='3';`,
    ],
  },
];

/** بازگرداندن دستورهای لازم برای رسیدن به آخرین نسخه */
export function pendingMigrations(currentVersion: number): Migration[] {
  return MIGRATIONS.filter((m) => m.version > currentVersion).sort((a, b) => a.version - b.version);
}

export const LOCAL_PRAGMAS = [
  "PRAGMA journal_mode = WAL;",
  "PRAGMA synchronous = NORMAL;",
  "PRAGMA foreign_keys = ON;",
  "PRAGMA temp_store = MEMORY;",
  "PRAGMA cache_size = -8000;",
  "PRAGMA busy_timeout = 5000;",
];

/** دستورهای پرکردن FTS پس از درج دانش (آفلاین RAG) */
export const FTS_REBUILD = `INSERT INTO knowledge_fts(knowledge_fts) VALUES('rebuild');`;
