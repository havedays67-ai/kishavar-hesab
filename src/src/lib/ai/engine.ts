import { db } from "@/db";
import {
  assistantNotes,
  categories,
  cheques,
  crops as cropsTable,
  debts,
  inventoryItems,
  inventoryMoves,
  knowledge,
  laborLogs,
  lands,
  tasks,
  transactions,
  workers,
} from "@/db/schema";
import {
  buildFarmContext,
  getCheques,
  getDebts,
  getFarmOverview,
  getInventory,
  getKnowledge,
  getLands,
  getCategories,
  getWorkers,
  getCrops,
} from "@/lib/data";
import { eq } from "drizzle-orm";
import { formatMoney, formatMoneyWords, formatNumber, todayISO, formatDate, safeNum } from "@/lib/format";
import {
  containsAny,
  detectIntent,
  guessCategoryName,
  isCancel,
  isConfirm,
  matchByName,
  normalizeFa,
  parseAmount,
  parseDueDate,
  parseQuantity,
  type AssistIntent,
} from "@/lib/ai/nlu";

export type ChatMode = "support" | "assistant";

export type ActionLink = { label: string; href?: string; kind: string };
export type EngineReply = {
  text: string;
  actions: ActionLink[];
  suggestions: string[];
  kind: "answer" | "question" | "preview" | "done" | "blocked";
};

export type Pending = {
  intent: AssistIntent;
  slots: Record<string, string | number | null>;
};

const MODE_LABEL: Record<ChatMode, string> = { support: "پشتیبان", assistant: "دستیار" };

/* ------------------------------ helpers ------------------------------ */

function money(v: number): string {
  return `${formatMoney(v)} (${formatMoneyWords(v)})`;
}

function extractParty(text: string, known: string[]): string | null {
  const knownMatch = matchByName(text, known.map((name) => ({ name })));
  if (knownMatch) return knownMatch.name;
  const m = normalizeFa(text).match(/(?:برای|به|از|نزد|آقای|خانم|شرکت|فروشگاه|تعاونی)\s+([\p{L}\s]{2,30})/u);
  if (!m) return null;
  const cleaned = m[1]
    .replace(/(بنویس|بکش|ثبت کن|ثبت|بده|صادر کن|پرداخت کن|بگیر|یادداشت کن|اضافه کن|خریدم|فروختم)/gu, " ")
    .replace(/\b(بابت|چک|بدهی|طلب|تاریخ|سررسید|تومان|میلیون|هزار|را|رو|هم|برای|به|از)\b/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}

function matchLand(text: string, landsList: { id: number; name: string }[]): number | null {
  const hit = matchByName(text, landsList);
  return hit?.id ?? null;
}

function matchCrop(text: string, cropList: { id: number; name: string }[]): number | null {
  const hit = matchByName(
    text,
    cropList.map((c) => ({ ...c, name: c.name })),
  );
  return hit?.id ?? null;
}

async function resolveCategoryId(name: string | null, kind: "income" | "expense"): Promise<number | null> {
  if (!name) return null;
  const rows = await db.select().from(categories).where(eq(categories.kind, kind));
  const hit = rows.find((r) => normalizeFa(r.name) === normalizeFa(name)) ?? matchByName(name, rows);
  return hit?.id ?? null;
}

async function learn(title: string, detail: string, kind = "learned"): Promise<void> {
  const recent = await db.select().from(assistantNotes).orderBy(assistantNotes.id).limit(1);
  const last = recent[0];
  if (last && last.title === title) return;
  await db.insert(assistantNotes).values({ title, detail, kind, confidence: 0.9 });
}

async function refreshInsights(): Promise<void> {
  const o = await getFarmOverview();
  const top = o.expenseBreakdown[0];
  if (top) {
    await learn(
      `سنگین‌ترین سرفصل هزینه: ${top.name}`,
      `تا امروز ${money(top.amount)} در این سرفصل ثبت شده است (${Math.round(top.share * 100)}٪ کل هزینه). کاهش ۱۰٪ در این سرفصل معادل ${money(
        Math.round(top.amount * 0.1),
      )} صرفه‌جویی است.`,
      "insight",
    );
  }
  const worstLand = [...o.landStats].sort((a, b) => a.profit - b.profit)[0];
  if (worstLand && worstLand.land) {
    await learn(
      `پایش زمین ${worstLand.land.name}`,
      `سود این زمین ${money(worstLand.profit)} و هزینه هر هکتار ${money(Math.round(worstLand.costPerHa))} است. برای تحلیل دقیق‌تر، هزینه‌های بدون زمین را به قطعه مربوطه نسبت دهید.`,
      "insight",
    );
  }
  if (o.totals.unpaidLabor > 0) {
    await learn(
      "دستمزد پرداخت‌نشده در انتظار تسویه",
      `${money(o.totals.unpaidLabor)} دستمزد پرداخت‌نشده وجود دارد؛ در محاسبه نقدینگی لحاظ شد.`,
      "insight",
    );
  }
}

/* --------------------------- knowledge RAG --------------------------- */

const STOPWORDS = new Set([
  "از",
  "به",
  "در",
  "را",
  "با",
  "که",
  "این",
  "آن",
  "برای",
  "چه",
  "چی",
  "چطور",
  "چگونه",
  "است",
  "هست",
  "می",
  "شود",
  "کن",
  "کنم",
  "کنیم",
  "من",
  "شما",
  "یک",
  "و",
  "یا",
  "هم",
  "تا",
  "بر",
  "های",
  "ها",
  "شده",
  "کرد",
  "دارد",
]);

function tokens(text: string): string[] {
  return normalizeFa(text)
    .split(" ")
    .map((t) => t.replace(/[.,:;]/g, ""))
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

type Retrieved = { title: string; topic: string; content: string; score: number };

async function retrieveKnowledge(question: string, limit = 2): Promise<Retrieved[]> {
  const rows = await getKnowledge();
  const qTokens = tokens(question);
  if (!qTokens.length) return [];
  const scored = rows.map((row) => {
    const haystack = normalizeFa(`${row.title} ${row.topic} ${row.tags} ${row.content}`);
    let score = 0;
    for (const token of qTokens) {
      if (normalizeFa(row.title).includes(token)) score += 6;
      if (normalizeFa(row.tags).includes(token)) score += 4;
      if (haystack.includes(token)) score += 1.5;
    }
    return { title: row.title, topic: row.topic, content: row.content, score };
  });
  return scored
    .filter((s) => s.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const OFF_TOPIC = [
  "فوتبال",
  "سیاست",
  "فیلم",
  "سریال",
  "موسیقی",
  "آشپزی",
  "بیمه عمر",
  "کریپتو",
  "بیت کوین",
  "بورس",
  "سهام",
  "دارو",
  "پزشک",
  "سفر",
  "هوا",
  "رابطه",
  "عشق",
  "بازی",
];

/* --------------------------- farm reporting --------------------------- */

type ReportKind =
  | "profit"
  | "expense"
  | "income"
  | "land"
  | "cropcost"
  | "debt"
  | "cheque"
  | "inventory"
  | "labor"
  | "general";

function detectReportKind(text: string): ReportKind {
  const t = normalizeFa(text);
  if (/(سود|زیان|حاشیه|تحلیل|وضعیت مالی|خلاصه|جمع)/u.test(t)) return "profit";
  if (/(هزینه|خرج|سرفصل)/u.test(t)) return "expense";
  if (/(درامد|فروش|درامدی)/u.test(t)) return "income";
  if (/(زمین|قطعه|هکتار)/u.test(t)) return "land";
  if (/(بهای تمام|قیمت تمام|کیلو|تمام شده)/u.test(t)) return "cropcost";
  if (/(بدهی|طلب|بدهکار|طلبکار|وام)/u.test(t)) return "debt";
  if (/(چک|سررسید)/u.test(t)) return "cheque";
  if (/(انبار|موجودی|نهاده|کمبود)/u.test(t)) return "inventory";
  if (/(کارگر|دستمزد|نفر)/u.test(t)) return "labor";
  return "general";
}

async function buildReport(text: string): Promise<EngineReply> {
  const o = await getFarmOverview();
  const kind = detectReportKind(text);
  const lines: string[] = [];
  const suggestions: string[] = [];
  const actions: ActionLink[] = [{ label: "صفحه گزارش‌ها", href: "/reports", kind: "link" }];

  if (kind === "profit" || kind === "general") {
    lines.push("📊 گزارش سود و زیان مزرعه (بر اساس داده‌های همین نرم‌افزار):");
    lines.push(`• درآمد کل: ${money(o.totals.income)}`);
    lines.push(`• هزینه کل: ${money(o.totals.expense)}`);
    lines.push(`• سود عملیاتی: ${money(o.totals.profit)}`);
    lines.push(`• حاشیه سود: ${formatNumber(Math.round(o.totals.margin * 100))}٪`);
    lines.push(`• سطح زیرکشت: ${formatNumber(o.totals.landArea, 1)} هکتار در ${formatNumber(o.landStats.length)} قطعه`);
    if (o.expenseBreakdown[0]) {
      lines.push(
        `• بزرگ‌ترین سرفصل هزینه: ${o.expenseBreakdown[0].name} با ${money(o.expenseBreakdown[0].amount)} (${formatNumber(Math.round(o.expenseBreakdown[0].share * 100))}٪)`,
      );
    }
    const best = [...o.landStats].sort((a, b) => b.profit - a.profit)[0];
    if (best) lines.push(`• سودآورترین قطعه: ${best.land.name} با سود ${money(best.profit)}`);
    lines.push(
      `• بدهی سررسیدشده/نشده ما: ${money(o.totals.payable)} | طلب ما: ${money(o.totals.receivable)}`,
    );
    lines.push(
      `• نکته مدیریتی: ${o.totals.profit >= 0 ? "سود مثبت است؛ برای حفظ آن، هزینه هر هکتار را در قطعات ضعیف‌تر بررسی کنید." : "زیان ثبت شده؛ پیشنهاد می‌کنم ابتدا سرفصل‌های بزرگ هزینه و بدهی‌های سررسیددار را بازبینی کنید."}`,
    );
    suggestions.push("تفکیک هزینه‌ها را نشان بده", "بهای تمام‌شده هر محصول چقدر است؟", "هشدارهای نقدینگی چیست؟");
  }

  if (kind === "expense") {
    lines.push("🧾 تفکیک هزینه‌ها:");
    for (const b of o.expenseBreakdown.slice(0, 8)) {
      lines.push(`• ${b.icon} ${b.name}: ${money(b.amount)} — ${formatNumber(Math.round(b.share * 100))}٪`);
    }
    if (!o.expenseBreakdown.length) lines.push("هنوز هزینه‌ای ثبت نشده است.");
    lines.push("پیشنهاد: برای دقت بیشتر، هر هزینه را به زمین و کشت مربوطه نسبت دهید.");
    suggestions.push("پرهزینه‌ترین زمین کدام است؟", "گزارش سود بده");
  }

  if (kind === "income") {
    lines.push("💰 تفکیک درآمدها:");
    for (const b of o.incomeBreakdown.slice(0, 8)) lines.push(`• ${b.icon} ${b.name}: ${money(b.amount)}`);
    if (!o.incomeBreakdown.length) lines.push("هنوز درآمدی ثبت نشده است.");
    suggestions.push("چقدر طلب دارم؟", "سود خالص چقدر است؟");
  }

  if (kind === "land") {
    lines.push("🌍 عملکرد قطعات:");
    for (const l of o.landStats) {
      lines.push(
        `• ${l.land.name} (${formatNumber(l.land.areaHa, 1)} هکتار): درآمد ${money(l.income)} | هزینه ${money(l.expense)} | سود ${money(l.profit)} | هزینه هر هکتار ${money(Math.round(l.costPerHa))}`,
      );
    }
    suggestions.push("سودآورترین زمین کیست؟", "بدهی‌ها را بگو");
  }

  if (kind === "cropcost") {
    lines.push("🌾 بهای تمام‌شده هر محصول:");
    for (const c of o.cropStats) {
      lines.push(
        `• ${c.crop.name} در ${c.landName}: هزینه ${money(c.expense)} | درآمد ${money(c.income)} | برداشت ${formatNumber(
          c.crop.actualYieldKg || c.crop.expectedYieldKg,
        )} کیلو | بهای تمام‌شده هر کیلو ${c.costPerKg ? money(Math.round(c.costPerKg)) : "نامشخص"}`,
      );
    }
    lines.push("فرمول: هزینه‌های همان کشت ÷ برداشت واقعی. برای محصول چندساله (زعفران) هزینه‌های سال‌های قبل را هم منظور کنید.");
    suggestions.push("چطور بهای تمام‌شده را دقیق‌تر کنم؟", "گزارش زمین‌ها");
  }

  if (kind === "debt") {
    const [debtRows] = await Promise.all([getDebts()]);
    lines.push("📉 بدهی‌ها و طلب‌ها:");
    for (const d of debtRows.filter((x) => !x.paid)) {
      lines.push(
        `• ${d.direction === "payable" ? "بدهی به" : "طلب از"} ${d.party}: ${money(d.amount)}${
          d.dueDate ? ` — سررسید ${formatDate(d.dueDate)}` : ""
        }`,
      );
    }
    lines.push(`موجودی خالص بدهی: ${money(o.totals.payable - o.totals.receivable)}`);
    if (!debtRows.filter((x) => !x.paid).length) lines.push("بدهی تسویه‌نشده‌ای ثبت نشده است.");
    actions.push({ label: "مدیریت بدهی و چک", href: "/finance", kind: "link" });
    suggestions.push("چک‌های نزدیک سررسید", "بدهکار جدید ثبت کن");
  }

  if (kind === "cheque") {
    const rows = await getCheques();
    lines.push("🧾 وضعیت چک‌ها:");
    for (const c of rows) {
      lines.push(
        `• ${c.direction === "issued" ? "صادره" : "دریافتی"} ${c.party}: ${money(c.amount)} — ${
          c.status === "pending" ? "در انتظار" : c.status === "passed" ? "پاس‌شده" : "برگشتی"
        }${c.dueDate ? ` — سررسید ${formatDate(c.dueDate)}` : ""}`,
      );
    }
    lines.push(`جمع چک‌های در انتظار: ${money(o.totals.chequeUpcoming)}`);
    actions.push({ label: "مدیریت چک‌ها", href: "/finance", kind: "link" });
    suggestions.push("برام یادآوری چک بگذار", "چک صادره جدید ثبت کن");
  }

  if (kind === "inventory") {
    const items = await getInventory();
    lines.push("📦 وضعیت انبار:");
    for (const i of items) {
      const low = i.quantity <= i.reorderLevel;
      lines.push(
        `• ${i.name}: ${formatNumber(i.quantity, 1)} ${i.unit}${low ? " ⚠️ زیر حد سفارش" : ""} — ارزش ${money(i.quantity * i.unitCost)}`,
      );
    }
    lines.push(`ارزش کل انبار: ${money(o.totals.inventoryValue)}`);
    actions.push({ label: "صفحه انبار", href: "/inventory", kind: "link" });
    suggestions.push("موجودی سم را کم کن", "کمبودهای انبار");
  }

  if (kind === "labor") {
    const [workerRows] = await Promise.all([getWorkers()]);
    lines.push("👷 دستمزد و نیروی کار:");
    for (const w of workerRows) {
      lines.push(`• ${w.name} (${w.role}): روزمزد ${money(w.dailyWage)}`);
    }
    lines.push(`دستمزد پرداخت‌نشده: ${money(o.totals.unpaidLabor)}`);
    actions.push({ label: "مدیریت کارگران", href: "/labor", kind: "link" });
    suggestions.push("دستمزد کارگر ثبت کن", "گزارش سود");
  }

  return { text: lines.join("\n"), actions, suggestions, kind: "answer" };
}

/* --------------------------- teaching mode --------------------------- */

async function answerSupport(question: string): Promise<EngineReply> {
  const t = normalizeFa(question);
  const intent = detectIntent(question);

  if (intent !== "report" && intent !== "learn" && intent !== "unknown") {
    return {
      text:
        `در حالت «پشتیبان» دسترسی تغییر داده ندارم؛ اگر می‌خواهید همین مورد را در نرم‌افزار ثبت کنم، حالت را روی «دستیار» بگذارید و دوباره بگویید.\n` +
        "در حالت پشتیبان می‌توانم درباره همین موضوع آموزش بدهم، راهنمای همان بخش را توضیح دهم یا گزارش آماده کنم.",
      actions: [{ label: "رفتن به گزارش‌ها", href: "/reports", kind: "link" }],
      suggestions: ["چطور هزینه دستمزد را ثبت کنم؟", "بهای تمام‌شده چیست؟", "گزارش سود بده"],
      kind: "blocked",
    };
  }

  const wantsTeaching = /(چطور|چگونه|یعنی|فرق|تفاوت|چرا|اموزش|یاد بده|محاسبه)/u.test(t);
  if (wantsTeaching && intent !== "report") {
    const teaching = await retrieveKnowledge(question, 2);
    if (teaching.length) {
      return {
        text: `${teaching.map((h) => `📚 ${h.title} (موضوع: ${h.topic})\n${h.content}`).join("\n\n")}\n\nاگر بخش خاصی از نرم‌افزار را می‌خواهید بگویید تا قدم‌به‌قدم راهنمایی کنم.`,
        actions: [{ label: "پایگاه دانش کشاورزی", href: "/knowledge", kind: "link" }],
        suggestions: ["گزارش هزینه‌ها", "بهای تمام‌شده محصولات من", "مدیریت چک و نقدینگی"],
        kind: "answer",
      };
    }
  }

  if (intent === "report" || /(چقدر|چند|گزارش|سود|وضعیت|موجودی|بدهی)/u.test(t)) {
    const report = await buildReport(question);
    if (report.text) return report;
  }

  if (containsAny(question, OFF_TOPIC)) {
    return {
      text:
        "من فقط در حوزه «حسابداری و مدیریت مالی کشاورزی» و همین نرم‌افزار آموزش می‌دهم و درباره موضوعات دیگر اظهارنظر نمی‌کنم. مثلاً می‌توانید بپرسید: بهای تمام‌شده زعفران چطور محاسبه می‌شود؟ استهلاک تراکتور؟ یا نقطه سربه‌سر مزرعه؟",
      actions: [{ label: "پایگاه دانش", href: "/knowledge", kind: "link" }],
      suggestions: ["استهلاک تراکتور چطور محاسبه می‌شود؟", "نقطه سربه‌سر مزرعه چیست؟", "مدیریت موجودی نهاده"],
      kind: "blocked",
    };
  }

  const hits = await retrieveKnowledge(question, 2);
  if (hits.length) {
    const body = hits
      .map((h) => `📚 ${h.title} (موضوع: ${h.topic})\n${h.content}`)
      .join("\n\n");
    return {
      text: `${body}\n\nاگر بخش خاصی از نرم‌افزار را می‌خواهید، بگویید تا قدم‌به‌قدم راهنمایی کنم.`,
      actions: [{ label: "پایگاه دانش کشاورزی", href: "/knowledge", kind: "link" }],
      suggestions: ["بهای تمام‌شده چه فرقی با سود ناخالص دارد؟", "گزارش هزینه‌ها", "چک را چطور مدیریت کنم؟"],
      kind: "answer",
    };
  }

  const report = await buildReport(question);
  return {
    text:
      `پاسخ مستقیمی در پایگاه دانش پیدا نکردم. بر اساس داده‌های مزرعه شما این خلاصه را دارم:\n${report.text}\n\n` +
      "می‌توانید بپرسید: «بهای تمام‌شده هر محصول»، «استهلاک ماشین‌آلات»، «مدیریت چک و نقدینگی» یا «تفاوت هزینه مستقیم و سربار».",
    actions: report.actions,
    suggestions: ["تفاوت هزینه مستقیم و سربار", "گزارش بهای تمام‌شده", "راهنمای ثبت تراکنش"],
    kind: "answer",
  };
}

/* --------------------------- assistant tools --------------------------- */

type Draft = {
  intent: AssistIntent;
  slots: Record<string, string | number | null>;
  title: string;
};

async function buildDraft(intent: AssistIntent, text: string): Promise<Draft> {
  const [landRows, cropRows, invRows, workerRows, catRows, debtRows, chequeRows] = await Promise.all([
    getLands(),
    getCrops(),
    getInventory(),
    getWorkers(),
    getCategories(),
    getDebts(),
    getCheques(),
  ]);

  const knownParties = [
    ...new Set([
      ...debtRows.map((d) => d.party),
      ...chequeRows.map((c) => c.party),
    ]),
  ];

  const amount = parseAmount(text)?.amount ?? null;
  const landId = matchLand(text, landRows);
  const cropId = matchCrop(text, cropRows);
  const guessCat = guessCategoryName(text);
  const date = parseDueDate(text) ?? todayISO();

  switch (intent) {
    case "add_expense":
    case "add_income": {
      const categoryName =
        catRows.find((c) => normalizeFa(text).includes(normalizeFa(c.name)))?.name ??
        guessCat ??
        (intent === "add_income" ? "فروش محصول" : null);
      return {
        intent,
        title: intent === "add_income" ? "ثبت درآمد" : "ثبت هزینه",
        slots: {
          amount,
          categoryName,
          landId,
          cropId,
          date,
          party: extractParty(text, knownParties),
          method: /(نقد|نقدی)/u.test(text) ? "cash" : /(بانک|کارت|واریز)/u.test(text) ? "bank" : /(نسیه|اعتباری|بعدا)/u.test(text) ? "credit" : "cash",
          description: normalizeFa(text).slice(0, 90),
        },
      };
    }
    case "add_debt":
    case "add_receivable": {
      return {
        intent,
        title: intent === "add_debt" ? "ثبت بدهی" : "ثبت طلب",
        slots: {
          party: extractParty(text, knownParties),
          amount,
          date,
          dueDate: parseDueDate(text),
          title: normalizeFa(text).slice(0, 80),
        },
      };
    }
    case "add_cheque": {
      return {
        intent,
        title: "ثبت چک",
        slots: {
          party: extractParty(text, knownParties),
          amount,
          dueDate: parseDueDate(text),
          direction: /(دریافتی|گرفتم|از .* گرفتم|دریافت)/u.test(text) ? "received" : "issued",
          bank: (normalizeFa(text).match(/(بانک\s+[\p{L}]+)/u) ?? [])[1] ?? "",
        },
      };
    }
    case "add_task": {
      const clean = text
        .replace(/(یادداشت|یادم باشه|یاداوری|یادآوری|کار جدید|کار برام|تسک|وظیفه|اضافه کن به کارها|ثبت کن|بذار|بگذار)/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
      return {
        intent,
        title: "ثبت کار",
        slots: { title: clean || normalizeFa(text), dueDate: parseDueDate(text), priority: /(فوری|مهم|زود)/u.test(text) ? "high" : "normal", landId },
      };
    }
    case "add_labor": {
      const worker = matchByName(text, workerRows);
      const days = parseQuantity(text);
      return {
        intent,
        title: "ثبت دستمزد",
        slots: {
          workerName: worker?.name ?? (extractParty(text, workerRows.map((w) => w.name)) || null),
          days,
          dailyWage: worker?.dailyWage ?? null,
          landId,
          cropId,
          task: normalizeFa(text).slice(0, 80),
          date,
        },
      };
    }
    case "inventory_out":
    case "inventory_in": {
      const item = matchByName(text, invRows);
      return {
        intent,
        title: intent === "inventory_out" ? "خروج از انبار" : "ورود به انبار",
        slots: { itemId: item?.id ?? null, itemName: item?.name ?? null, quantity: parseQuantity(text), landId, cropId, date },
      };
    }
    case "settle_cheque": {
      const cheque = matchByName(
        text,
        chequeRows.map((c) => ({ id: c.id, name: c.party })),
      );
      return { intent, title: "تسویه چک", slots: { chequeId: cheque?.id ?? null } };
    }
    case "settle_debt": {
      const debt = matchByName(
        text,
        debtRows.filter((d) => !d.paid).map((d) => ({ id: d.id, name: d.party })),
      );
      return { intent, title: "تسویه بدهی/طلب", slots: { debtId: debt?.id ?? null } };
    }
    case "add_land": {
      return {
        intent,
        title: "ثبت زمین جدید",
        slots: {
          name: extractParty(text, landRows.map((l) => l.name)) ?? null,
          areaHa: parseQuantity(text),
          region: (normalizeFa(text).match(/(?:در|منطقه|روستای)\s+([\p{L}\s]{2,25})/u) ?? [])[1] ?? "",
        },
      };
    }
    default:
      return { intent: "unknown", title: "", slots: {} };
  }
}

const REQUIRED: Partial<Record<AssistIntent, string[]>> = {
  add_expense: ["amount", "categoryName"],
  add_income: ["amount", "categoryName"],
  add_debt: ["party", "amount"],
  add_receivable: ["party", "amount"],
  add_cheque: ["party", "amount", "dueDate"],
  add_task: ["title"],
  add_labor: ["workerName", "days", "dailyWage"],
  inventory_out: ["itemId", "quantity"],
  inventory_in: ["itemId", "quantity"],
  settle_cheque: ["chequeId"],
  settle_debt: ["debtId"],
  add_land: ["name", "areaHa"],
};

const QUESTIONS: Record<string, string> = {
  amount: "مبلغ را چقدر ثبت کنم؟ (مثلاً ۱۲ میلیون تومان)",
  categoryName: "این مورد در کدام دسته باشد؟ (مثلاً بذر و نهال، کود و سم، دستمزد کارگر، فروش محصول)",
  party: "طرف حساب کیست؟ نام شخص یا فروشگاه را بگویید.",
  dueDate: "تاریخ سررسید چه زمانی است؟ (مثلاً ۱۵ آبان یا ۱۰ روز بعد)",
  title: "چه کاری را یادآوری کنم؟",
  workerName: "نام کارگر چیست؟",
  days: "چند روز یا چند نفر-روز کار کرده است؟",
  dailyWage: "دستمزد روزانه چقدر است؟ (مثلاً ۱ میلیون و ۳۰۰ هزار تومان)",
  itemId: "کدام نهاده از انبار؟ (نام کالا را بگویید)",
  quantity: "چه مقدار است؟ (با واحد، مثلاً ۵۰ کیلوگرم)",
  chequeId: "کدام چک؟ نام طرف حساب را بگویید.",
  debtId: "کدام بدهی/طلب؟ نام طرف حساب را بگویید.",
  name: "نام زمین جدید چیست؟",
  areaHa: "مساحت زمین چند هکتار است؟",
};

function missingSlots(draft: Draft): string[] {
  const required = REQUIRED[draft.intent] ?? [];
  return required.filter((key) => {
    const v = draft.slots[key];
    return v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v));
  });
}

function mergeSlots(pending: Pending, draft: Draft): Pending {
  const merged: Record<string, string | number | null> = { ...pending.slots };
  for (const [key, value] of Object.entries(draft.slots)) {
    const present = value !== null && value !== undefined && value !== "";
    if (present || merged[key] === undefined) merged[key] = value;
  }
  return { intent: pending.intent, slots: merged };
}

function summarize(intent: AssistIntent, slots: Record<string, string | number | null>, ctx: {
  landName?: string;
  cropName?: string;
  itemName?: string;
  worker?: string;
}): string {
  const a = Number(slots.amount ?? 0);
  switch (intent) {
    case "add_expense":
    case "add_income":
      return [
        `نوع: ${intent === "add_income" ? "درآمد" : "هزینه"}`,
        `مبلغ: ${money(a)}`,
        `دسته: ${slots.categoryName ?? "—"}`,
        ctx.landName ? `زمین: ${ctx.landName}` : null,
        ctx.cropName ? `کشت: ${ctx.cropName}` : null,
        slots.party ? `طرف حساب: ${slots.party}` : null,
        `تاریخ: ${formatDate(String(slots.date ?? todayISO()))}`,
        `روش: ${slots.method === "bank" ? "بانکی" : slots.method === "credit" ? "اعتباری" : "نقدی"}`,
      ]
        .filter(Boolean)
        .join("\n");
    case "add_debt":
    case "add_receivable":
      return [
        `نوع: ${intent === "add_debt" ? "بدهی ما" : "طلب ما"}`,
        `طرف حساب: ${slots.party ?? "—"}`,
        `مبلغ: ${money(a)}`,
        slots.dueDate ? `سررسید: ${formatDate(String(slots.dueDate))}` : "بدون سررسید",
      ].join("\n");
    case "add_cheque":
      return [
        `چک ${slots.direction === "received" ? "دریافتی" : "صادره"}`,
        `طرف حساب: ${slots.party ?? "—"}`,
        `مبلغ: ${money(a)}`,
        `سررسید: ${slots.dueDate ? formatDate(String(slots.dueDate)) : "—"}`,
        slots.bank ? `بانک: ${slots.bank}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    case "add_labor":
      return [
        `کارگر: ${slots.workerName ?? "—"}`,
        `مدت: ${formatNumber(Number(slots.days ?? 0), Number(slots.days ?? 0) % 1 === 0 ? 0 : 1)} روز`,
        `دستمزد روزانه: ${money(Number(slots.dailyWage ?? 0))}`,
        `جمع: ${money(Number(slots.days ?? 0) * Number(slots.dailyWage ?? 0))}`,
        ctx.landName ? `زمین: ${ctx.landName}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    case "inventory_out":
    case "inventory_in":
      return [
        `${intent === "inventory_out" ? "خروج از" : "ورود به"} انبار`,
        `کالا: ${ctx.itemName ?? "—"}`,
        `مقدار: ${formatNumber(Number(slots.quantity ?? 0), 1)}`,
      ].join("\n");
    case "add_task":
      return [`کار: ${slots.title ?? "—"}`, slots.dueDate ? `موعد: ${formatDate(String(slots.dueDate))}` : "بدون موعد"].join("\n");
    case "settle_cheque":
      return "چک انتخاب‌شده به وضعیت «پاس‌شده» تغییر می‌کند.";
    case "settle_debt":
      return "این بدهی/طلب «تسویه‌شده» می‌شود.";
    case "add_land":
      return [`نام زمین: ${slots.name ?? "—"}`, `مساحت: ${formatNumber(Number(slots.areaHa ?? 0), 1)} هکتار`].join("\n");
    default:
      return "آماده ثبت است.";
  }
}

async function executePending(pending: Pending): Promise<EngineReply> {
  const slots = pending.slots;
  const amount = Math.round(Number(slots.amount ?? 0));
  const date = String(slots.date ?? todayISO());
  let text = "";
  const actions: ActionLink[] = [];

  switch (pending.intent) {
    case "add_expense":
    case "add_income": {
      const kind = pending.intent === "add_income" ? "income" : "expense";
      const categoryId = await resolveCategoryId(String(slots.categoryName ?? ""), kind);
      await db.insert(transactions).values({
        kind,
        categoryId,
        landId: slots.landId ? Number(slots.landId) : null,
        cropId: slots.cropId ? Number(slots.cropId) : null,
        amount,
        date,
        description:
          String(slots.description ?? "").trim() ||
          `${kind === "income" ? "درآمد" : "هزینه"} ${slots.categoryName ?? ""}${slots.party ? ` - ${slots.party}` : ""}`,
        party: String(slots.party ?? ""),
        method: String(slots.method ?? "cash"),
        source: "assistant",
      });
      text = `✅ ${kind === "income" ? "درآمد" : "هزینه"} ${money(amount)} در دسته «${slots.categoryName}» ثبت شد.`;
      actions.push({ label: "مشاهده دفتر عملیات", href: "/transactions", kind: "link" });
      await learn(
        `ثبت خودکار ${kind === "income" ? "درآمد" : "هزینه"} با دستیار`,
        `آخرین ثبت: ${money(amount)} در دسته ${slots.categoryName}. الگوی دسته‌بندی شما ذخیره شد تا پیشنهادهای بعدی دقیق‌تر باشد.`,
      );
      break;
    }
    case "add_debt":
    case "add_receivable": {
      await db.insert(debts).values({
        party: String(slots.party ?? ""),
        direction: pending.intent === "add_debt" ? "payable" : "receivable",
        title: String(slots.title ?? "ثبت با دستیار"),
        amount,
        dueDate: slots.dueDate ? String(slots.dueDate) : null,
        notes: "ثبت‌شده توسط دستیار هوشمند",
      });
      text = `✅ ${pending.intent === "add_debt" ? "بدهی به" : "طلب از"} ${slots.party} به مبلغ ${money(amount)} ثبت شد.`;
      actions.push({ label: "مدیریت بدهی‌ها", href: "/finance", kind: "link" });
      await learn(`طرف حساب جدید: ${slots.party}`, `بدهی/طلب ${money(amount)} برای ${slots.party} ثبت شد.`);
      break;
    }
    case "add_cheque": {
      await db.insert(cheques).values({
        party: String(slots.party ?? ""),
        direction: String(slots.direction ?? "issued"),
        amount,
        dueDate: slots.dueDate ? String(slots.dueDate) : null,
        bank: String(slots.bank ?? ""),
        status: "pending",
        notes: "ثبت‌شده توسط دستیار هوشمند",
      });
      text = `✅ چک ${slots.direction === "received" ? "دریافتی" : "صادره"} ${money(amount)} برای ${slots.party} با سررسید ${formatDate(
        String(slots.dueDate),
      )} ثبت شد.`;
      actions.push({ label: "مدیریت چک‌ها", href: "/finance", kind: "link" });
      await learn("مدیریت چک فعال شد", `چک ${money(amount)} با سررسید ${formatDate(String(slots.dueDate))} ثبت شد.`);
      break;
    }
    case "add_task": {
      await db.insert(tasks).values({
        title: String(slots.title ?? "کار جدید"),
        dueDate: slots.dueDate ? String(slots.dueDate) : null,
        priority: String(slots.priority ?? "normal"),
        landId: slots.landId ? Number(slots.landId) : null,
        source: "assistant",
      });
      text = `✅ کار «${slots.title}» ثبت شد${slots.dueDate ? ` با موعد ${formatDate(String(slots.dueDate))}` : ""}.`;
      actions.push({ label: "داشبورد و کارها", href: "/", kind: "link" });
      break;
    }
    case "add_labor": {
      const days = Number(slots.days ?? 0);
      const wage = Number(slots.dailyWage ?? 0);
      const workerName = String(slots.workerName ?? "");
      const workerRow = matchByName(workerName, await getWorkers());
      await db.insert(laborLogs).values({
        workerId: workerRow?.id ?? null,
        workerName,
        landId: slots.landId ? Number(slots.landId) : null,
        cropId: slots.cropId ? Number(slots.cropId) : null,
        date,
        days,
        dailyWage: wage,
        amount: Math.round(days * wage),
        task: String(slots.task ?? "کار مزرعه"),
        paid: false,
      });
      text = `✅ دستمزد ${workerName} برای ${formatNumber(days, days % 1 === 0 ? 0 : 1)} روز جمعاً ${money(days * wage)} ثبت شد (پرداخت‌نشده).`;
      actions.push({ label: "مدیریت کارگران", href: "/labor", kind: "link" });
      break;
    }
    case "inventory_out":
    case "inventory_in": {
      const itemId = Number(slots.itemId);
      const rows = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemId));
      const item = rows[0];
      if (!item) return { text: "کالای انتخاب‌شده پیدا نشد.", actions: [], suggestions: ["گزارش انبار"], kind: "blocked" };
      const qty = Number(slots.quantity ?? 0);
      if (pending.intent === "inventory_out" && qty > item.quantity) {
        return {
          text: `موجودی ${item.name} فقط ${formatNumber(item.quantity, 1)} ${item.unit} است و بیشتر از آن قابل خروج نیست. مقدار کمتری بگویید یا ابتدا ورود انبار ثبت کنید.`,
          actions: [{ label: "انبار", href: "/inventory", kind: "link" }],
          suggestions: ["ورود نهاده ثبت کن", "گزارش انبار"],
          kind: "blocked",
        };
      }
      await db.insert(inventoryMoves).values({
        itemId,
        kind: pending.intent === "inventory_out" ? "out" : "in",
        quantity: qty,
        unitCost: item.unitCost,
        date,
        note: "ثبت با دستیار هوشمند",
        cropId: slots.cropId ? Number(slots.cropId) : null,
      });
      await db
        .update(inventoryItems)
        .set({ quantity: pending.intent === "inventory_out" ? item.quantity - qty : item.quantity + qty })
        .where(eq(inventoryItems.id, itemId));
      text = `✅ ${pending.intent === "inventory_out" ? "خروج" : "ورود"} ${formatNumber(qty, 1)} ${item.unit} ${item.name} ثبت شد. موجودی جدید: ${formatNumber(
        pending.intent === "inventory_out" ? item.quantity - qty : item.quantity + qty,
        1,
      )} ${item.unit}.`;
      actions.push({ label: "صفحه انبار", href: "/inventory", kind: "link" });
      break;
    }
    case "settle_cheque": {
      const id = Number(slots.chequeId);
      await db.update(cheques).set({ status: "passed" }).where(eq(cheques.id, id));
      text = "✅ چک به وضعیت «پاس‌شده» به‌روزرسانی شد.";
      actions.push({ label: "مدیریت چک‌ها", href: "/finance", kind: "link" });
      break;
    }
    case "settle_debt": {
      const id = Number(slots.debtId);
      await db.update(debts).set({ paid: true }).where(eq(debts.id, id));
      text = "✅ بدهی/طلب تسویه‌شده علامت خورد.";
      actions.push({ label: "مدیریت بدهی‌ها", href: "/finance", kind: "link" });
      break;
    }
    case "add_land": {
      await db.insert(lands).values({
        name: String(slots.name ?? "زمین جدید"),
        areaHa: Number(slots.areaHa ?? 0),
        region: String(slots.region ?? ""),
      });
      text = `✅ زمین «${slots.name}» با ${formatNumber(Number(slots.areaHa ?? 0), 1)} هکتار ثبت شد.`;
      actions.push({ label: "زمین‌ها", href: "/lands", kind: "link" });
      break;
    }
    default:
      return { text: "متوجه نشدم چه چیزی ثبت کنم. لطفاً واضح‌تر بگویید.", actions: [], suggestions: [], kind: "blocked" };
  }

  await refreshInsights();
  return { text: `${text}\n\nاگر لازم است موردی اصلاح شود بگویید یا از صفحه مربوطه ویرایش کنید.`, actions, suggestions: ["گزارش سود بده", "چک بعدی کِی است؟", "ثبت هزینه جدید"], kind: "done" };
}

/** Extracts only the fields that are explicitly present in the message. */
async function extractSlots(intent: AssistIntent, text: string): Promise<Record<string, string | number | null>> {
  const [landRows, cropRows, invRows, workerRows, catRows, debtRows, chequeRows] = await Promise.all([
    getLands(),
    getCrops(),
    getInventory(),
    getWorkers(),
    getCategories(),
    getDebts(),
    getCheques(),
  ]);
  const knownParties = [...new Set([...debtRows.map((d) => d.party), ...chequeRows.map((c) => c.party)])];
  const t = normalizeFa(text);
  const out: Record<string, string | number | null> = {};

  const amount = parseAmount(text)?.amount ?? null;
  if (amount !== null && amount > 0) out.amount = amount;
  const due = parseDueDate(text);
  if (due) {
    out.date = due;
    if (["add_cheque", "add_debt", "add_receivable", "add_task"].includes(intent)) out.dueDate = due;
  }
  const landId = matchLand(text, landRows);
  if (landId) out.landId = landId;
  const cropId = matchCrop(text, cropRows);
  if (cropId) out.cropId = cropId;

  const party = extractParty(text, knownParties);
  const landName = landRows.find((l) => l.id === landId)?.name ?? "";
  const cropName = cropRows.find((c) => c.id === cropId)?.name ?? "";
  const partyIsPlace =
    !!party &&
    ((landName && normalizeFa(party).includes(normalizeFa(landName))) ||
      (cropName && normalizeFa(party).includes(normalizeFa(cropName))) ||
      normalizeFa(party) === normalizeFa("زمین شمالی"));
  if (party && !partyIsPlace) out.party = party;

  const catName = catRows.find((c) => t.includes(normalizeFa(c.name)))?.name ?? guessCategoryName(text);
  if (catName) out.categoryName = catName;

  if (intent === "add_expense" || intent === "add_income") {
    if (/(نسیه|اعتباری|چک|بعدا پرداخت)/u.test(t)) out.method = "credit";
    else if (/(بانک|کارت|واریز|اینترنتی)/u.test(t)) out.method = "bank";
    else if (/(نقد|نقدی|دستمزد دادم)/u.test(t)) out.method = "cash";
    const description = t
      .replace(/(ثبت کن|یادداشت کن|اضافه کن|تایید|تأیید|بله|اوکی|درست|هزینه|خریدم|خرید|پرداخت کردم|دادم|فروختم|فروش)/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    // only describe the record from a message that actually carries a value/verb (not a bare confirmation)
    if (amount !== null && description.length >= 5) out.description = description.slice(0, 90);
  }

  if (intent === "add_cheque") {
    if (/(دریافتی|دریافت کردم|گرفتم|از .{0,20} گرفتم)/u.test(t)) out.direction = "received";
    else if (/(صادره|صادر|بنویس|بکش|بده|پرداخت)/u.test(t)) out.direction = "issued";
    const bank = t.match(/(بانک\s+[\p{L}]+)/u);
    if (bank) out.bank = bank[1];
  }

  if (intent === "add_labor") {
    const worker = matchByName(
      text,
      workerRows.map((w) => ({ id: w.id, name: w.name, dailyWage: w.dailyWage })),
    );
    if (worker && worker.name) {
      out.workerName = worker.name;
      out.dailyWage = Number(worker.dailyWage ?? 0);
    }
    const days = t.match(/(\d+(?:[.,]\d+)?)\s*(?:روز|نفر)/u);
    if (days) out.days = Number(days[1].replace(/,/g, ""));
    if (!worker && /(دستمزد|روزمزد|روزی|نرخ)/u.test(t)) {
      const wage = parseAmount(text)?.amount;
      if (wage) out.dailyWage = wage;
    }
  }

  if (intent === "inventory_in" || intent === "inventory_out") {
    const item = matchByName(text, invRows);
    if (item) {
      out.itemId = item.id;
      out.itemName = item.name;
    }
    const qty = t.match(/(\d+(?:[.,]\d+)?)\s*(کیلوگرم|کیلو|لیتر|عدد|بوته|کیسه|تن)/u);
    if (qty) out.quantity = qty[2] === "تن" ? Number(qty[1].replace(/,/g, "")) * 1000 : Number(qty[1].replace(/,/g, ""));
  }

  if (intent === "add_task") {
    const clean = t
      .replace(/(یادداشت کن|یادم باشه|یاداوری|یادآوری|کار جدید|تسک|وظیفه|اضافه کن|ثبت کن|بذار|بگذار|برای|تا)/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (clean.length >= 3) out.title = clean;
  }

  if (intent === "add_land") {
    const area = t.match(/(\d+(?:[.,]\d+)?)\s*هکتار/u);
    if (area) out.areaHa = Number(area[1].replace(/,/g, ""));
    const name = extractParty(text, landRows.map((l) => l.name));
    if (name) out.name = name;
    const region = t.match(/(?:منطقه|روستای|در)\s+([\p{L}\s]{2,25})/u);
    if (region) out.region = region[1].trim();
  }

  if (intent === "settle_cheque") {
    const cheque = matchByName(text, chequeRows.map((c) => ({ id: c.id, name: c.party })));
    if (cheque) out.chequeId = cheque.id;
    if (party) {
      const byParty = chequeRows.find((c) => normalizeFa(c.party).includes(normalizeFa(party)));
      if (byParty) out.chequeId = byParty.id;
    }
  }

  if (intent === "settle_debt") {
    const debt = matchByName(text, debtRows.filter((d) => !d.paid).map((d) => ({ id: d.id, name: d.party })));
    if (debt) out.debtId = debt.id;
    if (party) {
      const byParty = debtRows.find((d) => !d.paid && normalizeFa(d.party).includes(normalizeFa(party)));
      if (byParty) out.debtId = byParty.id;
    }
  }

  return out;
}

const DRAFT_TITLES: Partial<Record<AssistIntent, string>> = {
  add_expense: "ثبت هزینه",
  add_income: "ثبت درآمد",
  add_debt: "ثبت بدهی",
  add_receivable: "ثبت طلب",
  add_cheque: "ثبت چک",
  add_task: "ثبت کار",
  add_labor: "ثبت دستمزد",
  inventory_out: "خروج از انبار",
  inventory_in: "ورود به انبار",
  settle_cheque: "تسویه چک",
  settle_debt: "تسویه بدهی/طلب",
  add_land: "ثبت زمین جدید",
};

async function presentDraft(
  intent: AssistIntent,
  slots: Record<string, string | number | null>,
  title: string,
): Promise<EngineReply> {
  const missing = missingSlots({ intent, slots, title });
  if (missing.length) {
    const primary = missing[0];
    const extra = missing.length > 1 ? `\n(همچنین لازم دارم: ${missing.slice(1).map((m) => QUESTIONS[m] ?? m).join(" | ")})` : "";
    return {
      text: `برای ${title} یک مورد را لازم دارم:\n❓ ${QUESTIONS[primary] ?? primary}${extra}\nاگر منصرف شدید بنویسید «لغو».`,
      actions: [],
      suggestions: missing.includes("categoryName")
        ? ["کود و سم", "بذر و نهال", "دستمزد کارگر", "فروش محصول"]
        : missing.includes("dueDate")
          ? ["۱۵ آبان", "۱۰ روز بعد", "پایان ماه"]
          : ["مبلغ ۱۰ میلیون تومان", "امروز", "لغو"],
      kind: "question",
    };
  }

  const [landRow, cropRow, itemRow] = await Promise.all([
    slots.landId ? db.select().from(lands).where(eq(lands.id, Number(slots.landId))) : Promise.resolve([]),
    slots.cropId ? db.select().from(cropsTable).where(eq(cropsTable.id, Number(slots.cropId))) : Promise.resolve([]),
    slots.itemId ? db.select().from(inventoryItems).where(eq(inventoryItems.id, Number(slots.itemId))) : Promise.resolve([]),
  ]);

  const summary = summarize(intent, slots, {
    landName: landRow[0]?.name,
    cropName: cropRow[0]?.name,
    itemName: itemRow[0]?.name,
  });

  return {
    text: `پیش‌نویس آماده شد:\n${summary}\n\nآیا ثبت کنم؟ (بنویسید «تأیید» یا «لغو»)`,
    actions: [{ label: "لغو", kind: "cancel" }],
    suggestions: ["تأیید", "لغو"],
    kind: "preview",
  };
}

async function answerAssistant(text: string, state: Record<string, unknown>): Promise<{ reply: EngineReply; nextState: Record<string, unknown> }> {
  const pending = (state.pending as Pending | undefined) ?? undefined;

  if (pending) {
    if (isCancel(text)) {
      return {
        reply: { text: "لغو شد. چیزی ثبت نکردم.", actions: [], suggestions: ["ثبت هزینه", "گزارش سود بده"], kind: "answer" },
        nextState: { pending: null },
      };
    }

    const fill = await extractSlots(pending.intent, text);
    const mergedSlots: Record<string, string | number | null> = { ...pending.slots, ...fill };
    const merged: Pending = { intent: pending.intent, slots: mergedSlots };
    const complete = missingSlots({ intent: merged.intent, slots: merged.slots, title: "" }).length === 0;

    if (isConfirm(text)) {
      if (complete) {
        const reply = await executePending(merged);
        return { reply, nextState: { pending: null, lastIntent: merged.intent } };
      }
      const reply = await presentDraft(merged.intent, merged.slots, DRAFT_TITLES[merged.intent] ?? "ثبت اطلاعات");
      return { reply, nextState: { ...state, pending: merged } };
    }

    const detected = detectIntent(text);
    const switchSignal =
      Object.keys(fill).length === 0 &&
      detected !== pending.intent &&
      !["unknown", "report", "learn"].includes(detected);

    if (!switchSignal) {
      const reply = await presentDraft(merged.intent, merged.slots, DRAFT_TITLES[merged.intent] ?? "ثبت اطلاعات");
      return { reply, nextState: { ...state, pending: merged } };
    }
    // otherwise fall through and start a fresh draft for the new intent
  }

  const intent = detectIntent(text);

  if (intent === "report" || intent === "learn") {
    const report = intent === "report" ? await buildReport(text) : await answerSupport(text);
    if (report.kind !== "blocked" || intent === "report") {
      return {
        reply: { ...report, suggestions: [...new Set([...report.suggestions, "ثبت هزینه جدید"])].slice(0, 3) },
        nextState: { pending: null },
      };
    }
  }

  if (intent === "unknown" || DRAFT_TITLES[intent] === undefined) {
    const report = await buildReport(text);
    return {
      reply: {
        text:
          "می‌توانم در همین نرم‌افزار کارهای زیر را برایتان انجام دهم:\n" +
          "• ثبت هزینه یا درآمد (با دسته، زمین و طرف حساب)\n" +
          "• ثبت بدهی، طلب و چک با سررسید\n" +
          "• ثبت دستمزد کارگر و کارهای روزمزد\n" +
          "• ورود و خروج نهاده از انبار\n" +
          "• ثبت یادآوری (کار) و زمین جدید\n" +
          "• گزارش سود، هزینه، بهای تمام‌شده و انبار\n\n" +
          "مثال: «۲۵ میلیون تومان کود برای زمین شمالی خریدم نسیه» یا «برای فروشگاه نهاده ۴۴ میلیون چک ۱۵ آبان بنویس».\n\n" +
          `خلاصه وضعیت مزرعه:\n${report.text}`,
        actions: [],
        suggestions: ["ثبت هزینه ۵ میلیون گازوئیل", "چک ۲۰ میلیون برای ۱۰ روز بعد", "گزارش سود بده"],
        kind: "question",
      },
      nextState: { pending: null },
    };
  }

  const fresh = await extractSlots(intent, text);
  const defaults: Record<string, string | number | null> = { date: todayISO() };
  if (intent === "add_expense" || intent === "add_income") defaults.method = "cash";
  if (intent === "add_cheque") defaults.direction = "issued";
  if (intent === "add_task") defaults.priority = "normal";

  const slots: Record<string, string | number | null> = {
    ...defaults,
    ...fresh,
    date: String(fresh.date ?? defaults.date ?? todayISO()),
  };

  const title = DRAFT_TITLES[intent] ?? "ثبت اطلاعات";
  const reply = await presentDraft(intent, slots, title);
  return { reply, nextState: { ...state, pending: { intent, slots } } };
}

/* --------------------------- optional LLM --------------------------- */

async function polishWithLlm(question: string, local: string, mode: ChatMode): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) return local;
  const baseUrl =
    process.env.OPENAI_BASE_URL ||
    (process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY
      ? "https://openrouter.ai/api/v1"
      : process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY
        ? "https://api.groq.com/openai/v1"
        : "https://api.openai.com/v1");
  const model =
    process.env.OPENAI_MODEL ||
    (baseUrl.includes("openrouter") ? "openai/gpt-4o-mini" : baseUrl.includes("groq") ? "llama-3.1-8b-instant" : "gpt-4o-mini");
  try {
    const context = await buildFarmContext();
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content:
              "تو «کشاورزحساب» هستی، دستیار تخصصی حسابداری کشاورزی. فقط درباره حسابداری، مدیریت مزرعه و همین نرم‌افزار پاسخ بده. " +
              "به سؤال‌های بیربط پاسخ نده و به فارسی روان و کوتاه جواب بده. هیچ عددی از خودت نساز؛ فقط از داده‌های زمینه استفاده کن. " +
              `حالت فعلی: ${MODE_LABEL[mode]}. ${mode === "support" ? "تو فقط آموزش و گزارش می‌دهی و اجازه تغییر داده نداری." : "تو اجازه ثبت داده داری اما عملیات نوشتن توسط موتور امن انجام می‌شود."}\n` +
              `داده‌های مزرعه:\n${context}\n\nپاسخ پایه موتور محلی (منبع معتبر):\n${local}`,
          },
          { role: "user", content: question },
        ],
      }),
    });
    if (!res.ok) return local;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content?.trim();
    return content && content.length > 20 ? content : local;
  } catch {
    return local;
  }
}

/* --------------------------- public API --------------------------- */

export async function respond(opts: {
  mode: ChatMode;
  message: string;
  state: Record<string, unknown>;
}): Promise<{ reply: EngineReply; state: Record<string, unknown> }> {
  const { mode, message } = opts;
  let state = opts.state ?? {};

  if (mode === "assistant") {
    const result = await answerAssistant(message, state);
    const polished = await polishWithLlm(message, result.reply.text, mode);
    return { reply: { ...result.reply, text: polished }, state: result.nextState };
  }

  state = { ...state, pending: null };
  const reply = await answerSupport(message);
  const polished = await polishWithLlm(message, reply.text, mode);
  return { reply: { ...reply, text: polished }, state };
}

export const MODE_INFO: Record<ChatMode, { title: string; description: string; canWrite: boolean }> = {
  support: {
    title: "پشتیبان",
    description: "آموزش هر بخش نرم‌افزار، راهنمای مفاهیم حسابداری کشاورزی و تهیه گزارش. فقط خواندنی و بدون هیچ تغییری در داده‌ها.",
    canWrite: false,
  },
  assistant: {
    title: "دستیار",
    description: "ثبت هزینه، درآمد، بدهی، چک، دستمزد، انبار و یادآوری با گفتگو. اگر اطلاعات ناقص باشد سؤال می‌پرسد و بعد از تأیید شما ثبت می‌کند.",
    canWrite: true,
  },
};

export { tasks as tasksTable, knowledge as knowledgeTable, safeNum };
